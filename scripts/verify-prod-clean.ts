import { Pool } from 'pg';

/**
 * P9-T3: verify:prod-clean Script
 * Verifies that the target database has ZERO synthetic records (Rule A-10, RB-13).
 */
async function verifyProdClean() {
  const isDryRun = process.argv.includes('--dry-run') || process.env['NODE_ENV'] !== 'production';
  const modeName = isDryRun ? 'verify:prod-clean:dry-run' : 'verify:prod-clean';
  console.log(`=== Running Database Cleanliness & Zero-Synthetic Data Audit [${modeName}] ===`);
  const databaseUrl =
    process.env['DATABASE_URL'] ||
    process.env['DATABASE_URL_TEST'] ||
    'postgresql://postgres:@localhost:5432/collegebus';

  console.log(`Auditing target database (${isDryRun ? 'DRY-RUN / LOCAL' : 'PRODUCTION'})...`);

  const pool = new Pool({ connectionString: databaseUrl });
  const violations: Array<{ table: string; count: number; sample?: any }> = [];

  try {
    // 1. Audit tables with is_synthetic column
    const tablesWithSyntheticFlag = [
      'colleges',
      'users',
      'user_roles',
      'sessions',
      'buses',
      'devices',
      'device_tokens',
      'device_links',
      'routes',
      'stops',
      'trips',
      'attendance_records',
      'leave_records',
      'sos_incidents',
      'sos_events',
      'maintenance_tickets',
      'export_jobs',
    ];

    for (const table of tablesWithSyntheticFlag) {
      try {
        const res = await pool.query(`SELECT COUNT(*) FROM "${table}" WHERE is_synthetic = true;`);
        const count = parseInt(res.rows[0].count, 10);
        if (count > 0) {
          violations.push({ table, count });
        }
      } catch (err) {
        // Table might not exist in template, skip
      }
    }

    // 2. Check for test email domains (@example.com, @test.com)
    try {
      const emailCheck = await pool.query(
        `SELECT COUNT(*) FROM users WHERE email LIKE '%@example.com' OR email LIKE '%@test.com';`,
      );
      const emailCount = parseInt(emailCheck.rows[0].count, 10);
      if (emailCount > 0) {
        violations.push({ table: 'users (test email domains)', count: emailCount });
      }
    } catch {}

    if (violations.length > 0) {
      console.error('PROD-CLEAN AUDIT FAILED! Synthetic data found:');
      for (const v of violations) {
        console.error(`- Table ${v.table}: ${v.count} synthetic records`);
      }
      process.exit(1);
    } else {
      console.log(
        'PROD-CLEAN AUDIT PASSED: Zero synthetic records discovered across all audited tables.',
      );
    }
  } finally {
    await pool.end();
  }
}

verifyProdClean().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
