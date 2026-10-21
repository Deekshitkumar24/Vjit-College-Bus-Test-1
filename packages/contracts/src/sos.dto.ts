import { z } from 'zod';

export const SosCategorySchema = z.enum(['EMERGENCY', 'MEDICAL', 'BREAKDOWN', 'OTHER', 'UNKNOWN']);
export type SosCategory = z.infer<typeof SosCategorySchema>;

export const SosTriggerTypeSchema = z.enum([
  'STUDENT_APP',
  'FACULTY_APP',
  'DRIVER_APP',
  'HW_BUTTON',
  'SECURITY_APP',
]);
export type SosTriggerType = z.infer<typeof SosTriggerTypeSchema>;

export const SosIncidentStatusSchema = z.enum([
  'OPEN',
  'RESPONDING',
  'RESOLVED',
  'CANCELLED',
  'DRILL_CLOSED',
]);
export type SosIncidentStatus = z.infer<typeof SosIncidentStatusSchema>;

export const SosTriggerRequestDtoSchema = z.object({
  category: SosCategorySchema,
  trigger_type: SosTriggerTypeSchema,
  trip_id: z.string().uuid().optional(),
  bus_id: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy_m: z.number().positive().optional(),
  note: z.string().max(300).optional(),
  client_timestamp: z.string().datetime(),
});
export type SosTriggerRequestDto = z.infer<typeof SosTriggerRequestDtoSchema>;

export const SosTriggerResponseDtoSchema = z.object({
  incident_id: z.string().uuid(),
  status: SosIncidentStatusSchema,
  category: SosCategorySchema,
  dispatched_at: z.string().datetime(),
  security_phone: z.string(),
  message: z.string(),
});
export type SosTriggerResponseDto = z.infer<typeof SosTriggerResponseDtoSchema>;

export const SosCancelRequestDtoSchema = z.object({
  incident_id: z.string().uuid(),
  reason: z.string().min(5).max(300),
});
export type SosCancelRequestDto = z.infer<typeof SosCancelRequestDtoSchema>;
