import {
  AdminRole,
  AdminRouteId,
  ADMIN_ROUTE_REGISTRY,
  RouteDefinition,
} from '../auth/auth-context.js';

export interface AdminNavItem {
  id: AdminRouteId;
  path: string;
  title: string;
  category: 'OPERATIONS' | 'FLEET' | 'COMMUNITY' | 'HARDWARE' | 'SYSTEM';
}

export const ADMIN_NAV_CATEGORIES_MAP = new Map<AdminRouteId, AdminNavItem['category']>([
  ['fleet-map', 'OPERATIONS'],
  ['source-switches', 'OPERATIONS'],
  ['tickets', 'OPERATIONS'],
  ['buses', 'FLEET'],
  ['routes', 'FLEET'],
  ['rosters', 'FLEET'],
  ['faculty-assignments', 'COMMUNITY'],
  ['student-routes', 'COMMUNITY'],
  ['users', 'COMMUNITY'],
  ['devices', 'HARDWARE'],
  ['device-health', 'HARDWARE'],
  ['firmware', 'HARDWARE'],
  ['settings', 'SYSTEM'],
  ['audit-logs', 'SYSTEM'],
]);

/**
 * Returns the filtered list of navigation items authorized for the user's role.
 */
export function getAuthorizedNavItems(role: AdminRole): AdminNavItem[] {
  const items: AdminNavItem[] = [];

  for (const [id, def] of Object.entries(ADMIN_ROUTE_REGISTRY) as [AdminRouteId, RouteDefinition][]) {
    if (def.allowedRoles.includes(role)) {
      const category = ADMIN_NAV_CATEGORIES_MAP.get(id) ?? 'OPERATIONS';
      items.push({
        id,
        path: def.path,
        title: def.title,
        category,
      });
    }
  }

  return items;
}

/**
 * Validates that Technician (TEC) cannot access student or passenger data per Part 5.5 / §16.5.
 */
export function isStudentDataAccessDenied(role: AdminRole, routeId: AdminRouteId): boolean {
  if (role === 'TEC') {
    const studentRoutes: AdminRouteId[] = ['student-routes', 'faculty-assignments', 'users'];
    return studentRoutes.includes(routeId);
  }
  return false;
}
