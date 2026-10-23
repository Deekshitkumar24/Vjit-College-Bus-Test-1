import { execSync } from 'node:child_process';

console.log('=== Running Security Hardening Test Suite (Phase P8, T-SEC) ===');
try {
  execSync('npx vitest run services/api/test/p8-security-hardening.spec.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('\n=== Security Suite Passed Cleanly ===');
} catch (error) {
  console.error('\n=== Security Suite Failed ===', error);
  process.exit(1);
}
