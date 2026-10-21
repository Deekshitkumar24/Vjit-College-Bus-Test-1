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

  clear() {
    this.rosters = [];
    this.shifts.clear();
  }

  /**
   * Starts a shift with mutual-exclusion and roster validation (Part 6.7).
   */
  async startShift(
    driverId: string,
    dto: StartShiftDto,
    now: Date = new Date(),
  ): Promise<ShiftClaimDto> {
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
   * Ends an active shift.
   */
  async endShift(driverId: string, shiftId: string, now: Date = new Date()): Promise<ShiftRecord> {
    const shift = this.shifts.get(shiftId);
    if (!shift) {
      throw new NotFoundException({
        code: 'SHIFT_NOT_FOUND',
        message: 'Shift not found',
      });
    }

    if (shift.driver_id !== driverId) {
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

    shift.status = 'COMPLETED';
    shift.ended_at = now;
    return shift;
  }
}
