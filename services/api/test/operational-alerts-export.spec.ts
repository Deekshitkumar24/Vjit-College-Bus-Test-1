import { describe, it, expect } from 'vitest';
import {
  OperationalAlertsEngine,
  CoordinatorSummaryJob,
  AttendanceCsvExporter,
} from '../src/modules/attendance/operational-alerts.service.js';

describe('Operational Alerts, Coordinator Summary & CSV Export (P5-T7)', () => {
  describe('OperationalAlertsEngine (Part 11.5)', () => {
    const engine = new OperationalAlertsEngine();

    it('triggers Severity 1 FLEET_SILENCE when >20% of buses on active shifts have no valid data for 3 min', () => {
      // 10 active buses, 3 silent (>20%)
      const alert = engine.evaluateFleetSilence({
        totalActiveBuses: 10,
        silentActiveBuses: 3,
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe(1);
      expect(alert?.type).toBe('FLEET_SILENCE');
    });

    it('triggers Severity 2 BUS_UNAVAILABLE when an active bus has no fresh source for 2 min', () => {
      const alert = engine.evaluateBusUnavailable({
        busId: 'bus-1',
        shiftActive: true,
        secondsSinceLastSource: 130, // > 120s
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe(2);
      expect(alert?.type).toBe('BUS_UNAVAILABLE');
    });

    it('triggers Severity 3 SOURCE_FLAPPING when more than 6 switches occur in 10 min', () => {
      const alert = engine.evaluateSourceFlapping({
        busId: 'bus-1',
        switchCountIn10Min: 7, // > 6
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe(3);
      expect(alert?.type).toBe('SOURCE_FLAPPING');
    });

    it('triggers Severity 2 AUTH_FAILURES when more than 50 failed authentications occur in 5 min', () => {
      const alert = engine.evaluateAuthFailures({
        deviceId: 'device-1',
        failureCountIn5Min: 55, // > 50
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe(2);
      expect(alert?.type).toBe('AUTH_FAILURES');
    });
  });

  describe('CoordinatorSummaryJob (Part 12.3)', () => {
    const job = new CoordinatorSummaryJob();

    it('compiles 08:00 IST daily coordinator summary across key operational metrics', async () => {
      const summary = await job.compileDailySummary({
        getSosIncidentsLast24h: async () => [{ id: 'sos-1' }],
        getOpenAbsenceAlerts: async () => [{ id: 'abs-1' }, { id: 'abs-2' }],
        getOfflineOrDelayedDevices: async () => [{ id: 'dev-1' }],
        getPendingStopRequests: async () => [{ id: 'sr-1' }],
        getLateOrCancelledTrips: async () => [{ id: 'trip-1' }],
        getDocumentsExpiring30Days: async () => [{ id: 'doc-1' }],
      });

      expect(summary.sos_count_24h).toBe(1);
      expect(summary.open_absence_alerts_count).toBe(2);
      expect(summary.offline_delayed_devices_count).toBe(1);
      expect(summary.pending_stop_requests_count).toBe(1);
      expect(summary.late_or_cancelled_trips_count).toBe(1);
      expect(summary.expiring_documents_count).toBe(1);
      expect(summary.generated_at).toBeDefined();
    });
  });

  describe('AttendanceCsvExporter (Part 11.6, Part 13.16)', () => {
    const exporter = new AttendanceCsvExporter();

    it('exports attendance records and sanitizes formula injection characters (=, +, -, @)', () => {
      const records = [
        {
          student_name: 'Alice Kumar',
          roll_number: 'CS101',
          trip_type: 'MORNING',
          status: 'BOARDED',
          notes: '=SUM(1+1)', // Malicious formula starting with =
        },
        {
          student_name: '+919876543210', // Starts with +
          roll_number: '-102', // Starts with -
          trip_type: 'AFTERNOON',
          status: 'ABSENT',
          notes: '@cmd /c calc.exe', // Starts with @
        },
      ];

      const csv = exporter.generateCsv(records);

      // Verify header
      expect(csv).toContain('Student Name,Roll Number,Trip Type,Status,Notes');

      // Verify formula injection sanitization: each dangerous cell is escaped with leading quote
      expect(csv).toContain("'''=SUM(1+1)'");
      expect(csv).toContain("'''+919876543210'");
      expect(csv).toContain("'''-102'");
      expect(csv).toContain("'''@cmd /c calc.exe'");
    });

    it('enforces row limit of 100,000 per export', () => {
      expect(() => {
        exporter.validateExportLimits(100001);
      }).toThrow('Export exceeds maximum allowed limit of 100,000 rows');

      expect(() => {
        exporter.validateExportLimits(50000);
      }).not.toThrow();
    });
  });
});
