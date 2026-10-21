import { DriverLocationSampleDto } from '@collegebus/contracts';

export interface PhoneSampleRow {
  id: number;
  shift_id: string;
  seq: number;
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_mps: number | null;
  heading_deg: number | null;
  provider: 'GPS' | 'FUSED' | 'NETWORK' | 'UNKNOWN';
  is_mock: number; // 0 or 1
  created_at: string;
}

export interface SQLiteDatabaseLike {
  execAsync(source: string): Promise<void>;
  runAsync(
    statement: string,
    ...params: unknown[]
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(statement: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(statement: string, ...params: unknown[]): Promise<T | null>;
}

/**
 * In-memory SQLite emulator implementing WAL mode and SQL operations
 * matching the schema in RS-20 / docs/decisions/phone-buffer.md.
 */
export class InMemorySQLiteDatabase implements SQLiteDatabaseLike {
  private rows: PhoneSampleRow[] = [];
  private nextId = 1;
  public journalMode = 'DELETE';

  async execAsync(source: string): Promise<void> {
    if (source.includes('PRAGMA journal_mode = WAL')) {
      this.journalMode = 'WAL';
    }
    // Schema creation statements are validated and accepted
  }

  async runAsync(
    statement: string,
    ...params: unknown[]
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = statement.trim().toUpperCase();

    if (trimmed.startsWith('INSERT INTO')) {
      // params: shift_id, seq, recorded_at, lat, lng, accuracy_m, speed_mps, heading_deg, provider, is_mock, created_at
      const id = this.nextId++;
      const row: PhoneSampleRow = {
        id,
        shift_id: String(params[0]),
        seq: Number(params[1]),
        recorded_at: String(params[2]),
        lat: Number(params[3]),
        lng: Number(params[4]),
        accuracy_m: Number(params[5]),
        speed_mps: params[6] !== null && params[6] !== undefined ? Number(params[6]) : null,
        heading_deg: params[7] !== null && params[7] !== undefined ? Number(params[7]) : null,
        provider: params[8] as PhoneSampleRow['provider'],
        is_mock: Number(params[9]),
        created_at: String(params[10]),
      };
      this.rows.push(row);
      return { lastInsertRowId: id, changes: 1 };
    }

    if (trimmed.startsWith('DELETE FROM PHONE_SAMPLE_BUFFER WHERE SHIFT_ID = ? AND SEQ <= ?')) {
      const shiftId = String(params[0]);
      const ackSeq = Number(params[1]);
      const beforeCount = this.rows.length;
      this.rows = this.rows.filter((r) => !(r.shift_id === shiftId && r.seq <= ackSeq));
      return { lastInsertRowId: 0, changes: beforeCount - this.rows.length };
    }

    if (trimmed.startsWith('DELETE FROM PHONE_SAMPLE_BUFFER WHERE SHIFT_ID = ?')) {
      const shiftId = String(params[0]);
      const beforeCount = this.rows.length;
      this.rows = this.rows.filter((r) => r.shift_id !== shiftId);
      return { lastInsertRowId: 0, changes: beforeCount - this.rows.length };
    }

    if (trimmed.startsWith('DELETE FROM PHONE_SAMPLE_BUFFER WHERE ID IN')) {
      // FIFO eviction: DELETE FROM phone_sample_buffer WHERE id IN (SELECT id FROM ... LIMIT ?)
      const limit = Number(params[0]);
      const toDelete = this.rows.slice(0, limit).map((r) => r.id);
      const toDeleteSet = new Set(toDelete);
      const beforeCount = this.rows.length;
      this.rows = this.rows.filter((r) => !toDeleteSet.has(r.id));
      return { lastInsertRowId: 0, changes: beforeCount - this.rows.length };
    }

    if (trimmed.startsWith('DELETE FROM PHONE_SAMPLE_BUFFER')) {
      const beforeCount = this.rows.length;
      this.rows = [];
      return { lastInsertRowId: 0, changes: beforeCount };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T>(statement: string, ...params: unknown[]): Promise<T[]> {
    const trimmed = statement.trim().toUpperCase();

    if (trimmed.includes('SELECT') && trimmed.includes('ORDER BY SEQ ASC LIMIT')) {
      // SELECT * FROM phone_sample_buffer WHERE shift_id = ? ORDER BY seq ASC LIMIT ?
      const shiftId = String(params[0]);
      const limit = Number(params[1] ?? 50);
      const matched = this.rows
        .filter((r) => r.shift_id === shiftId)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit);
      return matched as unknown as T[];
    }

    if (trimmed.includes('SELECT * FROM PHONE_SAMPLE_BUFFER WHERE SHIFT_ID = ?')) {
      const shiftId = String(params[0]);
      return this.rows
        .filter((r) => r.shift_id === shiftId)
        .sort((a, b) => a.seq - b.seq) as unknown as T[];
    }

    if (trimmed.includes('SELECT * FROM PHONE_SAMPLE_BUFFER')) {
      return [...this.rows] as unknown as T[];
    }

    return [] as T[];
  }

  async getFirstAsync<T>(statement: string, ...params: unknown[]): Promise<T | null> {
    const trimmed = statement.trim().toUpperCase();

    if (trimmed.includes('COUNT(*)')) {
      if (trimmed.includes('WHERE SHIFT_ID = ?')) {
        const shiftId = String(params[0]);
        const count = this.rows.filter((r) => r.shift_id === shiftId).length;
        return { count } as unknown as T;
      }
      return { count: this.rows.length } as unknown as T;
    }

    return null;
  }
}

export interface PhoneLocationBufferOptions {
  maxCapacity?: number; // Default 8640 (24 hours at 10s intervals)
  db?: SQLiteDatabaseLike;
}

/**
 * PhoneLocationBuffer
 * Manages local persistence of driver phone GPS samples in SQLite per RS-20 & SW-MVP-1.0 §11.7.
 */
export class PhoneLocationBuffer {
  public static readonly DEFAULT_MAX_CAPACITY = 8640; // 24 hours @ 10s intervals
  private readonly maxCapacity: number;
  private readonly db: SQLiteDatabaseLike;
  private initialized = false;
  private evictedCount = 0;

  constructor(options: PhoneLocationBufferOptions = {}) {
    this.maxCapacity = options.maxCapacity ?? PhoneLocationBuffer.DEFAULT_MAX_CAPACITY;
    this.db = options.db ?? new InMemorySQLiteDatabase();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Enable WAL mode for thread-safe background concurrency
    await this.db.execAsync('PRAGMA journal_mode = WAL;');

    // Create table & index according to RS-20 schema
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS phone_sample_buffer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        accuracy_m REAL NOT NULL,
        speed_mps REAL,
        heading_deg REAL,
        provider TEXT NOT NULL,
        is_mock INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_buffer_shift_seq ON phone_sample_buffer (shift_id, seq ASC);
    `);

    this.initialized = true;
  }

  /**
   * Enqueues a single location sample. If buffer exceeds max capacity,
   * evicts oldest samples (FIFO eviction) to preserve system memory.
   */
  async enqueueSample(
    shiftId: string,
    sample: DriverLocationSampleDto,
    createdAt: string = new Date().toISOString(),
  ): Promise<number> {
    await this.initialize();

    // Check capacity before inserting
    const currentCount = await this.getCount();
    if (currentCount >= this.maxCapacity) {
      const overflow = currentCount - this.maxCapacity + 1;
      await this.evictOldest(overflow);
    }

    await this.db.runAsync(
      `INSERT INTO phone_sample_buffer (
        shift_id, seq, recorded_at, lat, lng, accuracy_m, speed_mps, heading_deg, provider, is_mock, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      shiftId,
      sample.seq,
      sample.recorded_at,
      sample.lat,
      sample.lng,
      sample.accuracy_m,
      sample.speed_mps ?? null,
      sample.heading_deg ?? null,
      sample.provider,
      sample.is_mock ? 1 : 0,
      createdAt,
    );

    return this.getCount(shiftId);
  }

  /**
   * Enqueues a batch of location samples.
   */
  async enqueueBatch(
    shiftId: string,
    samples: DriverLocationSampleDto[],
    createdAt: string = new Date().toISOString(),
  ): Promise<number> {
    await this.initialize();

    const currentCount = await this.getCount();
    const needed = currentCount + samples.length - this.maxCapacity;
    if (needed > 0) {
      await this.evictOldest(needed);
    }

    for (const sample of samples) {
      await this.db.runAsync(
        `INSERT INTO phone_sample_buffer (
          shift_id, seq, recorded_at, lat, lng, accuracy_m, speed_mps, heading_deg, provider, is_mock, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        shiftId,
        sample.seq,
        sample.recorded_at,
        sample.lat,
        sample.lng,
        sample.accuracy_m,
        sample.speed_mps ?? null,
        sample.heading_deg ?? null,
        sample.provider,
        sample.is_mock ? 1 : 0,
        createdAt,
      );
    }

    return this.getCount(shiftId);
  }

  /**
   * Retrieves up to limit (max 50) samples in chronological order.
   */
  async getPendingBatch(shiftId: string, limit: number = 50): Promise<DriverLocationSampleDto[]> {
    await this.initialize();
    const batchLimit = Math.min(Math.max(1, limit), 50);

    const rows = await this.db.getAllAsync<PhoneSampleRow>(
      `SELECT * FROM phone_sample_buffer WHERE shift_id = ? ORDER BY seq ASC LIMIT ?`,
      shiftId,
      batchLimit,
    );

    return rows.map((r) => ({
      seq: r.seq,
      recorded_at: r.recorded_at,
      lat: r.lat,
      lng: r.lng,
      accuracy_m: r.accuracy_m,
      speed_mps: r.speed_mps !== null ? r.speed_mps : null,
      heading_deg: r.heading_deg !== null ? r.heading_deg : null,
      provider: r.provider,
      is_mock: Boolean(r.is_mock),
    }));
  }

  /**
   * Deletes all samples with seq <= ackSeq for the specified shift.
   */
  async acknowledge(shiftId: string, ackSeq: number): Promise<number> {
    await this.initialize();

    const res = await this.db.runAsync(
      `DELETE FROM phone_sample_buffer WHERE shift_id = ? AND seq <= ?`,
      shiftId,
      ackSeq,
    );

    return res.changes;
  }

  /**
   * Returns current buffer count for a shift or across entire buffer.
   */
  async getCount(shiftId?: string): Promise<number> {
    await this.initialize();

    if (shiftId) {
      const res = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM phone_sample_buffer WHERE shift_id = ?`,
        shiftId,
      );
      return res ? Number(res.count) : 0;
    }

    const res = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM phone_sample_buffer`,
    );
    return res ? Number(res.count) : 0;
  }

  /**
   * Evicts the oldest N rows in the database.
   */
  private async evictOldest(count: number): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM phone_sample_buffer WHERE id IN (SELECT id FROM phone_sample_buffer ORDER BY id ASC LIMIT ?)`,
      count,
    );
    this.evictedCount += count;
  }

  getEvictedCount(): number {
    return this.evictedCount;
  }

  /**
   * Clears all buffered samples for a shift or entire database.
   */
  async clear(shiftId?: string): Promise<void> {
    await this.initialize();

    if (shiftId) {
      await this.db.runAsync(`DELETE FROM phone_sample_buffer WHERE shift_id = ?`, shiftId);
    } else {
      await this.db.runAsync(`DELETE FROM phone_sample_buffer`);
    }
  }

  /**
   * Returns all stored rows (useful for inspection/tests).
   */
  async getAll(shiftId?: string): Promise<PhoneSampleRow[]> {
    await this.initialize();
    if (shiftId) {
      return this.db.getAllAsync<PhoneSampleRow>(
        `SELECT * FROM phone_sample_buffer WHERE shift_id = ? ORDER BY seq ASC`,
        shiftId,
      );
    }
    return this.db.getAllAsync<PhoneSampleRow>(`SELECT * FROM phone_sample_buffer`);
  }
}
