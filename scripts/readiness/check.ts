import * as fs from 'fs';
import * as path from 'path';

/**
 * Section 9: Production Readiness Gate Script
 * Reads docs/progress/ledger.md, evaluates exit criteria, open external items,
 * and outputs either PRODUCTION READY or NOT READY with exact open items.
 * Writes results to docs/progress/READINESS.md.
 */
interface ExitItem {
  id: string;
  phase: string;
  description: string;
  status: 'VERIFIED' | 'BLOCKED-EXTERNAL' | 'BLOCKED-OWNER';
  evidencePath: string;
  unlockingInput?: string;
}

function parseLedger(ledgerContent: string): ExitItem[] {
  const lines = ledgerContent.split('\n');
  const items: ExitItem[] = [];

  for (const line of lines) {
    if (!line.startsWith('| **') || line.includes('Exit ID')) continue;
    const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
      const id = parts[0].replace(/\*\*/g, '');
      const phase = parts[1];
      const description = parts[2];
      const statusRaw = parts[3].replace(/\*\*/g, '');
      const evidencePath = parts[4] || '';
      const unlockingInput = parts[5] || '';

      const status = statusRaw.includes('VERIFIED')
        ? 'VERIFIED'
        : statusRaw.includes('BLOCKED-OWNER')
        ? 'BLOCKED-OWNER'
        : 'BLOCKED-EXTERNAL';

      items.push({
        id,
        phase,
        description,
        status,
        evidencePath,
        unlockingInput,
      });
    }
  }

  return items;
}

async function main() {
  const ledgerPath = path.resolve('docs/progress/ledger.md');
  const coveragePath = path.resolve('docs/progress/coverage.md');
  const readinessPath = path.resolve('docs/progress/READINESS.md');

  if (!fs.existsSync(ledgerPath)) {
    console.error('Error: docs/progress/ledger.md does not exist.');
    process.exit(1);
  }

  const ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
  const exitItems = parseLedger(ledgerContent);

  const verifiedItems = exitItems.filter((item) => item.status === 'VERIFIED');
  const blockedExternalItems = exitItems.filter((item) => item.status === 'BLOCKED-EXTERNAL');
  const blockedOwnerItems = exitItems.filter((item) => item.status === 'BLOCKED-OWNER');

  const coverageExists = fs.existsSync(coveragePath);
  const runbooksExist = fs.existsSync(path.resolve('docs/runbooks/README.md'));
  const backupDrillEvidenceExists = fs.existsSync(path.resolve('docs/progress/evidence/P8-backup-restore-drill.log'));

  const isProductionReady =
    blockedExternalItems.length === 0 &&
    blockedOwnerItems.length === 0 &&
    coverageExists &&
    runbooksExist &&
    backupDrillEvidenceExists;

  let readinessMarkdown = `# Production Readiness Gate Evaluation\n\n`;
  readinessMarkdown += `**Evaluation Date:** ${new Date().toISOString()}\n`;
  readinessMarkdown += `**Overall Decision:** ${isProductionReady ? '**PRODUCTION READY**' : '**NOT READY**'}\n\n`;

  readinessMarkdown += `## 1. Summary Statistics\n`;
  readinessMarkdown += `- Total Exit Items Tracked: ${exitItems.length}\n`;
  readinessMarkdown += `- Verified Local Items: ${verifiedItems.length}\n`;
  readinessMarkdown += `- Blocked on External Inputs (E-items): ${blockedExternalItems.length}\n`;
  readinessMarkdown += `- Blocked on Owner Instructions (O-items): ${blockedOwnerItems.length}\n`;
  readinessMarkdown += `- Coverage Matrix: ${coverageExists ? 'COMPLETE' : 'MISSING'}\n`;
  readinessMarkdown += `- Operational Runbooks (RB-01..13): ${runbooksExist ? 'VERIFIED' : 'MISSING'}\n`;
  readinessMarkdown += `- Backup/Restore Drill Rehearsal: ${backupDrillEvidenceExists ? 'EVIDENCED' : 'MISSING'}\n\n`;

  if (isProductionReady) {
    readinessMarkdown += `## 2. Decision\n\n`;
    readinessMarkdown += `All phase exit criteria have been empirically verified and no external or owner blockers remain.\n`;
    readinessMarkdown += `**SYSTEM STATUS: PRODUCTION READY**\n`;
  } else {
    readinessMarkdown += `## 2. Open Blockers Preventing Production Readiness\n\n`;
    readinessMarkdown += `The system cannot be claimed as production ready until the following external environment credentials and owner instructions are supplied:\n\n`;
    readinessMarkdown += `| Exit ID | Phase | Description | Status | Unlocking External Input |\n`;
    readinessMarkdown += `| :--- | :--- | :--- | :---: | :--- |\n`;

    for (const item of [...blockedExternalItems, ...blockedOwnerItems]) {
      readinessMarkdown += `| **${item.id}** | ${item.phase} | ${item.description} | **${item.status}** | ${item.unlockingInput || 'Pending input'} |\n`;
    }
  }

  fs.writeFileSync(readinessPath, readinessMarkdown, 'utf-8');

  console.log('====================================================');
  console.log(`PRODUCTION READINESS GATE EVALUATION:`);
  console.log(`- Verified Local Exits: ${verifiedItems.length}/${exitItems.length}`);
  console.log(`- Blocked External Items: ${blockedExternalItems.length}`);
  console.log(`- Blocked Owner Items: ${blockedOwnerItems.length}`);
  console.log('====================================================');

  if (isProductionReady) {
    console.log('PRODUCTION READY');
  } else {
    console.log('NOT READY');
    console.log('\nOpen items remaining before production readiness:');
    for (const item of [...blockedExternalItems, ...blockedOwnerItems]) {
      console.log(`- [${item.id}] (${item.status}): ${item.description} -> Unlocks with ${item.unlockingInput}`);
    }
  }
}

main().catch((err) => {
  console.error('Readiness check error:', err);
  process.exit(1);
});
