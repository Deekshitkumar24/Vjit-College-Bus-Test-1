import { describe, it, expect } from 'vitest';
import {
  QrTokenService,
  QrAttendanceValidator,
  type QrValidationContext,
} from '../src/qr-attendance.js';

describe('QrTokenService & QrAttendanceValidator (P5-T2, T-ATT-01)', () => {
  const keys: Record<string, string> = {
    '2026-10': 'secret-key-for-october-2026-32bytesmin!!',
    '2026-09': 'previous-key-still-valid-7days-32bytes!',
  };
  const activeKeyVersion = '2026-10';

  const tokenService = new QrTokenService({
    keys,
    activeKeyVersion,
  });

  const validator = new QrAttendanceValidator({
    keys,
  });

  const sampleBusId = 'bus-1111-1111';
  const sampleTripId = 'trip-2222-2222';
  const sampleStudentId = 'student-3333-3333';
  const sampleStopId = 'stop-4444-4444';

  const validContext: QrValidationContext = {
    studentId: sampleStudentId,
    trip: {
      id: sampleTripId,
      bus_id: sampleBusId,
      status: 'ACTIVE',
      scheduled_departure: new Date(Date.now()), // right now
    },
    studentAssignment: {
      student_id: sampleStudentId,
      route_id: 'route-5555-5555',
      boarding_stop_id: sampleStopId,
      on_leave: false,
    },
    existingAttendanceRecord: null,
  };

  it('generates token conforming to v1.<key_version>.<base64url payload>.<base64url signature>', () => {
    const token = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: Date.now(),
    });

    const parts = token.split('.');
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toBe(activeKeyVersion);
  });

  it('T-ATT-01: accepts a token from 30 seconds ago (previous slot), but rejects one from 65 seconds ago with QR_EXPIRED', () => {
    const now = Date.now();

    // Token generated 30 seconds ago
    const token30sAgo = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now - 30 * 1000,
    });

    const result30s = validator.validateScan({
      token: token30sAgo,
      scanTime: now,
      context: validContext,
    });
    expect(result30s.valid).toBe(true);
    expect(result30s.status).toBe('BOARDED');

    // Token generated 65 seconds ago (2 slots ago -> expired)
    const token65sAgo = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now - 65 * 1000,
    });

    const result65s = validator.validateScan({
      token: token65sAgo,
      scanTime: now,
      context: validContext,
    });
    expect(result65s.valid).toBe(false);
    expect(result65s.error).toBe('QR_EXPIRED');
  });

  it('rejects tampered signature with QR_INVALID', () => {
    const now = Date.now();
    const token = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now,
    });

    const parts = token.split('.');
    parts[3] = 'tampered-signature-string';
    const tamperedToken = parts.join('.');

    const result = validator.validateScan({
      token: tamperedToken,
      scanTime: now,
      context: validContext,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('QR_INVALID');
  });

  it('rejects invalid key version with QR_INVALID', () => {
    const now = Date.now();
    const token = `v1.unknown-version.cGF5bG9hZA.c2lnbmF0dXJl`;

    const result = validator.validateScan({
      token,
      scanTime: now,
      context: validContext,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('QR_INVALID');
  });

  it('rejects when trip is not active with TRIP_NOT_ACTIVE', () => {
    const now = Date.now();
    const token = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now,
    });

    const result = validator.validateScan({
      token,
      scanTime: now,
      context: {
        ...validContext,
        trip: {
          ...validContext.trip,
          status: 'SCHEDULED', // Not active!
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('TRIP_NOT_ACTIVE');
  });

  it('rejects when bus does not match trip bus with TRIP_NOT_ACTIVE', () => {
    const now = Date.now();
    const token = tokenService.generateToken({
      busId: 'different-bus-id',
      tripId: sampleTripId,
      timestamp: now,
    });

    const result = validator.validateScan({
      token,
      scanTime: now,
      context: validContext,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('TRIP_NOT_ACTIVE');
  });

  it('rejects when student is not expected on route or on leave with NOT_ON_ROUTE', () => {
    const now = Date.now();
    const token = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now,
    });

    // Case A: No assignment
    const resNoAssign = validator.validateScan({
      token,
      scanTime: now,
      context: {
        ...validContext,
        studentAssignment: null,
      },
    });
    expect(resNoAssign.valid).toBe(false);
    expect(resNoAssign.error).toBe('NOT_ON_ROUTE');

    // Case B: On leave
    const resOnLeave = validator.validateScan({
      token,
      scanTime: now,
      context: {
        ...validContext,
        studentAssignment: {
          ...validContext.studentAssignment!,
          on_leave: true,
        },
      },
    });
    expect(resOnLeave.valid).toBe(false);
    expect(resOnLeave.error).toBe('NOT_ON_ROUTE');
  });

  it('rejects duplicate boarding when already BOARDED or LATE_BOARDED with DUPLICATE_BOARDING', () => {
    const now = Date.now();
    const token = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now,
    });

    const result = validator.validateScan({
      token,
      scanTime: now,
      context: {
        ...validContext,
        existingAttendanceRecord: {
          status: 'BOARDED',
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('DUPLICATE_BOARDING');
  });

  it('rejects scan when boarding window is closed (before -10m or after +15m of scheduled departure)', () => {
    const now = Date.now();
    const token = tokenService.generateToken({
      busId: sampleBusId,
      tripId: sampleTripId,
      timestamp: now,
    });

    // Too early: departure is 20 minutes in future (window opens 10m before)
    const tooEarlyContext: QrValidationContext = {
      ...validContext,
      trip: {
        ...validContext.trip,
        scheduled_departure: new Date(now + 20 * 60 * 1000),
      },
    };
    const resEarly = validator.validateScan({
      token,
      scanTime: now,
      context: tooEarlyContext,
    });
    expect(resEarly.valid).toBe(false);
    expect(resEarly.error).toBe('BOARDING_WINDOW_CLOSED');

    // Too late: departure was 20 minutes ago (window closes 15m after)
    const tooLateContext: QrValidationContext = {
      ...validContext,
      trip: {
        ...validContext.trip,
        scheduled_departure: new Date(now - 20 * 60 * 1000),
      },
    };
    const resLate = validator.validateScan({
      token,
      scanTime: now,
      context: tooLateContext,
    });
    expect(resLate.valid).toBe(false);
    expect(resLate.error).toBe('BOARDING_WINDOW_CLOSED');
  });
});
