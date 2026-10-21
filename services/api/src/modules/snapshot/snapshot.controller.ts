import {
  Controller,
  Get,
  Query,
  Headers,
  Req,
  Res,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SnapshotService } from './snapshot.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SnapshotResponseDto, SnapshotQueryDtoSchema } from '@collegebus/contracts';

interface AuthenticatedUserRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

@Controller('snapshot')
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Get()
  @Roles('STU', 'FAC', 'DRV', 'SEC', 'COR', 'TEC', 'MGT', 'SAD')
  async getSnapshot(
    @Query() query: unknown,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Headers('x-user-role') headerUserRole: string | undefined,
    @Req() req: AuthenticatedUserRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SnapshotResponseDto | void> {
    const parseResult = SnapshotQueryDtoSchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_SNAPSHOT_QUERY',
        message: 'Invalid snapshot query parameters',
        details: parseResult.error.flatten(),
      });
    }

    // Resolve caller user and role from JWT auth context or test headers
    const userId = req.user?.id || headerUserId || 'usr_anonymous';
    const role = req.user?.role || headerUserRole || 'STU';

    const { snapshot, etag } = await this.snapshotService.getSnapshot(parseResult.data.route_id, {
      id: userId,
      role,
    });

    // ETag 304 Not Modified validation (Part 5.6)
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}`)) {
      res.status(HttpStatus.NOT_MODIFIED);
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    return snapshot;
  }
}
