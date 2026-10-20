import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  collegeId: string;
  sessionId: string;
  shiftId?: string;
  busId?: string;
}

@Injectable()
export class GlobalAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const sessionCookie = request.cookies?.['session'];

    // If neither Bearer token nor session cookie is present, fail-closed with 401 AUTH_REQUIRED
    if (!authHeader && !sessionCookie) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'No valid credentials provided. Authentication is required.',
      });
    }

    // Context user will be decoded and attached from JWT/cookie by AuthService or middleware
    if (!request.user) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'No valid session or token verified.',
      });
    }

    return true;
  }
}
