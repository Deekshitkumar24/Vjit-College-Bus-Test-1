import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

export interface AcknowledgeAlertParams {
  alertId: string;
  userId: string;
  getAlert: (id: string) => Promise<Record<string, unknown> | null>;
  updateAlert: (id: string, data: { status: string; acknowledged_by: string }) => Promise<void>;
}

export interface AddNoteParams {
  alertId: string;
  userId: string;
  note: string;
  getAlert: (id: string) => Promise<Record<string, unknown> | null>;
  updateAlert: (id: string, data: { note: string }) => Promise<void>;
}

export interface ReconcileLateBoardingParams {
  tripId: string;
  studentId: string;
  getOpenAlertForTrip: (
    tripId: string,
    studentId: string,
  ) => Promise<{ id: string; status: string } | null>;
  updateAlertStatus: (alertId: string, newStatus: string) => Promise<void>;
  notifyFaculty: (alert: { id: string; status: string }) => Promise<void>;
}

@Injectable()
export class AbsenceAlertsService {
  /**
   * Acknowledges an OPEN absence alert by faculty or coordinator.
   */
  async acknowledgeAlert(
    params: AcknowledgeAlertParams,
  ): Promise<{ success: boolean; status: string }> {
    const alert = await params.getAlert(params.alertId);
    if (!alert) {
      throw new NotFoundException('Absence alert not found');
    }

    await params.updateAlert(params.alertId, {
      status: 'ACKNOWLEDGED',
      acknowledged_by: params.userId,
    });

    return {
      success: true,
      status: 'ACKNOWLEDGED',
    };
  }

  /**
   * Adds an investigation note to an absence alert.
   * Note must not exceed 500 characters.
   */
  async addNote(params: AddNoteParams): Promise<{ success: boolean }> {
    if (!params.note || params.note.length > 500) {
      throw new BadRequestException('Note exceeds maximum length of 500 characters');
    }

    const alert = await params.getAlert(params.alertId);
    if (!alert) {
      throw new NotFoundException('Absence alert not found');
    }

    await params.updateAlert(params.alertId, {
      note: params.note,
    });

    return { success: true };
  }

  /**
   * Reconciles late boarding:
   * When a BOARDED record is created for an afternoon trip that has an OPEN alert,
   * set the alert to BOARDED_LATE and notify the faculty (Part 11.3).
   */
  async reconcileLateBoarding(
    params: ReconcileLateBoardingParams,
  ): Promise<{ reconciled: boolean; status?: string }> {
    const openAlert = await params.getOpenAlertForTrip(params.tripId, params.studentId);
    if (!openAlert || openAlert.status !== 'OPEN') {
      return { reconciled: false };
    }

    await params.updateAlertStatus(openAlert.id, 'BOARDED_LATE');
    await params.notifyFaculty(openAlert);

    return {
      reconciled: true,
      status: 'BOARDED_LATE',
    };
  }
}
