import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || 'req_' + Math.random().toString(36).substring(2, 12);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: Record<string, unknown> | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        code = (resObj['code'] as string) || (resObj['error'] as string) || 'ERROR';
        message = (resObj['message'] as string) || exception.message;
        if (resObj['details'] && typeof resObj['details'] === 'object') {
          details = resObj['details'] as Record<string, unknown>;
        }
      } else if (typeof res === 'string') {
        message = res;
      }
    } else {
      // Unhandled / Internal exception: never expose stack trace, paths, or SQL (AG-MASTER-1.0 §1.7, §13.10)
      console.error(`[INTERNAL_ERROR] ${requestId}:`, exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'Unexpected failure. No details returned.';
    }

    // Always append X-Request-Id header to response
    response.setHeader('X-Request-Id', requestId);

    response.status(status).json({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        request_id: requestId,
      },
    });
  }
}
