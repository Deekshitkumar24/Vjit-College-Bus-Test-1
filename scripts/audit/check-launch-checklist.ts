import * as fs from 'fs';
import * as path from 'path';

console.log('================================================================');
console.log('MASTER PART 17 LAUNCH CHECKLIST AUDIT');
console.log('================================================================\n');

const checklistPath = path.resolve('docs/progress/launch-checklist.md');
if (!fs.existsSync(checklistPath)) {
  console.error(`Checklist markdown not found at ${checklistPath}`);
  process.exit(1);
}

const content = fs.readFileSync(checklistPath, 'utf-8');
const lines = content.split('\n');

interface ChecklistRow {
  item: string;
  status: string;
  evidenceOrBlocker: string;
}

const rows: ChecklistRow[] = [];

for (const line of lines) {
  if (line.startsWith('|') && !line.includes('Checklist Item') && !line.includes(':---')) {
    const cols = line
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    if (cols.length >= 3) {
      rows.push({
        item: cols[0],
        status: cols[1],
        evidenceOrBlocker: cols[2],
      });
    }
  }
}

const verified = rows.filter((r) => r.status === 'VERIFIED');
const blockedExternal = rows.filter((r) => r.status.includes('BLOCKED-EXTERNAL'));
const blockedOwner = rows.filter((r) => r.status.includes('BLOCKED-OWNER'));

console.log(`Total Part 17 Checklist Items: ${rows.length}`);
console.log(`- Verified Local Items: ${verified.length}`);
console.log(`- Blocked External Items: ${blockedExternal.length}`);
console.log(`- Blocked Owner Items: ${blockedOwner.length}`);

for (const r of rows) {
  const icon = r.status === 'VERIFIED' ? '✓ [VERIFIED]' : '⏸ [BLOCKED]';
  console.log(`  ${icon} ${r.item} -> ${r.evidenceOrBlocker}`);
}

const evidenceJsonPath = path.resolve('docs/progress/evidence/launch-checklist.json');
fs.writeFileSync(
  evidenceJsonPath,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      total: rows.length,
      verifiedCount: verified.length,
      blockedExternalCount: blockedExternal.length,
      blockedOwnerCount: blockedOwner.length,
      status: 'BLOCKED-EXTERNAL',
      openExternalItems: blockedExternal.concat(blockedOwner),
    },
    null,
    2,
  ),
  'utf-8',
);

console.log('\n================================================================');
console.log(`LAUNCH CHECKLIST AUDIT: ${verified.length}/${rows.length} verified locally.`);
console.log('Gate 5.h is BLOCKED-EXTERNAL pending external and owner prerequisites.');
console.log('================================================================\n');
