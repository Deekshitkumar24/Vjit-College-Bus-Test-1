import { z } from 'zod';

// ==========================================
// 1. Bus Management Schemas
// ==========================================
export const BusStatusEnum = z.enum(['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']);
export type BusStatus = z.infer<typeof BusStatusEnum>;

export const CreateBusSchema = z.object({
  bus_number: z.string().min(1).max(20),
  license_plate: z.string().min(1).max(20),
  capacity: z.number().int().positive().max(120),
  model: z.string().max(100).optional(),
  status: BusStatusEnum.default('ACTIVE'),
});
export type CreateBusDto = z.input<typeof CreateBusSchema>;

export const UpdateBusSchema = CreateBusSchema.partial();
export type UpdateBusDto = z.infer<typeof UpdateBusSchema>;

export const BusResponseSchema = z.object({
  id: z.string().uuid(),
  bus_number: z.string(),
  license_plate: z.string(),
  capacity: z.number().int(),
  model: z.string().nullable().optional(),
  status: BusStatusEnum,
  active_device_id: z.string().uuid().nullable().optional(),
  active_route_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BusResponseDto = z.infer<typeof BusResponseSchema>;

// ==========================================
// 2. Device Provisioning & Lifecycle Schemas
// ==========================================
export const DeviceStatusEnum = z.enum([
  'PROVISIONED',
  'ACTIVE',
  'BENCH',
  'REVOKED',
  'RETIRED',
]);
export type DeviceStatus = z.infer<typeof DeviceStatusEnum>;

export const ProvisionDeviceItemSchema = z.object({
  device_id: z.string().min(3).max(64),
  serial_number: z.string().min(3).max(64),
  imei: z.string().regex(/^\d{15}$/, 'IMEI must be exactly 15 digits'),
  iccid: z.string().regex(/^\d{19,20}$/, 'ICCID must be 19 or 20 digits'),
  vehicle_class: z.enum(['V12', 'V24']).default('V12'),
  is_bench: z.boolean().default(false),
});
export type ProvisionDeviceItemDto = z.input<typeof ProvisionDeviceItemSchema>;

export const BatchProvisionDevicesSchema = z.object({
  devices: z.array(ProvisionDeviceItemSchema).min(1).max(500),
});
export type BatchProvisionDevicesDto = z.infer<typeof BatchProvisionDevicesSchema>;

export const ProvisionedDeviceResponseSchema = z.object({
  device_id: z.string(),
  serial_number: z.string(),
  status: DeviceStatusEnum,
  token_plaintext: z.string(), // One-time token display
  token_qr_uri: z.string(),
  label_payload: z.object({
    device_id: z.string(),
    serial_number: z.string(),
    imei: z.string(),
    provisioned_at: z.string(),
  }),
});
export type ProvisionedDeviceResponseDto = z.infer<typeof ProvisionedDeviceResponseSchema>;

// ==========================================
// 3. Device Links (Coordinator Only)
// ==========================================
export const CreateDeviceLinkSchema = z.object({
  bus_id: z.string().uuid(),
  device_id: z.string().min(1),
  effective_from: z.string().datetime().optional(),
  reason: z.string().max(255).optional(),
});
export type CreateDeviceLinkDto = z.infer<typeof CreateDeviceLinkSchema>;

export const ReplaceDeviceWizardSchema = z.object({
  bus_id: z.string().uuid(),
  old_device_id: z.string(),
  new_device_id: z.string(),
  reason: z.enum(['FAILED', 'LOST', 'UPGRADED']),
  notes: z.string().max(500).optional(),
});
export type ReplaceDeviceWizardDto = z.infer<typeof ReplaceDeviceWizardSchema>;

// ==========================================
// 4. Token Rotation & Revocation
// ==========================================
export const RotateDeviceTokenSchema = z.object({
  device_id: z.string(),
  reason: z.string().min(5).max(255),
});
export type RotateDeviceTokenDto = z.infer<typeof RotateDeviceTokenSchema>;

export const RevokeDeviceSchema = z.object({
  device_id: z.string(),
  confirm_bus_number: z.string().min(1), // Typed confirmation
  reason: z.string().min(5).max(255),
});
export type RevokeDeviceDto = z.infer<typeof RevokeDeviceSchema>;

// ==========================================
// 5. Device Health & Diagnostics
// ==========================================
export const DeviceHealthResponseSchema = z.object({
  device_id: z.string(),
  bus_number: z.string().nullable().optional(),
  status: DeviceStatusEnum,
  last_heartbeat_at: z.string().nullable().optional(),
  last_valid_fix_at: z.string().nullable().optional(),
  vehicle_battery_mv: z.number().int().optional(),
  internal_battery_mv: z.number().int().optional(),
  csq_signal: z.number().int().min(0).max(31).optional(),
  buffer_used_samples: z.number().int().optional(),
  is_online: z.boolean(),
  recent_events: z.array(
    z.object({
      event_type: z.string(),
      recorded_at: z.string(),
      details: z.record(z.unknown()).optional(),
    }),
  ),
});
export type DeviceHealthResponseDto = z.infer<typeof DeviceHealthResponseSchema>;

// ==========================================
// 6. Routes, Stops & Geometry Management (P4-T3, Part 20.8)
// ==========================================
export const StopSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  code: z.string().min(1).max(20),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(10).max(200).default(50),
  landmark: z.string().max(100).nullable().optional(),
});
export type StopDto = z.infer<typeof StopSchema>;

export const CreateStopSchema = z.object({
  name: z.string().min(1).max(60),
  code: z.string().min(1).max(20),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(10).max(200).default(50),
  landmark: z.string().max(100).optional(),
});
export type CreateStopDto = z.infer<typeof CreateStopSchema>;

export const UpdateStopSchema = CreateStopSchema.partial();
export type UpdateStopDto = z.infer<typeof UpdateStopSchema>;

export const OrderedRouteStopSchema = z.object({
  stop_id: z.string(),
  sequence_order: z.number().int().positive(),
  scheduled_arrival_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  scheduled_departure_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});
export type OrderedRouteStopDto = z.infer<typeof OrderedRouteStopSchema>;

export const GeoJsonLineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2), // [lng, lat] per GeoJSON spec
});
export type GeoJsonLineString = z.infer<typeof GeoJsonLineStringSchema>;

export const CreateRouteSchema = z.object({
  route_code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  trip_type: z.enum(['MORNING', 'AFTERNOON', 'BOTH']).default('BOTH'),
  stops: z.array(OrderedRouteStopSchema).min(2),
  geometry_geojson: GeoJsonLineStringSchema.optional(),
  is_active: z.boolean().default(true),
});
export type CreateRouteDto = z.infer<typeof CreateRouteSchema>;

export const UpdateRouteSchema = CreateRouteSchema.partial();
export type UpdateRouteDto = z.infer<typeof UpdateRouteSchema>;

export const RouteResponseSchema = z.object({
  id: z.string(),
  route_code: z.string(),
  name: z.string(),
  trip_type: z.enum(['MORNING', 'AFTERNOON', 'BOTH']),
  stops: z.array(
    z.object({
      stop_id: z.string(),
      stop_name: z.string(),
      sequence_order: z.number().int(),
      lat: z.number(),
      lng: z.number(),
      radius_m: z.number().int(),
      scheduled_arrival_time: z.string().optional(),
    }),
  ),
  geometry_geojson: GeoJsonLineStringSchema.nullable().optional(),
  assigned_bus_ids: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RouteResponseDto = z.infer<typeof RouteResponseSchema>;

// Timetable & Holiday Exceptions
export const TimetableEntrySchema = z.object({
  route_id: z.string(),
  trip_type: z.enum(['MORNING', 'AFTERNOON']),
  day_of_week: z.number().int().min(0).max(6), // 0: Sun, 1: Mon...
  departure_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type TimetableEntryDto = z.infer<typeof TimetableEntrySchema>;

export const HolidayExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(100),
  service_suspended: z.boolean().default(true),
  operating_route_ids: z.array(z.string()).optional(),
});
export type HolidayExceptionDto = z.infer<typeof HolidayExceptionSchema>;

export const AssignBusToRouteSchema = z.object({
  route_id: z.string(),
  bus_id: z.string(),
  effective_from: z.string().optional(),
  effective_to: z.string().optional(),
});
export type AssignBusToRouteDto = z.infer<typeof AssignBusToRouteSchema>;

// ==========================================
// 7. Rosters, Faculty & Student Route Assignments (P4-T4)
// ==========================================
export const DriverRosterScheduleSchema = z.object({
  id: z.string(),
  driver_id: z.string(),
  bus_id: z.string(),
  valid_from: z.string().datetime(),
  valid_to: z.string().datetime().nullable().optional(),
  recurrence: z.enum(['DAILY', 'WEEKDAYS', 'CUSTOM']).default('DAILY'),
});
export type DriverRosterScheduleDto = z.infer<typeof DriverRosterScheduleSchema>;

export const CreateDriverRosterScheduleSchema = z.object({
  driver_id: z.string().min(1),
  bus_id: z.string().min(1),
  valid_from: z.string().datetime(),
  valid_to: z.string().datetime().optional(),
  recurrence: z.enum(['DAILY', 'WEEKDAYS', 'CUSTOM']).default('DAILY'),
});
export type CreateDriverRosterScheduleDto = z.infer<typeof CreateDriverRosterScheduleSchema>;

export const FacultyBusAssignmentSchema = z.object({
  id: z.string(),
  faculty_id: z.string(),
  bus_id: z.string(),
  assigned_at: z.string(),
  is_active: z.boolean(),
});
export type FacultyBusAssignmentDto = z.infer<typeof FacultyBusAssignmentSchema>;

export const CreateFacultyBusAssignmentSchema = z.object({
  faculty_id: z.string().min(1),
  bus_id: z.string().min(1),
});
export type CreateFacultyBusAssignmentDto = z.infer<typeof CreateFacultyBusAssignmentSchema>;

export const StudentRouteAssignmentSchema = z.object({
  id: z.string(),
  student_id: z.string(),
  route_id: z.string(),
  morning_stop_id: z.string(),
  afternoon_stop_id: z.string(),
  assigned_at: z.string(),
  is_active: z.boolean(),
});
export type StudentRouteAssignmentDto = z.infer<typeof StudentRouteAssignmentSchema>;

export const CreateStudentRouteAssignmentSchema = z.object({
  student_id: z.string().min(1),
  route_id: z.string().min(1),
  morning_stop_id: z.string().min(1),
  afternoon_stop_id: z.string().min(1),
});
export type CreateStudentRouteAssignmentDto = z.infer<typeof CreateStudentRouteAssignmentSchema>;

// ==========================================
// 8. User Management, CSV Import & Deactivation (P4-T5, Part 11.8, AC-COR-02, AC-COR-03)
// ==========================================
export const UserImportRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),
  role: z.enum(['STUDENT', 'FACULTY', 'DRIVER', 'COORDINATOR', 'TECHNICIAN', 'SECURITY', 'MANAGEMENT']),
  college_id: z.string().min(1, 'College ID is required'),
  route_id: z.string().optional(),
  morning_stop_id: z.string().optional(),
  afternoon_stop_id: z.string().optional(),
});
export type UserImportRowDto = z.infer<typeof UserImportRowSchema>;

export const UserImportRowErrorSchema = z.object({
  rowNumber: z.number().int().positive(),
  column: z.string(),
  message: z.string(),
  rawValue: z.string().optional(),
});
export type UserImportRowErrorDto = z.infer<typeof UserImportRowErrorSchema>;

export const UserImportDryRunResultSchema = z.object({
  totalRows: z.number().int().min(0),
  validRows: z.number().int().min(0),
  invalidRows: z.number().int().min(0),
  canCommit: z.boolean(),
  errors: z.array(UserImportRowErrorSchema),
  validRecords: z.array(UserImportRowSchema).optional(),
});
export type UserImportDryRunResultDto = z.infer<typeof UserImportDryRunResultSchema>;

export const UserDeactivationSchema = z.object({
  userId: z.string().min(1),
  deactivatedAt: z.string().datetime(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  revokeActiveSessions: z.boolean().default(true),
});
export type UserDeactivationDto = z.infer<typeof UserDeactivationSchema>;

// ==========================================
// 9. Live Fleet Map, Source Switch Log & Dual Track (P4-T6, Part 16, Part 21)
// ==========================================
export const FleetBusStatusSchema = z.object({
  bus_id: z.string(),
  plate_number: z.string(),
  route_id: z.string().nullable().optional(),
  route_name: z.string().nullable().optional(),
  driver_name: z.string().nullable().optional(),
  active_source: z.enum(['PRIMARY_TRACKER', 'DRIVER_PHONE', 'NONE']),
  status: z.enum(['RUNNING', 'IDLE', 'NOT_RUNNING', 'OFF_ROUTE', 'EMERGENCY']),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  speed_kph: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  battery_v: z.number().nullable().optional(),
  last_sample_at: z.string().nullable().optional(),
  age_seconds: z.number().int().nullable().optional(),
});
export type FleetBusStatusDto = z.infer<typeof FleetBusStatusSchema>;

export const SourceSwitchReasonEnum = z.enum([
  'DEVICE_TIMEOUT',
  'LOW_ACCURACY',
  'DRIVER_TAKEOVER',
  'DISAGREEMENT',
  'MANUAL_OVERRIDE',
  'PRIMARY_RECOVERED',
]);
export type SourceSwitchReason = z.infer<typeof SourceSwitchReasonEnum>;

export const SourceSwitchLogItemSchema = z.object({
  id: z.string(),
  bus_id: z.string(),
  switched_at: z.string().datetime(),
  previous_source: z.enum(['PRIMARY_TRACKER', 'DRIVER_PHONE', 'NONE']),
  new_source: z.enum(['PRIMARY_TRACKER', 'DRIVER_PHONE', 'NONE']),
  reason: SourceSwitchReasonEnum,
  confidence: z.number().min(0).max(1),
  details: z.record(z.unknown()).optional(),
});
export type SourceSwitchLogItemDto = z.infer<typeof SourceSwitchLogItemSchema>;

export const GpsPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  recorded_at: z.string(),
  speed_kph: z.number().optional(),
  accuracy_m: z.number().optional(),
});
export type GpsPointDto = z.infer<typeof GpsPointSchema>;

export const DualTrackComparisonSchema = z.object({
  bus_id: z.string(),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  primary_track: z.array(GpsPointSchema),
  phone_track: z.array(GpsPointSchema),
  max_divergence_m: z.number(),
  average_divergence_m: z.number(),
  disagreement_intervals: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
      divergence_m: z.number(),
      reason: z.string(),
    }),
  ),
});
export type DualTrackComparisonDto = z.infer<typeof DualTrackComparisonSchema>;


