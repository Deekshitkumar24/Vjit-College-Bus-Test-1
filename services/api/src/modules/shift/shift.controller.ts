import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ShiftService } from './shift.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  StartShiftSchema,
  ShiftClaimDto,
  EndShiftSchema,
  ActiveShiftResponseDto,
} from '@collegebus/contracts';

@Controller('shifts')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get('active')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async getActiveShift(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
  ): Promise<ActiveShiftResponseDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    return this.shiftService.getActiveShiftStatus(driverId);
  }

  @Post('claim')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async claimShift(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<ShiftClaimDto> {
    const driverId = driverIdHeader || 'drv_default';
    if (!driverId) {
      throw new UnauthorizedException({
        code: 'MISSING_DRIVER_CONTEXT',
        message: 'Driver context missing',
      });
    }

    const parseResult = StartShiftSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_SHIFT_START_PAYLOAD',
        message: 'Invalid shift payload',
        details: parseResult.error.flatten(),
      });
    }

    return this.shiftService.startShift(driverId, parseResult.data);
  }

  @Post('end')
  @Roles('DRV')
  @HttpCode(HttpStatus.OK)
  async endShift(
    @Headers('x-driver-id') driverIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ status: string; ended_at: string }> {
    const driverId = driverIdHeader || 'drv_default';
    const parseResult = EndShiftSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_END_SHIFT_PAYLOAD',
        message: 'shift_id is required to end shift',
      });
    }

    const shift = await this.shiftService.endShift(
      driverId,
      parseResult.data.shift_id,
      parseResult.data.reason,
    );
    return {
      status: shift.status,
      ended_at: shift.ended_at ? shift.ended_at.toISOString() : new Date().toISOString(),
    };
  }
}
