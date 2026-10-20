import { Pool, PoolClient } from 'pg';
import { assertNonProduction } from './synthetic.guard.js';

/**
 * Transaction-per-test helper (Part 15.1, Part 15.5).
 * Executes a test body inside an isolated PostgreSQL transaction,
 * rolling back after completion so no state leaks between tests.
 */
export async function runInTestTransaction<T>(
  pool: Pool,
  testFn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  assertNonProduction();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await testFn(client);
    await client.query('ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Clean-up hook for test suites.
 */
export async function cleanupTestPool(pool: Pool): Promise<void> {
  await pool.end();
}
