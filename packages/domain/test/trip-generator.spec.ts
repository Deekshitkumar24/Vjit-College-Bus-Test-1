import { describe, it, expect } from 'vitest';
import {
  TripGenerator,
  ExpectedPassengerBuilder,
  type TimetableDefinition,
  type RouteBusAssignmentDefinition,
  type HolidayDefinition,
  type StudentRouteAssignmentDefinition,
  type LeaveDefinition,
} from '../src/trip-generator.js';

describe('TripGenerator (P5-T1)', () => {
  const sampleRouteId = 'route-1111-1111';
  const sampleBusId = 'bus-2222-2222';

  const timetables: TimetableDefinition[] = [
    {
      id: 'tt-morning-1',
      route_id: sampleRouteId,
      trip_type: 'MORNING',
      departure_time: '07:30',
      weekday_mask: 0b0111110, // Mon-Fri (1=Sun, 2=Mon, 4=Tue, 8=Wed, 16=Thu, 32=Fri, 64=Sat)
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: null,
    },
    {
      id: 'tt-afternoon-1',
      route_id: sampleRouteId,
      trip_type: 'AFTERNOON',
      departure_time: '16:30',
      weekday_mask: 0b0111110, // Mon-Fri
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: null,
    },
  ];

  const assignments: RouteBusAssignmentDefinition[] = [
    {
      id: 'assign-1',
      route_id: sampleRouteId,
      bus_id: sampleBusId,
      active_from: new Date('2026-10-01T00:00:00Z'),
      active_until: null,
    },
  ];

  const holidays: HolidayDefinition[] = [
    {
      holiday_date: '2026-10-23', // Friday
      name: 'Diwali Holiday',
    },
  ];

  it('generates trips for the next 7 days, correctly applying weekday mask and skipping holidays', () => {
    const generator = new TripGenerator();
    // Starting on Thursday 2026-10-22
    const startDate = new Date('2026-10-22T00:00:00Z');
    const trips = generator.generateTrips({
      startDate,
      daysAhead: 7,
      timetables,
      assignments,
      holidays,
    });

    // Dates in 7 days:
    // 2026-10-22 Thu (Mon-Fri) -> Morning + Afternoon = 2 trips
    // 2026-10-23 Fri -> HOLIDAY -> 0 trips
    // 2026-10-24 Sat -> Weekend -> 0 trips
    // 2026-10-25 Sun -> Weekend -> 0 trips
    // 2026-10-26 Mon -> Morning + Afternoon = 2 trips
    // 2026-10-27 Tue -> Morning + Afternoon = 2 trips
    // 2026-10-28 Wed -> Morning + Afternoon = 2 trips
    // Total expected = 8 trips

    expect(trips.length).toBe(8);

    // Verify holiday date 2026-10-23 has 0 trips
    const holidayTrips = trips.filter((t) => t.service_date === '2026-10-23');
    expect(holidayTrips).toHaveLength(0);

    // Verify Thursday 2026-10-22 has 2 trips with correct scheduled departures
    const thuTrips = trips.filter((t) => t.service_date === '2026-10-22');
    expect(thuTrips).toHaveLength(2);

    const morningTrip = thuTrips.find((t) => t.trip_type === 'MORNING');
    expect(morningTrip).toBeDefined();
    expect(morningTrip?.bus_id).toBe(sampleBusId);
    expect(morningTrip?.route_id).toBe(sampleRouteId);
    expect(morningTrip?.status).toBe('SCHEDULED');
    expect(morningTrip?.scheduled_departure).toContain('07:30');
  });

  it('is idempotent and skips duplicate generation if trip keys match', () => {
    const generator = new TripGenerator();
    const startDate = new Date('2026-10-22T00:00:00Z');
    const run1 = generator.generateTrips({
      startDate,
      daysAhead: 3,
      timetables,
      assignments,
      holidays,
    });

    const run2 = generator.generateTrips({
      startDate,
      daysAhead: 3,
      timetables,
      assignments,
      holidays,
      existingTrips: run1,
    });

    // Should return only newly created trips (0)
    expect(run2.length).toBe(0);
  });
});

describe('ExpectedPassengerBuilder (P5-T1)', () => {
  const sampleTripId = 'trip-3333-3333';
  const sampleRouteId = 'route-1111-1111';
  const stop1 = 'stop-111';
  const stop2 = 'stop-222';

  const studentAssignments: StudentRouteAssignmentDefinition[] = [
    {
      student_id: 'student-A',
      route_id: sampleRouteId,
      trip_type: 'MORNING',
      boarding_stop_id: stop1,
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: null,
    },
    {
      student_id: 'student-B',
      route_id: sampleRouteId,
      trip_type: 'MORNING',
      boarding_stop_id: stop2,
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: null,
    },
    {
      student_id: 'student-C',
      route_id: sampleRouteId,
      trip_type: 'AFTERNOON', // Not assigned to morning
      boarding_stop_id: stop1,
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: null,
    },
  ];

  const leaves: LeaveDefinition[] = [
    {
      student_id: 'student-B',
      service_date: '2026-10-22',
      trip_type: 'MORNING',
      cancelled_at: null,
    },
  ];

  it('builds expected records for assigned route students, marking approved leaves as ON_LEAVE', () => {
    const builder = new ExpectedPassengerBuilder();
    const records = builder.buildExpectedRecords({
      tripId: sampleTripId,
      routeId: sampleRouteId,
      tripType: 'MORNING',
      serviceDate: '2026-10-22',
      studentAssignments,
      leaves,
    });

    // Student A -> EXPECTED
    // Student B -> ON_LEAVE (has uncancelled leave for this date & trip type)
    // Student C -> Not in morning trip
    expect(records).toHaveLength(2);

    const recA = records.find((r) => r.student_id === 'student-A');
    expect(recA).toBeDefined();
    expect(recA?.status).toBe('EXPECTED');
    expect(recA?.boarding_stop_id).toBe(stop1);

    const recB = records.find((r) => r.student_id === 'student-B');
    expect(recB).toBeDefined();
    expect(recB?.status).toBe('ON_LEAVE');
    expect(recB?.boarding_stop_id).toBe(stop2);
  });

  it('ignores cancelled leaves and marks student as EXPECTED', () => {
    const builder = new ExpectedPassengerBuilder();
    const cancelledLeaves: LeaveDefinition[] = [
      {
        student_id: 'student-B',
        service_date: '2026-10-22',
        trip_type: 'MORNING',
        cancelled_at: new Date('2026-10-21T18:00:00Z'), // Cancelled
      },
    ];

    const records = builder.buildExpectedRecords({
      tripId: sampleTripId,
      routeId: sampleRouteId,
      tripType: 'MORNING',
      serviceDate: '2026-10-22',
      studentAssignments,
      leaves: cancelledLeaves,
    });

    const recB = records.find((r) => r.student_id === 'student-B');
    expect(recB?.status).toBe('EXPECTED');
  });
});
