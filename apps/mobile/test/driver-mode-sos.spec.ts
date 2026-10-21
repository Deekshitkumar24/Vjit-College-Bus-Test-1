import { describe, it, expect, beforeEach } from 'vitest';
import {
  DriverModeSwitcher,
  DriverSosManager,
  DriverTrackingMode,
} from '../src/driver/index.js';
import {
  DriverModeSwitchResponseDto,
  SosCategory,
  SosTriggerResponseDto,
} from '@collegebus/contracts';

describe('DriverModeSwitcher (Tracking Mode Switcher & Top-Bar Indicator)', () => {
  let modeSwitcher: DriverModeSwitcher;
  let dispatchedRequests: Array<{ url: string; body: Record<string, unknown> }> = [];

  const createMockHttp = (
    modeResponse?: Partial<DriverModeSwitchResponseDto>,
  ) => ({
    fetch: async (url: string, init?: RequestInit) => {
      const parsedBody = (init?.body ? JSON.parse(init.body as string) : {}) as Record<string, unknown>;
      dispatchedRequests.push({ url, body: parsedBody });

      const response: DriverModeSwitchResponseDto = {
        mode: (parsedBody['mode'] as DriverTrackingMode) || 'AUTO',
        updated_at: new Date().toISOString(),
        bus_id: 'bus_KA_01_1001',
        note: (parsedBody['note'] as string | undefined) ?? null,
        ...modeResponse,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  beforeEach(() => {
    dispatchedRequests = [];
    modeSwitcher = new DriverModeSwitcher(
      'https://api.collegebus.test',
      createMockHttp(),
    );
  });

  it('starts with default AUTO tracking mode per D-13', () => {
    expect(modeSwitcher.getCurrentMode()).toBe('AUTO');
    const indicator = modeSwitcher.getActiveModeIndicator();
    expect(indicator.mode).toBe('AUTO');
    expect(indicator.badge).toBe('Auto · Intelligent Failover');
  });

  it('provides rich top-bar mode indicators for AUTO, HARDWARE, and PHONE modes', () => {
    // AUTO
    expect(modeSwitcher.getActiveModeIndicator().badge).toContain('Auto');

    // Manually test indicator mapping for all 3 modes
    const autoInd = modeSwitcher.getActiveModeIndicator();
    expect(autoInd.label).toBe('Auto (Default)');

    // After switching to PHONE
    modeSwitcher.setModeForTesting('PHONE');
    const phoneInd = modeSwitcher.getActiveModeIndicator();
    expect(phoneInd.badge).toBe('Driver Phone Live');
    expect(phoneInd.description).toContain('phone GPS');

    // After switching to HARDWARE
    modeSwitcher.setModeForTesting('HARDWARE');
    const hwInd = modeSwitcher.getActiveModeIndicator();
    expect(hwInd.badge).toBe('Hardware Only');
    expect(hwInd.description).toContain('GNSS unit only');
  });

  it('rejects confirmation if optional reason note exceeds 140 chars (§16.3 #6)', () => {
    const longNote = 'A'.repeat(141);
    const result = modeSwitcher.requestSwitch('PHONE', longNote);

    expect(result.requiresConfirmation).toBe(false);
    expect(result.pending).toBeNull();
    expect(result.error).toBe('Reason note cannot exceed 140 characters');
  });

  it('does not require confirmation if target mode is identical to current mode', () => {
    const result = modeSwitcher.requestSwitch('AUTO');
    expect(result.requiresConfirmation).toBe(false);
    expect(result.pending).toBeNull();
  });

  it('handles confirmation workflow with optional note <= 140 chars', async () => {
    const validNote = 'Hardware tracker rebooting, switching to phone fallback';
    const req = modeSwitcher.requestSwitch('PHONE', validNote);

    expect(req.requiresConfirmation).toBe(true);
    expect(req.pending?.targetMode).toBe('PHONE');
    expect(req.pending?.note).toBe(validNote);

    // Confirm switch via API
    const response = await modeSwitcher.confirmSwitch({
      driverId: 'drv_01',
      accessToken: 'token_drv',
      shiftId: 'shift_123',
    });

    expect(response.mode).toBe('PHONE');
    expect(response.note).toBe(validNote);
    expect(modeSwitcher.getCurrentMode()).toBe('PHONE');
    expect(modeSwitcher.getLastNote()).toBe(validNote);
    expect(modeSwitcher.getPendingSwitch()).toBeNull();

    expect(dispatchedRequests.length).toBe(1);
    expect(dispatchedRequests[0]?.url).toBe('https://api.collegebus.test/api/v1/driver/mode');
    expect(dispatchedRequests[0]?.body).toEqual({
      mode: 'PHONE',
      shift_id: 'shift_123',
      note: validNote,
    });
  });

  it('allows cancelling pending confirmation sheet', () => {
    modeSwitcher.requestSwitch('HARDWARE', 'Cancelling test');
    expect(modeSwitcher.getPendingSwitch()).not.toBeNull();

    modeSwitcher.cancelSwitch();
    expect(modeSwitcher.getPendingSwitch()).toBeNull();
  });
});

describe('DriverSosManager (2-Second Hold, L-2 Categories & Progression)', () => {
  let sosManager: DriverSosManager;
  let dispatchedRequests: Array<{ url: string; body: Record<string, unknown> }> = [];

  interface MockServerIncident {
    incident_id: string;
    status: 'OPEN' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
    step: 'RECEIVED' | 'NOTIFIED' | 'ACKNOWLEDGED';
    category: SosCategory;
    dispatched_at: string;
    security_phone: string;
    message: string;
    notified_at?: string;
    acknowledged_by?: string;
    acknowledged_at?: string;
  }

  let currentServerIncident: MockServerIncident | null = null;

  const createMockHttp = () => ({
    fetch: async (url: string, init?: RequestInit) => {
      const parsedBody = (init?.body ? JSON.parse(init.body as string) : {}) as Record<string, unknown>;
      dispatchedRequests.push({ url, body: parsedBody });

      if (url.endsWith('/api/v1/driver/sos')) {
        currentServerIncident = {
          incident_id: 'sos_inc_999',
          status: 'OPEN',
          step: 'RECEIVED',
          category: (parsedBody['category'] as SosCategory) || 'EMERGENCY',
          dispatched_at: new Date().toISOString(),
          security_phone: '+91-80-2345-6789',
          message: 'SOS received',
        };

        const resDto: SosTriggerResponseDto = {
          incident_id: currentServerIncident.incident_id,
          status: 'OPEN',
          category: currentServerIncident.category,
          dispatched_at: currentServerIncident.dispatched_at,
          security_phone: currentServerIncident.security_phone,
          message: currentServerIncident.message,
        };

        return new Response(JSON.stringify(resDto), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/driver/sos/')) {
        return new Response(JSON.stringify(currentServerIncident), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  beforeEach(() => {
    dispatchedRequests = [];
    currentServerIncident = null;
    sosManager = new DriverSosManager(
      'https://api.collegebus.test',
      createMockHttp(),
    );
  });

  it('enforces calibrated 2-second hold trigger for drivers (§16.3 #7)', () => {
    expect(sosManager.getHoldTrigger()).toBeDefined();
    const t0 = 1000000;

    // Press down
    const p1 = sosManager.pressDown(t0);
    expect(p1.isHolding).toBe(true);
    expect(p1.progressFraction).toBe(0.0);

    // 1 second later (50% progress, not triggered)
    const p2 = sosManager.updateProgress(t0 + 1000);
    expect(p2.isHolding).toBe(true);
    expect(p2.progressFraction).toBe(0.5);
    expect(p2.isTriggered).toBe(false);

    // Released at 1.5s -> safely cancelled
    const rel = sosManager.release(t0 + 1500);
    expect(rel.wasTriggered).toBe(false);
    expect(rel.state.isHolding).toBe(false);
    expect(rel.state.isTriggered).toBe(false);

    // Full 2000ms hold -> triggers emergency
    sosManager.pressDown(t0 + 2000);
    const triggered = sosManager.updateProgress(t0 + 4000);
    expect(triggered.isTriggered).toBe(true);
    expect(triggered.progressFraction).toBe(1.0);
  });

  it('supports L-2 locked SOS categories: EMERGENCY, MEDICAL, BREAKDOWN, OTHER', () => {
    expect(sosManager.getSelectedCategory()).toBe('EMERGENCY');

    const categories: SosCategory[] = ['MEDICAL', 'BREAKDOWN', 'OTHER', 'EMERGENCY'];
    for (const cat of categories) {
      sosManager.selectCategory(cat);
      expect(sosManager.getSelectedCategory()).toBe(cat);
    }
  });

  it('dispatches SOS emergency and tracks real-time 3-step progression sheet', async () => {
    sosManager.selectCategory('MEDICAL');

    const activeState = await sosManager.triggerSos(
      {
        driverId: 'drv_44',
        accessToken: 'token_drv_44',
        shiftId: 'shift_bus_08',
      },
      { lat: 12.9716, lng: 77.5946, accuracy_m: 8.5 },
      'Student experiencing acute asthma attack',
    );

    // Step 1: Received by server
    expect(activeState.incidentId).toBe('sos_inc_999');
    expect(activeState.category).toBe('MEDICAL');
    expect(activeState.step).toBe('RECEIVED');
    expect(activeState.stepLabel).toBe('Received by server');

    // Simulate Step 2: Faculty and coordinators notified
    currentServerIncident!.step = 'NOTIFIED';
    currentServerIncident!.notified_at = new Date().toISOString();

    const stateStep2 = await sosManager.syncIncidentStatus({
      driverId: 'drv_44',
      accessToken: 'token_drv_44',
    });

    expect(stateStep2?.step).toBe('NOTIFIED');
    expect(stateStep2?.stepLabel).toBe('Faculty and Coordinators notified');

    // Simulate Step 3: Acknowledged by campus safety officer
    currentServerIncident!.step = 'ACKNOWLEDGED';
    currentServerIncident!.acknowledged_by = 'Officer Ramesh (Security Desk)';
    currentServerIncident!.acknowledged_at = new Date().toISOString();

    const stateStep3 = await sosManager.syncIncidentStatus({
      driverId: 'drv_44',
      accessToken: 'token_drv_44',
    });

    expect(stateStep3?.step).toBe('ACKNOWLEDGED');
    expect(stateStep3?.acknowledgedBy).toBe('Officer Ramesh (Security Desk)');
    expect(stateStep3?.stepLabel).toBe('Acknowledged by Officer Ramesh (Security Desk)');
  });

  it('resets SOS state cleanly', () => {
    sosManager.selectCategory('BREAKDOWN');
    sosManager.reset();
    expect(sosManager.getActiveIncident()).toBeNull();
    expect(sosManager.getSelectedCategory()).toBe('EMERGENCY');
  });
});
