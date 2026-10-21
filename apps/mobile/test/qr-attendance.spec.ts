import { describe, expect, it } from 'vitest';
import { QrAttendanceValidator } from '../src/attendance/qr-validator.js';
import { AttendanceClient } from '../src/attendance/attendance-client.js';
import { MobileCacheStore } from '../src/store/cache-store.js';

describe('P2-T4: Student QR Attendance Suite', () => {
  const tripId = 'c7a1e2f4-8b3d-4c91-9e5a-2f6d8a0c1b3e';
  const busId = 'd8b2f3a5-9c4e-4d02-af6b-3a7e9b1d2c4f';
  const validNonce = 'nonce-random-12345';
  const validSignature = 'sig-valid-hmac-sha256-string-999';

  describe('QrAttendanceValidator', () => {
    it('successfully parses and validates fresh JSON payload', () => {
      const validator = new QrAttendanceValidator({ epochWindowMs: 15_000 });
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);

      const rawJson = JSON.stringify({
        trip_id: tripId,
        bus_id: busId,
        epoch: currentEpoch,
        nonce: validNonce,
        signature: validSignature,
      });

      const result = validator.validate(rawJson, now);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.payload.trip_id).toBe(tripId);
        expect(result.payload.bus_id).toBe(busId);
        expect(result.payload.epoch).toBe(currentEpoch);
      }
    });

    it('successfully parses and validates fresh pipe-delimited payload', () => {
      const validator = new QrAttendanceValidator({ epochWindowMs: 15_000 });
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);

      const rawPipe = `${tripId}|${busId}|${currentEpoch}|${validNonce}|${validSignature}`;
      const result = validator.validate(rawPipe, now);

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.payload.nonce).toBe(validNonce);
      }
    });

    it('rejects malformed or invalid format payloads', () => {
      const validator = new QrAttendanceValidator();
      const result = validator.validate('not-a-valid-qr-code');

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.error).toBe('INVALID_FORMAT');
        expect(result.message).toContain('not a valid bus attendance token');
      }
    });

    it('rejects expired QR tokens with skew greater than 1 epoch', () => {
      const validator = new QrAttendanceValidator({ epochWindowMs: 15_000, maxEpochSkew: 1 });
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);
      const staleEpoch = currentEpoch - 3; // 45 seconds old

      const raw = `${tripId}|${busId}|${staleEpoch}|${validNonce}|${validSignature}`;
      const result = validator.validate(raw, now);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.error).toBe('EXPIRED');
        expect(result.message).toContain('QR code expired');
      }
    });

    it('detects and rejects replay attempts with the same nonce', () => {
      const validator = new QrAttendanceValidator({ epochWindowMs: 15_000 });
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);

      const raw = `${tripId}|${busId}|${currentEpoch}|${validNonce}|${validSignature}`;

      const firstScan = validator.validate(raw, now);
      expect(firstScan.isValid).toBe(true);

      const replayScan = validator.validate(raw, now + 2000);
      expect(replayScan.isValid).toBe(false);
      if (!replayScan.isValid) {
        expect(replayScan.error).toBe('REPLAY_DETECTED');
        expect(replayScan.message).toContain('already scanned');
      }
    });
  });

  describe('AttendanceClient Integration & Offline Queueing', () => {
    it('processes successful check-in response from server', async () => {
      const cacheStore = new MobileCacheStore();
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);
      const raw = `${tripId}|${busId}|${currentEpoch}|nonce-att-001|${validSignature}`;

      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            success: true,
            status: 'BOARDED',
            message: 'Boarded successfully at stop Indiranagar',
            boarded_at: '2026-10-21T10:05:00.000Z',
            attendance_record_id: 'e9c3a4b6-ad5f-4e13-bf7c-4b8f0c2e3d5a',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );

      const client = new AttendanceClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const outcome = await client.checkInWithQr({
        rawQr: raw,
        token: 'jwt-auth-token',
        boardingStopId: 'fa4d1b5c-be6a-4f24-c08d-5c9a1d3f4e6b',
        timestampMs: now,
      });

      expect(outcome.status).toBe('BOARDED');
      expect(outcome.message).toContain('Boarded successfully');
      expect(outcome.boardedAt).toBe('2026-10-21T10:05:00.000Z');
      expect(outcome.attendanceRecordId).toBe('e9c3a4b6-ad5f-4e13-bf7c-4b8f0c2e3d5a');
      expect(cacheStore.getPendingQueue().length).toBe(0);
    });

    it('returns ALREADY_CHECKED_IN on HTTP 409 conflict', async () => {
      const cacheStore = new MobileCacheStore();
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);
      const raw = `${tripId}|${busId}|${currentEpoch}|nonce-att-002|${validSignature}`;

      const mockFetch: typeof fetch = async () =>
        new Response(JSON.stringify({ message: 'Already recorded' }), { status: 409 });

      const client = new AttendanceClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const outcome = await client.checkInWithQr({
        rawQr: raw,
        token: 'jwt-auth-token',
        timestampMs: now,
      });

      expect(outcome.status).toBe('ALREADY_CHECKED_IN');
      expect(outcome.message).toContain('already checked in');
    });

    it('enqueues attendance action into offline queue on network failure', async () => {
      const cacheStore = new MobileCacheStore();
      const now = 1_700_000_000_000;
      const currentEpoch = Math.floor(now / 15_000);
      const raw = `${tripId}|${busId}|${currentEpoch}|nonce-att-003|${validSignature}`;

      const offlineFetch: typeof fetch = async () => {
        throw new Error('Network request failed: device offline');
      };

      const client = new AttendanceClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: offlineFetch,
      });

      const outcome = await client.checkInWithQr({
        rawQr: raw,
        token: 'jwt-auth-token',
        clientTimestamp: '2026-10-21T10:00:00.000Z',
        timestampMs: now,
      });

      expect(outcome.status).toBe('OFFLINE_QUEUED');
      expect(outcome.message).toContain('saved locally');
      expect(cacheStore.getPendingQueue().length).toBe(1);

      const queue = cacheStore.getPendingQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]!.type).toBe('ATTENDANCE_SCAN');
    });
  });
});
