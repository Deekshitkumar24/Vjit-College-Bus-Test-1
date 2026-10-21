import { describe, it, expect, vi } from 'vitest';
import { DriverTicketManager, TicketApiCaller } from '../src/driver/index.js';
import {
  DriverProblemCategory,
  DriverProblemReportResponseDto,
} from '@collegebus/contracts';

describe('P3-T7: Report a Problem & Maintenance Ticketing', () => {
  const busId = 'bus_01';
  const shiftId = 'shift_20261021_01';

  describe('Validation & Priority Rules', () => {
    it('rejects reports with empty busId or missing category', () => {
      expect(
        DriverTicketManager.validateReport({
          busId: '',
          category: 'BUS_BREAKDOWN',
          note: 'Engine overheating on highway',
        }).valid,
      ).toBe(false);

      expect(
        DriverTicketManager.validateReport({
          busId,
          category: '' as unknown as DriverProblemCategory,
          note: 'Engine overheating on highway',
        }).valid,
      ).toBe(false);
    });

    it('rejects notes shorter than 5 characters or longer than 500 characters', () => {
      expect(
        DriverTicketManager.validateReport({
          busId,
          category: 'BUS_BREAKDOWN',
          note: 'bad',
        }).valid,
      ).toBe(false);

      expect(
        DriverTicketManager.validateReport({
          busId,
          category: 'BUS_BREAKDOWN',
          note: 'x'.repeat(501),
        }).valid,
      ).toBe(false);

      expect(
        DriverTicketManager.validateReport({
          busId,
          category: 'BUS_BREAKDOWN',
          note: 'Valid issue description',
        }).valid,
      ).toBe(true);
    });
  });

  describe('Submission & Offline Sync', () => {
    it('submits a breakdown report with HIGH priority and GPS location', async () => {
      const mockCaller: TicketApiCaller = vi.fn(async (dto) => {
        const res: DriverProblemReportResponseDto = {
          ticket_id: 'tkt_server_01',
          category: dto.category,
          priority: 'HIGH',
          status: 'OPEN',
          bus_id: dto.bus_id,
          driver_id: 'drv_01',
          reported_at: new Date(Date.UTC(2026, 9, 21, 8, 40, 0)).toISOString(),
          message: 'Maintenance ticket opened for BUS_BREAKDOWN (HIGH)',
        };
        return res;
      });

      const manager = new DriverTicketManager(mockCaller);
      const submissionDate = new Date(Date.UTC(2026, 9, 21, 8, 40, 0));

      const record = await manager.submitReport(
        {
          busId,
          shiftId,
          category: 'BUS_BREAKDOWN',
          note: 'Front right tyre puncture near Silk Board',
          location: {
            lat: 12.9172,
            lng: 77.6228,
            accuracy_m: 8.5,
          },
        },
        { isOnline: true, now: submissionDate },
      );

      expect(record.ticket_id).toBe('tkt_server_01');
      expect(record.category).toBe('BUS_BREAKDOWN');
      expect(record.priority).toBe('HIGH');
      expect(record.is_synced).toBe(true);
      expect(record.status).toBe('OPEN');
      expect(mockCaller).toHaveBeenCalledTimes(1);

      const history = manager.getTickets();
      expect(history.length).toBe(1);
      expect(history[0]?.ticket_id).toBe('tkt_server_01');
    });

    it('derives MEDIUM priority for tracker and phone problems', async () => {
      const mockCaller: TicketApiCaller = vi.fn(async (dto) => ({
        ticket_id: 'tkt_server_02',
        category: dto.category,
        priority: 'MEDIUM' as const,
        status: 'OPEN' as const,
        bus_id: dto.bus_id,
        driver_id: 'drv_01',
        reported_at: new Date(Date.UTC(2026, 9, 21, 8, 42, 0)).toISOString(),
        message: 'Ticket opened',
      }));

      const manager = new DriverTicketManager(mockCaller);
      const record = await manager.submitReport({
        busId,
        category: 'TRACKER_PROBLEM',
        note: 'Hardware device LED is blinking red with no satellite fix',
      });

      expect(record.priority).toBe('MEDIUM');
    });

    it('derives LOW priority for OTHER category', async () => {
      const mockCaller: TicketApiCaller = vi.fn(async (dto) => ({
        ticket_id: 'tkt_server_03',
        category: dto.category,
        priority: 'LOW' as const,
        status: 'OPEN' as const,
        bus_id: dto.bus_id,
        driver_id: 'drv_01',
        reported_at: new Date(Date.UTC(2026, 9, 21, 8, 43, 0)).toISOString(),
        message: 'Ticket opened',
      }));

      const manager = new DriverTicketManager(mockCaller);
      const record = await manager.submitReport({
        busId,
        category: 'OTHER',
        note: 'Road blocked due to tree fall, took alternate route',
      });

      expect(record.priority).toBe('LOW');
    });

    it('buffers reports when offline and synchronizes sequentially on reconnect', async () => {
      const manager = new DriverTicketManager();
      const offlineDate = new Date(Date.UTC(2026, 9, 21, 8, 45, 0));

      const record = await manager.submitReport(
        {
          busId,
          category: 'PHONE_PROBLEM',
          note: 'Battery overheating in dashboard mount',
        },
        { isOnline: false, now: offlineDate },
      );

      expect(record.is_synced).toBe(false);
      expect(record.ticket_id).toContain('offline_tkt_');
      expect(manager.getPendingCount()).toBe(1);

      // Reconnect and flush
      const mockCaller: TicketApiCaller = vi.fn(async (dto) => ({
        ticket_id: 'tkt_synced_99',
        category: dto.category,
        priority: 'MEDIUM' as const,
        status: 'OPEN' as const,
        bus_id: dto.bus_id,
        driver_id: 'drv_01',
        reported_at: new Date(Date.UTC(2026, 9, 21, 8, 46, 0)).toISOString(),
        message: 'Ticket synced',
      }));

      const flushResult = await manager.flushPending(mockCaller);
      expect(flushResult.synced).toBe(1);
      expect(flushResult.failed).toBe(0);
      expect(manager.getPendingCount()).toBe(0);

      const updatedRecord = manager.getTickets()[0];
      expect(updatedRecord?.is_synced).toBe(true);
      expect(updatedRecord?.ticket_id).toBe('tkt_synced_99');
    });
  });
});
