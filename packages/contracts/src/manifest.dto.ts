import { z } from 'zod';

export const ManifestStudentStatusSchema = z.enum([
  'EXPECTED',
  'BOARDED',
  'LATE_BOARDED',
  'ABSENT',
  'ON_LEAVE',
  'MANUAL_CHECKIN',
]);
export type ManifestStudentStatus = z.infer<typeof ManifestStudentStatusSchema>;

export const ManifestStudentItemDtoSchema = z.object({
  student_id: z.string().uuid(),
  full_name: z.string().min(1),
  roll_number: z.string().min(1),
  stop_id: z.string().uuid(),
  stop_name: z.string().min(1),
  status: ManifestStudentStatusSchema,
  boarded_at: z.string().datetime().nullable(),
  method: z.enum(['QR', 'DRIVER', 'RFID', 'MANUAL']).nullable(),
  morning_status: ManifestStudentStatusSchema.nullable(),
  guardian_phone: z.string().nullable(),
});
export type ManifestStudentItemDto = z.infer<typeof ManifestStudentItemDtoSchema>;

export const SafetyDiscrepancyAlertDtoSchema = z.object({
  student_id: z.string().uuid(),
  full_name: z.string(),
  roll_number: z.string(),
  trip_id: z.string().uuid(),
  stop_name: z.string(),
  morning_boarded_at: z.string().datetime().nullable(),
  alert_level: z.enum(['HIGH', 'CRITICAL']),
  message: z.string(),
});
export type SafetyDiscrepancyAlertDto = z.infer<typeof SafetyDiscrepancyAlertDtoSchema>;

export const TripManifestResponseDtoSchema = z.object({
  trip_id: z.string().uuid(),
  route_id: z.string().uuid(),
  route_name: z.string(),
  trip_type: z.enum(['MORNING', 'AFTERNOON', 'SPECIAL']),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_students: z.number().int().nonnegative(),
  boarded_count: z.number().int().nonnegative(),
  expected_count: z.number().int().nonnegative(),
  absent_count: z.number().int().nonnegative(),
  on_leave_count: z.number().int().nonnegative(),
  students: z.array(ManifestStudentItemDtoSchema),
  safety_discrepancies: z.array(SafetyDiscrepancyAlertDtoSchema),
});
export type TripManifestResponseDto = z.infer<typeof TripManifestResponseDtoSchema>;

export const ManualAttendanceToggleRequestDtoSchema = z.object({
  trip_id: z.string().uuid(),
  student_id: z.string().uuid(),
  target_status: z.enum(['BOARDED', 'EXPECTED', 'ABSENT']),
  stop_id: z.string().uuid().optional(),
});
export type ManualAttendanceToggleRequestDto = z.infer<
  typeof ManualAttendanceToggleRequestDtoSchema
>;
