import { BusSnapshot } from '@collegebus/contracts';
import { LatLng, haversineDistanceMeters } from '@collegebus/domain';

export type StopTimelineStatus = 'PASSED' | 'ARRIVING' | 'ARRIVED' | 'UPCOMING';

export interface RouteStop {
  id: string;
  name: string;
  sequence: number;
  location: LatLng;
}

export interface StopTimelineItem {
  stopId: string;
  stopName: string;
  sequence: number;
  status: StopTimelineStatus;
  isTargetStop: boolean;
  etaLabel: string | null;
  etaSeconds: number | null;
  distanceMeters: number | null;
  badgeTone: 'GREEN' | 'BLUE' | 'GRAY' | 'AMBER';
}

export interface RouteProgressSummary {
  fractionCompleted: number; // 0.0 to 1.0
  completedStopsCount: number;
  totalStopsCount: number;
  currentStopIndex: number;
  nextStopName: string | null;
  nextStopEtaLabel: string | null;
  targetStopName: string | null;
  targetStopEtaLabel: string | null;
  isTripCompleted: boolean;
}

/**
 * Evaluates the timeline of stops along a route given the live bus snapshot.
 * Respects SW-MVP-1.0 §14 & §17.4.
 */
export function buildStopTimeline(
  stops: RouteStop[],
  bus: BusSnapshot,
  targetStopId?: string,
): { items: StopTimelineItem[]; summary: RouteProgressSummary } {
  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
  const totalStops = sortedStops.length;

  if (totalStops === 0) {
    return {
      items: [],
      summary: {
        fractionCompleted: 0,
        completedStopsCount: 0,
        totalStopsCount: 0,
        currentStopIndex: -1,
        nextStopName: null,
        nextStopEtaLabel: null,
        targetStopName: null,
        targetStopEtaLabel: null,
        isTripCompleted: false,
      },
    };
  }

  const busLoc: LatLng | null =
    bus.lat !== null && bus.lng !== null ? { lat: bus.lat, lng: bus.lng } : null;

  // Find the closest upcoming stop or current active stop
  let activeStopIdx = 0;
  let minDistanceM = Infinity;

  if (busLoc) {
    for (let i = 0; i < sortedStops.length; i++) {
      const stop = sortedStops[i]!;
      const dist = haversineDistanceMeters(busLoc, stop.location);
      if (dist < minDistanceM) {
        minDistanceM = dist;
        activeStopIdx = i;
      }
    }
  }

  // Determine if active stop is arrived or arriving
  let activeStatus: StopTimelineStatus = 'UPCOMING';
  if (minDistanceM <= 50) {
    activeStatus = 'ARRIVED';
  } else if (minDistanceM <= 300) {
    activeStatus = 'ARRIVING';
  }

  const items: StopTimelineItem[] = sortedStops.map((stop, idx) => {
    let status: StopTimelineStatus = 'UPCOMING';
    let badgeTone: 'GREEN' | 'BLUE' | 'GRAY' | 'AMBER' = 'GRAY';
    const dist = busLoc ? Math.round(haversineDistanceMeters(busLoc, stop.location)) : null;

    if (idx < activeStopIdx) {
      status = 'PASSED';
      badgeTone = 'GRAY';
    } else if (idx === activeStopIdx) {
      status = activeStatus;
      badgeTone =
        activeStatus === 'ARRIVED' ? 'GREEN' : activeStatus === 'ARRIVING' ? 'BLUE' : 'AMBER';
    } else {
      status = 'UPCOMING';
      badgeTone = 'GRAY';
    }

    const isTarget = Boolean(targetStopId && stop.id === targetStopId);

    // Compute simple ETA estimate for stops
    let etaSeconds: number | null = null;
    let etaLabel: string | null = null;

    if (bus.state === 'LIVE' && dist !== null) {
      if (status === 'PASSED') {
        etaLabel = 'Departed';
      } else if (status === 'ARRIVED') {
        etaLabel = 'Arrived';
      } else {
        const speedKmh = Math.max(15, bus.speed_kmh ?? 20);
        const estSec = Math.round(dist / (speedKmh * (1000 / 3600)));
        etaSeconds = estSec;
        etaLabel = estSec <= 60 ? '1 min' : `${Math.round(estSec / 60)} min`;
      }
    } else if (bus.state === 'STALE') {
      etaLabel = 'Delayed';
    } else {
      etaLabel = '--';
    }

    return {
      stopId: stop.id,
      stopName: stop.name,
      sequence: stop.sequence,
      status,
      isTargetStop: isTarget,
      etaLabel,
      etaSeconds,
      distanceMeters: dist,
      badgeTone,
    };
  });

  const completedCount = items.filter((it) => it.status === 'PASSED').length;
  const fractionCompleted = totalStops > 1 ? completedCount / (totalStops - 1) : 0;
  const isTripCompleted = completedCount === totalStops;

  const nextStop = items.find((it) => it.status === 'ARRIVING' || it.status === 'UPCOMING') ?? null;
  const targetItem = items.find((it) => it.isTargetStop) ?? null;

  const summary: RouteProgressSummary = {
    fractionCompleted: Math.min(1.0, Math.max(0.0, fractionCompleted)),
    completedStopsCount: completedCount,
    totalStopsCount: totalStops,
    currentStopIndex: activeStopIdx,
    nextStopName: nextStop ? nextStop.stopName : null,
    nextStopEtaLabel: nextStop ? nextStop.etaLabel : null,
    targetStopName: targetItem ? targetItem.stopName : null,
    targetStopEtaLabel: targetItem ? targetItem.etaLabel : null,
    isTripCompleted,
  };

  return { items, summary };
}
