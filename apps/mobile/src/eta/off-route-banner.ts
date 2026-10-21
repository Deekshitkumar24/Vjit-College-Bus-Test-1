import { LatLng, projectPointOntoPolyline } from '@collegebus/domain';

export interface OffRouteBannerState {
  isOffRoute: boolean;
  crossTrackDistanceM: number;
  corridorThresholdM: number;
  bannerVisible: boolean;
  bannerTitle: string;
  bannerMessage: string;
  tone: 'CRITICAL' | 'NORMAL';
}

export const CORRIDOR_THRESHOLD_METERS = 300;

/**
 * Evaluates whether the bus has deviated from its planned corridor (> 300m)
 * per SW-MVP-1.0 §14.5 and AG-MASTER Part 9.11.
 */
export function evaluateOffRouteStatus(
  busLocation: LatLng | null,
  routePolyline: LatLng[],
  corridorThresholdM: number = CORRIDOR_THRESHOLD_METERS,
): OffRouteBannerState {
  if (!busLocation || routePolyline.length < 2) {
    return {
      isOffRoute: false,
      crossTrackDistanceM: 0,
      corridorThresholdM,
      bannerVisible: false,
      bannerTitle: 'On Route',
      bannerMessage: 'Bus is following assigned route schedule',
      tone: 'NORMAL',
    };
  }

  const projection = projectPointOntoPolyline(busLocation, routePolyline, corridorThresholdM);
  const isOffRoute = projection.crossTrackDistanceM > corridorThresholdM;

  if (isOffRoute) {
    const deviationM = Math.round(projection.crossTrackDistanceM);
    return {
      isOffRoute: true,
      crossTrackDistanceM: deviationM,
      corridorThresholdM,
      bannerVisible: true,
      bannerTitle: 'Route Deviation Detected',
      bannerMessage: `Bus is currently ${deviationM}m outside scheduled corridor. Driver may be navigating a detour.`,
      tone: 'CRITICAL',
    };
  }

  return {
    isOffRoute: false,
    crossTrackDistanceM: Math.round(projection.crossTrackDistanceM),
    corridorThresholdM,
    bannerVisible: false,
    bannerTitle: 'On Route',
    bannerMessage: 'Bus is following assigned route schedule',
    tone: 'NORMAL',
  };
}
