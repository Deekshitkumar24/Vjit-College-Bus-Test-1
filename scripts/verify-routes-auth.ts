import { extractRoutes, RouteInventoryItem } from './audit/routes.js';

export const REVIEWED_PUBLIC_ALLOWLIST = [
  'POST /api/v1/auth/sso/start',
  'GET /api/v1/auth/sso/callback',
  'POST /api/v1/auth/otp/request',
  'POST /api/v1/auth/otp/verify',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/telemetry',
  'POST /api/v1/heartbeat',
  'POST /api/v1/events',
  'GET /api/v1/health',
  'GET /api/v1/health/ready',
];

export function verifyRouteInventory(routes: RouteInventoryItem[]): {
  valid: boolean;
  unauthorizedRoutes: string[];
} {
  const unauthorizedRoutes: string[] = [];

  for (const r of routes) {
    const key = `${r.method.toUpperCase()} ${r.path}`;
    if (r.isPublic) {
      if (!REVIEWED_PUBLIC_ALLOWLIST.includes(key)) {
        unauthorizedRoutes.push(`Route ${key} is marked public but NOT on reviewed allowlist!`);
      }
    } else {
      if (!r.roles || r.roles.length === 0) {
        // Authenticated sessions required
      }
    }
  }

  return {
    valid: unauthorizedRoutes.length === 0,
    unauthorizedRoutes,
  };
}

if (process.argv[1] && process.argv[1].endsWith('verify-routes-auth.ts')) {
  const currentRoutes = extractRoutes();
  const result = verifyRouteInventory(currentRoutes);

  if (!result.valid) {
    console.error('verify:routes-auth FAILED: Unaudited public routes detected:');
    result.unauthorizedRoutes.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log(
    `verify:routes-auth PASSED. ${currentRoutes.length} routes generated from code and verified with zero unauthorized public endpoints.`,
  );
}
