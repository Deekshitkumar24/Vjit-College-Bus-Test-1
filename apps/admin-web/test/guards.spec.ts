import { describe, it, expect } from 'vitest';
import { canAccessAdminRoute, AdminAuthState } from '../src/auth/auth-context.js';

describe('Admin Web Console Route Guard (P0-T19, C-11)', () => {
  it('redirects unauthenticated admin callers to /login', () => {
    const unauthState: AdminAuthState = {
      isAuthenticated: false,
      userRole: null,
      mfaVerified: false,
      userEmail: null,
    };

    const result = canAccessAdminRoute(['SAD'], unauthState);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/login');
  });

  it('redirects users without MFA verification to /mfa-verify', () => {
    const noMfaState: AdminAuthState = {
      isAuthenticated: true,
      userRole: 'SAD',
      mfaVerified: false,
      userEmail: 'admin@college.edu',
    };

    const result = canAccessAdminRoute(['SAD'], noMfaState);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/mfa-verify');
  });

  it('permits authorized admin roles with verified MFA', () => {
    const validAdminState: AdminAuthState = {
      isAuthenticated: true,
      userRole: 'SAD',
      mfaVerified: true,
      userEmail: 'superadmin@college.edu',
    };

    const result = canAccessAdminRoute(['SAD', 'MGT'], validAdminState);
    expect(result.allowed).toBe(true);
    expect(result.redirectTo).toBeUndefined();
  });

  it('rejects access and redirects to /unauthorized when role is insufficient', () => {
    const coordinatorState: AdminAuthState = {
      isAuthenticated: true,
      userRole: 'COR',
      mfaVerified: true,
      userEmail: 'coordinator@college.edu',
    };

    // Route requires Super Admin
    const result = canAccessAdminRoute(['SAD'], coordinatorState);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/unauthorized');
  });
});
