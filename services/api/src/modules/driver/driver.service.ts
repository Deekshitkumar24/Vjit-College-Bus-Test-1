import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { validateDriverPhoneSample, DriverPhoneSampleInput } from '@collegebus/domain';
import {
  DriverLocationsBatchDto,
  DriverLocationsResponseDto,
  DriverSampleRejection,
  DriverStatusDto,
  DriverRosterResponseDto,
  DriverDeviceRegisterDto,
  DriverDeviceRegisterResponseDto,
  DriverTrackingMode,
  DriverModeSwitchRequestDto,
  DriverModeSwitchResponseDto,
  SosCategory,
  SosTriggerResponseDto,
} from '@collegebus/contracts';
import { ShiftService } from '../shift/shift.service.js';

export interface StoredDriverSample {
  shift_id: string;
  bus_id: string;
  driver_id: string;
  seq: number;
  recorded_at: Date;
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_kmh: number | null;
  heading_deg: number | null;
  provider: string;
  is_mock: boolean;
  signature: string;
}

export interface StoredDriverStatus {
  driver_id: string;
  shift_id?: string | undefined;
  app_version: string;
  os: 'ANDROID' | 'IOS';
  os_version: string;
  location_permission: string;
  notifications_permission: string;
  battery_percent: number;
  battery_optimisation_exempt: boolean | null;
  background_running: boolean;
  gps_enabled: boolean;
  network: string;
  recorded_at: Date;
}

export interface StoredDriverDeviceRegistration extends DriverDeviceRegisterDto {
  registered_at: Date;
}

export interface StoredTrackingModeRecord {
  mode: DriverTrackingMode;
  note: string | null;
  updated_at: Date;
  updated_by: string;
}

export interface StoredDriverSosIncident {
  incident_id: string;
  shift_id: string;
  bus_id: string;
  driver_id: string;
  category: SosCategory;
  status: 'OPEN' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED';
  step: 'RECEIVED' | 'NOTIFIED' | 'ACKNOWLEDGED';
  dispatched_at: string;
  security_phone: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  note: string | null;
  received_at: string;
  notified_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

@Injectable()
export class DriverService {
  constructor(private readonly shiftService: ShiftService) {}

  private sampleRegistry = new Map<string, StoredDriverSample>();
  private driverStatuses = new Map<string, StoredDriverStatus>();
  private busActiveSource = new Map<string, 'HW' | 'PHONE'>();
  private deviceRegistrations = new Map<string, StoredDriverDeviceRegistration>();
  private trackingModes = new Map<string, StoredTrackingModeRecord>();
  private sosIncidents = new Map<string, StoredDriverSosIncident>();
  private busMetadata = new Map<
    string,
    { bus_number: string; registration_number: string; route_id: string; route_name: string }
  >();

  registerBusMetadata(
    busId: string,
    metadata: {
      bus_number: string;
      registration_number: string;
      route_id: string;
      route_name: string;
    },
  ) {
    this.busMetadata.set(busId, metadata);
  }

  setBusActiveSource(busId: string, source: 'HW' | 'PHONE') {
    this.busActiveSource.set(busId, source);
  }

  getStoredSamples(): StoredDriverSample[] {
    return Array.from(this.sampleRegistry.values());
  }

  getDriverStatus(driverId: string): StoredDriverStatus | undefined {
    return this.driverStatuses.get(driverId);
  }

  registerDevice(
    driverId: string,
    dto: DriverDeviceRegisterDto,
    now: Date = new Date(),
  ): DriverDeviceRegisterResponseDto {
    this.deviceRegistrations.set(driverId, {
      ...dto,
      registered_at: now,
    });

    return {
      registered: true,
      registered_at: now.toISOString(),
      device_label: dto.device_label,
    };
  }

  getDeviceRegistration(driverId: string): StoredDriverDeviceRegistration | undefined {
    return this.deviceRegistrations.get(driverId);
  }

  getRoster(driverId: string, now: Date = new Date()): DriverRosterResponseDto {
    const rosterEntries = this.shiftService.getRosterEntriesForDriver(driverId, now);

    const buses = rosterEntries.map((r) => {
      const meta = this.busMetadata.get(r.bus_id) || {
        bus_number: r.bus_id.replace(/^bus_/, 'Bus '),
        registration_number: 'KA-01-F-1001',
        route_id: 'route_default',
        route_name: 'Campus Express',
      };

      return {
        bus_id: r.bus_id,
        bus_number: meta.bus_number,
        registration_number: meta.registration_number,
        route_id: meta.route_id,
        route_name: meta.route_name,
        is_active: true,
      };
    });

    return {
      driver_id: driverId,
      buses,
    };
  }

  getBusDetail(driverId: string, busId: string, now: Date = new Date()) {
    const isRostered = this.shiftService.isDriverRosteredForBus(driverId, busId, now);
    if (!isRostered) {
      throw new ForbiddenException({
        code: 'DRIVER_NOT_ON_ROSTER',
        message: `Driver is not rostered on bus ${busId}`,
      });
    }

    const meta = this.busMetadata.get(busId) || {
      bus_number: busId.replace(/^bus_/, 'Bus '),
      registration_number: 'KA-01-F-1001',
      route_id: 'route_default',
      route_name: 'Campus Express',
    };

    return {
      bus_id: busId,
      bus_number: meta.bus_number,
      registration_number: meta.registration_number,
      route_id: meta.route_id,
      route_name: meta.route_name,
      is_active: true,
    };
  }

  clear() {
    this.sampleRegistry.clear();
    this.driverStatuses.clear();
    this.busActiveSource.clear();
    this.deviceRegistrations.clear();
    this.busMetadata.clear();
    this.trackingModes.clear();
    this.sosIncidents.clear();
  }

  private computeSignature(sample: DriverPhoneSampleInput): string {
    return `${sample.lat.toFixed(6)}|${sample.lng.toFixed(6)}|${sample.accuracy_m}|${sample.speed_mps ?? ''}|${sample.heading_deg ?? ''}|${sample.provider}|${sample.is_mock}`;
  }

  /**
   * Driver Phone Telemetry Pipeline (Part 5.3 & SW-MVP section 11.7)
   */
  async ingestLocations(
    driverId: string,
    batch: DriverLocationsBatchDto,
    now: Date = new Date(),
  ): Promise<DriverLocationsResponseDto> {
    const shift = this.shiftService.getShift(batch.shift_id);
    if (!shift) {
      throw new UnauthorizedException({
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift claim does not exist',
      });
    }

    if (shift.driver_id !== driverId) {
      throw new ForbiddenException({
        code: 'SHIFT_DRIVER_MISMATCH',
        message: 'Shift does not belong to this driver',
      });
    }

    if (shift.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'SHIFT_NOT_ACTIVE',
        message: `Shift is no longer active (status is ${shift.status})`,
      });
    }

    const rejections: DriverSampleRejection[] = [];
    let ackSeq = 0;

    for (const sample of batch.samples) {
      const dedupeKey = `${batch.shift_id}:${sample.seq}`;
      const signature = this.computeSignature(sample);

      // Deduplication check
      if (this.sampleRegistry.has(dedupeKey)) {
        const existing = this.sampleRegistry.get(dedupeKey);
        if (existing && existing.signature === signature) {
          // Identical duplicate -> accepted silently
          if (sample.seq > ackSeq) ackSeq = sample.seq;
          continue;
        } else {
          // Conflicting sample payload with same sequence number -> per-sample 200 CONFLICT (C-09)
          rejections.push({
            seq: sample.seq,
            reason: 'CONFLICT',
          });
          continue;
        }
      }

      // Domain validation (accuracy <= 50m, provider != NETWORK, is_mock false, timestamps, null island)
      const validation = validateDriverPhoneSample(sample, now);

      if (!validation.accepted) {
        // If it's a mock location, store it flagged with is_mock = true per Part 5.3
        if (validation.reason === 'MOCK_LOCATION') {
          this.sampleRegistry.set(dedupeKey, {
            shift_id: batch.shift_id,
            bus_id: shift.bus_id,
            driver_id: driverId,
            seq: sample.seq,
            recorded_at: new Date(sample.recorded_at),
            lat: sample.lat,
            lng: sample.lng,
            accuracy_m: sample.accuracy_m,
            speed_kmh: null,
            heading_deg: sample.heading_deg ?? null,
            provider: sample.provider,
            is_mock: true,
            signature,
          });
        }

        rejections.push({
          seq: sample.seq,
          reason: validation.reason || 'OUT_OF_RANGE',
        });
        continue;
      }

      // Accepted sample -> store attributed directly to shift's bus_id
      this.sampleRegistry.set(dedupeKey, {
        shift_id: batch.shift_id,
        bus_id: shift.bus_id,
        driver_id: driverId,
        seq: sample.seq,
        recorded_at: new Date(sample.recorded_at),
        lat: sample.lat,
        lng: sample.lng,
        accuracy_m: sample.accuracy_m,
        speed_kmh: validation.speed_kmh ?? null,
        heading_deg: sample.heading_deg ?? null,
        provider: sample.provider,
        is_mock: false,
        signature,
      });

      if (sample.seq > ackSeq) {
        ackSeq = sample.seq;
      }
    }

    const activeSource = this.busActiveSource.get(shift.bus_id) || 'HW';
    // Cadence: 30s when HW is active (Standby), 10s when PHONE is active (Fallback) per Part 5.3
    const phoneIntervalS: 10 | 30 = activeSource === 'PHONE' ? 10 : 30;

    return {
      ack_seq: ackSeq,
      rejected: rejections,
      phone_interval_s: phoneIntervalS,
      active_source: activeSource,
      server_time: now.toISOString(),
    };
  }

  /**
   * Driver Phone Status Reporting (SW-MVP section 11.7)
   */
  async recordDriverStatus(
    driverId: string,
    dto: DriverStatusDto,
    shiftId?: string,
    now: Date = new Date(),
  ): Promise<{ status: string }> {
    this.driverStatuses.set(driverId, {
      driver_id: driverId,
      shift_id: shiftId,
      app_version: dto.app_version,
      os: dto.os,
      os_version: dto.os_version,
      location_permission: dto.location_permission,
      notifications_permission: dto.notifications_permission,
      battery_percent: dto.battery_percent,
      battery_optimisation_exempt: dto.battery_optimisation_exempt ?? null,
      background_running: dto.background_running,
      gps_enabled: dto.gps_enabled,
      network: dto.network,
      recorded_at: now,
    });

    return { status: 'RECORDED' };
  }

  /**
   * Tracking Mode Switcher (SW-MVP-1.0 §16.3 #6 & D-13)
   */
  switchMode(
    driverId: string,
    dto: DriverModeSwitchRequestDto,
    now: Date = new Date(),
  ): DriverModeSwitchResponseDto {
    const shift = this.shiftService.getShift(dto.shift_id);
    if (!shift) {
      throw new UnauthorizedException({
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift claim does not exist',
      });
    }

    if (shift.driver_id !== driverId) {
      throw new ForbiddenException({
        code: 'SHIFT_DRIVER_MISMATCH',
        message: 'Shift does not belong to this driver',
      });
    }

    if (shift.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'SHIFT_NOT_ACTIVE',
        message: `Shift is no longer active (status is ${shift.status})`,
      });
    }

    // Set active source for the bus based on selected mode
    if (dto.mode === 'PHONE') {
      this.busActiveSource.set(shift.bus_id, 'PHONE');
    } else if (dto.mode === 'HARDWARE') {
      this.busActiveSource.set(shift.bus_id, 'HW');
    } else {
      // AUTO mode: default to HW if available
      this.busActiveSource.set(shift.bus_id, 'HW');
    }

    this.trackingModes.set(shift.bus_id, {
      mode: dto.mode,
      note: dto.note ?? null,
      updated_at: now,
      updated_by: driverId,
    });

    return {
      mode: dto.mode,
      updated_at: now.toISOString(),
      bus_id: shift.bus_id,
      note: dto.note ?? null,
    };
  }

  getTrackingMode(busId: string): DriverTrackingMode {
    return this.trackingModes.get(busId)?.mode || 'AUTO';
  }

  /**
   * Driver SOS Emergency Trigger (SW-MVP-1.0 §16.3 #7 & L-2)
   */
  triggerSos(
    driverId: string,
    shiftId: string,
    payload: {
      category: SosCategory;
      lat?: number | undefined;
      lng?: number | undefined;
      accuracy_m?: number | undefined;
      note?: string | undefined;
    },
    now: Date = new Date(),
  ): SosTriggerResponseDto {
    const shift = this.shiftService.getShift(shiftId);
    if (!shift) {
      throw new UnauthorizedException({
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift claim does not exist',
      });
    }

    if (shift.driver_id !== driverId) {
      throw new ForbiddenException({
        code: 'SHIFT_DRIVER_MISMATCH',
        message: 'Shift does not belong to this driver',
      });
    }

    const incidentId = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const securityPhone = '+91-80-2345-6789';

    // Mark SOS as open for bus on shiftService to block driver manual end per §15.4
    this.shiftService.setBusOpenSos(shift.bus_id, true);

    this.sosIncidents.set(incidentId, {
      incident_id: incidentId,
      shift_id: shiftId,
      bus_id: shift.bus_id,
      driver_id: driverId,
      category: payload.category,
      status: 'OPEN',
      step: 'RECEIVED',
      dispatched_at: now.toISOString(),
      security_phone: securityPhone,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      accuracy_m: payload.accuracy_m ?? null,
      note: payload.note ?? null,
      received_at: now.toISOString(),
      notified_at: new Date(now.getTime() + 1000).toISOString(),
      acknowledged_at: null,
      acknowledged_by: null,
    });

    return {
      incident_id: incidentId,
      status: 'OPEN',
      category: payload.category,
      dispatched_at: now.toISOString(),
      security_phone: securityPhone,
      message: 'SOS incident created. Coordinators and Security alerted.',
    };
  }

  getSosIncident(incidentId: string): StoredDriverSosIncident {
    const incident = this.sosIncidents.get(incidentId);
    if (!incident) {
      throw new NotFoundException({
        code: 'SOS_INCIDENT_NOT_FOUND',
        message: 'SOS incident not found',
      });
    }
    return incident;
  }

  acknowledgeSos(
    incidentId: string,
    acknowledgedBy: string,
    now: Date = new Date(),
  ): StoredDriverSosIncident {
    const incident = this.getSosIncident(incidentId);
    incident.status = 'RESPONDING';
    incident.step = 'ACKNOWLEDGED';
    incident.acknowledged_at = now.toISOString();
    incident.acknowledged_by = acknowledgedBy;
    return incident;
  }
}
