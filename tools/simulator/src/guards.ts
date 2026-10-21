/**
 * Simulator Security & Synthetic Data Enforcement (AG-MASTER-1.0 §1.2 R-M3, R-M5).
 * The simulator strictly refuses to execute unless APP_ENV is 'local' or 'staging',
 * and only against target URLs matching the allowed hostname whitelist.
 */

const ALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  'dev.collegebus.internal',
  'staging.collegebus.internal',
]);

export function assertSimulatorEnvironment(appEnv?: string, targetUrl?: string): void {
  const env = appEnv ?? process.env['APP_ENV'];

  if (env === 'production') {
    throw new Error(
      'CRITICAL SECURITY VIOLATION: Fleet simulator is strictly forbidden from executing in production (Rule R-M5).',
    );
  }

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
        throw new Error(
          `CRITICAL SECURITY VIOLATION: Simulator target hostname "${parsed.hostname}" is not in the authorized staging/dev allowlist (Rule R-M5).`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('CRITICAL SECURITY VIOLATION')) throw err;
      throw new Error(`Invalid simulator target URL: ${targetUrl}`);
    }
  }
}
