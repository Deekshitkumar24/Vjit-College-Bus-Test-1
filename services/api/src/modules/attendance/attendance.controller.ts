import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { GlobalAuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

interface AuthenticatedAttendanceRequest {
  user: {
    id: string;
    role?: string;
  };
  prisma?: {
    trip?: { findUnique: (args: unknown) => Promise<unknown> };
    shift?: { findFirst: (args: unknown) => Promise<unknown> };
    studentRoute?: { findFirst: (args: unknown) => Promise<unknown> };
    attendanceRecord?: {
      findFirst: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
      upsert: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
    auditLog?: { create: (args: unknown) => Promise<unknown> };
  };
}

@Controller('attendance')
@UseGuards(GlobalAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('trips/:id/qr')
  @Roles('DRV', 'COR', 'SAD')
  async getTripQr(@Param('id') tripId: string, @Req() req: AuthenticatedAttendanceRequest) {
    const driverId = req.user.id;
    return this.attendanceService.getTripQr({
      tripId,
      driverId,
      getTrip: async (id) =>
        req.prisma?.trip?.findUnique({ where: { id }, include: { bus: true } }) as Promise<{
          bus?: { id?: string; bus_number?: string };
        }>,
      getActiveShift: async (drvId) =>
        req.prisma?.shift?.findFirst({ where: { driver_id: drvId, status: 'ACTIVE' } }) as Promise<{
          id: string;
        }>,
    });
  }

  @Post('scan')
  @Roles('STU')
  async scanQr(
    @Body() body: { qr_token: string; client_timestamp?: string },
    @Req() req: AuthenticatedAttendanceRequest,
  ) {
    const studentId = req.user.id;
    const scanTime = body.client_timestamp ? new Date(body.client_timestamp).getTime() : Date.now();

    const result = await this.attendanceService.processScan({
      studentId,
      token: body.qr_token,
      scanTime,
      getTrip: async (id) =>
        req.prisma?.trip?.findUnique({ where: { id }, include: { bus: true } }),
      getStudentAssignment: async (stuId, routeId, tripType) =>
        req.prisma?.studentRoute?.findFirst({
          where: { student_id: stuId, route_id: routeId, trip_type: tripType },
        }),
      getExistingAttendance: async (tId, stuId) =>
        req.prisma?.attendanceRecord?.findUnique({
          where: { trip_id_student_id: { trip_id: tId, student_id: stuId } },
        }),
      saveAttendance: async (record) =>
        req.prisma?.attendanceRecord?.upsert({
          where: {
            trip_id_student_id: { trip_id: record.tripId, student_id: record.studentId },
          },
          create: {
            trip_id: record.tripId,
            student_id: record.studentId,
            status: record.status,
            method: record.method,
            boarding_stop_id: record.boardingStopId,
            boarded_at: record.boardedAt,
          },
          update: {
            status: record.status,
            method: record.method,
            boarding_stop_id: record.boardingStopId,
            boarded_at: record.boardedAt,
          },
        }),
    });

    if (!result.success) {
      if (result.error === 'RATE_LIMIT_EXCEEDED') {
        throw new HttpException(
          { error: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded: max 10 scans per minute' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        { error: result.error, message: `Scan rejected: ${result.error}` },
        HttpStatus.BAD_REQUEST,
      );
    }

    return result;
  }

  @Post('manual')
  @Roles('DRV', 'COR', 'SAD')
  async manualCheckIn(
    @Body()
    body: {
      trip_id: string;
      student_id: string;
      reason?: string;
      is_guest?: boolean;
    },
    @Req() req: AuthenticatedAttendanceRequest,
  ) {
    const driverId = req.user.id;
    return this.attendanceService.manualCheckIn({
      tripId: body.trip_id,
      studentId: body.student_id,
      driverId,
      reason: body.reason,
      isGuest: body.is_guest,
      saveRecord: async (rec) =>
        req.prisma?.attendanceRecord?.upsert({
          where: {
            trip_id_student_id: { trip_id: rec.trip_id, student_id: rec.student_id },
          },
          create: rec,
          update: rec,
        }),
    });
  }

  @Post('corrections/:id')
  @Roles('COR', 'SAD')
  async correctAttendance(
    @Param('id') attendanceId: string,
    @Body() body: { status: string; reason: string },
    @Req() req: AuthenticatedAttendanceRequest,
  ) {
    const coordinatorId = req.user.id;
    return this.attendanceService.coordinatorCorrection({
      attendanceId,
      newStatus: body.status,
      coordinatorId,
      reason: body.reason,
      saveRecord: async (upd) =>
        req.prisma?.attendanceRecord?.update({
          where: { id: attendanceId },
          data: upd,
        }),
      logAudit: async (audit) =>
        req.prisma?.auditLog?.create({
          data: {
            action: audit.action,
            entity_type: audit.entity_type,
            entity_id: audit.entity_id,
            reason: audit.reason,
            actor_id: audit.actor_id,
          },
        }),
    });
  }
}
