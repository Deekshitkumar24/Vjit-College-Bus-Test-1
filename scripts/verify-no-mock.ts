import * as fs from 'fs';
import * as path from 'path';

/**
 * verify:no-mock scanner (AG-MASTER-1.0 §15.4, R-M1, R-M2).
 * Fails the build if production application code contains forbidden mock/fake markers
 * or imports from tests/fixtures or tools/simulator.
 */

const FORBIDDEN_MARKERS = [
  /\bfake\b/i,
  /\bdummy\b/i,
  /lorem\s+ipsum/i,
  /placeholder\s+value/i,
  /demo\s+account/i,
  /example\.com/i,
  /test@/i,
  /9999999999/,
  /0000000000/,
];

const FORBIDDEN_IMPORTS = [
  /from\s+['"].*tests\/fixtures.*['"]/,
  /from\s+['"].*tools\/simulator.*['"]/,
];

const EXCLUDED_PATHS = ['tests/fixtures', 'tools/simulator', 'docs', 'scripts'];

const EXCLUDED_FOLDER_NAMES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  'coverage',
]);

export function scanFileForMocks(filePath: string): string[] {
  const violations: string[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');

  for (const marker of FORBIDDEN_MARKERS) {
    if (marker.test(content)) {
      violations.push(`Found forbidden mock-data marker: ${marker}`);
    }
  }

  for (const imp of FORBIDDEN_IMPORTS) {
    if (imp.test(content)) {
      violations.push(`Found forbidden test import: ${imp}`);
    }
  }

  return violations;
}

export function scanDirectory(dir: string, baseDir = dir): boolean {
  let isClean = true;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (EXCLUDED_FOLDER_NAMES.has(entry.name)) {
      continue;
    }

    if (EXCLUDED_PATHS.some((exc) => relPath === exc || relPath.startsWith(exc + '/'))) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!scanDirectory(fullPath, baseDir)) {
        isClean = false;
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))
    ) {
      const issues = scanFileForMocks(fullPath);
      if (issues.length > 0) {
        console.error(`verify:no-mock VIOLATION in ${relPath}:`);
        issues.forEach((i) => console.error(`  - ${i}`));
        isClean = false;
      }
    }
  }

  return isClean;
}

if (process.argv[1] && process.argv[1].endsWith('verify-no-mock.ts')) {
  const root = process.cwd();
  const passed = scanDirectory(root);
  if (!passed) {
    console.error(
      'verify:no-mock FAILED. Prohibited mock data or test imports found in production code.',
    );
    process.exit(1);
  }
  console.log('verify:no-mock PASSED. Zero mock data patterns found in application code.');
}
