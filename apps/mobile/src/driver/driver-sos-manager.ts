import {
  SosCategory,
  SosIncidentStatus,
  SosTriggerResponseDto,
} from '@collegebus/contracts';
import { GuardedHoldTrigger, HoldProgressState } from '../sos/hold-gesture.js';

export interface DriverSosHttpHandler {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface DriverSosSession {
  driverId: string;
  accessToken: string;
  shiftId: string;
}

export type DriverSosProgressStep = 'RECEIVED' | 'NOTIFIED' | 'ACKNOWLEDGED';

export interface DriverSosActiveState {
  incidentId: string;
  category: SosCategory;
  step: DriverSosProgressStep;
  status: SosIncidentStatus;
  dispatchedAt: string;
  securityPhone: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  stepLabel: string;
}

export class DriverSosManager {
  private readonly holdTrigger: GuardedHoldTrigger;
  private selectedCategory: SosCategory = 'EMERGENCY'; // Default L-2 category
  private activeIncident: DriverSosActiveState | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly http: DriverSosHttpHandler = { fetch: globalThis.fetch },
  ) {
    // 2-second hold trigger specifically calibrated for driver SOS per SW-MVP-1.0 §16.3 #7
    this.holdTrigger = new GuardedHoldTrigger(2000);
  }

  getHoldTrigger(): GuardedHoldTrigger {
    return this.holdTrigger;
  }

  pressDown(nowMs: number = Date.now()): HoldProgressState {
    return this.holdTrigger.pressDown(nowMs);
  }

  updateProgress(nowMs: number = Date.now()): HoldProgressState {
    return this.holdTrigger.updateProgress(nowMs);
  }

  release(nowMs: number = Date.now()): { wasTriggered: boolean; state: HoldProgressState } {
    return this.holdTrigger.release(nowMs);
  }

  selectCategory(category: SosCategory): void {
    this.selectedCategory = category;
  }

  getSelectedCategory(): SosCategory {
    return this.selectedCategory;
  }

  getActiveIncident(): DriverSosActiveState | null {
    return this.activeIncident ? { ...this.activeIncident } : null;
  }

  /**
   * Triggers the driver SOS emergency after the 2-second hold is confirmed.
   */
  async triggerSos(
    session: DriverSosSession,
    location?: { lat: number; lng: number; accuracy_m?: number } | undefined,
    note?: string | undefined,
  ): Promise<DriverSosActiveState> {
    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/driver/sos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-driver-id': session.driverId,
        'x-shift-id': session.shiftId,
      },
      body: JSON.stringify({
        shift_id: session.shiftId,
        category: this.selectedCategory,
        lat: location?.lat,
        lng: location?.lng,
        accuracy_m: location?.accuracy_m,
        note,
      }),
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || `SOS dispatch failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as SosTriggerResponseDto;

    this.activeIncident = {
      incidentId: data.incident_id,
      category: data.category,
      step: 'RECEIVED',
      status: data.status,
      dispatchedAt: data.dispatched_at,
      securityPhone: data.security_phone,
      acknowledgedBy: null,
      acknowledgedAt: null,
      stepLabel: 'Received by server',
    };

    return { ...this.activeIncident };
  }

  /**
   * Polls or synchronizes incident status from server.
   * Progresses through: 'Received by server' -> 'Faculty notified' -> 'Acknowledged by [name]'
   */
  async syncIncidentStatus(session: {
    driverId: string;
    accessToken: string;
  }): Promise<DriverSosActiveState | null> {
    if (!this.activeIncident) return null;

    const response = await this.http.fetch(
      `${this.apiBaseUrl}/api/v1/driver/sos/${this.activeIncident.incidentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-driver-id': session.driverId,
        },
      },
    );

    if (!response.ok) {
      return this.activeIncident;
    }

    const data = (await response.json()) as {
      incident_id: string;
      category: SosCategory;
      step: DriverSosProgressStep;
      status: SosIncidentStatus;
      dispatched_at: string;
      security_phone: string;
      acknowledged_by?: string;
      acknowledged_at?: string;
      notified_at?: string;
    };

    let stepLabel = 'Received by server';
    if (data.step === 'ACKNOWLEDGED' || data.acknowledged_by) {
      stepLabel = `Acknowledged by ${data.acknowledged_by || 'Security Desk'}`;
    } else if (data.step === 'NOTIFIED' || data.notified_at) {
      stepLabel = 'Faculty and Coordinators notified';
    }

    this.activeIncident = {
      incidentId: data.incident_id,
      category: data.category,
      step: data.step,
      status: data.status,
      dispatchedAt: data.dispatched_at,
      securityPhone: data.security_phone,
      acknowledgedBy: data.acknowledged_by ?? null,
      acknowledgedAt: data.acknowledged_at ?? null,
      stepLabel,
    };

    return { ...this.activeIncident };
  }

  reset(): void {
    this.holdTrigger.reset();
    this.activeIncident = null;
    this.selectedCategory = 'EMERGENCY';
  }
}
