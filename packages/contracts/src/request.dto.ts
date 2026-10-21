import { z } from 'zod';

export const StopChangeRequestTypeSchema = z.enum(['PERMANENT', 'TEMPORARY', 'EMERGENCY']);
export type StopChangeRequestType = z.infer<typeof StopChangeRequestTypeSchema>;

export const RequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const StopChangeSubmissionDtoSchema = z.object({
  target_stop_id: z.string().uuid(),
  request_type: StopChangeRequestTypeSchema,
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reason: z.string().min(5).max(500),
});
export type StopChangeSubmissionDto = z.infer<typeof StopChangeSubmissionDtoSchema>;

export const LeaveTripTypeSchema = z.enum(['MORNING', 'AFTERNOON', 'BOTH']);
export type LeaveTripType = z.infer<typeof LeaveTripTypeSchema>;

export const LeaveReasonCategorySchema = z.enum(['MEDICAL', 'ACADEMIC', 'PERSONAL', 'OTHER']);
export type LeaveReasonCategory = z.infer<typeof LeaveReasonCategorySchema>;

export const LeaveApplicationSubmissionDtoSchema = z.object({
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trip_type: LeaveTripTypeSchema,
  reason_category: LeaveReasonCategorySchema,
  note: z.string().max(500).optional(),
});
export type LeaveApplicationSubmissionDto = z.infer<typeof LeaveApplicationSubmissionDtoSchema>;

export const StudentRequestSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['STOP_CHANGE', 'LEAVE']),
  title: z.string(),
  status: RequestStatusSchema,
  status_label: z.string(),
  created_at: z.string().datetime(),
  effective_date: z.string(),
  reason_snippet: z.string(),
  can_cancel: z.boolean(),
});
export type StudentRequestSummaryDto = z.infer<typeof StudentRequestSummaryDtoSchema>;

export const StudentRequestListDtoSchema = z.array(StudentRequestSummaryDtoSchema);
export type StudentRequestListDto = z.infer<typeof StudentRequestListDtoSchema>;
