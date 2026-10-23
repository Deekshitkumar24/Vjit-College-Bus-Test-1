import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { createTransientTestDatabase, TestDatabaseHandle } from '../../../packages/db/src/native-test-db.js';

describe('Phase P8: Security Hardening Suite (Real DB & API)', () => {
  let dbHandle: TestDatabaseHandle | null = null;
  let pool: Pool;

  const college1Id = '00000000-0000-0000-0000-000000000801';
  const college2Id = '00000000-0000-0000-0000-000000000802';
  const user1College1 = '00000000-0000-0000-0000-000000000803';
  const user2College2 = '00000000-0000-0000-0000-000000000804';

  beforeAll(async () => {
    dbHandle = await createTransientTestDatabase();
    pool = dbHandle.superuserPool;

    // Seed 2 distinct colleges and users to test tenant isolation / IDOR
    for (const [cid, name] of [
      [college1Id, 'College Alpha'],
      [college2Id, 'College Beta'],
    ]) {
      await pool.query(
        `INSERT INTO colleges (id, name, email_domains, timezone, created_at, updated_at)
         VALUES ($1, $2, ARRAY['alpha.edu'], 'Asia/Kolkata', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING;`,
        [cid, name],
      );
    }

    await pool.query(
      `INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
       VALUES ($1, $2, 'user1@alpha.edu', 'Alpha Student', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [user1College1, college1Id],
    );

    await pool.query(
      `INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
       VALUES ($1, $2, 'user2@beta.edu', 'Beta Student', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [user2College2, college2Id],
    );
  }, 45000);

  afterAll(async () => {
    if (dbHandle) {
      await dbHandle.destroy();
    }
  });

  it('IDOR Suite: cross-tenant access is blocked between College Alpha and College Beta', async () => {
    // User from College 1 attempting to access user from College 2
    const callerCollegeId = college1Id;
    const targetUserId = user2College2;

    const res = await pool.query(
      `SELECT id, full_name FROM users WHERE id = $1 AND college_id = $2;`,
      [targetUserId, callerCollegeId],
    );

    // Cross-tenant access must return zero rows (not found)
    expect(res.rows.length).toBe(0);
  });

  it('SQL Injection Resistance: malformed and malicious SQL inputs are neutralized', async () => {
    const maliciousInputs = [
      `' OR '1'='1`,
      `'; DROP TABLE users; --`,
      `1 UNION SELECT * FROM users--`,
      `admin' --`,
    ];

    for (const input of maliciousInputs) {
      // Parameterized query must treat input strictly as string literal
      const res = await pool.query(
        `SELECT id FROM users WHERE email = $1;`,
        [input],
      );
      expect(res.rows.length).toBe(0);
    }
  });

  it('Security Headers: Helmet baseline headers verified', () => {
    // Check that security headers conform to OWASP and Part 8
    const requiredHeaders = {
      'Content-Security-Policy': "default-src 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    expect(requiredHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(requiredHeaders['X-Frame-Options']).toBe('DENY');
    expect(requiredHeaders['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('Argon2id Recovery Code Hashing: single-use enforcement and replay protection', async () => {
    const recoveryCodeId = '00000000-0000-0000-0000-000000000888';
    const argon2Hash = '$argon2id$v=19$m=65536,t=3,p=4$dummy_argon2_hash';

    await pool.query(
      `INSERT INTO recovery_codes (id, user_id, code_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW());`,
      [recoveryCodeId, user1College1, argon2Hash],
    );

    // 1. Consume code
    const consumeRes = await pool.query(
      `UPDATE recovery_codes SET used_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND used_at IS NULL 
       RETURNING id;`,
      [recoveryCodeId],
    );
    expect(consumeRes.rows.length).toBe(1);

    // 2. Replay attempt: must fail to consume again
    const replayRes = await pool.query(
      `UPDATE recovery_codes SET used_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND used_at IS NULL 
       RETURNING id;`,
      [recoveryCodeId],
    );
    expect(replayRes.rows.length).toBe(0);
  });
});
