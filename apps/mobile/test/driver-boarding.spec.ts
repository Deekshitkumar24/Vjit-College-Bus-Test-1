import { describe, it, expect, vi } from 'vitest';
import {
  DriverQrGenerator,
  DriverCheckinManager,
  ManifestStudent,
  CheckinApiCaller,
} from '../src/driver/index.js';

describe('P3-T6: Boarding QR Code Display & Manual Check-in', () => {
  const secretKey = 'test_trip_qr_secret_key_2026';
  const busId = 'bus_01';
  const tripId = 'trip_20261021_01';

  describe('DriverQrGenerator (30s Rotating HMAC QR)', () => {
    it('generates a valid QR payload with 30s epoch window and HMAC signature', () => {
      const generator = new DriverQrGenerator({
        busId,
        tripId,
        secretKey,
      });

      const fixedTime = Date.UTC(2026, 9, 21, 8, 30, 10); // 10s into minute
      const qrState = generator.generateQr(fixedTime);

      expect(qrState.busId).toBe(busId);
      expect(qrState.tripId).toBe(tripId);
      expect(qrState.elapsedSeconds).toBe(10);
      expect(qrState.remainingSeconds).toBe(20);
      expect(qrState.progress).toBeCloseTo(20 / 30, 2);
      expect(qrState.payload.type).toBe('BOARDING_QR');
      expect(qrState.payload.sig).toBeDefined();
      expect(typeof qrState.payload.sig).toBe('string');
      expect(qrState.payload.sig.length).toBe(64); // SHA-256 hex
    });

    it('rotates signature and epoch at 30-second window boundary', () => {
      const generator = new DriverQrGenerator({
        busId,
        tripId,
        secretKey,
      });

      const window1Time = Date.UTC(2026, 9, 21, 8, 30, 15);
      const window2Time = Date.UTC(2026, 9, 21, 8, 30, 45);

      const state1 = generator.generateQr(window1Time);
      const state2 = generator.generateQr(window2Time);

      expect(state1.epochWindow).not.toBe(state2.epochWindow);
      expect(state1.payload.sig).not.toBe(state2.payload.sig);
      expect(state2.epochWindow - state1.epochWindow).toBe(1);
    });

    it('verifies valid QR token successfully', () => {
      const generator = new DriverQrGenerator({
        busId,
        tripId,
        secretKey,
      });

      const fixedTime = Date.UTC(2026, 9, 21, 8, 30, 5);
      const qrState = generator.generateQr(fixedTime);

      const verification = DriverQrGenerator.verifyQrToken(qrState.token, secretKey, 1, fixedTime);

      expect(verification.valid).toBe(true);
      expect(verification.payload?.bus_id).toBe(busId);
      expect(verification.payload?.trip_id).toBe(tripId);
    });

    it('rejects tampered signature', () => {
      const generator = new DriverQrGenerator({
        busId,
        tripId,
        secretKey,
      });

      const fixedTime = Date.UTC(2026, 9, 21, 8, 30, 5);
      const qrState = generator.generateQr(fixedTime);
      const tamperedPayload = {
        ...qrState.payload,
        sig: 'a'.repeat(64),
      };

      const verification = DriverQrGenerator.verifyQrToken(
        tamperedPayload,
        secretKey,
        1,
        fixedTime,
      );

      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('SIGNATURE_MISMATCH');
    });

    it('rejects expired QR token outside drift window', () => {
      const generator = new DriverQrGenerator({
        busId,
        tripId,
        secretKey,
      });

      const oldTime = Date.UTC(2026, 9, 21, 8, 30, 0);
      const qrState = generator.generateQr(oldTime);

      // Verify 5 minutes later (10 windows later)
      const laterTime = Date.UTC(2026, 9, 21, 8, 35, 0);
      const verification = DriverQrGenerator.verifyQrToken(qrState.token, secretKey, 1, laterTime);

      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('TOKEN_EXPIRED_WINDOW');
    });
  });

  describe('DriverCheckinManager (Passenger Manifest & Manual Check-in)', () => {
    const initialStudents: ManifestStudent[] = [
      {
        student_id: 'stu_101',
        full_name: 'Ananya Rao',
        roll_number: '21CS101',
        stop_name: 'Silk Board Junction',
        status: 'EXPECTED',
        boarded_at: null,
      },
      {
        student_id: 'stu_102',
        full_name: 'Rohan Verma',
        roll_number: '21CS102',
        stop_name: 'HSR Layout BDA',
        status: 'EXPECTED',
        boarded_at: null,
      },
      {
        student_id: 'stu_103',
        full_name: 'Priya Sharma',
        roll_number: '21EC105',
        stop_name: 'Bellandur Gate',
        status: 'EXPECTED',
        boarded_at: null,
      },
    ];

    it('stores manifest and computes summary statistics accurately', () => {
      const manager = new DriverCheckinManager();
      manager.setManifest(tripId, initialStudents);

      const manifest = manager.getManifest(tripId);
      expect(manifest.length).toBe(3);

      const summary = manager.getSummary(tripId);
      expect(summary.total_expected).toBe(3);
      expect(summary.total_boarded).toBe(0);
      expect(summary.total_guests).toBe(0);
      expect(summary.total_manual).toBe(0);
    });

    it('searches and filters students by name, roll number, and status', () => {
      const manager = new DriverCheckinManager();
      manager.setManifest(tripId, initialStudents);

      const byName = manager.searchManifest(tripId, 'ananya');
      expect(byName.length).toBe(1);
      expect(byName[0]?.student_id).toBe('stu_101');

      const byRoll = manager.searchManifest(tripId, '21EC');
      expect(byRoll.length).toBe(1);
      expect(byRoll[0]?.student_id).toBe('stu_103');

      const byStatus = manager.searchManifest(tripId, '', 'EXPECTED');
      expect(byStatus.length).toBe(3);
    });

    it('validates manual check-in parameters: rejects missing student_id, trip_id', async () => {
      const manager = new DriverCheckinManager();

      await expect(
        manager.recordManualCheckin({
          trip_id: '',
          student_id: 'stu_101',
          is_guest: false,
          reason: 'CARD_FORGOTTEN',
        }),
      ).rejects.toThrow('Trip ID is required');

      await expect(
        manager.recordManualCheckin({
          trip_id: tripId,
          student_id: '',
          is_guest: false,
          reason: 'CARD_FORGOTTEN',
        }),
      ).rejects.toThrow('Student ID is required');
    });

    it('requires a mandatory note when reason is OTHER', async () => {
      const manager = new DriverCheckinManager();

      await expect(
        manager.recordManualCheckin({
          trip_id: tripId,
          student_id: 'stu_101',
          is_guest: false,
          reason: 'OTHER',
          note: '',
        }),
      ).rejects.toThrow('Descriptive note is required when reason is OTHER');
    });

    it('records manual check-in for expected student with online API caller', async () => {
      const mockCaller: CheckinApiCaller = vi.fn(async () => ({
        success: true,
        student_id: 'stu_101',
        trip_id: tripId,
        status: 'MANUAL_CHECKIN' as const,
        reason: 'CARD_FORGOTTEN' as const,
        boarded_at: new Date(Date.UTC(2026, 9, 21, 8, 32, 0)).toISOString(),
        message: 'Manual check-in recorded for student (CARD_FORGOTTEN)',
      }));

      const manager = new DriverCheckinManager(mockCaller);
      manager.setManifest(tripId, initialStudents);

      const checkinDate = new Date(Date.UTC(2026, 9, 21, 8, 32, 0));
      const res = await manager.recordManualCheckin(
        {
          trip_id: tripId,
          student_id: 'stu_101',
          is_guest: false,
          reason: 'CARD_FORGOTTEN',
          note: 'Physical ID left at home',
        },
        { isOnline: true, now: checkinDate },
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('MANUAL_CHECKIN');
      expect(mockCaller).toHaveBeenCalledTimes(1);

      // Verify optimistic update on manifest
      const updated = manager.getManifest(tripId).find((s) => s.student_id === 'stu_101');
      expect(updated?.status).toBe('MANUAL_CHECKIN');
      expect(updated?.reason).toBe('CARD_FORGOTTEN');

      const summary = manager.getSummary(tripId);
      expect(summary.total_boarded).toBe(1);
      expect(summary.total_manual).toBe(1);
    });

    it('records guest student check-in with FLAGGED_GUEST reason', async () => {
      const mockCaller: CheckinApiCaller = vi.fn(async () => ({
        success: true,
        student_id: 'stu_guest_01',
        trip_id: tripId,
        status: 'FLAGGED_GUEST' as const,
        reason: 'FLAGGED_GUEST' as const,
        boarded_at: new Date(Date.UTC(2026, 9, 21, 8, 33, 0)).toISOString(),
        message: 'Guest student flagged and boarded',
      }));

      const manager = new DriverCheckinManager(mockCaller);
      manager.setManifest(tripId, initialStudents);

      const checkinDate = new Date(Date.UTC(2026, 9, 21, 8, 33, 0));
      const res = await manager.recordManualCheckin(
        {
          trip_id: tripId,
          student_id: 'stu_guest_01',
          is_guest: true,
          reason: 'FLAGGED_GUEST',
          note: 'Visiting project member',
          stop_id: 'Silk Board Junction',
        },
        { isOnline: true, now: checkinDate },
      );

      expect(res.status).toBe('FLAGGED_GUEST');

      // Guest added to manifest
      const guest = manager.getManifest(tripId).find((s) => s.student_id === 'stu_guest_01');
      expect(guest).toBeDefined();
      expect(guest?.is_guest).toBe(true);
      expect(guest?.status).toBe('FLAGGED_GUEST');

      const summary = manager.getSummary(tripId);
      expect(summary.total_expected).toBe(4);
      expect(summary.total_guests).toBe(1);
    });

    it('handles offline check-in buffering and sequential flush', async () => {
      const manager = new DriverCheckinManager();
      manager.setManifest(tripId, initialStudents);

      const checkinDate = new Date(Date.UTC(2026, 9, 21, 8, 35, 0));
      const res = await manager.recordManualCheckin(
        {
          trip_id: tripId,
          student_id: 'stu_102',
          is_guest: false,
          reason: 'LATE_BOARDED',
        },
        { isOnline: false, now: checkinDate },
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('offline');
      expect(manager.getPendingCount()).toBe(1);

      // Student status updated locally even when offline
      const student = manager.getManifest(tripId).find((s) => s.student_id === 'stu_102');
      expect(student?.status).toBe('LATE_BOARDED');

      // Flush when connectivity restored
      const mockCaller: CheckinApiCaller = vi.fn(async () => ({
        success: true,
        student_id: 'stu_102',
        trip_id: tripId,
        status: 'LATE_BOARDED' as const,
        reason: 'LATE_BOARDED' as const,
        boarded_at: checkinDate.toISOString(),
        message: 'Synced',
      }));

      const flushResult = await manager.flushPending(mockCaller);
      expect(flushResult.synced).toBe(1);
      expect(flushResult.failed).toBe(0);
      expect(manager.getPendingCount()).toBe(0);
      expect(mockCaller).toHaveBeenCalledTimes(1);
    });
  });
});
