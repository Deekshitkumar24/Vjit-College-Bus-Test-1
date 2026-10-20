import { DateTime } from 'luxon';
import { Pool } from 'pg';

/**
 * Partition Manager for location_samples and device_heartbeats.
 * Creates daily partitions 7 days ahead (AG-MASTER-1.0 §7.12, §12.3).
 */
export class PartitionManager {
  constructor(private pool: Pool) {}

  public async ensurePartitionsAhead(daysAhead = 7): Promise<string[]> {
    const createdPartitions: string[] = [];
    const client = await this.pool.connect();

    try {
      const now = DateTime.utc();

      for (let i = 0; i <= daysAhead; i++) {
        const targetDay = now.plus({ days: i });
        const dateStr = targetDay.toFormat('yyyy_MM_dd');
        const startDay = targetDay.startOf('day').toISO();
        const endDay = targetDay.plus({ days: 1 }).startOf('day').toISO();

        // 1. location_samples partition
        const locPartitionName = `location_samples_${dateStr}`;
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${locPartitionName} PARTITION OF location_samples
          FOR VALUES FROM ('${startDay}') TO ('${endDay}');
        `);
        createdPartitions.push(locPartitionName);

        // 2. device_heartbeats partition
        const hbPartitionName = `device_heartbeats_${dateStr}`;
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${hbPartitionName} PARTITION OF device_heartbeats
          FOR VALUES FROM ('${startDay}') TO ('${endDay}');
        `);
        createdPartitions.push(hbPartitionName);
      }
    } finally {
      client.release();
    }

    return createdPartitions;
  }

  public async dropOldPartitions(retentionDays = 90): Promise<string[]> {
    const dropped: string[] = [];
    const client = await this.pool.connect();

    try {
      const cutoff = DateTime.utc().minus({ days: retentionDays }).toFormat('yyyy_MM_dd');
      // Query information_schema / pg_inherits for partitions older than cutoff and drop them
      const res = await client.query(
        `
        SELECT relname FROM pg_class 
        WHERE relname LIKE 'location_samples_%' AND relname < 'location_samples_' || $1;
      `,
        [cutoff],
      );

      for (const row of res.rows) {
        await client.query(`DROP TABLE IF EXISTS ${row.relname};`);
        dropped.push(row.relname);
      }
    } finally {
      client.release();
    }

    return dropped;
  }
}
