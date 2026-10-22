import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';
import { SosService } from './sos.service.js';
import { ShiftModule } from '../shift/shift.module.js';

@Module({
  imports: [ShiftModule],
  controllers: [DriverController],
  providers: [DriverService, SosService],
  exports: [DriverService, SosService],
})
export class DriverModule {}
