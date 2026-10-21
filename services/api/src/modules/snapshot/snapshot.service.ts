import { Injectable, NotFoundException } from '@nestjs/common';
import {
  formatSourceBadgeLabel,
  resolveUserRouteScope,
  computeDataAgeSeconds,
  generateSnapshotEtag,
} from '@collegebus/domain';
import { SnapshotResponseDto, BusSnapshot } from '@collegebus/contracts';
import { SelectorService } from '../selector/selector.service.js';
import { ShiftService } from '../shift/shift.service.js';
import { createHash } from 'node:crypto';

export interface RouteRecord {
  id: string;
  code: string;
  name: string;
  route_version: number;
  is_active: boolean;
}

export interface BusRecord {
  id: string;
  bus_number: string;
  registration_number: string;
}

interface CacheEntry {
  snapshot: SnapshotResponseDto;
  etag: string;
  cachedAtMs: number;
}

@Injectable()
export class SnapshotService {
  constructor(
    private readonly selectorService: SelectorService,
    private readonly shiftService: ShiftService,
  ) {}

  private routes = new Map<string, RouteRecord>();
  private buses = new Map<string, BusRecord>();
  private routeBusAssignments = new Map<string, string[]>(); // routeId -> busIds[]
  private studentRoutes = new Map<string, string[]>(); // userId -> routeIds[]
  private facultyRoutes = new Map<string, string[]>(); // userId -> routeIds[]
  private cache = new Map<string, CacheEntry>(); // `${routeId}:v${version}` -> CacheEntry

  // Configuration: 3-second cache per route version (Part 5.6 & Part 35 snapshot.cache_s)
  private readonly cacheTtlMs = 3000;

  addRoute(route: RouteRecord) {
    this.routes.set(route.id, route);
  }

  addBus(bus: BusRecord) {
    this.buses.set(bus.id, bus);
  }

  assignBusesToRoute(routeId: string, busIds: string[]) {
    this.routeBusAssignments.set(routeId, busIds);
  }

  assignStudentRoute(userId: string, routeIds: string[]) {
    this.studentRoutes.set(userId, routeIds);
  }

  assignFacultyRoute(userId: string, routeIds: string[]) {
    this.facultyRoutes.set(userId, routeIds);
  }

  bumpRouteVersion(routeId: string): number {
    const route = this.routes.get(routeId);
    if (route) {
      route.route_version += 1;
      return route.route_version;
    }
    return 1;
  }

  clear() {
    this.routes.clear();
    this.buses.clear();
    this.routeBusAssignments.clear();
    this.studentRoutes.clear();
    this.facultyRoutes.clear();
    this.cache.clear();
  }

  /**
   * Retrieves route snapshot with scope resolution, 404 rule, and 3-second caching (Part 5.6 & 6.9).
   */
  async getSnapshot(
    routeId: string,
    caller: { id: string; role: string },
    now: Date = new Date(),
  ): Promise<{ snapshot: SnapshotResponseDto; etag: string }> {
    const route = this.routes.get(routeId);

    // If route does not exist or inactive -> 404
    if (!route || !route.is_active) {
      throw new NotFoundException({
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found or unavailable',
      });
    }

    // Resolve caller scope (Part 6.9 & Part B.1 L-3)
    let driverRouteIds: string[] | undefined;
    if (caller.role === 'DRV') {
      const activeShift = this.shiftService.getActiveShiftForDriver(caller.id);
      if (activeShift && activeShift.route_id) {
        driverRouteIds = [activeShift.route_id];
      }
    }

    const scopeCheck = resolveUserRouteScope({
      role: caller.role,
      routeId,
      studentRouteIds: this.studentRoutes.get(caller.id),
      facultyRouteIds: this.facultyRoutes.get(caller.id),
      driverRouteIds,
    });

    // 404 rule: unassigned or out-of-scope routes return 404
    if (!scopeCheck.allowed) {
      throw new NotFoundException({
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found or unavailable',
      });
    }

    // Check 3-second cache per route version
    const cacheKey = `${routeId}:v${route.route_version}`;
    const nowMs = now.getTime();
    const cached = this.cache.get(cacheKey);

    if (cached && nowMs - cached.cachedAtMs < this.cacheTtlMs) {
      return {
        snapshot: cached.snapshot,
        etag: cached.etag,
      };
    }

    // Compute fresh snapshot
    const assignedBusIds = this.routeBusAssignments.get(routeId) || [];
    const busSnapshots: BusSnapshot[] = [];

    for (const busId of assignedBusIds) {
      const bus = this.buses.get(busId);
      const busNumber = bus ? bus.bus_number : busId;
      const stateRecord = this.selectorService.getBusState(busId);
      const activeShift = this.shiftService.getActiveShiftForBus(busId);

      const state = stateRecord ? stateRecord.state : 'NOT_RUNNING';
      const activeSource = stateRecord ? stateRecord.active_source : 'NONE';
      const dataAgeSeconds = computeDataAgeSeconds(stateRecord?.source_updated_at, now);

      const sourceLabel = formatSourceBadgeLabel({
        state,
        active_source: activeSource,
        data_age_s: dataAgeSeconds,
        last_seen_at: stateRecord?.source_updated_at,
      });

      // Sample ETA calculation placeholder (domain ETA calculation refined in P1-T9)
      let etaSeconds: number | null = null;
      let etaLabel: string | null = null;

      if (state === 'LIVE' && stateRecord && stateRecord.speed_kmh !== null) {
        // Sample baseline ETA
        etaSeconds = 300; // 5 min
        etaLabel = '5 mins';
      }

      busSnapshots.push({
        bus_id: busId,
        bus_number: busNumber,
        trip_id: activeShift ? activeShift.trip_id : null,
        state,
        active_source: activeSource,
        source_label: sourceLabel,
        lat: stateRecord ? stateRecord.lat : null,
        lng: stateRecord ? stateRecord.lng : null,
        speed_kmh: stateRecord ? stateRecord.speed_kmh : null,
        heading_deg: stateRecord ? stateRecord.heading_deg : null,
        data_age_s: dataAgeSeconds,
        eta_seconds: etaSeconds,
        eta_label: etaLabel,
        updated_at: stateRecord ? stateRecord.updated_at.toISOString() : now.toISOString(),
      });
    }

    const snapshot: SnapshotResponseDto = {
      route_id: routeId,
      route_version: route.route_version,
      server_time: now.toISOString(),
      buses: busSnapshots,
    };

    // Calculate deterministic ETag
    const contentPayload = JSON.stringify({
      route_id: routeId,
      route_version: route.route_version,
      buses: busSnapshots,
    });
    const hash = createHash('sha256').update(contentPayload).digest('hex').substring(0, 16);
    const etag = generateSnapshotEtag(routeId, route.route_version, hash);

    // Save in cache
    this.cache.set(cacheKey, {
      snapshot,
      etag,
      cachedAtMs: nowMs,
    });

    return { snapshot, etag };
  }
}
