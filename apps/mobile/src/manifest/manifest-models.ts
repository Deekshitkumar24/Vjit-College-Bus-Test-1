import { ManifestStudentItemDto, ManifestStudentStatus } from '@collegebus/contracts';

export type ManifestBadgeTone = 'GREEN' | 'BLUE' | 'GRAY' | 'RED' | 'AMBER';

export interface ManifestStudentRowViewModel {
  studentId: string;
  fullName: string;
  rollNumber: string;
  stopName: string;
  status: ManifestStudentStatus;
  statusLabel: string;
  badgeTone: ManifestBadgeTone;
  boardedTimeLabel: string;
  isBoarded: boolean;
  canManualToggle: boolean;
  guardianPhone: string | null;
  hasMorningDiscrepancy: boolean;
}

export function resolveManifestStatusBadge(status: ManifestStudentStatus): {
  tone: ManifestBadgeTone;
  label: string;
} {
  switch (status) {
    case 'BOARDED':
      return { tone: 'GREEN', label: 'Boarded' };
    case 'MANUAL_CHECKIN':
      return { tone: 'GREEN', label: 'Manual Check-in' };
    case 'LATE_BOARDED':
      return { tone: 'BLUE', label: 'Late Boarded' };
    case 'EXPECTED':
      return { tone: 'GRAY', label: 'Expected' };
    case 'ABSENT':
      return { tone: 'RED', label: 'Absent' };
    case 'ON_LEAVE':
      return { tone: 'AMBER', label: 'On Leave' };
  }
}

export function buildManifestRowViewModel(
  student: ManifestStudentItemDto,
  isAfternoonTrip: boolean = false,
): ManifestStudentRowViewModel {
  const badge = resolveManifestStatusBadge(student.status);
  const isBoarded =
    student.status === 'BOARDED' ||
    student.status === 'LATE_BOARDED' ||
    student.status === 'MANUAL_CHECKIN';

  const boardedTimeLabel = student.boarded_at
    ? new Date(student.boarded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const hasMorningDiscrepancy =
    isAfternoonTrip &&
    (student.morning_status === 'BOARDED' || student.morning_status === 'MANUAL_CHECKIN') &&
    (student.status === 'EXPECTED' || student.status === 'ABSENT');

  return {
    studentId: student.student_id,
    fullName: student.full_name,
    rollNumber: student.roll_number,
    stopName: student.stop_name,
    status: student.status,
    statusLabel: badge.label,
    badgeTone: hasMorningDiscrepancy ? 'RED' : badge.tone,
    boardedTimeLabel,
    isBoarded,
    canManualToggle: student.status !== 'ON_LEAVE',
    guardianPhone: student.guardian_phone,
    hasMorningDiscrepancy,
  };
}

export function filterManifestRows(
  rows: ManifestStudentRowViewModel[],
  filter: {
    query?: string;
    stopId?: string;
    statusFilter?: ManifestStudentStatus | 'ALL';
  },
): ManifestStudentRowViewModel[] {
  return rows.filter((row) => {
    if (filter.statusFilter && filter.statusFilter !== 'ALL') {
      if (row.status !== filter.statusFilter) return false;
    }

    if (filter.query && filter.query.trim().length > 0) {
      const q = filter.query.toLowerCase().trim();
      const matchName = row.fullName.toLowerCase().includes(q);
      const matchRoll = row.rollNumber.toLowerCase().includes(q);
      const matchStop = row.stopName.toLowerCase().includes(q);
      if (!matchName && !matchRoll && !matchStop) return false;
    }

    return true;
  });
}
