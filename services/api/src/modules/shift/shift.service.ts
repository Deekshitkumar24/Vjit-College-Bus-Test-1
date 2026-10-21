import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { validateShiftStart, DriverRosterEntry, ShiftRecord } from '@collegebus/domain';
import { StartShiftDto, ShiftClaimDto } from '@collegebus/contracts';

@Injectable()
export class ShiftService {
  private rosters: DriverRosterEntry[] = [];
  private shifts = new Map<string, ShiftRecord>();

  addRosterEntry(entry: DriverRosterEntry) {
    this.rosters.push(entry);
  }

  setRosterEntries(entries: DriverRosterEntry[]) {
    this.rosters = [...entries];
  }

  getRosterEntriesForDriver(driverId: string, now: Date = new Date()): DriverRosterEntry[] {
    return this.rosters.filter(
      (r) =>
        r.driver_id === driverId &&
        r.valid_from <= now &&
        (r.valid_to === null || r.valid_to >= now),
    );
  }

  isDriverRosteredForBus(driverId: string, busId: string, now: Date = new Date()): boolean {
    return this.rosters.some(
      (r) =>
        r.driver_id === driverId &&
        r.bus_id === busId &&
        r.valid_from <= now &&
        (r.valid_to === null || r.valid_to >= now),
    );
  }

  getShift(shiftId: string): ShiftRecord | undefined {
    return this.shifts.get(shiftId);
  }

  getActiveShiftForBus(busId: string): ShiftRecord | undefined {
    return Array.from(this.shifts.values()).find(
      (s) => s.bus_id === busId && s.status === 'ACTIVE',
    );
  }

  getActiveShiftForDriver(driverId: string): ShiftRecord | undefined {
    return Array.from(this.shifts.values()).find(
      (s) => s.driver_id === driverId && s.status === 'ACTIVE',
    );
  }

  private openSosBuses = new Set<string>();
  private busLastMovement = new Map<string, Date>();

  setBusOpenSos(busId: string, isOpen: boolean) {
    if (isOpen) {
      this.openSosBuses.add(busId);
    } else {
      this.openSosBuses.delete(busId);
    }
  }

  recordBusMovement(busId: string, now: Date = new Date()) {
    this.busLastMovement.set(busId, now);
  }

  clear() {
    this.rosters = [];
    this.shifts.clear();
    this.openSosBuses.clear();
    this.busLastMovement.clear();
  }

  /**
   * Starts a shift with mutual-exclusion and roster validation (Part 6.7).
   * Implements AC-DRV-04: mid-shift restart resumes the same shift without duplication.
   */
  async startShift(
    driverId: string,
    dto: StartShiftDto,
    now: Date = new Date(),
  ): Promise<ShiftClaimDto> {
    // AC-DRV-04: If driver already holds an active shift on this bus, resume it
    const currentActive = this.getActiveShiftForDriver(driverId);
    if (currentActive && currentActive.bus_id === dto.bus_id) {
      return {
        shift_id: currentActive.id,
        bus_id: currentActive.bus_id,
        driver_id: driverId,
        route_id: currentActive.route_id,
        trip_id: currentActive.trip_id,
        started_at: currentActive.started_at.toISOString(),
      };
    }

    const existingActiveShifts = Array.from(this.shifts.values()).filter(
      (s) => s.status === 'ACTIVE',
    );

    const validation = validateShiftStart(
      driverId,
      dto.bus_id,
      this.rosters,
      existingActiveShifts,
      now,
    );

    if (!validation.allowed) {
      if (
        validation.code === 'BUS_SHIFT_ALREADY_ACTIVE' ||
        validation.code === 'DRIVER_ALREADY_ON_SHIFT'
      ) {
        throw new ConflictException({
          code: validation.code,
          message: validation.reason,
        });
      }
      throw new BadRequestException({
        code: validation.code || 'SHIFT_START_FAILED',
        message: validation.reason,
      });
    }

    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const shift: ShiftRecord = {
      id: shiftId,
      driver_id: driverId,
      bus_id: dto.bus_id,
      route_id: dto.route_id,
      trip_id: tripId,
      status: 'ACTIVE',
      started_at: now,
      ended_at: null,
    };

    this.shifts.set(shiftId, shift);
    this.busLastMovement.set(dto.bus_id, now);

    return {
      shift_id: shiftId,
      bus_id: dto.bus_id,
      driver_id: driverId,
      route_id: dto.route_id,
      trip_id: tripId,
      started_at: now.toISOString(),
    };
  }

  /**
   * Returns active shift status including idle and timeout alerts (§15.3, §15.4).
   */
  getActiveShiftStatus(driverId: string, now: Date = new Date()) {
    const shift = this.getActiveShiftForDriver(driverId);
    if (!shift) {
      return {
        has_active_shift: false,
        shift: null,
      };
    }

    const elapsedMs = now.getTime() - shift.started_at.getTime();
    const fourteenHoursMs = 14 * 3600 * 1000;
    const thirteenAndHalfHoursMs = 13.5 * 3600 * 1000;

    // Automated 14-hour timeout (§15.4)
    if (elapsedMs >= fourteenHoursMs) {
      shift.status = 'COMPLETED';
      shift.ended_at = now;
      return {
        has_active_shift: false,
        shift: null,
        timeout_ended: true,
      };
    }

    // 20-minute idle prompt check (§15.4)
    const lastMovement = this.busLastMovement.get(shift.bus_id) ?? shift.started_at;
    const idleDurationMs = now.getTime() - lastMovement.getTime();
    const isIdleWarning = idleDurationMs >= 20 * 60 * 1000;

    // After 30 minutes idle (20m idle + 10m prompt without movement), auto-ends with AUTO_IDLE
    if (idleDurationMs >= 30 * 60 * 1000) {
      shift.status = 'COMPLETED';
      shift.ended_at = now;
      return {
        has_active_shift: false,
        shift: null,
        auto_idle_ended: true,
      };
    }

    return {
      has_active_shift: true,
      shift: {
        shift_id: shift.id,
        bus_id: shift.bus_id,
        driver_id: shift.driver_id,
        route_id: shift.route_id,
        trip_id: shift.trip_id,
        started_at: shift.started_at.toISOString(),
        idle_warning: isIdleWarning,
        timeout_warning: elapsedMs >= thirteenAndHalfHoursMs,
      },
    };
  }

  /**
   * Ends an active shift per SW-MVP-1.0 §15.4.
   * Blocks manual end when an SOS incident is open for the bus.
   */
  async endShift(
    driverId: string,
    shiftId: string,
    reason: 'MANUAL' | 'AUTO_IDLE' | 'TIMEOUT' | 'ADMIN' = 'MANUAL',
    now: Date = new Date(),
  ): Promise<ShiftRecord> {
    const shift = this.shifts.get(shiftId);
    if (!shift) {
      throw new NotFoundException({
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift not found',
      });
    }

    if (reason !== 'ADMIN' && shift.driver_id !== driverId) {
      throw new BadRequestException({
        code: 'SHIFT_NOT_OWNED',
        message: 'Driver does not own this shift',
      });
    }

    if (shift.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'SHIFT_ALREADY_ENDED',
        message: `Shift is already in status ${shift.status}`,
      });
    }

    // SW-MVP-1.0 §15.4: Driver cannot end a shift while an SOS incident is OPEN
    if (reason === 'MANUAL' && this.openSosBuses.has(shift.bus_id)) {
      throw new ConflictException({
        code: 'SOS_INCIDENT_OPEN',
        message:
          'Driver cannot end shift while an SOS incident is open for this bus. Only coordinator can end with a reason.',
      });
    }

    shift.status = 'COMPLETED';
    shift.ended_at = now;
    return shift;
  }
}
