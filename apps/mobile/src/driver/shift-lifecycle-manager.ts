import {
  StartShiftDto,
  ShiftClaimDto,
  ActiveShiftResponseDto,
} from '@collegebus/contracts';

export interface ShiftHttpHandler {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface ShiftLifecycleSession {
  driverId: string;
  accessToken: string;
}

export type ShiftLifecycleState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'IDLE_PROMPT'
  | 'ENDING'
  | 'ENDED';

export class ShiftLifecycleManager {
  private state: ShiftLifecycleState = 'IDLE';
  private currentClaim: ShiftClaimDto | null = null;
  private lastMovementAt: Date = new Date();
  private idlePromptActive = false;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly http: ShiftHttpHandler = { fetch: globalThis.fetch },
  ) {}

  getState(): ShiftLifecycleState {
    return this.state;
  }

  getCurrentClaim(): ShiftClaimDto | null {
    return this.currentClaim;
  }

  isIdlePromptActive(): boolean {
    return this.idlePromptActive;
  }

  recordMovement(now: Date = new Date()) {
    this.lastMovementAt = now;
    if (this.idlePromptActive && this.state === 'IDLE_PROMPT') {
      this.idlePromptActive = false;
      this.state = 'ACTIVE';
    }
  }

  /**
   * Starts a shift, or idempotently resumes if mid-shift restart (AC-DRV-04).
   */
  async startShift(
    session: ShiftLifecycleSession,
    dto: StartShiftDto,
  ): Promise<ShiftClaimDto> {
    this.state = 'STARTING';

    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/shifts/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-driver-id': session.driverId,
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      this.state = 'IDLE';
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Failed to start shift');
    }

    const claim = (await response.json()) as ShiftClaimDto;
    this.currentClaim = claim;
    this.state = 'ACTIVE';
    this.lastMovementAt = new Date();
    this.idlePromptActive = false;
    return claim;
  }

  /**
   * Resumes active shift on app launch / mid-shift app restart (AC-DRV-04).
   * Restores claim within seconds with zero shift duplication.
   */
  async resumeActiveShift(
    session: ShiftLifecycleSession,
  ): Promise<ShiftClaimDto | null> {
    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/shifts/active`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'x-driver-id': session.driverId,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ActiveShiftResponseDto;
    if (data.has_active_shift && data.shift) {
      this.currentClaim = {
        shift_id: data.shift.shift_id,
        bus_id: data.shift.bus_id,
        driver_id: data.shift.driver_id,
        route_id: data.shift.route_id,
        trip_id: data.shift.trip_id,
        started_at: data.shift.started_at,
      };
      this.state = 'ACTIVE';
      if (data.shift.idle_warning) {
        this.state = 'IDLE_PROMPT';
        this.idlePromptActive = true;
      }
      return this.currentClaim;
    }

    this.currentClaim = null;
    this.state = 'IDLE';
    return null;
  }

  /**
   * Checks client-side idle threshold (20m no movement) and 14h timeout (§15.4).
   */
  checkPeriodicStatus(now: Date = new Date()): {
    idleWarning: boolean;
    timeoutWarning: boolean;
  } {
    if (this.state !== 'ACTIVE' && this.state !== 'IDLE_PROMPT') {
      return { idleWarning: false, timeoutWarning: false };
    }

    const idleMs = now.getTime() - this.lastMovementAt.getTime();
    if (idleMs >= 20 * 60 * 1000) {
      this.state = 'IDLE_PROMPT';
      this.idlePromptActive = true;
    }

    let timeoutWarning = false;
    if (this.currentClaim) {
      const elapsedMs = now.getTime() - new Date(this.currentClaim.started_at).getTime();
      if (elapsedMs >= 13.5 * 3600 * 1000) {
        timeoutWarning = true;
      }
    }

    return {
      idleWarning: this.idlePromptActive,
      timeoutWarning,
    };
  }

  /**
   * Acknowledges idle prompt without moving vehicle.
   */
  acknowledgeIdle(now: Date = new Date()) {
    this.lastMovementAt = now;
    this.idlePromptActive = false;
    if (this.state === 'IDLE_PROMPT') {
      this.state = 'ACTIVE';
    }
  }

  /**
   * Ends shift manually or automatically (§15.4).
   */
  async endShift(
    session: ShiftLifecycleSession,
    reason: 'MANUAL' | 'AUTO_IDLE' | 'TIMEOUT' | 'ADMIN' = 'MANUAL',
    note?: string,
  ): Promise<{ status: string; ended_at: string }> {
    if (!this.currentClaim) {
      throw new Error('No active shift to end');
    }

    this.state = 'ENDING';

    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/shifts/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-driver-id': session.driverId,
      },
      body: JSON.stringify({
        shift_id: this.currentClaim.shift_id,
        reason,
        note,
      }),
    });

    if (!response.ok) {
      this.state = 'ACTIVE';
      const err = await response.json().catch(() => ({}));
      const code = (err as { code?: string }).code;
      if (code === 'SOS_INCIDENT_OPEN') {
        throw new Error(
          'SOS_INCIDENT_OPEN: Driver cannot end shift while SOS incident is open for this bus',
        );
      }
      throw new Error((err as { message?: string }).message || 'Failed to end shift');
    }

    const result = (await response.json()) as { status: string; ended_at: string };
    this.state = 'ENDED';
    this.currentClaim = null;
    this.idlePromptActive = false;
    return result;
  }
}
