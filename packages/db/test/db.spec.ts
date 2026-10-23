import { describe, it, expect } from 'vitest';
import { getRlsAndAuditSql } from '../src/rls-manager.js';

describe('Database Package, RLS & Schema Controls (P0-T3)', () => {
  it('generates ENABLE and FORCE ROW LEVEL SECURITY for all 18 mandated tables', () => {
    const sql = getRlsAndAuditSql();

    const requiredTables = [
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

    for (const table of requiredTables) {
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
  });

  it('includes the append-only trigger function for audit_logs', () => {
    const sql = getRlsAndAuditSql();
    expect(sql).toContain('CREATE OR REPLACE FUNCTION prevent_audit_log_modification');
    expect(sql).toContain('trg_audit_logs_append_only');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON audit_logs');
  });

  it('enforces OV-8 and OV-14: users model includes college_email_exception and exception_reason', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    expect(schemaContent).toMatch(/college_email_exception\s+Boolean\s+@default\(false\)/);
    expect(schemaContent).toMatch(/exception_reason\s+String\?\s+@db\.Text/);
  });

  it('provides expand-only migration for users.college_email_exception and users.exception_reason', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const migrationDirs = fs.readdirSync(migrationsDir);
    const emailMigration = migrationDirs.find((d: string) => d.includes('college_email_exception'));
    expect(emailMigration).toBeDefined();

    const sqlPath = path.join(migrationsDir, emailMigration!, 'migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    expect(sqlContent).toContain('college_email_exception');
    expect(sqlContent).toContain('exception_reason');
  });
});
