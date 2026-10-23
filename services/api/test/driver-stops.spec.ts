import { describe, it, expect, beforeEach } from 'vitest';
import { DriverService } from '../src/modules/driver/driver.service.js';
import { ShiftService } from '../src/modules/shift/shift.service.js';
import { SosService } from '../src/modules/driver/sos.service.js';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('Driver Manual Stop Arrival & Skipped Stops Pipeline (P3-T15, Part 9.9, T-SHF-03)', () => {
  let driverService: DriverService;
  let shiftService: ShiftService;
  let sosService: SosService;

  beforeEach(() => {
    shiftService = new ShiftService();
    sosService = new SosService();
    driverService = new DriverService(shiftService, sosService);

    ['drv_stops_1', 'drv_stops_2', 'drv_stops_3', 'drv_stops_4'].forEach((drvId, idx) => {
      shiftService.addRosterEntry({
        id: `roster_${idx + 1}`,
        driver_id: drvId,
        bus_id:
          idx === 0
            ? 'bus_stops'
            : idx === 1
              ? 'bus_stops_2'
              : idx === 2
                ? 'bus_stops_3'
                : 'bus_stops_4',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      });
    });
  });

  it('marks stop as arrived manually and identifies skipped stops (T-SHF-03)', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');

    // 1. Driver starts shift
    const claim = await shiftService.startShift(
      'drv_stops_1',
      { bus_id: 'bus_stops', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    // 2. Initial stops retrieval
    const initialStops = driverService.getRouteStops('drv_stops_1', claim.shift_id);
    expect(initialStops.route_id).toBe('route_1');
    expect(initialStops.stops.length).toBeGreaterThanOrEqual(3);
    expect(initialStops.skipped_count).toBe(0);
    expect(['UPCOMING', 'ARRIVING']).toContain(initialStops.stops[0]!.status);
    expect(initialStops.stops[2]!.status).toBe('UPCOMING');

    // 3. Driver marks stop_2 as arrived manually (skipping stop_1)
    const arrivalTime = new Date('2026-10-22T08:20:00Z');
    const arrivalRes = driverService.recordManualStopArrival(
      'drv_stops_1',
      {
        shift_id: claim.shift_id,
        stop_id: 'stop_2',
        note: 'Direct arrival via express flyover',
      },
      arrivalTime,
    );

    expect(arrivalRes.stop_id).toBe('stop_2');
    expect(arrivalRes.status).toBe('ARRIVED');
    expect(arrivalRes.method).toBe('MANUAL');
    expect(arrivalRes.skipped_stops).toHaveLength(1);
    expect(arrivalRes.skipped_stops[0]!.stop_id).toBe('stop_1');

    // 4. Inspect route stops after manual arrival
    const updatedStops = driverService.getRouteStops('drv_stops_1', claim.shift_id);
    expect(updatedStops.skipped_count).toBe(1);

    const s1 = updatedStops.stops.find((s) => s.stop_id === 'stop_1')!;
    expect(s1.status).toBe('SKIPPED');

    const s2 = updatedStops.stops.find((s) => s.stop_id === 'stop_2')!;
    expect(s2.status).toBe('ARRIVED');
    expect(s2.arrival_method).toBe('MANUAL');

    const s3 = updatedStops.stops.find((s) => s.stop_id === 'stop_3')!;
    expect(s3.status).toBe('UPCOMING');
  });

  it('rejects manual stop arrival if shift is not active', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_stops_2',
      { bus_id: 'bus_stops_2', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    await shiftService.endShift('drv_stops_2', claim.shift_id, 'MANUAL');

    expect(() =>
      driverService.recordManualStopArrival('drv_stops_2', {
        shift_id: claim.shift_id,
        stop_id: 'stop_1',
      }),
    ).toThrowError(ForbiddenException);
  });

  it('rejects manual stop arrival if stop is not on route', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_stops_3',
      { bus_id: 'bus_stops_3', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    expect(() =>
      driverService.recordManualStopArrival('drv_stops_3', {
        shift_id: claim.shift_id,
        stop_id: 'non_existent_stop_999',
      }),
    ).toThrowError(BadRequestException);
  });

  it('rejects if shift belongs to a different driver', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_stops_4',
      { bus_id: 'bus_stops_4', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    expect(() =>
      driverService.recordManualStopArrival('drv_other', {
        shift_id: claim.shift_id,
        stop_id: 'stop_1',
      }),
    ).toThrowError(ForbiddenException);
  });
});
