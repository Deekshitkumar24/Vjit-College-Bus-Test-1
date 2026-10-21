import { describe, expect, it } from 'vitest';
import { GuardedHoldTrigger } from '../src/sos/hold-gesture.js';
import { SosClient, CAMPUS_SECURITY_HOTLINE } from '../src/sos/sos-client.js';
import { MobileCacheStore } from '../src/store/cache-store.js';

describe('P2-T7: Emergency SOS Trigger Suite (L-2 & 3s Guarded Hold)', () => {
  const incidentId = 'c8b7a6d5-e4f3-4210-9876-123456789abc';
  const tripId = 'a1b2c3d4-e5f6-4a7b-8c9d-1e2f3a4b5c6d';
  const busId = 'b2c3d4e5-f6a7-4b8c-9d1e-2f3a4b5c6d7e';

  describe('Guarded 3-Second Hold Gesture Controller', () => {
    it('initializes in idle state', () => {
      const trigger = new GuardedHoldTrigger(3000);
      const state = trigger.getState();

      expect(state.isHolding).toBe(false);
      expect(state.isTriggered).toBe(false);
      expect(state.progressFraction).toBe(0.0);
      expect(state.label).toContain('Hold for 3 seconds');
    });

    it('cancels safely if released before 3000ms threshold', () => {
      const trigger = new GuardedHoldTrigger(3000);
      const startMs = 1_000_000;

      trigger.pressDown(startMs);

      // 1.5 seconds elapsed (50% progress)
      const midState = trigger.updateProgress(startMs + 1500);
      expect(midState.isHolding).toBe(true);
      expect(midState.progressFraction).toBe(0.5);
      expect(midState.isTriggered).toBe(false);
      expect(midState.label).toContain('Keep holding... 2s');

      // User releases at 2.2 seconds (before 3s)
      const releaseResult = trigger.release(startMs + 2200);
      expect(releaseResult.wasTriggered).toBe(false);

      const postReleaseState = trigger.getState(startMs + 2500);
      expect(postReleaseState.isHolding).toBe(false);
      expect(postReleaseState.isTriggered).toBe(false);
      expect(postReleaseState.progressFraction).toBe(0.0);
    });

    it('triggers SOS when held continuously for >= 3000ms', () => {
      const trigger = new GuardedHoldTrigger(3000);
      const startMs = 1_000_000;

      trigger.pressDown(startMs);

      // 3.1 seconds elapsed
      const trigState = trigger.updateProgress(startMs + 3100);
      expect(trigState.isTriggered).toBe(true);
      expect(trigState.progressFraction).toBe(1.0);
      expect(trigState.label).toContain('SOS Triggered');

      // Release after trigger preserves triggered state
      const releaseResult = trigger.release(startMs + 3500);
      expect(releaseResult.wasTriggered).toBe(true);
      expect(releaseResult.state.isTriggered).toBe(true);

      // Explicit reset returns to idle
      trigger.reset();
      expect(trigger.getState().isTriggered).toBe(false);
    });
  });

  describe('SosClient Incident Dispatch & Category Routing (L-2)', () => {
    it('dispatches EMERGENCY incident online with GPS coordinates and receives security hotline', async () => {
      const cacheStore = new MobileCacheStore();
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            incident_id: incidentId,
            status: 'OPEN',
            category: 'EMERGENCY',
            dispatched_at: '2026-10-21T16:00:00.000Z',
            security_phone: CAMPUS_SECURITY_HOTLINE,
            message: 'Campus security desk notified. Mobile response unit dispatched.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );

      const client = new SosClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const outcome = await client.dispatchSos({
        category: 'EMERGENCY',
        triggerType: 'STUDENT_APP',
        token: 'token-stu-1',
        location: { lat: 12.9716, lng: 77.5946 },
        accuracyM: 8.5,
        tripId,
        busId,
      });

      expect(outcome.isActive).toBe(true);
      expect(outcome.incidentId).toBe(incidentId);
      expect(outcome.category).toBe('EMERGENCY');
      expect(outcome.securityHotline).toBe(CAMPUS_SECURITY_HOTLINE);
      expect(outcome.isOfflineQueued).toBe(false);
      expect(cacheStore.getPendingQueue().length).toBe(0);
    });

    it('supports specific categories: MEDICAL, BREAKDOWN, OTHER per Locked Decision L-2', async () => {
      const cacheStore = new MobileCacheStore();
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            incident_id: incidentId,
            status: 'RESPONDING',
            category: 'MEDICAL',
            dispatched_at: '2026-10-21T16:05:00.000Z',
            security_phone: '+91-80-9999-1111',
            message: 'Campus ambulance alert dispatched.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );

      const client = new SosClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const outcome = await client.dispatchSos({
        category: 'MEDICAL',
        triggerType: 'FACULTY_APP',
        token: 'token-fac-1',
        note: 'Student requires immediate medical attention',
      });

      expect(outcome.category).toBe('MEDICAL');
      expect(outcome.isAcknowledged).toBe(true);
      expect(outcome.securityHotline).toBe('+91-80-9999-1111');
    });

    it('enqueues SOS offline during total connectivity loss and activates emergency guidance', async () => {
      const cacheStore = new MobileCacheStore();
      const offlineFetch: typeof fetch = async () => {
        throw new Error('No cellular or data network');
      };

      const client = new SosClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: offlineFetch,
      });

      const outcome = await client.dispatchSos({
        category: 'EMERGENCY',
        triggerType: 'STUDENT_APP',
        token: 'token-stu-offline',
        location: { lat: 12.9716, lng: 77.5946 },
      });

      expect(outcome.isActive).toBe(true);
      expect(outcome.isOfflineQueued).toBe(true);
      expect(outcome.securityHotline).toBe(CAMPUS_SECURITY_HOTLINE);
      expect(cacheStore.getPendingQueue().length).toBe(1);
    });

    it('allows cancelling false alarms with audit reason', async () => {
      const cacheStore = new MobileCacheStore();
      const mockFetch: typeof fetch = async () => new Response(null, { status: 200 });

      const client = new SosClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const result = await client.cancelSos(
        incidentId,
        'Accidental trigger during bag retrieval',
        'token-stu-1',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('False alarm logged');
    });
  });
});
