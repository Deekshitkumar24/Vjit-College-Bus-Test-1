import { describe, it, expect, beforeEach } from 'vitest';
import { DriverService } from '../src/modules/driver/driver.service.js';
import { ShiftService } from '../src/modules/shift/shift.service.js';
import { SosService } from '../src/modules/driver/sos.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Driver Trip Summary Pipeline (P3-T17, Part 20.9 fields)', () => {
  let driverService: DriverService;
  let shiftService: ShiftService;
  let sosService: SosService;

  beforeEach(() => {
    shiftService = new ShiftService();
    sosService = new SosService();
    driverService = new DriverService(shiftService, sosService);

    shiftService.addRosterEntry({
      id: 'roster_summary_1',
      driver_id: 'drv_sum_1',
      bus_id: 'bus_sum_1',
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: new Date('2026-11-01T00:00:00Z'),
    });
  });

  it('generates trip summary with all Part 20.9 fields after shift ends', async () => {
    const startTime = new Date('2026-10-22T08:00:00Z');

    // 1. Start shift
    const claim = await shiftService.startShift(
      'drv_sum_1',
      { bus_id: 'bus_sum_1', route_id: 'route_1', trip_type: 'MORNING' },
      startTime,
    );

    // 2. Ingest phone locations along route
    driverService.ingestLocations('drv_sum_1', {
      shift_id: claim.shift_id,
      app_version: '1.0.0',
      device_model: 'Pixel 8',
      samples: [
        {
          seq: 1,
          recorded_at: new Date('2026-10-22T08:10:00Z').toISOString(),
          lat: 13.08,
          lng: 80.2,
          accuracy_m: 10,
          speed_mps: 8.33, // 30 km/h
          heading_deg: 90,
          provider: 'GPS',
          is_mock: false,
        },
        {
          seq: 2,
          recorded_at: new Date('2026-10-22T08:30:00Z').toISOString(),
          lat: 13.08,
          lng: 80.25, // ~5.4 km
          accuracy_m: 10,
          speed_mps: 11.11, // 40 km/h
          heading_deg: 90,
          provider: 'GPS',
          is_mock: false,
        },
      ],
    });

    // 3. Record passenger boardings
    driverService.recordManualCheckin(
      'drv_sum_1',
      {
        trip_id: claim.trip_id,
        student_id: 'stu_101',
        is_guest: false,
        reason: 'FORGOT_PASS',
      },
      new Date('2026-10-22T08:15:00Z'),
    );

    driverService.recordManualCheckin(
      'drv_sum_1',
      {
        trip_id: claim.trip_id,
        student_id: 'stu_102',
        is_guest: true,
        reason: 'GUEST_STUDENT',
      },
      new Date('2026-10-22T08:20:00Z'),
    );

    // 4. End shift at 08:45:00
    const endTime = new Date('2026-10-22T08:45:00Z');
    await shiftService.endShift('drv_sum_1', claim.shift_id, 'MANUAL', endTime);

    // 5. Query trip summary
    const summary = driverService.getTripSummary('drv_sum_1', claim.shift_id);

    // Verify all Part 20.9 fields
    expect(summary.shift_id).toBe(claim.shift_id);
    expect(summary.trip_id).toBe(claim.trip_id);
    expect(summary.bus_id).toBe('bus_sum_1');
    expect(summary.driver_id).toBe('drv_sum_1');
    expect(summary.route_id).toBe('route_1');
    expect(summary.trip_type).toBe('MORNING');
    expect(summary.started_at).toBe(startTime.toISOString());
    expect(summary.ended_at).toBe(endTime.toISOString());
    expect(summary.duration_seconds).toBe(2700); // 45 minutes = 2700s
    expect(summary.distance_km).toBeGreaterThan(4);
    expect(summary.average_speed_kmh).toBeGreaterThan(25);
    expect(summary.total_boardings).toBe(2);
    expect(summary.tracking_source_uptime).toBeDefined();
    expect(summary.failover_count).toBeGreaterThanOrEqual(0);
    expect(summary.end_reason).toBe('MANUAL');
  });

  it('rejects trip summary retrieval if shift belongs to a different driver', async () => {
    const startTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_sum_1',
      { bus_id: 'bus_sum_1', route_id: 'route_1', trip_type: 'MORNING' },
      startTime,
    );
    await shiftService.endShift('drv_sum_1', claim.shift_id, 'MANUAL');

    expect(() => driverService.getTripSummary('drv_other', claim.shift_id)).toThrowError(
      ForbiddenException,
    );
  });
});
