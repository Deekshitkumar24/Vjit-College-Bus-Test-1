import { describe, expect, it } from 'vitest';
import { BusSnapshot } from '@collegebus/contracts';
import { LatLng } from '@collegebus/domain';
import { buildStopTimeline, RouteStop } from '../src/eta/stop-progress-card.js';
import { evaluateOffRouteStatus, CORRIDOR_THRESHOLD_METERS } from '../src/eta/off-route-banner.js';
import { computeCountdownState, formatCountdownLabel } from '../src/eta/eta-countdown.js';

describe('P2-T3: Stop Arrival & ETA Card Suite', () => {
  const baseBusSnapshot: BusSnapshot = {
    bus_id: 'bus-01',
    bus_number: 'KA-01-F-1234',
    trip_id: 'trip-morning-1',
    active_source: 'HW',
    state: 'LIVE',
    lat: 12.9716,
    lng: 77.5946,
    speed_kmh: 30.0,
    heading_deg: 90.0,
    source_label: 'Hardware GNSS',
    data_age_s: 3,
    eta_seconds: 300,
    eta_label: '5 min',
    updated_at: '2026-10-21T10:00:00Z',
  };

  const sampleStops: RouteStop[] = [
    {
      id: 'stop-1',
      name: 'College Campus Gate 1',
      sequence: 1,
      location: { lat: 12.97, lng: 77.59 },
    },
    {
      id: 'stop-2',
      name: 'Indiranagar Metro Station',
      sequence: 2,
      location: { lat: 12.9716, lng: 77.5946 }, // Bus is exactly here
    },
    {
      id: 'stop-3',
      name: 'Domlur Flyover',
      sequence: 3,
      location: { lat: 12.96, lng: 77.64 },
    },
  ];

  describe('Stop Timeline & Route Progress Evaluation', () => {
    it('returns empty summary when route has no stops', () => {
      const { items, summary } = buildStopTimeline([], baseBusSnapshot);
      expect(items).toHaveLength(0);
      expect(summary.totalStopsCount).toBe(0);
      expect(summary.fractionCompleted).toBe(0);
    });

    it('identifies ARRIVED stop when bus is within 50m radius', () => {
      const { items, summary } = buildStopTimeline(sampleStops, baseBusSnapshot, 'stop-2');

      expect(items).toHaveLength(3);
      // Stop 1 was passed
      expect(items[0]!.stopId).toBe('stop-1');
      expect(items[0]!.status).toBe('PASSED');
      expect(items[0]!.badgeTone).toBe('GRAY');

      // Stop 2 is arrived (bus location matches exactly)
      expect(items[1]!.stopId).toBe('stop-2');
      expect(items[1]!.status).toBe('ARRIVED');
      expect(items[1]!.badgeTone).toBe('GREEN');
      expect(items[1]!.isTargetStop).toBe(true);
      expect(items[1]!.etaLabel).toBe('Arrived');

      // Stop 3 is upcoming
      expect(items[2]!.stopId).toBe('stop-3');
      expect(items[2]!.status).toBe('UPCOMING');
      expect(items[2]!.isTargetStop).toBe(false);

      expect(summary.completedStopsCount).toBe(1);
      expect(summary.fractionCompleted).toBe(0.5);
      expect(summary.targetStopName).toBe('Indiranagar Metro Station');
      expect(summary.targetStopEtaLabel).toBe('Arrived');
    });

    it('identifies ARRIVING stop when bus is within 300m approach corridor', () => {
      const approachingBus: BusSnapshot = {
        ...baseBusSnapshot,
        // Approximate 200m away from stop 2
        lat: 12.972,
        lng: 77.593,
      };

      const { items } = buildStopTimeline(sampleStops, approachingBus);
      const stop2 = items.find((s) => s.stopId === 'stop-2');
      expect(stop2).toBeDefined();
      expect(stop2!.status).toBe('ARRIVING');
      expect(stop2!.badgeTone).toBe('BLUE');
    });
  });

  describe('Off-Route Corridor Evaluator (300m threshold)', () => {
    const routePolyline: LatLng[] = [
      { lat: 12.97, lng: 77.59 },
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.96, lng: 77.64 },
    ];

    it('reports On Route when bus is along the corridor', () => {
      const result = evaluateOffRouteStatus({ lat: 12.9716, lng: 77.5946 }, routePolyline);

      expect(result.isOffRoute).toBe(false);
      expect(result.bannerVisible).toBe(false);
      expect(result.tone).toBe('NORMAL');
      expect(result.crossTrackDistanceM).toBeLessThan(CORRIDOR_THRESHOLD_METERS);
    });

    it('reports Route Deviation when bus deviates > 300m from corridor', () => {
      // 12.9900 is ~2 km north of the corridor
      const offRouteBusLoc: LatLng = { lat: 12.99, lng: 77.5946 };
      const result = evaluateOffRouteStatus(offRouteBusLoc, routePolyline);

      expect(result.isOffRoute).toBe(true);
      expect(result.bannerVisible).toBe(true);
      expect(result.tone).toBe('CRITICAL');
      expect(result.crossTrackDistanceM).toBeGreaterThan(CORRIDOR_THRESHOLD_METERS);
      expect(result.bannerTitle).toContain('Route Deviation Detected');
      expect(result.bannerMessage).toContain('outside scheduled corridor');
    });

    it('safely handles null bus location or insufficient polyline coordinates', () => {
      const resultNull = evaluateOffRouteStatus(null, routePolyline);
      expect(resultNull.isOffRoute).toBe(false);
      expect(resultNull.bannerVisible).toBe(false);

      const resultShort = evaluateOffRouteStatus({ lat: 12.9716, lng: 77.5946 }, [
        { lat: 12.9716, lng: 77.5946 },
      ]);
      expect(resultShort.isOffRoute).toBe(false);
    });
  });

  describe('Live Countdown Formatting & Monotonic Timer', () => {
    it('formats countdown labels accurately for various intervals', () => {
      expect(formatCountdownLabel(0)).toBe('Arrived');
      expect(formatCountdownLabel(-5)).toBe('Arrived');
      expect(formatCountdownLabel(45)).toBe('Arriving now');
      expect(formatCountdownLabel(60)).toBe('Arriving now');
      expect(formatCountdownLabel(120)).toBe('2 min');
      expect(formatCountdownLabel(295)).toBe('5 min');
    });

    it('computes monotonic countdown state transitions correctly', () => {
      const initialSeconds = 180;

      // 60 seconds elapsed -> 120s remaining (2 min)
      const state1 = computeCountdownState(initialSeconds, 60);
      expect(state1.remainingSeconds).toBe(120);
      expect(state1.displayText).toBe('2 min');
      expect(state1.isArrived).toBe(false);
      expect(state1.isImminent).toBe(false);

      // 130 seconds elapsed -> 50s remaining (Arriving now)
      const state2 = computeCountdownState(initialSeconds, 130);
      expect(state2.remainingSeconds).toBe(50);
      expect(state2.displayText).toBe('Arriving now');
      expect(state2.isArrived).toBe(false);
      expect(state2.isImminent).toBe(true);

      // 200 seconds elapsed -> 0s remaining (Arrived)
      const state3 = computeCountdownState(initialSeconds, 200);
      expect(state3.remainingSeconds).toBe(0);
      expect(state3.displayText).toBe('Arrived');
      expect(state3.isArrived).toBe(true);
      expect(state3.isImminent).toBe(false);
    });
  });
});
