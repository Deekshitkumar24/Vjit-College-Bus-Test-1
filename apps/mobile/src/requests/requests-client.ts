import {
  StopChangeSubmissionDto,
  LeaveApplicationSubmissionDto,
  StudentRequestSummaryDto,
  StudentRequestListDtoSchema,
} from '@collegebus/contracts';
import { MobileCacheStore } from '../store/cache-store.js';
import { validateLeaveSubmission, validateStopChangeSubmission } from './request-models.js';

export interface SubmissionResult {
  success: boolean;
  message: string;
  requestId?: string | undefined;
  isOfflineQueued: boolean;
  errors?: Record<string, string> | undefined;
}

export class RequestsClient {
  private readonly baseUrl: string;
  private readonly cacheStore: MobileCacheStore;
  private readonly fetchFn: typeof fetch;

  constructor(options: { baseUrl: string; cacheStore: MobileCacheStore; fetchFn?: typeof fetch }) {
    this.baseUrl = options.baseUrl;
    this.cacheStore = options.cacheStore;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Submits a stop change request, falling back to offline queue on network issues.
   */
  public async submitStopChange(input: unknown, token: string): Promise<SubmissionResult> {
    const validation = validateStopChangeSubmission(input);
    if (!validation.success || !validation.data) {
      return {
        success: false,
        message: 'Validation failed for stop change request',
        isOfflineQueued: false,
        errors: validation.errors,
      };
    }

    const payload: StopChangeSubmissionDto = validation.data;

    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/requests/stop-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = (await res.json()) as { id?: string };
      return {
        success: true,
        message: 'Stop change request submitted successfully',
        requestId: json.id,
        isOfflineQueued: false,
      };
    } catch {
      // Network issue: queue offline
      const offlineId = this.cacheStore.queueOfflineAction(
        'STOP_CHANGE_REQUEST',
        payload as unknown as Record<string, unknown>,
      );

      return {
        success: true,
        message: 'Request saved offline. It will be submitted once connectivity is restored.',
        requestId: offlineId,
        isOfflineQueued: true,
      };
    }
  }

  /**
   * Submits a trip leave application, falling back to offline queue on network issues.
   */
  public async submitLeave(input: unknown, token: string): Promise<SubmissionResult> {
    const validation = validateLeaveSubmission(input);
    if (!validation.success || !validation.data) {
      return {
        success: false,
        message: 'Validation failed for leave application',
        isOfflineQueued: false,
        errors: validation.errors,
      };
    }

    const payload: LeaveApplicationSubmissionDto = validation.data;

    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/requests/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = (await res.json()) as { id?: string };
      return {
        success: true,
        message: 'Leave application submitted successfully',
        requestId: json.id,
        isOfflineQueued: false,
      };
    } catch {
      // Network issue: queue offline
      const offlineId = this.cacheStore.queueOfflineAction(
        'LEAVE_APPLICATION',
        payload as unknown as Record<string, unknown>,
      );

      return {
        success: true,
        message:
          'Leave application saved offline. It will be submitted once connectivity is restored.',
        requestId: offlineId,
        isOfflineQueued: true,
      };
    }
  }

  /**
   * Cancels a pending request.
   */
  public async cancelRequest(
    requestId: string,
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return {
          success: false,
          message: 'Could not cancel request. It may already be processed.',
        };
      }

      return { success: true, message: 'Request cancelled successfully' };
    } catch {
      return { success: false, message: 'Network error. Please try again later.' };
    }
  }

  /**
   * Fetches student request history.
   */
  public async fetchRequestHistory(token: string): Promise<StudentRequestSummaryDto[]> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/requests/my-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return [];
      }

      const json = await res.json();
      const parsed = StudentRequestListDtoSchema.safeParse(json);
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }
}
