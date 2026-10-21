import { LatLng } from '@collegebus/domain';

export interface RouteDefinition {
  routeId: string;
  routeName: string;
  waypoints: LatLng[];
  stops: { name: string; location: LatLng; orderIndex: number }[];
}

export const SYNTHETIC_CORRIDORS: RouteDefinition[] = [
  {
    routeId: 'route_901',
    routeName: 'South Campus Express (Route 901)',
    waypoints: [
      { lat: 12.9716, lng: 77.5946 }, // Majestic
      { lat: 12.9602, lng: 77.5855 }, // Lalbagh
      { lat: 12.9352, lng: 77.5838 }, // Jayanagar 4th Block
      { lat: 12.9166, lng: 77.5996 }, // BTM Layout
      { lat: 12.9172, lng: 77.6228 }, // Silk Board
      { lat: 12.8452, lng: 77.6602 }, // Electronic City Phase 1 (Campus)
    ],
    stops: [
      { name: 'Majestic Terminal', location: { lat: 12.9716, lng: 77.5946 }, orderIndex: 1 },
      { name: 'Lalbagh Main Gate', location: { lat: 12.9602, lng: 77.5855 }, orderIndex: 2 },
      { name: 'Jayanagar 4th Block', location: { lat: 12.9352, lng: 77.5838 }, orderIndex: 3 },
      { name: 'BTM Water Tank', location: { lat: 12.9166, lng: 77.5996 }, orderIndex: 4 },
      { name: 'Silk Board Junction', location: { lat: 12.9172, lng: 77.6228 }, orderIndex: 5 },
      { name: 'College South Gate', location: { lat: 12.8452, lng: 77.6602 }, orderIndex: 6 },
    ],
  },
  {
    routeId: 'route_902',
    routeName: 'North Ring Road Express (Route 902)',
    waypoints: [
      { lat: 12.9854, lng: 77.5539 }, // Rajajinagar
      { lat: 13.0118, lng: 77.5552 }, // Yeshwanthpur
      { lat: 13.0358, lng: 77.597 }, // Hebbal
      { lat: 13.0285, lng: 77.6402 }, // Kalyan Nagar
      { lat: 12.9982, lng: 77.6744 }, // KR Puram
    ],
    stops: [
      { name: 'Rajajinagar Metro', location: { lat: 12.9854, lng: 77.5539 }, orderIndex: 1 },
      { name: 'Yeshwanthpur Circle', location: { lat: 13.0118, lng: 77.5552 }, orderIndex: 2 },
      { name: 'Hebbal Flyover', location: { lat: 13.0358, lng: 77.597 }, orderIndex: 3 },
      { name: 'Kalyan Nagar Ring Road', location: { lat: 13.0285, lng: 77.6402 }, orderIndex: 4 },
      { name: 'College North Terminal', location: { lat: 12.9982, lng: 77.6744 }, orderIndex: 5 },
    ],
  },
  {
    routeId: 'route_903',
    routeName: 'East City Flyer (Route 903)',
    waypoints: [
      { lat: 12.9784, lng: 77.6408 }, // Indiranagar 100ft Rd
      { lat: 12.9592, lng: 77.6974 }, // Marathahalli
      { lat: 12.9698, lng: 77.7499 }, // Whitefield
    ],
    stops: [
      { name: 'Indiranagar Metro', location: { lat: 12.9784, lng: 77.6408 }, orderIndex: 1 },
      { name: 'Marathahalli Bridge', location: { lat: 12.9592, lng: 77.6974 }, orderIndex: 2 },
      { name: 'Whitefield Campus Gate', location: { lat: 12.9698, lng: 77.7499 }, orderIndex: 3 },
    ],
  },
];
