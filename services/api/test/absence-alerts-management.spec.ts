import { describe, it, expect, beforeEach } from 'vitest';
import { AbsenceAlertsService } from '../src/modules/attendance/absence-alerts.service.js';

describe('Absence Alerts Management & Late Boarding (P5-T6)', () => {
  let alertsService: AbsenceAlertsService;

  const sampleAlertId = 'alert-uuid-111';
  const sampleStudentId = 'student-uuid-222';
  const sampleAfternoonTripId = 'trip-afternoon-333';
  const sampleFacultyId = 'faculty-uuid-444';

  beforeEach(() => {
    alertsService = new AbsenceAlertsService();
  });

  it('allows faculty or coordinator to acknowledge an OPEN alert', async () => {
    const alertRecord = {
      id: sampleAlertId,
      student_id: sampleStudentId,
      status: 'OPEN',
      acknowledged_by: null as string | null,
    };

    const res = await alertsService.acknowledgeAlert({
      alertId: sampleAlertId,
      userId: sampleFacultyId,
      getAlert: async () => alertRecord,
      updateAlert: async (id, data) => {
        Object.assign(alertRecord, data);
      },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('ACKNOWLEDGED');
    expect(alertRecord.status).toBe('ACKNOWLEDGED');
    expect(alertRecord.acknowledged_by).toBe(sampleFacultyId);
  });

  it('adds investigation note (up to 500 chars) to an alert', async () => {
    const alertRecord = {
      id: sampleAlertId,
      note: null as string | null,
    };

    const noteText =
      'Spoke with parent at 17:15. Student was picked up by elder sister from gate 2.';

    const res = await alertsService.addNote({
      alertId: sampleAlertId,
      userId: sampleFacultyId,
      note: noteText,
      getAlert: async () => alertRecord,
      updateAlert: async (id, data) => {
        Object.assign(alertRecord, data);
      },
    });

    expect(res.success).toBe(true);
    expect(alertRecord.note).toBe(noteText);

    // Reject note exceeding 500 characters
    const longNote = 'a'.repeat(501);
    await expect(
      alertsService.addNote({
        alertId: sampleAlertId,
        userId: sampleFacultyId,
        note: longNote,
        getAlert: async () => alertRecord,
        updateAlert: async () => {},
      }),
    ).rejects.toThrow('Note exceeds maximum length of 500 characters');
  });

  it('reconciles late boarding: transitions OPEN alert to BOARDED_LATE when afternoon boarding occurs', async () => {
    const alertRecord = {
      id: sampleAlertId,
      student_id: sampleStudentId,
      afternoon_trip_id: sampleAfternoonTripId,
      status: 'OPEN',
    };

    let notificationSent = false;

    const res = await alertsService.reconcileLateBoarding({
      tripId: sampleAfternoonTripId,
      studentId: sampleStudentId,
      getOpenAlertForTrip: async (tId, sId) =>
        tId === alertRecord.afternoon_trip_id && sId === alertRecord.student_id
          ? alertRecord
          : null,
      updateAlertStatus: async (alertId, newStatus) => {
        alertRecord.status = newStatus;
      },
      notifyFaculty: async (alert) => {
        notificationSent = true;
      },
    });

    expect(res.reconciled).toBe(true);
    expect(res.status).toBe('BOARDED_LATE');
    expect(alertRecord.status).toBe('BOARDED_LATE');
    expect(notificationSent).toBe(true);
  });
});
