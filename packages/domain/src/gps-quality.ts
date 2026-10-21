/**
 * GPS Quality, Plausibility, and Validity Rules (Part 9.1, 9.2, 9.14)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TimedLocation extends LatLng {
  recorded_at: Date;
  speed_kmh?: number | null | undefined;
}

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula).
 * Corresponds to PostGIS ST_Distance on geography (Part 9.2).
 */
export function haversineDistanceMeters(coord1: LatLng, coord2: LatLng): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Rounds WGS84 coordinate to 6 decimal places (~0.1m precision) per Part 9.2.
 */
export function roundCoordinate(coord: number): number {
  return Math.round(coord * 1e6) / 1e6;
}

/**
 * Validates coordinate range and rejects Null Island (0, 0) per Part 9.2.
 */
export function validateCoordinates(
  lat: number,
  lng: number,
): { valid: boolean; reason?: 'OUT_OF_RANGE' | 'NULL_ISLAND' } {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, reason: 'OUT_OF_RANGE' };
  }
  if (lat === 0 && lng === 0) {
    return { valid: false, reason: 'NULL_ISLAND' };
  }
  return { valid: true };
}

/**
 * Unit conversions per Part 9.2:
 * - Knots to km/h (* 1.852)
 * - m/s to km/h (* 3.6)
 * - km/h to m/s (/ 3.6)
 */
export function knotsToKmh(knots: number): number {
  return Math.round(knots * 1.852 * 10) / 10;
}

export function mpsToKmh(mps: number): number {
  return Math.round(mps * 3.6 * 10) / 10;
}

export function kmhToMps(kmh: number): number {
  return Math.round((kmh / 3.6) * 10) / 10;
}

export interface HardwareFixParams {
  gps_valid: boolean;
  satellites: number;
  hdop: number;
  isBuffered?: boolean | undefined;
  minSatellites?: number | undefined; // default 4
  maxHdop?: number | undefined; // default 5.0
}

/**
 * Evaluates hardware fix validity per Part 9.1:
 * - gps_valid is true
 * - satellites >= minSatellites (default 4)
 * - hdop <= maxHdop (default 5.0)
 * - isBuffered is false (samples older than 10 min are not used for live fix)
 */
export function isHardwareFixValid(params: HardwareFixParams): boolean {
  const minSatellites = params.minSatellites ?? 4;
  const maxHdop = params.maxHdop ?? 5.0;

  if (!params.gps_valid) return false;
  if (params.isBuffered) return false;
  if (params.satellites < minSatellites) return false;
  if (params.hdop > maxHdop) return false;

  return true;
}

export interface PhoneFixParams {
  accuracy_m: number;
  provider: 'GPS' | 'FUSED' | 'NETWORK' | 'UNKNOWN';
  is_mock?: boolean | undefined;
  maxAccuracyM?: number | undefined; // default 50
}

/**
 * Evaluates phone fix validity per Part 9.1:
 * - accuracy_m <= 50m
 * - provider is not NETWORK
 * - is_mock is false
 */
export function isPhoneFixValid(params: PhoneFixParams): boolean {
  const maxAccuracy = params.maxAccuracyM ?? 50;

  if (params.is_mock) return false;
  if (params.provider === 'NETWORK') return false;
  if (params.accuracy_m > maxAccuracy) return false;

  return true;
}

/**
 * Checks if a source fix is fresh per Part 9.1 (within 60 seconds).
 */
export function isSourceFresh(
  lastValidFixAt: Date | null | undefined,
  now: Date = new Date(),
  staleAfterSeconds: number = 60,
): boolean {
  if (!lastValidFixAt) return false;
  const elapsed = (now.getTime() - lastValidFixAt.getTime()) / 1000;
  return elapsed >= 0 && elapsed <= staleAfterSeconds;
}

export interface JumpCheckResult {
  isJump: boolean;
  impliedSpeedKmh: number;
  distanceMeters: number;
  referenceReset: boolean;
}

/**
 * Kinematic plausibility jump check per Part 9.14:
 * - Distance between last accepted valid sample and current sample divided by elapsed seconds * 3.6.
 * - If implied speed > 150 km/h, flagged as implausible jump.
 * - If time gap > 30 minutes (1800s), resets reference point and allows sample.
 */
export function evaluateJumpCheck(
  prevSample: TimedLocation,
  currSample: TimedLocation,
  maxSpeedKmh: number = 150,
  resetMinutes: number = 30,
): JumpCheckResult {
  const elapsedSeconds =
    (currSample.recorded_at.getTime() - prevSample.recorded_at.getTime()) / 1000;

  // Reset reference if time gap exceeds jump_reset_min (default 30 min)
  if (elapsedSeconds > resetMinutes * 60) {
    return {
      isJump: false,
      impliedSpeedKmh: 0,
      distanceMeters: 0,
      referenceReset: true,
    };
  }

  if (elapsedSeconds <= 0) {
    return {
      isJump: true,
      impliedSpeedKmh: Infinity,
      distanceMeters: 0,
      referenceReset: false,
    };
  }

  const distanceMeters = haversineDistanceMeters(prevSample, currSample);
  const impliedSpeedKmh = Math.round((distanceMeters / elapsedSeconds) * 3.6 * 10) / 10;

  return {
    isJump: impliedSpeedKmh > maxSpeedKmh,
    impliedSpeedKmh,
    distanceMeters,
    referenceReset: false,
  };
}

export interface FrozenPositionCheckParams {
  samples: TimedLocation[];
  minDurationSeconds?: number | undefined; // default 300s (5 minutes)
  minClaimedSpeedKmh?: number | undefined; // default 5 km/h
  maxMovementMeters?: number | undefined; // default 10m
}

/**
 * Frozen GPS check per Part 9.14:
 * Speed > 5 km/h claimed for 5 minutes (300s) while position moves less than 10 meters.
 */
export function evaluateFrozenPosition(params: FrozenPositionCheckParams): boolean {
  const {
    samples,
    minDurationSeconds = 300,
    minClaimedSpeedKmh = 5,
    maxMovementMeters = 10,
  } = params;

  if (samples.length < 2) return false;

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return false;

  const durationSeconds = (last.recorded_at.getTime() - first.recorded_at.getTime()) / 1000;
  if (durationSeconds < minDurationSeconds) return false;

  // Verify all samples claim speed above minClaimedSpeedKmh
  const allClaimMoving = samples.every(
    (s) => s.speed_kmh !== null && s.speed_kmh !== undefined && s.speed_kmh > minClaimedSpeedKmh,
  );
  if (!allClaimMoving) return false;

  // Calculate maximum displacement from initial sample across window
  let maxDisplacement = 0;
  for (const s of samples) {
    const d = haversineDistanceMeters(first, s);
    if (d > maxDisplacement) maxDisplacement = d;
  }

  return maxDisplacement < maxMovementMeters;
}

export interface SourceDisagreementResult {
  isSwapAlert: boolean; // distance > 500m for >= 2 minutes (120s)
  isLogged: boolean; // distance > 300m for >= 10 minutes (600s)
  currentDistanceMeters: number;
}

/**
 * Source disagreement evaluation per Part 9.14:
 * - Distance > 500m for >= 2 minutes (120s) raises possible tracker swap alert.
 * - Distance > 300m for >= 10 minutes (600s) is logged.
 */
export function evaluateSourceDisagreement(
  hwPos: LatLng,
  phonePos: LatLng,
  durationOverThresholdSeconds: number,
): SourceDisagreementResult {
  const currentDistanceMeters = haversineDistanceMeters(hwPos, phonePos);

  const isSwapAlert = currentDistanceMeters > 500 && durationOverThresholdSeconds >= 120;
  const isLogged = currentDistanceMeters > 300 && durationOverThresholdSeconds >= 600;

  return {
    isSwapAlert,
    isLogged,
    currentDistanceMeters,
  };
}
