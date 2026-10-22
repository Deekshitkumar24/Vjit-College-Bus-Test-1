export type AdminRole = 'COR' | 'TEC' | 'MGT' | 'SAD' | 'SEC';

export const ADMIN_ROLES: readonly AdminRole[] = ['COR', 'TEC', 'MGT', 'SAD', 'SEC'];

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  mfaEnabled: boolean;
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  userRole: AdminRole | null;
  mfaVerified: boolean;
  userEmail: string | null;
  userId?: string | null;
  lastActiveAt?: number;
  isIdleTimedOut?: boolean;
}

export type AdminRouteId =
  | 'fleet-map'
  | 'buses'
  | 'devices'
  | 'device-health'
  | 'routes'
  | 'rosters'
  | 'faculty-assignments'
  | 'student-routes'
  | 'users'
  | 'tickets'
  | 'firmware'
  | 'source-switches'
  | 'settings'
  | 'audit-logs';

export interface RouteDefinition {
  id: AdminRouteId;
  path: string;
  title: string;
  allowedRoles: AdminRole[];
}

/**
 * Role-based routes registry per Part 6.8 & Part 10.1:
 * - COR: Fleet oversight, routes, rosters, tickets, buses, device revocation (no student attendance/scan)
 * - TEC: Devices, provisioning, health, firmware, tickets (no student/passenger data)
 * - SAD: Super Admin, all permissions including settings, feature flags, audit logs
 * - MGT: Management read-only overview
 * - SEC: Security live read-only bus oversight (Locked Decision L-3)
 */
export const ADMIN_ROUTE_REGISTRY: Record<AdminRouteId, RouteDefinition> = {
  'fleet-map': {
    id: 'fleet-map',
    path: '/fleet-map',
    title: 'Live Fleet Map',
    allowedRoles: ['COR', 'TEC', 'MGT', 'SAD', 'SEC'],
  },
  buses: {
    id: 'buses',
    path: '/buses',
    title: 'Buses',
    allowedRoles: ['COR', 'SAD'],
  },
  devices: {
    id: 'devices',
    path: '/devices',
    title: 'Devices & Provisioning',
    allowedRoles: ['TEC', 'SAD'],
  },
  'device-health': {
    id: 'device-health',
    path: '/device-health',
    title: 'Device Health',
    allowedRoles: ['TEC', 'COR', 'SAD'],
  },
  routes: {
    id: 'routes',
    path: '/routes',
    title: 'Routes & Stops',
    allowedRoles: ['COR', 'SAD'],
  },
  rosters: {
    id: 'rosters',
    path: '/rosters',
    title: 'Driver Rosters',
    allowedRoles: ['COR', 'SAD'],
  },
  'faculty-assignments': {
    id: 'faculty-assignments',
    path: '/faculty-assignments',
    title: 'Faculty Assignments',
    allowedRoles: ['COR', 'SAD'],
  },
  'student-routes': {
    id: 'student-routes',
    path: '/student-routes',
    title: 'Student Routes',
    allowedRoles: ['COR', 'SAD'],
  },
  users: {
    id: 'users',
    path: '/users',
    title: 'User Management',
    allowedRoles: ['COR', 'SAD'],
  },
  tickets: {
    id: 'tickets',
    path: '/tickets',
    title: 'Maintenance Tickets',
    allowedRoles: ['COR', 'TEC', 'SAD'],
  },
  firmware: {
    id: 'firmware',
    path: '/firmware',
    title: 'Firmware Rollouts',
    allowedRoles: ['TEC', 'SAD'],
  },
  'source-switches': {
    id: 'source-switches',
    path: '/source-switches',
    title: 'Source-Switch Logs',
    allowedRoles: ['COR', 'TEC', 'MGT', 'SAD'],
  },
  settings: {
    id: 'settings',
    path: '/settings',
    title: 'System Settings',
    allowedRoles: ['SAD'],
  },
  'audit-logs': {
    id: 'audit-logs',
    path: '/audit-logs',
    title: 'Audit Logs',
    allowedRoles: ['SAD', 'MGT'],
  },
};

export interface RouteAccessResult {
  allowed: boolean;
  reason?: 'UNAUTHENTICATED' | 'MFA_REQUIRED' | 'ROLE_UNAUTHORIZED' | 'IDLE_TIMEOUT';
  redirectTo?: string;
}

export function canAccessAdminRoute(
  requiredRoles: AdminRole[],
  state: AdminAuthState,
): RouteAccessResult {
  if (state.isIdleTimedOut) {
    return {
      allowed: false,
      reason: 'IDLE_TIMEOUT',
      redirectTo: '/login?reason=idle_timeout',
    };
  }

  if (!state.isAuthenticated) {
    return {
      allowed: false,
      reason: 'UNAUTHENTICATED',
      redirectTo: '/login',
    };
  }

  if (!state.mfaVerified) {
    return {
      allowed: false,
      reason: 'MFA_REQUIRED',
      redirectTo: '/mfa-verify',
    };
  }

  if (!state.userRole || !requiredRoles.includes(state.userRole)) {
    return {
      allowed: false,
      reason: 'ROLE_UNAUTHORIZED',
      redirectTo: '/unauthorized',
    };
  }

  return { allowed: true };
}

/**
 * Checks if a specific route ID can be accessed by the user state
 */
export const ADMIN_ROUTE_MAP = new Map<AdminRouteId, RouteDefinition>(
  Object.entries(ADMIN_ROUTE_REGISTRY) as [AdminRouteId, RouteDefinition][],
);

export function canAccessRouteById(
  routeId: AdminRouteId,
  state: AdminAuthState,
): RouteAccessResult {
  const route = ADMIN_ROUTE_MAP.get(routeId);
  if (!route) {
    return {
      allowed: false,
      reason: 'ROLE_UNAUTHORIZED',
      redirectTo: '/unauthorized',
    };
  }
  return canAccessAdminRoute(route.allowedRoles, state);
}
