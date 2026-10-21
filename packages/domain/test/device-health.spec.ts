import { describe, it, expect } from 'vitest';
import {
  computeDeviceHealthState,
  evaluateVehicleBatteryThreshold,
  evaluateDeviceBatteryThreshold,
  evaluateHardwareEvent,
} from '../src/device-health.js';

describe('Device Health State Calculation (Part 9.13)', () => {
  const baseTime = new Date('2026-10-21T12:00:00Z');

  it('returns OFFLINE if device has never sent a heartbeat', () => {
    expect(
      computeDeviceHealthState({
        lastHeartbeatAt: null,
        ignition: 'ON',
        now: baseTime,
      }),
    ).toBe('OFFLINE');
  });

  describe('Ignition ON (expected interval = 60s, 2x = 120s, limit = 600s)', () => {
    it('is ONLINE within 120s of last heartbeat', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 90 * 1000);
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'ON',
          now: baseTime,
        }),
      ).toBe('ONLINE');
    });

    it('is DELAYED between 120s and 600s', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 250 * 1000);
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'ON',
          now: baseTime,
        }),
      ).toBe('DELAYED');
    });

    it('is OFFLINE after 600s (10 minutes)', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 650 * 1000);
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'ON',
          now: baseTime,
        }),
      ).toBe('OFFLINE');
    });
  });

  describe('Ignition OFF / Parked (expected interval = 600s, 2x = 1200s, limit = 24h)', () => {
    it('is ONLINE within 1200s of last heartbeat', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 1100 * 1000);
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'OFF',
          now: baseTime,
        }),
      ).toBe('ONLINE');
    });

    it('is DELAYED between 1200s and 24 hours while parked', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 4 * 3600 * 1000); // 4 hours ago
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'OFF',
          now: baseTime,
        }),
      ).toBe('DELAYED');
    });

    it('is OFFLINE after 24 hours while parked', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 25 * 3600 * 1000); // 25 hours ago
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'OFF',
          now: baseTime,
        }),
      ).toBe('OFFLINE');
    });

    it('treats parked device with active shift using 10m threshold', () => {
      const lastHeartbeat = new Date(baseTime.getTime() - 650 * 1000); // 10m 50s
      expect(
        computeDeviceHealthState({
          lastHeartbeatAt: lastHeartbeat,
          ignition: 'OFF',
          now: baseTime,
          hasActiveShift: true,
        }),
      ).toBe('OFFLINE');
    });
  });
});

describe('Battery Threshold Evaluation (Part B.3 D-02 & SW-MVP §12)', () => {
  it('evaluates 12V class battery correctly (threshold 11800 mV)', () => {
    expect(evaluateVehicleBatteryThreshold(12400, 'V12')).toEqual({
      isLow: false,
      thresholdMv: 11800,
    });
    expect(evaluateVehicleBatteryThreshold(11799, 'V12')).toEqual({
      isLow: true,
      thresholdMv: 11800,
    });
  });

  it('evaluates 24V class battery correctly (threshold 23500 mV)', () => {
    expect(evaluateVehicleBatteryThreshold(24500, 'V24')).toEqual({
      isLow: false,
      thresholdMv: 23500,
    });
    expect(evaluateVehicleBatteryThreshold(23499, 'V24')).toEqual({
      isLow: true,
      thresholdMv: 23500,
    });
  });

  it('evaluates backup device battery correctly (threshold 3400 mV)', () => {
    expect(evaluateDeviceBatteryThreshold(3800)).toEqual({ isLow: false, thresholdMv: 3400 });
    expect(evaluateDeviceBatteryThreshold(3350)).toEqual({ isLow: true, thresholdMv: 3400 });
  });
});

describe('Hardware Event Evaluation (Part 5.5 & SW-MVP §12)', () => {
  it('evaluates BOOT reset reason and flags repeated watchdog failure', () => {
    const singleBoot = evaluateHardwareEvent('BOOT', { reset_reason: 'POWER' }, {});
    expect(singleBoot.status).toBe('RECORDED');
    expect(singleBoot.action).toBe('NONE');

    const thirdWatchdog = evaluateHardwareEvent(
      'BOOT',
      { reset_reason: 'WATCHDOG' },
      { recentWatchdogCount: 2 },
    );
    expect(thirdWatchdog.status).toBe('PROCESSED');
    expect(thirdWatchdog.action).toBe('OPEN_TICKET');
    expect(thirdWatchdog.ticket?.category).toBe('REPEATED_BOOT_FAILURE');
  });

  it('evaluates IGNITION_ON and IGNITION_OFF', () => {
    const ignOn = evaluateHardwareEvent('IGNITION_ON', {});
    expect(ignOn.action).toBe('END_PARKED_STATE');

    const ignOffNoShift = evaluateHardwareEvent('IGNITION_OFF', {}, { isShiftActive: false });
    expect(ignOffNoShift.action).toBe('NONE');

    const ignOffWithShift = evaluateHardwareEvent('IGNITION_OFF', {}, { isShiftActive: true });
    expect(ignOffWithShift.action).toBe('START_IDLE_TIMER');
  });

  it('evaluates GPS_LOST and GPS_RECOVERED', () => {
    expect(evaluateHardwareEvent('GPS_LOST', {}).action).toBe('UPDATE_HEALTH');
    expect(evaluateHardwareEvent('GPS_RECOVERED', {}).action).toBe('UPDATE_HEALTH');
  });

  it('evaluates LOW_VEHICLE_BATTERY, LOW_DEVICE_BATTERY, and TAMPER', () => {
    const lowVeh = evaluateHardwareEvent('LOW_VEHICLE_BATTERY', { mv: 11400 });
    expect(lowVeh.action).toBe('OPEN_TICKET');
    expect(lowVeh.ticket?.category).toBe('LOW_VEHICLE_BATTERY');

    const lowDev = evaluateHardwareEvent('LOW_DEVICE_BATTERY', { mv: 3200 });
    expect(lowDev.action).toBe('OPEN_TICKET');
    expect(lowDev.ticket?.category).toBe('LOW_DEVICE_BATTERY');

    const tamper = evaluateHardwareEvent('TAMPER', {});
    expect(tamper.action).toBe('OPEN_TICKET');
    expect(tamper.ticket?.category).toBe('TAMPER_ALERT');
  });

  it('evaluates FIRMWARE_FAILED to pause rollout and open ticket', () => {
    const fwFailed = evaluateHardwareEvent('FIRMWARE_FAILED', {
      attempted_version: '1.5.0',
      reason: 'Checksum mismatch',
    });
    expect(fwFailed.action).toBe('PAUSE_ROLLOUT');
    expect(fwFailed.ticket?.category).toBe('FIRMWARE_FAILED');
  });

  it('marks unknown event types as IGNORED per Part 5.5', () => {
    const unknown = evaluateHardwareEvent('CUSTOM_SENSOR_EVENT_XYZ', {});
    expect(unknown.status).toBe('IGNORED');
    expect(unknown.action).toBe('NONE');
  });
});
