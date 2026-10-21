import {
  SosCategory,
  SosTriggerRequestDto,
  SosTriggerResponseDto,
  SosTriggerResponseDtoSchema,
  SosTriggerType,
} from '@collegebus/contracts';
import { LatLng } from '@collegebus/domain';
import { MobileCacheStore } from '../store/cache-store.js';

export interface ActiveSosState {
  isActive: boolean;
  incidentId: string | null;
  category: SosCategory;
  dispatchedAt: string | null;
  securityHotline: string;
  isAcknowledged: boolean;
  isOfflineQueued: boolean;
}

export const CAMPUS_SECURITY_HOTLINE = '+91-80-2345-6789';

export class SosClient {
  private readonly baseUrl: string;
  private readonly cacheStore: MobileCacheStore;
  private readonly fetchFn: typeof fetch;

  constructor(options: { baseUrl: string; cacheStore: MobileCacheStore; fetchFn?: typeof fetch }) {
    this.baseUrl = options.baseUrl;
    this.cacheStore = options.cacheStore;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Dispatches an emergency SOS incident with captured GPS coordinates.
   */
  public async dispatchSos(params: {
    category: SosCategory;
    triggerType: SosTriggerType;
    token: string;
    location?: LatLng | undefined;
    accuracyM?: number | undefined;
    tripId?: string | undefined;
    busId?: string | undefined;
    note?: string | undefined;
    clientTimestamp?: string | undefined;
  }): Promise<ActiveSosState> {
    const nowIso = params.clientTimestamp ?? new Date().toISOString();

    const requestPayload: SosTriggerRequestDto = {
      category: params.category,
      trigger_type: params.triggerType,
      client_timestamp: nowIso,
      ...(params.tripId ? { trip_id: params.tripId } : {}),
      ...(params.busId ? { bus_id: params.busId } : {}),
      ...(params.location ? { lat: params.location.lat, lng: params.location.lng } : {}),
      ...(params.accuracyM ? { accuracy_m: params.accuracyM } : {}),
      ...(params.note ? { note: params.note } : {}),
    };

    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/sos/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        throw new Error(`SOS dispatch failed: HTTP ${res.status}`);
      }

      const json = await res.json();
      const parsed: SosTriggerResponseDto = SosTriggerResponseDtoSchema.parse(json);

      return {
        isActive: true,
        incidentId: parsed.incident_id,
        category: parsed.category,
        dispatchedAt: parsed.dispatched_at,
        securityHotline: parsed.security_phone || CAMPUS_SECURITY_HOTLINE,
        isAcknowledged: parsed.status === 'RESPONDING',
        isOfflineQueued: false,
      };
    } catch {
      // Offline fallback: queue offline and activate emergency state with direct hotline
      const offlineId = this.cacheStore.queueOfflineAction(
        'ATTENDANCE_SCAN', // queued for synchronization
        requestPayload as unknown as Record<string, unknown>,
      );

      return {
        isActive: true,
        incidentId: offlineId,
        category: params.category,
        dispatchedAt: nowIso,
        securityHotline: CAMPUS_SECURITY_HOTLINE,
        isAcknowledged: false,
        isOfflineQueued: true,
      };
    }
  }

  /**
   * Cancels a false alarm.
   */
  public async cancelSos(
    incidentId: string,
    reason: string,
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/sos/incident/${incidentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ incident_id: incidentId, reason }),
      });

      if (!res.ok) {
        return {
          success: false,
          message: 'Could not cancel incident. Contact security desk directly.',
        };
      }

      return { success: true, message: 'SOS incident cancelled. False alarm logged.' };
    } catch {
      return { success: false, message: 'Network error. Please call security hotline.' };
    }
  }
}
