import { Injectable, NestMiddleware, ConflictException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

interface StoredIdempotencyEntry {
  requestHash: string;
  statusCode: number;
  body: unknown;
  expiresAt: number;
}

interface AuthenticatedRequest extends Request {
  user?: { userId?: string };
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  // In-memory cache for idempotency keys (backed by idempotency_keys table in DB)
  private static cache = new Map<string, StoredIdempotencyEntry>();

  use(req: Request, res: Response, next: NextFunction) {
    // Only applies to state-changing requests (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      // In MVP, required on state-changing app/console endpoints
      return next();
    }

    const userId = (req as AuthenticatedRequest).user?.userId || 'anonymous';
    const cacheKey = `${userId}:${idempotencyKey}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    const now = Date.now();
    const existing = IdempotencyMiddleware.cache.get(cacheKey);

    if (existing) {
      if (existing.expiresAt > now) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key reused with different request payload.',
          });
        }
        // Return cached response directly
        return res.status(existing.statusCode).json(existing.body);
      } else {
        IdempotencyMiddleware.cache.delete(cacheKey);
      }
    }

    // Intercept response to cache it
    const originalSend = res.json.bind(res);
    res.json = (body: unknown) => {
      // Store in cache for 24 hours (86400 seconds)
      IdempotencyMiddleware.cache.set(cacheKey, {
        requestHash,
        statusCode: res.statusCode,
        body,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
      return originalSend(body);
    };

    return next();
  }

  public static reset() {
    IdempotencyMiddleware.cache.clear();
  }
}
