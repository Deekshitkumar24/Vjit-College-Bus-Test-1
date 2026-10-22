import {
  DriverRosterScheduleDto,
  CreateDriverRosterScheduleDto,
  FacultyBusAssignmentDto,
  CreateFacultyBusAssignmentDto,
  StudentRouteAssignmentDto,
  CreateStudentRouteAssignmentDto,
} from '@collegebus/contracts';
import { RouteManager } from '../routes/route-manager.js';

export class RosterAssignmentManager {
  private driverRosters = new Map<string, DriverRosterScheduleDto>();
  private facultyAssignments = new Map<string, FacultyBusAssignmentDto>();
  private studentAssignments = new Map<string, StudentRouteAssignmentDto>();

  constructor(private readonly routeManager?: RouteManager) {}

  // ==========================================
  // Driver Roster Scheduling
  // ==========================================
  scheduleDriver(dto: CreateDriverRosterScheduleDto): DriverRosterScheduleDto {
    const fromMs = new Date(dto.valid_from).getTime();
    const toMs = dto.valid_to ? new Date(dto.valid_to).getTime() : Infinity;

    if (toMs <= fromMs) {
      throw new Error('valid_to must be after valid_from');
    }

    // Check for overlapping schedule for the same driver or same bus
    for (const r of this.driverRosters.values()) {
      const rFromMs = new Date(r.valid_from).getTime();
      const rToMs = r.valid_to ? new Date(r.valid_to).getTime() : Infinity;
      const overlaps = fromMs < rToMs && toMs > rFromMs;

      if (overlaps) {
        if (r.driver_id === dto.driver_id) {
          throw new Error(
            `Driver ${dto.driver_id} already has an active roster schedule (${r.bus_id}) in this time window`,
          );
        }
        if (r.bus_id === dto.bus_id) {
          throw new Error(
            `Bus ${dto.bus_id} is already assigned to driver ${r.driver_id} in this time window`,
          );
        }
      }
    }

    const id = `roster-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newEntry: DriverRosterScheduleDto = {
      id,
      driver_id: dto.driver_id,
      bus_id: dto.bus_id,
      valid_from: dto.valid_from,
      valid_to: dto.valid_to ?? null,
      recurrence: dto.recurrence ?? 'DAILY',
    };

    this.driverRosters.set(id, newEntry);
    return { ...newEntry };
  }

  getActiveRosterForDriver(
    driverId: string,
    now: Date = new Date(),
  ): DriverRosterScheduleDto | undefined {
    const nowMs = now.getTime();
    for (const r of this.driverRosters.values()) {
      if (r.driver_id === driverId) {
        const fromMs = new Date(r.valid_from).getTime();
        const toMs = r.valid_to ? new Date(r.valid_to).getTime() : Infinity;
        if (nowMs >= fromMs && nowMs <= toMs) {
          return { ...r };
        }
      }
    }
    return undefined;
  }

  listDriverRosters(): DriverRosterScheduleDto[] {
    return Array.from(this.driverRosters.values()).map((r) => ({ ...r }));
  }

  // ==========================================
  // Faculty Bus Oversight Assignments
  // ==========================================
  assignFaculty(dto: CreateFacultyBusAssignmentDto): FacultyBusAssignmentDto {
    const id = `fac-assign-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const assignment: FacultyBusAssignmentDto = {
      id,
      faculty_id: dto.faculty_id,
      bus_id: dto.bus_id,
      assigned_at: new Date().toISOString(),
      is_active: true,
    };

    this.facultyAssignments.set(id, assignment);
    return { ...assignment };
  }

  deactivateFacultyAssignment(assignmentId: string): void {
    const assignment = this.facultyAssignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Faculty assignment ${assignmentId} not found`);
    }
    assignment.is_active = false;
  }

  getFacultyForBus(busId: string): FacultyBusAssignmentDto[] {
    return Array.from(this.facultyAssignments.values())
      .filter((a) => a.bus_id === busId && a.is_active)
      .map((a) => ({ ...a }));
  }

  // ==========================================
  // Student Route & Stop Allocations
  // ==========================================
  assignStudent(dto: CreateStudentRouteAssignmentDto): StudentRouteAssignmentDto {
    if (this.routeManager) {
      const route = this.routeManager.getRoute(dto.route_id);
      if (!route) {
        throw new Error(`Route ${dto.route_id} not found`);
      }

      const hasMorningStop = route.stops.some((s) => s.stop_id === dto.morning_stop_id);
      if (!hasMorningStop) {
        throw new Error(`Morning stop ${dto.morning_stop_id} is not part of route ${dto.route_id}`);
      }

      const hasAfternoonStop = route.stops.some((s) => s.stop_id === dto.afternoon_stop_id);
      if (!hasAfternoonStop) {
        throw new Error(
          `Afternoon stop ${dto.afternoon_stop_id} is not part of route ${dto.route_id}`,
        );
      }
    }

    const id = `stu-assign-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const assignment: StudentRouteAssignmentDto = {
      id,
      student_id: dto.student_id,
      route_id: dto.route_id,
      morning_stop_id: dto.morning_stop_id,
      afternoon_stop_id: dto.afternoon_stop_id,
      assigned_at: new Date().toISOString(),
      is_active: true,
    };

    this.studentAssignments.set(dto.student_id, assignment);
    return { ...assignment };
  }

  getStudentRoute(studentId: string): StudentRouteAssignmentDto | undefined {
    const assignment = this.studentAssignments.get(studentId);
    return assignment && assignment.is_active ? { ...assignment } : undefined;
  }
}
