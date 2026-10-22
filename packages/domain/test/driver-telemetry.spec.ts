import { describe, it, expect } from 'vitest';
import {
  validateShiftStart,
  validateDriverPhoneSample,
  calculateTripSummary,
  DriverRosterEntry,
  ShiftRecord,
  DriverPhoneSampleInput,
} from '../src/driver-telemetry.js';

describe('Driver Telemetry & Shift Start Preconditions (Part 5.3 & 6.7)', () => {
  const baseTime = new Date('2026-10-21T08:00:00Z');

  describe('validateShiftStart', () => {
    const validRoster: DriverRosterEntry[] = [
      {
        id: 'roster_1',
        driver_id: 'driver_01',
        bus_id: 'bus_07',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      },
    ];

    it('rejects shift start if driver is not rostered on the bus', () => {
      const res = validateShiftStart('driver_99', 'bus_07', validRoster, [], baseTime);
      expect(res.allowed).toBe(false);
      expect(res.code).toBe('NOT_ROSTERED');
    });

    it('rejects shift start if driver attempts to start shift on unrostered bus', () => {
      const res = validateShiftStart('driver_01', 'bus_42', validRoster, [], baseTime);
      expect(res.allowed).toBe(false);
      expect(res.code).toBe('NOT_ROSTERED');
    });

    it('rejects shift start if the bus already has an ACTIVE shift', () => {
      const existingShifts: ShiftRecord[] = [
        {
          id: 'shift_101',
          driver_id: 'driver_99',
          bus_id: 'bus_07',
          route_id: 'route_1',
          trip_id: 'trip_1',
          status: 'ACTIVE',
          started_at: new Date('2026-10-21T07:30:00Z'),
          ended_at: null,
        },
      ];

      const res = validateShiftStart('driver_01', 'bus_07', validRoster, existingShifts, baseTime);
      expect(res.allowed).toBe(false);
      expect(res.code).toBe('BUS_SHIFT_ALREADY_ACTIVE');
    });

    it('rejects shift start if driver is already on another ACTIVE shift', () => {
      const existingShifts: ShiftRecord[] = [
        {
          id: 'shift_102',
          driver_id: 'driver_01',
          bus_id: 'bus_08',
          route_id: 'route_2',
          trip_id: 'trip_2',
          status: 'ACTIVE',
          started_at: new Date('2026-10-21T07:30:00Z'),
          ended_at: null,
        },
      ];

      const res = validateShiftStart('driver_01', 'bus_07', validRoster, existingShifts, baseTime);
      expect(res.allowed).toBe(false);
      expect(res.code).toBe('DRIVER_ALREADY_ON_SHIFT');
    });

    it('allows shift start when driver is rostered and no active shifts exist for the bus or driver', () => {
      const res = validateShiftStart('driver_01', 'bus_07', validRoster, [], baseTime);
      expect(res.allowed).toBe(true);
    });
  });

  describe('validateDriverPhoneSample', () => {
    it('accepts valid phone GPS sample and converts m/s to km/h (* 3.6)', () => {
      const sample: DriverPhoneSampleInput = {
        seq: 1,
        recorded_at: baseTime.toISOString(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 12.5,
        speed_mps: 10.0, // 10 m/s = 36.0 km/h
        heading_deg: 180,
        provider: 'GPS',
        is_mock: false,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(true);
      expect(result.speed_kmh).toBe(36.0);
    });

    it('rejects Null Island coordinates (0, 0)', () => {
      const sample: DriverPhoneSampleInput = {
        seq: 2,
        recorded_at: baseTime.toISOString(),
        lat: 0,
        lng: 0,
        accuracy_m: 10,
        speed_mps: 5,
        heading_deg: 0,
        provider: 'GPS',
        is_mock: false,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('NULL_ISLAND');
    });

    it('rejects low accuracy samples (> 50m)', () => {
      const sample: DriverPhoneSampleInput = {
        seq: 3,
        recorded_at: baseTime.toISOString(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 65, // > 50m
        speed_mps: 5,
        heading_deg: 0,
        provider: 'GPS',
        is_mock: false,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('ACCURACY_TOO_LOW');
    });

    it('rejects NETWORK cellular provider samples', () => {
      const sample: DriverPhoneSampleInput = {
        seq: 4,
        recorded_at: baseTime.toISOString(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 20,
        speed_mps: 5,
        heading_deg: 0,
        provider: 'NETWORK',
        is_mock: false,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('NETWORK_PROVIDER');
    });

    it('rejects mock location samples (is_mock: true)', () => {
      const sample: DriverPhoneSampleInput = {
        seq: 5,
        recorded_at: baseTime.toISOString(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 10,
        speed_mps: 5,
        heading_deg: 0,
        provider: 'GPS',
        is_mock: true,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('MOCK_LOCATION');
    });

    it('rejects future timestamps (> 60s in the future)', () => {
      const futureTime = new Date(baseTime.getTime() + 90 * 1000);
      const sample: DriverPhoneSampleInput = {
        seq: 6,
        recorded_at: futureTime.toISOString(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 10,
        speed_mps: 5,
        heading_deg: 0,
        provider: 'GPS',
        is_mock: false,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('FUTURE_TIMESTAMP');
    });

    it('rejects stale timestamps (> 7 days old)', () => {
      const staleTime = new Date(baseTime.getTime() - 8 * 86400 * 1000);
      const sample: DriverPhoneSampleInput = {
        seq: 7,
        recorded_at: staleTime.toISOString(),
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 10,
        speed_mps: 5,
        heading_deg: 0,
        provider: 'GPS',
        is_mock: false,
      };

      const result = validateDriverPhoneSample(sample, baseTime);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('STALE_TIMESTAMP');
    });
  });

  describe('Driver Trip Summary Calculations (P3-T17, Part 20.9 fields)', () => {
    it('calculates duration, distance, avg speed, uptime breakdown, and failovers', () => {
      const startTime = new Date('2026-10-22T08:00:00Z');
      const endTime = new Date('2026-10-22T09:00:00Z'); // 3600s = 1 hour

      // 3 samples spanning 1 hour:
      // sample 1: 08:00:00, (13.0800, 80.2000), speed 30, HW
      // sample 2: 08:30:00, (13.0800, 80.2500) (~5.4 km), speed 40, HW
      // sample 3: 09:00:00, (13.0800, 80.3000) (~5.4 km), speed 35, PHONE
      const samples = [
        {
          lat: 13.08,
          lng: 80.2,
          speed_kmh: 30,
          recorded_at: startTime,
          source: 'HW' as const,
        },
        {
          lat: 13.08,
          lng: 80.25,
          speed_kmh: 40,
          recorded_at: new Date('2026-10-22T08:30:00Z'),
          source: 'HW' as const,
        },
        {
          lat: 13.08,
          lng: 80.3,
          speed_kmh: 35,
          recorded_at: endTime,
          source: 'PHONE' as const,
        },
      ];

      const summary = calculateTripSummary({
        shiftId: 'shift_99',
        tripId: 'trip_99',
        busId: 'bus_07',
        driverId: 'drv_101',
        routeId: 'route_1',
        tripType: 'MORNING',
        startedAt: startTime,
        endedAt: endTime,
        samples,
        totalBoardings: 32,
        failoverCount: 1,
        endReason: 'MANUAL',
      });

      // Part 20.9 fields
      expect(summary.shift_id).toBe('shift_99');
      expect(summary.trip_id).toBe('trip_99');
      expect(summary.bus_id).toBe('bus_07');
      expect(summary.driver_id).toBe('drv_101');
      expect(summary.route_id).toBe('route_1');
      expect(summary.trip_type).toBe('MORNING');
      expect(summary.started_at).toBe(startTime.toISOString());
      expect(summary.ended_at).toBe(endTime.toISOString());
      expect(summary.duration_seconds).toBe(3600);
      expect(summary.distance_km).toBeGreaterThan(10); // ~10.8 km
      expect(summary.average_speed_kmh).toBe(35); // (30 + 40 + 35) / 3 = 35
      expect(summary.total_boardings).toBe(32);
      expect(summary.failover_count).toBe(1);
      expect(summary.end_reason).toBe('MANUAL');

      // Uptime breakdown: 1800s HW (50%), 1800s PHONE (50%)
      expect(summary.tracking_source_uptime.hw_seconds).toBe(1800);
      expect(summary.tracking_source_uptime.phone_seconds).toBe(1800);
      expect(summary.tracking_source_uptime.hw_percentage).toBe(50);
      expect(summary.tracking_source_uptime.phone_percentage).toBe(50);
    });
  });
});
