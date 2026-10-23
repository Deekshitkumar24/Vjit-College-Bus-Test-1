import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

export interface LeaveRecord {
  id: string;
  student_id: string;
  service_date: string;
  trip_type: string;
  reason_category: string;
  cancelled_at?: Date | string | null;
}

export interface SubmitLeaveParams {
  studentId: string;
  serviceDate: string; // YYYY-MM-DD
  tripType: 'MORNING' | 'AFTERNOON';
  reasonCategory: 'PERSONAL' | 'ACADEMIC' | 'OTHER';
  requestTime?: Date;
  isFaculty?: boolean;
  getTrip: (
    serviceDate: string,
    tripType: string,
  ) => Promise<{ id: string; scheduled_departure: Date } | null>;
  saveLeave: (leave: {
    student_id: string;
    service_date: string;
    trip_type: string;
    reason_category: string;
    created_by: string;
  }) => Promise<LeaveRecord>;
  updateAttendanceStatus: (tripId: string, studentId: string, status: string) => Promise<void>;
}

export interface CancelLeaveParams {
  leaveId: string;
  studentId: string;
  cancelTime?: Date;
  isFaculty?: boolean;
  getLeave: (leaveId: string) => Promise<LeaveRecord | null>;
  getTrip: (
    serviceDate: string,
    tripType: string,
  ) => Promise<{ id: string; scheduled_departure: Date } | null>;
  getAttendanceRecord: (tripId: string, studentId: string) => Promise<{ status: string } | null>;
  updateLeave: (leaveId: string, cancelledAt: Date) => Promise<void>;
  updateAttendanceStatus: (tripId: string, studentId: string, status: string) => Promise<void>;
}

@Injectable()
export class LeaveService {
  /**
   * Submits a leave request for student or faculty.
   * Student cutoff: 30 minutes before scheduled departure (leave.cutoff_before_trip_min).
   * Faculty cutoff: before boarding cutoff (scheduled departure + 15 min).
   * Sets expected record to ON_LEAVE immediately.
   */
  async submitLeave(
    params: SubmitLeaveParams,
  ): Promise<{ success: boolean; status: string; leave_id?: string }> {
    const now = params.requestTime ?? new Date();

    const validCategories = new Set(['PERSONAL', 'ACADEMIC', 'OTHER']);
    if (!validCategories.has(params.reasonCategory)) {
      throw new BadRequestException(
        'Invalid leave reason category. Must be PERSONAL, ACADEMIC, or OTHER',
      );
    }

    const trip = await params.getTrip(params.serviceDate, params.tripType);
    if (!trip) {
      throw new NotFoundException(
        `No trip found for date ${params.serviceDate} and trip type ${params.tripType}`,
      );
    }

    const departureMs = new Date(trip.scheduled_departure).getTime();
    if (params.isFaculty) {
      // Faculty cutoff: boarding cutoff (departure + 15m)
      const cutoffMs = departureMs + 15 * 60 * 1000;
      if (now.getTime() > cutoffMs) {
        throw new BadRequestException(
          'LEAVE_CUTOFF_PASSED: Faculty leave must be submitted before boarding cutoff',
        );
      }
    } else {
      // Student cutoff: 30 minutes before departure
      const cutoffMs = departureMs - 30 * 60 * 1000;
      if (now.getTime() > cutoffMs) {
        throw new BadRequestException(
          'LEAVE_CUTOFF_PASSED: Student leave must be submitted at least 30 minutes before departure',
        );
      }
    }

    const saved = await params.saveLeave({
      student_id: params.studentId,
      service_date: params.serviceDate,
      trip_type: params.tripType,
      reason_category: params.reasonCategory,
      created_by: params.studentId,
    });

    await params.updateAttendanceStatus(trip.id, params.studentId, 'ON_LEAVE');

    return {
      success: true,
      status: 'ON_LEAVE',
      leave_id: saved?.id,
    };
  }

  /**
   * Cancels an existing leave request before cutoff.
   * Reverts record to EXPECTED only if no boarding has occurred.
   */
  async cancelLeave(params: CancelLeaveParams): Promise<{ success: boolean; status: string }> {
    const now = params.cancelTime ?? new Date();

    const leave = await params.getLeave(params.leaveId);
    if (!leave) {
      throw new NotFoundException('Leave record not found');
    }

    if (leave.cancelled_at) {
      throw new BadRequestException('Leave record is already cancelled');
    }

    const trip = await params.getTrip(leave.service_date, leave.trip_type);
    if (trip) {
      const departureMs = new Date(trip.scheduled_departure).getTime();
      const cutoffMs = params.isFaculty
        ? departureMs + 15 * 60 * 1000
        : departureMs - 30 * 60 * 1000;

      if (now.getTime() > cutoffMs) {
        throw new BadRequestException(
          'LEAVE_CUTOFF_PASSED: Cannot cancel leave after cutoff has passed',
        );
      }

      const attendance = await params.getAttendanceRecord(trip.id, params.studentId);
      if (attendance && (attendance.status === 'BOARDED' || attendance.status === 'LATE_BOARDED')) {
        throw new BadRequestException(
          'CANNOT_CANCEL_LEAVE: Boarding has already occurred for this trip',
        );
      }

      await params.updateAttendanceStatus(trip.id, params.studentId, 'EXPECTED');
    }

    await params.updateLeave(params.leaveId, now);

    return {
      success: true,
      status: 'EXPECTED',
    };
  }
}
