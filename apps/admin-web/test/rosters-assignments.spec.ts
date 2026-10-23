import { describe, it, expect, beforeEach } from 'vitest';
import { RosterAssignmentManager } from '../src/rosters/roster-assignment-manager.js';
import { RouteManager } from '../src/routes/route-manager.js';

describe('Rosters, Faculty & Student Route Assignments (P4-T4)', () => {
  let rosterManager: RosterAssignmentManager;
  let routeManager: RouteManager;
  let route1Id: string;
  let stop1Id: string;
  let stop2Id: string;

  beforeEach(() => {
    routeManager = new RouteManager();
    rosterManager = new RosterAssignmentManager(routeManager);

    const s1 = routeManager.createStop({ name: 'North Gate', code: 'NG', lat: 13.0, lng: 80.0 });
    const s2 = routeManager.createStop({ name: 'Campus Circle', code: 'CC', lat: 13.1, lng: 80.1 });
    stop1Id = s1.id;
    stop2Id = s2.id;

    const r1 = routeManager.createRoute({
      route_code: 'R-NORTH',
      name: 'North Express',
      stops: [
        { stop_id: s1.id, sequence_order: 1 },
        { stop_id: s2.id, sequence_order: 2 },
      ],
    });
    route1Id = r1.id;
  });

  describe('Driver Roster Scheduling & Conflict Prevention', () => {
    it('schedules driver to bus and prevents overlapping conflicting assignments', () => {
      const from = new Date('2026-10-01T00:00:00Z').toISOString();
      const to = new Date('2026-10-31T23:59:59Z').toISOString();

      const entry = rosterManager.scheduleDriver({
        driver_id: 'drv_01',
        bus_id: 'bus_10',
        valid_from: from,
        valid_to: to,
        recurrence: 'DAILY',
      });

      expect(entry.id).toBeDefined();
      expect(entry.driver_id).toBe('drv_01');

      // Attempt overlapping schedule for same driver on different bus
      expect(() =>
        rosterManager.scheduleDriver({
          driver_id: 'drv_01',
          bus_id: 'bus_20',
          recurrence: 'DAILY',
          valid_from: new Date('2026-10-15T00:00:00Z').toISOString(),
          valid_to: new Date('2026-11-15T00:00:00Z').toISOString(),
        }),
      ).toThrowError(/Driver drv_01 already has an active roster/i);

      // Attempt overlapping schedule for same bus with different driver
      expect(() =>
        rosterManager.scheduleDriver({
          driver_id: 'drv_02',
          bus_id: 'bus_10',
          recurrence: 'DAILY',
          valid_from: new Date('2026-10-15T00:00:00Z').toISOString(),
          valid_to: new Date('2026-10-20T00:00:00Z').toISOString(),
        }),
      ).toThrowError(/Bus bus_10 is already assigned/i);

      // Active roster lookup
      const active = rosterManager.getActiveRosterForDriver('drv_01', new Date('2026-10-20T12:00:00Z'));
      expect(active?.bus_id).toBe('bus_10');

      // Past date lookup returns undefined
      const past = rosterManager.getActiveRosterForDriver('drv_01', new Date('2026-09-01T00:00:00Z'));
      expect(past).toBeUndefined();
    });
  });

  describe('Faculty Bus Oversight Assignments', () => {
    it('assigns faculty to bus and manages active oversight', () => {
      const assignment = rosterManager.assignFaculty({
        faculty_id: 'fac_prof_sharma',
        bus_id: 'bus_10',
      });

      expect(assignment.id).toBeDefined();
      expect(assignment.faculty_id).toBe('fac_prof_sharma');
      expect(assignment.is_active).toBe(true);

      const facultyList = rosterManager.getFacultyForBus('bus_10');
      expect(facultyList).toHaveLength(1);
      expect(facultyList[0]!.faculty_id).toBe('fac_prof_sharma');

      // Deactivate assignment
      rosterManager.deactivateFacultyAssignment(assignment.id);
      expect(rosterManager.getFacultyForBus('bus_10')).toHaveLength(0);
    });
  });

  describe('Student Route & Stop Allocations', () => {
    it('allocates student to route and validates stops belong to route', () => {
      // Valid allocation
      const allocation = rosterManager.assignStudent({
        student_id: 'stu_201',
        route_id: route1Id,
        morning_stop_id: stop1Id,
        afternoon_stop_id: stop2Id,
      });

      expect(allocation.student_id).toBe('stu_201');
      expect(allocation.route_id).toBe(route1Id);
      expect(allocation.is_active).toBe(true);

      const studentRoute = rosterManager.getStudentRoute('stu_201');
      expect(studentRoute?.morning_stop_id).toBe(stop1Id);
      expect(studentRoute?.afternoon_stop_id).toBe(stop2Id);

      // Rejects allocation if morning stop is not part of route
      expect(() =>
        rosterManager.assignStudent({
          student_id: 'stu_202',
          route_id: route1Id,
          morning_stop_id: 'non_existent_stop',
          afternoon_stop_id: stop2Id,
        }),
      ).toThrowError(/Morning stop.*is not part of route/i);

      // Rejects allocation if afternoon stop is not part of route
      expect(() =>
        rosterManager.assignStudent({
          student_id: 'stu_203',
          route_id: route1Id,
          morning_stop_id: stop1Id,
          afternoon_stop_id: 'non_existent_stop',
        }),
      ).toThrowError(/Afternoon stop.*is not part of route/i);
    });
  });
});
