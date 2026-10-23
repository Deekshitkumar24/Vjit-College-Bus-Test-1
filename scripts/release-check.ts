import { execSync } from 'child_process';
import * as path from 'path';

console.log('================================================================');
console.log('STARTING FULL RELEASE CHECK (P0 to P9 + READINESS GATE)');
console.log('================================================================');

const phases = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

for (const phase of phases) {
  console.log(`\n>>> RUNNING GATE FOR ${phase} (Turbo Cache Forced Miss)...`);
  try {
    execSync(`pnpm release:phase ${phase} --force`, {
      stdio: 'inherit',
      env: { ...process.env, TURBO_FORCE: 'true' },
    });
  } catch (err) {
    console.error(`\n>>> RELEASE CHECK FAILED AT ${phase}!`);
    process.exit(1);
  }
}

console.log('\n>>> COMPILING LEDGER...');
execSync('pnpm ledger:build', { stdio: 'inherit' });

console.log('\n>>> RUNNING PRODUCTION READINESS GATE EVALUATION...');
try {
  execSync('pnpm check:readiness', { stdio: 'inherit' });
} catch (err) {
  console.error('\n>>> READINESS CHECK HALTED WITH ERROR');
  process.exit(1);
}
