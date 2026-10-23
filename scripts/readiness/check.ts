import * as fs from 'fs';
import * as path from 'path';
import { EXIT_DEFINITIONS } from './exits.js';
import { buildLedger, LedgerItem } from '../ledger/build.js';

interface Section5GateResults {
  allExitsVerified: boolean;
  noBlockedItems: boolean;
  phaseGatesPassed: boolean;
  coverageComplete: boolean;
  securityClean: boolean;
  runbooksValid: boolean;
  backupDrillVerified: boolean;
  launchChecklistEvidenced: boolean;
  prodCleanProductionVerified: boolean;
}

async function evaluateReadiness(): Promise<{
  isReady: boolean;
  results: Section5GateResults;
  items: LedgerItem[];
}> {
  // 1. Build authoritative ledger from evidence files
  const { items } = buildLedger();

  // (a) Every exit defined in exits.ts is VERIFIED and links to its evidence file
  const verifiedItems = items.filter((i) => i.status === 'VERIFIED');
  const allExitsVerified =
    verifiedItems.length === items.length && items.length === EXIT_DEFINITIONS.length;

  // (b) No item is BLOCKED-EXTERNAL or BLOCKED-OWNER
  const blockedExternal = items.filter((i) => i.status === 'BLOCKED-EXTERNAL');
  const blockedOwner = items.filter((i) => i.status === 'BLOCKED-OWNER');
  const noBlockedItems = blockedExternal.length === 0 && blockedOwner.length === 0;

  // (c) release:phase passes for P0 to P9 on current commit
  let phaseGatesPassed = true;
  for (let p = 0; p <= 9; p++) {
    const evidenceGatePath = path.resolve(`docs/progress/evidence/gate-P${p}.json`);
    const progressGatePath = path.resolve(`docs/progress/gate-P${p}.json`);
    const gatePath = fs.existsSync(evidenceGatePath) ? evidenceGatePath : progressGatePath;
    if (!fs.existsSync(gatePath)) {
      phaseGatesPassed = false;
      break;
    }
    try {
      const data = JSON.parse(fs.readFileSync(gatePath, 'utf-8'));
      if (!data.passed || !data.checks || !Array.isArray(data.checks) || data.checks.length === 0) {
        phaseGatesPassed = false;
        break;
      }
      if (data.checks.some((c: any) => c.success !== true)) {
        phaseGatesPassed = false;
        break;
      }
    } catch {
      phaseGatesPassed = false;
      break;
    }
  }

  // (d) Coverage: every item in section 21.7 maps to test file and is built and passing
  const coveragePath = path.resolve('docs/progress/coverage.md');
  let coverageComplete = false;
  if (fs.existsSync(coveragePath)) {
    const content = fs.readFileSync(coveragePath, 'utf-8');
    const lines = content.split('\n');
    const tableRows = lines.filter(
      (l) =>
        l.trim().startsWith('|') &&
        !l.includes('---') &&
        !l.includes('Requirement') &&
        !l.includes('Ref ID'),
    );
    if (tableRows.length >= 30) {
      const unmapped = tableRows.filter((r) => {
        const cols = r
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        if (cols.length < 3) return false;
        const testFile = cols[cols.length - 2] || '';
        const status = cols[cols.length - 1] || '';
        return !testFile || testFile === 'TBD' || testFile === 'PENDING' || status.includes('FAIL');
      });
      coverageComplete = unmapped.length === 0;
    }
  }

  // (e) Security: no high or critical finding open; every moderate finding has a plan and due date
  const auditPath = path.resolve('docs/progress/evidence/security-scan.json');
  const altAuditPath = path.resolve('docs/progress/evidence/P8-T3.json');
  const auditFile = fs.existsSync(auditPath)
    ? auditPath
    : fs.existsSync(altAuditPath)
      ? altAuditPath
      : null;
  let auditClean = false;
  if (auditFile) {
    try {
      const auditData = JSON.parse(fs.readFileSync(auditFile, 'utf-8'));
      auditClean = auditData.exitCode === 0;
    } catch {
      auditClean = false;
    }
  }

  const findingsPath = path.resolve('docs/security/audit-findings.md');
  let findingsHavePlanAndDueDate = false;
  if (fs.existsSync(findingsPath)) {
    const findingsContent = fs.readFileSync(findingsPath, 'utf-8');
    const hasPlans =
      findingsContent.includes('Remediation Plan') && findingsContent.includes('Track upstream');
    const dueDatesFound = (findingsContent.match(/Due Date:\*\* \d{4}-\d{2}-\d{2}/g) || []).length;
    findingsHavePlanAndDueDate = hasPlans && dueDatesFound >= 7;
  }
  const securityClean = auditClean && findingsHavePlanAndDueDate;

  // (f) Runbooks: RB-01 to RB-13 contain all 6 required sections
  const runbooksDir = path.resolve('docs/runbooks');
  let runbooksValid = true;
  const requiredRunbooks = [
    'RB-01',
    'RB-02',
    'RB-03',
    'RB-04',
    'RB-05',
    'RB-06',
    'RB-07',
    'RB-08',
    'RB-09',
    'RB-10',
    'RB-11',
    'RB-12',
    'RB-13',
  ];
  const requiredSections = [
    'trigger',
    'first five minutes',
    'diagnosis',
    'mitigation',
    'communication template',
    'post-incident review',
  ];

  if (fs.existsSync(runbooksDir)) {
    const files = fs.readdirSync(runbooksDir);
    for (const rb of requiredRunbooks) {
      const match = files.find((f) => f.startsWith(rb) && f.endsWith('.md'));
      if (!match) {
        runbooksValid = false;
        break;
      }
      const content = fs.readFileSync(path.join(runbooksDir, match), 'utf-8').toLowerCase();
      if (!requiredSections.every((sec) => content.includes(sec))) {
        runbooksValid = false;
        break;
      }
      if (!content.includes('five working days')) {
        runbooksValid = false;
        break;
      }
    }
  } else {
    runbooksValid = false;
  }

  // (g) Backup: restore drill evidence file exists, labelled RB-09, with row-count and checksum equality
  const rb09LogPath = path.resolve('docs/progress/evidence/RB-09.log');
  const p8DrillLogPath = path.resolve('docs/progress/evidence/P8-backup-restore-drill.log');
  let backupDrillVerified = false;
  const targetDrillLog = fs.existsSync(rb09LogPath)
    ? rb09LogPath
    : fs.existsSync(p8DrillLogPath)
      ? p8DrillLogPath
      : null;
  if (targetDrillLog) {
    const logText = fs.readFileSync(targetDrillLog, 'utf-8');
    backupDrillVerified =
      logText.includes('ROW-COUNT EQUALITY: VERIFIED') &&
      logText.includes('CHECKSUM EQUALITY: VERIFIED') &&
      logText.includes('DRILL PASSED');
  }

  // (h) Launch checklist: Part 17 requires a penetration test (E8), counsel sign-off, and applied production Terraform (GO)
  // None of these can happen locally, so 5.h evaluates to BLOCKED-EXTERNAL
  const launchChecklistMd = path.resolve('docs/progress/launch-checklist.md');
  const launchChecklistExists = fs.existsSync(launchChecklistMd);
  const launchChecklistEvidenced = false; // Blocked externally
  const launchChecklistStatus = 'BLOCKED-EXTERNAL';

  // (i) verify:prod-clean passes against production (not dry run)
  const prodCleanProdPath = path.resolve(
    'docs/progress/evidence/verify-prod-clean-production.json',
  );
  let prodCleanProductionVerified = false;
  if (fs.existsSync(prodCleanProdPath)) {
    try {
      const rec = JSON.parse(fs.readFileSync(prodCleanProdPath, 'utf-8'));
      prodCleanProductionVerified = rec.exitCode === 0;
    } catch {}
  }

  const isReady =
    allExitsVerified &&
    noBlockedItems &&
    phaseGatesPassed &&
    coverageComplete &&
    securityClean &&
    runbooksValid &&
    backupDrillVerified &&
    launchChecklistEvidenced &&
    prodCleanProductionVerified;

  const results: Section5GateResults = {
    allExitsVerified,
    noBlockedItems,
    phaseGatesPassed,
    coverageComplete,
    securityClean,
    runbooksValid,
    backupDrillVerified,
    launchChecklistEvidenced,
    prodCleanProductionVerified,
  };

  return { isReady, results, items };
}

async function main() {
  const { isReady, results, items } = await evaluateReadiness();
  const readinessPath = path.resolve('docs/progress/READINESS.md');

  const verifiedItems = items.filter((i) => i.status === 'VERIFIED');
  const blockedItems = items.filter((i) => i.status.startsWith('BLOCKED'));

  let md = `# Production Readiness Gate Evaluation (Section 5)\n\n`;
  md += `**Evaluation Timestamp:** ${new Date().toISOString()}  \n`;
  md += `**Overall Decision:** ${isReady ? '**PRODUCTION READY**' : '**NOT READY**'}  \n\n`;

  md += `## 1. Section 5 Readiness Criteria Verification\n\n`;
  md += `| Ref | Criterion | Requirement | Result |\n`;
  md += `| :--- | :--- | :--- | :---: |\n`;
  md += `| **5.a** | Exit Criteria Verification | All ${items.length} exits verified with valid evidence | ${results.allExitsVerified ? 'PASS' : 'OPEN'} (${verifiedItems.length}/${items.length}) |\n`;
  md += `| **5.b** | Unblocked Status | Zero BLOCKED-EXTERNAL or BLOCKED-OWNER items | ${results.noBlockedItems ? 'PASS' : 'BLOCKED'} (${blockedItems.length} open) |\n`;
  md += `| **5.c** | Phase Gates (P0..P9) | Fresh release:phase pass for all phases | ${results.phaseGatesPassed ? 'PASS' : 'PENDING RUN'} |\n`;
  md += `| **5.d** | Traceability Coverage | Master §21.7 items mapped to test files | ${results.coverageComplete ? 'PASS' : 'MISSING'} |\n`;
  md += `| **5.e** | Security Posture | Zero high/critical audit findings | ${results.securityClean ? 'PASS' : 'PENDING'} |\n`;
  md += `| **5.f** | Operational Runbooks | RB-01..13 with all 6 required sections | ${results.runbooksValid ? 'PASS' : 'FAIL'} |\n`;
  md += `| **5.g** | Backup & Restore Drill | RB-09 drill with row-count and checksum equality | ${results.backupDrillVerified ? 'PASS' : 'FAIL'} |\n`;
  md += `| **5.h** | Launch Checklist | Part 17 launch checklist evidenced | ${results.launchChecklistEvidenced ? 'PASS' : 'BLOCKED-EXTERNAL'} |\n`;
  md += `| **5.i** | Production Cleanliness | verify:prod-clean passes against production | ${results.prodCleanProductionVerified ? 'PASS' : 'AWAITING GO & DEPLOY'} |\n\n`;

  if (isReady) {
    md += `## 2. Final Decision\n\n`;
    md += `**SYSTEM STATUS: PRODUCTION READY**\n\nAll exit criteria, external inputs, and readiness conditions have been empirically verified.\n`;
  } else {
    md += `## 2. Open Items Remaining Before Production Readiness\n\n`;
    md += `| Exit ID | Phase | Description | Status | Unlocking External Input |\n`;
    md += `| :--- | :--- | :--- | :---: | :--- |\n`;
    for (const item of blockedItems) {
      md += `| **${item.id}** | ${item.phase} | ${item.description} | **${item.status}** | ${item.unlockingInput} |\n`;
    }
    md += `\n**SYSTEM STATUS: NOT READY**\n`;
  }

  fs.writeFileSync(readinessPath, md, 'utf-8');

  console.log('====================================================');
  console.log('PRODUCTION READINESS GATE EVALUATION (SECTION 5):');
  console.log(`- Total Exit Items Tracked: ${items.length}`);
  console.log(`- Verified Local Exits: ${verifiedItems.length}/${items.length}`);
  console.log(
    `- Blocked External Items: ${blockedItems.filter((i) => i.status === 'BLOCKED-EXTERNAL').length}`,
  );
  console.log(
    `- Blocked Owner Items: ${blockedItems.filter((i) => i.status === 'BLOCKED-OWNER').length}`,
  );
  console.log(`- Runbooks RB-01..13 Verified: ${results.runbooksValid ? 'YES' : 'NO'}`);
  console.log(
    `- RB-09 Checksum & Row-Count Equality: ${results.backupDrillVerified ? 'YES' : 'NO'}`,
  );
  console.log('====================================================');

  if (isReady) {
    console.log('PRODUCTION READY');
  } else {
    console.log('NOT READY');
    console.log('\nOpen items remaining before production readiness:');
    for (const item of blockedItems) {
      console.log(
        `- [${item.id}] (${item.status}): ${item.description} -> Unlocks with ${item.unlockingInput}`,
      );
    }
  }
}

main().catch((err) => {
  console.error('Readiness check failed:', err);
  process.exit(1);
});
