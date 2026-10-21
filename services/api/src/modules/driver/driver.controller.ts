import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { DriverService } from './driver.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  DriverLocationsBatchSchema,
  DriverLocationsResponseDto,
  DriverStatusSchema,
} from '@collegebus/contracts';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post('locations')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async reportLocations(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<DriverLocationsResponseDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    const parseResult = DriverLocationsBatchSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_DRIVER_LOCATIONS_PAYLOAD',
        message: 'Driver locations payload validation failed',
        details: parseResult.error.flatten(),
      });
    }

    return this.driverService.ingestLocations(driverId, parseResult.data);
  }

  @Post('status')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async reportStatus(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Headers('x-shift-id') shiftIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ status: string }> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    const parseResult = DriverStatusSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_DRIVER_STATUS_PAYLOAD',
        message: 'Driver status payload validation failed',
        details: parseResult.error.flatten(),
      });
    }

    return this.driverService.recordDriverStatus(driverId, parseResult.data, shiftIdHeader);
  }
}
