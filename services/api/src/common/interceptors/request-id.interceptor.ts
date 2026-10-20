import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Response, Request } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const incomingId = req.headers['x-request-id'] as string;
    const requestId = incomingId && /^req_[a-zA-Z0-9_\-]+$/.test(incomingId) ? incomingId : `req_${randomUUID().replace(/-/g, '')}`;

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    // Default rate limit headers
    if (!res.getHeader('RateLimit-Limit')) {
      res.setHeader('RateLimit-Limit', '100');
      res.setHeader('RateLimit-Remaining', '99');
      res.setHeader('RateLimit-Reset', '60');
    }

    return next.handle();
  }
}
