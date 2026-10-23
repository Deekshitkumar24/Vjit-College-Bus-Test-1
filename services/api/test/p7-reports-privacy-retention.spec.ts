import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { createTransientTestDatabase, TestDatabaseHandle } from '../../../packages/db/src/native-test-db.js';
import { ExportService } from '../src/modules/reports/export.service.js';
import { PrivacyService } from '../src/modules/privacy/privacy.service.js';
import { RetentionService } from '../src/modules/retention/retention.service.js';

describe('Phase P7: Reports, Privacy, and Retention (Real DB & API)', () => {
  let dbHandle: TestDatabaseHandle | null = null;
  let pool: Pool;
  let exportService: ExportService;
  let privacyService: PrivacyService;
  let retentionService: RetentionService;

  const collegeId = '00000000-0000-0000-0000-000000000701';
  const minorUserId = '00000000-0000-0000-0000-000000000702';
  const adultUserId = '00000000-0000-0000-0000-000000000703';
  const parentUserId = '00000000-0000-0000-0000-000000000704';
  const busId = '00000000-0000-0000-0000-000000000705';
  const routeId = '00000000-0000-0000-0000-000000000706';
  const tripId = '00000000-0000-0000-0000-000000000707';

  beforeAll(async () => {
    dbHandle = await createTransientTestDatabase();
    pool = dbHandle.superuserPool;

    exportService = new ExportService(pool);
    privacyService = new PrivacyService(pool);
    retentionService = new RetentionService(pool);

    // Seed test data
    await pool.query(
      `INSERT INTO colleges (id, name, email_domains, timezone, created_at, updated_at)
       VALUES ($1, 'Privacy College', ARRAY['college.edu'], 'Asia/Kolkata', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [collegeId],
    );

    for (const [uid, email, name] of [
      [minorUserId, 'minor@college.edu', 'Minor Student'],
      [adultUserId, 'adult@college.edu', 'Adult Student'],
      [parentUserId, 'parent@college.edu', 'Parent User'],
    ]) {
      await pool.query(
        `INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING;`,
        [uid, collegeId, email, name],
      );
    }

    await pool.query(
      `INSERT INTO buses (id, bus_number, registration_number, capacity, status, insurance_expiry, fitness_expiry, pollution_expiry, permit_expiry, created_at, updated_at)
       VALUES ($1, 'BUS-P7', 'KA-01-PRV-7777', 40, 'ACTIVE', '2028-01-01', '2028-01-01', '2028-01-01', '2028-01-01', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [busId],
    );

    await pool.query(
      `INSERT INTO routes (id, code, name, status, created_at, updated_at)
       VALUES ($1, 'RT-P7', 'Route P7 Privacy', 'ACTIVE', NOW(), NOW())
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

  it('T-SEC-03: escapes formula injection characters (=, +, -, @, \\t, \\r) in CSV cells', () => {
    const rawCells = [
      '=cmd|"/C calc"!A0',
      '+12345',
      '-5000',
      '@SUM(A1:A10)',
      '\tTabbedValue',
      '\rReturnVal',
      'Normal Student Name',
      'Regular, Value With Comma',
    ];

    const sanitized = rawCells.map((cell) => exportService.sanitizeCsvCell(cell));

    expect(sanitized[0]).toBe(`'=cmd|"/C calc"!A0`);
    expect(sanitized[1]).toBe(`'+12345`);
    expect(sanitized[2]).toBe(`'-5000`);
    expect(sanitized[3]).toBe(`'@SUM(A1:A10)`);
    expect(sanitized[4]).toBe(`'\tTabbedValue`);
    expect(sanitized[5]).toBe(`'\rReturnVal`);
    expect(sanitized[6]).toBe('Normal Student Name');
    expect(sanitized[7]).toBe('"Regular, Value With Comma"');
  });

  it('ExportService: enforces 100,000-row limit and 24-hour presigned URL expiry (C-06)', async () => {
    const now = new Date('2026-10-22T10:00:00Z');

    // 1. Refuses row count > 100,000
    const tooManyRows = new Array(100001).fill({ name: 'Overflow' });
    await expect(
      exportService.createExport({
        requestedBy: adultUserId,
        type: 'ATTENDANCE_DUMP',
        rows: tooManyRows,
        now,
      }),
    ).rejects.toThrowError(/EXPORT_ROW_LIMIT_EXCEEDED/);

    // 2. Succeeds for valid count and sets 24-hour expiry
    const validRows = [
      { student: 'John Doe', bus: 'BUS-42', date: '2026-10-22' },
      { student: 'Jane Doe', bus: 'BUS-42', date: '2026-10-22' },
    ];

    const res = await exportService.createExport({
      requestedBy: adultUserId,
      type: 'DAILY_SUMMARY',
      rows: validRows,
      now,
    });

    expect(res.rowCount).toBe(2);
    expect(res.presignedUrl).toContain('minio.local:9000');
    expect(res.presignedUrl).toContain('X-Amz-Expires=86400'); // 24 hours

    // Expiry must be exactly 24 hours from now
    const diffHours = (res.expiresAt.getTime() - now.getTime()) / (3600 * 1000);
    expect(diffHours).toBe(24);

    // Verify written to export_jobs in native PostgreSQL
    const jobRes = await pool.query(
      `SELECT row_count, storage_key FROM export_jobs WHERE requested_by = $1;`,
      [adultUserId],
    );
    expect(jobRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(jobRes.rows[0].row_count).toBe(2);
  });

  it('T-PRV-01: under-18 without parental consent is restricted to privacy notice and SOS only', async () => {
    const now = new Date('2026-10-22T12:00:00Z');
    // Minor: 16 years old (born in 2010)
    const birthDateMinor = new Date('2010-05-15T00:00:00Z');

    // 1. No guardian consent recorded -> restricted mode
    const minorStatus = await privacyService.evaluateMinorConsent(minorUserId, birthDateMinor, now);
    expect(minorStatus.isMinor).toBe(true);
    expect(minorStatus.hasParentalConsent).toBe(false);
    expect(minorStatus.restrictedMode).toBe(true);
    expect(minorStatus.allowedViews).toEqual(['PRIVACY_NOTICE', 'EMERGENCY_SOS']);

    // 2. Add notice version and guardian consent
    const noticeId = '00000000-0000-0000-0000-000000000788';
    await pool.query(
      `INSERT INTO notice_versions (id, version, text_url, effective_from, created_at, updated_at)
       VALUES ($1, 'v1.0', 'https://college.edu/privacy-v1.pdf', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [noticeId],
    );

    await pool.query(
      `INSERT INTO consents (id, user_id, purpose, notice_version_id, granted_by_user_id, granted_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'COLLEGE_BUS_TRACKING', $2, $3, NOW(), NOW(), NOW());`,
      [minorUserId, noticeId, parentUserId],
    );

    // Re-evaluate: guardian consent present -> unlocked
    const unlockedStatus = await privacyService.evaluateMinorConsent(minorUserId, birthDateMinor, now);
    expect(unlockedStatus.hasParentalConsent).toBe(true);
    expect(unlockedStatus.restrictedMode).toBe(false);
    expect(unlockedStatus.allowedViews).toEqual(['ALL']);

    // 3. Adult student (born in 2002) is never restricted
    const adultBirth = new Date('2002-01-01T00:00:00Z');
    const adultStatus = await privacyService.evaluateMinorConsent(adultUserId, adultBirth, now);
    expect(adultStatus.isMinor).toBe(false);
    expect(adultStatus.restrictedMode).toBe(false);
  });

  it('T-PRV-02: data deletion removes attendance, sessions, and anonymizes SOS events', async () => {
    const deleteUserId = '00000000-0000-0000-0000-000000000799';
    await pool.query(
      `INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
       VALUES ($1, $2, 'todelete@college.edu', 'To Delete User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [deleteUserId, collegeId],
    );

    // Add attendance record
    await pool.query(
      `INSERT INTO attendance_records (id, trip_id, student_id, status, boarded_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'BOARDED', NOW(), NOW(), NOW());`,
      [tripId, deleteUserId],
    );

    // Add active session
    await pool.query(
      `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, gen_random_uuid(), 'hash99', NOW() + INTERVAL '1 day', NOW(), NOW());`,
      [deleteUserId],
    );

    // Add SOS incident and event
    const incidentRes = await pool.query(
      `INSERT INTO sos_incidents (id, bus_id, category, first_trigger_type, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'MEDICAL', 'STUDENT_APP', 'OPEN', NOW(), NOW())
       RETURNING id;`,
      [busId],
    );
    const incId = incidentRes.rows[0].id;

    await pool.query(
      `INSERT INTO sos_events (id, incident_id, type, actor_id, at, detail, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'TRIGGERED', $2, NOW(), '{"name": "To Delete User"}', NOW(), NOW());`,
      [incId, deleteUserId],
    );

    // Record data request
    await pool.query(
      `INSERT INTO data_requests (id, user_id, type, status, received_at, due_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'DELETION', 'RECEIVED', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW());`,
      [deleteUserId],
    );

    // Execute data deletion
    const erasure = await privacyService.executeDataDeletion(deleteUserId);
    expect(erasure.attendanceDeleted).toBe(1);
    expect(erasure.sessionsRevoked).toBe(1);
    expect(erasure.sosEventsAnonymized).toBe(1);

    // Verification in database:
    // 1. Attendance records gone
    const attCount = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE student_id = $1;`,
      [deleteUserId],
    );
    expect(parseInt(attCount.rows[0].count, 10)).toBe(0);

    // 2. Sessions gone
    const sessCount = await pool.query(
      `SELECT COUNT(*) FROM sessions WHERE user_id = $1;`,
      [deleteUserId],
    );
    expect(parseInt(sessCount.rows[0].count, 10)).toBe(0);

    // 3. User status is DELETED and name is anonymized
    const userRes = await pool.query(
      `SELECT status, full_name, email FROM users WHERE id = $1;`,
      [deleteUserId],
    );
    expect(userRes.rows[0].status).toBe('DELETED');
    expect(userRes.rows[0].full_name).toBe('Anonymized User');

    // 4. SOS event actor is scrubbed to zero UUID
    const sosEventRes = await pool.query(
      `SELECT actor_id, detail FROM sos_events WHERE incident_id = $1;`,
      [incId],
    );
    expect(sosEventRes.rows[0].actor_id).toBe('00000000-0000-0000-0000-000000000000');
    expect(sosEventRes.rows[0].detail.anonymized).toBe(true);
  });

  it('T-PRV-03: retention purges expired partitions and logs summary in audit_logs', async () => {
    // Create an artificial expired partition table older than 90 days
    const expiredPartitionName = 'location_samples_2026_01_01';
    await pool.query(`CREATE TABLE IF NOT EXISTS "${expiredPartitionName}" (id UUID, sample_time TIMESTAMPTZ);`);

    // Purge partitions older than 90 days relative to 2026-10-22
    const now = new Date('2026-10-22T00:00:00Z');
    const result = await retentionService.purgeExpiredPartitions(90, now);

    expect(result.partitionsDropped).toContain(expiredPartitionName);

    // Verify partition table was dropped
    const checkTable = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1;`,
      [expiredPartitionName],
    );
    expect(checkTable.rows.length).toBe(0);

    // Verify audit log summary was recorded
    const auditRes = await pool.query(
      `SELECT action, entity_type, after FROM audit_logs WHERE id = $1;`,
      [result.auditLogId],
    );
    expect(auditRes.rows[0].action).toBe('RETENTION_PURGE_PARTITIONS');
    expect(auditRes.rows[0].after.partitions_dropped).toContain(expiredPartitionName);
  });

  it('Part 13.12: audit log coverage for write operations', async () => {
    // Trigger an audit log entry
    const auditRes = await pool.query(
      `INSERT INTO audit_logs (id, action, entity_type, after, at)
       VALUES (gen_random_uuid(), 'USER_UPDATE', 'users', '{"field": "phone"}', NOW())
       RETURNING id;`,
    );
    expect(auditRes.rows.length).toBe(1);

    // Verify audit_logs trigger rejects any UPDATE or DELETE
    await expect(
      pool.query(`UPDATE audit_logs SET action = 'TAMPER' WHERE id = $1;`, [auditRes.rows[0].id]),
    ).rejects.toThrowError(/audit_logs rows are append-only/);
  });
});

