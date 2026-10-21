import { describe, it, expect } from 'vitest';
import {
  projectPointOntoPolyline,
  calculateSmoothedSpeedKmh,
  calculateEtaSeconds,
  evaluateStopStatus,
  buildPostgisRouteProgressQuery,
} from '../src/eta-stop-arrival.js';
import { LatLng } from '../src/gps-quality.js';

describe('ETA & Stop Arrival Engine (P1-T9, Part 9.9 & 9.11)', () => {
  // Define a sample straight route along latitude 13.0800:
  // p0: (13.0800, 80.2000) -> p1: (13.0800, 80.2100) -> p2: (13.0800, 80.2200)
  const routeLine: LatLng[] = [
    { lat: 13.08, lng: 80.2 },
    { lat: 13.08, lng: 80.21 },
    { lat: 13.08, lng: 80.22 },
  ];

  describe('Route Geometry Projection & Off-Route Detection (Part 9.9)', () => {
    it('projects point directly on route with near-zero cross-track distance', () => {
      // Point midway between p0 and p1
      const busOnRoute: LatLng = { lat: 13.08, lng: 80.205 };
      const proj = projectPointOntoPolyline(busOnRoute, routeLine, 300);

      expect(proj.isOffRoute).toBe(false);
      expect(proj.crossTrackDistanceM).toBeLessThan(5);
      expect(proj.distanceAlongRouteM).toBeGreaterThan(500);
      expect(proj.fractionAlongRoute).toBeGreaterThan(0.2);
      expect(proj.fractionAlongRoute).toBeLessThan(0.3);
    });

    it('detects off-route when bus is > 300m away from route corridor', () => {
      // Point 0.005 degrees latitude away (~550m)
      const busOffRoute: LatLng = { lat: 13.085, lng: 80.205 };
      const proj = projectPointOntoPolyline(busOffRoute, routeLine, 300);

      expect(proj.isOffRoute).toBe(true);
      expect(proj.crossTrackDistanceM).toBeGreaterThan(300);
    });

    it('remains on-route when bus is within 300m corridor', () => {
      // Point 0.001 degrees latitude away (~110m)
      const busInCorridor: LatLng = { lat: 13.081, lng: 80.205 };
      const proj = projectPointOntoPolyline(busInCorridor, routeLine, 300);

      expect(proj.isOffRoute).toBe(false);
      expect(proj.crossTrackDistanceM).toBeLessThan(300);
    });
  });

  describe('Speed Smoothing & Median Window Clamping (Part 9.11)', () => {
    it('filters stationary speeds <= 3 km/h and calculates median', () => {
      // Speeds: [0, 2, 25, 30, 35] -> moving: [25, 30, 35] -> median: 30
      const speeds = [0, 2, 25, 30, 35];
      expect(calculateSmoothedSpeedKmh(speeds)).toBe(30);
    });

    it('uses fallback speed 20 km/h when all speeds are stationary', () => {
      const speeds = [0, 1.5, 2.0, 0];
      expect(calculateSmoothedSpeedKmh(speeds)).toBe(20);
    });

    it('clamps speed below minimum to 10 km/h', () => {
      // Moving speeds: [4, 5, 6] -> median 5 -> clamped to min 10
      const speeds = [4, 5, 6];
      expect(calculateSmoothedSpeedKmh(speeds)).toBe(10);
    });

    it('clamps speed above maximum to 60 km/h', () => {
      // Moving speeds: [70, 75, 80] -> median 75 -> clamped to max 60
      const speeds = [70, 75, 80];
      expect(calculateSmoothedSpeedKmh(speeds)).toBe(60);
    });
  });

  describe('ETA Calculation & Arriving Threshold (Part 9.11)', () => {
    it('returns Arriving label when ETA is under 60 seconds', () => {
      // 100 meters at 30 km/h (8.33 m/s) = 12 seconds
      const eta = calculateEtaSeconds(100, 30);
      expect(eta).toBeDefined();
      expect(eta?.isArriving).toBe(true);
      expect(eta?.label).toBe('Arriving');
      expect(eta?.etaSeconds).toBe(12);
    });

    it('returns minutes label when ETA is 60 seconds or more', () => {
      // 2500 meters at 30 km/h (8.33 m/s) = 300 seconds (5 min)
      const eta = calculateEtaSeconds(2500, 30);
      expect(eta).toBeDefined();
      expect(eta?.isArriving).toBe(false);
      expect(eta?.label).toBe('5 mins');
      expect(eta?.etaSeconds).toBe(300);
    });

    it('returns Arriving for zero remaining distance', () => {
      const eta = calculateEtaSeconds(0, 30);
      expect(eta?.isArriving).toBe(true);
      expect(eta?.label).toBe('Arriving');
      expect(eta?.etaSeconds).toBe(0);
    });
  });

  describe('Stop Arrival, Dwell, and Departure States (Part 9.9 & SW-MVP §17.4)', () => {
    const stopLocation: LatLng = { lat: 13.08, lng: 80.21 }; // at p1
    const stopProgressM = 1085; // ~1085m along route

    it('returns UPCOMING when bus is upstream and ETA > 60s', () => {
      const busLocation: LatLng = { lat: 13.08, lng: 80.2 }; // at p0
      const busProgressM = 0;

      const res = evaluateStopStatus({
        busLocation,
        busSpeedKmh: 25,
        busProgressAlongRouteM: busProgressM,
        stopLocation,
        stopProgressAlongRouteM: stopProgressM,
        smoothedSpeedKmh: 25,
      });

      expect(res.status).toBe('UPCOMING');
      expect(res.isInsideRadius).toBe(false);
      expect(res.etaSeconds).toBeGreaterThan(60);
    });

    it('returns ARRIVING when bus is upstream and ETA < 60s', () => {
      // Bus 200m away at 25 km/h (~29s ETA)
      const busLocation: LatLng = { lat: 13.08, lng: 80.208 };
      const busProgressM = 885;

      const res = evaluateStopStatus({
        busLocation,
        busSpeedKmh: 25,
        busProgressAlongRouteM: busProgressM,
        stopLocation,
        stopProgressAlongRouteM: stopProgressM,
        smoothedSpeedKmh: 25,
      });

      expect(res.status).toBe('ARRIVING');
      expect(res.etaLabel).toBe('Arriving');
      expect(res.etaSeconds).toBeLessThan(60);
    });

    it('returns ARRIVING when inside 50m radius but dwell time < 15s', () => {
      // Bus 20m from stop
      const busLocation: LatLng = { lat: 13.08, lng: 80.2098 };
      const busProgressM = 1065;

      const res = evaluateStopStatus({
        busLocation,
        busSpeedKmh: 3, // speed < 5 km/h
        busProgressAlongRouteM: busProgressM,
        stopLocation,
        stopProgressAlongRouteM: stopProgressM,
        dwellInsideSeconds: 10, // only 10s (needs 15s)
      });

      expect(res.status).toBe('ARRIVING');
      expect(res.isInsideRadius).toBe(true);
    });

    it('returns ARRIVED when inside 50m radius at speed < 5 km/h for >= 15 seconds', () => {
      const busLocation: LatLng = { lat: 13.08, lng: 80.2098 };
      const busProgressM = 1065;

      const res = evaluateStopStatus({
        busLocation,
        busSpeedKmh: 2, // speed < 5 km/h
        busProgressAlongRouteM: busProgressM,
        stopLocation,
        stopProgressAlongRouteM: stopProgressM,
        dwellInsideSeconds: 16, // >= 15s dwell satisfied!
      });

      expect(res.status).toBe('ARRIVED');
      expect(res.isInsideRadius).toBe(true);
      expect(res.etaLabel).toBe('At stop');
    });

    it('returns DEPARTED when bus has moved > 50m past stop along route', () => {
      // Bus 100m ahead of stop along route
      const busLocation: LatLng = { lat: 13.08, lng: 80.211 };
      const busProgressM = 1185; // 100m ahead of 1085m

      const res = evaluateStopStatus({
        busLocation,
        busSpeedKmh: 28,
        busProgressAlongRouteM: busProgressM,
        stopLocation,
        stopProgressAlongRouteM: stopProgressM,
      });

      expect(res.status).toBe('DEPARTED');
      expect(res.isInsideRadius).toBe(false);
      expect(res.etaLabel).toBe('Passed');
    });

    it('returns DEPARTED when bus moves outside stop radius with speed > 10 km/h after being arrived', () => {
      const busLocation: LatLng = { lat: 13.08, lng: 80.2106 }; // 65m away
      const busProgressM = 1100;

      const res = evaluateStopStatus({
        busLocation,
        busSpeedKmh: 18, // > 10 km/h departure speed
        busProgressAlongRouteM: busProgressM,
        stopLocation,
        stopProgressAlongRouteM: stopProgressM,
        dwellOutsideSeconds: 5,
      });

      expect(res.status).toBe('DEPARTED');
    });
  });

  describe('PostGIS Query Generation (Part 9.9)', () => {
    it('generates PostGIS query containing ST_LineLocatePoint and distance calculations', () => {
      const sql = buildPostgisRouteProgressQuery();
      expect(sql).toContain('ST_LineLocatePoint');
      expect(sql).toContain('ST_Distance');
      expect(sql).toContain('ST_Length');
      expect(sql).toContain('ST_LineSubstring');
      expect(sql).toContain('route_geometries');
    });
  });
});
