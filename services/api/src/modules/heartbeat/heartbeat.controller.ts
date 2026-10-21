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
import { HeartbeatService } from './heartbeat.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  HeartbeatRequestSchema,
  HeartbeatResponseDto,
  HardwareEventSchema,
  EventResultDto,
} from '@collegebus/contracts';
import { KeyRing, parseKeyRing } from '@collegebus/domain';
import { z } from 'zod';

const StandaloneEventsPayloadSchema = z.object({
  schema_version: z.literal(1).default(1),
  device_id: z
    .string()
    .regex(/^HW_\d{3,4}$/)
    .optional(),
  boot_id: z.string().min(8).max(32),
  events: z.array(HardwareEventSchema).min(1).max(20),
});

@Controller('heartbeat')
export class HeartbeatController {
  constructor(private readonly heartbeatService: HeartbeatService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleHeartbeat(
    @Headers('authorization') authHeader: string | undefined,
    @Headers('x-device-id') deviceIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<HeartbeatResponseDto> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing or malformed Authorization header with Bearer token',
      });
    }

    const rawToken = authHeader.substring(7).trim();

    const parseResult = HeartbeatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_HEARTBEAT_PAYLOAD',
        message: 'Heartbeat payload validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const deviceId = deviceIdHeader || parseResult.data.device_id;
    if (!deviceId) {
      throw new BadRequestException({
        code: 'MISSING_DEVICE_ID',
        message: 'Missing device_id in header or body',
      });
    }

    const rawKeyring =
      process.env['DEVICE_TOKEN_HMAC_KEYS'] || '1:default_dev_hmac_secret_32bytes_long!';
    const keyring: KeyRing = parseKeyRing(rawKeyring);

    return this.heartbeatService.processHeartbeat(deviceId, rawToken, parseResult.data, keyring);
  }
}

@Controller('events')
export class EventsController {
  constructor(private readonly heartbeatService: HeartbeatService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleEvents(
    @Headers('authorization') authHeader: string | undefined,
    @Headers('x-device-id') deviceIdHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ event_results: EventResultDto[] }> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing or malformed Authorization header with Bearer token',
      });
    }

    const rawToken = authHeader.substring(7).trim();

    const parseResult = StandaloneEventsPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_EVENTS_PAYLOAD',
        message: 'Events payload validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const deviceId = deviceIdHeader || parseResult.data.device_id;
    if (!deviceId) {
      throw new BadRequestException({
        code: 'MISSING_DEVICE_ID',
        message: 'Missing device_id in header or body',
      });
    }

    const rawKeyring =
      process.env['DEVICE_TOKEN_HMAC_KEYS'] || '1:default_dev_hmac_secret_32bytes_long!';
    const keyring: KeyRing = parseKeyRing(rawKeyring);

    const eventResults = await this.heartbeatService.processEvents(
      deviceId,
      rawToken,
      parseResult.data.boot_id,
      parseResult.data.events,
      keyring,
    );

    return { event_results: eventResults };
  }
}
