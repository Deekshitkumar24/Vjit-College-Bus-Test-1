import { describe, it, expect } from 'vitest';
import { RouteManager } from '../src/routes/route-manager.js';

describe('Routes, Stops & Geometry Management (P4-T3, Part 20.8)', () => {
  describe('Stops Library Management', () => {
    it('creates, lists, and updates stops with valid radius and coordinates', () => {
      const manager = new RouteManager();

      const stop1 = manager.createStop({
        name: 'Central Library',
        code: 'ST-01',
        lat: 12.9716,
        lng: 77.5946,
        radius_m: 50,
        landmark: 'Near Fountain',
      });

      expect(stop1.id).toBeDefined();
      expect(stop1.code).toBe('ST-01');
      expect(stop1.radius_m).toBe(50);

      // Rejects duplicate stop code
      expect(() =>
        manager.createStop({
          name: 'Central Library Gate 2',
          code: 'st-01',
          lat: 12.972,
          lng: 77.595,
        }),
      ).toThrowError(/already exists/i);

      // Rejects out of range coordinates
      expect(() =>
        manager.createStop({
          name: 'Invalid Lat Stop',
          code: 'ST-INV',
          lat: 95.0, // > 90
          lng: 77.0,
        }),
      ).toThrowError(/latitude/i);

      // Update stop
      const updated = manager.updateStop(stop1.id, {
        name: 'Central Library Main Gate',
        radius_m: 60,
      });
      expect(updated.name).toBe('Central Library Main Gate');
      expect(updated.radius_m).toBe(60);

      const allStops = manager.listStops();
      expect(allStops).toHaveLength(1);
    });
  });

  describe('Route Definition, Ordered Stops & GeoJSON Geometry (Part 20.8)', () => {
    it('creates a route with ordered stops and validates geometry LineString', () => {
      const manager = new RouteManager();

      const s1 = manager.createStop({ name: 'Stop A', code: 'STA', lat: 13.08, lng: 80.2 });
      const s2 = manager.createStop({ name: 'Stop B', code: 'STB', lat: 13.082, lng: 80.21 });
      const s3 = manager.createStop({ name: 'Stop C', code: 'STC', lat: 13.085, lng: 80.22 });

      // Rejects route with less than 2 stops
      expect(() =>
        manager.createRoute({
          route_code: 'R-01',
          name: 'Route 1',
          trip_type: 'BOTH',
          stops: [{ stop_id: s1.id, sequence_order: 1 }],
        }),
      ).toThrowError(/at least 2 stops/i);

      // Rejects duplicate sequence order
      expect(() =>
        manager.createRoute({
          route_code: 'R-01',
          name: 'Route 1',
          trip_type: 'BOTH',
          stops: [
            { stop_id: s1.id, sequence_order: 1 },
            { stop_id: s2.id, sequence_order: 1 },
          ],
        }),
      ).toThrowError(/duplicate sequence order/i);

      // Rejects invalid GeoJSON LineString with < 2 coordinates
      expect(() =>
        manager.createRoute({
          route_code: 'R-01',
          name: 'Route 1',
          trip_type: 'BOTH',
          stops: [
            { stop_id: s1.id, sequence_order: 1 },
            { stop_id: s2.id, sequence_order: 2 },
          ],
          geometry_geojson: {
            type: 'LineString',
            coordinates: [[80.2, 13.08]], // Only 1 point
          },
        }),
      ).toThrowError(/LineString must have at least 2 coordinate points/i);

      // Valid route creation
      const route = manager.createRoute({
        route_code: 'R-01',
        name: 'South Express',
        trip_type: 'BOTH',
        stops: [
          { stop_id: s1.id, sequence_order: 1, scheduled_arrival_time: '08:00' },
          { stop_id: s2.id, sequence_order: 2, scheduled_arrival_time: '08:15' },
          { stop_id: s3.id, sequence_order: 3, scheduled_arrival_time: '08:30' },
        ],
        geometry_geojson: {
          type: 'LineString',
          coordinates: [
            [80.2, 13.08],
            [80.21, 13.082],
            [80.22, 13.085],
          ],
        },
      });

      expect(route.id).toBeDefined();
      expect(route.route_code).toBe('R-01');
      expect(route.stops).toHaveLength(3);
      expect(route.stops[0]!.sequence_order).toBe(1);
      expect(route.stops[0]!.stop_name).toBe('Stop A');
      expect(route.geometry_geojson?.coordinates).toHaveLength(3);
    });
  });

  describe('Route-Bus Assignment', () => {
    it('assigns bus to route and prevents duplicate simultaneous assignments', () => {
      const manager = new RouteManager();

      const s1 = manager.createStop({ name: 'Start', code: 'S1', lat: 13.0, lng: 80.0 });
      const s2 = manager.createStop({ name: 'End', code: 'S2', lat: 13.1, lng: 80.1 });

      const route1 = manager.createRoute({
        route_code: 'R-1',
        name: 'Route 1',
        stops: [
          { stop_id: s1.id, sequence_order: 1 },
          { stop_id: s2.id, sequence_order: 2 },
        ],
      });

      const route2 = manager.createRoute({
        route_code: 'R-2',
        name: 'Route 2',
        stops: [
          { stop_id: s1.id, sequence_order: 1 },
          { stop_id: s2.id, sequence_order: 2 },
        ],
      });

      manager.assignBusToRoute({ route_id: route1.id, bus_id: 'bus-101' });
      expect(manager.getBusRoute('bus-101')?.id).toBe(route1.id);

      // Reassigning bus to another route moves assignment
      manager.assignBusToRoute({ route_id: route2.id, bus_id: 'bus-101' });
      expect(manager.getBusRoute('bus-101')?.id).toBe(route2.id);

      const r1 = manager.getRoute(route1.id)!;
      const r2 = manager.getRoute(route2.id)!;
      expect(r1.assigned_bus_ids).not.toContain('bus-101');
      expect(r2.assigned_bus_ids).toContain('bus-101');
    });
  });

  describe('Timetables & Holiday Calendar Exceptions', () => {
    it('evaluates service operating days based on timetables and holiday suspensions', () => {
      const manager = new RouteManager();

      const s1 = manager.createStop({ name: 'Start', code: 'S1', lat: 13.0, lng: 80.0 });
      const s2 = manager.createStop({ name: 'End', code: 'S2', lat: 13.1, lng: 80.1 });
      const route = manager.createRoute({
        route_code: 'R-1',
        name: 'Route 1',
        stops: [
          { stop_id: s1.id, sequence_order: 1 },
          { stop_id: s2.id, sequence_order: 2 },
        ],
      });

      // Timetable: operates Monday to Friday (days 1 to 5)
      [1, 2, 3, 4, 5].forEach((day) => {
        manager.addTimetableEntry({
          route_id: route.id,
          trip_type: 'MORNING',
          day_of_week: day,
          departure_time: '07:30',
        });
      });

      // Regular Thursday: 2026-10-22 (day 4) -> operating
      expect(manager.isOperatingDay(route.id, '2026-10-22')).toBe(true);

      // Sunday: 2026-10-25 (day 0) -> not operating
      expect(manager.isOperatingDay(route.id, '2026-10-25')).toBe(false);

      // Add Holiday on Thursday 2026-10-22
      manager.addHoliday({
        date: '2026-10-22',
        name: 'Founder Day Holiday',
        service_suspended: true,
      });

      // Now 2026-10-22 is suspended by holiday exception
      expect(manager.isOperatingDay(route.id, '2026-10-22')).toBe(false);
    });
  });
});
