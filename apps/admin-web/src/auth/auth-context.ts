export type AdminRole = 'COR' | 'TEC' | 'MGT' | 'SAD';

export const ADMIN_ROLES: readonly AdminRole[] = ['COR', 'TEC', 'MGT', 'SAD'];

export interface AdminAuthState {
  isAuthenticated: boolean;
  userRole: AdminRole | null;
  mfaVerified: boolean;
  userEmail: string | null;
}

export function canAccessAdminRoute(
  requiredRoles: AdminRole[],
  state: AdminAuthState,
): { allowed: boolean; redirectTo?: string } {
  if (!state.isAuthenticated) {
    return { allowed: false, redirectTo: '/login' };
  }

  if (!state.mfaVerified) {
    return { allowed: false, redirectTo: '/mfa-verify' };
  }

  if (!state.userRole || !requiredRoles.includes(state.userRole)) {
    return { allowed: false, redirectTo: '/unauthorized' };
  }

  return { allowed: true };
}
