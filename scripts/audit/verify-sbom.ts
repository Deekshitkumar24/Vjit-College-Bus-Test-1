import * as fs from 'fs';
import * as path from 'path';

const sbomPath = path.resolve('docs/progress/evidence/sbom.json');
if (!fs.existsSync(sbomPath)) {
  console.error('ERROR: SBOM file does not exist at docs/progress/evidence/sbom.json');
  process.exit(1);
}
const stats = fs.statSync(sbomPath);
console.log(`SBOM file verified: ${stats.size} bytes (${sbomPath})`);
