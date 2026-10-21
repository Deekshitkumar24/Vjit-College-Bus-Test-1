import { describe, expect, it } from 'vitest';
import { evaluateMorningPresentAfternoonAbsentDiscrepancies } from '../src/manifest/safety-evaluator.js';
import {
  buildManifestRowViewModel,
  filterManifestRows,
  resolveManifestStatusBadge,
} from '../src/manifest/manifest-models.js';
import { ManifestClient } from '../src/manifest/manifest-client.js';
import { MobileCacheStore } from '../src/store/cache-store.js';
import { ManifestStudentItemDto, TripManifestResponseDto } from '@collegebus/contracts';

describe('P2-T6: Faculty Attendance Manifest & Safety Alert (D-12) Suite', () => {
  const tripId = 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c6d';
  const routeId = 'b2c3d4e5-f6a7-4b8c-9d1e-2f3a4b5c6d7e';
  const stopId1 = 'c3d4e5f6-a7b8-4c9d-1e2f-3a4b5c6d7e8f';
  const stopId2 = 'd4e5f6a7-b8c9-4d1e-2f3a-4b5c6d7e8f9a';

  const studentA: ManifestStudentItemDto = {
    student_id: 'e5f6a7b8-c9d1-4e2f-3a4b-5c6d7e8f9a1b',
    full_name: 'Aarav Sharma',
    roll_number: 'CS2026-042',
    stop_id: stopId1,
    stop_name: 'Indiranagar Metro',
    status: 'EXPECTED',
    boarded_at: null,
    method: null,
    morning_status: 'BOARDED',
    guardian_phone: '+919876543210',
  };

  const studentB: ManifestStudentItemDto = {
    student_id: 'f6a7b8c9-d1e2-4f3a-4b5c-6d7e8f9a1b2c',
    full_name: 'Ananya Rao',
    roll_number: 'EC2026-015',
    stop_id: stopId2,
    stop_name: 'Domlur Flyover',
    status: 'BOARDED',
    boarded_at: '2026-10-21T15:30:00Z',
    method: 'QR',
    morning_status: 'BOARDED',
    guardian_phone: '+919876543211',
  };

  const studentC: ManifestStudentItemDto = {
    student_id: 'a7b8c9d1-e2f3-4a4b-5c6d-7e8f9a1b2c3d',
    full_name: 'Rohan Verma',
    roll_number: 'ME2026-088',
    stop_id: stopId1,
    stop_name: 'Indiranagar Metro',
    status: 'ON_LEAVE',
    boarded_at: null,
    method: null,
    morning_status: 'ON_LEAVE',
    guardian_phone: '+919876543212',
  };

  describe('Default D-12: Morning-Present Afternoon-Absent Rule Evaluator', () => {
    it('returns zero alerts for morning trips', () => {
      const alerts = evaluateMorningPresentAfternoonAbsentDiscrepancies({
        tripId,
        tripType: 'MORNING',
        students: [studentA, studentB],
        isDepartedOrPastDepartureTime: true,
      });

      expect(alerts).toHaveLength(0);
    });

    it('flags HIGH alert for student who boarded morning bus but is not yet boarded before afternoon departure', () => {
      const alerts = evaluateMorningPresentAfternoonAbsentDiscrepancies({
        tripId,
        tripType: 'AFTERNOON',
        students: [studentA, studentB, studentC],
        isDepartedOrPastDepartureTime: false,
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.student_id).toBe(studentA.student_id);
      expect(alerts[0]?.alert_level).toBe('HIGH');
      expect(alerts[0]?.message).toContain('Aarav Sharma');
      expect(alerts[0]?.message).toContain('not yet checked in');
    });

    it('escalates to CRITICAL alert if bus departs or passes scheduled departure without the student', () => {
      const alerts = evaluateMorningPresentAfternoonAbsentDiscrepancies({
        tripId,
        tripType: 'AFTERNOON',
        students: [studentA, studentB, studentC],
        isDepartedOrPastDepartureTime: true,
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.student_id).toBe(studentA.student_id);
      expect(alerts[0]?.alert_level).toBe('CRITICAL');
      expect(alerts[0]?.message).toContain('MISSING');
      expect(alerts[0]?.message).toContain('D-12');
    });

    it('does not flag students who boarded in afternoon or were on leave in morning', () => {
      const alerts = evaluateMorningPresentAfternoonAbsentDiscrepancies({
        tripId,
        tripType: 'AFTERNOON',
        students: [studentB, studentC],
        isDepartedOrPastDepartureTime: true,
      });

      expect(alerts).toHaveLength(0);
    });
  });

  describe('Manifest Row Models & Filter Engine', () => {
    it('resolves correct badge colors for all attendance states', () => {
      expect(resolveManifestStatusBadge('BOARDED').tone).toBe('GREEN');
      expect(resolveManifestStatusBadge('MANUAL_CHECKIN').tone).toBe('GREEN');
      expect(resolveManifestStatusBadge('LATE_BOARDED').tone).toBe('BLUE');
      expect(resolveManifestStatusBadge('EXPECTED').tone).toBe('GRAY');
      expect(resolveManifestStatusBadge('ABSENT').tone).toBe('RED');
      expect(resolveManifestStatusBadge('ON_LEAVE').tone).toBe('AMBER');
    });

    it('builds row view model highlighting morning discrepancy on afternoon return trip', () => {
      const rowA = buildManifestRowViewModel(studentA, true);
      expect(rowA.fullName).toBe('Aarav Sharma');
      expect(rowA.hasMorningDiscrepancy).toBe(true);
      expect(rowA.badgeTone).toBe('RED'); // Highlighted red due to discrepancy
      expect(rowA.canManualToggle).toBe(true);

      const rowB = buildManifestRowViewModel(studentB, true);
      expect(rowB.hasMorningDiscrepancy).toBe(false);
      expect(rowB.isBoarded).toBe(true);
      expect(rowB.badgeTone).toBe('GREEN');

      const rowC = buildManifestRowViewModel(studentC, true);
      expect(rowC.canManualToggle).toBe(false); // Locked if student is on leave
      expect(rowC.badgeTone).toBe('AMBER');
    });

    it('filters rows by text query across name, roll number, or stop name', () => {
      const rows = [
        buildManifestRowViewModel(studentA),
        buildManifestRowViewModel(studentB),
        buildManifestRowViewModel(studentC),
      ];

      const queryName = filterManifestRows(rows, { query: 'aarav' });
      expect(queryName).toHaveLength(1);
      expect(queryName[0]?.studentId).toBe(studentA.student_id);

      const queryRoll = filterManifestRows(rows, { query: 'EC2026' });
      expect(queryRoll).toHaveLength(1);
      expect(queryRoll[0]?.studentId).toBe(studentB.student_id);

      const queryStop = filterManifestRows(rows, { query: 'Domlur' });
      expect(queryStop).toHaveLength(1);
      expect(queryStop[0]?.studentId).toBe(studentB.student_id);
    });

    it('filters rows by attendance status category', () => {
      const rows = [
        buildManifestRowViewModel(studentA),
        buildManifestRowViewModel(studentB),
        buildManifestRowViewModel(studentC),
      ];

      const filtered = filterManifestRows(rows, { statusFilter: 'BOARDED' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.studentId).toBe(studentB.student_id);
    });
  });

  describe('ManifestClient API & Offline Toggle', () => {
    it('fetches trip manifest and parses structured response', async () => {
      const cacheStore = new MobileCacheStore();
      const mockManifest: TripManifestResponseDto = {
        trip_id: tripId,
        route_id: routeId,
        route_name: 'Route 1 - East Campus Express',
        trip_type: 'AFTERNOON',
        service_date: '2026-10-21',
        total_students: 3,
        boarded_count: 1,
        expected_count: 1,
        absent_count: 0,
        on_leave_count: 1,
        students: [studentA, studentB, studentC],
        safety_discrepancies: [],
      };

      const mockFetch: typeof fetch = async () =>
        new Response(JSON.stringify(mockManifest), { status: 200 });

      const client = new ManifestClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const result = await client.fetchTripManifest(tripId, 'token-faculty', true);
      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.students).toHaveLength(3);
      // D-12 discrepancy calculated automatically
      expect(result.manifest?.safety_discrepancies).toHaveLength(1);
      expect(result.manifest?.safety_discrepancies[0]?.alert_level).toBe('CRITICAL');
    });

    it('performs manual attendance toggle online', async () => {
      const cacheStore = new MobileCacheStore();
      const mockFetch: typeof fetch = async () => new Response(null, { status: 200 });

      const client = new ManifestClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const res = await client.toggleManualAttendance(
        {
          trip_id: tripId,
          student_id: studentA.student_id,
          target_status: 'BOARDED',
        },
        'token-faculty',
      );

      expect(res.success).toBe(true);
      expect(res.isOfflineQueued).toBe(false);
      expect(res.message).toContain('Attendance updated to BOARDED');
    });

    it('queues manual attendance toggle offline during network outage', async () => {
      const cacheStore = new MobileCacheStore();
      const offlineFetch: typeof fetch = async () => {
        throw new Error('No connection');
      };

      const client = new ManifestClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: offlineFetch,
      });

      const res = await client.toggleManualAttendance(
        {
          trip_id: tripId,
          student_id: studentA.student_id,
          target_status: 'BOARDED',
        },
        'token-faculty',
      );

      expect(res.success).toBe(true);
      expect(res.isOfflineQueued).toBe(true);
      expect(cacheStore.getPendingQueue().length).toBe(1);
      expect(cacheStore.getPendingQueue()[0]?.type).toBe('ATTENDANCE_SCAN');
    });
  });
});
