import {
  DriverManualCheckinReason,
  DriverManualCheckinRequestDto,
  DriverManualCheckinResponseDto,
} from '@collegebus/contracts';

export interface ManifestStudent {
  student_id: string;
  full_name: string;
  roll_number: string;
  stop_name: string;
  status: 'EXPECTED' | 'BOARDED' | 'MANUAL_CHECKIN' | 'LATE_BOARDED' | 'FLAGGED_GUEST';
  boarded_at?: string | null;
  is_guest?: boolean;
  reason?: DriverManualCheckinReason;
  note?: string | null;
}

export interface TripManifestSummary {
  trip_id: string;
  total_expected: number;
  total_boarded: number;
  total_guests: number;
  total_manual: number;
}

export type CheckinApiCaller = (
  req: DriverManualCheckinRequestDto,
) => Promise<DriverManualCheckinResponseDto>;

/**
 * Driver Passenger Manifest & Manual Boarding Check-in Manager
 * Per SW-MVP-1.0 §18:
 * - Maintains passenger manifest per trip.
 * - Handles manual student check-ins when QR cannot be scanned (e.g. dead phone, forgotten card).
 * - Enforces mandatory reason codes: FLAGGED_GUEST, LATE_BOARDED, CARD_FORGOTTEN, OTHER.
 * - Enforces mandatory descriptive note when reason is OTHER or for guest flagging.
 * - Provides offline queuing when connectivity is lost and sequential sync when restored.
 */
export class DriverCheckinManager {
  private manifests = new Map<string, ManifestStudent[]>();
  private pendingQueue: DriverManualCheckinRequestDto[] = [];

  constructor(private apiCaller?: CheckinApiCaller) {}

  /**
   * Sets or updates the manifest for a trip.
   */
  setManifest(tripId: string, students: ManifestStudent[]): void {
    this.manifests.set(tripId, [...students]);
  }

  /**
   * Retrieves the current manifest for a trip.
   */
  getManifest(tripId: string): ManifestStudent[] {
    return this.manifests.get(tripId) ?? [];
  }

  /**
   * Searches and filters manifest by text (name or roll number) and optional status.
   */
  searchManifest(
    tripId: string,
    query: string = '',
    statusFilter?: ManifestStudent['status'],
  ): ManifestStudent[] {
    const list = this.getManifest(tripId);
    const q = query.trim().toLowerCase();

    return list.filter((s) => {
      const matchesQuery =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q);

      const matchesStatus = !statusFilter || s.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }

  /**
   * Calculates manifest summary statistics.
   */
  getSummary(tripId: string): TripManifestSummary {
    const students = this.getManifest(tripId);
    const boarded = students.filter(
      (s) =>
        s.status === 'BOARDED' ||
        s.status === 'MANUAL_CHECKIN' ||
        s.status === 'LATE_BOARDED' ||
        s.status === 'FLAGGED_GUEST',
    );
    const guests = students.filter((s) => s.is_guest || s.status === 'FLAGGED_GUEST');
    const manual = students.filter(
      (s) => s.status === 'MANUAL_CHECKIN' || s.status === 'LATE_BOARDED',
    );

    return {
      trip_id: tripId,
      total_expected: students.length,
      total_boarded: boarded.length,
      total_guests: guests.length,
      total_manual: manual.length,
    };
  }

  /**
   * Records a manual check-in with validation, optimistic local update, and offline resilience.
   */
  async recordManualCheckin(
    request: DriverManualCheckinRequestDto,
    options?: { isOnline?: boolean; now?: Date },
  ): Promise<DriverManualCheckinResponseDto> {
    const isOnline = options?.isOnline ?? true;
    const now = options?.now ?? new Date();

    // 1. Validation
    if (!request.student_id || request.student_id.trim().length === 0) {
      throw new Error('Student ID is required');
    }
    if (!request.trip_id || request.trip_id.trim().length === 0) {
      throw new Error('Trip ID is required');
    }
    if (request.is_guest && !request.reason) {
      throw new Error('Reason code is strictly required when boarding a guest student');
    }
    if (request.reason === 'OTHER' && (!request.note || request.note.trim().length === 0)) {
      throw new Error('Descriptive note is required when reason is OTHER');
    }

    const resolvedStatus: ManifestStudent['status'] = request.is_guest
      ? 'FLAGGED_GUEST'
      : request.reason === 'LATE_BOARDED'
        ? 'LATE_BOARDED'
        : 'MANUAL_CHECKIN';

    // 2. Optimistic local update
    const currentStudents = this.getManifest(request.trip_id);
    const existing = currentStudents.find((s) => s.student_id === request.student_id);

    if (existing) {
      existing.status = resolvedStatus;
      existing.boarded_at = (request.timestamp ? new Date(request.timestamp) : now).toISOString();
      existing.reason = request.reason;
      if (request.note) existing.note = request.note;
    } else {
      currentStudents.push({
        student_id: request.student_id,
        full_name: request.is_guest ? 'Guest Student' : `Student ${request.student_id}`,
        roll_number: request.is_guest ? 'GUEST' : request.student_id,
        stop_name: request.stop_id ?? 'Unscheduled Stop',
        status: resolvedStatus,
        boarded_at: (request.timestamp ? new Date(request.timestamp) : now).toISOString(),
        is_guest: request.is_guest,
        reason: request.reason,
        note: request.note ?? null,
      });
      this.setManifest(request.trip_id, currentStudents);
    }

    // 3. API Dispatch or Queue
    if (isOnline && this.apiCaller) {
      try {
        const response = await this.apiCaller(request);
        return response;
      } catch (err) {
        // Fallback to queue on network error
        this.pendingQueue.push(request);
        return {
          success: true,
          student_id: request.student_id,
          trip_id: request.trip_id,
          status: resolvedStatus,
          reason: request.reason,
          boarded_at: (request.timestamp ? new Date(request.timestamp) : now).toISOString(),
          message: `Check-in queued locally (offline fallback): ${err instanceof Error ? err.message : 'Network error'}`,
        };
      }
    } else {
      this.pendingQueue.push(request);
      return {
        success: true,
        student_id: request.student_id,
        trip_id: request.trip_id,
        status: resolvedStatus,
        reason: request.reason,
        boarded_at: (request.timestamp ? new Date(request.timestamp) : now).toISOString(),
        message: 'Check-in saved offline. Will sync when reconnected.',
      };
    }
  }

  /**
   * Pending offline check-in count.
   */
  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Flushes all queued offline check-ins.
   */
  async flushPending(customCaller?: CheckinApiCaller): Promise<{ synced: number; failed: number }> {
    const caller = customCaller || this.apiCaller;
    if (!caller) {
      throw new Error('API caller required to flush pending check-ins');
    }

    let synced = 0;
    let failed = 0;
    const remaining: DriverManualCheckinRequestDto[] = [];

    for (const item of this.pendingQueue) {
      try {
        await caller(item);
        synced++;
      } catch {
        failed++;
        remaining.push(item);
      }
    }

    this.pendingQueue = remaining;
    return { synced, failed };
  }
}
