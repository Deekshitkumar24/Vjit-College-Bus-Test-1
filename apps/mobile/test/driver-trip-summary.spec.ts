import { describe, it, expect, vi } from 'vitest';
import { TripSummaryManager } from '../src/driver/trip-summary-manager.js';
import { DriverTripSummaryDto } from '@collegebus/contracts';

describe('Driver Mobile Trip Summary Manager (P3-T17, Part 20.9 fields)', () => {
  const session = {
    driverId: 'drv_101',
    accessToken: 'test_token_123',
  };

  const mockSummary: DriverTripSummaryDto = {
    shift_id: 'shift_101',
    trip_id: 'trip_101',
    bus_id: 'bus_07',
    driver_id: 'drv_101',
    route_id: 'route_1',
    trip_type: 'MORNING',
    started_at: '2026-10-22T08:00:00.000Z',
    ended_at: '2026-10-22T08:45:00.000Z',
    duration_seconds: 2700,
    distance_km: 12.4,
    average_speed_kmh: 32.5,
    total_boardings: 28,
    tracking_source_uptime: {
      hw_seconds: 2000,
      phone_seconds: 700,
      hw_percentage: 74.1,
      phone_percentage: 25.9,
    },
    failover_count: 1,
    end_reason: 'MANUAL',
  };

  it('fetches and caches driver trip summary after shift end', async () => {
    const mockHttp = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSummary,
      }),
    };

    const manager = new TripSummaryManager('http://localhost:3000', mockHttp);

    expect(manager.getCachedSummary()).toBeNull();

    const summary = await manager.fetchTripSummary(session, 'shift_101');
    expect(summary.shift_id).toBe('shift_101');
    expect(summary.total_boardings).toBe(28);
    expect(summary.distance_km).toBe(12.4);
    expect(summary.duration_seconds).toBe(2700);
    expect(summary.average_speed_kmh).toBe(32.5);
    expect(summary.tracking_source_uptime.hw_percentage).toBe(74.1);

    expect(manager.getCachedSummary()).toEqual(mockSummary);
  });

  it('handles fetch failure and preserves null cached summary', async () => {
    const mockHttp = {
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Shift not found' }),
      }),
    };

    const manager = new TripSummaryManager('http://localhost:3000', mockHttp);
    await expect(manager.fetchTripSummary(session, 'non_existent_shift')).rejects.toThrowError(
      'Shift not found',
    );
    expect(manager.getCachedSummary()).toBeNull();
  });
});
