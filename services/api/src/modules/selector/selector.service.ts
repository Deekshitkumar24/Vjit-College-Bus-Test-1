import { Injectable } from '@nestjs/common';
import {
  evaluateSourceSelection,
  TrackingMode,
  BusSource,
  BusDisplayState,
  SwitchReason,
} from '@collegebus/domain';
import { ShiftService } from '../shift/shift.service.js';
import { DriverService } from '../driver/driver.service.js';

export interface SampleCoordinates {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  heading_deg: number | null;
  recorded_at: Date;
}

export interface BusStateRecord {
  bus_id: string;
  version: number;
  state: BusDisplayState;
  active_source: BusSource;
  mode: TrackingMode;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  heading_deg: number | null;
  source_updated_at: Date | null;
  last_hw_valid_at: Date | null;
  last_phone_valid_at: Date | null;
  consecutive_hw_valid: number;
  last_switched_at: Date | null;
  flap_hold_until: Date | null;
  route_version: number;
  updated_at: Date;
  last_hw_sample?: SampleCoordinates | undefined;
  last_phone_sample?: SampleCoordinates | undefined;
}

export interface SourceSwitchRecord {
  id: string;
  bus_id: string;
  from_source: BusSource;
  to_source: BusSource;
  reason_code: SwitchReason;
  actor_type: 'SYSTEM' | 'DRIVER' | 'ADMIN';
  actor_id?: string | undefined;
  note?: string | undefined;
  at: Date;
}

export interface OperationalAlertRecord {
  id: string;
  bus_id: string;
  type: 'BUS_UNAVAILABLE' | 'SOURCE_FLAPPING';
  severity: 1 | 2 | 3;
  raised_at: Date;
  message: string;
}

export interface OutboxRecord {
  id: string;
  kind: 'SOURCE_SWITCHED' | 'BUS_STATE_CHANGED';
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DONE' | 'FAILED';
  available_at: Date;
  created_at: Date;
}

@Injectable()
export class SelectorService {
  constructor(
    private readonly shiftService: ShiftService,
    private readonly driverService: DriverService,
  ) {}

  private busStates = new Map<string, BusStateRecord>();
  private sourceSwitches: SourceSwitchRecord[] = [];
  private operationalAlerts: OperationalAlertRecord[] = [];
  private outboxRecords: OutboxRecord[] = [];

  getBusState(busId: string): BusStateRecord | undefined {
    return this.busStates.get(busId);
  }

  getSourceSwitches(busId?: string): SourceSwitchRecord[] {
    if (busId) {
      return this.sourceSwitches.filter((s) => s.bus_id === busId);
    }
    return [...this.sourceSwitches];
  }

  getOperationalAlerts(): OperationalAlertRecord[] {
    return [...this.operationalAlerts];
  }

  getOutboxRecords(): OutboxRecord[] {
    return [...this.outboxRecords];
  }

  setMode(
    busId: string,
    mode: TrackingMode,
    actorType: 'SYSTEM' | 'DRIVER' | 'ADMIN' = 'ADMIN',
    actorId?: string,
  ) {
    const state = this.getOrCreateBusState(busId);
    state.mode = mode;
    this.evaluateBus(busId, new Date(), actorType, actorId);
  }

  updateHardwareLocation(
    busId: string,
    lat: number,
    lng: number,
    speedKmh: number,
    headingDeg: number,
    recordedAt: Date,
    gpsValid: boolean,
  ) {
    const state = this.getOrCreateBusState(busId);
    state.last_hw_sample = {
      lat,
      lng,
      speed_kmh: speedKmh,
      heading_deg: headingDeg,
      recorded_at: recordedAt,
    };

    if (gpsValid) {
      if (
        state.last_hw_valid_at &&
        (recordedAt.getTime() - state.last_hw_valid_at.getTime()) / 1000 <= 30
      ) {
        state.consecutive_hw_valid += 1;
      } else {
        state.consecutive_hw_valid = 1;
      }
      state.last_hw_valid_at = recordedAt;
    } else {
      // Invalid sample resets consecutive_hw_valid
      state.consecutive_hw_valid = 0;
    }
    this.evaluateBus(busId, recordedAt);
  }

  updatePhoneLocation(
    busId: string,
    lat: number,
    lng: number,
    speedKmh: number | null,
    headingDeg: number | null,
    recordedAt: Date,
  ) {
    const state = this.getOrCreateBusState(busId);
    state.last_phone_sample = {
      lat,
      lng,
      speed_kmh: speedKmh,
      heading_deg: headingDeg,
      recorded_at: recordedAt,
    };
    state.last_phone_valid_at = recordedAt;
    this.evaluateBus(busId, recordedAt);
  }

  clear() {
    this.busStates.clear();
    this.sourceSwitches = [];
    this.operationalAlerts = [];
    this.outboxRecords = [];
  }

  private getOrCreateBusState(busId: string): BusStateRecord {
    let state = this.busStates.get(busId);
    if (!state) {
      state = {
        bus_id: busId,
        version: 1,
        state: 'NOT_RUNNING',
        active_source: 'NONE',
        mode: 'AUTO',
        lat: null,
        lng: null,
        speed_kmh: null,
        heading_deg: null,
        source_updated_at: null,
        last_hw_valid_at: null,
        last_phone_valid_at: null,
        consecutive_hw_valid: 0,
        last_switched_at: null,
        flap_hold_until: null,
        route_version: 1,
        updated_at: new Date(),
      };
      this.busStates.set(busId, state);
    }
    return state;
  }

  /**
   * Runs the selector algorithm for busId with locked bus_state row semantics (Part 9.3).
   */
  evaluateBus(
    busId: string,
    now: Date = new Date(),
    actorType: 'SYSTEM' | 'DRIVER' | 'ADMIN' = 'SYSTEM',
    actorId?: string,
  ): BusStateRecord {
    const state = this.getOrCreateBusState(busId);
    const activeShift = this.shiftService.getActiveShiftForBus(busId);
    const hasActiveShift = !!activeShift;

    // Collect switch timestamps within window for anti-flapping check
    const recentSwitchTimestamps = this.sourceSwitches
      .filter((s) => s.bus_id === busId)
      .map((s) => s.at);

    const result = evaluateSourceSelection({
      hasActiveShift,
      mode: state.mode,
      currentActiveSource: state.active_source,
      currentState: state.state,
      lastHwValidAt: state.last_hw_valid_at,
      lastPhoneValidAt: state.last_phone_valid_at,
      consecutiveHwValid: state.consecutive_hw_valid,
      lastSwitchedAt: state.last_switched_at,
      recentSwitchTimestamps,
      flapHoldUntil: state.flap_hold_until,
      now,
    });

    const previousSource = state.active_source;
    const previousState = state.state;

    // If source switched, audit log in source_switches and update driver service cadence
    if (result.switched && result.switchReason) {
      state.last_switched_at = now;
      const switchId = `switch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.sourceSwitches.push({
        id: switchId,
        bus_id: busId,
        from_source: previousSource,
        to_source: result.nextActiveSource,
        reason_code: result.switchReason,
        actor_type: actorType,
        actor_id: actorId,
        at: now,
      });

      // Synchronize active source with DriverService for dynamic cadence responses
      if (result.nextActiveSource === 'HW' || result.nextActiveSource === 'PHONE') {
        this.driverService.setBusActiveSource(busId, result.nextActiveSource);
      }

      // Outbox event trigger for source switch
      this.outboxRecords.push({
        id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        kind: 'SOURCE_SWITCHED',
        payload: {
          bus_id: busId,
          from_source: previousSource,
          to_source: result.nextActiveSource,
          reason_code: result.switchReason,
          actor_type: actorType,
          actor_id: actorId,
          at: now.toISOString(),
        },
        status: 'PENDING',
        available_at: now,
        created_at: now,
      });
    }

    state.active_source = result.nextActiveSource;
    state.state = result.nextState;
    state.consecutive_hw_valid = result.nextConsecutiveHwValid;
    state.flap_hold_until = result.nextFlapHoldUntil;
    state.version += 1;
    state.updated_at = now;

    // Update active coordinates from the active source sample
    if (state.active_source === 'HW' && state.last_hw_sample) {
      state.lat = state.last_hw_sample.lat;
      state.lng = state.last_hw_sample.lng;
      state.speed_kmh = state.last_hw_sample.speed_kmh;
      state.heading_deg = state.last_hw_sample.heading_deg;
      state.source_updated_at = state.last_hw_sample.recorded_at;
    } else if (state.active_source === 'PHONE' && state.last_phone_sample) {
      state.lat = state.last_phone_sample.lat;
      state.lng = state.last_phone_sample.lng;
      state.speed_kmh = state.last_phone_sample.speed_kmh;
      state.heading_deg = state.last_phone_sample.heading_deg;
      state.source_updated_at = state.last_phone_sample.recorded_at;
    }

    // Outbox event trigger for bus state change (if state or source changed)
    if (previousState !== result.nextState || previousSource !== result.nextActiveSource) {
      this.outboxRecords.push({
        id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        kind: 'BUS_STATE_CHANGED',
        payload: {
          bus_id: busId,
          previous_state: previousState,
          next_state: result.nextState,
          active_source: result.nextActiveSource,
          version: state.version,
          updated_at: now.toISOString(),
        },
        status: 'PENDING',
        available_at: now,
        created_at: now,
      });
    }

    // Handle alerts raised by selector (Part 11.5)
    if (result.alertRaised === 'BUS_UNAVAILABLE') {
      this.operationalAlerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        bus_id: busId,
        type: 'BUS_UNAVAILABLE',
        severity: 2, // Severity 2 per Part 11.5
        raised_at: now,
        message: `Bus ${busId} on active shift has received no fresh data from either source for 120 seconds`,
      });
    } else if (result.alertRaised === 'SOURCE_FLAPPING') {
      this.operationalAlerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        bus_id: busId,
        type: 'SOURCE_FLAPPING',
        severity: 3, // Severity 3 per Part 11.5
        raised_at: now,
        message: `Bus ${busId} experienced more than 6 source switches in 10 minutes. Source locked for 300 seconds.`,
      });
    }

    return state;
  }
}
