import { describe, it, expect } from 'vitest';
import {
  AbsenceEvaluatorService,
  BoardingCutoffJob,
} from '../src/modules/attendance/absence-evaluator.service.js';

describe('BoardingCutoffJob & AbsenceEvaluatorService (P5-T4, T-ATT-03)', () => {
  const serviceDate = '2026-10-22';
  const studentA = 'student-alpha-111';
  const studentB = 'student-beta-222';
  const studentC = 'student-gamma-333';
  const morningTripId = 'trip-morning-101';
  const afternoonTripId = 'trip-afternoon-102';

  it('BoardingCutoffJob: updates EXPECTED records to ABSENT after departure + 15 minutes', async () => {
    const job = new BoardingCutoffJob();
    const departureTime = new Date('2026-10-22T16:30:00+05:30');
    const now = new Date('2026-10-22T16:46:00+05:30'); // 16 minutes after departure (>15m)

    const attendanceRecords = [
      { id: 'rec-1', trip_id: afternoonTripId, student_id: studentA, status: 'EXPECTED' },
      { id: 'rec-2', trip_id: afternoonTripId, student_id: studentB, status: 'BOARDED' },
      { id: 'rec-3', trip_id: afternoonTripId, student_id: studentC, status: 'ON_LEAVE' },
    ];

    const updated = await job.processCutoff({
      now,
      getActiveTripsWithPassedCutoff: async () => [
        {
          id: afternoonTripId,
          scheduled_departure: departureTime,
        },
      ],
      getPendingRecords: async () => attendanceRecords.filter((r) => r.status === 'EXPECTED'),
      updateStatus: async (recId, newStatus) => {
        const item = attendanceRecords.find((r) => r.id === recId);
        if (item) item.status = newStatus;
      },
    });

    expect(updated).toBe(1);
    expect(attendanceRecords.find((r) => r.id === 'rec-1')?.status).toBe('ABSENT');
    expect(attendanceRecords.find((r) => r.id === 'rec-2')?.status).toBe('BOARDED');
    expect(attendanceRecords.find((r) => r.id === 'rec-3')?.status).toBe('ON_LEAVE');
  });

  it('T-ATT-03: morning boarded + afternoon absent creates an absence alert within 5m of cutoff', async () => {
    const evaluator = new AbsenceEvaluatorService();
    const departureTime = new Date('2026-10-22T16:30:00+05:30');
    const now = new Date('2026-10-22T16:46:00+05:30'); // 16 minutes after departure

    const alertsStore: any[] = [];
    const notificationsStore: any[] = [];

    // Student A: Morning BOARDED, Afternoon ABSENT
    // Student B: Morning ABSENT, Afternoon ABSENT
    // Student C: Morning BOARDED, Afternoon ON_LEAVE
    const mockData = [
      {
        student_id: studentA,
        service_date: serviceDate,
        morning_status: 'BOARDED',
        morning_trip_id: morningTripId,
        afternoon_status: 'ABSENT',
        afternoon_trip_id: afternoonTripId,
        bus_id: 'bus-101',
      },
      {
        student_id: studentB,
        service_date: serviceDate,
        morning_status: 'ABSENT',
        morning_trip_id: morningTripId,
        afternoon_status: 'ABSENT',
        afternoon_trip_id: afternoonTripId,
        bus_id: 'bus-101',
      },
      {
        student_id: studentC,
        service_date: serviceDate,
        morning_status: 'BOARDED',
        morning_trip_id: morningTripId,
        afternoon_status: 'ON_LEAVE',
        afternoon_trip_id: afternoonTripId,
        bus_id: 'bus-101',
      },
    ];

    const alertsCreated = await evaluator.evaluateAbsences({
      now,
      serviceDate,
      afternoonDepartureTime: departureTime,
      getCandidates: async () => mockData,
      getExistingAlert: async (studentId, date) =>
        alertsStore.find((a) => a.student_id === studentId && a.service_date === date),
      saveAlert: async (alert) => {
        alertsStore.push(alert);
        return alert;
      },
      sendSafetyNotification: async (notif) => {
        notificationsStore.push(notif);
      },
    });

    expect(alertsCreated).toBe(1);
    expect(alertsStore).toHaveLength(1);
    expect(alertsStore[0].student_id).toBe(studentA);
    expect(alertsStore[0].status).toBe('OPEN');
    expect(alertsStore[0].morning_trip_id).toBe(morningTripId);
    expect(alertsStore[0].afternoon_trip_id).toBe(afternoonTripId);

    // Verify notifications dispatched to faculty & coordinators
    expect(notificationsStore.length).toBeGreaterThanOrEqual(1);
    expect(notificationsStore[0].category).toBe('SAFETY_ALERT');
  });

  it('AbsenceEvaluator: repeated runs are idempotent and create zero duplicate alerts', async () => {
    const evaluator = new AbsenceEvaluatorService();
    const departureTime = new Date('2026-10-22T16:30:00+05:30');
    const now = new Date('2026-10-22T16:46:00+05:30');

    const alertsStore: any[] = [
      {
        id: 'alert-existing-1',
        student_id: studentA,
        service_date: serviceDate,
        status: 'OPEN',
      },
    ];

    const mockData = [
      {
        student_id: studentA,
        service_date: serviceDate,
        morning_status: 'BOARDED',
        morning_trip_id: morningTripId,
        afternoon_status: 'ABSENT',
        afternoon_trip_id: afternoonTripId,
        bus_id: 'bus-101',
      },
    ];

    const alertsCreated = await evaluator.evaluateAbsences({
      now,
      serviceDate,
      afternoonDepartureTime: departureTime,
      getCandidates: async () => mockData,
      getExistingAlert: async (studentId, date) =>
        alertsStore.find((a) => a.student_id === studentId && a.service_date === date),
      saveAlert: async (alert) => {
        alertsStore.push(alert);
        return alert;
      },
      sendSafetyNotification: async () => {},
    });

    expect(alertsCreated).toBe(0);
    expect(alertsStore).toHaveLength(1);
  });
});
