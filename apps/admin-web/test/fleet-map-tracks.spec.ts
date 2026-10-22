import { describe, it, expect } from 'vitest';
import {
  FleetMapManager,
  DualTrackAnalyzer,
} from '../src/fleet/fleet-map-manager';

describe('P4-T6: Live Fleet Map, Source-Switch Log & Dual Track (Part 16, Part 21)', () => {
  describe('Live Fleet Map Overview', () => {
    it('aggregates live bus states, calculates sample age, and indicates active tracking source', () => {
      const fleetManager = new FleetMapManager();

      const now = new Date('2026-10-22T10:00:00.000Z');
      fleetManager.updateBusStatus({
        bus_id: 'bus-1',
        plate_number: 'KA-01-F-1001',
        route_id: 'route-north',
        route_name: 'North Campus Express',
        driver_name: 'Driver Ramesh',
        active_source: 'PRIMARY_TRACKER',
        status: 'RUNNING',
        lat: 12.9716,
        lng: 77.5946,
        speed_kph: 42,
        battery_v: 12.6,
        last_sample_at: '2026-10-22T09:59:50.000Z', // 10s old
      });

      fleetManager.updateBusStatus({
        bus_id: 'bus-2',
        plate_number: 'KA-01-F-1002',
        route_id: 'route-south',
        route_name: 'South Campus Shuttle',
        driver_name: 'Driver Suresh',
        active_source: 'DRIVER_PHONE',
        status: 'RUNNING',
        lat: 12.9352,
        lng: 77.6245,
        speed_kph: 25,
        battery_v: null,
        last_sample_at: '2026-10-22T09:59:30.000Z', // 30s old
      });

      const buses = fleetManager.getFleetOverview(now);
      expect(buses).toHaveLength(2);

      const bus1 = buses.find((b) => b.bus_id === 'bus-1')!;
      expect(bus1.age_seconds).toBe(10);
      expect(bus1.active_source).toBe('PRIMARY_TRACKER');
      expect(bus1.status).toBe('RUNNING');

      const bus2 = buses.find((b) => b.bus_id === 'bus-2')!;
      expect(bus2.age_seconds).toBe(30);
      expect(bus2.active_source).toBe('DRIVER_PHONE');
    });
  });

  describe('Source-Switch Log', () => {
    it('records source switch events and allows filtering by bus ID', () => {
      const fleetManager = new FleetMapManager();

      fleetManager.recordSourceSwitch({
        id: 'switch-1',
        bus_id: 'bus-1',
        switched_at: '2026-10-22T09:30:00.000Z',
        previous_source: 'PRIMARY_TRACKER',
        new_source: 'DRIVER_PHONE',
        reason: 'DEVICE_TIMEOUT',
        confidence: 0.95,
      });

      fleetManager.recordSourceSwitch({
        id: 'switch-2',
        bus_id: 'bus-2',
        switched_at: '2026-10-22T09:35:00.000Z',
        previous_source: 'NONE',
        new_source: 'PRIMARY_TRACKER',
        reason: 'PRIMARY_RECOVERED',
        confidence: 1.0,
      });

      const bus1Switches = fleetManager.getSourceSwitches('bus-1');
      expect(bus1Switches).toHaveLength(1);
      expect(bus1Switches[0].reason).toBe('DEVICE_TIMEOUT');
      expect(bus1Switches[0].new_source).toBe('DRIVER_PHONE');

      const allSwitches = fleetManager.getSourceSwitches();
      expect(allSwitches).toHaveLength(2);
    });
  });

  describe('Dual-Track Comparison (Last 10 minutes)', () => {
    it('calculates divergence between primary hardware track and phone track and flags discrepancies > 200m', () => {
      const analyzer = new DualTrackAnalyzer();

      // Primary track: normal trajectory
      const primaryTrack = [
        { lat: 12.9716, lng: 77.5946, recorded_at: '2026-10-22T09:50:00.000Z' },
        { lat: 12.9726, lng: 77.5956, recorded_at: '2026-10-22T09:55:00.000Z' },
        { lat: 12.9736, lng: 77.5966, recorded_at: '2026-10-22T10:00:00.000Z' },
      ];

      // Phone track: 1st point matches, 2nd point diverges significantly (>300m away), 3rd matches
      const phoneTrack = [
        { lat: 12.9716, lng: 77.5946, recorded_at: '2026-10-22T09:50:00.000Z' },
        { lat: 12.9760, lng: 77.5990, recorded_at: '2026-10-22T09:55:00.000Z' }, // diverged by ~500m
        { lat: 12.9736, lng: 77.5966, recorded_at: '2026-10-22T10:00:00.000Z' },
      ];

      const comparison = analyzer.compareTracks({
        bus_id: 'bus-1',
        window_start: '2026-10-22T09:50:00.000Z',
        window_end: '2026-10-22T10:00:00.000Z',
        primary_track: primaryTrack,
        phone_track: phoneTrack,
      });

      expect(comparison.bus_id).toBe('bus-1');
      expect(comparison.max_divergence_m).toBeGreaterThan(200);
      expect(comparison.disagreement_intervals.length).toBeGreaterThan(0);
      expect(comparison.disagreement_intervals[0].reason).toContain('Divergence exceeded 200m threshold');
    });
  });
});
