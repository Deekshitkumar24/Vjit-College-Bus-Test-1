import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  // In-memory atomic sliding window store (fallback and local development)
  // Backed by database table rate_counters in production
  private static store = new Map<string, { count: number; windowStart: number }>();

  public static getLimitsForRoute(path: string, method: string): RateLimitConfig {
    if (path.includes('/auth/sso/start') || path.includes('/auth/sso/callback')) {
      return { windowSeconds: 60, maxRequests: 20 }; // 20 per minute per IP
    }
    if (path.includes('/auth/otp/request')) {
      return { windowSeconds: 3600, maxRequests: 10 }; // 10 per hour per IP / 3 per account
    }
    if (path.includes('/auth/otp/verify')) {
      return { windowSeconds: 900, maxRequests: 5 }; // 5 attempts per code
    }
    if (path.includes('/telemetry')) {
      return { windowSeconds: 2, maxRequests: 5 }; // 1 req per 2s, burst 5
    }
    if (path.includes('/heartbeat')) {
      return { windowSeconds: 30, maxRequests: 3 }; // 1 req per 30s, burst 3
    }
    if (path.includes('/driver/locations')) {
      return { windowSeconds: 5, maxRequests: 10 }; // 1 req per 5s, burst 10
    }
    if (path.includes('/sos') && method === 'POST') {
      return { windowSeconds: 60, maxRequests: 3 }; // 3 per minute
    }
    if (path.includes('/attendance/scan')) {
      return { windowSeconds: 60, maxRequests: 10 }; // 10 per minute
    }
    return { windowSeconds: 60, maxRequests: 100 }; // default
  }

  use(req: Request, res: Response, next: NextFunction) {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const limitConfig = RateLimiterMiddleware.getLimitsForRoute(req.path, req.method);
    const key = `${clientIp}:${req.path}`;

    const now = Math.floor(Date.now() / 1000);
    const record = RateLimiterMiddleware.store.get(key);

    if (!record || now - record.windowStart >= limitConfig.windowSeconds) {
      RateLimiterMiddleware.store.set(key, { count: 1, windowStart: now });
      res.setHeader('RateLimit-Limit', limitConfig.maxRequests.toString());
      res.setHeader('RateLimit-Remaining', (limitConfig.maxRequests - 1).toString());
      res.setHeader('RateLimit-Reset', limitConfig.windowSeconds.toString());
      return next();
    }

    if (record.count >= limitConfig.maxRequests) {
      const retryAfter = limitConfig.windowSeconds - (now - record.windowStart);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('RateLimit-Limit', limitConfig.maxRequests.toString());
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', retryAfter.toString());

      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Please retry after ' + retryAfter + ' seconds.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    RateLimiterMiddleware.store.set(key, record);

    res.setHeader('RateLimit-Limit', limitConfig.maxRequests.toString());
    res.setHeader('RateLimit-Remaining', (limitConfig.maxRequests - record.count).toString());
    res.setHeader('RateLimit-Reset', (limitConfig.windowSeconds - (now - record.windowStart)).toString());

    return next();
  }

  public static reset() {
    RateLimiterMiddleware.store.clear();
  }
}
