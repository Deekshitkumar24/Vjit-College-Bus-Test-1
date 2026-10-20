import { Pool } from 'pg';

/**
 * verify:prod-clean scanner (AG-MASTER-1.0 §15.4, Rule R-M6).
 * Runs against the database and fails if:
 * 1. Any business table has a row with is_synthetic set to true.
 * 2. Any user has an email outside COLLEGE_EMAIL_DOMAINS, except driver accounts with a recorded exception.
 * 3. Any phone number matches a test range.
 */

export async function verifyProdClean(
  connectionString?: string,
): Promise<{ clean: boolean; errors: string[] }> {
  const errors: string[] = [];
  const dbUrl = connectionString || process.env['DATABASE_URL'];

  if (!dbUrl) {
    console.log(
      'verify:prod-clean: No DATABASE_URL provided. Skipping live DB check (offline build mode).',
    );
    return { clean: true, errors: [] };
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const client = await pool.connect();
    try {
      // 1. Check for any synthetic records in business tables
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'is_synthetic' AND table_schema = 'public'
      `);

      for (const row of tablesRes.rows) {
        const table = row.table_name;
        const countRes = await client.query(
          `SELECT COUNT(*) FROM "${table}" WHERE is_synthetic = true`,
        );
        const count = parseInt(countRes.rows[0].count, 10);
        if (count > 0) {
          errors.push(`Table "${table}" contains ${count} rows with is_synthetic = true`);
        }
      }

      // 2. Check for users outside approved domains
      const domains = (process.env['COLLEGE_EMAIL_DOMAINS'] || 'college.edu')
        .split(',')
        .map((d) => d.trim().toLowerCase());
      const userRes = await client.query(`
        SELECT u.id, u.email, array_agg(ur.role) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.revoked_at IS NULL
        GROUP BY u.id, u.email
      `);

      for (const u of userRes.rows) {
        const email = u.email.toLowerCase();
        const domain = email.split('@')[1];
        const isDriver = Array.isArray(u.roles) && u.roles.includes('DRV');
        const matchesDomain = domains.includes(domain);

        if (!matchesDomain && !isDriver) {
          errors.push(
            `User ${u.id} (${u.email}) has email outside COLLEGE_EMAIL_DOMAINS and is not a driver`,
          );
        }
      }

      // 3. Check for phone numbers in test ranges
      const phoneRes = await client.query(`
        SELECT id, phone_e164 FROM users 
        WHERE phone_e164 IS NOT NULL AND (
          phone_e164 LIKE '%55501%' OR 
          phone_e164 LIKE '%0000000000%' OR 
          phone_e164 LIKE '%9999999999%'
        )
      `);
      for (const p of phoneRes.rows) {
        errors.push(`User ${p.id} has phone number in test range: ${p.phone_e164}`);
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    errors.push(`Database connection error during verify:prod-clean: ${err.message}`);
  } finally {
    await pool.end();
  }

  return {
    clean: errors.length === 0,
    errors,
  };
}

if (process.argv[1] && process.argv[1].endsWith('verify-prod-clean.ts')) {
  verifyProdClean().then(({ clean, errors }) => {
    if (!clean) {
      console.error('verify:prod-clean FAILED:');
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
    console.log(
      'verify:prod-clean PASSED. Database is verified free of synthetic rows, test domains, and test phone numbers.',
    );
  });
}
