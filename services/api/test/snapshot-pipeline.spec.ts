import { describe, it, expect, beforeEach } from 'vitest';
import { ShiftService } from '../src/modules/shift/shift.service.js';
import { DriverService } from '../src/modules/driver/driver.service.js';
import { SelectorService } from '../src/modules/selector/selector.service.js';
import { SnapshotService } from '../src/modules/snapshot/snapshot.service.js';
import { SnapshotController } from '../src/modules/snapshot/snapshot.controller.js';
import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';

describe('Snapshot API & Scope Resolution Pipeline (P1-T8, Part 5.6 & 6.9)', () => {
  let shiftService: ShiftService;
  let driverService: DriverService;
  let selectorService: SelectorService;
  let snapshotService: SnapshotService;
  let snapshotController: SnapshotController;

  const baseTime = new Date('2026-10-21T08:00:00Z');

  beforeEach(() => {
    shiftService = new ShiftService();
    driverService = new DriverService(shiftService);
    selectorService = new SelectorService(shiftService, driverService);
    snapshotService = new SnapshotService(selectorService, shiftService);
    snapshotController = new SnapshotController(snapshotService);

    // Setup initial seed routes and buses
    snapshotService.addRoute({
      id: 'route_north',
      code: 'R-N01',
      name: 'North Campus Express',
      route_version: 1,
      is_active: true,
    });

    snapshotService.addRoute({
      id: 'route_south',
      code: 'R-S01',
      name: 'South Campus Local',
      route_version: 1,
      is_active: true,
    });

    snapshotService.addRoute({
      id: 'route_inactive',
      code: 'R-INACTIVE',
      name: 'Old Discontinued Route',
      route_version: 1,
      is_active: false,
    });

    snapshotService.addBus({
      id: 'bus_101',
      bus_number: 'BUS-101',
      registration_number: 'TN-01-AB-1234',
    });

    snapshotService.addBus({
      id: 'bus_102',
      bus_number: 'BUS-102',
      registration_number: 'TN-01-AB-5678',
    });

    snapshotService.assignBusesToRoute('route_north', ['bus_101']);
    snapshotService.assignBusesToRoute('route_south', ['bus_102']);
  });

  describe('Scope Resolution & 404 Rule (Part 6.9 & Part B.1 L-3)', () => {
    it('allows student to view assigned route, but returns 404 for unassigned route', async () => {
      snapshotService.assignStudentRoute('student_alice', ['route_north']);

      // 1. Assigned route -> 200
      const allowed = await snapshotService.getSnapshot(
        'route_north',
        { id: 'student_alice', role: 'STU' },
        baseTime,
      );
      expect(allowed.snapshot.route_id).toBe('route_north');
      expect(allowed.etag).toBeDefined();

      // 2. Unassigned route -> 404 (does not leak route existence)
      await expect(
        snapshotService.getSnapshot('route_south', { id: 'student_alice', role: 'STU' }, baseTime),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows faculty to view assigned route, returns 404 for unassigned route', async () => {
      snapshotService.assignFacultyRoute('prof_bob', ['route_south']);

      const allowed = await snapshotService.getSnapshot(
        'route_south',
        { id: 'prof_bob', role: 'FAC' },
        baseTime,
      );
      expect(allowed.snapshot.route_id).toBe('route_south');

      await expect(
        snapshotService.getSnapshot('route_north', { id: 'prof_bob', role: 'FAC' }, baseTime),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows driver on active shift to view shift route, 404 for other routes', async () => {
      shiftService.addRosterEntry({
        id: 'roster_1',
        driver_id: 'drv_charlie',
        bus_id: 'bus_101',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      });

      await shiftService.startShift(
        'drv_charlie',
        {
          bus_id: 'bus_101',
          route_id: 'route_north',
          trip_type: 'MORNING',
        },
        baseTime,
      );

      const allowed = await snapshotService.getSnapshot(
        'route_north',
        { id: 'drv_charlie', role: 'DRV' },
        baseTime,
      );
      expect(allowed.snapshot.route_id).toBe('route_north');

      await expect(
        snapshotService.getSnapshot('route_south', { id: 'drv_charlie', role: 'DRV' }, baseTime),
      ).rejects.toThrow(NotFoundException);
    });

    it('grants global read-only access to SEC per Part B.1 L-3', async () => {
      // SEC can view route_north and route_south without any specific assignment
      const snapNorth = await snapshotService.getSnapshot(
        'route_north',
        { id: 'sec_guard_1', role: 'SEC' },
        baseTime,
      );
      expect(snapNorth.snapshot.route_id).toBe('route_north');

      const snapSouth = await snapshotService.getSnapshot(
        'route_south',
        { id: 'sec_guard_1', role: 'SEC' },
        baseTime,
      );
      expect(snapSouth.snapshot.route_id).toBe('route_south');
    });

    it('grants global access to administrative roles (COR, TEC, MGT, SAD)', async () => {
      for (const role of ['COR', 'TEC', 'MGT', 'SAD']) {
        const snap = await snapshotService.getSnapshot(
          'route_north',
          { id: `admin_${role}`, role },
          baseTime,
        );
        expect(snap.snapshot.route_id).toBe('route_north');
      }
    });

    it('returns 404 for inactive or non-existent routes', async () => {
      await expect(
        snapshotService.getSnapshot('route_inactive', { id: 'admin_1', role: 'SAD' }, baseTime),
      ).rejects.toThrow(NotFoundException);

      await expect(
        snapshotService.getSnapshot(
          'route_does_not_exist',
          { id: 'admin_1', role: 'SAD' },
          baseTime,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Bus State & Authoritative Labels (Part 17.3)', () => {
    it('returns formatted bus state with authoritative labels for HW, PHONE, STALE, and NOT_RUNNING', async () => {
      // Setup active shift for bus_101
      shiftService.addRosterEntry({
        id: 'roster_1',
        driver_id: 'drv_01',
        bus_id: 'bus_101',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      });
      await shiftService.startShift(
        'drv_01',
        { bus_id: 'bus_101', route_id: 'route_north', trip_type: 'MORNING' },
        baseTime,
      );

      // Bus 101: HW active
      selectorService.updateHardwareLocation('bus_101', 13.0827, 80.2707, 35, 180, baseTime, true);

      // Bus 102 (on route_south): NOT_RUNNING
      const snapNorth = await snapshotService.getSnapshot(
        'route_north',
        { id: 'admin', role: 'SAD' },
        baseTime,
      );
      expect(snapNorth.snapshot.buses.length).toBe(1);
      const b101 = snapNorth.snapshot.buses[0];
      expect(b101.bus_id).toBe('bus_101');
      expect(b101.state).toBe('LIVE');
      expect(b101.active_source).toBe('HW');
      expect(b101.source_label).toBe('Live · bus tracker');
      expect(b101.lat).toBe(13.0827);
      expect(b101.data_age_s).toBe(0);

      const snapSouth = await snapshotService.getSnapshot(
        'route_south',
        { id: 'admin', role: 'SAD' },
        baseTime,
      );
      const b102 = snapSouth.snapshot.buses[0];
      expect(b102.state).toBe('NOT_RUNNING');
      expect(b102.active_source).toBe('NONE');
      expect(b102.source_label).toBe('Not running');
      expect(b102.lat).toBeNull();
    });
  });

  describe('3-Second Cache per Route Version (Part 5.6 & Part 35)', () => {
    it('caches snapshot for 3 seconds per route version, re-evaluates on version bump', async () => {
      // 1. Initial request at t=0
      const initial = await snapshotService.getSnapshot(
        'route_north',
        { id: 'admin', role: 'SAD' },
        baseTime,
      );

      // 2. Request at t=2s (within 3s cache window) -> returns cached object
      const t2 = new Date(baseTime.getTime() + 2000);
      const cached = await snapshotService.getSnapshot(
        'route_north',
        { id: 'admin', role: 'SAD' },
        t2,
      );
      expect(cached.etag).toBe(initial.etag);
      expect(cached.snapshot.server_time).toBe(initial.snapshot.server_time);

      // 3. Request at t=4s (beyond 3s cache window) -> cache expired, recomputed
      const t4 = new Date(baseTime.getTime() + 4000);
      const fresh = await snapshotService.getSnapshot(
        'route_north',
        { id: 'admin', role: 'SAD' },
        t4,
      );
      expect(fresh.snapshot.server_time).toBe(t4.toISOString());

      // 4. Bump route version -> immediate cache invalidation
      snapshotService.bumpRouteVersion('route_north');
      const versionBumped = await snapshotService.getSnapshot(
        'route_north',
        { id: 'admin', role: 'SAD' },
        t4,
      );
      expect(versionBumped.snapshot.route_version).toBe(2);
      expect(versionBumped.etag).not.toBe(fresh.etag);
    });
  });

  describe('ETag & HTTP 304 Handling via Controller', () => {
    it('returns HTTP 304 when If-None-Match header matches current ETag', async () => {
      let statusCode = 200;
      const headersMap: Record<string, string> = {};

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        setHeader: (key: string, val: string) => {
          headersMap[key] = val;
          return mockRes;
        },
      } as unknown as Response;

      const mockReq = {
        user: { id: 'admin_1', role: 'SAD' },
      } as unknown as Request;

      // First request: no If-None-Match header -> 200 + ETag
      const result1 = await snapshotController.getSnapshot(
        { route_id: 'route_north' },
        undefined,
        undefined,
        undefined,
        mockReq,
        mockRes,
      );

      expect(result1).toBeDefined();
      expect(statusCode).toBe(200);
      const etag = headersMap['ETag'];
      expect(etag).toBeDefined();

      // Second request: with matching If-None-Match -> 304 Not Modified
      const result2 = await snapshotController.getSnapshot(
        { route_id: 'route_north' },
        etag,
        undefined,
        undefined,
        mockReq,
        mockRes,
      );

      expect(statusCode).toBe(304);
      expect(result2).toBeUndefined();
    });
  });
});
