import { z } from 'zod';

export const StartShiftSchema = z
  .object({
    bus_id: z.string().min(1),
    route_id: z.string().min(1),
    trip_type: z.enum(['MORNING', 'AFTERNOON']),
    odometer_km: z.number().int().nonnegative().optional(),
  })
  .strict();

export type StartShiftDto = z.infer<typeof StartShiftSchema>;

export interface ShiftClaimDto {
  shift_id: string;
  bus_id: string;
  driver_id: string;
  route_id: string;
  trip_id: string;
  started_at: string;
}

export const DriverLocationSampleSchema = z
  .object({
    seq: z.number().int().nonnegative(),
    recorded_at: z.string().datetime(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy_m: z.number().min(0).max(1000),
    speed_mps: z.number().min(0).max(100).nullable().optional(),
    heading_deg: z.number().min(0).max(360).nullable().optional(),
    provider: z.enum(['GPS', 'FUSED', 'NETWORK', 'UNKNOWN']),
    is_mock: z.boolean().default(false),
  })
  .strict();

export type DriverLocationSampleDto = z.infer<typeof DriverLocationSampleSchema>;

export const DriverLocationsBatchSchema = z
  .object({
    shift_id: z.string().min(1),
    app_version: z.string().min(1),
    device_model: z.string().max(64),
    samples: z.array(DriverLocationSampleSchema).min(1).max(50),
  })
  .strict();

export type DriverLocationsBatchDto = z.infer<typeof DriverLocationsBatchSchema>;

export interface DriverSampleRejection {
  seq: number;
  reason:
    | 'CONFLICT'
    | 'MOCK_LOCATION'
    | 'ACCURACY_TOO_LOW'
    | 'NETWORK_PROVIDER'
    | 'NULL_ISLAND'
    | 'FUTURE_TIMESTAMP'
    | 'STALE_TIMESTAMP'
    | 'OUT_OF_RANGE';
}

export interface DriverLocationsResponseDto {
  ack_seq: number;
  rejected: DriverSampleRejection[];
  phone_interval_s: 10 | 30;
  active_source: 'HW' | 'PHONE';
  server_time: string;
}

export const DriverStatusSchema = z
  .object({
    app_version: z.string().min(1),
    os: z.enum(['ANDROID', 'IOS']),
    os_version: z.string().min(1),
    location_permission: z.enum(['ALWAYS', 'WHILE_IN_USE', 'DENIED']),
    notifications_permission: z.enum(['GRANTED', 'DENIED']),
    battery_percent: z.number().min(0).max(100),
    battery_optimisation_exempt: z.boolean().nullable().optional(),
    background_running: z.boolean(),
    gps_enabled: z.boolean(),
    network: z.enum(['WIFI', 'CELLULAR', 'NONE']),
  })
  .strict();

export type DriverStatusDto = z.infer<typeof DriverStatusSchema>;
