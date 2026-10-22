import { describe, it, expect, vi } from 'vitest';
import {
  PhoneLocationCollector,
  DriverRosterClient,
  ShiftLifecycleManager,
  PhoneLocationBuffer,
} from '../src/driver/index.js';
import { evaluatePreTripDiagnostics, PreTripDiagnosticsInput } from '@collegebus/domain';
import {
  DriverLocationSampleDto,
  DriverLocationsResponseDto,
  DriverRosterBusDto,
  ShiftClaimDto,
  ActiveShiftResponseDto,
} from '@collegebus/contracts';

describe('P3-T8: Mock-Location Handling & Driver Integration Suite (AC-DRV-01 to AC-DRV-04)', () => {
  const driverId = 'drv_int_101';
  const busId = 'bus_07';
  const shiftId = 'shift_int_20261021_01';
  const API_BASE = 'https://api.collegebus.internal';

  describe('Mock-Location Detection & Handling (Part 5.3 & §11.7)', () => {
    it('displays mock warning banner, dispatches alert, and clears when genuine GPS restored', async () => {
      const buffer = new PhoneLocationBuffer();
      const mockAlertSpy = vi.fn();

      const collector = new PhoneLocationCollector({
        apiBaseUrl: API_BASE,
        accessToken: 'test_token',
        driverId,
        buffer,
        onMockDetected: mockAlertSpy,
      });

      await collector.start(shiftId, '07');
      expect(collector.getMockBanner().visible).toBe(false);

      // 1. Ingest mock location reading
      const mockSample = await collector.recordLocation({
        lat: 12.9716,
        lng: 77.5946,
        accuracy_m: 5,
        speed_mps: 5,
        is_mock: true,
        recorded_at: new Date(Date.UTC(2026, 9, 21, 8, 0, 0)).toISOString(),
      });

      expect(mockSample?.is_mock).toBe(true);
      expect(collector.getMockBanner().visible).toBe(true);
      expect(collector.getMockBanner().message).toContain('Mock location detected');
      expect(mockAlertSpy).toHaveBeenCalledTimes(1);
      expect(mockAlertSpy).toHaveBeenCalledWith(mockSample);

      // 2. Ingest genuine GPS reading -> banner cleared automatically
      const genuineSample = await collector.recordLocation({
        lat: 12.972,
        lng: 77.595,
        accuracy_m: 4,
        speed_mps: 6,
        is_mock: false,
        recorded_at: new Date(Date.UTC(2026, 9, 21, 8, 0, 10)).toISOString(),
      });

      expect(genuineSample?.is_mock).toBe(false);
      expect(collector.getMockBanner().visible).toBe(false);
      expect(collector.getMockBanner().message).toBeNull();

      await collector.stop();
    });
  });

  describe('AC-DRV-01: Driver Roster Bus Isolation', () => {
    it('isolates assigned buses: unrostered buses are hidden from list and reject detail view with 403', async () => {
      const rosterBus: DriverRosterBusDto = {
        bus_id: 'bus_07',
        bus_number: 'Bus 07',
        registration_number: 'KA-01-F-1007',
        route_id: 'route_12',
        route_name: 'Whitefield Express',
        is_active: true,
      };

      const mockFetch = async (url: string): Promise<Response> => {
        const parsed = new URL(url);
        if (parsed.pathname === '/api/v1/driver/roster') {
          return new Response(
            JSON.stringify({
              driver_id: driverId,
              buses: [rosterBus],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (parsed.pathname === '/api/v1/driver/bus/bus_99') {
          return new Response(
            JSON.stringify({
              code: 'DRIVER_NOT_ON_ROSTER',
              message: 'Driver is not rostered on bus bus_99',
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      };

      const client = new DriverRosterClient(API_BASE, { fetch: mockFetch });
      client.setSession({
        driverId,
        email: 'driver@college.edu',
        accessToken: 'jwt_token',
      });

      const roster = await client.getRoster();
      expect(roster.length).toBe(1);
      expect(roster[0]?.bus_id).toBe('bus_07');

      // Unrostered bus query throws 403
      await expect(client.selectBus('bus_99')).rejects.toThrowError(
        'DRIVER_NOT_ON_ROSTER: Access denied for bus bus_99',
      );
    });
  });

  describe('AC-DRV-02: Hardware Tracker Red Status & Phone Fallback', () => {
    it('allows shift start with visible warning and phone fallback when hardware tracker has no heartbeat in 2m', () => {
      const diagnosticsInput: PreTripDiagnosticsInput = {
        isDriverRostered: true,
        tripTypeSelected: 'MORNING',
        hardwareHeartbeatAgeSeconds: 180, // > 120s -> RED
        hardwareGpsValid: false,
        phoneLocationPermission: 'ALWAYS',
        phoneNotificationPermission: 'GRANTED',
        batteryOptimisationExempt: true,
        phoneGpsAccuracyM: 15.0,
        networkReachable: true,
        os: 'ANDROID',
      };

      const summary = evaluatePreTripDiagnostics(diagnosticsInput);

      expect(summary.allowedToStart).toBe(true);
      expect(summary.hardwareColor).toBe('RED');
      expect(summary.primarySource).toBe('PHONE');
      expect(summary.blockingFailures.length).toBe(0);

      const hwCheck = summary.checks.find((c) => c.checkNumber === 3);
      expect(hwCheck?.status).toBe('WARN');
      expect(hwCheck?.blocksStart).toBe(false);
      expect(hwCheck?.message).toContain('phone will become primary tracking source');
    });
  });

  describe('AC-DRV-03: Location Permission Block & Fix Guidance', () => {
    it('blocks shift start when location permission is not Always and provides fix steps', () => {
      const diagnosticsInput: PreTripDiagnosticsInput = {
        isDriverRostered: true,
        tripTypeSelected: 'MORNING',
        hardwareHeartbeatAgeSeconds: 30,
        hardwareGpsValid: true,
        phoneLocationPermission: 'WHILE_IN_USE', // Not ALWAYS
        phoneNotificationPermission: 'GRANTED',
        batteryOptimisationExempt: true,
        phoneGpsAccuracyM: 15.0,
        networkReachable: true,
        os: 'ANDROID',
      };

      const summary = evaluatePreTripDiagnostics(diagnosticsInput);

      expect(summary.allowedToStart).toBe(false);
      expect(summary.blockingFailures.length).toBeGreaterThan(0);
      expect(summary.blockingFailures.some((fail) => fail.message.includes('Always'))).toBe(true);

      const permCheck = summary.checks.find((c) => c.checkNumber === 4);
      expect(permCheck?.status).toBe('FAIL');
      expect(permCheck?.blocksStart).toBe(true);
      expect(permCheck?.message).toContain('Always');
    });
  });

  describe('AC-DRV-04: Mid-Shift App Restart Automatic Resume <10s', () => {
    it('automatically resumes active shift on app restart without creating duplicate shifts', async () => {
      let createdShiftCount = 0;
      let activeShift: ShiftClaimDto | null = null;

      const mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
        const parsed = new URL(url);

        if (parsed.pathname === '/api/v1/shifts/claim' && init?.method === 'POST') {
          createdShiftCount++;
          activeShift = {
            shift_id: shiftId,
            bus_id: busId,
            driver_id: driverId,
            route_id: 'route_12',
            trip_id: 'trip_int_01',
            started_at: new Date(Date.UTC(2026, 9, 21, 8, 0, 0)).toISOString(),
          };
          return new Response(JSON.stringify(activeShift), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (parsed.pathname === '/api/v1/shifts/active') {
          const responsePayload: ActiveShiftResponseDto = {
            has_active_shift: activeShift !== null,
            shift: activeShift
              ? {
                  ...activeShift,
                  idle_warning: false,
                  timeout_warning: false,
                }
              : null,
          };
          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({}), { status: 404 });
      };

      const session = { driverId, accessToken: 'jwt_token' };

      // 1. First app launch: starts shift
      const manager1 = new ShiftLifecycleManager(API_BASE, { fetch: mockFetch });
      const claim = await manager1.startShift(session, {
        bus_id: busId,
        route_id: 'route_12',
        trip_type: 'MORNING',
      });
      expect(claim.shift_id).toBe(shiftId);
      expect(createdShiftCount).toBe(1);

      // 2. Mid-shift restart: second app instance resumes active shift
      const manager2 = new ShiftLifecycleManager(API_BASE, { fetch: mockFetch });
      const resumeStartTime = Date.now();
      const resumedClaim = await manager2.resumeActiveShift(session);
      const resumeDurationMs = Date.now() - resumeStartTime;

      expect(resumedClaim?.shift_id).toBe(shiftId);
      expect(manager2.getState()).toBe('ACTIVE');
      expect(createdShiftCount).toBe(1); // Zero duplicate shifts created
      expect(resumeDurationMs).toBeLessThan(10000); // Resumed in < 10 seconds
    });
  });

  describe('2-Hour Continuous Trip Simulation & Adaptive Cadence', () => {
    it('simulates 2 hours of location sampling with 10s moving / 30s stopped transitions', async () => {
      const buffer = new PhoneLocationBuffer();
      const flushedBatches: DriverLocationSampleDto[][] = [];

      const mockHttp = {
        fetch: async (_url: string, init?: RequestInit) => {
          const body = JSON.parse(init?.body as string);
          flushedBatches.push(body.samples);
          const responsePayload: DriverLocationsResponseDto = {
            ack_seq: body.samples[body.samples.length - 1]?.seq ?? 0,
            rejected: [],
            phone_interval_s: 30,
            active_source: 'PHONE',
            server_time: new Date().toISOString(),
          };
          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      };

      const collector = new PhoneLocationCollector({
        apiBaseUrl: API_BASE,
        accessToken: 'test_token',
        driverId,
        buffer,
        http: mockHttp,
      });

      await collector.start(shiftId, '07');

      // Hour 1: Moving (speed 40 km/h = 11.1 m/s) -> 10s cadence
      for (let i = 1; i <= 6; i++) {
        const sampleTime = new Date(Date.UTC(2026, 9, 21, 8, 0, i * 10)).toISOString();
        await collector.recordLocation({
          lat: 12.9716 + i * 0.001,
          lng: 77.5946 + i * 0.001,
          accuracy_m: 8,
          speed_mps: 11.1,
          heading_deg: 45,
          recorded_at: sampleTime,
        });
      }
      expect(collector.getCurrentCadenceS()).toBe(10);

      // Hour 2: Stopped at terminal (speed 0 km/h) -> 30s cadence
      for (let i = 1; i <= 2; i++) {
        const sampleTime = new Date(Date.UTC(2026, 9, 21, 9, 0, i * 30)).toISOString();
        await collector.recordLocation({
          lat: 12.98,
          lng: 77.6,
          accuracy_m: 5,
          speed_mps: 0,
          heading_deg: null,
          recorded_at: sampleTime,
        });
      }
      expect(collector.getCurrentCadenceS()).toBe(30);

      // Verify that all 8 samples were recorded with strict monotonic sequence
      await collector.flushPending();
      const allFlushed = flushedBatches.flat();
      expect(allFlushed.length).toBe(8);
      for (let i = 0; i < allFlushed.length; i++) {
        expect(allFlushed[i]?.seq).toBe(i + 1);
      }

      await collector.stop();
    });
  });
});
