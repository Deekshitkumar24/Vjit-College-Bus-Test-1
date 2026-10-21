import { z } from 'zod';

export const LocationSampleSchema = z
  .object({
    seq: z.number().int().nonnegative(),
    recorded_at: z.string().datetime(),
    gps_valid: z.boolean(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speed_kmh: z.number().min(0).max(200),
    heading_deg: z.number().min(0).max(360),
    satellites: z.number().int().min(0),
    hdop: z.number().min(0),
    ignition: z.enum(['ON', 'OFF', 'UNKNOWN']),
    vehicle_battery_mv: z.number().int().min(0).optional(),
    events: z.array(z.string()).optional(),
  })
  .strict();

export type LocationSampleDto = z.infer<typeof LocationSampleSchema>;

export const TelemetryBatchSchema = z
  .object({
    boot_id: z.string().min(1).max(64),
    samples: z.array(LocationSampleSchema).min(1).max(50),
  })
  .strict();

export type TelemetryBatchDto = z.infer<typeof TelemetryBatchSchema>;

export interface SampleRejectionItem {
  seq: number;
  reason:
    | 'CONFLICT'
    | 'INVALID_COORDINATES'
    | 'FUTURE_TIMESTAMP'
    | 'STALE_TIMESTAMP'
    | 'EXCESSIVE_SPEED'
    | 'FROZEN_POSITION';
}

export interface TelemetryIngestResponseDto {
  accepted_count: number;
  rejected_count: number;
  rejections: SampleRejectionItem[];
  server_time: string;
}
