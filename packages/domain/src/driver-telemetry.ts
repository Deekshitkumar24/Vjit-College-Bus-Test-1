export interface DriverPhoneSampleInput {
  seq: number;
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_mps?: number | null | undefined;
  heading_deg?: number | null | undefined;
  provider: 'GPS' | 'FUSED' | 'NETWORK' | 'UNKNOWN';
  is_mock?: boolean | undefined;
}

export interface DriverRosterEntry {
  id: string;
  driver_id: string;
  bus_id: string;
  valid_from: Date;
  valid_to: Date | null;
}

export interface ShiftRecord {
  id: string;
  driver_id: string;
  bus_id: string;
  route_id: string;
  trip_id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  started_at: Date;
  ended_at: Date | null;
}

export interface ShiftStartValidationResult {
  allowed: boolean;
  code?: 'NOT_ROSTERED' | 'BUS_SHIFT_ALREADY_ACTIVE' | 'DRIVER_ALREADY_ON_SHIFT';
  reason?: string;
}

/**
 * Validates shift start preconditions per AG-MASTER Part 6.7 and R-16:
 * - Driver must have an active roster entry for the bus.
 * - The bus must have NO other ACTIVE shift.
 */
export function validateShiftStart(
  driverId: string,
  busId: string,
  rosterEntries: DriverRosterEntry[],
  existingActiveShifts: ShiftRecord[],
  now: Date = new Date(),
): ShiftStartValidationResult {
  // 1. Check if driver has active roster entry for this bus
  const nowMs = now.getTime();
  const isRostered = rosterEntries.some((r) => {
    if (r.driver_id !== driverId || r.bus_id !== busId) return false;
    const fromMs = r.valid_from.getTime();
    const toMs = r.valid_to ? r.valid_to.getTime() : Infinity;
    return nowMs >= fromMs && nowMs <= toMs;
  });

  if (!isRostered) {
    return {
      allowed: false,
      code: 'NOT_ROSTERED',
      reason: 'Driver is not actively rostered for this bus',
    };
  }

  // 2. Check if bus already has an ACTIVE shift
  const busHasActiveShift = existingActiveShifts.some(
    (s) => s.bus_id === busId && s.status === 'ACTIVE',
  );
  if (busHasActiveShift) {
    return {
      allowed: false,
      code: 'BUS_SHIFT_ALREADY_ACTIVE',
      reason: 'Bus already has an ongoing active shift',
    };
  }

  // 3. Check if driver is already on another ACTIVE shift
  const driverHasActiveShift = existingActiveShifts.some(
    (s) => s.driver_id === driverId && s.status === 'ACTIVE',
  );
  if (driverHasActiveShift) {
    return {
      allowed: false,
      code: 'DRIVER_ALREADY_ON_SHIFT',
      reason: 'Driver already has another active shift in progress',
    };
  }

  return { allowed: true };
}

export interface DriverSampleValidationResult {
  accepted: boolean;
  reason?:
    | 'CONFLICT'
    | 'MOCK_LOCATION'
    | 'ACCURACY_TOO_LOW'
    | 'NETWORK_PROVIDER'
    | 'NULL_ISLAND'
    | 'FUTURE_TIMESTAMP'
    | 'STALE_TIMESTAMP'
    | 'OUT_OF_RANGE';
  speed_kmh?: number | null;
}

/**
 * Validates a driver phone location sample per Part 5.3 and SW-MVP section 11.7:
 * - Rejects null island (0, 0)
 * - Rejects future timestamp (> 60s)
 * - Rejects stale timestamp (> 7 days)
 * - Rejects accuracy > 50m
 * - Rejects NETWORK provider
 * - Rejects mock locations (is_mock === true)
 * - Converts speed from m/s to km/h (* 3.6)
 */
export function validateDriverPhoneSample(
  sample: DriverPhoneSampleInput,
  serverTime: Date = new Date(),
  maxAccuracyMeters: number = 50,
): DriverSampleValidationResult {
  // Coordinate range check
  if (sample.lat < -90 || sample.lat > 90 || sample.lng < -180 || sample.lng > 180) {
    return { accepted: false, reason: 'OUT_OF_RANGE' };
  }

  // Null Island check
  if (sample.lat === 0 && sample.lng === 0) {
    return { accepted: false, reason: 'NULL_ISLAND' };
  }

  // Timestamp checks
  const recordedMs = new Date(sample.recorded_at).getTime();
  const serverMs = serverTime.getTime();

  if (recordedMs - serverMs > 60 * 1000) {
    return { accepted: false, reason: 'FUTURE_TIMESTAMP' };
  }

  if (serverMs - recordedMs > 7 * 86400 * 1000) {
    return { accepted: false, reason: 'STALE_TIMESTAMP' };
  }

  // Mock location check (Conflict C-03 / C-10: is_mock)
  if (sample.is_mock) {
    return { accepted: false, reason: 'MOCK_LOCATION' };
  }

  // Provider check: GPS or FUSED only; NETWORK disallowed for live tracking
  if (sample.provider === 'NETWORK') {
    return { accepted: false, reason: 'NETWORK_PROVIDER' };
  }

  // Accuracy check: max 50 meters
  if (sample.accuracy_m > maxAccuracyMeters) {
    return { accepted: false, reason: 'ACCURACY_TOO_LOW' };
  }

  // Convert speed from m/s to km/h (multiplied by 3.6 per Part 5.3)
  const speedKmh =
    sample.speed_mps !== null && sample.speed_mps !== undefined
      ? Math.round(sample.speed_mps * 3.6 * 10) / 10
      : null;

  return {
    accepted: true,
    speed_kmh: speedKmh,
  };
}
