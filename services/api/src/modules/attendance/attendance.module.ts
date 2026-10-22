import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { BoardingCutoffJob, AbsenceEvaluatorService } from './absence-evaluator.service.js';
import { LeaveService } from './leave.service.js';
import { AbsenceAlertsService } from './absence-alerts.service.js';
import {
  OperationalAlertsEngine,
  CoordinatorSummaryJob,
  AttendanceCsvExporter,
} from './operational-alerts.service.js';

@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    BoardingCutoffJob,
    AbsenceEvaluatorService,
    LeaveService,
    AbsenceAlertsService,
    OperationalAlertsEngine,
    CoordinatorSummaryJob,
    AttendanceCsvExporter,
  ],
  exports: [
    AttendanceService,
    BoardingCutoffJob,
    AbsenceEvaluatorService,
    LeaveService,
    AbsenceAlertsService,
    OperationalAlertsEngine,
    CoordinatorSummaryJob,
    AttendanceCsvExporter,
  ],
})
export class AttendanceModule {}
