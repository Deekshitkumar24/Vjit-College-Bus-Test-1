export type DeviceLifecycleStatus =
  | 'PROVISIONED'
  | 'ACTIVE'
  | 'BENCH'
  | 'REVOKED'
  | 'RETIRED';

export interface DeviceRecord {
  id: string;
  imei: string;
  serial_number: string;
  status: DeviceLifecycleStatus;
  vehicle_class: 'V12' | 'V24';
  bench_notes?: string;
  bench_set_at?: string;
  bus_id?: string;
}

export interface BenchDiagnosticTelemetry {
  battery_v: number;
  gnss_fix: boolean;
  satellites: number;
  firmware_version: string;
  recorded_at?: string;
}

export class BenchModeManager {
  private devices: Map<string, DeviceRecord> = new Map();
  private diagnostics: Map<string, BenchDiagnosticTelemetry[]> = new Map();

  registerDevice(device: DeviceRecord): void {
    this.devices.set(device.id, { ...device });
  }

  setBenchMode(
    deviceId: string,
    params: { technician_id: string; reason: string },
  ): DeviceRecord {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    device.status = 'BENCH';
    device.bench_notes = params.reason;
    device.bench_set_at = new Date().toISOString();
    device.bus_id = undefined;

    this.devices.set(deviceId, device);
    return device;
  }

  isDeviceInFleetView(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    // BENCH devices are strictly excluded from live fleet views (Decision L-1)
    return device.status === 'ACTIVE';
  }

  canEmitPassengerAlert(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    // BENCH devices never trigger student, faculty, or parent alerts
    return device.status === 'ACTIVE';
  }

  isIncludedInReports(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    // BENCH devices are excluded from operational bus reports
    return device.status === 'ACTIVE';
  }

  isSubjectToProductionPurge(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    // BENCH data is handled in laboratory diagnostics, not subject to production purge rules
    return device.status !== 'BENCH';
  }

  recordBenchTelemetry(
    deviceId: string,
    telemetry: BenchDiagnosticTelemetry,
  ): { broadcastToLiveFleet: boolean; diagnosticCaptured: boolean } {
    const device = this.devices.get(deviceId);
    if (!device || device.status !== 'BENCH') {
      throw new Error(`Device ${deviceId} is not in BENCH mode`);
    }

    const list = this.diagnostics.get(deviceId) ?? [];
    list.push({
      ...telemetry,
      recorded_at: telemetry.recorded_at ?? new Date().toISOString(),
    });
    this.diagnostics.set(deviceId, list);

    return {
      broadcastToLiveFleet: false,
      diagnosticCaptured: true,
    };
  }

  getBenchDiagnostics(deviceId: string): BenchDiagnosticTelemetry[] {
    return this.diagnostics.get(deviceId) ?? [];
  }

  commissionFromBench(
    deviceId: string,
    params: { technician_id: string; bus_id: string },
  ): DeviceRecord {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    device.status = 'ACTIVE';
    device.bus_id = params.bus_id;
    this.devices.set(deviceId, device);

    return device;
  }
}
