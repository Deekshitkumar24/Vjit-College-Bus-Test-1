import { describe, it, expect, beforeEach } from 'vitest';
import { LeaveService } from '../src/modules/attendance/leave.service.js';
import { AbsenceEvaluatorService } from '../src/modules/attendance/absence-evaluator.service.js';

describe('Leave Flows & Absence Alert Immunity (P5-T5, T-ATT-04)', () => {
  let leaveService: LeaveService;
  const serviceDate = '2026-10-22';
  const studentId = 'student-test-leave-100';
  const morningTripId = 'trip-morning-100';
  const afternoonTripId = 'trip-afternoon-100';

  beforeEach(() => {
    leaveService = new LeaveService();
  });

  it('allows student to mark leave before 30-minute cutoff and sets attendance to ON_LEAVE', async () => {
    const departureTime = new Date('2026-10-22T08:00:00+05:30');
    // Request at 07:15 (45 min before departure -> before 30m cutoff)
    const requestTime = new Date('2026-10-22T07:15:00+05:30');

    let savedLeave: any = null;
    let updatedAttendanceStatus = '';

    const res = await leaveService.submitLeave({
      studentId,
      serviceDate,
      tripType: 'MORNING',
      reasonCategory: 'ACADEMIC',
      requestTime,
      getTrip: async () => ({
        id: morningTripId,
        scheduled_departure: departureTime,
      }),
      saveLeave: async (leave) => {
        savedLeave = leave;
        return { id: 'leave-1', ...leave };
      },
      updateAttendanceStatus: async (tId, sId, status) => {
        updatedAttendanceStatus = status;
      },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('ON_LEAVE');
    expect(savedLeave.reason_category).toBe('ACADEMIC');
    expect(updatedAttendanceStatus).toBe('ON_LEAVE');
  });

  it('rejects student leave request when submitted less than 30 minutes before departure', async () => {
    const departureTime = new Date('2026-10-22T08:00:00+05:30');
    // Request at 07:40 (20 min before departure -> after 30m cutoff)
    const requestTime = new Date('2026-10-22T07:40:00+05:30');

    await expect(
      leaveService.submitLeave({
        studentId,
        serviceDate,
        tripType: 'MORNING',
        reasonCategory: 'PERSONAL',
        requestTime,
        getTrip: async () => ({
          id: morningTripId,
          scheduled_departure: departureTime,
        }),
        saveLeave: async () => ({}),
        updateAttendanceStatus: async () => {},
      }),
    ).rejects.toThrow('LEAVE_CUTOFF_PASSED');
  });

  it('cancels leave before cutoff and reverts attendance status to EXPECTED', async () => {
    const departureTime = new Date('2026-10-22T08:00:00+05:30');
    const cancelTime = new Date('2026-10-22T07:20:00+05:30'); // 40 min before departure

    let attendanceReverted = '';

    const res = await leaveService.cancelLeave({
      leaveId: 'leave-1',
      studentId,
      cancelTime,
      getLeave: async () => ({
        id: 'leave-1',
        student_id: studentId,
        service_date: serviceDate,
        trip_type: 'MORNING',
        cancelled_at: null,
      }),
      getTrip: async () => ({
        id: morningTripId,
        scheduled_departure: departureTime,
      }),
      getAttendanceRecord: async () => ({
        id: 'rec-1',
        status: 'ON_LEAVE',
      }),
      updateLeave: async () => {},
      updateAttendanceStatus: async (tId, sId, status) => {
        attendanceReverted = status;
      },
    });

    expect(res.success).toBe(true);
    expect(attendanceReverted).toBe('EXPECTED');
  });

  it('T-ATT-04: leave record prevents absence alert creation for afternoon trip', async () => {
    const evaluator = new AbsenceEvaluatorService();
    const afternoonDeparture = new Date('2026-10-22T16:30:00+05:30');
    const now = new Date('2026-10-22T16:50:00+05:30'); // After cutoff

    const alertsStore: any[] = [];

    // Candidate has morning BOARDED, but afternoon ON_LEAVE
    const candidates = [
      {
        student_id: studentId,
        service_date: serviceDate,
        morning_status: 'BOARDED',
        morning_trip_id: morningTripId,
        afternoon_status: 'ON_LEAVE', // Student marked approved leave
        afternoon_trip_id: afternoonTripId,
        bus_id: 'bus-100',
      },
    ];

    const alertsCreated = await evaluator.evaluateAbsences({
      now,
      serviceDate,
      afternoonDepartureTime: afternoonDeparture,
      getCandidates: async () => candidates,
      getExistingAlert: async () => null,
      saveAlert: async (alert) => {
        alertsStore.push(alert);
        return alert;
      },
      sendSafetyNotification: async () => {},
    });

    // Zero alerts created because leave prevents the alert
    expect(alertsCreated).toBe(0);
    expect(alertsStore).toHaveLength(0);
  });
});
