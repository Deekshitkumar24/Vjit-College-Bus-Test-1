import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { BoardingCutoffJob, AbsenceEvaluatorService } from './absence-evaluator.service.js';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, BoardingCutoffJob, AbsenceEvaluatorService],
  exports: [AttendanceService, BoardingCutoffJob, AbsenceEvaluatorService],
})
export class AttendanceModule {}
