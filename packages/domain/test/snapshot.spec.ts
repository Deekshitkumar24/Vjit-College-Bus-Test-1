import { describe, it, expect } from 'vitest';
import {
  formatSourceBadgeLabel,
  resolveUserRouteScope,
  computeDataAgeSeconds,
  generateSnapshotEtag,
} from '../src/snapshot.js';

describe('Snapshot Domain Logic (P1-T8, Part 5.6 & 6.9)', () => {
  describe('Authoritative Source Badge Labels (Part 17.3)', () => {
    it('formats NOT_RUNNING state', () => {
      expect(formatSourceBadgeLabel({ state: 'NOT_RUNNING', active_source: 'NONE' })).toBe(
        'Not running',
      );
    });

    it('formats LIVE state with hardware source', () => {
      expect(formatSourceBadgeLabel({ state: 'LIVE', active_source: 'HW' })).toBe(
        'Live · bus tracker',
      );
    });

    it('formats LIVE state with driver phone source', () => {
      expect(formatSourceBadgeLabel({ state: 'LIVE', active_source: 'PHONE' })).toBe(
        "Live · driver's phone",
      );
    });

    it('formats STALE state with data age in seconds', () => {
      expect(
        formatSourceBadgeLabel({
          state: 'STALE',
          active_source: 'HW',
          data_age_s: 45,
        }),
      ).toBe('Last update 45s ago');
    });

    it('formats UNAVAILABLE state with last seen time', () => {
      const lastSeen = new Date('2026-10-21T08:15:00Z');
      expect(
        formatSourceBadgeLabel({
          state: 'UNAVAILABLE',
          active_source: 'NONE',
          last_seen_at: lastSeen,
        }),
      ).toBe('Location unavailable. Last seen at 08:15');
    });

    it('formats UNAVAILABLE state without last seen time', () => {
      expect(
        formatSourceBadgeLabel({
          state: 'UNAVAILABLE',
          active_source: 'NONE',
        }),
      ).toBe('Location unavailable');
    });
  });

  describe('Caller Scope Resolution & 404 Rule (Part 6.9 & Part B.1 L-3)', () => {
    it('restricts STU to assigned student routes', () => {
      const allowed = resolveUserRouteScope({
        role: 'STU',
        routeId: 'route_10',
        studentRouteIds: ['route_10', 'route_12'],
      });
      expect(allowed.allowed).toBe(true);

      const denied = resolveUserRouteScope({
        role: 'STU',
        routeId: 'route_99',
        studentRouteIds: ['route_10', 'route_12'],
      });
      expect(denied.allowed).toBe(false);
      expect(denied.reason).toBe('ROUTE_NOT_ASSIGNED_TO_STUDENT');
    });

    it('restricts FAC to assigned faculty routes', () => {
      const allowed = resolveUserRouteScope({
        role: 'FAC',
        routeId: 'route_05',
        facultyRouteIds: ['route_05'],
      });
      expect(allowed.allowed).toBe(true);

      const denied = resolveUserRouteScope({
        role: 'FAC',
        routeId: 'route_06',
        facultyRouteIds: ['route_05'],
      });
      expect(denied.allowed).toBe(false);
    });

    it('restricts DRV to active or rostered routes', () => {
      const allowed = resolveUserRouteScope({
        role: 'DRV',
        routeId: 'route_01',
        driverRouteIds: ['route_01'],
      });
      expect(allowed.allowed).toBe(true);

      const denied = resolveUserRouteScope({
        role: 'DRV',
        routeId: 'route_02',
        driverRouteIds: ['route_01'],
      });
      expect(denied.allowed).toBe(false);
    });

    it('grants global scope to SEC per Part B.1 L-3 (read-only all active buses)', () => {
      const res = resolveUserRouteScope({
        role: 'SEC',
        routeId: 'any_route_random_id',
      });
      expect(res.allowed).toBe(true);
    });

    it('grants global scope to administrative roles (COR, TEC, MGT, SAD)', () => {
      for (const role of ['COR', 'TEC', 'MGT', 'SAD']) {
        const res = resolveUserRouteScope({
          role,
          routeId: 'any_unassigned_route',
        });
        expect(res.allowed).toBe(true);
      }
    });

    it('rejects unknown roles', () => {
      const res = resolveUserRouteScope({
        role: 'ANONYMOUS_HACKER',
        routeId: 'route_01',
      });
      expect(res.allowed).toBe(false);
    });
  });

  describe('Data Age & ETag Calculation', () => {
    it('computes data age in whole seconds', () => {
      const now = new Date('2026-10-21T08:00:30Z');
      const updated = new Date('2026-10-21T08:00:15Z');
      expect(computeDataAgeSeconds(updated, now)).toBe(15);
      expect(computeDataAgeSeconds(null, now)).toBeNull();
    });

    it('generates deterministic weak ETag for route version caching', () => {
      const etag1 = generateSnapshotEtag('route_01', 3, 'abc123hash');
      const etag2 = generateSnapshotEtag('route_01', 3, 'abc123hash');
      expect(etag1).toBe(etag2);
      expect(etag1).toContain('W/"snap_route_01_v3_abc123hash"');
    });
  });
});
