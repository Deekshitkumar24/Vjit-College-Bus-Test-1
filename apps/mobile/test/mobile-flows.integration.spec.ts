import { describe, expect, it } from 'vitest';
import { MobileCacheStore } from '../src/store/cache-store.js';
import { SnapshotPollingClient } from '../src/api/snapshot-client.js';
import { resolveSourceBadge } from '../src/map/source-badge.js';
import { buildBusMarkerViewModel } from '../src/map/marker-model.js';
import { buildStopTimeline, RouteStop } from '../src/eta/stop-progress-card.js';
import { evaluateOffRouteStatus } from '../src/eta/off-route-banner.js';
import { QrAttendanceValidator } from '../src/attendance/qr-validator.js';
import { AttendanceClient } from '../src/attendance/attendance-client.js';
import { RequestsClient } from '../src/requests/requests-client.js';
import { evaluateMorningPresentAfternoonAbsentDiscrepancies } from '../src/manifest/safety-evaluator.js';
import { buildManifestRowViewModel, filterManifestRows } from '../src/manifest/manifest-models.js';
import { ManifestClient } from '../src/manifest/manifest-client.js';
import { GuardedHoldTrigger } from '../src/sos/hold-gesture.js';
import { SosClient, CAMPUS_SECURITY_HOTLINE } from '../src/sos/sos-client.js';

describe('P2-T8: Mobile Integration Test Harness & User Flows (Student & Faculty)', () => {
  const routeId = 'b2c3d4e5-f6a7-4b8c-9d1e-2f3a4b5c6d7e';
  const tripId = 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c6d';
  const busId = 'c3d4e5f6-a7b8-4c9d-1e2f-3a4b5c6d7e8f';
  const stopIndiranagar = 'd4e5f6a7-b8c9-4d1e-2f3a-4b5c6d7e8f9a';
  const stopDomlur = 'e5f6a7b8-c9d1-4e2f-3a4b-5c6d7e8f9a1b';

  const stopsList: RouteStop[] = [
    {
      id: stopIndiranagar,
      name: 'Indiranagar Metro Station',
      sequence: 1,
      location: { lat: 12.9716, lng: 77.5946 },
    },
    {
      id: stopDomlur,
      name: 'Domlur Flyover Junction',
      sequence: 2,
      location: { lat: 12.96, lng: 77.64 },
    },
  ];

  describe('Flow 1: Student Live Tracking, Source Badges & ETA Progression', () => {
    it('executes full live tracking flow with weak ETag caching and authoritative badges', async () => {
      const cacheStore = new MobileCacheStore();
      let callCount = 0;

      const mockSnapshotData = {
        route_id: routeId,
        route_version: 3,
        server_time: '2026-10-21T10:00:00Z',
        buses: [
          {
            bus_id: busId,
            bus_number: 'KA-01-F-1234',
            trip_id: tripId,
            state: 'LIVE' as const,
            active_source: 'HW' as const,
            source_label: 'Hardware GNSS',
            lat: 12.9716,
            lng: 77.5946,
            speed_kmh: 42.0,
            heading_deg: 90.0,
            data_age_s: 2,
            eta_seconds: 180,
            eta_label: '3 min',
            updated_at: '2026-10-21T10:00:00Z',
          },
        ],
      };

      const poller = new SnapshotPollingClient(
        cacheStore,
        async (_url, headers) => {
          callCount++;
          if (headers['If-None-Match'] === 'W/"route-v3-etag"') {
            return { status: 304, headers: {} };
          }
          return {
            status: 200,
            headers: { etag: 'W/"route-v3-etag"' },
            body: mockSnapshotData,
          };
        },
        {
          baseUrl: 'http://localhost:3000',
          tokenProvider: async () => 'jwt-test-token',
          pollIntervalMs: 5000,
        },
      );

      // Poll 1: 200 OK
      const res1 = await poller.fetchSnapshot(routeId);
      expect(res1.snapshot).toBeDefined();
      expect(res1.snapshot?.buses).toHaveLength(1);
      expect(callCount).toBe(1);

      const bus = res1.snapshot!.buses[0]!;

      // 1. Authoritative badge: LIVE + HW -> Live · bus tracker (GREEN)
      const badge = resolveSourceBadge(bus);
      expect(badge.labelText).toBe('Live · bus tracker');
      expect(badge.tone).toBe('GREEN');
      expect(badge.isPulsing).toBe(true);

      // 2. Bus Marker Model
      const marker = buildBusMarkerViewModel(bus);
      expect(marker.speedText).toBe('42 km/h');
      expect(marker.isMoving).toBe(true);
      expect(marker.rotationTransform).toBe('rotate(90deg)');

      // 3. Stop Timeline & Target Stop
      const { items, summary } = buildStopTimeline(stopsList, bus, stopDomlur);
      expect(items).toHaveLength(2);
      expect(items[0]?.status).toBe('ARRIVED'); // Bus is at Indiranagar
      expect(items[1]?.status).toBe('UPCOMING');
      expect(items[1]?.isTargetStop).toBe(true);
      expect(summary.nextStopName).toBe('Domlur Flyover Junction');

      // 4. Off-Route Corridor Check
      const offRoute = evaluateOffRouteStatus(
        { lat: bus.lat!, lng: bus.lng! },
        stopsList.map((s) => s.location),
      );
      expect(offRoute.isOffRoute).toBe(false);

      // Poll 2: 304 Not Modified served from local cache
      const res2 = await poller.fetchSnapshot(routeId);
      expect(res2.snapshot).toBeDefined();
      expect(res2.snapshot?.route_version).toBe(3);
      expect(res2.fromCache).toBe(true);
      expect(callCount).toBe(2);
    });
  });

  describe('Flow 2: Student QR Attendance Scanning & Offline Queueing', () => {
    it('scans rotating QR code, checks freshness, and falls back to offline queue', async () => {
      const cacheStore = new MobileCacheStore();
      const validator = new QrAttendanceValidator({ epochWindowMs: 15_000 });
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);
      const nonce = 'nonce-e2e-scan-789';
      const sig = 'sig-valid-hmac-sha256-hash-999';

      const rawQr = `${tripId}|${busId}|${currentEpoch}|${nonce}|${sig}`;

      // Offline client check-in (without previous scan replay)
      const offlineFetch: typeof fetch = async () => {
        throw new Error('Device disconnected from LTE/Wi-Fi');
      };

      const attendanceClient = new AttendanceClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        validator,
        fetchFn: offlineFetch,
      });

      const outcome = await attendanceClient.checkInWithQr({
        rawQr,
        token: 'jwt-student-token',
        boardingStopId: stopIndiranagar,
        timestampMs: now,
      });

      expect(outcome.status).toBe('OFFLINE_QUEUED');
      expect(outcome.message).toContain('saved locally');
      expect(cacheStore.getPendingQueue().length).toBe(1);
      expect(cacheStore.getPendingQueue()[0]?.type).toBe('ATTENDANCE_SCAN');
    });
  });

  describe('Flow 3: Student Stop Change & Leave Application Flow', () => {
    it('validates forms, handles submissions, and supports cancellation', async () => {
      const cacheStore = new MobileCacheStore();
      const requestId = 'f1a2b3c4-d5e6-4789-8012-3456789abcde';

      const mockFetch: typeof fetch = async (url) => {
        if (url.toString().includes('cancel')) {
          return new Response(null, { status: 200 });
        }
        return new Response(JSON.stringify({ id: requestId }), { status: 200 });
      };

      const reqClient = new RequestsClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      // Submit valid stop change
      const stopChangeResult = await reqClient.submitStopChange(
        {
          target_stop_id: stopDomlur,
          request_type: 'TEMPORARY',
          effective_date: '2026-11-01',
          end_date: '2026-11-10',
          reason: 'Exam preparation at secondary campus branch',
        },
        'token-stu',
      );
      expect(stopChangeResult.success).toBe(true);
      expect(stopChangeResult.requestId).toBe(requestId);

      // Cancel pending request
      const cancelResult = await reqClient.cancelRequest(requestId, 'token-stu');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.message).toContain('cancelled successfully');
    });
  });

  describe('Flow 4: Faculty Manifest & D-12 Safety Discrepancy Escalation', () => {
    it('manages passenger manifest, toggles attendance, and alerts on morning-present afternoon-absent students', async () => {
      const cacheStore = new MobileCacheStore();
      const student1 = {
        student_id: 'a9b8c7d6-e5f4-4321-8765-4321fedcba01',
        full_name: 'Priya Sharma',
        roll_number: 'CS2026-001',
        stop_id: stopIndiranagar,
        stop_name: 'Indiranagar Metro',
        status: 'EXPECTED' as const,
        boarded_at: null,
        method: null,
        morning_status: 'BOARDED' as const, // Boarded morning bus!
        guardian_phone: '+919876543210',
      };

      // D-12 Rule check
      const alerts = evaluateMorningPresentAfternoonAbsentDiscrepancies({
        tripId,
        tripType: 'AFTERNOON',
        students: [student1],
        isDepartedOrPastDepartureTime: true, // Bus departed
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.alert_level).toBe('CRITICAL');
      expect(alerts[0]?.message).toContain('SAFETY ALERT (D-12)');
      expect(alerts[0]?.message).toContain('Priya Sharma');

      // Manual faculty check-in toggle
      const mockFetch: typeof fetch = async () => new Response(null, { status: 200 });

      const manifestClient = new ManifestClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const toggleResult = await manifestClient.toggleManualAttendance(
        {
          trip_id: tripId,
          student_id: student1.student_id,
          target_status: 'BOARDED',
        },
        'token-fac',
      );

      expect(toggleResult.success).toBe(true);
      expect(toggleResult.isOfflineQueued).toBe(false);

      // Search & row view model
      const row = buildManifestRowViewModel(student1, true);
      const filtered = filterManifestRows([row], { query: 'Priya' });
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Flow 5: Emergency SOS Dispatch Flow (L-2 & Guarded 3s Hold)', () => {
    it('guards against accidental press, captures GPS, and dispatches emergency incident', async () => {
      const cacheStore = new MobileCacheStore();
      const trigger = new GuardedHoldTrigger(3000);
      const startMs = 2_000_000;

      trigger.pressDown(startMs);

      // Accidental tap (< 3s): does not trigger
      const earlyRelease = trigger.release(startMs + 500);
      expect(earlyRelease.wasTriggered).toBe(false);

      // Intentional 3-second hold
      trigger.pressDown(startMs + 1000);
      const holdProgress = trigger.updateProgress(startMs + 4100);
      expect(holdProgress.isTriggered).toBe(true);

      // Dispatch emergency incident
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            incident_id: 'd9e8f7a6-b5c4-4321-9876-543210fedcba',
            status: 'OPEN',
            category: 'EMERGENCY',
            dispatched_at: '2026-10-21T17:00:00.000Z',
            security_phone: CAMPUS_SECURITY_HOTLINE,
            message: 'Campus emergency dispatch unit activated',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );

      const sosClient = new SosClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const sosState = await sosClient.dispatchSos({
        category: 'EMERGENCY',
        triggerType: 'STUDENT_APP',
        token: 'token-stu-sos',
        location: { lat: 12.9716, lng: 77.5946 },
        accuracyM: 5.0,
        tripId,
        busId,
      });

      expect(sosState.isActive).toBe(true);
      expect(sosState.category).toBe('EMERGENCY');
      expect(sosState.securityHotline).toBe(CAMPUS_SECURITY_HOTLINE);
      expect(sosState.isOfflineQueued).toBe(false);
    });
  });
});
