import {
  AttendanceCheckInRequestDto,
  AttendanceCheckInResponseDto,
  AttendanceCheckInResponseDtoSchema,
} from '@collegebus/contracts';
import { MobileCacheStore } from '../store/cache-store.js';
import { QrAttendanceValidator, QrValidationResult } from './qr-validator.js';

export interface CheckInOutcome {
  status: 'BOARDED' | 'ALREADY_CHECKED_IN' | 'EXPIRED_QR' | 'INVALID_TRIP' | 'OFFLINE_QUEUED';
  message: string;
  boardedAt: string | null;
  attendanceRecordId: string | null;
}

export class AttendanceClient {
  private readonly baseUrl: string;
  private readonly validator: QrAttendanceValidator;
  private readonly cacheStore: MobileCacheStore;
  private readonly fetchFn: typeof fetch;

  constructor(options: {
    baseUrl: string;
    cacheStore: MobileCacheStore;
    validator?: QrAttendanceValidator;
    fetchFn?: typeof fetch;
  }) {
    this.baseUrl = options.baseUrl;
    this.cacheStore = options.cacheStore;
    this.validator = options.validator ?? new QrAttendanceValidator();
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Processes a scanned QR code token and completes attendance check-in.
   */
  public async checkInWithQr(params: {
    rawQr: string;
    token: string;
    boardingStopId?: string;
    clientTimestamp?: string;
    timestampMs?: number;
  }): Promise<CheckInOutcome> {
    const now = params.timestampMs ?? Date.now();
    const validation: QrValidationResult = this.validator.validate(params.rawQr, now);

    if (!validation.isValid) {
      if (validation.error === 'EXPIRED') {
        return {
          status: 'EXPIRED_QR',
          message: validation.message,
          boardedAt: null,
          attendanceRecordId: null,
        };
      }
      return {
        status: 'INVALID_TRIP',
        message: validation.message,
        boardedAt: null,
        attendanceRecordId: null,
      };
    }

    const requestPayload: AttendanceCheckInRequestDto = {
      trip_id: validation.payload.trip_id,
      bus_id: validation.payload.bus_id,
      qr_payload: params.rawQr,
      ...(params.boardingStopId ? { boarding_stop_id: params.boardingStopId } : {}),
      client_timestamp: params.clientTimestamp ?? new Date(now).toISOString(),
    };

    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        if (response.status === 409) {
          return {
            status: 'ALREADY_CHECKED_IN',
            message: 'You have already checked in for this trip',
            boardedAt: null,
            attendanceRecordId: null,
          };
        }
        if (response.status === 400 || response.status === 403) {
          return {
            status: 'INVALID_TRIP',
            message: 'Check-in rejected: trip or student assignment mismatch',
            boardedAt: null,
            attendanceRecordId: null,
          };
        }
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const parsed: AttendanceCheckInResponseDto = AttendanceCheckInResponseDtoSchema.parse(data);

      return {
        status: parsed.status,
        message: parsed.message,
        boardedAt: parsed.boarded_at,
        attendanceRecordId: parsed.attendance_record_id,
      };
    } catch {
      // Network or connectivity issue: queue offline request safely
      this.cacheStore.queueOfflineAction(
        'ATTENDANCE_SCAN',
        requestPayload as unknown as Record<string, unknown>,
      );

      return {
        status: 'OFFLINE_QUEUED',
        message: 'Boarding record saved locally. Will sync automatically when connection restores.',
        boardedAt: new Date(now).toISOString(),
        attendanceRecordId: null,
      };
    }
  }
}
