import { createHmac, timingSafeEqual } from 'node:crypto';

export interface QrTokenServiceOptions {
  keys: Record<string, string>;
  activeKeyVersion: string;
  rotationSeconds?: number;
}

export interface GenerateQrTokenParams {
  busId: string;
  tripId: string;
  timestamp?: number; // unix milliseconds
}

export class QrTokenService {
  private readonly keys: Record<string, string>;
  private readonly activeKeyVersion: string;
  private readonly rotationSeconds: number;

  constructor(options: QrTokenServiceOptions) {
    this.keys = options.keys;
    this.activeKeyVersion = options.activeKeyVersion;
    this.rotationSeconds = options.rotationSeconds ?? 30;
  }

  generateToken(params: GenerateQrTokenParams): string {
    const ts = params.timestamp ?? Date.now();
    const slot = Math.floor(ts / 1000 / this.rotationSeconds);
    const payload = `${params.busId}|${params.tripId}|${slot}`;
    const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');

    const key = this.keys[this.activeKeyVersion];
    if (!key) {
      throw new Error(`Active QR key version '${this.activeKeyVersion}' not configured`);
    }

    const signature = createHmac('sha256', key).update(payload).digest('base64url');
    return `v1.${this.activeKeyVersion}.${payloadB64}.${signature}`;
  }
}

export interface QrValidationContext {
  studentId: string;
  trip: {
    id: string;
    bus_id: string;
    status: string; // ACTIVE, SCHEDULED, COMPLETED, CANCELLED
    scheduled_departure: Date;
  };
  studentAssignment: {
    student_id: string;
    route_id: string;
    boarding_stop_id: string;
    on_leave: boolean;
  } | null;
  existingAttendanceRecord: {
    status: string;
  } | null;
}

export interface ValidateScanParams {
  token: string;
  scanTime?: number; // unix milliseconds
  context: QrValidationContext;
  windowBeforeMinutes?: number; // default 10
  windowAfterMinutes?: number; // default 15
}

export type QrScanErrorCode =
  | 'AUTH_REQUIRED'
  | 'QR_INVALID'
  | 'QR_EXPIRED'
  | 'TRIP_NOT_ACTIVE'
  | 'NOT_ON_ROUTE'
  | 'DUPLICATE_BOARDING'
  | 'BOARDING_WINDOW_CLOSED';

export interface QrScanValidationResult {
  valid: boolean;
  error?: QrScanErrorCode;
  status?: 'BOARDED';
  boardingStopId?: string;
  busId?: string;
  tripId?: string;
}

export interface QrAttendanceValidatorOptions {
  keys: Record<string, string>;
  rotationSeconds?: number;
}

export class QrAttendanceValidator {
  private readonly keys: Record<string, string>;
  private readonly rotationSeconds: number;

  constructor(options: QrAttendanceValidatorOptions) {
    this.keys = options.keys;
    this.rotationSeconds = options.rotationSeconds ?? 30;
  }

  validateScan(params: ValidateScanParams): QrScanValidationResult {
    const {
      token,
      scanTime = Date.now(),
      context,
      windowBeforeMinutes = 10,
      windowAfterMinutes = 15,
    } = params;

    // Step 1: Session check (assumed checked by caller, but guard presence of studentId)
    if (!context.studentId) {
      return { valid: false, error: 'AUTH_REQUIRED' };
    }

    // Step 2: Token format, key version, constant-time HMAC check
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      return { valid: false, error: 'QR_INVALID' };
    }

    const [, keyVersion, payloadB64, signature] = parts;
    if (!keyVersion || !payloadB64 || !signature) {
      return { valid: false, error: 'QR_INVALID' };
    }

    const secretKey = this.keys[keyVersion];
    if (!secretKey) {
      return { valid: false, error: 'QR_INVALID' };
    }

    let payload: string;
    try {
      payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    } catch {
      return { valid: false, error: 'QR_INVALID' };
    }

    const expectedSig = createHmac('sha256', secretKey).update(payload).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'QR_INVALID' };
    }

    const payloadParts = payload.split('|');
    if (payloadParts.length !== 3) {
      return { valid: false, error: 'QR_INVALID' };
    }

    const [tokenBusId, tokenTripId, tokenSlotStr] = payloadParts;
    if (!tokenBusId || !tokenTripId || !tokenSlotStr) {
      return { valid: false, error: 'QR_INVALID' };
    }
    const tokenSlot = parseInt(tokenSlotStr, 10);
    if (Number.isNaN(tokenSlot)) {
      return { valid: false, error: 'QR_INVALID' };
    }

    // Step 3: Slot check (current or previous slot accepted)
    const currentSlot = Math.floor(scanTime / 1000 / this.rotationSeconds);
    const slotDiff = currentSlot - tokenSlot;
    if (slotDiff < 0 || slotDiff > 1) {
      return { valid: false, error: 'QR_EXPIRED' };
    }

    // Step 4: Trip is ACTIVE and token bus matches trip bus
    if (
      context.trip.status !== 'ACTIVE' ||
      context.trip.bus_id !== tokenBusId ||
      context.trip.id !== tokenTripId
    ) {
      return { valid: false, error: 'TRIP_NOT_ACTIVE' };
    }

    // Step 5: Student expected on this trip (assigned and not on leave)
    if (!context.studentAssignment || context.studentAssignment.on_leave) {
      return { valid: false, error: 'NOT_ON_ROUTE' };
    }

    // Step 6: Duplicate boarding check (no BOARDED or LATE_BOARDED)
    if (
      context.existingAttendanceRecord &&
      (context.existingAttendanceRecord.status === 'BOARDED' ||
        context.existingAttendanceRecord.status === 'LATE_BOARDED' ||
        context.existingAttendanceRecord.status === 'BOARDED_LATE')
    ) {
      return { valid: false, error: 'DUPLICATE_BOARDING' };
    }

    // Step 7: Boarding window check (-10m to +15m of scheduled departure)
    const departureMs = context.trip.scheduled_departure.getTime();
    const windowStartMs = departureMs - windowBeforeMinutes * 60 * 1000;
    const windowEndMs = departureMs + windowAfterMinutes * 60 * 1000;

    if (scanTime < windowStartMs || scanTime > windowEndMs) {
      return { valid: false, error: 'BOARDING_WINDOW_CLOSED' };
    }

    // Step 8: Success
    return {
      valid: true,
      status: 'BOARDED',
      boardingStopId: context.studentAssignment.boarding_stop_id,
      busId: tokenBusId,
      tripId: tokenTripId,
    };
  }
}
