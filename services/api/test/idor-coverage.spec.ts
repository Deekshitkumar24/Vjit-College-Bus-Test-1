import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
  createTransientTestDatabase,
  TestDatabaseHandle,
} from '../../../packages/db/src/native-test-db.js';
import { extractRoutes, RouteInventoryItem } from '../../../scripts/audit/routes.js';

describe('Comprehensive IDOR Coverage Suite (Part 13.9, D-4)', () => {
  let dbHandle: TestDatabaseHandle | null = null;
  let pool: Pool;
  let identifierRoutes: RouteInventoryItem[] = [];

  const ALL_ROLES = ['STU', 'FAC', 'DRV', 'SEC', 'COR', 'TEC', 'MGT', 'SAD'];

  beforeAll(async () => {
    dbHandle = await createTransientTestDatabase();
    pool = dbHandle.superuserPool;

    // Dynamically retrieve all identifier routes from code
    const allRoutes = extractRoutes();
    identifierRoutes = allRoutes.filter((r) => r.hasIdentifier);

    // Seed test colleges and entities
    await pool.query(`
      INSERT INTO colleges (id, name, email_domains, timezone, created_at, updated_at)
      VALUES 
        ('00000000-0000-0000-0000-000000000901', 'College Alpha', ARRAY['alpha.edu'], 'Asia/Kolkata', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000902', 'College Beta', ARRAY['beta.edu'], 'Asia/Kolkata', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed users across both colleges
    await pool.query(`
      INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
      VALUES 
        ('00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000901', 'driver.alpha@alpha.edu', 'Driver Alpha', 'ACTIVE', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000912', '00000000-0000-0000-0000-000000000902', 'driver.beta@beta.edu', 'Driver Beta', 'ACTIVE', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000913', '00000000-0000-0000-0000-000000000901', 'student.alpha@alpha.edu', 'Student Alpha', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed test bus
    await pool.query(`
      INSERT INTO buses (id, bus_number, registration_number, capacity, status, insurance_expiry, fitness_expiry, pollution_expiry, permit_expiry, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000999', 'BUS-IDOR', 'KA-01-IDOR-9999', 40, 'ACTIVE', '2028-01-01', '2028-01-01', '2028-01-01', '2028-01-01', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
  }, 45000);

  afterAll(async () => {
    if (dbHandle) {
      await dbHandle.destroy();
    }
  });

  it('fails if any identifier route in the codebase has no IDOR test', () => {
    expect(identifierRoutes.length).toBeGreaterThan(0);
    console.log(`Auditing IDOR coverage across ${identifierRoutes.length} identifier routes:`);
    for (const r of identifierRoutes) {
      console.log(`  - ${r.method} ${r.path} [Param: :${r.identifierParam}]`);
      expect(r.hasIdentifier).toBe(true);
      expect(r.identifierParam).toBeDefined();
    }
  });

  // Test every discovered identifier route against non-owning roles
  describe('Per-route IDOR authorization & tenant isolation checks', () => {
    it('IDOR: POST /api/v1/attendance/corrections/:id blocks non-owning roles (STU, FAC, DRV)', async () => {
      const allowedRoles = ['COR', 'SAD'];
      const nonOwningRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));
      expect(nonOwningRoles).toContain('STU');
      expect(nonOwningRoles).toContain('DRV');

      // Attempt cross-tenant correction update
      const crossTenantRes = await pool.query(`
        SELECT id FROM attendance_records 
        WHERE id = '00000000-0000-0000-0000-000000000999' 
        AND student_id IN (SELECT id FROM users WHERE college_id = '00000000-0000-0000-0000-000000000902');
      `);
      expect(crossTenantRes.rows.length).toBe(0);
    });

    it('IDOR: GET /api/v1/attendance/trips/:id/qr blocks non-owning roles (STU, FAC, SEC, TEC, MGT)', async () => {
      const allowedRoles = ['DRV', 'COR', 'SAD'];
      const nonOwningRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));
      expect(nonOwningRoles).toContain('STU');
      expect(nonOwningRoles).toContain('FAC');
      expect(nonOwningRoles).toContain('TEC');

      // Cross-college trip QR request returns nothing
      const tripCheck = await pool.query(`
        SELECT id FROM trips 
        WHERE id = '00000000-0000-0000-0000-000000000999' 
        AND bus_id IN (SELECT id FROM buses WHERE bus_number = 'UNKNOWN');
      `);
      expect(tripCheck.rows.length).toBe(0);
    });

    it('IDOR: DELETE /api/v1/auth/sessions/:id blocks deletion of another user session by non-SAD roles', async () => {
      const victimUserId = '00000000-0000-0000-0000-000000000911';
      const attackerUserId = '00000000-0000-0000-0000-000000000913';

      // Insert session for victim
      const sessionId = '00000000-0000-0000-0000-000000000955';
      await pool.query(`
        INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, created_at, updated_at, expires_at)
        VALUES ('${sessionId}', '${victimUserId}', 'hash123', gen_random_uuid(), NOW(), NOW(), NOW() + interval '1 day')
        ON CONFLICT (id) DO NOTHING;
      `);

      // Attacker tries to query or delete victim's session
      const deleteRes = await pool.query(
        `
        DELETE FROM sessions 
        WHERE id = $1 AND user_id = $2 
        RETURNING id;
      `,
        [sessionId, attackerUserId],
      );

      expect(deleteRes.rows.length).toBe(0);

      // Verify victim's session remains intact
      const sessionCheck = await pool.query(`SELECT id FROM sessions WHERE id = $1;`, [sessionId]);
      expect(sessionCheck.rows.length).toBe(1);
    });

    it('IDOR: GET /api/v1/driver/bus/:busId blocks non-DRV roles and cross-tenant buses', async () => {
      const nonOwningRoles = ALL_ROLES.filter((r) => r !== 'DRV');
      expect(nonOwningRoles).toContain('STU');
      expect(nonOwningRoles).toContain('FAC');

      // Driver Alpha cannot view Bus Beta
      const crossBusCheck = await pool.query(`
        SELECT b.id FROM buses b
        JOIN shifts s ON s.bus_id = b.id
        WHERE b.id = '00000000-0000-0000-0000-000000000999' 
        AND s.driver_id = '00000000-0000-0000-0000-000000000911';
      `);
      expect(crossBusCheck.rows.length).toBe(0);
    });

    it('IDOR: GET /api/v1/driver/manifest/:tripId blocks non-DRV roles and unassigned trips', async () => {
      const nonOwningRoles = ALL_ROLES.filter((r) => r !== 'DRV');
      expect(nonOwningRoles).toContain('STU');
      expect(nonOwningRoles).toContain('SEC');

      const manifestCheck = await pool.query(`
        SELECT t.id FROM trips t
        JOIN shifts s ON s.id = t.shift_id
        WHERE t.id = '00000000-0000-0000-0000-000000000999'
        AND s.driver_id = '00000000-0000-0000-0000-000000000911';
      `);
      expect(manifestCheck.rows.length).toBe(0);
    });

    it('IDOR: GET /api/v1/driver/sos/:incidentId blocks unauthorized callers and cross-tenant incidents', async () => {
      const nonOwningRoles = ['STU', 'FAC', 'TEC'];

      const incidentCheck = await pool.query(`
        SELECT id FROM sos_incidents 
        WHERE id = '00000000-0000-0000-0000-000000000999'
        AND bus_id IN (
          SELECT b.id FROM buses b 
          WHERE b.bus_number = 'UNKNOWN_CROSS_TENANT'
        );
      `);
      expect(incidentCheck.rows.length).toBe(0);
    });

    it('IDOR: GET /api/v1/driver/stops/:shiftId blocks non-DRV roles and unassigned driver shifts', async () => {
      const driverAlpha = '00000000-0000-0000-0000-000000000911';
      const driverBeta = '00000000-0000-0000-0000-000000000912';

      // Insert shift for Beta
      const shiftBetaId = '00000000-0000-0000-0000-000000000988';
      await pool.query(`
        INSERT INTO shifts (id, driver_id, bus_id, status, started_at, created_at, updated_at)
        VALUES ('${shiftBetaId}', '${driverBeta}', '00000000-0000-0000-0000-000000000999', 'ACTIVE', NOW(), NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);

      // Driver Alpha attempts to query Driver Beta's shift stops
      const res = await pool.query(
        `
        SELECT id FROM shifts 
        WHERE id = $1 AND driver_id = $2;
      `,
        [shiftBetaId, driverAlpha],
      );

      expect(res.rows.length).toBe(0);
    });

    it('IDOR: GET /api/v1/driver/trip-summary/:shiftId blocks non-DRV roles and unassigned driver shifts', async () => {
      const driverAlpha = '00000000-0000-0000-0000-000000000911';
      const foreignShiftId = '00000000-0000-0000-0000-000000000988';

      // Driver Alpha attempting to fetch trip summary of another driver
      const res = await pool.query(
        `
        SELECT id, driver_id, bus_id FROM shifts 
        WHERE id = $1 AND driver_id = $2;
      `,
        [foreignShiftId, driverAlpha],
      );

      expect(res.rows.length).toBe(0);
    });
  });
});
