import * as fs from 'fs';
import * as path from 'path';

/**
 * Expand-Only Migration Check (AG-MASTER-1.0 §33.4, P0-T5).
 * Enforces expand-then-contract migration safety in CI.
 * Drops or renames on columns or tables block the build.
 */
export function checkMigrationSql(sqlContent: string, isContractPhase = false): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  const BANNED_PATTERNS = [
    { pattern: /\bDROP\s+COLUMN\b/i, name: 'DROP COLUMN' },
    { pattern: /\bRENAME\s+COLUMN\b/i, name: 'RENAME COLUMN' },
    { pattern: /\bDROP\s+TABLE\b/i, name: 'DROP TABLE' },
    { pattern: /\bRENAME\s+TO\b/i, name: 'RENAME TABLE' },
  ];

  for (const { pattern, name } of BANNED_PATTERNS) {
    if (pattern.test(sqlContent)) {
      if (!isContractPhase) {
        violations.push(`Prohibited destructive migration pattern detected: "${name}". Migrations must be expand-only.`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function scanMigrationsDirectory(migrationsDir: string, isContractPhase = false): boolean {
  if (!fs.existsSync(migrationsDir)) {
    return true;
  }

  let allValid = true;
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const migrationFile = path.join(migrationsDir, entry.name, 'migration.sql');
      if (fs.existsSync(migrationFile)) {
        const content = fs.readFileSync(migrationFile, 'utf-8');
        const result = checkMigrationSql(content, isContractPhase);
        if (!result.valid) {
          console.error(`Migration violation in ${migrationFile}:`);
          result.violations.forEach((v) => console.error(`  - ${v}`));
          allValid = false;
        }
      }
    }
  }

  return allValid;
}

if (process.argv[1] && process.argv[1].endsWith('check-migrations.ts')) {
  const migrationsPath = path.resolve(process.cwd(), 'packages/db/prisma/migrations');
  const isContractPhase = process.env['MIGRATION_CONTRACT_PHASE'] === 'true';
  const passed = scanMigrationsDirectory(migrationsPath, isContractPhase);
  if (!passed) {
    process.exit(1);
  }
  console.log('Expand-only migration policy check passed.');
}
