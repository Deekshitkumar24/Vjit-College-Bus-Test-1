import { describe, it, expect } from 'vitest';
import { checkMigrationSql } from '../../../scripts/check-migrations.js';

describe('Expand-Only Migration Policy Check (P0-T5)', () => {
  it('approves additive expand-only migrations', () => {
    const additiveSql = `
      ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45);
      CREATE TABLE new_feature_data (id UUID PRIMARY KEY);
      CREATE INDEX idx_users_login_ip ON users(last_login_ip);
    `;

    const result = checkMigrationSql(additiveSql);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails on DROP COLUMN migrations', () => {
    const destructiveSql = `
      ALTER TABLE users DROP COLUMN phone_e164;
    `;

    const result = checkMigrationSql(destructiveSql);
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toContain('DROP COLUMN');
  });

  it('fails on RENAME COLUMN migrations', () => {
    const destructiveSql = `
      ALTER TABLE users RENAME COLUMN email TO user_email;
    `;

    const result = checkMigrationSql(destructiveSql);
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toContain('RENAME COLUMN');
  });

  it('allows destructive operations only when explicitly in contract phase', () => {
    const contractSql = `
      ALTER TABLE users DROP COLUMN old_deprecated_column;
    `;

    const result = checkMigrationSql(contractSql, true);
    expect(result.valid).toBe(true);
  });
});
