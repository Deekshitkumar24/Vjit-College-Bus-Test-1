import * as fs from 'fs';
import * as path from 'path';

const runbooksDir = path.resolve('docs/runbooks');
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

console.log('=== Checking Operational Runbooks (RB-01 to RB-13) ===');

if (!fs.existsSync(runbooksDir)) {
  console.error(`Runbooks directory missing: ${runbooksDir}`);
  process.exit(1);
}

const files = fs.readdirSync(runbooksDir);
let allValid = true;

for (const rb of requiredRunbooks) {
  const match = files.find((f) => f.startsWith(rb) && f.endsWith('.md'));
  if (!match) {
    console.error(`Missing runbook: ${rb}`);
    allValid = false;
    continue;
  }

  const content = fs.readFileSync(path.join(runbooksDir, match), 'utf-8').toLowerCase();
  const missingSections: string[] = [];

  for (const sec of requiredSections) {
    if (!content.includes(sec)) {
      missingSections.push(sec);
    }
  }

  if (missingSections.length > 0) {
    console.error(`Runbook ${match} missing sections: ${missingSections.join(', ')}`);
    allValid = false;
  } else {
    console.log(`✓ ${match} contains all required Part 20.12 sections.`);
  }
}

if (!allValid) {
  console.error('Runbook validation failed!');
  process.exit(1);
}

console.log('All 13 operational runbooks RB-01 to RB-13 verified successfully.');
