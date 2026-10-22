import { Injectable } from '@nestjs/common';
import { ShiftService } from './shift.service.js';

export interface ShiftAutoEndTickResult {
  evaluatedShifts: number;
  warningsDispatched: number;
  shiftsTerminated: number;
  terminatedShifts: Array<{
    shiftId: string;
    busId: string;
    driverId: string;
    reason: 'AUTO_IDLE' | 'TIMEOUT';
  }>;
}

export interface DispatchedWarningRecord {
  shift_id: string;
  bus_id: string;
  driver_id: string;
  type: 'IDLE_WARNING';
  dispatched_at: Date;
}

export interface ShiftAutoEndAuditLogRecord {
  action: 'SHIFT_AUTO_END';
  reason: 'AUTO_IDLE' | 'TIMEOUT';
  shift_id: string;
  bus_id: string;
  driver_id: string;
  timestamp: Date;
}

@Injectable()
export class ShiftAutoEndJob {
  private dispatchedWarnings = new Map<string, DispatchedWarningRecord>();
  private auditLogs: ShiftAutoEndAuditLogRecord[] = [];

  constructor(private readonly shiftService: ShiftService) {}

  getDispatchedWarnings(): DispatchedWarningRecord[] {
    return Array.from(this.dispatchedWarnings.values());
  }

  getAuditLogs(): ShiftAutoEndAuditLogRecord[] {
    return this.auditLogs;
  }

  clear() {
    this.dispatchedWarnings.clear();
    this.auditLogs = [];
  }

  /**
   * Executes a periodic check across all active shifts (Part 12.3, Part 9.8, T-SHF-04).
   * - 20 minutes stationary: dispatches 10-minute warning prompt
   * - 30 minutes stationary: automatically ends shift with AUTO_IDLE
   * - 14 hours elapsed: automatically ends shift with TIMEOUT
   * - Logs audit trail for every auto-terminated shift
   */
  async executeTick(now: Date = new Date()): Promise<ShiftAutoEndTickResult> {
    const activeShifts = this.shiftService.getAllActiveShifts();
    let warningsDispatched = 0;
    let shiftsTerminated = 0;
    const terminatedShifts: ShiftAutoEndTickResult['terminatedShifts'] = [];

    const fourteenHoursMs = 14 * 3600 * 1000;
    const twentyMinsMs = 20 * 60 * 1000;
    const thirtyMinsMs = 30 * 60 * 1000;

    for (const shift of activeShifts) {
      const elapsedMs = now.getTime() - shift.started_at.getTime();

      // 1. Check 14-hour hard timeout (§15.4)
      if (elapsedMs >= fourteenHoursMs) {
        shift.status = 'COMPLETED';
        shift.ended_at = now;
        shiftsTerminated++;
        terminatedShifts.push({
          shiftId: shift.id,
          busId: shift.bus_id,
          driverId: shift.driver_id,
          reason: 'TIMEOUT',
        });

        this.auditLogs.push({
          action: 'SHIFT_AUTO_END',
          reason: 'TIMEOUT',
          shift_id: shift.id,
          bus_id: shift.bus_id,
          driver_id: shift.driver_id,
          timestamp: now,
        });

        this.dispatchedWarnings.delete(shift.id);
        continue;
      }

      // 2. Stationary / Idle checks (Part 9.8, SW-MVP §15.4)
      const lastMovement = this.shiftService.getBusLastMovement(shift.bus_id) ?? shift.started_at;
      const stationaryMs = now.getTime() - lastMovement.getTime();

      if (stationaryMs >= thirtyMinsMs) {
        // 30 minutes stationary (20m idle + 10m prompt) -> Terminate shift with AUTO_IDLE
        shift.status = 'COMPLETED';
        shift.ended_at = now;
        shiftsTerminated++;
        terminatedShifts.push({
          shiftId: shift.id,
          busId: shift.bus_id,
          driverId: shift.driver_id,
          reason: 'AUTO_IDLE',
        });

        this.auditLogs.push({
          action: 'SHIFT_AUTO_END',
          reason: 'AUTO_IDLE',
          shift_id: shift.id,
          bus_id: shift.bus_id,
          driver_id: shift.driver_id,
          timestamp: now,
        });

        this.dispatchedWarnings.delete(shift.id);
      } else if (stationaryMs >= twentyMinsMs) {
        // 20 minutes stationary -> Dispatch 10-minute warning if not already dispatched
        if (!this.dispatchedWarnings.has(shift.id)) {
          this.dispatchedWarnings.set(shift.id, {
            shift_id: shift.id,
            bus_id: shift.bus_id,
            driver_id: shift.driver_id,
            type: 'IDLE_WARNING',
            dispatched_at: now,
          });
          warningsDispatched++;
        }
      } else {
        // Vehicle moved -> clear pending warning if any
        if (this.dispatchedWarnings.has(shift.id)) {
          this.dispatchedWarnings.delete(shift.id);
        }
      }
    }

    return {
      evaluatedShifts: activeShifts.length,
      warningsDispatched,
      shiftsTerminated,
      terminatedShifts,
    };
  }
}
