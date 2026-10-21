export type MobileRole = 'STU' | 'FAC' | 'DRV' | 'SEC';

export const MOBILE_ROLES: readonly MobileRole[] = ['STU', 'FAC', 'DRV', 'SEC'];

export interface AuthState {
  isAuthenticated: boolean;
  userRole: MobileRole | null;
  availableRoles: MobileRole[];
}

export function canAccessMobileRoute(
  targetRole: MobileRole,
  state: AuthState,
): { allowed: boolean; redirectTo?: string } {
  if (!state.isAuthenticated) {
    return { allowed: false, redirectTo: '/login' };
  }

  if (state.userRole !== targetRole) {
    // If user has the target role available in their account, allow switching
    if (state.availableRoles.includes(targetRole)) {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized' };
  }

  return { allowed: true };
}

export function switchMobileRole(newRole: MobileRole, state: AuthState): AuthState {
  if (!state.availableRoles.includes(newRole)) {
    throw new Error(`Role ${newRole} is not assigned to this user.`);
  }
  return {
    ...state,
    userRole: newRole,
  };
}
