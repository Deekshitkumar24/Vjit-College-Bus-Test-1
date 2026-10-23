import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTransientTestDatabase,
  TestDatabaseHandle,
} from '../src/native-test-db.js';
import { withRlsTransaction } from '../src/rls-manager.js';

describe('Database Row-Level Security (RLS) Isolation Suite (P0 Exit 3, Master Part 13.1, R-8, D-2)', () => {
  let dbHandle: TestDatabaseHandle | null = null;

  beforeAll(async () => {
    dbHandle = await createTransientTestDatabase();
  }, 30000);

  afterAll(async () => {
    if (dbHandle) {
      await dbHandle.destroy();
    }
  });

  it('proves connected role is app_runtime and rolbypassrls is false (R-8, D-2)', async () => {
    const rtPool = dbHandle!.runtimePool;
    const suPool = dbHandle!.superuserPool;

    // Direct check as the runtime connection
    const currentUserRes = await rtPool.query('SELECT current_user, session_user;');
    console.log(`Connected runtime user: ${currentUserRes.rows[0].current_user}`);
    expect(currentUserRes.rows[0].current_user).toBe('app_runtime');

    // Role privileges verification
    const roleCheck = await suPool.query(`
      SELECT rolname, rolsuper, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = 'app_runtime';
    `);
    console.log(`Role check for app_runtime:`, roleCheck.rows[0]);
    expect(roleCheck.rows[0].rolsuper).toBe(false);
    expect(roleCheck.rows[0].rolbypassrls).toBe(false);
  });

  it('proves app_runtime cannot read another user rows under RLS isolation (P0 Exit 3, Master Part 13.1)', async () => {
    const suPool = dbHandle!.superuserPool;
    const rtPool = dbHandle!.runtimePool;

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
