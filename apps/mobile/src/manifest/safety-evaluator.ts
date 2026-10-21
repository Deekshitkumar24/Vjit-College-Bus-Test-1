import { ManifestStudentItemDto, SafetyDiscrepancyAlertDto } from '@collegebus/contracts';

/**
 * Default D-12 Rule: Morning-present, afternoon-absent safety alert evaluator.
 * If a student boarded the inbound morning bus, but is absent/unboarded on the afternoon return trip,
 * an automated escalation discrepancy alert is raised immediately upon bus departure.
 */
export function evaluateMorningPresentAfternoonAbsentDiscrepancies(params: {
  tripId: string;
  tripType: 'MORNING' | 'AFTERNOON' | 'SPECIAL';
  students: ManifestStudentItemDto[];
  isDepartedOrPastDepartureTime: boolean;
}): SafetyDiscrepancyAlertDto[] {
  // Only afternoon return trips are subject to D-12 morning-present/afternoon-absent check
  if (params.tripType !== 'AFTERNOON') {
    return [];
  }

  const discrepancies: SafetyDiscrepancyAlertDto[] = [];

  for (const student of params.students) {
    const boardedMorning =
      student.morning_status === 'BOARDED' || student.morning_status === 'MANUAL_CHECKIN';

    const unboardedAfternoon = student.status === 'EXPECTED' || student.status === 'ABSENT';

    if (boardedMorning && unboardedAfternoon) {
      const alertLevel = params.isDepartedOrPastDepartureTime ? 'CRITICAL' : 'HIGH';
      const message = params.isDepartedOrPastDepartureTime
        ? `SAFETY ALERT (D-12): ${student.full_name} (${student.roll_number}) boarded morning bus but is MISSING from departing afternoon return trip.`
        : `ATTENTION (D-12): ${student.full_name} (${student.roll_number}) boarded morning bus and has not yet checked in for afternoon return trip.`;

      discrepancies.push({
        student_id: student.student_id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        trip_id: params.tripId,
        stop_name: student.stop_name,
        morning_boarded_at: student.boarded_at,
        alert_level: alertLevel,
        message,
      });
    }
  }

  return discrepancies;
}
