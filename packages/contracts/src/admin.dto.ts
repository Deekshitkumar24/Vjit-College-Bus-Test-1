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
