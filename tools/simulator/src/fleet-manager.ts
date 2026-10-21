import { assertSimulatorEnvironment } from './guards.js';
import { SimulatedBusAgent, BusScenarioMode } from './bus-agent.js';
import {
  TelemetryBatchDto,
  HeartbeatRequestDto,
  DriverLocationsBatchDto,
  HardwareEventDto,
} from '@collegebus/contracts';

export interface FleetTickResult {
  tick: number;
  timestamp: string;
  hardwareTelemetry: { deviceId: string; batch: TelemetryBatchDto }[];
  driverTelemetry: { driverId: string; busId: string; telemetry: DriverLocationsBatchDto }[];
  heartbeats: { deviceId: string; heartbeat: HeartbeatRequestDto }[];
  events: { deviceId: string; events: HardwareEventDto[] }[];
}

export interface FleetSummary {
  totalBuses: number;
  scenarioBreakdown: Record<BusScenarioMode, number>;
  totalTicks: number;
  totalHardwareBatches: number;
  totalDriverSamples: number;
  totalHeartbeats: number;
  totalEvents: number;
  errors: string[];
}

export class FleetSimulatorManager {
  private readonly buses: SimulatedBusAgent[] = [];

  constructor(appEnv?: string, targetUrl?: string) {
    assertSimulatorEnvironment(appEnv, targetUrl);
    this.initializeFleet();
  }

  /**
   * Initializes exactly 50 buses mapped across all operational scenarios (Part 3.2, §32.2).
   */
  private initializeFleet(): void {
    // 1-25: Normal Dual Source (25 buses)
    for (let i = 1; i <= 25; i++) {
      this.buses.push(new SimulatedBusAgent(i, 'NORMAL_DUAL'));
    }

    // 26-35: Tracker Failed / Phone Fallback (10 buses)
    for (let i = 26; i <= 35; i++) {
      this.buses.push(new SimulatedBusAgent(i, 'TRACKER_FAILED_PHONE_FALLBACK'));
    }

    // 36-40: Driver Only (5 buses)
    for (let i = 36; i <= 40; i++) {
      this.buses.push(new SimulatedBusAgent(i, 'DRIVER_ONLY'));
    }

    // 41-45: Both Lost / Unavailable (5 buses)
    for (let i = 41; i <= 45; i++) {
      this.buses.push(new SimulatedBusAgent(i, 'BOTH_LOST'));
    }

    // 46-48: Flapping alternation (3 buses)
    for (let i = 46; i <= 48; i++) {
      this.buses.push(new SimulatedBusAgent(i, 'FLAPPING'));
    }

    // 49-50: Critical events / low battery (2 buses)
    for (let i = 49; i <= 50; i++) {
      this.buses.push(new SimulatedBusAgent(i, 'CRITICAL_EVENTS'));
    }
  }

  public getBuses(): SimulatedBusAgent[] {
    return [...this.buses];
  }

  /**
   * Advances all 50 buses by one tick (e.g. 10 seconds) and collects all generated payloads.
   */
  public executeTick(tickNumber: number, now: Date = new Date()): FleetTickResult {
    const hwBatches: { deviceId: string; batch: TelemetryBatchDto }[] = [];
    const driverTelemetries: {
      driverId: string;
      busId: string;
      telemetry: DriverLocationsBatchDto;
    }[] = [];
    const heartbeats: { deviceId: string; heartbeat: HeartbeatRequestDto }[] = [];
    const events: { deviceId: string; events: HardwareEventDto[] }[] = [];

    for (const bus of this.buses) {
      bus.advancePosition(10);

      const hwBatch = bus.generateHardwareTelemetry(now);
      if (hwBatch && bus.deviceId) {
        hwBatches.push({ deviceId: bus.deviceId, batch: hwBatch });
      }

      const drvTel = bus.generateDriverTelemetry(now);
      if (drvTel) {
        driverTelemetries.push({
          driverId: bus.driverId,
          busId: bus.busId,
          telemetry: drvTel,
        });
      }

      // Heartbeat generated every 3 ticks (30s) or on first tick
      if (tickNumber === 1 || tickNumber % 3 === 0) {
        const hb = bus.generateHeartbeat(now);
        if (hb && bus.deviceId) {
          heartbeats.push({ deviceId: bus.deviceId, heartbeat: hb });
        }
      }

      const evs = bus.generateEvents(now);
      if (evs && bus.deviceId) {
        events.push({ deviceId: bus.deviceId, events: evs });
      }
    }

    return {
      tick: tickNumber,
      timestamp: now.toISOString(),
      hardwareTelemetry: hwBatches,
      driverTelemetry: driverTelemetries,
      heartbeats,
      events,
    };
  }

  /**
   * Runs the simulator across all 50 buses for the specified number of ticks.
   */
  public runSimulation(
    totalTicks: number = 5,
    startTime: Date = new Date('2026-10-21T08:00:00Z'),
  ): FleetSummary {
    const breakdown: Record<BusScenarioMode, number> = {
      NORMAL_DUAL: 0,
      TRACKER_FAILED_PHONE_FALLBACK: 0,
      DRIVER_ONLY: 0,
      BOTH_LOST: 0,
      FLAPPING: 0,
      CRITICAL_EVENTS: 0,
    };

    for (const b of this.buses) {
      breakdown[b.scenarioMode]++;
    }

    let totalHwBatches = 0;
    let totalDrvSamples = 0;
    let totalHb = 0;
    let totalEvs = 0;
    const errors: string[] = [];

    for (let t = 1; t <= totalTicks; t++) {
      const currentTime = new Date(startTime.getTime() + (t - 1) * 10000);
      try {
        const tickResult = this.executeTick(t, currentTime);
        totalHwBatches += tickResult.hardwareTelemetry.length;
        totalDrvSamples += tickResult.driverTelemetry.length;
        totalHb += tickResult.heartbeats.length;
        totalEvs += tickResult.events.reduce((acc, e) => acc + e.events.length, 0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Tick ${t} error: ${msg}`);
      }
    }

    return {
      totalBuses: this.buses.length,
      scenarioBreakdown: breakdown,
      totalTicks,
      totalHardwareBatches: totalHwBatches,
      totalDriverSamples: totalDrvSamples,
      totalHeartbeats: totalHb,
      totalEvents: totalEvs,
      errors,
    };
  }
}
