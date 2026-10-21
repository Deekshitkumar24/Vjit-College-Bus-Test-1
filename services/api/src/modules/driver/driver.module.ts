import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';
import { ShiftModule } from '../shift/shift.module.js';

@Module({
  imports: [ShiftModule],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
