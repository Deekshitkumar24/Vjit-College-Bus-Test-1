export type AttendanceTripStatus = 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'NOT_SCHEDULED';

export interface TripAttendanceSlot {
  status: AttendanceTripStatus;
  boardedAt: string | null;
  busNumber: string | null;
  stopName: string | null;
}

export interface DailyAttendanceRow {
  date: string; // YYYY-MM-DD
  morning: TripAttendanceSlot;
  afternoon: TripAttendanceSlot;
}

export interface AttendanceStats {
  totalDays: number;
  presentTrips: number;
  absentTrips: number;
  leaveTrips: number;
}

export class AttendanceHistoryManager {
  private rows: DailyAttendanceRow[];

  constructor(initialRows: DailyAttendanceRow[] = []) {
    this.rows = [...initialRows];
  }

  public setHistory(rows: DailyAttendanceRow[]): void {
    this.rows = [...rows];
  }

  public getHistory(): DailyAttendanceRow[] {
    return [...this.rows];
  }

  /**
   * Evaluates D-12: Morning-present, afternoon-absent rule (SW-MVP-1.0 §18.6).
   * Flags safety alerts where student was marked PRESENT on morning run but ABSENT on afternoon run.
   */
  public getMorningPresentAfternoonAbsentDiscrepancies(): DailyAttendanceRow[] {
    return this.rows.filter(
      (row) => row.morning.status === 'PRESENT' && row.afternoon.status === 'ABSENT',
    );
  }

  public getStats(): AttendanceStats {
    let presentTrips = 0;
    let absentTrips = 0;
    let leaveTrips = 0;

    for (const row of this.rows) {
      if (row.morning.status === 'PRESENT') presentTrips++;
      if (row.morning.status === 'ABSENT') absentTrips++;
      if (row.morning.status === 'ON_LEAVE') leaveTrips++;

      if (row.afternoon.status === 'PRESENT') presentTrips++;
      if (row.afternoon.status === 'ABSENT') absentTrips++;
      if (row.afternoon.status === 'ON_LEAVE') leaveTrips++;
    }

    return {
      totalDays: this.rows.length,
      presentTrips,
      absentTrips,
      leaveTrips,
    };
  }
}
