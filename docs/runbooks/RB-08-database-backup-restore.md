# RB-08: Database Point-In-Time Recovery & Restore Drill

## 1. Purpose
Executing disaster recovery and database restoration from native backups (Part 14.3, Decision D-09, P8-T4).

## 2. Recovery Procedure
1. Provision new PostgreSQL 16 instance with PostGIS 3.4.2 extension.
2. Obtain latest encrypted snapshot or dump (`pg_dump` binary/plain format).
3. Execute restore command:
   ```bash
   psql -U postgres -h <host> -p 5432 -d <target_db> -f <dump_file>
   ```
4. Verify PostGIS extension:
   ```sql
   SELECT PostGIS_Version();
   ```
5. Check table counts against primary snapshot: `users`, `buses`, `attendance_records`.
6. Update application connection string `DATABASE_URL` in Secrets Manager and restart ECS service.
