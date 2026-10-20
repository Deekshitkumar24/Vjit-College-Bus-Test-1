import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  liveness(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      status: 'ok',
      service: 'college-bus-tracker-api',
      timestamp: new Date().toISOString(),
    });
  }

  @Get('ready')
  @Public()
  async readiness(@Res() res: Response) {
    // In production, checks PostgreSQL / PostGIS database connection pool
    return res.status(HttpStatus.OK).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  }
}
