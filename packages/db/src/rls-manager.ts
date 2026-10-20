import { Pool, PoolClient } from 'pg';

export interface RlsContext {
  userId: string;
  roles: string[];
  busIds: string[];
  routeIds: string[];
}

/**
 * Executes a callback within a transaction setting PostgreSQL session configuration variables for RLS.
 * Policies fail closed: with no values set, they return no rows (AG-MASTER-1.0 §13.1).
 */
export async function withRlsTransaction<T>(
  pool: Pool,
  ctx: RlsContext,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT 
        set_config('app.user_id', $1, true),
        set_config('app.roles', $2, true),
        set_config('app.bus_ids', $3, true),
        set_config('app.route_ids', $4, true);`,
      [ctx.userId, ctx.roles.join(','), ctx.busIds.join(','), ctx.routeIds.join(',')],
    );

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generates SQL migration commands for RLS and audit log append-only triggers.
 */
export function getRlsAndAuditSql(): string {
  const rlsTables = [
    'users',
    'sessions',
    'mfa_factors',
    'recovery_codes',
    'student_profiles',
    'attendance_records',
    'leave_records',
    'student_routes',
    'absence_alerts',
    'sos_incidents',
    'sos_events',
    'notifications',
    'notification_deliveries',
    'notification_preferences',
    'consents',
    'data_requests',
    'location_samples',
    'export_jobs',
  ];

  const enableRlsSql = rlsTables
    .map(
      (t) =>
        `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;\nALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`,
    )
    .join('\n');

  const auditTriggerSql = `
    -- Audit append-only trigger (AG-MASTER-1.0 §7.10, §13.12, R-09)
    CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs rows are append-only. UPDATE and DELETE operations are strictly prohibited (R-09).';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
    CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
  `;

  return `${enableRlsSql}\n\n${auditTriggerSql}`;
}
