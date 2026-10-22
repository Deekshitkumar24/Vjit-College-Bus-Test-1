export interface TimetableDefinition {
  id: string;
  route_id: string;
  trip_type: 'MORNING' | 'AFTERNOON';
  departure_time: string; // HH:MM
  weekday_mask: number; // 1=Sun, 2=Mon, 4=Tue, 8=Wed, 16=Thu, 32=Fri, 64=Sat
  valid_from: Date;
  valid_to: Date | null;
}

export interface RouteBusAssignmentDefinition {
  id: string;
  route_id: string;
  bus_id: string;
  active_from: Date;
  active_until: Date | null;
}

export interface HolidayDefinition {
  holiday_date: string; // YYYY-MM-DD
  name: string;
}

export interface GeneratedTrip {
  route_id: string;
  bus_id: string;
  trip_type: 'MORNING' | 'AFTERNOON';
  service_date: string; // YYYY-MM-DD
  scheduled_departure: string; // ISO string with time
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface GenerateTripsParams {
  startDate: Date;
  daysAhead: number;
  timetables: TimetableDefinition[];
  assignments: RouteBusAssignmentDefinition[];
  holidays: HolidayDefinition[];
  existingTrips?: GeneratedTrip[];
}

export class TripGenerator {
  /**
   * Generates trips for a range of days starting from startDate.
   * Filters out holidays, checks timetable weekday masks, and joins with active bus assignments.
   */
  generateTrips(params: GenerateTripsParams): GeneratedTrip[] {
    const { startDate, daysAhead, timetables, assignments, holidays, existingTrips = [] } = params;
    const existingKeySet = new Set(
      existingTrips.map((t) => `${t.route_id}|${t.bus_id}|${t.service_date}|${t.trip_type}`)
    );
    const holidayDateSet = new Set(holidays.map((h) => h.holiday_date));
    const generated: GeneratedTrip[] = [];

    // Loop through daysAhead starting at startDate
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const current = new Date(startDate.getTime() + dayOffset * 86400000);
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      const serviceDate = `${year}-${month}-${day}`;

      // Skip holidays
      if (holidayDateSet.has(serviceDate)) {
        continue;
      }

      // Day of week mask: 0=Sun (1), 1=Mon (2), 2=Tue (4), etc.
      const dayOfWeek = current.getUTCDay();
      const maskBit = 1 << dayOfWeek;

      // Find applicable timetables
      for (const tt of timetables) {
        if ((tt.weekday_mask & maskBit) === 0) {
          continue;
        }

        // Check timetable validity
        if (tt.valid_from > current || (tt.valid_to && tt.valid_to < current)) {
          continue;
        }

        // Find active route bus assignment
        const assignment = assignments.find(
          (a) =>
            a.route_id === tt.route_id &&
            a.active_from <= current &&
            (!a.active_until || a.active_until >= current)
        );

        if (!assignment) {
          continue;
        }

        const tripKey = `${tt.route_id}|${assignment.bus_id}|${serviceDate}|${tt.trip_type}`;
        if (existingKeySet.has(tripKey)) {
          continue;
        }

        // Parse departure time HH:MM
        const [hours, minutes] = tt.departure_time.split(':').map((s) => parseInt(s, 10));
        // Construct scheduled departure ISO timestamp (IST +05:30 offset representation)
        const scheduledDeparture = `${serviceDate}T${String(hours).padStart(2, '0')}:${String(
          minutes
        ).padStart(2, '0')}:00+05:30`;

        generated.push({
          route_id: tt.route_id,
          bus_id: assignment.bus_id,
          trip_type: tt.trip_type,
          service_date: serviceDate,
          scheduled_departure: scheduledDeparture,
          status: 'SCHEDULED',
        });
        existingKeySet.add(tripKey);
      }
    }

    return generated;
  }
}

export interface StudentRouteAssignmentDefinition {
  student_id: string;
  route_id: string;
  trip_type: 'MORNING' | 'AFTERNOON';
  boarding_stop_id: string;
  valid_from: Date;
  valid_to: Date | null;
}

export interface LeaveDefinition {
  student_id: string;
  service_date: string; // YYYY-MM-DD
  trip_type: 'MORNING' | 'AFTERNOON';
  cancelled_at: Date | null;
}

export interface ExpectedPassengerRecord {
  trip_id: string;
  student_id: string;
  status: 'EXPECTED' | 'ON_LEAVE';
  boarding_stop_id: string;
}

export interface BuildExpectedRecordsParams {
  tripId: string;
  routeId: string;
  tripType: 'MORNING' | 'AFTERNOON';
  serviceDate: string; // YYYY-MM-DD
  studentAssignments: StudentRouteAssignmentDefinition[];
  leaves: LeaveDefinition[];
  existingStudentIds?: Set<string>;
}

export class ExpectedPassengerBuilder {
  /**
   * Builds the expected passenger manifest records for a specific trip.
   * Assigns EXPECTED or ON_LEAVE depending on whether an active, uncancelled leave exists.
   */
  buildExpectedRecords(params: BuildExpectedRecordsParams): ExpectedPassengerRecord[] {
    const {
      tripId,
      routeId,
      tripType,
      serviceDate,
      studentAssignments,
      leaves,
      existingStudentIds = new Set<string>(),
    } = params;

    const records: ExpectedPassengerRecord[] = [];
    const activeLeaves = new Set(
      leaves
        .filter((l) => l.service_date === serviceDate && l.trip_type === tripType && !l.cancelled_at)
        .map((l) => l.student_id)
    );

    for (const sa of studentAssignments) {
      if (sa.route_id !== routeId || sa.trip_type !== tripType) {
        continue;
      }
      if (existingStudentIds.has(sa.student_id)) {
        continue;
      }

      const status: 'EXPECTED' | 'ON_LEAVE' = activeLeaves.has(sa.student_id)
        ? 'ON_LEAVE'
        : 'EXPECTED';

      records.push({
        trip_id: tripId,
        student_id: sa.student_id,
        status,
        boarding_stop_id: sa.boarding_stop_id,
      });
      existingStudentIds.add(sa.student_id);
    }

    return records;
  }
}
