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
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    }
  });

  it('includes the append-only trigger function for audit_logs', () => {
    const sql = getRlsAndAuditSql();
    expect(sql).toContain('CREATE OR REPLACE FUNCTION prevent_audit_log_modification');
    expect(sql).toContain('trg_audit_logs_append_only');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON audit_logs');
  });
});
