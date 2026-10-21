import { describe, it, expect } from 'vitest';
import {
  haversineDistanceMeters,
  roundCoordinate,
  validateCoordinates,
  knotsToKmh,
  mpsToKmh,
  kmhToMps,
  isHardwareFixValid,
  isPhoneFixValid,
  isSourceFresh,
  evaluateJumpCheck,
  evaluateFrozenPosition,
  evaluateSourceDisagreement,
  TimedLocation,
} from '../src/gps-quality.js';

describe('GPS Quality & Coordinate Plausibility Rules (Part 9.1, 9.2, 9.14)', () => {
  const baseTime = new Date('2026-10-21T09:00:00Z');

  describe('Haversine Distance & Coordinate Utilities (Part 9.2)', () => {
    it('computes distance between known coordinates accurately', () => {
      // Distance between Bangalore MG Road and Vidhana Soudha (~970m)
      const p1 = { lat: 12.9716, lng: 77.5946 };
      const p2 = { lat: 12.9796, lng: 77.5907 };
      const dist = haversineDistanceMeters(p1, p2);
      expect(dist).toBeGreaterThan(950);
      expect(dist).toBeLessThan(1000);

      // Distance to itself is 0
      expect(haversineDistanceMeters(p1, p1)).toBe(0);
    });

    it('rounds coordinates to 6 decimal places (~0.1m precision)', () => {
      expect(roundCoordinate(12.34567891)).toBe(12.345679);
      expect(roundCoordinate(77.12345612)).toBe(77.123456);
    });

    it('validates coordinates and rejects Null Island and out of range', () => {
      expect(validateCoordinates(12.9716, 77.5946)).toEqual({ valid: true });
      expect(validateCoordinates(0, 0)).toEqual({ valid: false, reason: 'NULL_ISLAND' });
      expect(validateCoordinates(95.0, 77.5946)).toEqual({ valid: false, reason: 'OUT_OF_RANGE' });
      expect(validateCoordinates(12.9716, -185.0)).toEqual({
        valid: false,
        reason: 'OUT_OF_RANGE',
      });
    });

    it('converts units correctly per Part 9.2', () => {
      expect(knotsToKmh(10)).toBe(18.5);
      expect(mpsToKmh(10)).toBe(36.0);
      expect(kmhToMps(36)).toBe(10.0);
    });
  });

  describe('Fix Validity & Source Freshness (Part 9.1)', () => {
    it('validates hardware tracker fixes', () => {
      expect(
        isHardwareFixValid({
          gps_valid: true,
          satellites: 8,
          hdop: 1.2,
          isBuffered: false,
        }),
      ).toBe(true);

      // Invalid when gps_valid is false
      expect(
        isHardwareFixValid({
          gps_valid: false,
          satellites: 8,
          hdop: 1.2,
        }),
      ).toBe(false);

      // Invalid when satellites < 4
      expect(
        isHardwareFixValid({
          gps_valid: true,
          satellites: 3,
          hdop: 1.2,
        }),
      ).toBe(false);

      // Invalid when hdop > 5.0
      expect(
        isHardwareFixValid({
          gps_valid: true,
          satellites: 8,
          hdop: 5.5,
        }),
      ).toBe(false);

      // Invalid for live state when sample is buffered
      expect(
        isHardwareFixValid({
          gps_valid: true,
          satellites: 8,
          hdop: 1.2,
          isBuffered: true,
        }),
      ).toBe(false);
    });

    it('validates phone backup fixes', () => {
      expect(
        isPhoneFixValid({
          accuracy_m: 15,
          provider: 'GPS',
          is_mock: false,
        }),
      ).toBe(true);

      // Accuracy > 50m rejected
      expect(
        isPhoneFixValid({
          accuracy_m: 55,
          provider: 'GPS',
          is_mock: false,
        }),
      ).toBe(false);

      // NETWORK provider rejected
      expect(
        isPhoneFixValid({
          accuracy_m: 20,
          provider: 'NETWORK',
          is_mock: false,
        }),
      ).toBe(false);

      // Mock locations rejected
      expect(
        isPhoneFixValid({
          accuracy_m: 10,
          provider: 'GPS',
          is_mock: true,
        }),
      ).toBe(false);
    });

    it('checks source freshness within 60 seconds (Part 9.1)', () => {
      const freshFix = new Date(baseTime.getTime() - 45 * 1000); // 45s ago
      expect(isSourceFresh(freshFix, baseTime)).toBe(true);

      const staleFix = new Date(baseTime.getTime() - 75 * 1000); // 75s ago
      expect(isSourceFresh(staleFix, baseTime)).toBe(false);

      expect(isSourceFresh(null, baseTime)).toBe(false);
    });
  });

  describe('Kinematic Plausibility Jump Check (Part 9.14)', () => {
    it('accepts reasonable movement and calculates implied speed', () => {
      // 10 seconds elapsed, 200m moved = 20 m/s = 72 km/h
      const prev: TimedLocation = {
        lat: 12.9716,
        lng: 77.5946,
        recorded_at: baseTime,
      };
      const curr: TimedLocation = {
        lat: 12.9734, // ~200m north
        lng: 77.5946,
        recorded_at: new Date(baseTime.getTime() + 10 * 1000),
      };

      const res = evaluateJumpCheck(prev, curr, 150, 30);
      expect(res.isJump).toBe(false);
      expect(res.impliedSpeedKmh).toBeGreaterThan(65);
      expect(res.impliedSpeedKmh).toBeLessThan(80);
      expect(res.referenceReset).toBe(false);
    });

    it('flags implausible jump when implied speed exceeds 150 km/h', () => {
      // 10 seconds elapsed, 1000m moved = 100 m/s = 360 km/h
      const prev: TimedLocation = {
        lat: 12.9716,
        lng: 77.5946,
        recorded_at: baseTime,
      };
      const curr: TimedLocation = {
        lat: 12.9806, // ~1000m north
        lng: 77.5946,
        recorded_at: new Date(baseTime.getTime() + 10 * 1000),
      };

      const res = evaluateJumpCheck(prev, curr, 150, 30);
      expect(res.isJump).toBe(true);
      expect(res.impliedSpeedKmh).toBeGreaterThan(300);
    });

    it('resets reference point when time gap exceeds 30 minutes', () => {
      const prev: TimedLocation = {
        lat: 12.9716,
        lng: 77.5946,
        recorded_at: baseTime,
      };
      // 35 minutes elapsed
      const curr: TimedLocation = {
        lat: 13.0827,
        lng: 80.2707,
        recorded_at: new Date(baseTime.getTime() + 35 * 60 * 1000),
      };

      const res = evaluateJumpCheck(prev, curr, 150, 30);
      expect(res.isJump).toBe(false);
      expect(res.referenceReset).toBe(true);
    });
  });

  describe('Frozen Position Detection (Part 9.14)', () => {
    it('detects frozen position when speed > 5 km/h claimed for 5m with < 10m movement', () => {
      // 6 samples over 320 seconds claiming 25 km/h while coords barely shift (1-2m)
      const samples: TimedLocation[] = [
        { lat: 12.9716, lng: 77.5946, recorded_at: baseTime, speed_kmh: 25 },
        {
          lat: 12.971601,
          lng: 77.5946,
          recorded_at: new Date(baseTime.getTime() + 60 * 1000),
          speed_kmh: 25,
        },
        {
          lat: 12.971602,
          lng: 77.5946,
          recorded_at: new Date(baseTime.getTime() + 120 * 1000),
          speed_kmh: 25,
        },
        {
          lat: 12.9716,
          lng: 77.594601,
          recorded_at: new Date(baseTime.getTime() + 180 * 1000),
          speed_kmh: 25,
        },
        {
          lat: 12.971601,
          lng: 77.5946,
          recorded_at: new Date(baseTime.getTime() + 240 * 1000),
          speed_kmh: 25,
        },
        {
          lat: 12.971601,
          lng: 77.594601,
          recorded_at: new Date(baseTime.getTime() + 320 * 1000),
          speed_kmh: 25,
        },
      ];

      expect(evaluateFrozenPosition({ samples })).toBe(true);
    });

    it('does not flag frozen position when vehicle is genuinely moving', () => {
      const samples: TimedLocation[] = [
        { lat: 12.9716, lng: 77.5946, recorded_at: baseTime, speed_kmh: 25 },
        {
          lat: 12.974,
          lng: 77.596,
          recorded_at: new Date(baseTime.getTime() + 320 * 1000),
          speed_kmh: 25,
        },
      ];

      expect(evaluateFrozenPosition({ samples })).toBe(false);
    });
  });

  describe('Source Disagreement Detection (Part 9.14)', () => {
    it('triggers possible tracker swap alert when distance > 500m for >= 2 minutes', () => {
      const hwPos = { lat: 12.9716, lng: 77.5946 };
      const phonePos = { lat: 12.978, lng: 77.5946 }; // ~710m away

      const res = evaluateSourceDisagreement(hwPos, phonePos, 130); // 130s >= 120s
      expect(res.isSwapAlert).toBe(true);
      expect(res.currentDistanceMeters).toBeGreaterThan(500);
    });

    it('logs source disagreement when distance > 300m for >= 10 minutes', () => {
      const hwPos = { lat: 12.9716, lng: 77.5946 };
      const phonePos = { lat: 12.975, lng: 77.5946 }; // ~377m away

      const res = evaluateSourceDisagreement(hwPos, phonePos, 650); // 650s >= 600s
      expect(res.isSwapAlert).toBe(false);
      expect(res.isLogged).toBe(true);
    });
  });
});
