/**
 * ETA & Stop Arrival Engine (Part 9.9 & 9.11, SW-MVP §17.4-§17.5)
 */

import { haversineDistanceMeters, LatLng } from './gps-quality.js';

export type StopStatus = 'UPCOMING' | 'ARRIVING' | 'ARRIVED' | 'DEPARTED';

export interface RouteProjectionResult {
  closestPoint: LatLng;
  crossTrackDistanceM: number;
  distanceAlongRouteM: number;
  totalRouteLengthM: number;
  fractionAlongRoute: number; // 0.0 to 1.0
  isOffRoute: boolean;
}

export interface StopArrivalEvaluationParams {
  busLocation: LatLng;
  busSpeedKmh: number | null;
  busProgressAlongRouteM: number;
  stopLocation: LatLng;
  stopProgressAlongRouteM: number;
  dwellInsideSeconds?: number;
  dwellOutsideSeconds?: number;
  stopRadiusM?: number; // default 50m
  arrivalSpeedKmh?: number; // default 5 km/h
  arrivalDwellS?: number; // default 15s
  departureSpeedKmh?: number; // default 10 km/h
  departureDwellS?: number; // default 10s
  smoothedSpeedKmh?: number; // default 20 km/h
}

export interface StopArrivalResult {
  status: StopStatus;
  distanceToStopM: number;
  etaSeconds: number | null;
  etaLabel: string | null;
  isInsideRadius: boolean;
}

/**
 * Projects a point onto a line segment [p1, p2] using planar approximation.
 */
function projectPointOntoSegment(p: LatLng, p1: LatLng, p2: LatLng): { point: LatLng; t: number } {
  const dx = p2.lng - p1.lng;
  const dy = p2.lat - p1.lat;

  if (dx === 0 && dy === 0) {
    return { point: { lat: p1.lat, lng: p1.lng }, t: 0 };
  }

  // Projection scalar t on segment p1-p2
  let t = ((p.lng - p1.lng) * dx + (p.lat - p1.lat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // clamp to segment endpoints

  return {
    point: {
      lat: p1.lat + t * dy,
      lng: p1.lng + t * dx,
    },
    t,
  };
}

/**
 * Projects a GPS point onto a route polyline and calculates cross-track distance and progress (Part 9.9).
 */
export function projectPointOntoPolyline(
  point: LatLng,
  polyline: LatLng[],
  corridorM: number = 300,
): RouteProjectionResult {
  if (polyline.length === 0) {
    return {
      closestPoint: point,
      crossTrackDistanceM: 0,
      distanceAlongRouteM: 0,
      totalRouteLengthM: 0,
      fractionAlongRoute: 0,
      isOffRoute: false,
    };
  }

  if (polyline.length === 1) {
    const firstPt = polyline[0]!;
    const dist = haversineDistanceMeters(point, firstPt);
    return {
      closestPoint: firstPt,
      crossTrackDistanceM: dist,
      distanceAlongRouteM: 0,
      totalRouteLengthM: 0,
      fractionAlongRoute: 0,
      isOffRoute: dist > corridorM,
    };
  }

  // Compute total route length and segment cumulative lengths
  let totalRouteLengthM = 0;
  const segmentLengths: number[] = [];

  for (let i = 0; i < polyline.length - 1; i++) {
    const pA = polyline[i]!;
    const pB = polyline[i + 1]!;
    const segLen = haversineDistanceMeters(pA, pB);
    segmentLengths.push(segLen);
    totalRouteLengthM += segLen;
  }

  let minDistanceM = Infinity;
  let bestClosestPoint: LatLng = polyline[0]!;
  let distanceAlongRouteM = 0;
  let cumulativeDistBeforeSeg = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i]!;
    const p2 = polyline[i + 1]!;
    const segLen = segmentLengths[i] ?? 0;

    const { point: projPoint, t } = projectPointOntoSegment(point, p1, p2);
    const distM = haversineDistanceMeters(point, projPoint);

    if (distM < minDistanceM) {
      minDistanceM = distM;
      bestClosestPoint = projPoint;
      distanceAlongRouteM = cumulativeDistBeforeSeg + t * segLen;
    }

    cumulativeDistBeforeSeg += segLen;
  }

  const fractionAlongRoute = totalRouteLengthM > 0 ? distanceAlongRouteM / totalRouteLengthM : 0;
  const isOffRoute = minDistanceM > corridorM;

  return {
    closestPoint: bestClosestPoint,
    crossTrackDistanceM: Math.round(minDistanceM * 10) / 10,
    distanceAlongRouteM: Math.round(distanceAlongRouteM * 10) / 10,
    totalRouteLengthM: Math.round(totalRouteLengthM * 10) / 10,
    fractionAlongRoute: Math.round(fractionAlongRoute * 10000) / 10000,
    isOffRoute,
  };
}

/**
 * Calculates smoothed median moving speed clamped between 10 km/h and 60 km/h (Part 9.11).
 * Filters out stationary speeds (<= 3 km/h). Defaults to fallback 20 km/h if no moving data.
 */
export function calculateSmoothedSpeedKmh(
  recentSpeedsKmh: number[],
  fallbackKmh: number = 20,
  minKmh: number = 10,
  maxKmh: number = 60,
): number {
  // Filter moving samples (> 3 km/h)
  const movingSpeeds = recentSpeedsKmh.filter((s) => s > 3);
  if (movingSpeeds.length === 0) {
    return fallbackKmh;
  }

  // Calculate median
  const sorted = [...movingSpeeds].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  let median: number;

  if (sorted.length % 2 !== 0) {
    median = sorted[mid]!;
  } else {
    median = ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }

  // Clamp between minKmh and maxKmh
  return Math.max(minKmh, Math.min(maxKmh, Math.round(median * 10) / 10));
}

/**
 * Computes estimated time of arrival (ETA) to a target distance along route (Part 9.11).
 */
export function calculateEtaSeconds(
  remainingDistanceM: number,
  speedKmh: number,
): { etaSeconds: number; label: string; isArriving: boolean } | null {
  if (remainingDistanceM <= 0) {
    return { etaSeconds: 0, label: 'Arriving', isArriving: true };
  }

  if (speedKmh <= 0) {
    return null;
  }

  const speedMps = (speedKmh * 1000) / 3600;
  const etaSeconds = Math.round(remainingDistanceM / speedMps);

  if (etaSeconds < 60) {
    return {
      etaSeconds,
      label: 'Arriving',
      isArriving: true,
    };
  }

  const mins = Math.ceil(etaSeconds / 60);
  return {
    etaSeconds,
    label: `${mins} min${mins > 1 ? 's' : ''}`,
    isArriving: false,
  };
}

/**
 * Evaluates stop arrival, dwell, and departure states (Part 9.9, SW-MVP §17.4).
 */
export function evaluateStopStatus(params: StopArrivalEvaluationParams): StopArrivalResult {
  const {
    busLocation,
    busSpeedKmh,
    busProgressAlongRouteM,
    stopLocation,
    stopProgressAlongRouteM,
    dwellInsideSeconds = 0,
    dwellOutsideSeconds = 0,
    stopRadiusM = 50,
    arrivalSpeedKmh = 5,
    arrivalDwellS = 15,
    departureSpeedKmh = 10,
    departureDwellS = 10,
    smoothedSpeedKmh = 20,
  } = params;

  const distanceToStopM = haversineDistanceMeters(busLocation, stopLocation);
  const isInsideRadius = distanceToStopM <= stopRadiusM;

  // 1. Check if bus has already passed the stop along the route
  const progressDifferenceM = busProgressAlongRouteM - stopProgressAlongRouteM;
  if (progressDifferenceM > stopRadiusM) {
    return {
      status: 'DEPARTED',
      distanceToStopM,
      etaSeconds: null,
      etaLabel: 'Passed',
      isInsideRadius: false,
    };
  }

  // 2. Check if inside stop radius
  if (isInsideRadius) {
    // Arrival: inside stop radius at speed < 5 km/h for >= 15 seconds
    if (
      busSpeedKmh !== null &&
      busSpeedKmh < arrivalSpeedKmh &&
      dwellInsideSeconds >= arrivalDwellS
    ) {
      return {
        status: 'ARRIVED',
        distanceToStopM,
        etaSeconds: 0,
        etaLabel: 'At stop',
        isInsideRadius: true,
      };
    }

    // Inside radius but not yet completed arrival dwell -> ARRIVING
    return {
      status: 'ARRIVING',
      distanceToStopM,
      etaSeconds: 0,
      etaLabel: 'Arriving',
      isInsideRadius: true,
    };
  }

  // 3. Outside radius
  // If departure dwell or speed exceeded outside radius after being arrived
  if (
    dwellOutsideSeconds >= departureDwellS ||
    (busSpeedKmh !== null && busSpeedKmh > departureSpeedKmh && progressDifferenceM > 0)
  ) {
    return {
      status: 'DEPARTED',
      distanceToStopM,
      etaSeconds: null,
      etaLabel: 'Departed',
      isInsideRadius: false,
    };
  }

  // Upstream: calculate ETA
  const remainingDistanceAlongRouteM = Math.max(
    0,
    stopProgressAlongRouteM - busProgressAlongRouteM,
  );
  const eta = calculateEtaSeconds(remainingDistanceAlongRouteM, smoothedSpeedKmh);

  if (eta && eta.isArriving) {
    return {
      status: 'ARRIVING',
      distanceToStopM,
      etaSeconds: eta.etaSeconds,
      etaLabel: eta.label,
      isInsideRadius: false,
    };
  }

  return {
    status: 'UPCOMING',
    distanceToStopM,
    etaSeconds: eta ? eta.etaSeconds : null,
    etaLabel: eta ? eta.label : null,
    isInsideRadius: false,
  };
}

/**
 * Builds PostGIS SQL query for geometry projection and cross-track corridor calculation (Part 9.9).
 */
export function buildPostgisRouteProgressQuery(): string {
  return `
SELECT 
  rg.id AS route_geometry_id,
  rg.route_id,
  ST_LineLocatePoint(rg.line_string, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS fraction_along_route,
  ST_Distance(
    rg.line_string::geography,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
  ) AS cross_track_distance_m,
  ST_Length(
    ST_LineSubstring(
      rg.line_string,
      0,
      ST_LineLocatePoint(rg.line_string, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    )::geography
  ) AS distance_along_route_m,
  ST_Length(rg.line_string::geography) AS total_route_length_m
FROM route_geometries rg
WHERE rg.route_id = $3 AND rg.is_active = true
LIMIT 1;
`.trim();
}
