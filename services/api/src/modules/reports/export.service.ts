import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface CreateExportParams {
  requestedBy: string;
  type: string;
  filters?: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  now?: Date;
}

export interface ExportResult {
  jobId: string;
  rowCount: number;
  csvContent: string;
  storageKey: string;
  presignedUrl: string;
  expiresAt: Date;
}

@Injectable()
export class ExportService {
  public static readonly MAX_ROWS = 100000;
  public static readonly PRESIGNED_LIFETIME_HOURS = 24; // C-06 / SW-MVP-1.0 §23

  constructor(private readonly pool?: Pool) {}

  /**
   * Sanitizes a cell string to prevent CSV Formula Injection (T-SEC-03, Part 13.16).
   * Cells starting with =, +, -, @, \t, or \r are prepended with a single quote (').
   */
  public sanitizeCsvCell(cell: unknown): string {
    if (cell === null || cell === undefined) {
      return '';
    }

    const str = String(cell);
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];

    if (dangerousPrefixes.some((prefix) => str.startsWith(prefix))) {
      return `'${str}`;
    }

    // Escape embedded quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Formats rows into sanitized CSV format.
   */
  public formatCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]!);
    const headerLine = headers.map((h) => this.sanitizeCsvCell(h)).join(',');

    const lines = rows.map((row) =>
      headers.map((h) => this.sanitizeCsvCell(row[h])).join(','),
    );

    return [headerLine, ...lines].join('\n');
  }

  /**
   * Generates export with row count limit, CSV sanitization, and 24h presigned URL.
   */
  public async createExport(params: CreateExportParams): Promise<ExportResult> {
    const now = params.now ?? new Date();

    if (params.rows.length > ExportService.MAX_ROWS) {
      throw new Error(`EXPORT_ROW_LIMIT_EXCEEDED: Maximum allowed is ${ExportService.MAX_ROWS} rows`);
    }

    const csvContent = this.formatCsv(params.rows);
    const jobId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storageKey = `exports/${now.toISOString().slice(0, 10)}/${jobId}.csv`;
    const expiresAt = new Date(now.getTime() + ExportService.PRESIGNED_LIFETIME_HOURS * 3600 * 1000);

    // Mock S3/MinIO presigned GET URL (valid for 24h per C-06)
    const presignedUrl = `https://minio.local:9000/collegebus-exports/${storageKey}?X-Amz-Expires=86400&X-Amz-Signature=dummy_sig`;

    if (this.pool) {
      await this.pool.query(
        `INSERT INTO export_jobs (
          id, requested_by, type, filters, status, storage_key, row_count, expires_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'READY', $4, $5, $6, NOW(), NOW()
        );`,
        [params.requestedBy, params.type, JSON.stringify(params.filters ?? {}), storageKey, params.rows.length, expiresAt],
      );
    }

    return {
      jobId,
      rowCount: params.rows.length,
      csvContent,
      storageKey,
      presignedUrl,
      expiresAt,
    };
  }
}
