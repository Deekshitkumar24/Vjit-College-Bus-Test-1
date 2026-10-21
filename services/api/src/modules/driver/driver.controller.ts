import {
  Controller,
  Post,
  Get,
  Param,
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
  DriverDeviceRegisterSchema,
  DriverDeviceRegisterResponseDto,
  DriverRosterResponseDto,
  DriverRosterBusDto,
  DriverModeSwitchRequestSchema,
  DriverModeSwitchResponseDto,
  SosCategorySchema,
  SosTriggerResponseDto,
} from '@collegebus/contracts';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get('roster')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async getRoster(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
  ): Promise<DriverRosterResponseDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    return this.driverService.getRoster(driverId);
  }

  @Get('bus/:busId')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async getBus(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Param('busId') busId: string,
  ): Promise<DriverRosterBusDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    return this.driverService.getBusDetail(driverId, busId);
  }

  @Post('device-register')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async registerDevice(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<DriverDeviceRegisterResponseDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    const parseResult = DriverDeviceRegisterSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_DEVICE_REGISTER_PAYLOAD',
        message: 'Driver device register payload validation failed',
        details: parseResult.error.flatten(),
      });
    }

    return this.driverService.registerDevice(driverId, parseResult.data);
  }

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

  @Post('mode')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async switchMode(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<DriverModeSwitchResponseDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    const parseResult = DriverModeSwitchRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_MODE_SWITCH_PAYLOAD',
        message: 'Driver mode switch payload validation failed',
        details: parseResult.error.flatten(),
      });
    }

    return this.driverService.switchMode(driverId, parseResult.data);
  }

  @Post('sos')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async triggerSos(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Headers('x-shift-id') shiftIdHeader: string | undefined,
    @Body()
    body: {
      category?: string;
      lat?: number;
      lng?: number;
      accuracy_m?: number;
      note?: string;
      shift_id?: string;
    },
  ): Promise<SosTriggerResponseDto> {
    const driverId = driverIdHeader || 'drv_default';
    const shiftId = body.shift_id || shiftIdHeader;

    if (!driverId || !shiftId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_OR_SHIFT_CONTEXT',
        message: 'Driver or shift context missing',
      });
    }

    const catResult = SosCategorySchema.safeParse(body.category || 'EMERGENCY');
    const category = catResult.success ? catResult.data : 'EMERGENCY';

    return this.driverService.triggerSos(driverId, shiftId, {
      category,
      lat: body.lat,
      lng: body.lng,
      accuracy_m: body.accuracy_m,
      note: body.note,
    });
  }

  @Get('sos/:incidentId')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async getSosStatus(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Param('incidentId') incidentId: string,
  ) {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    return this.driverService.getSosIncident(incidentId);
  }
}
