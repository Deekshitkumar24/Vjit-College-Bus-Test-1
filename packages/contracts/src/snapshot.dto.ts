import { z } from 'zod';

export const SnapshotQueryDtoSchema = z.object({
  route_id: z.string().min(1),
  stop_id: z.string().optional(),
});
export type SnapshotQueryDto = z.infer<typeof SnapshotQueryDtoSchema>;

export const BusSnapshotSchema = z.object({
  bus_id: z.string(),
  bus_number: z.string(),
  trip_id: z.string().nullable(),
  state: z.enum(['LIVE', 'STALE', 'UNAVAILABLE', 'NOT_RUNNING']),
  active_source: z.enum(['HW', 'PHONE', 'NONE']),
  source_label: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  speed_kmh: z.number().nullable(),
  heading_deg: z.number().nullable(),
  data_age_s: z.number().nullable(),
  eta_seconds: z.number().nullable(),
  eta_label: z.string().nullable(),
  updated_at: z.string(),
});
export type BusSnapshot = z.infer<typeof BusSnapshotSchema>;

export const SnapshotResponseDtoSchema = z.object({
  route_id: z.string(),
  route_version: z.number(),
  server_time: z.string(),
  buses: z.array(BusSnapshotSchema),
});
export type SnapshotResponseDto = z.infer<typeof SnapshotResponseDtoSchema>;
