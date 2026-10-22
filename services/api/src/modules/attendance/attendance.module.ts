import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { BoardingCutoffJob, AbsenceEvaluatorService } from './absence-evaluator.service.js';
import { LeaveService } from './leave.service.js';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, BoardingCutoffJob, AbsenceEvaluatorService, LeaveService],
  exports: [AttendanceService, BoardingCutoffJob, AbsenceEvaluatorService, LeaveService],
})
export class AttendanceModule {}
