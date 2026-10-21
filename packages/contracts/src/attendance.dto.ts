import { z } from 'zod';

export const QrPayloadSchema = z.object({
  trip_id: z.string().uuid(),
  bus_id: z.string().uuid(),
  epoch: z.number().int().nonnegative(),
  nonce: z.string().min(8),
  signature: z.string().min(16),
});
export type QrPayload = z.infer<typeof QrPayloadSchema>;

export const AttendanceCheckInRequestDtoSchema = z.object({
  trip_id: z.string().uuid(),
  bus_id: z.string().uuid(),
  qr_payload: z.string().min(1),
  boarding_stop_id: z.string().uuid().optional(),
  client_timestamp: z.string().datetime(),
});
export type AttendanceCheckInRequestDto = z.infer<typeof AttendanceCheckInRequestDtoSchema>;

export const AttendanceCheckInResponseDtoSchema = z.object({
  success: z.boolean(),
  status: z.enum(['BOARDED', 'ALREADY_CHECKED_IN', 'EXPIRED_QR', 'INVALID_TRIP']),
  message: z.string(),
  boarded_at: z.string().datetime().nullable(),
  attendance_record_id: z.string().uuid().nullable(),
});
export type AttendanceCheckInResponseDto = z.infer<typeof AttendanceCheckInResponseDtoSchema>;

export const StudentAttendanceRecordDtoSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: z.enum(['EXPECTED', 'BOARDED', 'LATE_BOARDED', 'ABSENT', 'ON_LEAVE', 'MANUAL_CHECKIN']),
  boarded_at: z.string().datetime().nullable(),
  method: z.enum(['QR', 'DRIVER', 'RFID']).nullable(),
  boarding_stop_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});
export type StudentAttendanceRecordDto = z.infer<typeof StudentAttendanceRecordDtoSchema>;
