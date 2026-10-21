import { describe, it, expect, beforeEach } from 'vitest';
import { canAccessMobileRoute, switchMobileRole, AuthState } from '../src/auth/route-guard.js';
import { tokenStorage } from '../src/auth/token-storage.js';

describe('Minimal Mobile Shell Route Guard & Token Storage (P0-T18, C-11)', () => {
  beforeEach(async () => {
    await tokenStorage.removeItem('access_token');
    await tokenStorage.removeItem('refresh_token');
  });

  it('redirects unauthenticated users to /login', () => {
    const unauthState: AuthState = {
      isAuthenticated: false,
      userRole: null,
      availableRoles: [],
    };

    const result = canAccessMobileRoute('STU', unauthState);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/login');
  });

  it('allows access when user has active matching role', () => {
    const studentState: AuthState = {
      isAuthenticated: true,
      userRole: 'STU',
      availableRoles: ['STU'],
    };

    const result = canAccessMobileRoute('STU', studentState);
    expect(result.allowed).toBe(true);
    expect(result.redirectTo).toBeUndefined();
  });

  it('rejects access and redirects to /unauthorized when user lacks requested role', () => {
    const studentState: AuthState = {
      isAuthenticated: true,
      userRole: 'STU',
      availableRoles: ['STU'],
    };

    const result = canAccessMobileRoute('DRV', studentState);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/unauthorized');
  });

  it('supports role switcher placeholder across all 4 mobile roles (STU, FAC, DRV, SEC)', () => {
    const multiRoleState: AuthState = {
      isAuthenticated: true,
      userRole: 'FAC',
      availableRoles: ['FAC', 'DRV'],
    };

    // Access DRV route is permitted because user possesses DRV in availableRoles
    const result = canAccessMobileRoute('DRV', multiRoleState);
    expect(result.allowed).toBe(true);

    // Switch active role to DRV
    const switched = switchMobileRole('DRV', multiRoleState);
    expect(switched.userRole).toBe('DRV');

    // Attempting to switch to unassigned role throws error
    expect(() => switchMobileRole('SEC', multiRoleState)).toThrowError(
      /Role SEC is not assigned to this user/,
    );
  });

  it('stores and retrieves secure session tokens', async () => {
    await tokenStorage.setItem('access_token', 'jwt_test_token_sample');
    const token = await tokenStorage.getItem('access_token');
    expect(token).toBe('jwt_test_token_sample');

    await tokenStorage.removeItem('access_token');
    const removed = await tokenStorage.getItem('access_token');
    expect(removed).toBeNull();
  });
});
