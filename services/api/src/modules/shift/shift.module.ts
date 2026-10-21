import { Module } from '@nestjs/common';
import { ShiftController } from './shift.controller.js';
import { ShiftService } from './shift.service.js';

@Module({
  controllers: [ShiftController],
  providers: [ShiftService],
  exports: [ShiftService],
})
export class ShiftModule {}
