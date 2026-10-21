import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STUDENT_NAVIGATION_ROUTES,
  FACULTY_NAVIGATION_ROUTES,
  getRoutesForRole,
} from '../src/navigation/routes.js';
import { MobileCacheStore } from '../src/store/cache-store.js';
import { SnapshotPollingClient } from '../src/api/snapshot-client.js';
import { SnapshotResponseDto } from '@collegebus/contracts';

describe('Mobile Navigation, Cache Store, and Snapshot Poller (P2-T1)', () => {
  let cacheStore: MobileCacheStore;

  const mockSnapshot: SnapshotResponseDto = {
    route_id: 'route_901',
    route_version: 1,
    server_time: '2026-10-21T08:00:00Z',
    buses: [
      {
        bus_id: 'bus_901',
        bus_number: 'Bus 901',
        trip_id: 'trip_001',
        state: 'LIVE',
        active_source: 'HW',
        source_label: 'Live · bus tracker',
        lat: 12.9716,
        lng: 77.5946,
        speed_kmh: 30,
        heading_deg: 45,
        data_age_s: 2,
        eta_seconds: 120,
        eta_label: '2 mins',
        updated_at: '2026-10-21T08:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    cacheStore = new MobileCacheStore();
  });

  describe('Mobile Navigation Tree', () => {
    it('provides correct navigation routes for Student role', () => {
      const routes = getRoutesForRole('STU');
      expect(routes).toEqual(STUDENT_NAVIGATION_ROUTES);
      expect(routes.map((r) => r.path)).toContain('/(student)/map');
      expect(routes.map((r) => r.path)).toContain('/(student)/scan');
      expect(routes.map((r) => r.path)).toContain('/(student)/requests');
    });

    it('provides correct navigation routes for Faculty role', () => {
      const routes = getRoutesForRole('FAC');
      expect(routes).toEqual(FACULTY_NAVIGATION_ROUTES);
      expect(routes.map((r) => r.path)).toContain('/(faculty)/map');
      expect(routes.map((r) => r.path)).toContain('/(faculty)/manifest');
      expect(routes.map((r) => r.path)).toContain('/(faculty)/calls');
    });
  });

  describe('Mobile Cache Store', () => {
    it('stores and retrieves snapshot with TTL and ETag', () => {
      cacheStore.setRouteSnapshot('route_901', mockSnapshot, 'W/"v1-abc"', 5000);

      const cached = cacheStore.getRouteSnapshot('route_901');
      expect(cached.snapshot).toEqual(mockSnapshot);
      expect(cached.etag).toBe('W/"v1-abc"');
      expect(cached.isStale).toBe(false);
    });

    it('identifies expired snapshots as stale', async () => {
      cacheStore.setRouteSnapshot('route_901', mockSnapshot, 'W/"v1-abc"', 10); // 10ms TTL

      await new Promise((resolve) => setTimeout(resolve, 20));

      const cached = cacheStore.getRouteSnapshot('route_901');
      expect(cached.snapshot).toEqual(mockSnapshot);
      expect(cached.isStale).toBe(true);
    });

    it('manages offline request queue for intermittent connectivity', () => {
      const reqId = cacheStore.queueOfflineAction('LEAVE_APPLICATION', {
        student_id: 'stu_01',
        reason: 'Medical appointment',
      });

      expect(reqId).toBeDefined();
      const pending = cacheStore.getPendingQueue();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.type).toBe('LEAVE_APPLICATION');

      cacheStore.removeQueueItem(reqId);
      expect(cacheStore.getPendingQueue()).toHaveLength(0);
    });
  });

  describe('Snapshot Polling Client', () => {
    it('fetches fresh snapshot on HTTP 200 and updates cache with new ETag', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: { etag: 'W/"v1-fresh"' },
        body: mockSnapshot,
      });

      const client = new SnapshotPollingClient(cacheStore, mockFetch, {
        baseUrl: 'http://localhost:3000',
        tokenProvider: async () => 'test_student_jwt',
      });

      const result = await client.fetchSnapshot('route_901');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/snapshot?route_id=route_901',
        expect.objectContaining({
          Authorization: 'Bearer test_student_jwt',
        }),
      );

      expect(result.status).toBe(200);
      expect(result.etag).toBe('W/"v1-fresh"');
      expect(result.fromCache).toBe(false);
      expect(result.snapshot).toEqual(mockSnapshot);

      // Verify cached
      const cached = cacheStore.getRouteSnapshot('route_901');
      expect(cached.etag).toBe('W/"v1-fresh"');
    });

    it('handles HTTP 304 Not Modified by returning cached snapshot without re-parsing', async () => {
      cacheStore.setRouteSnapshot('route_901', mockSnapshot, 'W/"v1-etag-123"', 30000);

      const mockFetch = vi.fn().mockResolvedValue({
        status: 304,
        headers: {},
      });

      const client = new SnapshotPollingClient(cacheStore, mockFetch, {
        baseUrl: 'http://localhost:3000',
        tokenProvider: async () => 'test_student_jwt',
      });

      const result = await client.fetchSnapshot('route_901');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/snapshot?route_id=route_901',
        expect.objectContaining({
          'If-None-Match': 'W/"v1-etag-123"',
        }),
      );

      expect(result.status).toBe(304);
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(false);
      expect(result.snapshot).toEqual(mockSnapshot);
    });

    it('falls back to cached snapshot when offline without making network request', async () => {
      cacheStore.setRouteSnapshot('route_901', mockSnapshot, 'W/"v1-etag"', 30000);
      cacheStore.setOnline(false);

      const mockFetch = vi.fn();

      const client = new SnapshotPollingClient(cacheStore, mockFetch, {
        baseUrl: 'http://localhost:3000',
        tokenProvider: async () => 'test_jwt',
      });

      const result = await client.fetchSnapshot('route_901');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(true);
      expect(result.snapshot).toEqual(mockSnapshot);
    });

    it('returns 404 cleanly when route is unassigned or inactive', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 404,
        headers: {},
      });

      const client = new SnapshotPollingClient(cacheStore, mockFetch, {
        baseUrl: 'http://localhost:3000',
        tokenProvider: async () => 'test_jwt',
      });

      const result = await client.fetchSnapshot('unassigned_route');

      expect(result.status).toBe(404);
      expect(result.snapshot).toBeNull();
      expect(result.error).toContain('Route not found');
    });

    it('supports pub/sub pattern and unsubscribes cleanly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: { etag: 'W/"v1"' },
        body: mockSnapshot,
      });

      const client = new SnapshotPollingClient(cacheStore, mockFetch, {
        baseUrl: 'http://localhost:3000',
        tokenProvider: async () => 'jwt',
      });

      const listener = vi.fn();
      const unsubscribe = client.subscribe(listener);

      await client.fetchSnapshot('route_901');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      await client.fetchSnapshot('route_901');
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });
  });
});
