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
import { ShiftService } from './shift.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { StartShiftSchema, ShiftClaimDto } from '@collegebus/contracts';
import { z } from 'zod';

const EndShiftSchema = z.object({
  shift_id: z.string().min(1),
});

@Controller('shifts')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

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

    const shift = await this.shiftService.endShift(driverId, parseResult.data.shift_id);
    return {
      status: shift.status,
      ended_at: shift.ended_at ? shift.ended_at.toISOString() : new Date().toISOString(),
    };
  }
}
