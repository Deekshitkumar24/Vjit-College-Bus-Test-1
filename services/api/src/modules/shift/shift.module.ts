import { Module } from '@nestjs/common';
import { ShiftController } from './shift.controller.js';
import { ShiftService } from './shift.service.js';
import { ShiftAutoEndJob } from './shift-auto-end.job.js';

@Module({
  controllers: [ShiftController],
  providers: [ShiftService, ShiftAutoEndJob],
  exports: [ShiftService, ShiftAutoEndJob],
})
export class ShiftModule {}
