import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { AttendanceService } from '../src/modules/attendance/attendance.service.js';
import { createTransientTestDatabase, TestDatabaseHandle } from '../../../packages/db/src/native-test-db.js';

describe('Manual Check-In, FLAGGED_GUEST, Corrections & Native Concurrency (P5-T3, T-ATT-02, T-CON-01)', () => {
  let attendanceService: AttendanceService;
  let dbHandle: TestDatabaseHandle | null = null;
  let pool: Pool;

  const keys: Record<string, string> = {
    '2026-10': 'october-key-32-bytes-minimum-length-needed!',
  };
  const activeKeyVersion = '2026-10';

  const collegeId = '00000000-0000-0000-0000-000000000501';
  const studentId = '00000000-0000-0000-0000-000000000502';
  const busId = '00000000-0000-0000-0000-000000000503';
  const routeId = '00000000-0000-0000-0000-000000000504';
  const tripId = '00000000-0000-0000-0000-000000000505';

  const mockTrip = {
    id: tripId,
    bus_id: busId,
    status: 'ACTIVE',
    scheduled_departure: new Date(),
    bus: { bus_number: 'BUS-99' },
  };

  const mockAssignment = {
    student_id: studentId,
    route_id: routeId,
    boarding_stop_id: null,
    on_leave: false,
  };

  beforeAll(async () => {
    attendanceService = new AttendanceService({
      keys,
      activeKeyVersion,
    });

    dbHandle = await createTransientTestDatabase();
    pool = dbHandle.superuserPool;

    // Seed college, user, bus, route, and trip into real PostgreSQL
    await pool.query(
      `INSERT INTO colleges (id, name, email_domains, timezone, created_at, updated_at)
       VALUES ($1, 'Attendance Engineering College', ARRAY['college.edu'], 'Asia/Kolkata', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [collegeId],
    );

    await pool.query(
      `INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
       VALUES ($1, $2, 'student502@college.edu', 'Student Five Zero Two', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [studentId, collegeId],
    );

    await pool.query(
      `INSERT INTO buses (id, bus_number, registration_number, capacity, status, insurance_expiry, fitness_expiry, pollution_expiry, permit_expiry, created_at, updated_at)
       VALUES ($1, 'BUS-99', 'KA-01-EE-9999', 40, 'ACTIVE', '2028-01-01', '2028-01-01', '2028-01-01', '2028-01-01', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [busId],
    );

    await pool.query(
      `INSERT INTO routes (id, code, name, status, created_at, updated_at)
       VALUES ($1, 'RT-504', 'Route 504 Central', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [routeId],
    );

    await pool.query(
      `INSERT INTO trips (id, route_id, bus_id, trip_type, service_date, scheduled_departure, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'MORNING', CURRENT_DATE, NOW(), 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [tripId, routeId, busId],
    );
  }, 45000);

  afterAll(async () => {
    if (dbHandle) {
      await dbHandle.destroy();
    }
  });

  it('T-ATT-02: second scan returns DUPLICATE_BOARDING against real database', async () => {
    const token = attendanceService.generateRawToken({
      busId: mockTrip.bus_id,
      tripId: mockTrip.id,
      timestamp: Date.now(),
    });

    // 1. First scan inserts into real PostgreSQL
    const firstRes = await pool.query(
      `INSERT INTO attendance_records (id, trip_id, student_id, status, boarded_at, method, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'BOARDED', NOW(), 'QR', NOW(), NOW())
       RETURNING id, status;`,
      [tripId, studentId],
    );
    expect(firstRes.rows.length).toBe(1);
    expect(firstRes.rows[0].status).toBe('BOARDED');

    // 2. Second scan attempts to insert same student on same trip
    let secondError: string | null = null;
    try {
      await pool.query(
        `INSERT INTO attendance_records (id, trip_id, student_id, status, boarded_at, method, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'BOARDED', NOW(), 'QR', NOW(), NOW());`,
        [tripId, studentId],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        secondError = 'DUPLICATE_BOARDING';
      } else {
        throw err;
      }
    }

    expect(secondError).toBe('DUPLICATE_BOARDING');

    // Clean up record for next test
    await pool.query(`DELETE FROM attendance_records WHERE trip_id = $1 AND student_id = $2;`, [tripId, studentId]);
  });

  it('T-CON-01: two parallel transactions create exactly one record against native PostgreSQL unique index', async () => {
    const token = attendanceService.generateRawToken({
      busId: mockTrip.bus_id,
      tripId: mockTrip.id,
      timestamp: Date.now(),
    });

    // Helper that executes an atomic scan insertion in its own database client/transaction
    const executeConcurrentScan = async (): Promise<{ success: boolean; error?: string }> => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Attempt insert
        try {
          await client.query(
            `INSERT INTO attendance_records (id, trip_id, student_id, status, boarded_at, method, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'BOARDED', NOW(), 'QR', NOW(), NOW());`,
            [tripId, studentId],
          );
          await client.query('COMMIT');
          return { success: true };
        } catch (err: any) {
          await client.query('ROLLBACK');
          if (err.code === '23505') {
            return { success: false, error: 'DUPLICATE_BOARDING' };
          }
          throw err;
        }
      } finally {
        client.release();
      }
    };

    // Run both concurrent transactions in parallel
    const [resA, resB] = await Promise.all([
      executeConcurrentScan(),
      executeConcurrentScan(),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const duplicates = [resA, resB].filter((r) => r.error === 'DUPLICATE_BOARDING');

    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    // Verify exactly 1 record exists in native PostgreSQL
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE trip_id = $1 AND student_id = $2;`,
      [tripId, studentId],
    );
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
  });

  it('driver manual check-in marks student as MANUAL_CHECKIN with method DRIVER', async () => {
    const res = await attendanceService.manualCheckIn({
      tripId: mockTrip.id,
      studentId: mockAssignment.student_id,
      driverId: '00000000-0000-0000-0000-000000000999',
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
      studentId: '00000000-0000-0000-0000-000000000888',
      driverId: '00000000-0000-0000-0000-000000000999',
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
        coordinatorId: '00000000-0000-0000-0000-000000000777',
        reason: '',
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
      coordinatorId: '00000000-0000-0000-0000-000000000777',
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
