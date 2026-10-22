import { describe, it, expect, beforeEach } from 'vitest';
import { AttendanceService } from '../src/modules/attendance/attendance.service.js';

describe('AttendanceService (P5-T2, T-ATT-01)', () => {
  let attendanceService: AttendanceService;

  const keys: Record<string, string> = {
    '2026-10': 'october-key-32-bytes-minimum-length-needed!',
  };
  const activeKeyVersion = '2026-10';

  const mockTrip = {
    id: 'trip-100',
    bus_id: 'bus-100',
    status: 'ACTIVE',
    scheduled_departure: new Date(Date.now()),
    bus: {
      bus_number: 'BUS-42',
    },
  };

  const mockShift = {
    id: 'shift-100',
    driver_id: 'driver-100',
    bus_id: 'bus-100',
    status: 'ACTIVE',
  };

  const mockAssignment = {
    student_id: 'student-100',
    route_id: 'route-100',
    boarding_stop_id: 'stop-100',
    on_leave: false,
  };

  beforeEach(() => {
    attendanceService = new AttendanceService({
      keys,
      activeKeyVersion,
    });
  });

  it('allows active driver to retrieve QR code with format v1.<key_version>.<payload>.<sig>', async () => {
    const qrResult = await attendanceService.getTripQr({
      tripId: mockTrip.id,
      driverId: mockShift.driver_id,
      getTrip: async () => mockTrip,
      getActiveShift: async () => mockShift,
    });

    expect(qrResult.qr_code).toBeDefined();
    expect(qrResult.qr_code.startsWith('v1.2026-10.')).toBe(true);
    expect(qrResult.rotation_seconds).toBe(30);
  });

  it('T-ATT-01: valid scan marks student as BOARDED and returns bus number and time', async () => {
    const now = Date.now();
    const qrResult = await attendanceService.getTripQr({
      tripId: mockTrip.id,
      driverId: mockShift.driver_id,
      getTrip: async () => mockTrip,
      getActiveShift: async () => mockShift,
    });

    let savedStatus = '';
    const scanResult = await attendanceService.processScan({
      studentId: mockAssignment.student_id,
      token: qrResult.qr_code,
      scanTime: now,
      getTrip: async () => mockTrip,
      getStudentAssignment: async () => mockAssignment,
      getExistingAttendance: async () => null,
      saveAttendance: async (rec) => {
        savedStatus = rec.status;
        return {
          id: 'rec-1',
          status: rec.status,
          boarded_at: new Date(now),
        };
      },
    });

    expect(scanResult.success).toBe(true);
    expect(scanResult.status).toBe('BOARDED');
    expect(scanResult.bus_number).toBe('BUS-42');
    expect(savedStatus).toBe('BOARDED');
  });

  it('T-ATT-01: scan of expired token (>60s) returns QR_EXPIRED error', async () => {
    const now = Date.now();
    // Generate token from 65s ago
    const expiredToken = attendanceService.generateRawToken({
      busId: mockTrip.bus_id,
      tripId: mockTrip.id,
      timestamp: now - 65 * 1000,
    });

    const scanResult = await attendanceService.processScan({
      studentId: mockAssignment.student_id,
      token: expiredToken,
      scanTime: now,
      getTrip: async () => mockTrip,
      getStudentAssignment: async () => mockAssignment,
      getExistingAttendance: async () => null,
      saveAttendance: async () => ({ id: 'rec-1', status: 'BOARDED', boarded_at: new Date() }),
    });

    expect(scanResult.success).toBe(false);
    expect(scanResult.error).toBe('QR_EXPIRED');
  });

  it('enforces rate limit of 10 scans per minute per student', async () => {
    const now = Date.now();
    const qrResult = await attendanceService.getTripQr({
      tripId: mockTrip.id,
      driverId: mockShift.driver_id,
      getTrip: async () => mockTrip,
      getActiveShift: async () => mockShift,
    });

    // Run 10 scans
    for (let i = 0; i < 10; i++) {
      const allowed = attendanceService.checkRateLimit(mockAssignment.student_id, now);
      expect(allowed).toBe(true);
    }

    // 11th scan in same minute should be rejected
    const blocked = attendanceService.checkRateLimit(mockAssignment.student_id, now);
    expect(blocked).toBe(false);
  });
});
