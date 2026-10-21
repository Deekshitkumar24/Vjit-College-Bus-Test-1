import {
  DriverTrackingMode,
  DriverModeSwitchRequestDto,
  DriverModeSwitchResponseDto,
} from '@collegebus/contracts';

export type { DriverTrackingMode };

export interface ModeSwitcherHttpHandler {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface DriverModeSwitcherSession {
  driverId: string;
  accessToken: string;
  shiftId: string;
}

export interface ModeSwitchPendingState {
  targetMode: DriverTrackingMode;
  note?: string | undefined;
}

export interface ModeIndicatorMetadata {
  mode: DriverTrackingMode;
  label: string;
  badge: string;
  description: string;
}

export class DriverModeSwitcher {
  private currentMode: DriverTrackingMode = 'AUTO'; // Default AUTO per D-13
  private pendingSwitch: ModeSwitchPendingState | null = null;
  private lastSwitchedAt: string | null = null;
  private lastNote: string | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly http: ModeSwitcherHttpHandler = { fetch: globalThis.fetch },
  ) {}

  getCurrentMode(): DriverTrackingMode {
    return this.currentMode;
  }

  setModeForTesting(mode: DriverTrackingMode): void {
    this.currentMode = mode;
  }

  getPendingSwitch(): ModeSwitchPendingState | null {
    return this.pendingSwitch ? { ...this.pendingSwitch } : null;
  }

  getLastSwitchedAt(): string | null {
    return this.lastSwitchedAt;
  }

  getLastNote(): string | null {
    return this.lastNote;
  }

  /**
   * Prepares a mode switch request requiring user confirmation.
   * Validates optional reason note length (max 140 chars per SW-MVP-1.0 §16.3 #6).
   */
  requestSwitch(
    targetMode: DriverTrackingMode,
    note?: string | undefined,
  ): {
    requiresConfirmation: boolean;
    pending: ModeSwitchPendingState | null;
    error?: string | undefined;
  } {
    if (note && note.length > 140) {
      return {
        requiresConfirmation: false,
        pending: null,
        error: 'Reason note cannot exceed 140 characters',
      };
    }

    if (targetMode === this.currentMode) {
      return {
        requiresConfirmation: false,
        pending: null,
      };
    }

    this.pendingSwitch = {
      targetMode,
      note: note ? note.trim() : undefined,
    };

    return {
      requiresConfirmation: true,
      pending: { ...this.pendingSwitch },
    };
  }

  /**
   * Cancels pending confirmation sheet.
   */
  cancelSwitch(): void {
    this.pendingSwitch = null;
  }

  /**
   * Confirms and applies the mode switch by calling POST /api/v1/driver/mode.
   */
  async confirmSwitch(
    session: DriverModeSwitcherSession,
  ): Promise<DriverModeSwitchResponseDto> {
    if (!this.pendingSwitch) {
      throw new Error('No pending mode switch to confirm');
    }

    const payload: DriverModeSwitchRequestDto = {
      mode: this.pendingSwitch.targetMode,
      shift_id: session.shiftId,
      note: this.pendingSwitch.note,
    };

    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/driver/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-driver-id': session.driverId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || `Mode switch failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as DriverModeSwitchResponseDto;
    this.currentMode = data.mode;
    this.lastSwitchedAt = data.updated_at;
    this.lastNote = data.note ?? null;
    this.pendingSwitch = null;

    return data;
  }

  /**
   * Returns active mode indicator metadata for the top navigation bar (§16.3 #6).
   */
  getActiveModeIndicator(): ModeIndicatorMetadata {
    switch (this.currentMode) {
      case 'AUTO':
        return {
          mode: 'AUTO',
          label: 'Auto (Default)',
          badge: 'Auto · Intelligent Failover',
          description: 'Hardware primary with automated phone GPS fallback',
        };
      case 'HARDWARE':
        return {
          mode: 'HARDWARE',
          label: 'Hardware Tracker',
          badge: 'Hardware Only',
          description: 'Bus tracker GNSS unit only, phone GPS standby',
        };
      case 'PHONE':
        return {
          mode: 'PHONE',
          label: 'Phone Tracking',
          badge: 'Driver Phone Live',
          description: 'Manual phone GPS broadcasting directly to students',
        };
    }
  }
}
