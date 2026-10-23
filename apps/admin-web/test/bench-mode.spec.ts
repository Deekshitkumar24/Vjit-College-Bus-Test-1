import { describe, it, expect } from 'vitest';
import { BenchModeManager } from '../src/bench/bench-mode-manager';

describe('P4-T9: Bench Mode (Decision L-1, master Part 16, §16.5 workflow 7)', () => {
  it('transitions device to BENCH status and tracks bench diagnostic state', () => {
    const benchMgr = new BenchModeManager();

    benchMgr.registerDevice({
      id: 'dev-bench-01',
      imei: '860123456789012',
      serial_number: 'SN-BENCH-001',
      status: 'PROVISIONED',
      vehicle_class: 'V12',
    });

    // Technician sets device to BENCH
    const updated = benchMgr.setBenchMode('dev-bench-01', {
      technician_id: 'usr-tec-1',
      reason: 'Bench diagnostic and RF antenna calibration before fleet deployment',
    });

    expect(updated.status).toBe('BENCH');
    expect(updated.bench_notes).toContain('Bench diagnostic and RF antenna calibration');
  });

  it('strictly excludes BENCH devices from fleet views, alerts, reports, and purge checks (Decision L-1)', () => {
    const benchMgr = new BenchModeManager();

    benchMgr.registerDevice({
      id: 'dev-active-01',
      imei: '860123456789011',
      serial_number: 'SN-ACTIVE-001',
      status: 'ACTIVE',
      vehicle_class: 'V12',
    });

    benchMgr.registerDevice({
      id: 'dev-bench-02',
      imei: '860123456789012',
      serial_number: 'SN-BENCH-002',
      status: 'BENCH',
      vehicle_class: 'V12',
    });

    // 1. Fleet view exclusion
    expect(benchMgr.isDeviceInFleetView('dev-active-01')).toBe(true);
    expect(benchMgr.isDeviceInFleetView('dev-bench-02')).toBe(false);

    // 2. Alert suppression
    expect(benchMgr.canEmitPassengerAlert('dev-active-01')).toBe(true);
    expect(benchMgr.canEmitPassengerAlert('dev-bench-02')).toBe(false);

    // 3. Operational reports exclusion
    expect(benchMgr.isIncludedInReports('dev-active-01')).toBe(true);
    expect(benchMgr.isIncludedInReports('dev-bench-02')).toBe(false);

    // 4. Production purge check exclusion
    expect(benchMgr.isSubjectToProductionPurge('dev-active-01')).toBe(true);
    expect(benchMgr.isSubjectToProductionPurge('dev-bench-02')).toBe(false);
  });

  it('allows diagnostic telemetry capture without propagating to live channels', () => {
    const benchMgr = new BenchModeManager();

    benchMgr.registerDevice({
      id: 'dev-bench-03',
      imei: '860123456789013',
      serial_number: 'SN-BENCH-003',
      status: 'BENCH',
      vehicle_class: 'V12',
    });

    const result = benchMgr.recordBenchTelemetry('dev-bench-03', {
      battery_v: 12.4,
      gnss_fix: true,
      satellites: 9,
      firmware_version: 'v1.4.0',
    });

    expect(result.broadcastToLiveFleet).toBe(false);
    expect(result.diagnosticCaptured).toBe(true);

    const diagnostics = benchMgr.getBenchDiagnostics('dev-bench-03');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.battery_v).toBe(12.4);
  });

  it('transitions device from BENCH to ACTIVE upon successful bench commissioning', () => {
    const benchMgr = new BenchModeManager();

    benchMgr.registerDevice({
      id: 'dev-bench-04',
      imei: '860123456789014',
      serial_number: 'SN-BENCH-004',
      status: 'BENCH',
      vehicle_class: 'V12',
    });

    const commissioned = benchMgr.commissionFromBench('dev-bench-04', {
      technician_id: 'usr-tec-1',
      bus_id: 'bus-101',
    });

    expect(commissioned.status).toBe('ACTIVE');
    expect(benchMgr.isDeviceInFleetView('dev-bench-04')).toBe(true);
  });
});
