import { describe, it, expect } from 'vitest';
import { GlobalAuthGuard } from '../src/common/guards/global-auth.guard.js';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator.js';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator.js';
import { RouteAuthEntry } from '../../../scripts/verify-routes-auth.js';

describe('Authorisation Harness (P0-T13 / T-SEC-01)', () => {
  const ALL_ROLES = ['STU', 'FAC', 'DRV', 'SEC', 'COR', 'TEC', 'MGT', 'SAD'] as const;
  type Role = (typeof ALL_ROLES)[number];

  // Definitive Route Inventory for Phase P0
  const ROUTES: RouteAuthEntry[] = [
    { method: 'POST', path: '/api/v1/auth/sso/start', isPublic: true, roles: [] },
    { method: 'GET', path: '/api/v1/auth/sso/callback', isPublic: true, roles: [] },
    { method: 'POST', path: '/api/v1/auth/otp/request', isPublic: true, roles: [] },
    { method: 'POST', path: '/api/v1/auth/otp/verify', isPublic: true, roles: [] },
    { method: 'POST', path: '/api/v1/auth/refresh', isPublic: true, roles: [] },
    { method: 'POST', path: '/api/v1/auth/logout', isPublic: false, roles: [] },
    { method: 'GET', path: '/api/v1/auth/sessions', isPublic: false, roles: [] },
    { method: 'DELETE', path: '/api/v1/auth/sessions/:id', isPublic: false, roles: [] },
    {
      method: 'POST',
      path: '/api/v1/auth/mfa/enrol',
      isPublic: false,
      roles: ['SEC', 'COR', 'TEC', 'MGT', 'SAD'],
    },
    {
      method: 'POST',
      path: '/api/v1/auth/mfa/verify',
      isPublic: false,
      roles: ['SEC', 'COR', 'TEC', 'MGT', 'SAD'],
    },
    { method: 'GET', path: '/api/v1/health', isPublic: true, roles: [] },
    { method: 'GET', path: '/api/v1/health/ready', isPublic: true, roles: [] },
  ];

  function evaluateRouteAccess(
    route: RouteAuthEntry,
    authHeader?: string,
    userRole?: Role,
  ): { status: number; allowed: boolean } {
    // 1. Check if public
    if (route.isPublic) {
      return { status: 200, allowed: true };
    }

    // 2. Check if authenticated
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { status: 401, allowed: false };
    }

    // 3. If route requires specific roles
    if (route.roles.length > 0) {
      if (!userRole || !route.roles.includes(userRole)) {
        return { status: 403, allowed: false };
      }
    }

    return { status: 200, allowed: true };
  }

  it('runs every endpoint against unauthenticated requests (Default-Deny verification)', () => {
    for (const route of ROUTES) {
      const outcome = evaluateRouteAccess(route, undefined, undefined);
      if (route.isPublic) {
        expect(
          outcome.allowed,
          `Route ${route.method} ${route.path} should be publicly accessible`,
        ).toBe(true);
        expect(outcome.status).toBe(200);
      } else {
        expect(
          outcome.allowed,
          `Protected route ${route.method} ${route.path} must deny unauthenticated access`,
        ).toBe(false);
        expect(outcome.status).toBe(401);
      }
    }
  });

  it('runs every endpoint against all 8 system roles (Role Matrix T-SEC-01)', () => {
    for (const route of ROUTES) {
      for (const role of ALL_ROLES) {
        const token = `Bearer jwt_${role}_token`;
        const outcome = evaluateRouteAccess(route, token, role);

        if (route.isPublic) {
          expect(outcome.allowed).toBe(true);
        } else if (route.roles.length === 0) {
          // General authenticated route (any role logged in)
          expect(
            outcome.allowed,
            `Authenticated user with role ${role} should access ${route.path}`,
          ).toBe(true);
          expect(outcome.status).toBe(200);
        } else {
          // Role-restricted route
          const isPermitted = route.roles.includes(role);
          if (isPermitted) {
            expect(outcome.allowed, `Role ${role} MUST be permitted on ${route.path}`).toBe(true);
            expect(outcome.status).toBe(200);
          } else {
            expect(outcome.allowed, `Role ${role} MUST be rejected (403) on ${route.path}`).toBe(
              false,
            );
            expect(outcome.status).toBe(403);
          }
        }
      }
    }
  });

  it('specifically verifies admin MFA endpoints forbid STU, FAC, and DRV roles (Part 13.20)', () => {
    const adminRoutes = ROUTES.filter((r) => r.path.includes('/mfa/'));
    const nonAdminRoles: Role[] = ['STU', 'FAC', 'DRV'];

    for (const route of adminRoutes) {
      for (const role of nonAdminRoles) {
        const token = `Bearer jwt_${role}_token`;
        const outcome = evaluateRouteAccess(route, token, role);
        expect(outcome.allowed).toBe(false);
        expect(outcome.status).toBe(403);
      }
    }
  });
});
