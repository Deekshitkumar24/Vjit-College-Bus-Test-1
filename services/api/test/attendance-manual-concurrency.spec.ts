import { describe, it, expect, beforeEach } from 'vitest';
import { AttendanceService } from '../src/modules/attendance/attendance.service.js';

describe('Manual Check-In, FLAGGED_GUEST, Corrections & Concurrency (P5-T3, T-ATT-02, T-CON-01)', () => {
  let attendanceService: AttendanceService;

  const keys: Record<string, string> = {
    '2026-10': 'october-key-32-bytes-minimum-length-needed!',
  };
  const activeKeyVersion = '2026-10';

  const mockTrip = {
    id: 'trip-200',
    bus_id: 'bus-200',
    status: 'ACTIVE',
    scheduled_departure: new Date(Date.now()),
    bus: { bus_number: 'BUS-99' },
  };

  const mockAssignment = {
    student_id: 'student-200',
    route_id: 'route-200',
    boarding_stop_id: 'stop-200',
    on_leave: false,
  };

  beforeEach(() => {
    attendanceService = new AttendanceService({
      keys,
      activeKeyVersion,
    });
  });

  it('T-ATT-02: second scan returns DUPLICATE_BOARDING', async () => {
    const token = attendanceService.generateRawToken({
      busId: mockTrip.bus_id,
      tripId: mockTrip.id,
      timestamp: Date.now(),
    });

    let currentRecord: any = null;

    // First scan succeeds
    const firstScan = await attendanceService.processScan({
      studentId: mockAssignment.student_id,
      token,
      getTrip: async () => mockTrip,
      getStudentAssignment: async () => mockAssignment,
      getExistingAttendance: async () => currentRecord,
      saveAttendance: async (rec) => {
        currentRecord = { id: 'rec-1', status: rec.status };
        return currentRecord;
      },
    });

    expect(firstScan.success).toBe(true);
    expect(firstScan.status).toBe('BOARDED');

    // Second scan with same student
    const secondScan = await attendanceService.processScan({
      studentId: mockAssignment.student_id,
      token,
      getTrip: async () => mockTrip,
      getStudentAssignment: async () => mockAssignment,
      getExistingAttendance: async () => currentRecord,
      saveAttendance: async () => currentRecord,
    });

    expect(secondScan.success).toBe(false);
    expect(secondScan.error).toBe('DUPLICATE_BOARDING');
  });

  it('T-CON-01: two parallel scans create exactly one record and second returns DUPLICATE_BOARDING', async () => {
    const token = attendanceService.generateRawToken({
      busId: mockTrip.bus_id,
      tripId: mockTrip.id,
      timestamp: Date.now(),
    });

    // Simulated transactional store with unique constraint on [trip_id, student_id]
    const store = new Map<string, any>();

    const runScan = async () => {
      return attendanceService.processScanWithStore({
        tripId: mockTrip.id,
        studentId: mockAssignment.student_id,
        token,
        getTrip: async () => mockTrip,
        getStudentAssignment: async () => mockAssignment,
        store,
      });
    };

    const [resA, resB] = await Promise.all([runScan(), runScan()]);

    const successes = [resA, resB].filter((r) => r.success);
    const duplicates = [resA, resB].filter((r) => r.error === 'DUPLICATE_BOARDING');

    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(store.size).toBe(1);
  });

  it('driver manual check-in marks student as MANUAL_CHECKIN with method DRIVER', async () => {
    const res = await attendanceService.manualCheckIn({
      tripId: mockTrip.id,
      studentId: mockAssignment.student_id,
      driverId: 'driver-999',
      reason: 'Phone battery died',
      isGuest: false,
      saveRecord: async (rec) => ({ id: 'rec-manual-1', ...rec }),
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('MANUAL_CHECKIN');
    expect(res.method).toBe('DRIVER');
  });

  it('guest boarding marks student with FLAGGED_GUEST', async () => {
    const res = await attendanceService.manualCheckIn({
      tripId: mockTrip.id,
      studentId: 'unregistered-guest-student',
      driverId: 'driver-999',
      reason: 'Emergency temporary boarding approved by faculty',
      isGuest: true,
      saveRecord: async (rec) => ({ id: 'rec-guest-1', ...rec }),
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('FLAGGED_GUEST');
    expect(res.method).toBe('DRIVER');
  });

  it('coordinator correction requires mandatory reason and updates status with audit log', async () => {
    let auditLogged = false;

    // Fail if reason empty
    await expect(
      attendanceService.coordinatorCorrection({
        attendanceId: 'rec-1',
        newStatus: 'BOARDED',
        coordinatorId: 'coord-123',
        reason: '', // Empty reason!
        saveRecord: async () => ({}),
        logAudit: async () => {
          auditLogged = true;
        },
      })
    ).rejects.toThrow();

    // Succeed with reason
    const res = await attendanceService.coordinatorCorrection({
      attendanceId: 'rec-1',
      newStatus: 'BOARDED',
      coordinatorId: 'coord-123',
      reason: 'Student missed scan due to crowd at campus gate, faculty verified presence',
      saveRecord: async (upd) => ({ id: 'rec-1', ...upd }),
      logAudit: async () => {
        auditLogged = true;
      },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('BOARDED');
    expect(auditLogged).toBe(true);
  });
});
