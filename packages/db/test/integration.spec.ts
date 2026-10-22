import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTransientTestDatabase,
  TestDatabaseHandle,
} from '../src/native-test-db.js';
import { withRlsTransaction } from '../src/rls-manager.js';

describe('Real-Database Integration Tests (Section 1A, OV-20, P0 Exit 3, P0-T4/T14)', () => {
  let dbHandle: TestDatabaseHandle | null = null;

  beforeAll(async () => {
    dbHandle = await createTransientTestDatabase();
  }, 30000);

  afterAll(async () => {
    if (dbHandle) {
      await dbHandle.destroy();
    }
  });

  it('proves that a transient test database with PostGIS 3.4 and tables creates cleanly (P0-T4, Section 1A)', async () => {
    expect(dbHandle).toBeDefined();
    const suPool = dbHandle!.superuserPool;

    const postgisCheck = await suPool.query('SELECT PostGIS_Version();');
    expect(postgisCheck.rows.length).toBe(1);
    expect(postgisCheck.rows[0].postgis_version).toContain('3.4');

    const tableCheck = await suPool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'user_roles', 'audit_logs');
    `);
    expect(tableCheck.rows.length).toBe(3);
  });

  it('proves the audit table strictly rejects UPDATE and DELETE operations (P0-T14, R-09)', async () => {
    const suPool = dbHandle!.superuserPool;

    const insertRes = await suPool.query(`
      INSERT INTO audit_logs (id, action, entity_type) 
      VALUES (gen_random_uuid(), 'USER_LOGIN', 'users') 
      RETURNING id;
    `);
    const logId = insertRes.rows[0].id;

    await expect(
      suPool.query(`UPDATE audit_logs SET action = 'TAMPERED' WHERE id = $1;`, [logId]),
    ).rejects.toThrowError(/audit_logs rows are append-only/);

    await expect(
      suPool.query(`DELETE FROM audit_logs WHERE id = $1;`, [logId]),
    ).rejects.toThrowError(/audit_logs rows are append-only/);
  });

  it('proves partial unique indexes prevent duplicate active assignments', async () => {
    const suPool = dbHandle!.superuserPool;

    await suPool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_active 
      ON user_roles(user_id, role) 
      WHERE revoked_at IS NULL;
    `);

    const collegeId = '11111111-1111-1111-1111-111111111111';
    await suPool.query(`
      INSERT INTO colleges (id, name, email_domains, updated_at) 
      VALUES ($1, 'Test College', ARRAY['college.edu'], NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [collegeId]);

    const userRes = await suPool.query(`
      INSERT INTO users (id, email, full_name, college_id, updated_at) 
      VALUES (gen_random_uuid(), 'test.role@college.edu', 'Role Test', $1, NOW()) 
      RETURNING id;
    `, [collegeId]);
    const userId = userRes.rows[0].id;

    await suPool.query(
      `INSERT INTO user_roles (id, user_id, role, revoked_at, updated_at) VALUES (gen_random_uuid(), $1, 'COR', NULL, NOW());`,
      [userId],
    );

    await expect(
      suPool.query(
        `INSERT INTO user_roles (id, user_id, role, revoked_at, updated_at) VALUES (gen_random_uuid(), $1, 'COR', NULL, NOW());`,
        [userId],
      ),
    ).rejects.toThrowError(/duplicate key value/);

    await suPool.query(
      `UPDATE user_roles SET revoked_at = NOW() WHERE user_id = $1 AND role = 'COR';`,
      [userId],
    );

    const secondRes = await suPool.query(
      `INSERT INTO user_roles (id, user_id, role, revoked_at, updated_at) VALUES (gen_random_uuid(), $1, 'COR', NULL, NOW()) RETURNING id;`,
      [userId],
    );
    expect(secondRes.rows.length).toBe(1);
  });

  it('proves app_runtime cannot read another user rows under RLS isolation (P0 Exit 3, Master Part 13.1)', async () => {
    const suPool = dbHandle!.superuserPool;
    const rtPool = dbHandle!.runtimePool;

    // Verify app_runtime is not superuser and has NOBYPASSRLS
    const roleCheck = await suPool.query(`
      SELECT rolname, rolsuper, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = 'app_runtime';
    `);
    expect(roleCheck.rows[0].rolsuper).toBe(false);
    expect(roleCheck.rows[0].rolbypassrls).toBe(false);

    // Setup RLS policy on users
    await suPool.query(`
      DROP POLICY IF EXISTS p_users_isolation ON users;
      CREATE POLICY p_users_isolation ON users
        FOR SELECT
        TO app_runtime
        USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid);
    `);

    const collegeId = '11111111-1111-1111-1111-111111111111';
    await suPool.query(`
      INSERT INTO colleges (id, name, email_domains, updated_at) 
      VALUES ($1, 'Test College', ARRAY['college.edu'], NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [collegeId]);

    // Insert 2 users
    const u1Res = await suPool.query(
      `INSERT INTO users (id, email, full_name, college_id, updated_at) VALUES (gen_random_uuid(), 'u1@college.edu', 'User 1', $1, NOW()) RETURNING id;`,
      [collegeId],
    );
    const u2Res = await suPool.query(
      `INSERT INTO users (id, email, full_name, college_id, updated_at) VALUES (gen_random_uuid(), 'u2@college.edu', 'User 2', $1, NOW()) RETURNING id;`,
      [collegeId],
    );
    const u1Id = u1Res.rows[0].id;
    const u2Id = u2Res.rows[0].id;

    // 1. As app_runtime with no session set: must return 0 rows (fail closed per 13.1)
    const noSessionRows = await rtPool.query('SELECT id, email FROM users;');
    expect(noSessionRows.rows.length).toBe(0);

    // 2. As app_runtime with User 1 context: can only see User 1, cannot see User 2
    const u1Rows = await withRlsTransaction(
      rtPool,
      { userId: u1Id, roles: ['STU'], busIds: [], routeIds: [] },
      async (tx) => {
        const res = await tx.query('SELECT id, email FROM users;');
        return res.rows;
      },
    );

    expect(u1Rows.length).toBe(1);
    expect(u1Rows[0].id).toBe(u1Id);
    expect(u1Rows.find((r: any) => r.id === u2Id)).toBeUndefined();
  });
});
