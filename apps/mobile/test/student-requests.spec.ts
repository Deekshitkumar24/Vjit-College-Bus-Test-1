import { describe, expect, it } from 'vitest';
import {
  resolveRequestBadge,
  validateLeaveSubmission,
  validateStopChangeSubmission,
  formatRequestItemForDisplay,
} from '../src/requests/request-models.js';
import { RequestsClient } from '../src/requests/requests-client.js';
import { MobileCacheStore } from '../src/store/cache-store.js';
import { StudentRequestSummaryDto } from '@collegebus/contracts';

describe('P2-T5: Student Requests & Leave Module Suite', () => {
  const validStopId = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';
  const validRequestId = 'a9b8c7d6-e5f4-4321-9876-54321abcdef0';

  describe('Form Validation Logic', () => {
    it('validates a correct stop change request', () => {
      const validForm = {
        target_stop_id: validStopId,
        request_type: 'TEMPORARY',
        effective_date: '2026-11-01',
        end_date: '2026-11-15',
        reason: 'Temporary relocation due to annual college sports fest practice',
      };

      const result = validateStopChangeSubmission(validForm);
      expect(result.success).toBe(true);
      expect(result.data?.target_stop_id).toBe(validStopId);
      expect(result.data?.request_type).toBe('TEMPORARY');
    });

    it('rejects invalid stop change form with missing required fields or invalid date format', () => {
      const invalidForm = {
        target_stop_id: 'invalid-uuid',
        request_type: 'INVALID_TYPE',
        effective_date: '01/11/2026', // invalid date format
        reason: 'Hi', // too short
      };

      const result = validateStopChangeSubmission(invalidForm);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.['target_stop_id']).toBeDefined();
      expect(result.errors?.['request_type']).toBeDefined();
      expect(result.errors?.['effective_date']).toBeDefined();
      expect(result.errors?.['reason']).toBeDefined();
    });

    it('validates a correct trip leave application', () => {
      const validLeave = {
        service_date: '2026-11-02',
        trip_type: 'MORNING',
        reason_category: 'MEDICAL',
        note: 'Scheduled dental appointment in the morning',
      };

      const result = validateLeaveSubmission(validLeave);
      expect(result.success).toBe(true);
      expect(result.data?.trip_type).toBe('MORNING');
      expect(result.data?.reason_category).toBe('MEDICAL');
    });

    it('rejects leave application missing required fields', () => {
      const invalidLeave = {
        trip_type: 'INVALID_TRIP',
      };

      const result = validateLeaveSubmission(invalidLeave);
      expect(result.success).toBe(false);
      expect(result.errors?.['service_date']).toBeDefined();
      expect(result.errors?.['reason_category']).toBeDefined();
    });
  });

  describe('Badge Presenter & Item Formatter', () => {
    it('resolves appropriate tone and actionable status for all request statuses', () => {
      expect(resolveRequestBadge('PENDING')).toEqual({
        tone: 'AMBER',
        label: 'Under Review',
        isActionable: true,
      });

      expect(resolveRequestBadge('APPROVED')).toEqual({
        tone: 'GREEN',
        label: 'Approved',
        isActionable: false,
      });

      expect(resolveRequestBadge('REJECTED')).toEqual({
        tone: 'RED',
        label: 'Declined',
        isActionable: false,
      });

      expect(resolveRequestBadge('CANCELLED')).toEqual({
        tone: 'GRAY',
        label: 'Cancelled',
        isActionable: false,
      });
    });

    it('formats display item correctly with cancellation permissions', () => {
      const item: StudentRequestSummaryDto = {
        id: validRequestId,
        type: 'STOP_CHANGE',
        title: 'Stop Change to Metro Station',
        status: 'PENDING',
        status_label: 'Pending Approval',
        created_at: '2026-10-21T09:00:00Z',
        effective_date: '2026-11-01',
        reason_snippet: 'Relocating to indiranagar',
        can_cancel: true,
      };

      const formatted = formatRequestItemForDisplay(item);
      expect(formatted.id).toBe(validRequestId);
      expect(formatted.badge.tone).toBe('AMBER');
      expect(formatted.canCancel).toBe(true);
      expect(formatted.dateLabel).toBe('Effective: 2026-11-01');
    });
  });

  describe('RequestsClient Online and Offline Operations', () => {
    it('submits stop change online and returns response', async () => {
      const cacheStore = new MobileCacheStore();
      const mockFetch: typeof fetch = async () =>
        new Response(JSON.stringify({ id: validRequestId }), { status: 200 });

      const client = new RequestsClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const res = await client.submitStopChange(
        {
          target_stop_id: validStopId,
          request_type: 'PERMANENT',
          effective_date: '2026-11-01',
          reason: 'Permanent address change to South Bangalore',
        },
        'token-123',
      );

      expect(res.success).toBe(true);
      expect(res.isOfflineQueued).toBe(false);
      expect(res.requestId).toBe(validRequestId);
      expect(cacheStore.getPendingQueue().length).toBe(0);
    });

    it('enqueues stop change offline on network disconnection', async () => {
      const cacheStore = new MobileCacheStore();
      const offlineFetch: typeof fetch = async () => {
        throw new Error('No network connection');
      };

      const client = new RequestsClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: offlineFetch,
      });

      const res = await client.submitStopChange(
        {
          target_stop_id: validStopId,
          request_type: 'PERMANENT',
          effective_date: '2026-11-01',
          reason: 'Permanent address change to South Bangalore',
        },
        'token-123',
      );

      expect(res.success).toBe(true);
      expect(res.isOfflineQueued).toBe(true);
      expect(cacheStore.getPendingQueue().length).toBe(1);
      expect(cacheStore.getPendingQueue()[0]?.type).toBe('STOP_CHANGE_REQUEST');
    });

    it('submits leave application online and falls back offline when unreachable', async () => {
      const cacheStore = new MobileCacheStore();
      let shouldFail = false;

      const mockFetch: typeof fetch = async () => {
        if (shouldFail) throw new Error('Offline');
        return new Response(JSON.stringify({ id: 'leave-rec-987' }), { status: 200 });
      };

      const client = new RequestsClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      // Online run
      const onlineRes = await client.submitLeave(
        {
          service_date: '2026-11-05',
          trip_type: 'BOTH',
          reason_category: 'PERSONAL',
          note: 'Family emergency trip home',
        },
        'token-123',
      );
      expect(onlineRes.success).toBe(true);
      expect(onlineRes.isOfflineQueued).toBe(false);

      // Offline run
      shouldFail = true;
      const offlineRes = await client.submitLeave(
        {
          service_date: '2026-11-06',
          trip_type: 'MORNING',
          reason_category: 'ACADEMIC',
          note: 'Attending off-campus symposium',
        },
        'token-123',
      );
      expect(offlineRes.success).toBe(true);
      expect(offlineRes.isOfflineQueued).toBe(true);
      expect(cacheStore.getPendingQueue().length).toBe(1);
      expect(cacheStore.getPendingQueue()[0]?.type).toBe('LEAVE_APPLICATION');
    });

    it('cancels a pending request successfully', async () => {
      const cacheStore = new MobileCacheStore();
      const mockFetch: typeof fetch = async () => new Response(null, { status: 200 });

      const client = new RequestsClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const res = await client.cancelRequest(validRequestId, 'token-123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('cancelled successfully');
    });

    it('fetches student request history safely', async () => {
      const cacheStore = new MobileCacheStore();
      const historyItems: StudentRequestSummaryDto[] = [
        {
          id: validRequestId,
          type: 'STOP_CHANGE',
          title: 'Stop Change to Metro Station',
          status: 'APPROVED',
          status_label: 'Approved',
          created_at: '2026-10-21T09:00:00Z',
          effective_date: '2026-11-01',
          reason_snippet: 'Relocating to indiranagar',
          can_cancel: false,
        },
      ];

      const mockFetch: typeof fetch = async () =>
        new Response(JSON.stringify(historyItems), { status: 200 });

      const client = new RequestsClient({
        baseUrl: 'http://localhost:3000',
        cacheStore,
        fetchFn: mockFetch,
      });

      const history = await client.fetchRequestHistory('token-123');
      expect(history).toHaveLength(1);
      expect(history[0]?.id).toBe(validRequestId);
      expect(history[0]?.status).toBe('APPROVED');
    });
  });
});
