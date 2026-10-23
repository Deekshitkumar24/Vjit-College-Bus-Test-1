import {
  StopDto,
  CreateStopDto,
  UpdateStopDto,
  CreateRouteDto,
  UpdateRouteDto,
  RouteResponseDto,
  AssignBusToRouteDto,
  TimetableEntryDto,
  HolidayExceptionDto,
  GeoJsonLineString,
} from '@collegebus/contracts';

export class RouteManager {
  private stops = new Map<string, StopDto>();
  private routes = new Map<string, RouteResponseDto>();
  private busRouteAssignments = new Map<string, string>(); // busId -> routeId
  private timetables: TimetableEntryDto[] = [];
  private holidays = new Map<string, HolidayExceptionDto>(); // date YYYY-MM-DD -> holiday

  constructor() {}

  // ==========================================
  // Stops Library Management
  // ==========================================
  createStop(dto: CreateStopDto): StopDto {
    if (dto.lat < -90 || dto.lat > 90) {
      throw new Error('Latitude must be between -90 and 90 degrees');
    }
    if (dto.lng < -180 || dto.lng > 180) {
      throw new Error('Longitude must be between -180 and 180 degrees');
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    for (const stop of this.stops.values()) {
      if (stop.code.toUpperCase() === normalizedCode) {
        throw new Error(`Stop with code ${dto.code} already exists`);
      }
    }

    const id = `stop-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newStop: StopDto = {
      id,
      name: dto.name.trim(),
      code: normalizedCode,
      lat: dto.lat,
      lng: dto.lng,
      radius_m: dto.radius_m ?? 50,
      landmark: dto.landmark ? dto.landmark.trim() : null,
    };

    this.stops.set(id, newStop);
    return { ...newStop };
  }

  updateStop(id: string, dto: UpdateStopDto): StopDto {
    const stop = this.stops.get(id);
    if (!stop) {
      throw new Error(`Stop with ID ${id} not found`);
    }

    if (dto.lat !== undefined && (dto.lat < -90 || dto.lat > 90)) {
      throw new Error('Latitude must be between -90 and 90 degrees');
    }
    if (dto.lng !== undefined && (dto.lng < -180 || dto.lng > 180)) {
      throw new Error('Longitude must be between -180 and 180 degrees');
    }

    if (dto.code) {
      const normalizedCode = dto.code.trim().toUpperCase();
      for (const s of this.stops.values()) {
        if (s.id !== id && s.code.toUpperCase() === normalizedCode) {
          throw new Error(`Stop with code ${dto.code} already exists`);
        }
      }
      stop.code = normalizedCode;
    }

    if (dto.name) stop.name = dto.name.trim();
    if (dto.lat !== undefined) stop.lat = dto.lat;
    if (dto.lng !== undefined) stop.lng = dto.lng;
    if (dto.radius_m !== undefined) stop.radius_m = dto.radius_m;
    if (dto.landmark !== undefined) stop.landmark = dto.landmark ? dto.landmark.trim() : null;

    return { ...stop };
  }

  deleteStop(id: string): void {
    if (!this.stops.has(id)) {
      throw new Error(`Stop with ID ${id} not found`);
    }
    this.stops.delete(id);
  }

  getStop(id: string): StopDto | undefined {
    const stop = this.stops.get(id);
    return stop ? { ...stop } : undefined;
  }

  listStops(): StopDto[] {
    return Array.from(this.stops.values()).map((s) => ({ ...s }));
  }

  // ==========================================
  // Route Definition & Geometry Management
  // ==========================================
  createRoute(dto: CreateRouteDto): RouteResponseDto {
    if (!dto.stops || dto.stops.length < 2) {
      throw new Error('Route definition requires at least 2 stops');
    }

    // Validate duplicate stop sequence orders
    const seqOrders = new Set<number>();
    for (const s of dto.stops) {
      if (seqOrders.has(s.sequence_order)) {
        throw new Error(`Duplicate sequence order ${s.sequence_order} found in route stops`);
      }
      seqOrders.add(s.sequence_order);
    }

    // Validate GeoJSON LineString coordinates
    if (dto.geometry_geojson) {
      this.validateGeoJson(dto.geometry_geojson);
    }

    const id = `route-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const routeStops = [...dto.stops]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((s) => {
        const stopDetail = this.stops.get(s.stop_id);
        return {
          stop_id: s.stop_id,
          stop_name: stopDetail?.name || `Stop ${s.stop_id}`,
          sequence_order: s.sequence_order,
          lat: stopDetail?.lat ?? 0,
          lng: stopDetail?.lng ?? 0,
          radius_m: stopDetail?.radius_m ?? 50,
          scheduled_arrival_time: s.scheduled_arrival_time,
        };
      });

    const route: RouteResponseDto = {
      id,
      route_code: dto.route_code.trim().toUpperCase(),
      name: dto.name.trim(),
      trip_type: dto.trip_type ?? 'BOTH',
      stops: routeStops,
      geometry_geojson: dto.geometry_geojson ?? null,
      assigned_bus_ids: [],
      is_active: dto.is_active ?? true,
      created_at: now,
      updated_at: now,
    };

    this.routes.set(id, route);
    return { ...route };
  }

  updateRoute(id: string, dto: UpdateRouteDto): RouteResponseDto {
    const route = this.routes.get(id);
    if (!route) {
      throw new Error(`Route with ID ${id} not found`);
    }

    if (dto.stops) {
      if (dto.stops.length < 2) {
        throw new Error('Route definition requires at least 2 stops');
      }
      const seqOrders = new Set<number>();
      for (const s of dto.stops) {
        if (seqOrders.has(s.sequence_order)) {
          throw new Error(`Duplicate sequence order ${s.sequence_order} found in route stops`);
        }
        seqOrders.add(s.sequence_order);
      }
      route.stops = [...dto.stops]
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .map((s) => {
          const stopDetail = this.stops.get(s.stop_id);
          return {
            stop_id: s.stop_id,
            stop_name: stopDetail?.name || `Stop ${s.stop_id}`,
            sequence_order: s.sequence_order,
            lat: stopDetail?.lat ?? 0,
            lng: stopDetail?.lng ?? 0,
            radius_m: stopDetail?.radius_m ?? 50,
            scheduled_arrival_time: s.scheduled_arrival_time,
          };
        });
    }

    if (dto.geometry_geojson) {
      this.validateGeoJson(dto.geometry_geojson);
      route.geometry_geojson = dto.geometry_geojson;
    }

    if (dto.route_code) route.route_code = dto.route_code.trim().toUpperCase();
    if (dto.name) route.name = dto.name.trim();
    if (dto.trip_type) route.trip_type = dto.trip_type;
    if (dto.is_active !== undefined) route.is_active = dto.is_active;

    route.updated_at = new Date().toISOString();
    return { ...route };
  }

  getRoute(id: string): RouteResponseDto | undefined {
    const route = this.routes.get(id);
    return route ? { ...route } : undefined;
  }

  listRoutes(filter?: { is_active?: boolean }): RouteResponseDto[] {
    let list = Array.from(this.routes.values());
    if (filter?.is_active !== undefined) {
      list = list.filter((r) => r.is_active === filter.is_active);
    }
    return list.map((r) => ({ ...r }));
  }

  private validateGeoJson(geo: GeoJsonLineString) {
    if (geo.type !== 'LineString') {
      throw new Error('Geometry type must be LineString');
    }
    if (!geo.coordinates || geo.coordinates.length < 2) {
      throw new Error('GeoJSON LineString must have at least 2 coordinate points');
    }
    for (const [lng, lat] of geo.coordinates) {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error(`Invalid coordinate [${lng}, ${lat}] in GeoJSON LineString`);
      }
    }
  }

  // ==========================================
  // Route-Bus Assignment
  // ==========================================
  assignBusToRoute(dto: AssignBusToRouteDto): void {
    const route = this.routes.get(dto.route_id);
    if (!route) {
      throw new Error(`Route ${dto.route_id} not found`);
    }

    // If bus was assigned to a different route, remove it
    const prevRouteId = this.busRouteAssignments.get(dto.bus_id);
    if (prevRouteId && prevRouteId !== dto.route_id) {
      const prevRoute = this.routes.get(prevRouteId);
      if (prevRoute) {
        prevRoute.assigned_bus_ids = prevRoute.assigned_bus_ids.filter((id) => id !== dto.bus_id);
      }
    }

    if (!route.assigned_bus_ids.includes(dto.bus_id)) {
      route.assigned_bus_ids.push(dto.bus_id);
    }
    this.busRouteAssignments.set(dto.bus_id, dto.route_id);
  }

  getBusRoute(busId: string): RouteResponseDto | undefined {
    const routeId = this.busRouteAssignments.get(busId);
    if (!routeId) return undefined;
    return this.getRoute(routeId);
  }

  // ==========================================
  // Timetables & Holiday Exceptions
  // ==========================================
  addTimetableEntry(dto: TimetableEntryDto): void {
    this.timetables.push({ ...dto });
  }

  getTimetableForRoute(routeId: string): TimetableEntryDto[] {
    return this.timetables.filter((t) => t.route_id === routeId);
  }

  addHoliday(dto: HolidayExceptionDto): void {
    this.holidays.set(dto.date, { ...dto });
  }

  getHolidays(): HolidayExceptionDto[] {
    return Array.from(this.holidays.values());
  }

  isOperatingDay(routeId: string, dateStr: string): boolean {
    // 1. Holiday check
    const holiday = this.holidays.get(dateStr);
    if (holiday && holiday.service_suspended) {
      if (holiday.operating_route_ids && holiday.operating_route_ids.includes(routeId)) {
        return true;
      }
      return false;
    }

    // 2. Day of week check against timetable
    const date = new Date(dateStr);
    const dayOfWeek = date.getUTCDay(); // 0: Sun, 1: Mon...

    const entries = this.timetables.filter(
      (t) => t.route_id === routeId && t.day_of_week === dayOfWeek,
    );
    return entries.length > 0;
  }
}
