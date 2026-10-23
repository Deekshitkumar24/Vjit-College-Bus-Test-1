# RB-09: Restoring from Backup

## 1. Trigger

Catastrophic database corruption, accidental table truncation, or hardware failure requiring full snapshot restore.

## 2. First Five Minutes

1. Freeze API writes by enabling maintenance mode banner.
2. Identify target point-in-time recovery (PITR) timestamp or latest verified snapshot.
3. Provision restore target database instance in RDS.
4. Notify executive stakeholders and campus leadership.

## 3. Diagnosis

- Inspect audit logs to establish exact timestamp and scope of data loss.
- Verify integrity of automated S3 WAL archives and pg_dump backups.

## 4. Mitigation

- Execute restore procedure (tested via `backup-restore-drill.ts`).
- Verify row counts, foreign key integrity, and PostGIS extension functionality.
- Verify checksum equality against known pre-incident records.
- Repoint API connection strings to restored database instance and disable maintenance mode.

## 5. Communication Template

> EMERGENCY MAINTENANCE: Database restore executed successfully from verified backup. Full data parity confirmed.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
