import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  QrTokenService,
  QrAttendanceValidator,
  type QrScanErrorCode,
} from '@collegebus/domain';

export interface AttendanceServiceOptions {
  keys?: Record<string, string>;
  activeKeyVersion?: string;
  rotationSeconds?: number;
}

export interface GetTripQrParams {
  tripId: string;
  driverId: string;
  getTrip: (tripId: string) => Promise<any>;
  getActiveShift: (driverId: string) => Promise<any>;
}

export interface ProcessScanParams {
  studentId: string;
  token: string;
  scanTime?: number;
  getTrip: (tripId: string) => Promise<any>;
  getStudentAssignment: (studentId: string, routeId: string, tripType: string) => Promise<any>;
  getExistingAttendance: (tripId: string, studentId: string) => Promise<any>;
  saveAttendance: (record: {
    tripId: string;
    studentId: string;
    status: string;
    method: string;
    boardingStopId?: string;
    boardedAt: Date;
  }) => Promise<any>;
}

export interface ScanResult {
  success: boolean;
  error?: QrScanErrorCode | string;
  status?: string;
  bus_number?: string;
  boarded_at?: string;
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
      '2026-10': process.env.QR_HMAC_KEY || 'default-fallback-key-32-bytes-minimum-length!',
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
      payloadStr = Buffer.from(parts[2], 'base64url').toString('utf8');
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
      trip.route_id,
      trip.trip_type
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
          scheduled_departure: trip.scheduled_departure,
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
        error: validationResult.error,
      };
    }

    const boardedAt = new Date(scanTime);
    await params.saveAttendance({
      tripId: trip.id,
      studentId: params.studentId,
      status: 'BOARDED',
      method: 'QR',
      boardingStopId: validationResult.boardingStopId,
      boardedAt,
    });

    return {
      success: true,
      status: 'BOARDED',
      bus_number: trip.bus?.bus_number ?? 'BUS',
      boarded_at: boardedAt.toISOString(),
    };
  }
}
