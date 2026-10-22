import { Injectable } from '@nestjs/common';

export interface BoardingCutoffParams {
  now?: Date;
  getActiveTripsWithPassedCutoff: (cutoffTime: Date) => Promise<Array<{ id: string; scheduled_departure: Date }>>;
  getPendingRecords: (tripId: string) => Promise<Array<{ id: string; status: string }>>;
  updateStatus: (recordId: string, newStatus: string) => Promise<void>;
}

@Injectable()
export class BoardingCutoffJob {
  /**
   * Evaluates all trips where departure + 15 minutes has passed.
   * Any student attendance record still in EXPECTED state is transitioned to ABSENT.
   */
  async processCutoff(params: BoardingCutoffParams): Promise<number> {
    const now = params.now ?? new Date();
    // Cutoff window is 15 minutes after scheduled departure
    const cutoffThreshold = new Date(now.getTime() - 15 * 60 * 1000);

    const trips = await params.getActiveTripsWithPassedCutoff(cutoffThreshold);
    let updatedCount = 0;

    for (const trip of trips) {
      const pendingRecords = await params.getPendingRecords(trip.id);
      for (const rec of pendingRecords) {
        if (rec.status === 'EXPECTED') {
          await params.updateStatus(rec.id, 'ABSENT');
          updatedCount++;
        }
      }
    }

    return updatedCount;
  }
}

export interface CandidateStudentAbsence {
  student_id: string;
  service_date: string;
  morning_status: string; // BOARDED, LATE_BOARDED, BOARDED_LATE, ABSENT, ON_LEAVE
  morning_trip_id: string;
  afternoon_status: string; // ABSENT, BOARDED, ON_LEAVE, EXPECTED
  afternoon_trip_id: string;
  bus_id: string;
}

export interface EvaluateAbsenceParams {
  now?: Date;
  serviceDate: string;
  afternoonDepartureTime: Date;
  getCandidates: (serviceDate: string) => Promise<CandidateStudentAbsence[]>;
  getExistingAlert: (studentId: string, serviceDate: string) => Promise<any>;
  saveAlert: (alert: {
    student_id: string;
    service_date: string;
    morning_trip_id: string;
    afternoon_trip_id: string;
    status: 'OPEN';
    alerted_at: Date;
  }) => Promise<any>;
  sendSafetyNotification: (notification: {
    recipient_role: string;
    category: string;
    title: string;
    body: string;
    student_id: string;
    bus_id: string;
    service_date: string;
  }) => Promise<void>;
}

@Injectable()
export class AbsenceEvaluatorService {
  /**
   * Morning-present, afternoon-absent rule (Part 11.3, Decision D-12)
   * Candidates: students with MORNING status BOARDED, LATE_BOARDED, or BOARDED_LATE,
   * and AFTERNOON status ABSENT on the same service date.
   * Trigger: afternoon cutoff passed (scheduled departure + 15 min).
   * Condition: afternoon is ABSENT. ON_LEAVE is NEVER alerted.
   */
  async evaluateAbsences(params: EvaluateAbsenceParams): Promise<number> {
    const now = params.now ?? new Date();

    // Trigger check: cutoff has passed (+15 min of afternoon departure)
    const cutoffTime = new Date(params.afternoonDepartureTime.getTime() + 15 * 60 * 1000);
    if (now < cutoffTime) {
      return 0;
    }

    const candidates = await params.getCandidates(params.serviceDate);
    let createdCount = 0;

    const morningBoardedStatuses = new Set(['BOARDED', 'LATE_BOARDED', 'BOARDED_LATE']);

    for (const c of candidates) {
      // Must be boarded in the morning
      if (!morningBoardedStatuses.has(c.morning_status)) {
        continue;
      }

      // Must be ABSENT in the afternoon (ON_LEAVE is never alerted)
      if (c.afternoon_status !== 'ABSENT') {
        continue;
      }

      // Conflict / Idempotency check: unique (student_id, service_date)
      const existing = await params.getExistingAlert(c.student_id, params.serviceDate);
      if (existing) {
        continue;
      }

      // Create OPEN absence alert
      await params.saveAlert({
        student_id: c.student_id,
        service_date: params.serviceDate,
        morning_trip_id: c.morning_trip_id,
        afternoon_trip_id: c.afternoon_trip_id,
        status: 'OPEN',
        alerted_at: now,
      });

      // Dispatch notifications to primary faculty, assigned faculty, and coordinators
      await params.sendSafetyNotification({
        recipient_role: 'FAC',
        category: 'SAFETY_ALERT',
        title: 'Safety Discrepancy Alert: Morning-Present / Afternoon-Absent',
        body: `Student was boarded on morning trip but is absent from afternoon bus. Please verify student safety.`,
        student_id: c.student_id,
        bus_id: c.bus_id,
        service_date: params.serviceDate,
      });

      await params.sendSafetyNotification({
        recipient_role: 'COR',
        category: 'SAFETY_ALERT',
        title: 'Safety Discrepancy Alert: Morning-Present / Afternoon-Absent',
        body: `Student was boarded on morning trip but is absent from afternoon bus.`,
        student_id: c.student_id,
        bus_id: c.bus_id,
        service_date: params.serviceDate,
      });

      createdCount++;
    }

    return createdCount;
  }
}
