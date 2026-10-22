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

export const EndShiftSchema = z
  .object({
    shift_id: z.string().min(1),
    reason: z.enum(['MANUAL', 'AUTO_IDLE', 'TIMEOUT', 'ADMIN']).default('MANUAL'),
    note: z.string().max(250).optional(),
  })
  .strict();

export type EndShiftDto = z.infer<typeof EndShiftSchema>;

export const ActiveShiftResponseSchema = z
  .object({
    has_active_shift: z.boolean(),
    shift: z
      .object({
        shift_id: z.string(),
        bus_id: z.string(),
        driver_id: z.string(),
        route_id: z.string(),
        trip_id: z.string(),
        started_at: z.string(),
        idle_warning: z.boolean().default(false),
        timeout_warning: z.boolean().default(false),
      })
      .nullable(),
  })
  .strict();

export type ActiveShiftResponseDto = z.infer<typeof ActiveShiftResponseSchema>;

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

export const DriverRosterBusSchema = z
  .object({
    bus_id: z.string().min(1),
    bus_number: z.string().min(1),
    registration_number: z.string().min(1),
    route_id: z.string().min(1),
    route_name: z.string().min(1),
    is_active: z.boolean().default(true),
  })
  .strict();

export const DriverRosterResponseSchema = z
  .object({
    driver_id: z.string().min(1),
    buses: z.array(DriverRosterBusSchema),
  })
  .strict();

export type DriverRosterBusDto = z.infer<typeof DriverRosterBusSchema>;
export type DriverRosterResponseDto = z.infer<typeof DriverRosterResponseSchema>;

export const DriverDeviceRegisterSchema = z
  .object({
    device_label: z.string().min(1).max(100),
    device_model: z.string().min(1).max(64),
    os: z.enum(['ANDROID', 'IOS']),
    os_version: z.string().min(1).max(32),
    app_version: z.string().min(1).max(32),
  })
  .strict();

export type DriverDeviceRegisterDto = z.infer<typeof DriverDeviceRegisterSchema>;

export interface DriverDeviceRegisterResponseDto {
  registered: boolean;
  registered_at: string;
  device_label: string;
}

export const DriverTrackingModeSchema = z.enum(['AUTO', 'HARDWARE', 'PHONE']);
export type DriverTrackingMode = z.infer<typeof DriverTrackingModeSchema>;

export const DriverModeSwitchRequestSchema = z
  .object({
    mode: DriverTrackingModeSchema,
    note: z.string().max(140).optional(),
    shift_id: z.string().min(1),
  })
  .strict();

export type DriverModeSwitchRequestDto = z.infer<typeof DriverModeSwitchRequestSchema>;

export const DriverModeSwitchResponseSchema = z
  .object({
    mode: DriverTrackingModeSchema,
    updated_at: z.string().datetime(),
    bus_id: z.string(),
    note: z.string().nullable().optional(),
  })
  .strict();

export type DriverModeSwitchResponseDto = z.infer<typeof DriverModeSwitchResponseSchema>;

export const DriverManualCheckinReasonSchema = z.enum([
  'FLAGGED_GUEST',
  'LATE_BOARDED',
  'CARD_FORGOTTEN',
  'OTHER',
]);
export type DriverManualCheckinReason = z.infer<typeof DriverManualCheckinReasonSchema>;

export const DriverManualCheckinRequestSchema = z
  .object({
    trip_id: z.string().min(1),
    student_id: z.string().min(1),
    is_guest: z.boolean().default(false),
    reason: DriverManualCheckinReasonSchema,
    note: z.string().max(200).optional(),
    stop_id: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  })
  .strict();

export type DriverManualCheckinRequestDto = z.infer<typeof DriverManualCheckinRequestSchema>;

export const DriverManualCheckinResponseSchema = z
  .object({
    success: z.boolean(),
    student_id: z.string(),
    trip_id: z.string(),
    status: z.enum(['BOARDED', 'MANUAL_CHECKIN', 'LATE_BOARDED', 'FLAGGED_GUEST']),
    reason: DriverManualCheckinReasonSchema,
    boarded_at: z.string().datetime(),
    message: z.string(),
  })
  .strict();

export type DriverManualCheckinResponseDto = z.infer<typeof DriverManualCheckinResponseSchema>;

export const DriverProblemCategorySchema = z.enum([
  'BUS_BREAKDOWN',
  'TRACKER_PROBLEM',
  'PHONE_PROBLEM',
  'OTHER',
]);
export type DriverProblemCategory = z.infer<typeof DriverProblemCategorySchema>;

export const DriverTicketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type DriverTicketPriority = z.infer<typeof DriverTicketPrioritySchema>;

export const DriverProblemReportRequestSchema = z
  .object({
    category: DriverProblemCategorySchema,
    bus_id: z.string().min(1),
    shift_id: z.string().optional(),
    note: z.string().min(5).max(500),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    accuracy_m: z.number().min(0).optional(),
  })
  .strict();

export type DriverProblemReportRequestDto = z.infer<typeof DriverProblemReportRequestSchema>;

export const DriverProblemReportResponseSchema = z
  .object({
    ticket_id: z.string(),
    category: DriverProblemCategorySchema,
    priority: DriverTicketPrioritySchema,
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    bus_id: z.string(),
    driver_id: z.string(),
    reported_at: z.string().datetime(),
    message: z.string(),
  })
  .strict();

export type DriverProblemReportResponseDto = z.infer<typeof DriverProblemReportResponseSchema>;

export const DriverManualStopArrivalRequestSchema = z
  .object({
    shift_id: z.string().min(1),
    stop_id: z.string().min(1),
    timestamp: z.string().datetime().optional(),
    note: z.string().max(200).optional(),
  })
  .strict();

export type DriverManualStopArrivalRequestDto = z.infer<
  typeof DriverManualStopArrivalRequestSchema
>;

export const DriverSkippedStopSchema = z
  .object({
    stop_id: z.string(),
    stop_name: z.string(),
    sequence_order: z.number().int(),
  })
  .strict();

export type DriverSkippedStopDto = z.infer<typeof DriverSkippedStopSchema>;

export const DriverManualStopArrivalResponseSchema = z
  .object({
    stop_id: z.string(),
    status: z.literal('ARRIVED'),
    method: z.literal('MANUAL'),
    recorded_at: z.string().datetime(),
    skipped_stops: z.array(DriverSkippedStopSchema),
    message: z.string(),
  })
  .strict();

export type DriverManualStopArrivalResponseDto = z.infer<
  typeof DriverManualStopArrivalResponseSchema
>;

export const DriverRouteStopItemSchema = z
  .object({
    stop_id: z.string(),
    stop_name: z.string(),
    sequence_order: z.number().int(),
    lat: z.number(),
    lng: z.number(),
    status: z.enum(['UPCOMING', 'ARRIVING', 'ARRIVED', 'DEPARTED', 'SKIPPED']),
    arrival_method: z.enum(['AUTOMATIC', 'MANUAL']).nullable().optional(),
    arrived_at: z.string().datetime().nullable().optional(),
    eta_seconds: z.number().nullable().optional(),
  })
  .strict();

export type DriverRouteStopItemDto = z.infer<typeof DriverRouteStopItemSchema>;

export const DriverRouteStopsResponseSchema = z
  .object({
    route_id: z.string(),
    shift_id: z.string(),
    stops: z.array(DriverRouteStopItemSchema),
    skipped_count: z.number().int(),
    current_stop_id: z.string().nullable().optional(),
  })
  .strict();

export type DriverRouteStopsResponseDto = z.infer<typeof DriverRouteStopsResponseSchema>;

export const TrackingSourceUptimeSchema = z
  .object({
    hw_seconds: z.number().nonnegative(),
    phone_seconds: z.number().nonnegative(),
    hw_percentage: z.number().min(0).max(100),
    phone_percentage: z.number().min(0).max(100),
  })
  .strict();

export type TrackingSourceUptimeDto = z.infer<typeof TrackingSourceUptimeSchema>;

export const DriverTripSummarySchema = z
  .object({
    shift_id: z.string(),
    trip_id: z.string(),
    bus_id: z.string(),
    driver_id: z.string(),
    route_id: z.string(),
    trip_type: z.enum(['MORNING', 'AFTERNOON']),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime(),
    duration_seconds: z.number().nonnegative(),
    distance_km: z.number().nonnegative(),
    average_speed_kmh: z.number().nonnegative(),
    total_boardings: z.number().int().nonnegative(),
    tracking_source_uptime: TrackingSourceUptimeSchema,
    failover_count: z.number().int().nonnegative(),
    end_reason: z.enum(['MANUAL', 'AUTO_IDLE', 'TIMEOUT', 'ADMIN']),
  })
  .strict();

export type DriverTripSummaryDto = z.infer<typeof DriverTripSummarySchema>;
