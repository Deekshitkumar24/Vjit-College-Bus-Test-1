import {
  TelemetryBatchDto,
  HeartbeatRequestDto,
  DriverLocationsBatchDto,
  HardwareEventDto,
} from '@collegebus/contracts';
import { LatLng, haversineDistanceMeters } from '@collegebus/domain';
import { RouteDefinition, SYNTHETIC_CORRIDORS } from './route-paths.js';

export type BusScenarioMode =
  | 'NORMAL_DUAL' // Both tracker and phone active, tracker preferred
  | 'TRACKER_FAILED_PHONE_FALLBACK' // Tracker offline or invalid GPS; phone takes over
  | 'DRIVER_ONLY' // No hardware linked; phone only
  | 'BOTH_LOST' // Both sources stop transmitting -> unavailable state
  | 'FLAPPING' // Alternates rapidly between sources to trigger anti-flapping lock
  | 'CRITICAL_EVENTS'; // Emits low battery, power cut, tamper events

export class SimulatedBusAgent {
  public readonly busId: string;
  public readonly busNumber: string;
  public readonly deviceId: string | null;
  public readonly driverId: string;
  public readonly scenarioMode: BusScenarioMode;
  public readonly route: RouteDefinition;

  private waypointIndex = 0;
  private progressT = 0; // 0 to 1 between waypoints
  private speedKmh = 35.0;
  private headingDeg = 45.0;
  private currentCoord: LatLng;
  private sequence = 1;
  private bootId: string;
  private vehicleBatteryMv = 12600;
  private deviceBatteryMv = 3950;
  private ignition: 'ON' | 'OFF' = 'ON';
  private tickCount = 0;

  constructor(
    index: number, // 1 to 50
    scenarioMode: BusScenarioMode,
  ) {
    const num = 900 + index;
    this.busId = `bus_${num}`;
    this.busNumber = `Bus ${num}`;
    this.deviceId = scenarioMode === 'DRIVER_ONLY' ? null : `HW_${num}`;
    this.driverId = `drv_${num}`;
    this.scenarioMode = scenarioMode;

    // Distribute routes evenly across corridors
    this.route = SYNTHETIC_CORRIDORS[(index - 1) % SYNTHETIC_CORRIDORS.length]!;
    this.currentCoord = { ...this.route.waypoints[0]! };
    this.bootId = `boot_sim_${num}_001`;

    if (scenarioMode === 'CRITICAL_EVENTS') {
      this.vehicleBatteryMv = 11700; // Low vehicle battery (Part B.3 D-02)
    }
  }

  /**
   * Advances bus position along route for the given elapsed seconds.
   */
  public advancePosition(deltaSeconds: number = 10): void {
    this.tickCount++;

    if (this.scenarioMode === 'BOTH_LOST' && this.tickCount > 2) {
      // Stopped sending
      return;
    }

    const waypoints = this.route.waypoints;
    const currentWp = waypoints[this.waypointIndex]!;
    const nextWp = waypoints[(this.waypointIndex + 1) % waypoints.length]!;

    const distTotalM = haversineDistanceMeters(currentWp, nextWp);
    const speedMs = (this.speedKmh * 1000) / 3600;
    const distTraveledM = speedMs * deltaSeconds;

    const tIncrement = distTotalM > 0 ? distTraveledM / distTotalM : 0.1;
    this.progressT += tIncrement;

    if (this.progressT >= 1.0) {
      this.progressT = 0;
      this.waypointIndex = (this.waypointIndex + 1) % waypoints.length;
    }

    // Linear interpolation
    const p1 = waypoints[this.waypointIndex]!;
    const p2 = waypoints[(this.waypointIndex + 1) % waypoints.length]!;

    this.currentCoord = {
      lat: Math.round((p1.lat + (p2.lat - p1.lat) * this.progressT) * 1000000) / 1000000,
      lng: Math.round((p1.lng + (p2.lng - p1.lng) * this.progressT) * 1000000) / 1000000,
    };

    // Calculate heading
    const dLat = p2.lat - p1.lat;
    const dLng = p2.lng - p1.lng;
    this.headingDeg = (Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI) + 360) % 360;
  }

  /**
   * Generates hardware telemetry batch (if hardware is active).
   */
  public generateHardwareTelemetry(now: Date = new Date()): TelemetryBatchDto | null {
    if (!this.deviceId) return null;
    if (this.scenarioMode === 'DRIVER_ONLY') return null;
    if (this.scenarioMode === 'BOTH_LOST' && this.tickCount > 2) return null;
    if (this.scenarioMode === 'TRACKER_FAILED_PHONE_FALLBACK' && this.tickCount > 2) {
      // Hardware stopped transmitting
      return null;
    }

    if (this.scenarioMode === 'FLAPPING' && this.tickCount % 2 === 0) {
      // Dropping hardware samples every alternate tick to simulate instability
      return null;
    }

    const seq = this.sequence++;
    return {
      boot_id: this.bootId,
      samples: [
        {
          seq,
          recorded_at: now.toISOString(),
          gps_valid: true,
          lat: this.currentCoord.lat,
          lng: this.currentCoord.lng,
          speed_kmh: this.speedKmh,
          heading_deg: this.headingDeg,
          satellites: 9,
          hdop: 1.1,
          ignition: this.ignition,
        },
      ],
    };
  }

  /**
   * Generates driver phone telemetry (if phone is active).
   */
  public generateDriverTelemetry(now: Date = new Date()): DriverLocationsBatchDto | null {
    if (this.scenarioMode === 'BOTH_LOST' && this.tickCount > 2) return null;

    if (this.scenarioMode === 'FLAPPING' && this.tickCount % 2 !== 0) {
      // Alternating phone availability
      return null;
    }

    const speedMps = Math.round(((this.speedKmh * 1000) / 3600) * 10) / 10;
    return {
      shift_id: `shift_${this.driverId}_001`,
      app_version: '1.0.0',
      device_model: 'SM-A146B',
      samples: [
        {
          seq: this.sequence++,
          recorded_at: now.toISOString(),
          lat: this.currentCoord.lat,
          lng: this.currentCoord.lng,
          accuracy_m: 6.5,
          speed_mps: speedMps,
          heading_deg: this.headingDeg,
          provider: 'GPS',
          is_mock: false, // Rule C-03/C-10: never mock
        },
      ],
    };
  }

  /**
   * Generates periodic device heartbeat.
   */
  public generateHeartbeat(now: Date = new Date()): HeartbeatRequestDto | null {
    if (!this.deviceId) return null;
    if (this.scenarioMode === 'DRIVER_ONLY') return null;
    if (this.scenarioMode === 'BOTH_LOST' && this.tickCount > 2) return null;

    return {
      schema_version: 1,
      device_id: this.deviceId,
      boot_id: this.bootId,
      fw_version: '1.0.0',
      sent_at: now.toISOString(),
      uptime_s: this.tickCount * 10 + 60,
      network_status: 'REGISTERED',
      sim_status: 'READY',
      signal_rssi_dbm: this.scenarioMode === 'CRITICAL_EVENTS' ? -98 : -72,
      vehicle_battery_mv: this.vehicleBatteryMv,
      device_battery_mv: this.deviceBatteryMv,
      gps_status: 'FIX_VALID',
      buffer_bytes: 0,
      buffer_capacity_bytes: 65536,
      ignition: this.ignition,
      temperature_c: 28.0,
    };
  }

  /**
   * Generates hardware events (e.g. power cut, low battery) for test scenarios.
   */
  public generateEvents(now: Date = new Date()): HardwareEventDto[] | null {
    if (this.scenarioMode !== 'CRITICAL_EVENTS') return null;
    if (!this.deviceId) return null;

    return [
      {
        type: 'LOW_VEHICLE_BATTERY',
        seq: this.sequence++,
        occurred_at: now.toISOString(),
        data: {
          mv: this.vehicleBatteryMv,
          lat: this.currentCoord.lat,
          lng: this.currentCoord.lng,
        },
      },
      {
        type: 'POWER_DISCONNECTED',
        seq: this.sequence++,
        occurred_at: now.toISOString(),
        data: {
          mv: 0,
          lat: this.currentCoord.lat,
          lng: this.currentCoord.lng,
        },
      },
    ];
  }

  public getCurrentCoord(): LatLng {
    return { ...this.currentCoord };
  }
}
