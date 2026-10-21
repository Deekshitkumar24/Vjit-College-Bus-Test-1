import { Module } from '@nestjs/common';
import { SnapshotController } from './snapshot.controller.js';
import { SnapshotService } from './snapshot.service.js';
import { SelectorModule } from '../selector/selector.module.js';
import { ShiftModule } from '../shift/shift.module.js';

@Module({
  imports: [SelectorModule, ShiftModule],
  controllers: [SnapshotController],
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
