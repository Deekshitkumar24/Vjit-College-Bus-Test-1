import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface RetentionPurgeResult {
  retentionDays: number;
  cutoffDate: string;
  partitionsDropped: string[];
  auditLogId: string;
}

@Injectable()
export class RetentionService {
  constructor(private readonly pool: Pool) {}

  /**
   * T-PRV-03: Drops partitions older than retention window (e.g. 90 days for location_samples per D-14).
   * Writes an immutable audit summary to audit_logs.
   */
  public async purgeExpiredPartitions(
    retentionDays: number = 90,
    now: Date = new Date(),
  ): Promise<RetentionPurgeResult> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 3600 * 1000);
    const cutoffStr = cutoff.toISOString().slice(0, 10).replace(/-/g, '_');

    const client = await this.pool.connect();
    const dropped: string[] = [];

    try {
      await client.query('BEGIN');

      // Find partitions matching naming pattern older than cutoff
      const partitionsQuery = await client.query(
        `SELECT tablename FROM pg_tables 
         WHERE schemaname = 'public' 
           AND tablename LIKE 'location_samples_%' 
           AND tablename < 'location_samples_' || $1;`,
        [cutoffStr],
      );

      for (const row of partitionsQuery.rows) {
        const pName = row.tablename;
        // Drop expired partition table
        await client.query(`DROP TABLE IF EXISTS "${pName}";`);
        dropped.push(pName);
      }

      // Write audit log entry (Part 13.12 / R-09)
      const auditRes = await client.query(
        `INSERT INTO audit_logs (id, action, entity_type, after, at)
         VALUES (
           gen_random_uuid(),
           'RETENTION_PURGE_PARTITIONS',
           'location_samples',
           $1,
           NOW()
         ) RETURNING id;`,
        [
          JSON.stringify({
            retention_days: retentionDays,
            cutoff: cutoffStr,
            partitions_dropped: dropped,
            purged_at: now.toISOString(),
          }),
        ],
      );


      await client.query('COMMIT');

      return {
        retentionDays,
        cutoffDate: cutoffStr,
        partitionsDropped: dropped,
        auditLogId: auditRes.rows[0].id,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
