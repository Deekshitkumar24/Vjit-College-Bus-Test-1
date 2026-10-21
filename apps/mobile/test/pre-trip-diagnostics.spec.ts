import { describe, it, expect } from 'vitest';
import {
  evaluatePreTripDiagnostics,
  PreTripDiagnosticsInput,
} from '@collegebus/domain';
import { PreTripDiagnosticsManager } from '../src/driver/pre-trip-manager.js';

describe('P3-T2: Permissions & Pre-Trip Check Diagnostics', () => {
  const defaultValidInput: PreTripDiagnosticsInput = {
    isDriverRostered: true,
    tripTypeSelected: 'MORNING',
    hardwareHeartbeatAgeSeconds: 30, // Fresh < 120s
    hardwareGpsValid: true,
    phoneLocationPermission: 'ALWAYS',
    phoneNotificationPermission: 'GRANTED',
    batteryOptimisationExempt: true,
    phoneGpsAccuracyM: 15.0, // <= 50m
    networkReachable: true,
    os: 'ANDROID',
  };

  it('passes all 8 checks when all hardware and device requirements are met', () => {
    const summary = evaluatePreTripDiagnostics(defaultValidInput);

    expect(summary.allowedToStart).toBe(true);
    expect(summary.hardwareColor).toBe('GREEN');
    expect(summary.primarySource).toBe('HW');
    expect(summary.blockingFailures.length).toBe(0);
    expect(summary.checks.length).toBe(8);
    expect(summary.checks.every((c) => c.status === 'PASS')).toBe(true);
  });

  describe('AC-DRV-02: Hardware Status Warning & Fallback to Phone', () => {
    it('allows start with warning when hardware is RED, setting phone as primary source', () => {
      const input: PreTripDiagnosticsInput = {
        ...defaultValidInput,
        hardwareHeartbeatAgeSeconds: 180, // > 120s -> RED
        hardwareGpsValid: false,
      };

      const summary = evaluatePreTripDiagnostics(input);

      expect(summary.allowedToStart).toBe(true);
      expect(summary.hardwareColor).toBe('RED');
      expect(summary.primarySource).toBe('PHONE');
      expect(summary.blockingFailures.length).toBe(0);

      const hwCheck = summary.checks.find((c) => c.checkNumber === 3);
      expect(hwCheck?.status).toBe('WARN');
      expect(hwCheck?.blocksStart).toBe(false);
      expect(hwCheck?.message).toContain('phone will become primary tracking source');
    });

    it('sets hardware to AMBER when heartbeat is fresh but GPS is invalid', () => {
      const input: PreTripDiagnosticsInput = {
        ...defaultValidInput,
        hardwareHeartbeatAgeSeconds: 45,
        hardwareGpsValid: false,
      };

      const summary = evaluatePreTripDiagnostics(input);

      expect(summary.allowedToStart).toBe(true);
      expect(summary.hardwareColor).toBe('AMBER');
      expect(summary.primarySource).toBe('HW');
      const hwCheck = summary.checks.find((c) => c.checkNumber === 3);
      expect(hwCheck?.status).toBe('WARN');
    });
  });

  describe('AC-DRV-03: Location Permission Blocking & Platform Fix Instructions', () => {
    it('blocks start on Android when location permission is WHILE_IN_USE, providing Android fix steps', () => {
      const input: PreTripDiagnosticsInput = {
        ...defaultValidInput,
        phoneLocationPermission: 'WHILE_IN_USE',
        os: 'ANDROID',
      };

      const summary = evaluatePreTripDiagnostics(input);

      expect(summary.allowedToStart).toBe(false);
      const locCheck = summary.checks.find((c) => c.checkNumber === 4);
      expect(locCheck?.status).toBe('FAIL');
      expect(locCheck?.blocksStart).toBe(true);
      expect(locCheck?.fixInstructions).toContain('Allow all the time');
    });

    it('blocks start on iOS when location permission is DENIED, providing iOS fix steps', () => {
      const input: PreTripDiagnosticsInput = {
        ...defaultValidInput,
        phoneLocationPermission: 'DENIED',
        os: 'IOS',
      };

      const summary = evaluatePreTripDiagnostics(input);

      expect(summary.allowedToStart).toBe(false);
      const locCheck = summary.checks.find((c) => c.checkNumber === 4);
      expect(locCheck?.status).toBe('FAIL');
      expect(locCheck?.blocksStart).toBe(true);
      expect(locCheck?.fixInstructions).toContain('Select "Always"');
    });
  });

  describe('Additional Blocking Pre-Trip Checks', () => {
    it('blocks start when driver is not rostered on bus (Check 1, AC-DRV-01)', () => {
      const summary = evaluatePreTripDiagnostics({
        ...defaultValidInput,
        isDriverRostered: false,
      });

      expect(summary.allowedToStart).toBe(false);
      const check1 = summary.checks.find((c) => c.checkNumber === 1);
      expect(check1?.status).toBe('FAIL');
      expect(check1?.blocksStart).toBe(true);
    });

    it('blocks start when trip type is not selected (Check 2)', () => {
      const summary = evaluatePreTripDiagnostics({
        ...defaultValidInput,
        tripTypeSelected: null,
      });

      expect(summary.allowedToStart).toBe(false);
      const check2 = summary.checks.find((c) => c.checkNumber === 2);
      expect(check2?.status).toBe('FAIL');
    });

    it('blocks start when notification permission is denied (Check 5)', () => {
      const summary = evaluatePreTripDiagnostics({
        ...defaultValidInput,
        phoneNotificationPermission: 'DENIED',
      });

      expect(summary.allowedToStart).toBe(false);
      const check5 = summary.checks.find((c) => c.checkNumber === 5);
      expect(check5?.status).toBe('FAIL');
      expect(check5?.blocksStart).toBe(true);
    });

    it('warns on Android when battery optimisation is active but does NOT block start (Check 6)', () => {
      const summary = evaluatePreTripDiagnostics({
        ...defaultValidInput,
        batteryOptimisationExempt: false,
        os: 'ANDROID',
      });

      expect(summary.allowedToStart).toBe(true);
      const check6 = summary.checks.find((c) => c.checkNumber === 6);
      expect(check6?.status).toBe('WARN');
      expect(check6?.blocksStart).toBe(false);
    });

    it('blocks start when phone GPS accuracy is poor (> 50m) and hardware is RED (Check 7)', () => {
      const summary = evaluatePreTripDiagnostics({
        ...defaultValidInput,
        hardwareHeartbeatAgeSeconds: null, // RED
        phoneGpsAccuracyM: 75.0, // > 50m
      });

      expect(summary.allowedToStart).toBe(false);
      const check7 = summary.checks.find((c) => c.checkNumber === 7);
      expect(check7?.status).toBe('FAIL');
      expect(check7?.blocksStart).toBe(true);
    });

    it('blocks start when network is unreachable (Check 8)', () => {
      const summary = evaluatePreTripDiagnostics({
        ...defaultValidInput,
        networkReachable: false,
      });

      expect(summary.allowedToStart).toBe(false);
      const check8 = summary.checks.find((c) => c.checkNumber === 8);
      expect(check8?.status).toBe('FAIL');
      expect(check8?.blocksStart).toBe(true);
    });
  });

  describe('PreTripDiagnosticsManager Integration', () => {
    it('aggregates device sensors and server state to run diagnostics', async () => {
      const mockSensor = {
        getLocationPermission: async () => 'ALWAYS' as const,
        getNotificationPermission: async () => 'GRANTED' as const,
        isBatteryOptimisationExempt: async () => true,
        getCurrentGpsAccuracy: async () => 12.5,
        isNetworkReachable: async () => true,
        getOperatingSystem: () => 'ANDROID' as const,
      };

      const mockServer = {
        getHardwareStatus: async () => ({
          heartbeatAgeSeconds: 20,
          gpsValid: true,
        }),
      };

      const manager = new PreTripDiagnosticsManager(mockSensor, mockServer);

      const summary = await manager.runDiagnostics({
        busId: 'bus_01',
        isDriverRostered: true,
        tripType: 'MORNING',
      });

      expect(summary.allowedToStart).toBe(true);
      expect(manager.canStartShift()).toBe(true);
      expect(manager.getBlockingFailures().length).toBe(0);
    });

    it('exposes platform fix instructions when diagnostic checks fail', async () => {
      const mockSensor = {
        getLocationPermission: async () => 'DENIED' as const,
        getNotificationPermission: async () => 'GRANTED' as const,
        isBatteryOptimisationExempt: async () => true,
        getCurrentGpsAccuracy: async () => 12.5,
        isNetworkReachable: async () => true,
        getOperatingSystem: () => 'IOS' as const,
      };

      const mockServer = {
        getHardwareStatus: async () => ({
          heartbeatAgeSeconds: 20,
          gpsValid: true,
        }),
      };

      const manager = new PreTripDiagnosticsManager(mockSensor, mockServer);

      await manager.runDiagnostics({
        busId: 'bus_01',
        isDriverRostered: true,
        tripType: 'MORNING',
      });

      expect(manager.canStartShift()).toBe(false);
      const fix = manager.getFixInstructions(4);
      expect(fix).toContain('Select "Always"');
      expect(manager.getBlockingFailures().length).toBe(1);
    });
  });
});
