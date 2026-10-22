import { Injectable, BadRequestException } from '@nestjs/common';

export interface OperationalAlert {
  type: string;
  severity: 1 | 2 | 3;
  description: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

@Injectable()
export class OperationalAlertsEngine {
  /**
   * Fleet silence: More than 20% of buses on active shifts with no valid data for 3 minutes (Severity 1).
   */
  evaluateFleetSilence(params: {
    totalActiveBuses: number;
    silentActiveBuses: number;
  }): OperationalAlert | null {
    if (params.totalActiveBuses === 0) return null;
    const ratio = params.silentActiveBuses / params.totalActiveBuses;
    if (ratio > 0.2) {
      return {
        type: 'FLEET_SILENCE',
        severity: 1,
        description: `Fleet silence detected: ${Math.round(ratio * 100)}% (${params.silentActiveBuses}/${params.totalActiveBuses}) of active buses have transmitted no valid data for >3 minutes.`,
        created_at: new Date(),
        metadata: { ratio, silentCount: params.silentActiveBuses, totalCount: params.totalActiveBuses },
      };
    }
    return null;
  }

  /**
   * Bus unavailable: Active shift, no fresh source for 2 minutes (Severity 2).
   */
  evaluateBusUnavailable(params: {
    busId: string;
    shiftActive: boolean;
    secondsSinceLastSource: number;
  }): OperationalAlert | null {
    if (params.shiftActive && params.secondsSinceLastSource > 120) {
      return {
        type: 'BUS_UNAVAILABLE',
        severity: 2,
        target_id: params.busId,
        description: `Bus unavailable: Bus ${params.busId} has an active shift with no fresh source for ${params.secondsSinceLastSource}s (>2m).`,
        created_at: new Date(),
      };
    }
    return null;
  }

  /**
   * Source flapping: More than 6 switches in 10 minutes (Severity 3).
   */
  evaluateSourceFlapping(params: {
    busId: string;
    switchCountIn10Min: number;
  }): OperationalAlert | null {
    if (params.switchCountIn10Min > 6) {
      return {
        type: 'SOURCE_FLAPPING',
        severity: 3,
        target_id: params.busId,
        description: `Source flapping: Bus ${params.busId} recorded ${params.switchCountIn10Min} source switches in last 10 minutes (>6).`,
        created_at: new Date(),
      };
    }
    return null;
  }

  /**
   * Authentication failures: More than 50 failed authentications in 5 minutes for one device (Severity 2).
   */
  evaluateAuthFailures(params: {
    deviceId: string;
    failureCountIn5Min: number;
  }): OperationalAlert | null {
    if (params.failureCountIn5Min > 50) {
      return {
        type: 'AUTH_FAILURES',
        severity: 2,
        target_id: params.deviceId,
        description: `Authentication failures spike: Device ${params.deviceId} experienced ${params.failureCountIn5Min} failed authentications in 5 minutes (>50).`,
        created_at: new Date(),
      };
    }
    return null;
  }
}

export interface CoordinatorDailySummary {
  sos_count_24h: number;
  open_absence_alerts_count: number;
  offline_delayed_devices_count: number;
  pending_stop_requests_count: number;
  late_or_cancelled_trips_count: number;
  expiring_documents_count: number;
  generated_at: string;
}

@Injectable()
export class CoordinatorSummaryJob {
  /**
   * Compiles the 08:00 IST coordinator daily operational summary (Part 12.3).
   */
  async compileDailySummary(params: {
    getSosIncidentsLast24h: () => Promise<any[]>;
    getOpenAbsenceAlerts: () => Promise<any[]>;
    getOfflineOrDelayedDevices: () => Promise<any[]>;
    getPendingStopRequests: () => Promise<any[]>;
    getLateOrCancelledTrips: () => Promise<any[]>;
    getDocumentsExpiring30Days: () => Promise<any[]>;
  }): Promise<CoordinatorDailySummary> {
    const [
      sos,
      absenceAlerts,
      offlineDevices,
      stopRequests,
      lateTrips,
      expiringDocs,
    ] = await Promise.all([
      params.getSosIncidentsLast24h(),
      params.getOpenAbsenceAlerts(),
      params.getOfflineOrDelayedDevices(),
      params.getPendingStopRequests(),
      params.getLateOrCancelledTrips(),
      params.getDocumentsExpiring30Days(),
    ]);

    return {
      sos_count_24h: sos.length,
      open_absence_alerts_count: absenceAlerts.length,
      offline_delayed_devices_count: offlineDevices.length,
      pending_stop_requests_count: stopRequests.length,
      late_or_cancelled_trips_count: lateTrips.length,
      expiring_documents_count: expiringDocs.length,
      generated_at: new Date().toISOString(),
    };
  }
}

export interface AttendanceCsvRow {
  student_name: string;
  roll_number: string;
  trip_type: string;
  status: string;
  notes?: string;
  [key: string]: any;
}

@Injectable()
export class AttendanceCsvExporter {
  private readonly maxRowLimit = 100000;

  validateExportLimits(rowCount: number): void {
    if (rowCount > this.maxRowLimit) {
      throw new BadRequestException(`Export exceeds maximum allowed limit of ${this.maxRowLimit.toLocaleString()} rows`);
    }
  }

  /**
   * Sanitizes cell content against Formula Injection (Part 13.16).
   * Any cell starting with =, +, -, or @ is prepended with a single quote ' and escaped.
   */
  sanitizeCell(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value).trim();
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      // Escape formula injection with leading single quote inside quotes
      return `'''${str}'`;
    }
    // Handle commas or quotes in CSV
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  generateCsv(records: AttendanceCsvRow[]): string {
    this.validateExportLimits(records.length);

    const headers = ['Student Name', 'Roll Number', 'Trip Type', 'Status', 'Notes'];
    const rows: string[] = [headers.join(',')];

    for (const r of records) {
      const line = [
        this.sanitizeCell(r.student_name),
        this.sanitizeCell(r.roll_number),
        this.sanitizeCell(r.trip_type),
        this.sanitizeCell(r.status),
        this.sanitizeCell(r.notes || ''),
      ].join(',');
      rows.push(line);
    }

    return rows.join('\n');
  }
}
