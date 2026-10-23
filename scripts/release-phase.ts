import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const phase = process.argv[2];
if (!phase || !/^P[0-9]$/.test(phase)) {
  console.error('Usage: pnpm release:phase <P0..P9>');
  process.exit(1);
}

console.log(`================================================================`);
console.log(`STARTING PHASE GATE FOR ${phase}`);
console.log(`================================================================`);

const phaseChecks: Record<string, string[]> = {
  P0: [
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test:unit',
    'pnpm test:int',
    'pnpm test:rls',
    'pnpm test:security',
    'pnpm verify:no-mock',
    'pnpm verify:routes-auth',
    'pnpm verify:migrations',
    'pnpm security:scan',
  ],
  P1: ['pnpm test:contract', 'pnpm --filter @collegebus/simulator test:unit'],
  P2: ['pnpm --filter @collegebus/mobile test:unit'],
  P3: [
    'pnpm --filter @collegebus/mobile test:unit test/shift-lifecycle.spec.ts test/location-buffer.spec.ts',
  ],
  P4: [
    'pnpm --filter @collegebus/api test:unit test/p4-coordinator-technician.integration.spec.ts',
    'pnpm --filter @collegebus/admin-web test:unit',
  ],
  P5: ['pnpm --filter @collegebus/api test:unit test/attendance-manual-concurrency.spec.ts'],
  P6: ['pnpm --filter @collegebus/api test:unit test/p6-sos-notifications.spec.ts'],
  P7: ['pnpm --filter @collegebus/api test:unit test/p7-reports-privacy-retention.spec.ts'],
  P8: ['pnpm --filter @collegebus/api test:unit test/p8-security-hardening.spec.ts'],
  P9: ['pnpm verify:prod-clean:dry-run'],
};

const checksToRun = [...phaseChecks['P0'], ...(phase !== 'P0' ? phaseChecks[phase] || [] : [])];

const results: Array<{ command: string; success: boolean; error?: string }> = [];
let allPassed = true;

const isForce = process.argv.includes('--force') || process.env['TURBO_FORCE'] === 'true';

for (const cmd of checksToRun) {
  console.log(`\n[PHASE GATE ${phase}] Running: ${cmd}`);
  if (isForce) {
    console.log(`[TURBO CACHE] cache: miss (forced full re-execution for ${cmd})`);
  }
  try {
    execSync(cmd, {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '0', TURBO_FORCE: 'true' },
    });
    results.push({ command: cmd, success: true });
  } catch (err: any) {
    allPassed = false;
    results.push({ command: cmd, success: false, error: err.message });
    console.error(`[PHASE GATE ${phase}] FAILED command: ${cmd}`);
    break; // Gate halts on first failure
  }
}

const gateResult = {
  phase,
  timestamp: new Date().toISOString(),
  cache: isForce ? 'miss (forced)' : 'standard',
  passed: allPassed,
  checks: results,
};

const progressGatePath = path.resolve(`docs/progress/gate-${phase}.json`);
const evidenceGatePath = path.resolve(`docs/progress/evidence/gate-${phase}.json`);
const jsonContent = JSON.stringify(gateResult, null, 2) + '\n';
fs.writeFileSync(progressGatePath, jsonContent, 'utf-8');
fs.writeFileSync(evidenceGatePath, jsonContent, 'utf-8');

console.log(`\n================================================================`);
console.log(`PHASE GATE ${phase} RESULT: ${allPassed ? 'PASSED' : 'FAILED'}`);
console.log(`Saved gate reports: ${progressGatePath} & ${evidenceGatePath}`);
console.log(`================================================================`);

if (!allPassed) {
  process.exit(1);
}
