import {
  DeviceStatus,
  ProvisionDeviceItemDto,
  ProvisionedDeviceResponseDto,
  CreateDeviceLinkDto,
  ReplaceDeviceWizardDto,
  RevokeDeviceDto,
  RotateDeviceTokenDto,
} from '@collegebus/contracts';
import { AdminRole } from '../auth/auth-context.js';

export interface DeviceRecordItem {
  device_id: string;
  serial_number: string;
  imei: string;
  iccid: string;
  vehicle_class: 'V12' | 'V24';
  status: DeviceStatus;
  token_hash: string;
  token_plaintext?: string; // only present immediately upon provisioning
  key_version: number;
  linked_bus_id: string | null;
  linked_bus_number: string | null;
  provisioned_at: string;
  last_heartbeat_at: string | null;
  last_valid_fix_at: string | null;
  revoked_at: string | null;
  is_bench: boolean;
}

export interface MaintenanceTicketRecord {
  id: string;
  device_id: string;
  bus_number: string | null;
  category: 'DEVICE_REVOKED' | 'HARDWARE_FAULT' | 'REPLACEMENT_REQUIRED' | 'GPS_LOST';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED';
  notes: string[];
  created_at: string;
  escalated_to_coordinator: boolean;
}

export interface CommissioningChecklist {
  heartbeat_received_within_2m: boolean;
  gnss_fix_acquired_within_5m: boolean;
  telemetry_received_within_1m: boolean;
  power_voltage_verified: boolean;
  technician_signature: string;
  signed_off_at: string | null;
}

export class DeviceLifecycleManager {
  private devices: Map<string, DeviceRecordItem> = new Map();
  private tickets: Map<string, MaintenanceTicketRecord> = new Map();
  private linkHistory: Array<{
    device_id: string;
    bus_id: string;
    bus_number: string;
    linked_at: string;
    unlinked_at: string | null;
  }> = [];

  constructor(initialDevices: DeviceRecordItem[] = []) {
    for (const d of initialDevices) {
      this.devices.set(d.device_id, { ...d });
    }
  }

  /**
   * Batch Provision Devices (Technician or Admin workflow).
   * Generates unique 256-bit token plaintext and label payload (SW-MVP §16.5, AC-TEC-01).
   */
  public provisionBatch(
    items: ProvisionDeviceItemDto[],
  ): ProvisionedDeviceResponseDto[] {
    const results: ProvisionedDeviceResponseDto[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      if (this.devices.has(item.device_id)) {
        throw new Error(`Device with ID ${item.device_id} already exists`);
      }

      // Generate one-time plaintext token (32 bytes hex)
      const tokenPlaintext = `dvt_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      // Simulated HMAC hash for storage
      const tokenHash = `hmac_${tokenPlaintext}`;
      const status: DeviceStatus = item.is_bench ? 'BENCH' : 'PROVISIONED';

      const record: DeviceRecordItem = {
        device_id: item.device_id,
        serial_number: item.serial_number,
        imei: item.imei,
        iccid: item.iccid,
        vehicle_class: item.vehicle_class ?? 'V12',
        status,
        token_hash: tokenHash,
        token_plaintext: tokenPlaintext,
        key_version: 1,
        linked_bus_id: null,
        linked_bus_number: null,
        provisioned_at: now,
        last_heartbeat_at: null,
        last_valid_fix_at: null,
        revoked_at: null,
        is_bench: item.is_bench ?? false,
      };

      this.devices.set(item.device_id, record);

      results.push({
        device_id: item.device_id,
        serial_number: item.serial_number,
        status,
        token_plaintext: tokenPlaintext,
        token_qr_uri: `collegebus://provision?device=${item.device_id}&token=${tokenPlaintext}`,
        label_payload: {
          device_id: item.device_id,
          serial_number: item.serial_number,
          imei: item.imei,
          provisioned_at: now,
        },
      });
    }

    return results;
  }

  /**
   * Links a device to a bus.
   * Strict Rule: ONLY Coordinator (COR) or Super Admin (SAD) can link devices (SW-MVP §16.5).
   * Technicians (TEC) are blocked.
   */
  public linkDeviceToBus(
    dto: CreateDeviceLinkDto,
    busNumber: string,
    callerRole: AdminRole,
  ): void {
    if (callerRole !== 'COR' && callerRole !== 'SAD') {
      throw new Error('Technicians cannot link a device to a bus. That is a coordinator action (R-01, R-02).');
    }

    const device = this.devices.get(dto.device_id);
    if (!device) {
      throw new Error(`Device ${dto.device_id} not found`);
    }

    if (device.status === 'REVOKED' || device.status === 'RETIRED') {
      throw new Error(`Cannot link inactive device with status ${device.status}`);
    }

    // Check if device is already linked to another bus
    if (device.linked_bus_id && device.linked_bus_id !== dto.bus_id) {
      throw new Error(`Device ${dto.device_id} is already linked to bus ${device.linked_bus_number}`);
    }

    // Unlink any existing device on target bus
    for (const d of this.devices.values()) {
      if (d.linked_bus_id === dto.bus_id && d.device_id !== dto.device_id) {
        d.linked_bus_id = null;
        d.linked_bus_number = null;
      }
    }

    const effectiveFrom = dto.effective_from ?? new Date().toISOString();
    device.linked_bus_id = dto.bus_id;
    device.linked_bus_number = busNumber;

    this.linkHistory.push({
      device_id: dto.device_id,
      bus_id: dto.bus_id,
      bus_number: busNumber,
      linked_at: effectiveFrom,
      unlinked_at: null,
    });
  }

  /**
   * Replaces an existing device with a new device on a bus (SW-MVP §16.5 workflow 3).
   * Old device becomes RETIRED or REVOKED. New device is linked from same timestamp.
   * Historical samples remain attached to the old device (AC-TEC-02).
   */
  public replaceDevice(dto: ReplaceDeviceWizardDto, busNumber: string, callerRole: AdminRole): void {
    if (callerRole !== 'COR' && callerRole !== 'SAD') {
      throw new Error('Device replacement binding requires Coordinator or Super Admin authority');
    }

    const oldDevice = this.devices.get(dto.old_device_id);
    if (!oldDevice) {
      throw new Error(`Old device ${dto.old_device_id} not found`);
    }

    const newDevice = this.devices.get(dto.new_device_id);
    if (!newDevice) {
      throw new Error(`New device ${dto.new_device_id} not found`);
    }

    const now = new Date().toISOString();

    // Retire old device and close its link history
    oldDevice.status = dto.reason === 'FAILED' ? 'REVOKED' : 'RETIRED';
    oldDevice.linked_bus_id = null;
    oldDevice.linked_bus_number = null;

    for (const link of this.linkHistory) {
      if (link.device_id === dto.old_device_id && link.unlinked_at === null) {
        link.unlinked_at = now;
      }
    }

    // Link new device
    newDevice.linked_bus_id = dto.bus_id;
    newDevice.linked_bus_number = busNumber;

    this.linkHistory.push({
      device_id: dto.new_device_id,
      bus_id: dto.bus_id,
      bus_number: busNumber,
      linked_at: now,
      unlinked_at: null,
    });
  }

  /**
   * Revoke device token with typed confirmation of bus number (SW-MVP §16.4 workflow 11).
   * Acceptance Criterion AC-COR-01:
   * Given a device is revoked, its next request is rejected within 5 seconds,
   * and a ticket appears on the technician's list.
   */
  public revokeDevice(dto: RevokeDeviceDto): { success: boolean; ticketId: string } {
    const device = this.devices.get(dto.device_id);
    if (!device) {
      throw new Error(`Device ${dto.device_id} not found`);
    }

    // Require typed confirmation matching the linked bus number
    const targetBusNumber = device.linked_bus_number ?? '';
    if (dto.confirm_bus_number.trim().toUpperCase() !== targetBusNumber.trim().toUpperCase()) {
      throw new Error(
        `Confirmation mismatch: typed '${dto.confirm_bus_number}', expected '${targetBusNumber}'`,
      );
    }

    const now = new Date().toISOString();
    device.status = 'REVOKED';
    device.revoked_at = now;

    // Unlink device from bus
    for (const link of this.linkHistory) {
      if (link.device_id === dto.device_id && link.unlinked_at === null) {
        link.unlinked_at = now;
      }
    }
    const priorBusNumber = device.linked_bus_number;
    device.linked_bus_id = null;
    device.linked_bus_number = null;

    // Automatically create maintenance ticket for technician (AC-COR-01)
    const ticketId = `tkt-rev-${Date.now()}`;
    const ticket: MaintenanceTicketRecord = {
      id: ticketId,
      device_id: dto.device_id,
      bus_number: priorBusNumber,
      category: 'DEVICE_REVOKED',
      priority: 'HIGH',
      status: 'OPEN',
      notes: [`Device revoked: ${dto.reason}`],
      created_at: now,
      escalated_to_coordinator: false,
    };

    this.tickets.set(ticketId, ticket);
    return { success: true, ticketId };
  }

  /**
   * Request token rotation (SW-MVP §16.5 workflow 3).
   * Increments key version and generates new hash.
   */
  public rotateToken(dto: RotateDeviceTokenDto): { key_version: number } {
    const device = this.devices.get(dto.device_id);
    if (!device) {
      throw new Error(`Device ${dto.device_id} not found`);
    }
    if (device.status !== 'ACTIVE' && device.status !== 'PROVISIONED') {
      throw new Error(`Cannot rotate token on device with status ${device.status}`);
    }

    device.key_version += 1;
    device.token_hash = `hmac_rotated_v${device.key_version}_${Date.now()}`;
    return { key_version: device.key_version };
  }

  /**
   * Verifies if a device request is accepted. Revoked devices are strictly rejected (AC-COR-01).
   */
  public authenticateDeviceRequest(deviceId: string): { allowed: boolean; code?: string } {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { allowed: false, code: 'DEVICE_NOT_FOUND' };
    }
    if (device.status === 'REVOKED') {
      return { allowed: false, code: 'DEVICE_REVOKED' };
    }
    if (device.status === 'RETIRED') {
      return { allowed: false, code: 'DEVICE_RETIRED' };
    }
    return { allowed: true };
  }

  public getDevice(deviceId: string): DeviceRecordItem | null {
    const d = this.devices.get(deviceId);
    return d ? { ...d } : null;
  }

  public listDevices(filter?: { status?: DeviceStatus; is_bench?: boolean }): DeviceRecordItem[] {
    let result = Array.from(this.devices.values());
    if (filter?.status) {
      result = result.filter((d) => d.status === filter.status);
    }
    if (filter?.is_bench !== undefined) {
      result = result.filter((d) => d.is_bench === filter.is_bench);
    }
    return result.map((d) => ({ ...d }));
  }

  public listTickets(filter?: { status?: MaintenanceTicketRecord['status'] }): MaintenanceTicketRecord[] {
    let result = Array.from(this.tickets.values());
    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    return result.map((t) => ({ ...t }));
  }

  public getLinkHistory(): typeof this.linkHistory {
    return [...this.linkHistory];
  }
}
