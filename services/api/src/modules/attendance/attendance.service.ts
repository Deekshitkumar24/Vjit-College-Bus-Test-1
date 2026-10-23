import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QrTokenService, QrAttendanceValidator, type QrScanErrorCode } from '@collegebus/domain';

export interface AttendanceServiceOptions {
  keys?: Record<string, string>;
  activeKeyVersion?: string;
  rotationSeconds?: number;
}

export interface TripRecord {
  id: string;
  route_id?: string;
  trip_type?: string;
  bus_id: string;
  status: string;
  scheduled_departure?: Date | string;
  bus?: { id?: string; bus_number?: string };
}

export interface ShiftRecord {
  id: string;
  driver_id?: string;
  bus_id: string;
  status: string;
}

export interface StudentAssignmentRecord {
  student_id: string;
  route_id: string;
  boarding_stop_id: string;
  on_leave: boolean;
}

export interface AttendanceRecordItem {
  id?: string;
  status: string;
}

export interface GetTripQrParams {
  tripId: string;
  driverId: string;
  getTrip: (tripId: string) => Promise<TripRecord | null>;
  getActiveShift: (driverId: string) => Promise<ShiftRecord | null>;
}

export interface ProcessScanParams {
  studentId: string;
  token: string;
  scanTime?: number | undefined;
  getTrip: (tripId: string) => Promise<TripRecord | null>;
  getStudentAssignment: (
    studentId: string,
    routeId: string,
    tripType: string,
  ) => Promise<StudentAssignmentRecord | null>;
  getExistingAttendance: (
    tripId: string,
    studentId: string,
  ) => Promise<AttendanceRecordItem | null>;
  saveAttendance: (record: {
    tripId: string;
    studentId: string;
    status: string;
    method: string;
    boardingStopId?: string | undefined;
    boardedAt: Date;
  }) => Promise<Record<string, unknown>>;
}

export interface ScanResult {
  success: boolean;
  error?: QrScanErrorCode | string | undefined;
  status?: string | undefined;
  bus_number?: string | undefined;
  boarded_at?: string | undefined;
}

@Injectable()
export class AttendanceService {
  private readonly tokenService: QrTokenService;
  private readonly validator: QrAttendanceValidator;
  private readonly rotationSeconds: number;
  // Rate limiting map: studentId -> array of scan timestamps (in ms)
  private readonly rateLimitMap = new Map<string, number[]>();

  constructor(options?: AttendanceServiceOptions) {
    const keys = options?.keys ?? {
      '2026-10': process.env['QR_HMAC_KEY'] || 'default-fallback-key-32-bytes-minimum-length!',
    };
    const activeKeyVersion = options?.activeKeyVersion ?? '2026-10';
    this.rotationSeconds = options?.rotationSeconds ?? 30;

    this.tokenService = new QrTokenService({
      keys,
      activeKeyVersion,
      rotationSeconds: this.rotationSeconds,
    });

    this.validator = new QrAttendanceValidator({
      keys,
      rotationSeconds: this.rotationSeconds,
    });
  }

  generateRawToken(params: { busId: string; tripId: string; timestamp?: number }): string {
    return this.tokenService.generateToken(params);
  }

  async getTripQr(params: GetTripQrParams): Promise<{ qr_code: string; rotation_seconds: number }> {
    const trip = await params.getTrip(params.tripId);
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const shift = await params.getActiveShift(params.driverId);
    if (!shift || shift.bus_id !== trip.bus_id || shift.status !== 'ACTIVE') {
      throw new ForbiddenException('Driver has no active shift matching this trip bus');
    }

    if (trip.status !== 'ACTIVE') {
      throw new BadRequestException('Trip is not in ACTIVE state');
    }

    const qr_code = this.tokenService.generateToken({
      busId: trip.bus_id,
      tripId: trip.id,
      timestamp: Date.now(),
    });

    return {
      qr_code,
      rotation_seconds: this.rotationSeconds,
    };
  }

  checkRateLimit(studentId: string, now: number = Date.now()): boolean {
    const windowMs = 60 * 1000;
    const maxScansPerMinute = 10;
    const history = this.rateLimitMap.get(studentId) || [];
    const recent = history.filter((ts) => now - ts < windowMs);

    if (recent.length >= maxScansPerMinute) {
      this.rateLimitMap.set(studentId, recent);
      return false;
    }

    recent.push(now);
    this.rateLimitMap.set(studentId, recent);
    return true;
  }

  async processScan(params: ProcessScanParams): Promise<ScanResult> {
    const scanTime = params.scanTime ?? Date.now();

    // Check rate limit: 10 scans per min per user
    if (!this.checkRateLimit(params.studentId, scanTime)) {
      return {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
      };
    }

    // Parse token payload loosely to identify trip
    const parts = params.token.split('.');
    if (parts.length !== 4) {
      return { success: false, error: 'QR_INVALID' };
    }

    let payloadStr: string;
    try {
      payloadStr = Buffer.from(parts[2]!, 'base64url').toString('utf8');
    } catch {
      return { success: false, error: 'QR_INVALID' };
    }

    const [tokenBusId, tokenTripId] = payloadStr.split('|');
    if (!tokenTripId || !tokenBusId) {
      return { success: false, error: 'QR_INVALID' };
    }

    const trip = await params.getTrip(tokenTripId);
    if (!trip) {
      return { success: false, error: 'TRIP_NOT_ACTIVE' };
    }

    const studentAssignment = await params.getStudentAssignment(
      params.studentId,
      trip.route_id ?? '',
      trip.trip_type ?? '',
    );

    const existing = await params.getExistingAttendance(trip.id, params.studentId);

    // Validate using domain validator
    const validationResult = this.validator.validateScan({
      token: params.token,
      scanTime,
      context: {
        studentId: params.studentId,
        trip: {
          id: trip.id,
          bus_id: trip.bus_id,
          status: trip.status,
          scheduled_departure: trip.scheduled_departure
            ? new Date(trip.scheduled_departure)
            : new Date(),
        },
        studentAssignment: studentAssignment
          ? {
              student_id: studentAssignment.student_id,
              route_id: studentAssignment.route_id,
              boarding_stop_id: studentAssignment.boarding_stop_id,
              on_leave: !!studentAssignment.on_leave,
            }
          : null,
        existingAttendanceRecord: existing ? { status: existing.status } : null,
      },
    });

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error ?? 'INVALID_TOKEN',
      };
    }

    const boardedAt = new Date(scanTime);
    try {
      await params.saveAttendance({
        tripId: trip.id,
        studentId: params.studentId,
        status: 'BOARDED',
        method: 'QR',
        boardingStopId: validationResult.boardingStopId,
        boardedAt,
      });
    } catch (err: unknown) {
      const errorObj = err as { message?: string; code?: string };
      if (errorObj?.message?.includes('DUPLICATE_BOARDING') || errorObj?.code === 'P2002') {
        return { success: false, error: 'DUPLICATE_BOARDING' };
      }
      throw err;
    }

    return {
      success: true,
      status: 'BOARDED',
      bus_number: trip.bus?.bus_number ?? 'BUS',
      boarded_at: boardedAt.toISOString(),
    };
  }

  async processScanWithStore(params: {
    tripId: string;
    studentId: string;
    token: string;
    scanTime?: number | undefined;
    getTrip: (tripId: string) => Promise<TripRecord | null>;
    getStudentAssignment: (
      studentId: string,
      routeId: string,
      tripType: string,
    ) => Promise<StudentAssignmentRecord | null>;
    store: Map<string, unknown>;
  }): Promise<ScanResult> {
    const key = `${params.tripId}:${params.studentId}`;
    if (params.store.has(key)) {
      return { success: false, error: 'DUPLICATE_BOARDING' };
    }

    // Process scan with store as backing repository
    return this.processScan({
      studentId: params.studentId,
      token: params.token,
      scanTime: params.scanTime,
      getTrip: params.getTrip,
      getStudentAssignment: params.getStudentAssignment,
      getExistingAttendance: async () => (params.store.get(key) as AttendanceRecordItem) || null,
      saveAttendance: async (record) => {
        if (params.store.has(key)) {
          throw new Error('DUPLICATE_BOARDING');
        }
        params.store.set(key, record);
        return { id: 'rec-concurrency', ...record };
      },
    });
  }

  async manualCheckIn(params: {
    tripId: string;
    studentId: string;
    driverId: string;
    reason?: string;
    isGuest?: boolean;
    saveRecord: (record: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }): Promise<{ success: boolean; status: string; method: string }> {
    const status = params.isGuest ? 'FLAGGED_GUEST' : 'MANUAL_CHECKIN';
    const method = 'DRIVER';

    await params.saveRecord({
      trip_id: params.tripId,
      student_id: params.studentId,
      status,
      method,
      marked_by: params.driverId,
      boarded_at: new Date(),
      note: params.reason,
    });

    return {
      success: true,
      status,
      method,
    };
  }

  async coordinatorCorrection(params: {
    attendanceId: string;
    newStatus: string;
    coordinatorId: string;
    reason: string;
    saveRecord: (update: Record<string, unknown>) => Promise<Record<string, unknown>>;
    logAudit: (audit: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }): Promise<{ success: boolean; status: string }> {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new BadRequestException('Mandatory reason required for coordinator correction');
    }

    await params.saveRecord({
      status: params.newStatus,
      marked_by: params.coordinatorId,
    });

    await params.logAudit({
      action: 'ATTENDANCE_CORRECTION',
      entity_type: 'attendance_record',
      entity_id: params.attendanceId,
      reason: params.reason,
      actor_id: params.coordinatorId,
      timestamp: new Date(),
    });

    return {
      success: true,
      status: params.newStatus,
    };
  }
}
