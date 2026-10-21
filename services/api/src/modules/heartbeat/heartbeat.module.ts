import { Module } from '@nestjs/common';
import { HeartbeatController, EventsController } from './heartbeat.controller.js';
import { HeartbeatService } from './heartbeat.service.js';

@Module({
  controllers: [HeartbeatController, EventsController],
  providers: [HeartbeatService],
  exports: [HeartbeatService],
})
export class HeartbeatModule {}
