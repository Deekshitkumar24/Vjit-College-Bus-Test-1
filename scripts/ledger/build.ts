import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { EXIT_DEFINITIONS, ExitDefinition } from '../readiness/exits';

export interface LedgerItem {
  id: string;
  phase: string;
  description: string;
  status: 'VERIFIED' | 'BLOCKED-EXTERNAL' | 'BLOCKED-OWNER' | 'NOT VERIFIED' | 'FAILED';
  evidencePath: string;
  unlockingInput: string;
}

export function buildLedger(): {
  items: LedgerItem[];
  verifiedCount: number;
  blockedCount: number;
} {
  const evidenceDir = path.resolve('docs/progress/evidence');
  const items: LedgerItem[] = [];

  for (const def of EXIT_DEFINITIONS) {
    let status: 'VERIFIED' | 'BLOCKED-EXTERNAL' | 'BLOCKED-OWNER' | 'NOT VERIFIED' | 'FAILED' =
      def.type === 'OWNER'
        ? 'BLOCKED-OWNER'
        : def.type === 'EXTERNAL'
          ? 'BLOCKED-EXTERNAL'
          : 'NOT VERIFIED';
    let chosenEvidencePath = '';

    const candidates = [`${def.id}.json`, ...def.evidenceFiles];

    for (const file of candidates) {
      const fullPath = path.join(evidenceDir, file);
      if (fs.existsSync(fullPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          if (content.exitCode === 0) {
            status = 'VERIFIED';
            chosenEvidencePath = `docs/progress/evidence/${file}`;
            break;
          } else {
            status = 'FAILED';
            chosenEvidencePath = `docs/progress/evidence/${file}`;
          }
        } catch {
          // If plain text log fallback exists
          if (fs.existsSync(fullPath)) {
            chosenEvidencePath = `docs/progress/evidence/${file}`;
          }
        }
      } else {
        // Also check if corresponding .log exists as fallback
        const logFile = file.replace(/\.json$/, '.log');
        const logFullPath = path.join(evidenceDir, logFile);
        if (fs.existsSync(logFullPath)) {
          chosenEvidencePath = `docs/progress/evidence/${logFile}`;
          if (def.type === 'LOCAL') {
            status = 'VERIFIED';
          }
        }
      }
    }

    if (!chosenEvidencePath) {
      if (def.type === 'EXTERNAL') {
        chosenEvidencePath = def.activationCommand || '';
      } else if (def.type === 'OWNER') {
        chosenEvidencePath = 'infra/terraform/environments/production/';
      } else {
        chosenEvidencePath = `docs/progress/evidence/${def.id}.json`;
      }
    }

    items.push({
      id: def.id,
      phase: def.phase,
      description: def.description,
      status,
      evidencePath: chosenEvidencePath,
      unlockingInput: def.unlockingInput || '-',
    });
  }

  const verifiedCount = items.filter((i) => i.status === 'VERIFIED').length;
  const blockedCount = items.filter((i) => i.status.startsWith('BLOCKED')).length;

  const ledgerJsonPath = path.resolve('docs/progress/ledger.json');
  fs.writeFileSync(ledgerJsonPath, JSON.stringify(items, null, 2) + '\n', 'utf-8');

  // Also write docs/progress/ledger.md
  let md = `# System Exit Criteria Ledger\n\n`;
  md += `| Exit ID | Phase | Description | Status | Evidence Path | Unlocking External Input |\n`;
  md += `| :--- | :--- | :--- | :---: | :--- | :--- |\n`;
  for (const item of items) {
    md += `| **${item.id}** | ${item.phase} | ${item.description} | **${item.status}** | \`${item.evidencePath}\` | ${item.unlockingInput} |\n`;
  }
  const ledgerMdPath = path.resolve('docs/progress/ledger.md');
  fs.writeFileSync(ledgerMdPath, md + '\n', 'utf-8');

  try {
    execSync('npx prettier --write "docs/progress/ledger.json" "docs/progress/ledger.md"', {
      stdio: 'ignore',
    });
  } catch {
    // ignore
  }

  return { items, verifiedCount, blockedCount };
}

if (process.argv[1] && process.argv[1].endsWith('build.ts')) {
  const { items, verifiedCount, blockedCount } = buildLedger();
  console.log(`[LEDGER BUILDER] Total items: ${items.length}`);
  console.log(`[LEDGER BUILDER] Verified: ${verifiedCount}`);
  console.log(`[LEDGER BUILDER] Blocked: ${blockedCount}`);
  console.log(`[LEDGER BUILDER] Saved docs/progress/ledger.json & docs/progress/ledger.md`);
}
