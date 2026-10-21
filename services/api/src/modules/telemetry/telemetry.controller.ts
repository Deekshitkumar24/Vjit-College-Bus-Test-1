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
import { TelemetryService } from './telemetry.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { TelemetryBatchSchema, TelemetryIngestResponseDto } from '@collegebus/contracts';
import { KeyRing, parseKeyRing } from '@collegebus/domain';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  @Public() // Devices authenticate using custom pre-shared bearer token in Authorization header
  @HttpCode(HttpStatus.OK)
  async ingest(
    @Headers('authorization') authHeader: string | undefined,
    @Headers('x-device-id') deviceIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<TelemetryIngestResponseDto> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing or malformed Authorization header with Bearer token',
      });
    }

    const rawToken = authHeader.substring(7).trim();
    if (!deviceIdHeader) {
      throw new BadRequestException({
        code: 'MISSING_DEVICE_ID',
        message: 'Missing X-Device-Id header',
      });
    }

    // Stage S5: Zod validation of batch schema
    const parseResult = TelemetryBatchSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_TELEMETRY_BATCH',
        message: 'Telemetry batch validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const rawKeyring =
      process.env['DEVICE_TOKEN_HMAC_KEYS'] || '1:default_dev_hmac_secret_32bytes_long!';
    const keyring: KeyRing = parseKeyRing(rawKeyring);

    return this.telemetryService.ingestBatch(deviceIdHeader, rawToken, parseResult.data, keyring);
  }
}
