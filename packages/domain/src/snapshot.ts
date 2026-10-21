/**
 * Snapshot & Scope Resolution Domain Logic (Part 5.6, 6.9, 17.3)
 */

export interface SourceBadgeInput {
  state: 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'NOT_RUNNING';
  active_source: 'HW' | 'PHONE' | 'NONE';
  data_age_s?: number | null | undefined;
  last_seen_at?: Date | null | undefined;
}

/**
 * Produces authoritative plain-text display labels (Part 17.3)
 */
export function formatSourceBadgeLabel(input: SourceBadgeInput): string {
  if (input.state === 'NOT_RUNNING') {
    return 'Not running';
  }

  if (input.state === 'LIVE') {
    if (input.active_source === 'HW') {
      return 'Live · bus tracker';
    }
    if (input.active_source === 'PHONE') {
      return "Live · driver's phone";
    }
    return 'Live';
  }

  if (input.state === 'STALE') {
    if (input.data_age_s !== undefined && input.data_age_s !== null && input.data_age_s >= 0) {
      return `Last update ${input.data_age_s}s ago`;
    }
    return 'Stale';
  }

  if (input.state === 'UNAVAILABLE') {
    if (input.last_seen_at) {
      const hours = input.last_seen_at.getUTCHours().toString().padStart(2, '0');
      const minutes = input.last_seen_at.getUTCMinutes().toString().padStart(2, '0');
      return `Location unavailable. Last seen at ${hours}:${minutes}`;
    }
    return 'Location unavailable';
  }

  return 'Unknown';
}

export interface RouteScopeResolutionInput {
  role: string;
  routeId: string;
  studentRouteIds?: string[] | undefined;
  facultyRouteIds?: string[] | undefined;
  driverRouteIds?: string[] | undefined;
}

/**
 * Resolves caller route visibility scope (Part 6.9 & Part B.1 L-3)
 * If not visible, return allowed: false (triggering HTTP 404 per the 404 rule).
 */
export function resolveUserRouteScope(input: RouteScopeResolutionInput): {
  allowed: boolean;
  reason?: string | undefined;
} {
  const { role, routeId } = input;

  // Administrative & Security roles have global scope
  // Part B.1 L-3: Security staff (SEC) see all active buses, read-only.
  if (role === 'SAD' || role === 'COR' || role === 'TEC' || role === 'MGT' || role === 'SEC') {
    return { allowed: true };
  }

  // Student scope: only assigned routes
  if (role === 'STU') {
    const studentRoutes = input.studentRouteIds || [];
    if (studentRoutes.includes(routeId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'ROUTE_NOT_ASSIGNED_TO_STUDENT' };
  }

  // Faculty scope: only assigned routes
  if (role === 'FAC') {
    const facultyRoutes = input.facultyRouteIds || [];
    if (facultyRoutes.includes(routeId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'ROUTE_NOT_ASSIGNED_TO_FACULTY' };
  }

  // Driver scope: only active/rostered routes
  if (role === 'DRV') {
    const driverRoutes = input.driverRouteIds || [];
    if (driverRoutes.includes(routeId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'ROUTE_NOT_ASSIGNED_TO_DRIVER' };
  }

  // Unknown role fails closed
  return { allowed: false, reason: 'UNKNOWN_ROLE' };
}

/**
 * Computes data age in whole seconds
 */
export function computeDataAgeSeconds(
  sourceUpdatedAt: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!sourceUpdatedAt) return null;
  const ageMs = now.getTime() - sourceUpdatedAt.getTime();
  if (ageMs < 0) return 0;
  return Math.floor(ageMs / 1000);
}

/**
 * Generates deterministic HTTP ETag for snapshot caching (Part 5.6)
 */
export function generateSnapshotEtag(
  routeId: string,
  routeVersion: number,
  contentFingerprint: string,
): string {
  return `W/"snap_${routeId}_v${routeVersion}_${contentFingerprint}"`;
}
