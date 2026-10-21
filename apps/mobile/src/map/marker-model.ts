import { BusSnapshot } from '@collegebus/contracts';
import { LatLng } from '@collegebus/domain';
import { resolveSourceBadge, SourceBadgeViewModel } from './source-badge.js';

export interface BusMarkerViewModel {
  busId: string;
  busNumber: string;
  coordinate: LatLng | null;
  headingDeg: number;
  rotationTransform: string;
  speedText: string;
  isMoving: boolean;
  badge: SourceBadgeViewModel;
}

export function buildBusMarkerViewModel(bus: BusSnapshot): BusMarkerViewModel {
  const coord: LatLng | null =
    bus.lat !== null && bus.lng !== null ? { lat: bus.lat, lng: bus.lng } : null;

  const heading = bus.heading_deg !== null ? Math.round(bus.heading_deg) % 360 : 0;
  const speed = bus.speed_kmh ?? 0;
  const isMoving = speed > 3 && bus.state === 'LIVE';

  const speedText =
    bus.state !== 'LIVE' ? 'Offline' : isMoving ? `${Math.round(speed)} km/h` : 'Stopped';

  const badge = resolveSourceBadge(bus);

  return {
    busId: bus.bus_id,
    busNumber: bus.bus_number,
    coordinate: coord,
    headingDeg: heading,
    rotationTransform: `rotate(${heading}deg)`,
    speedText,
    isMoving,
    badge,
  };
}
