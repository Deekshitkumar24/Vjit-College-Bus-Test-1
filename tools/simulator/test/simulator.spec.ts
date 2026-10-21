import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FleetSimulatorManager,
  assertSimulatorEnvironment,
  SimulatedBusAgent,
} from '../src/index.js';
import {
  TelemetryBatchSchema,
  HeartbeatRequestSchema,
  DriverLocationsBatchSchema,
} from '@collegebus/contracts';

describe('Fleet Simulator Engine (P1-T11, Exit Criterion 1, Rules R-M3, R-M5)', () => {
  const originalEnv = process.env['APP_ENV'];

  beforeEach(() => {
    process.env['APP_ENV'] = 'local';
  });

  afterEach(() => {
    process.env['APP_ENV'] = originalEnv;
  });

  it('initializes exactly 50 buses partitioned into the 6 required scenarios', () => {
    const manager = new FleetSimulatorManager('local', 'http://localhost:3000');
    const buses = manager.getBuses();

    expect(buses).toHaveLength(50);

    const normal = buses.filter((b) => b.scenarioMode === 'NORMAL_DUAL');
    const trackerFailed = buses.filter((b) => b.scenarioMode === 'TRACKER_FAILED_PHONE_FALLBACK');
    const driverOnly = buses.filter((b) => b.scenarioMode === 'DRIVER_ONLY');
    const bothLost = buses.filter((b) => b.scenarioMode === 'BOTH_LOST');
    const flapping = buses.filter((b) => b.scenarioMode === 'FLAPPING');
    const critical = buses.filter((b) => b.scenarioMode === 'CRITICAL_EVENTS');

    expect(normal).toHaveLength(25);
    expect(trackerFailed).toHaveLength(10);
    expect(driverOnly).toHaveLength(5);
    expect(bothLost).toHaveLength(5);
    expect(flapping).toHaveLength(3);
    expect(critical).toHaveLength(2);
  });

  it('strictly refuses execution in production environment (Rule R-M5)', () => {
    expect(() => {
      assertSimulatorEnvironment('production', 'http://localhost:3000');
    }).toThrowError(/CRITICAL SECURITY VIOLATION/);

    expect(() => {
      new FleetSimulatorManager('production', 'http://localhost:3000');
    }).toThrowError(/CRITICAL SECURITY VIOLATION/);
  });

  it('strictly refuses execution against non-allowlisted target hostnames (Rule R-M5)', () => {
    expect(() => {
      assertSimulatorEnvironment('staging', 'https://api.external-untrusted.com');
    }).toThrowError(/CRITICAL SECURITY VIOLATION/);
  });

  it('generates strictly valid schemas for telemetry batches, heartbeats, and driver telemetry', () => {
    const manager = new FleetSimulatorManager('local', 'http://localhost:3000');
    const tickResult = manager.executeTick(1, new Date('2026-10-21T08:00:00Z'));

    // Validate hardware batches
    expect(tickResult.hardwareTelemetry.length).toBeGreaterThan(0);
    for (const hw of tickResult.hardwareTelemetry) {
      const res = TelemetryBatchSchema.safeParse(hw.batch);
      expect(res.success).toBe(true);
      expect(hw.batch.samples[0]!.lat).toBeGreaterThan(12.0);
      expect(hw.batch.samples[0]!.lng).toBeGreaterThan(77.0);
    }

    // Validate heartbeats
    expect(tickResult.heartbeats.length).toBeGreaterThan(0);
    for (const hb of tickResult.heartbeats) {
      const res = HeartbeatRequestSchema.safeParse(hb.heartbeat);
      expect(res.success).toBe(true);
      expect(hb.heartbeat.schema_version).toBe(1);
    }

    // Validate driver phone telemetries
    expect(tickResult.driverTelemetry.length).toBeGreaterThan(0);
    for (const drv of tickResult.driverTelemetry) {
      const res = DriverLocationsBatchSchema.safeParse(drv.telemetry);
      expect(res.success).toBe(true);
      expect(drv.telemetry.samples[0]!.is_mock).toBe(false); // C-03 / C-10 rule
    }
  });

  it('drives fleet through 10 full ticks without errors, executing all scenario state transitions (Exit Criterion 1)', () => {
    const manager = new FleetSimulatorManager('local', 'http://localhost:3000');
    const summary = manager.runSimulation(10, new Date('2026-10-21T08:00:00Z'));

    expect(summary.totalBuses).toBe(50);
    expect(summary.totalTicks).toBe(10);
    expect(summary.errors).toHaveLength(0);
    expect(summary.totalHardwareBatches).toBeGreaterThan(200);
    expect(summary.totalDriverSamples).toBeGreaterThan(300);
    expect(summary.totalHeartbeats).toBeGreaterThan(50);
    expect(summary.totalEvents).toBeGreaterThan(0);
  });

  it('correctly models tracker failure with driver phone fallback', () => {
    const bus = new SimulatedBusAgent(26, 'TRACKER_FAILED_PHONE_FALLBACK');

    // Tick 1 & 2: Both active
    bus.advancePosition(10);
    expect(bus.generateHardwareTelemetry()).not.toBeNull();
    expect(bus.generateDriverTelemetry()).not.toBeNull();

    bus.advancePosition(10);
    expect(bus.generateHardwareTelemetry()).not.toBeNull();
    expect(bus.generateDriverTelemetry()).not.toBeNull();

    // Tick 3: Hardware fails, phone continues
    bus.advancePosition(10);
    expect(bus.generateHardwareTelemetry()).toBeNull();
    expect(bus.generateDriverTelemetry()).not.toBeNull();
  });

  it('correctly models critical power and battery events', () => {
    const bus = new SimulatedBusAgent(49, 'CRITICAL_EVENTS');
    const events = bus.generateEvents();

    expect(events).not.toBeNull();
    expect(events).toHaveLength(2);
    expect(events![0]!.type).toBe('LOW_VEHICLE_BATTERY');
    expect(events![1]!.type).toBe('POWER_DISCONNECTED');
  });
});
