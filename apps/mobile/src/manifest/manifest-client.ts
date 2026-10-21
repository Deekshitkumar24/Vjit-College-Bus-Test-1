import {
  TripManifestResponseDto,
  TripManifestResponseDtoSchema,
  ManualAttendanceToggleRequestDto,
} from '@collegebus/contracts';
import { MobileCacheStore } from '../store/cache-store.js';
import { evaluateMorningPresentAfternoonAbsentDiscrepancies } from './safety-evaluator.js';

export interface ManifestFetchResult {
  success: boolean;
  manifest: TripManifestResponseDto | null;
  message: string;
}

export class ManifestClient {
  private readonly baseUrl: string;
  private readonly cacheStore: MobileCacheStore;
  private readonly fetchFn: typeof fetch;

  constructor(options: { baseUrl: string; cacheStore: MobileCacheStore; fetchFn?: typeof fetch }) {
    this.baseUrl = options.baseUrl;
    this.cacheStore = options.cacheStore;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Fetches the live manifest for a trip, calculating D-12 morning discrepancies.
   */
  public async fetchTripManifest(
    tripId: string,
    token: string,
    isDepartedOrPastDepartureTime: boolean = false,
  ): Promise<ManifestFetchResult> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/manifest/${tripId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
      }

      const json = await res.json();
      const parsed: TripManifestResponseDto = TripManifestResponseDtoSchema.parse(json);

      // Re-evaluate client-side D-12 alerts with live departure context
      const discrepancies = evaluateMorningPresentAfternoonAbsentDiscrepancies({
        tripId,
        tripType: parsed.trip_type,
        students: parsed.students,
        isDepartedOrPastDepartureTime,
      });

      const updatedManifest: TripManifestResponseDto = {
        ...parsed,
        safety_discrepancies: discrepancies,
      };

      return {
        success: true,
        manifest: updatedManifest,
        message: 'Manifest loaded successfully',
      };
    } catch {
      return {
        success: false,
        manifest: null,
        message: 'Could not load passenger manifest. Check network connectivity.',
      };
    }
  }

  /**
   * Manually toggles a student's attendance on the manifest (e.g. manual boarding check-in).
   */
  public async toggleManualAttendance(
    params: ManualAttendanceToggleRequestDto,
    token: string,
  ): Promise<{ success: boolean; message: string; isOfflineQueued: boolean }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/manifest/${params.trip_id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      return {
        success: true,
        message: `Attendance updated to ${params.target_status}`,
        isOfflineQueued: false,
      };
    } catch {
      // Queue offline toggle
      this.cacheStore.queueOfflineAction(
        'ATTENDANCE_SCAN',
        params as unknown as Record<string, unknown>,
      );

      return {
        success: true,
        message: 'Manual check-in saved locally and queued for synchronization.',
        isOfflineQueued: true,
      };
    }
  }
}
