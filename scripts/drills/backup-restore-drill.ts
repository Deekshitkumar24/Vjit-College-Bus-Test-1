import { Pool } from 'pg';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * P8-T2: Backup and Restore Drill (RB-09 Rehearsal per Part 20.12 / D-3)
 * Measures backup and restore times against native PostgreSQL 16 with PostGIS.
 * Verifies complete data, row-count, and checksum equality.
 */
async function runDrill() {
  console.log('=== Starting P8 Backup and Restore Drill (RB-09 Rehearsal: PostgreSQL 16 with PostGIS) ===');
  const baseAdminUrl =
    process.env['DATABASE_URL_TEST'] ||
    process.env['DATABASE_URL'] ||
    'postgresql://postgres:@localhost:5432/postgres';

  const basePool = new Pool({ connectionString: baseAdminUrl });
  const timestamp = Date.now();
  const sourceDb = `cb_drill_src_${timestamp}`;
  const targetDb = `cb_drill_tgt_${timestamp}`;
  const dumpFile = path.resolve(`docs/progress/evidence/drill_dump_${timestamp}.sql`);

  const client = await basePool.connect();
  try {
    // 1. Create source database from collegebus template
    console.log(`Creating source database: ${sourceDb}...`);
    await client.query(`CREATE DATABASE "${sourceDb}" TEMPLATE collegebus;`);

    // 2. Connect to source database and seed test dataset
    const sourcePool = new Pool({
      connectionString: baseAdminUrl.replace(/\/([^/?]+)(\?.*)?$/, `/${sourceDb}$2`),
    });

    const collegeId = '00000000-0000-0000-0000-000000000801';
    await sourcePool.query(`
      INSERT INTO colleges (id, name, email_domains, timezone, created_at, updated_at)
      VALUES ('${collegeId}', 'Drill Engineering College', ARRAY['drill.edu'], 'Asia/Kolkata', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Insert 10 sample buses
    for (let i = 1; i <= 10; i++) {
      const busId = `00000000-0000-0000-0000-0000000008${i.toString().padStart(2, '0')}`;
      await sourcePool.query(`
        INSERT INTO buses (id, bus_number, registration_number, capacity, status, insurance_expiry, fitness_expiry, pollution_expiry, permit_expiry, created_at, updated_at)
        VALUES ('${busId}', 'DRILL-${i}', 'KA-01-DR-${100 + i}', 40, 'ACTIVE', '2028-01-01', '2028-01-01', '2028-01-01', '2028-01-01', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    const srcBusCountRes = await sourcePool.query(`SELECT COUNT(*) FROM buses;`);
    const srcBusCount = parseInt(srcBusCountRes.rows[0].count, 10);

    const srcChecksumRes = await sourcePool.query(`
      SELECT md5(string_agg(id::text || registration_number, ',' ORDER BY id)) AS checksum FROM buses;
    `);
    const srcChecksum = srcChecksumRes.rows[0].checksum;

    console.log(`Source database populated with ${srcBusCount} buses (Checksum: ${srcChecksum}).`);
    await sourcePool.end();

    // 3. Measure Backup execution via pg_dump
    console.log('Running pg_dump...');
    const backupStart = Date.now();
    execSync(`pg_dump -U postgres -h localhost -p 5432 -d "${sourceDb}" -F p -f "${dumpFile}"`, {
      stdio: 'pipe',
    });
    const backupDurationMs = Date.now() - backupStart;
    const dumpSizeBytes = fs.statSync(dumpFile).size;
    console.log(`Backup completed in ${backupDurationMs}ms (Size: ${dumpSizeBytes} bytes).`);

    // 4. Create empty target database
    console.log(`Creating target database: ${targetDb}...`);
    await client.query(`CREATE DATABASE "${targetDb}";`);

    // 5. Measure Restore execution via psql
    console.log('Running psql restore...');
    const restoreStart = Date.now();
    execSync(`psql -U postgres -h localhost -p 5432 -d "${targetDb}" -f "${dumpFile}"`, {
      stdio: 'pipe',
    });
    const restoreDurationMs = Date.now() - restoreStart;
    console.log(`Restore completed in ${restoreDurationMs}ms.`);

    // 6. Verify data integrity in target database
    const targetPool = new Pool({
      connectionString: baseAdminUrl.replace(/\/([^/?]+)(\?.*)?$/, `/${targetDb}$2`),
    });

    const tgtBusCountRes = await targetPool.query(`SELECT COUNT(*) FROM buses;`);
    const tgtBusCount = parseInt(tgtBusCountRes.rows[0].count, 10);

    const tgtChecksumRes = await targetPool.query(`
      SELECT md5(string_agg(id::text || registration_number, ',' ORDER BY id)) AS checksum FROM buses;
    `);
    const tgtChecksum = tgtChecksumRes.rows[0].checksum;

    const postgisCheck = await targetPool.query(`SELECT PostGIS_Version();`);
    const postgisVersion = postgisCheck.rows[0].postgis_version;

    console.log(`Target database verified: ${tgtBusCount} buses (Checksum: ${tgtChecksum}), PostGIS: ${postgisVersion}`);
    await targetPool.end();

    if (tgtBusCount !== srcBusCount) {
      throw new Error(`Data mismatch: source had ${srcBusCount} buses, target has ${tgtBusCount}`);
    }

    if (tgtChecksum !== srcChecksum) {
      throw new Error(`Checksum mismatch: source checksum ${srcChecksum}, target checksum ${tgtChecksum}`);
    }

    const report = `P8 Backup and Restore Drill (RB-09 Rehearsal) Evidence:
=============================================================
Runbook: RB-09 (Restoring from backup per AG-MASTER-FINAL-1.0 Part 20.12)
Source Database: ${sourceDb}
Target Database: ${targetDb}
Dump File: ${dumpFile} (${dumpSizeBytes} bytes)
Measured Backup Time: ${backupDurationMs}ms
Measured Restore Time: ${restoreDurationMs}ms
Total Drill Time: ${backupDurationMs + restoreDurationMs}ms
Integrity Verification:
- Source Bus Count: ${srcBusCount}
- Target Bus Count: ${tgtBusCount} (ROW-COUNT EQUALITY: VERIFIED)
- Source Table Checksum: ${srcChecksum}
- Target Table Checksum: ${tgtChecksum} (CHECKSUM EQUALITY: VERIFIED)
- Target PostGIS Extension: ${postgisVersion} (FUNCTIONAL)
Status: DRILL PASSED (RB-09 rehearsal verified with checksum equality)
`;

    console.log(report);

    const evidenceDir = path.resolve('docs/progress/evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });

    fs.writeFileSync(path.join(evidenceDir, 'RB-09.log'), report, 'utf-8');
    fs.writeFileSync(path.join(evidenceDir, 'P8-backup-restore-drill.log'), report, 'utf-8');

    // Cleanup dump file
    if (fs.existsSync(dumpFile)) {
      fs.unlinkSync(dumpFile);
    }
  } finally {
    // 7. Drop drill databases
    console.log('Cleaning up drill databases...');
    try {
      await client.query(`DROP DATABASE IF EXISTS "${sourceDb}";`);
      await client.query(`DROP DATABASE IF EXISTS "${targetDb}";`);
    } catch (e) {
      console.warn('Error during database cleanup:', e);
    }
    client.release();
    await basePool.end();
  }
}

runDrill().catch((err) => {
  console.error('Backup restore drill failed:', err);
  process.exit(1);
});
