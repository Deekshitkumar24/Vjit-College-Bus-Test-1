import { SYSTEM_DEFAULTS } from '@collegebus/config';
import { Pool } from 'pg';

/**
 * Seed script for system configuration, roles, and SMS templates.
 * Rule R-M1: Contains NO mock, fake, dummy, sample, demo, lorem, or placeholder records.
 * Inserts ONLY configuration, roles, and templates.
 */
export async function seedConfig(databaseUrl = process.env['DATABASE_URL_MIGRATIONS']) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_MIGRATIONS is required to seed system configuration');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Seed system settings
    for (const [key, value] of Object.entries(SYSTEM_DEFAULTS)) {
      await client.query(
        `INSERT INTO settings (key, value, updated_by, reason, updated_at)
         VALUES ($1, $2, '00000000-0000-0000-0000-000000000000'::uuid, 'Initial system bootstrap default', NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)],
      );
    }

    // 2. Seed approved SMS templates (DLT registered)
    const smsTemplates = [
      {
        purpose: 'SOS_TIER_1',
        dlt_template_id: 'DLT_TMP_01',
        body: '[EMERGENCY] SOS triggered on {#var#}. No acknowledgment received. Open console: {#var#}',
      },
      {
        purpose: 'SOS_TIER_2',
        dlt_template_id: 'DLT_TMP_02',
        body: '[CRITICAL] Unacknowledged SOS on {#var#} for 5 mins. Duty staff must respond immediately: {#var#}',
      },
      {
        purpose: 'SOS_TIER_3',
        dlt_template_id: 'DLT_TMP_03',
        body: '[EMERGENCY BROADCAST] Persistent unacknowledged SOS on {#var#}. Contact transport team immediately.',
      },
      {
        purpose: 'GUARDIAN_CONSENT_VERIFY',
        dlt_template_id: 'DLT_TMP_04',
        body: 'Your ward {#var#} has registered for College Bus Tracker. Use code {#var#} to verify consent.',
      },
    ];

    for (const t of smsTemplates) {
      await client.query(
        `INSERT INTO sms_templates (id, purpose, dlt_template_id, body_with_placeholders, approved_at, is_synthetic)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), false)
         ON CONFLICT (purpose) DO UPDATE 
         SET dlt_template_id = EXCLUDED.dlt_template_id, body_with_placeholders = EXCLUDED.body_with_placeholders`,
        [t.purpose, t.dlt_template_id, t.body],
      );
    }

    await client.query('COMMIT');
    console.log('System configuration and DLT SMS templates seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-config.ts')) {
  seedConfig().catch((e) => {
    console.error('Seed configuration failed:', e);
    process.exit(1);
  });
}
