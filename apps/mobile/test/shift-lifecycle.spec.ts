import { describe, it, expect, beforeEach } from 'vitest';
import { ShiftLifecycleManager } from '../src/driver/shift-lifecycle-manager.js';
import { ShiftClaimDto, ActiveShiftResponseDto } from '@collegebus/contracts';

describe('P3-T3: Shift Start, Restart Resume, Idle Detection & 14h Timeout', () => {
  const API_BASE = 'https://api.collegebus.internal';
  const SESSION = {
    driverId: 'drv_e4b1092a',
    accessToken: 'jwt_mock_token_719c',
  };

  let mockActiveShift: ShiftClaimDto | null = null;
  let mockSosOpen = false;
  let manager: ShiftLifecycleManager;

  beforeEach(() => {
    mockActiveShift = null;
    mockSosOpen = false;

    const mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const headers = new Headers(init?.headers);
      const auth = headers.get('Authorization');
      const driverId = headers.get('x-driver-id');

      if (!auth || !driverId) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
      }

      // POST /api/v1/shifts/claim
      if (pathname === '/api/v1/shifts/claim' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);

        // AC-DRV-04: Idempotent resume if same shift is already active
        if (mockActiveShift && mockActiveShift.bus_id === body.bus_id) {
          return new Response(JSON.stringify(mockActiveShift), { status: 200 });
        }

        mockActiveShift = {
          shift_id: `shift_${Date.now()}_abc`,
          bus_id: body.bus_id,
          driver_id: driverId,
          route_id: body.route_id,
          trip_id: `trip_${Date.now()}_xyz`,
          started_at: new Date('2026-10-22T06:30:00Z').toISOString(),
        };

        return new Response(JSON.stringify(mockActiveShift), { status: 200 });
      }

      // GET /api/v1/shifts/active
      if (pathname === '/api/v1/shifts/active' && (!init?.method || init.method === 'GET')) {
        const responseData: ActiveShiftResponseDto = {
          has_active_shift: mockActiveShift !== null,
          shift: mockActiveShift
            ? {
                ...mockActiveShift,
                idle_warning: false,
                timeout_warning: false,
              }
            : null,
        };
        return new Response(JSON.stringify(responseData), { status: 200 });
      }

      // POST /api/v1/shifts/end
      if (pathname === '/api/v1/shifts/end' && init?.method === 'POST') {
        if (!mockActiveShift) {
          return new Response(JSON.stringify({ message: 'No active shift' }), { status: 404 });
        }

        // SW-MVP-1.0 §15.4: Cannot end shift while SOS incident is OPEN
        if (mockSosOpen) {
          return new Response(
            JSON.stringify({
              code: 'SOS_INCIDENT_OPEN',
              message: 'Cannot end shift while SOS incident is open for this bus',
            }),
            { status: 409 },
          );
        }

        const endedAt = new Date().toISOString();
        mockActiveShift = null;
        return new Response(JSON.stringify({ status: 'COMPLETED', ended_at: endedAt }), {
          status: 200,
        });
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    };

    manager = new ShiftLifecycleManager(API_BASE, { fetch: mockFetch });
  });

  it('starts a new shift and enters ACTIVE state', async () => {
    expect(manager.getState()).toBe('IDLE');

    const claim = await manager.startShift(SESSION, {
      bus_id: 'bus_01',
      route_id: 'route_north',
      trip_type: 'MORNING',
    });

    expect(claim.bus_id).toBe('bus_01');
    expect(manager.getState()).toBe('ACTIVE');
    expect(manager.getCurrentClaim()?.shift_id).toBe(claim.shift_id);
  });

  describe('AC-DRV-04: Mid-Shift App Restart & Idempotent Resume', () => {
    it('resumes active shift via GET /shifts/active within seconds with no duplicate shift', async () => {
      // 1. Start shift in first instance
      await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });
      const initialClaim = manager.getCurrentClaim();
      expect(initialClaim).toBeDefined();

      // 2. Simulate app closing and reopening mid-shift (new manager instance)
      const reopenedManager = new ShiftLifecycleManager(API_BASE, {
        fetch: manager['http'].fetch,
      });
      expect(reopenedManager.getState()).toBe('IDLE');

      // 3. Reopened app calls resumeActiveShift
      const resumedClaim = await reopenedManager.resumeActiveShift(SESSION);
      expect(resumedClaim).toBeDefined();
      expect(resumedClaim?.shift_id).toBe(initialClaim?.shift_id);
      expect(resumedClaim?.bus_id).toBe('bus_01');
      expect(reopenedManager.getState()).toBe('ACTIVE');
    });

    it('idempotently returns existing shift claim when start is re-called for same bus', async () => {
      const claim1 = await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      const claim2 = await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      expect(claim1.shift_id).toBe(claim2.shift_id);
    });
  });

  describe('Idle Detection & 14-Hour Timeout (§15.4)', () => {
    it('triggers idle prompt after 20 minutes without movement', async () => {
      await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      const base = new Date();
      // 10 minutes idle -> no warning
      let status = manager.checkPeriodicStatus(new Date(base.getTime() + 10 * 60 * 1000));
      expect(status.idleWarning).toBe(false);
      expect(manager.getState()).toBe('ACTIVE');

      // 21 minutes idle -> idle prompt triggered
      status = manager.checkPeriodicStatus(new Date(base.getTime() + 21 * 60 * 1000));
      expect(status.idleWarning).toBe(true);
      expect(manager.getState()).toBe('IDLE_PROMPT');

      // Driver acknowledges idle -> resets to ACTIVE
      manager.acknowledgeIdle(new Date(base.getTime() + 22 * 60 * 1000));
      expect(manager.getState()).toBe('ACTIVE');
      expect(manager.isIdlePromptActive()).toBe(false);
    });

    it('resets idle prompt automatically when vehicle movement is recorded', async () => {
      await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      const base = new Date();
      manager.checkPeriodicStatus(new Date(base.getTime() + 25 * 60 * 1000));
      expect(manager.isIdlePromptActive()).toBe(true);

      // Bus moves -> recorded
      manager.recordMovement(new Date(base.getTime() + 26 * 60 * 1000));
      expect(manager.isIdlePromptActive()).toBe(false);
      expect(manager.getState()).toBe('ACTIVE');
    });

    it('flags timeout warning when shift duration approaches 14 hours', async () => {
      await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      const base = new Date('2026-10-22T06:30:00Z');
      // 13.6 hours elapsed -> timeout warning
      const status = manager.checkPeriodicStatus(
        new Date(base.getTime() + 13.6 * 3600 * 1000),
      );
      expect(status.timeoutWarning).toBe(true);
    });
  });

  describe('Ending Shift & SOS Guard (§15.4)', () => {
    it('ends shift cleanly on manual confirmation', async () => {
      await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      const result = await manager.endShift(SESSION, 'MANUAL');
      expect(result.status).toBe('COMPLETED');
      expect(manager.getState()).toBe('ENDED');
      expect(manager.getCurrentClaim()).toBeNull();
    });

    it('blocks driver ending shift when SOS incident is open for the bus', async () => {
      await manager.startShift(SESSION, {
        bus_id: 'bus_01',
        route_id: 'route_north',
        trip_type: 'MORNING',
      });

      mockSosOpen = true; // Open emergency incident

      await expect(manager.endShift(SESSION, 'MANUAL')).rejects.toThrow(
        'SOS_INCIDENT_OPEN: Driver cannot end shift while SOS incident is open for this bus',
      );
      expect(manager.getState()).toBe('ACTIVE');
      expect(manager.getCurrentClaim()).not.toBeNull();
    });
  });
});
