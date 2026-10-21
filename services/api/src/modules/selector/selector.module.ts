import { Module } from '@nestjs/common';
import { SelectorService } from './selector.service.js';
import { ShiftModule } from '../shift/shift.module.js';
import { DriverModule } from '../driver/driver.module.js';

@Module({
  imports: [ShiftModule, DriverModule],
  providers: [SelectorService],
  exports: [SelectorService],
})
export class SelectorModule {}
