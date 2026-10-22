import { Controller, Get, Post, Param, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { GlobalAuthGuard } from '../../common/guards/auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('attendance')
@UseGuards(GlobalAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('trips/:id/qr')
  @Roles('DRV', 'COR', 'SAD')
  async getTripQr(@Param('id') tripId: string, @Req() req: any) {
    const driverId = req.user.id;
    return this.attendanceService.getTripQr({
      tripId,
      driverId,
      getTrip: async (id) => req.prisma?.trip?.findUnique({ where: { id }, include: { bus: true } }),
      getActiveShift: async (drvId) =>
        req.prisma?.shift?.findFirst({ where: { driver_id: drvId, status: 'ACTIVE' } }),
    });
  }

  @Post('scan')
  @Roles('STU')
  async scanQr(@Body() body: { qr_token: string; client_timestamp?: string }, @Req() req: any) {
    const studentId = req.user.id;
    const scanTime = body.client_timestamp ? new Date(body.client_timestamp).getTime() : Date.now();

    const result = await this.attendanceService.processScan({
      studentId,
      token: body.qr_token,
      scanTime,
      getTrip: async (id) => req.prisma?.trip?.findUnique({ where: { id }, include: { bus: true } }),
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
        throw new HttpException({ error: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded: max 10 scans per minute' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new HttpException({ error: result.error, message: `Scan rejected: ${result.error}` }, HttpStatus.BAD_REQUEST);
    }

    return result;
  }
}
