import { LatLng } from '@collegebus/domain';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapViewport {
  center: LatLng;
  zoom: number;
  boundingBox: BoundingBox;
}

export interface MapTileProviderConfig {
  providerName: string;
  tileUrlTemplate: string;
  maxZoom: number;
  attribution: string;
}

// Default D-11: MapLibre with OpenStreetMap tiles, switchable tile provider
export const DEFAULT_TILE_PROVIDER: MapTileProviderConfig = {
  providerName: 'OpenStreetMap',
  tileUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
};

/**
 * Computes a camera bounding box encompassing a list of coordinates with padding.
 */
export function calculateBoundingBox(points: LatLng[], paddingFactor: number = 0.15): BoundingBox {
  if (points.length === 0) {
    // Default Bangalore center fallback
    return {
      minLat: 12.95,
      maxLat: 12.99,
      minLng: 77.55,
      maxLng: 77.65,
    };
  }

  let minLat = points[0]!.lat;
  let maxLat = points[0]!.lat;
  let minLng = points[0]!.lng;
  let maxLng = points[0]!.lng;

  for (const pt of points) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  const latSpan = Math.max(0.005, maxLat - minLat);
  const lngSpan = Math.max(0.005, maxLng - minLng);

  return {
    minLat: minLat - latSpan * paddingFactor,
    maxLat: maxLat + latSpan * paddingFactor,
    minLng: minLng - lngSpan * paddingFactor,
    maxLng: maxLng + lngSpan * paddingFactor,
  };
}

/**
 * Computes map viewport center and zoom level from a bounding box.
 */
export function calculateViewportFromBounds(bounds: BoundingBox): MapViewport {
  const center: LatLng = {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };

  const latDiff = bounds.maxLat - bounds.minLat;
  const lngDiff = bounds.maxLng - bounds.minLng;
  const maxDiff = Math.max(latDiff, lngDiff);

  let zoom = 14;
  if (maxDiff > 0.5) zoom = 9;
  else if (maxDiff > 0.2) zoom = 11;
  else if (maxDiff > 0.08) zoom = 12;
  else if (maxDiff > 0.03) zoom = 13;
  else zoom = 14;

  return {
    center,
    zoom,
    boundingBox: bounds,
  };
}
