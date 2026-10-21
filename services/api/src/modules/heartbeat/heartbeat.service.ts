import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import {
  DeviceRecord,
  KeyRing,
  authenticateDevice,
  computeDeviceHealthState,
  evaluateVehicleBatteryThreshold,
  evaluateDeviceBatteryThreshold,
  evaluateHardwareEvent,
  DeviceHealthState,
} from '@collegebus/domain';
import {
  HeartbeatRequestDto,
  HeartbeatResponseDto,
  HeartbeatPendingAction,
  HardwareEventDto,
  EventResultDto,
} from '@collegebus/contracts';

export interface DeviceHealthRecord {
  device_id: string;
  last_heartbeat_at: Date | null;
  state: DeviceHealthState;
  fw_version: string;
  uptime_s: number;
  vehicle_battery_mv: number | null;
  device_battery_mv: number | null;
  signal_rssi_dbm: number;
  sim_status: string;
  network_status: string;
  gps_status: string;
  buffer_bytes: number;
  ignition: 'ON' | 'OFF' | 'UNKNOWN';
}

export interface FirmwareReleaseTarget {
  version: string;
  sha256: string;
  size_bytes: number;
  storage_key: string;
  signature: string;
  channel?: 'STABLE' | 'BETA';
}

export interface StoredMaintenanceTicket {
  id: string;
  device_id: string;
  category: string;
  source: 'SYSTEM_ALERT';
  description: string;
  created_at: Date;
}

export interface StoredDeviceEvent {
  device_id: string;
  boot_id: string;
  seq: number;
  type: string;
  occurred_at: Date | null;
  received_at: Date;
  status: 'RECORDED' | 'PROCESSED' | 'IGNORED';
  data: Record<string, unknown>;
}

@Injectable()
export class HeartbeatService {
  private devices = new Map<string, DeviceRecord>();
  private healthRecords = new Map<string, DeviceHealthRecord>();
  private firmwareRollouts = new Map<string, FirmwareReleaseTarget>(); // channel/global or per device
  private maintenanceTickets: StoredMaintenanceTicket[] = [];
  private eventRegistry = new Map<string, StoredDeviceEvent>();
  private pausedRollouts = new Set<string>(); // device_ids with paused rollout

  registerDevice(device: DeviceRecord) {
    this.devices.set(device.device_id, device);
  }

  getDevice(deviceId: string): DeviceRecord | undefined {
    return this.devices.get(deviceId);
  }

  getDeviceHealth(deviceId: string): DeviceHealthRecord | undefined {
    return this.healthRecords.get(deviceId);
  }

  setFirmwareTarget(target: FirmwareReleaseTarget) {
    this.firmwareRollouts.set('GLOBAL', target);
  }

  getMaintenanceTickets(): StoredMaintenanceTicket[] {
    return [...this.maintenanceTickets];
  }

  isRolloutPausedForDevice(deviceId: string): boolean {
    return this.pausedRollouts.has(deviceId);
  }

  clear() {
    this.devices.clear();
    this.healthRecords.clear();
    this.firmwareRollouts.clear();
    this.maintenanceTickets = [];
    this.eventRegistry.clear();
    this.pausedRollouts.clear();
  }

  /**
   * Heartbeat Pipeline Stages H1 to H8 (Part 5.4, 9.13, 11.6, C-05, C-01)
   */
  async processHeartbeat(
    deviceId: string,
    rawBearerToken: string,
    dto: HeartbeatRequestDto,
    keyring: KeyRing,
    now: Date = new Date(),
    hasActiveShift: boolean = false,
  ): Promise<HeartbeatResponseDto> {
    // Stage H1: Authenticate the device token
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new UnauthorizedException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Unknown device identifier',
      });
    }

    const authResult = authenticateDevice(device, rawBearerToken, keyring, now);
    if (!authResult.allowed) {
      throw new UnauthorizedException({
        code: authResult.code || 'UNAUTHORIZED',
        message: authResult.reason || 'Device authentication failed',
      });
    }

    // Stage H2: Device state verification & C-01 first-use activation
    if (authResult.shouldActivate) {
      device.status = 'ACTIVE';
      device.first_used_at = now;
    }

    if (device.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'DEVICE_INACTIVE',
        message: `Device status is ${device.status}`,
      });
    }

    // Stage H3: Payload validated via Zod schema

    // Stage H4 & H5: Compute health state & update device_health
    const healthState = computeDeviceHealthState({
      lastHeartbeatAt: now,
      ignition: dto.ignition,
      now,
      hasActiveShift,
    });

    const healthRecord: DeviceHealthRecord = {
      device_id: deviceId,
      last_heartbeat_at: now,
      state: healthState,
      fw_version: dto.fw_version,
      uptime_s: dto.uptime_s,
      vehicle_battery_mv: dto.vehicle_battery_mv ?? null,
      device_battery_mv: dto.device_battery_mv ?? null,
      signal_rssi_dbm: dto.signal_rssi_dbm,
      sim_status: dto.sim_status,
      network_status: dto.network_status,
      gps_status: dto.gps_status,
      buffer_bytes: dto.buffer_bytes,
      ignition: dto.ignition,
    };
    this.healthRecords.set(deviceId, healthRecord);

    // Stage H6: Evaluate battery thresholds for tickets
    const vehicleClass = device.vehicle_class === 'V24' ? 'V24' : 'V12';
    const vehicleBatteryEval = evaluateVehicleBatteryThreshold(
      dto.vehicle_battery_mv,
      vehicleClass,
    );
    if (vehicleBatteryEval.isLow) {
      this.maintenanceTickets.push({
        id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        device_id: deviceId,
        category: 'LOW_VEHICLE_BATTERY',
        source: 'SYSTEM_ALERT',
        description: `Vehicle battery voltage (${dto.vehicle_battery_mv} mV) below ${vehicleBatteryEval.thresholdMv} mV threshold`,
        created_at: now,
      });
    }

    const deviceBatteryEval = evaluateDeviceBatteryThreshold(dto.device_battery_mv);
    if (deviceBatteryEval.isLow) {
      this.maintenanceTickets.push({
        id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        device_id: deviceId,
        category: 'LOW_DEVICE_BATTERY',
        source: 'SYSTEM_ALERT',
        description: `Internal backup battery voltage (${dto.device_battery_mv} mV) below ${deviceBatteryEval.thresholdMv} mV threshold`,
        created_at: now,
      });
    }

    // Stage H7: Compute pending_action (NONE, UPDATE_CONFIG, REBOOT, FIRMWARE_UPDATE)
    let pendingAction: HeartbeatPendingAction = 'NONE';
    const targetFw = this.firmwareRollouts.get('GLOBAL');

    const response: HeartbeatResponseDto = {
      schema_version: 1,
      server_time: now.toISOString(),
      config: {
        moving_interval_s: 10,
        stopped_interval_s: 30,
        parked_heartbeat_s: 600,
      },
      pending_action: 'NONE',
    };

    // If an update target exists, device is not on it, and rollout is not paused
    if (targetFw && targetFw.version !== dto.fw_version && !this.pausedRollouts.has(deviceId)) {
      pendingAction = 'FIRMWARE_UPDATE';
      response.pending_action = pendingAction;
      response.firmware_target = targetFw.version;
      // Presigned GET valid 15 minutes per C-05 and Part 20.6
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      response.firmware_url = `https://s3.ap-south-1.amazonaws.com/collegebus-firmware/${targetFw.storage_key}?expires=${encodeURIComponent(expiresAt)}`;
      response.firmware_sha256 = targetFw.sha256;
      response.firmware_size_bytes = targetFw.size_bytes;
      response.firmware_signature = targetFw.signature;
    }

    // Stage H8: Return formatted response
    return response;
  }

  /**
   * Event Pipeline Stages E1 to E6 (Part 5.5 and SW-MVP section 12)
   */
  async processEvents(
    deviceId: string,
    rawBearerToken: string,
    bootId: string,
    events: HardwareEventDto[],
    keyring: KeyRing,
    now: Date = new Date(),
    isShiftActive: boolean = false,
  ): Promise<EventResultDto[]> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new UnauthorizedException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Unknown device identifier',
      });
    }

    const authResult = authenticateDevice(device, rawBearerToken, keyring, now);
    if (!authResult.allowed) {
      throw new UnauthorizedException({
        code: authResult.code || 'UNAUTHORIZED',
        message: authResult.reason || 'Device authentication failed',
      });
    }

    if (authResult.shouldActivate) {
      device.status = 'ACTIVE';
      device.first_used_at = now;
    }

    const results: EventResultDto[] = [];

    // Stage E1-E6 for each event
    for (const event of events) {
      const dedupeKey = `${deviceId}:${bootId}:${event.seq}`;

      // Stage E2: Deduplication by (device_id, boot_id, seq)
      const existing = this.eventRegistry.get(dedupeKey);
      if (existing) {
        results.push({
          seq: event.seq,
          status: existing.status,
          incident_id: null,
        });
        continue;
      }

      // Stage E4: Events older than 7 days are stored but not acted on
      const isStale =
        event.occurred_at &&
        now.getTime() - new Date(event.occurred_at).getTime() > 7 * 86400 * 1000;

      if (isStale) {
        this.eventRegistry.set(dedupeKey, {
          device_id: deviceId,
          boot_id: bootId,
          seq: event.seq,
          type: event.type,
          occurred_at: event.occurred_at ? new Date(event.occurred_at) : null,
          received_at: now,
          status: 'IGNORED',
          data: event.data,
        });
        results.push({
          seq: event.seq,
          status: 'IGNORED',
          incident_id: null,
        });
        continue;
      }

      // Count recent watchdog and module errors for contextual thresholds
      const recentWatchdogs = Array.from(this.eventRegistry.values()).filter(
        (e) =>
          e.device_id === deviceId &&
          e.type === 'BOOT' &&
          (e.data['reset_reason'] === 'WATCHDOG' || e.data['reset_reason'] === 'BROWNOUT') &&
          now.getTime() - e.received_at.getTime() <= 86400 * 1000,
      ).length;

      const recentModuleErrors = Array.from(this.eventRegistry.values()).filter(
        (e) =>
          e.device_id === deviceId &&
          e.type === 'MODULE_ERROR' &&
          now.getTime() - e.received_at.getTime() <= 86400 * 1000,
      ).length;

      // Stage E5: Evaluate event action
      const evaluation = evaluateHardwareEvent(event.type, event.data, {
        recentWatchdogCount: recentWatchdogs,
        recentModuleErrorCount: recentModuleErrors,
        isShiftActive,
      });

      if (evaluation.action === 'OPEN_TICKET' && evaluation.ticket) {
        this.maintenanceTickets.push({
          id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          device_id: deviceId,
          category: evaluation.ticket.category,
          source: evaluation.ticket.source,
          description: evaluation.ticket.description,
          created_at: now,
        });
      } else if (evaluation.action === 'PAUSE_ROLLOUT') {
        this.pausedRollouts.add(deviceId);
        if (evaluation.ticket) {
          this.maintenanceTickets.push({
            id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            device_id: deviceId,
            category: evaluation.ticket.category,
            source: evaluation.ticket.source,
            description: evaluation.ticket.description,
            created_at: now,
          });
        }
      }

      this.eventRegistry.set(dedupeKey, {
        device_id: deviceId,
        boot_id: bootId,
        seq: event.seq,
        type: event.type,
        occurred_at: event.occurred_at ? new Date(event.occurred_at) : null,
        received_at: now,
        status: evaluation.status,
        data: event.data,
      });

      results.push({
        seq: event.seq,
        status: evaluation.status,
        incident_id: evaluation.incident_id,
      });
    }

    return results;
  }
}
