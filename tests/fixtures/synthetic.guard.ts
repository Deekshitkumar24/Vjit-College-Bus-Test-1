/**
 * Guard ensuring test factories refuse to run in production environments (Part 15.5).
 */
export function assertNonProduction() {
  const env = process.env['APP_ENV'];
  if (env === 'production') {
    throw new Error(
      'CRITICAL SECURITY VIOLATION: Test factories and synthetic data cannot run in production (R-M5, Part 15.5).',
    );
  }
}
