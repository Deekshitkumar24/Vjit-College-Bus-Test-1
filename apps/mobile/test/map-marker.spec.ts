import { describe, expect, it } from 'vitest';
import { BusSnapshot } from '@collegebus/contracts';
import { LatLng } from '@collegebus/domain';
import { resolveSourceBadge } from '../src/map/source-badge.js';
import { buildBusMarkerViewModel } from '../src/map/marker-model.js';
import {
  calculateBoundingBox,
  calculateViewportFromBounds,
  DEFAULT_TILE_PROVIDER,
} from '../src/map/map-state.js';

describe('P2-T2: Live Map & Authoritative Marker Models', () => {
  const baseSnapshot: BusSnapshot = {
    bus_id: 'bus-01',
    bus_number: 'KA-01-F-1234',
    trip_id: 'trip-morning-1',
    active_source: 'HW',
    state: 'LIVE',
    lat: 12.9716,
    lng: 77.5946,
    speed_kmh: 35.5,
    heading_deg: 92.4,
    source_label: 'Hardware GNSS',
    data_age_s: 2,
    eta_seconds: 300,
    eta_label: '5 min',
    updated_at: '2026-10-21T10:00:00Z',
  };

  describe('Authoritative Source Badge Resolution (SW-MVP-1.0 §13.7, §17.3)', () => {
    it('resolves Live · bus tracker with GREEN tone when LIVE on HW tracker', () => {
      const badge = resolveSourceBadge({
        ...baseSnapshot,
        active_source: 'HW',
        state: 'LIVE',
      });

      expect(badge.labelText).toBe('Live · bus tracker');
      expect(badge.tone).toBe('GREEN');
      expect(badge.isPulsing).toBe(true);
      expect(badge.accessibleDescription).toContain('dedicated on-vehicle hardware tracker');
    });

    it("resolves Live · driver's phone with BLUE tone when LIVE on driver phone GPS", () => {
      const badge = resolveSourceBadge({
        ...baseSnapshot,
        active_source: 'PHONE',
        state: 'LIVE',
      });

      expect(badge.labelText).toBe("Live · driver's phone");
      expect(badge.tone).toBe('BLUE');
      expect(badge.isPulsing).toBe(true);
      expect(badge.accessibleDescription).toContain("driver's smartphone GPS");
    });

    it('resolves Delayed with AMBER tone when snapshot state is STALE', () => {
      const badge = resolveSourceBadge({
        ...baseSnapshot,
        state: 'STALE',
      });

      expect(badge.labelText).toBe('Delayed');
      expect(badge.tone).toBe('AMBER');
      expect(badge.isPulsing).toBe(false);
      expect(badge.accessibleDescription).toContain('delayed');
    });

    it('resolves Offline with GRAY tone when snapshot state is UNAVAILABLE', () => {
      const badge = resolveSourceBadge({
        ...baseSnapshot,
        state: 'UNAVAILABLE',
        lat: null,
        lng: null,
      });

      expect(badge.labelText).toBe('Offline');
      expect(badge.tone).toBe('GRAY');
      expect(badge.isPulsing).toBe(false);
    });

    it('resolves Not running with GRAY tone when snapshot state is NOT_RUNNING', () => {
      const badge = resolveSourceBadge({
        ...baseSnapshot,
        state: 'NOT_RUNNING',
      });

      expect(badge.labelText).toBe('Not running');
      expect(badge.tone).toBe('GRAY');
      expect(badge.isPulsing).toBe(false);
    });
  });

  describe('Bus Marker View Model Builder', () => {
    it('calculates correct heading rotation and speed display for moving bus', () => {
      const marker = buildBusMarkerViewModel(baseSnapshot);

      expect(marker.busId).toBe('bus-01');
      expect(marker.busNumber).toBe('KA-01-F-1234');
      expect(marker.coordinate).toEqual({ lat: 12.9716, lng: 77.5946 });
      expect(marker.headingDeg).toBe(92);
      expect(marker.rotationTransform).toBe('rotate(92deg)');
      expect(marker.isMoving).toBe(true);
      expect(marker.speedText).toBe('36 km/h');
      expect(marker.badge.labelText).toBe('Live · bus tracker');
    });

    it('indicates Stopped for speeds under 3 km/h', () => {
      const marker = buildBusMarkerViewModel({
        ...baseSnapshot,
        speed_kmh: 1.8,
      });

      expect(marker.isMoving).toBe(false);
      expect(marker.speedText).toBe('Stopped');
    });

    it('indicates Offline speed text when state is not LIVE', () => {
      const marker = buildBusMarkerViewModel({
        ...baseSnapshot,
        state: 'UNAVAILABLE',
        lat: null,
        lng: null,
      });

      expect(marker.coordinate).toBeNull();
      expect(marker.isMoving).toBe(false);
      expect(marker.speedText).toBe('Offline');
    });
  });

  describe('Map State & Camera Bounds Calculator', () => {
    it('returns default bounding box on empty coordinates', () => {
      const bounds = calculateBoundingBox([]);
      expect(bounds.minLat).toBeLessThan(bounds.maxLat);
      expect(bounds.minLng).toBeLessThan(bounds.maxLng);
      expect(bounds.minLat).toBe(12.95);
    });

    it('calculates padded bounding box around route points', () => {
      const points: LatLng[] = [
        { lat: 12.9, lng: 77.5 },
        { lat: 13.0, lng: 77.6 },
      ];

      const bounds = calculateBoundingBox(points, 0.1);
      // Span is 0.10 lat, 0.10 lng. Padding 0.1 * 0.1 = 0.01
      expect(bounds.minLat).toBeCloseTo(12.89, 4);
      expect(bounds.maxLat).toBeCloseTo(13.01, 4);
      expect(bounds.minLng).toBeCloseTo(77.49, 4);
      expect(bounds.maxLng).toBeCloseTo(77.61, 4);
    });

    it('computes center viewport and appropriate zoom level', () => {
      const bounds = {
        minLat: 12.9,
        maxLat: 13.0,
        minLng: 77.5,
        maxLng: 77.6,
      };

      const viewport = calculateViewportFromBounds(bounds);
      expect(viewport.center.lat).toBeCloseTo(12.95, 4);
      expect(viewport.center.lng).toBeCloseTo(77.55, 4);
      expect(viewport.zoom).toBe(12); // maxDiff is 0.10, which is > 0.08 and <= 0.2 => zoom 12
    });

    it('conforms to Default D-11 OpenStreetMap tile provider specification', () => {
      expect(DEFAULT_TILE_PROVIDER.providerName).toBe('OpenStreetMap');
      expect(DEFAULT_TILE_PROVIDER.tileUrlTemplate).toContain('tile.openstreetmap.org');
      expect(DEFAULT_TILE_PROVIDER.maxZoom).toBe(19);
    });
  });
});
