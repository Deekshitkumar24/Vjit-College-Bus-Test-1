import { describe, it, expect, beforeEach } from 'vitest';
import { ShiftService } from '../src/modules/shift/shift.service.js';
import { ShiftAutoEndJob } from '../src/modules/shift/shift-auto-end.job.js';

describe('Shift Auto-End Background Worker (P3-T18, Part 12.3, Part 9.8, T-SHF-04)', () => {
  let shiftService: ShiftService;
  let autoEndJob: ShiftAutoEndJob;

  beforeEach(() => {
    shiftService = new ShiftService();
    autoEndJob = new ShiftAutoEndJob(shiftService);

    shiftService.addRosterEntry({
      id: 'roster_auto_1',
      driver_id: 'drv_auto_1',
      bus_id: 'bus_auto_1',
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: new Date('2026-11-01T00:00:00Z'),
    });
    shiftService.addRosterEntry({
      id: 'roster_auto_2',
      driver_id: 'drv_auto_2',
      bus_id: 'bus_auto_2',
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: new Date('2026-11-01T00:00:00Z'),
    });
  });

  it('keeps shift ACTIVE when vehicle movement occurred recently (< 20 mins)', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_auto_1',
      { bus_id: 'bus_auto_1', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    // Record movement 5 minutes into the shift
    const movementTime = new Date('2026-10-22T08:05:00Z');
    shiftService.recordBusMovement('bus_auto_1', movementTime);

    // Run tick 15 minutes after last movement (total 20 min from start, but 15m from movement)
    const tickTime = new Date('2026-10-22T08:20:00Z');
    const res = await autoEndJob.executeTick(tickTime);

    expect(res.evaluatedShifts).toBe(1);
    expect(res.warningsDispatched).toBe(0);
    expect(res.shiftsTerminated).toBe(0);

    const shift = shiftService.getShift(claim.shift_id)!;
    expect(shift.status).toBe('ACTIVE');
  });

  it('dispatches 10-minute warning when stationary for 20 minutes (Part 9.8)', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_auto_1',
      { bus_id: 'bus_auto_1', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    // 21 minutes stationary without movement
    const tickTime = new Date('2026-10-22T08:21:00Z');
    const res = await autoEndJob.executeTick(tickTime);

    expect(res.evaluatedShifts).toBe(1);
    expect(res.warningsDispatched).toBe(1);
    expect(res.shiftsTerminated).toBe(0);

    // Warning notification created
    const warnings = autoEndJob.getDispatchedWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.shift_id).toBe(claim.shift_id);
    expect(warnings[0]!.type).toBe('IDLE_WARNING');

    // Shift remains ACTIVE during the 10-minute prompt window
    const shift = shiftService.getShift(claim.shift_id)!;
    expect(shift.status).toBe('ACTIVE');

    // Subsequent tick before 30 mins does not re-dispatch duplicate warning
    const nextTick = new Date('2026-10-22T08:25:00Z');
    const res2 = await autoEndJob.executeTick(nextTick);
    expect(res2.warningsDispatched).toBe(0);
  });

  it('automatically terminates shift after 30 minutes stationary and writes audit log (T-SHF-04)', async () => {
    const baseTime = new Date('2026-10-22T08:00:00Z');
    const claim = await shiftService.startShift(
      'drv_auto_1',
      { bus_id: 'bus_auto_1', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    // 31 minutes stationary (20m stationary + 10m unacknowledged warning)
    const tickTime = new Date('2026-10-22T08:31:00Z');
    const res = await autoEndJob.executeTick(tickTime);

    expect(res.shiftsTerminated).toBe(1);
    expect(res.terminatedShifts[0]!.shiftId).toBe(claim.shift_id);
    expect(res.terminatedShifts[0]!.reason).toBe('AUTO_IDLE');

    // Shift is now COMPLETED
    const shift = shiftService.getShift(claim.shift_id)!;
    expect(shift.status).toBe('COMPLETED');
    expect(shift.ended_at).toEqual(tickTime);

    // Audit log entry written
    const auditLogs = autoEndJob.getAuditLogs();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]!.action).toBe('SHIFT_AUTO_END');
    expect(auditLogs[0]!.reason).toBe('AUTO_IDLE');
    expect(auditLogs[0]!.shift_id).toBe(claim.shift_id);
    expect(auditLogs[0]!.bus_id).toBe('bus_auto_1');
    expect(auditLogs[0]!.driver_id).toBe('drv_auto_1');
  });

  it('automatically terminates shift reaching 14-hour hard timeout (Part 15.4, T-SHF-04)', async () => {
    const baseTime = new Date('2026-10-22T05:00:00Z');
    const claim = await shiftService.startShift(
      'drv_auto_2',
      { bus_id: 'bus_auto_2', route_id: 'route_1', trip_type: 'MORNING' },
      baseTime,
    );

    // 14 hours and 2 minutes later
    const tickTime = new Date('2026-10-22T19:02:00Z');
    const res = await autoEndJob.executeTick(tickTime);

    expect(res.shiftsTerminated).toBe(1);
    expect(res.terminatedShifts[0]!.reason).toBe('TIMEOUT');

    const shift = shiftService.getShift(claim.shift_id)!;
    expect(shift.status).toBe('COMPLETED');

    const auditLogs = autoEndJob.getAuditLogs();
    const timeoutLog = auditLogs.find((l) => l.reason === 'TIMEOUT')!;
    expect(timeoutLog).toBeDefined();
    expect(timeoutLog.action).toBe('SHIFT_AUTO_END');
    expect(timeoutLog.shift_id).toBe(claim.shift_id);
  });
});
