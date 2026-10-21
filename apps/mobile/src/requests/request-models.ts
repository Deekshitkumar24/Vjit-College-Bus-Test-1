import {
  RequestStatus,
  StopChangeSubmissionDto,
  StopChangeSubmissionDtoSchema,
  LeaveApplicationSubmissionDto,
  LeaveApplicationSubmissionDtoSchema,
  StudentRequestSummaryDto,
} from '@collegebus/contracts';

export type RequestBadgeTone = 'AMBER' | 'GREEN' | 'GRAY' | 'RED';

export interface RequestBadgeViewModel {
  tone: RequestBadgeTone;
  label: string;
  isActionable: boolean;
}

export function resolveRequestBadge(status: RequestStatus): RequestBadgeViewModel {
  switch (status) {
    case 'PENDING':
      return {
        tone: 'AMBER',
        label: 'Under Review',
        isActionable: true,
      };
    case 'APPROVED':
      return {
        tone: 'GREEN',
        label: 'Approved',
        isActionable: false,
      };
    case 'REJECTED':
      return {
        tone: 'RED',
        label: 'Declined',
        isActionable: false,
      };
    case 'CANCELLED':
      return {
        tone: 'GRAY',
        label: 'Cancelled',
        isActionable: false,
      };
  }
}

export function validateStopChangeSubmission(data: unknown): {
  success: boolean;
  data?: StopChangeSubmissionDto;
  errors?: Record<string, string>;
} {
  const result = StopChangeSubmissionDtoSchema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'root';
      errors[field] = issue.message;
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

export function validateLeaveSubmission(data: unknown): {
  success: boolean;
  data?: LeaveApplicationSubmissionDto;
  errors?: Record<string, string>;
} {
  const result = LeaveApplicationSubmissionDtoSchema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'root';
      errors[field] = issue.message;
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

export function formatRequestItemForDisplay(request: StudentRequestSummaryDto): {
  id: string;
  title: string;
  badge: RequestBadgeViewModel;
  dateLabel: string;
  snippet: string;
  canCancel: boolean;
} {
  const badge = resolveRequestBadge(request.status);
  return {
    id: request.id,
    title: request.title,
    badge,
    dateLabel: `Effective: ${request.effective_date}`,
    snippet: request.reason_snippet,
    canCancel: request.can_cancel && request.status === 'PENDING',
  };
}
