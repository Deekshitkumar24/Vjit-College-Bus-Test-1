import { z } from 'zod';

export type DeviceHealthState = 'ONLINE' | 'DELAYED' | 'OFFLINE';

export const HeartbeatRequestSchema = z
  .object({
    schema_version: z.literal(1).default(1),
    device_id: z.string().regex(/^HW_\d{3,4}$/),
    boot_id: z.string().min(8).max(32),
    fw_version: z.string().min(1),
    sent_at: z.string().datetime(),
    uptime_s: z.number().int().nonnegative(),
    network_status: z.enum(['REGISTERED', 'SEARCHING', 'DENIED', 'NO_SERVICE', 'UNKNOWN']),
    sim_status: z.enum(['READY', 'NOT_INSERTED', 'PIN_REQUIRED', 'LOCKED', 'UNKNOWN']),
    signal_rssi_dbm: z.number().int().min(-125).max(0),
    vehicle_battery_mv: z.number().int().min(0).max(60000).nullable().optional(),
    device_battery_mv: z.number().int().min(0).max(10000).nullable().optional(),
    gps_status: z.enum(['FIX_VALID', 'NO_FIX', 'MODULE_ERROR', 'DISABLED']),
    buffer_bytes: z.number().int().nonnegative(),
    buffer_capacity_bytes: z.number().int().positive(),
    ignition: z.enum(['ON', 'OFF', 'UNKNOWN']),
    temperature_c: z.number().min(-40).max(85).nullable().optional(),
  })
  .strict();

export type HeartbeatRequestDto = z.infer<typeof HeartbeatRequestSchema>;

export interface HeartbeatConfigDto {
  moving_interval_s: number;
  stopped_interval_s: number;
  parked_heartbeat_s: number;
}

export type HeartbeatPendingAction = 'NONE' | 'UPDATE_CONFIG' | 'REBOOT' | 'FIRMWARE_UPDATE';

export interface HeartbeatResponseDto {
  schema_version: 1;
  server_time: string;
  config: HeartbeatConfigDto;
  pending_action: HeartbeatPendingAction;
  firmware_target?: string;
  firmware_url?: string;
  firmware_sha256?: string;
  firmware_size_bytes?: number;
  firmware_signature?: string;
}

export const HardwareEventSchema = z
  .object({
    type: z.string().min(1).max(50),
    seq: z.number().int().nonnegative(),
    occurred_at: z.string().datetime().nullable().optional(),
    data: z.record(z.any()).default({}),
  })
  .strict();

export type HardwareEventDto = z.infer<typeof HardwareEventSchema>;

export interface EventResultDto {
  seq: number;
  status: 'RECORDED' | 'PROCESSED' | 'IGNORED';
  incident_id: string | null;
}
