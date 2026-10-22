import { Pool } from 'pg';
import { getRlsAndAuditSql } from './rls-manager.js';

export interface TestDatabaseHandle {
  dbName: string;
  superuserPool: Pool;
  runtimePool: Pool;
  destroy: () => Promise<void>;
}

/**
 * Creates a transient, uniquely named PostgreSQL test database with PostGIS
 * natively on Windows (per Section 1A, OV-20, Decision O9).
 * Roles created:
 * - app_migrator: schema owner/migrator
 * - app_runtime: execution role with NOBYPASSRLS (strict RLS enforcement)
 * - app_worker: background worker role
 */
export async function createTransientTestDatabase(): Promise<TestDatabaseHandle> {
  const adminUrl =
    process.env['DATABASE_URL_TEST'] ||
    process.env['DATABASE_URL'] ||
    'postgresql://postgres:@localhost:5432/postgres';

  if (process.env['APP_ENV'] === 'production') {
    throw new Error('Refusing to create test database: APP_ENV is production');
  }

  const parsedUrl = new URL(adminUrl);
  if (
    parsedUrl.pathname.includes('prod') ||
    parsedUrl.pathname.includes('production')
  ) {
    throw new Error('Refusing to run: target database name looks like production');
  }

  const baseDbPool = new Pool({ connectionString: adminUrl });
  const randomSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const dbName = `cb_test_${randomSuffix}`;

  // 1. Create uniquely named test database (using collegebus as template if present)
  const adminClient = await baseDbPool.connect();
  try {
    const templateCheck = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = 'collegebus';`,
    );
    if (templateCheck.rows.length > 0) {
      await adminClient.query(
        `CREATE DATABASE "${dbName}" TEMPLATE collegebus;`,
      );
    } else {
      await adminClient.query(`CREATE DATABASE "${dbName}";`);
    }
  } finally {
    adminClient.release();
  }

  const testDbSuperuserUrl = new URL(adminUrl);
  testDbSuperuserUrl.pathname = `/${dbName}`;

  const superuserPool = new Pool({
    connectionString: testDbSuperuserUrl.toString(),
  });

  const suClient = await superuserPool.connect();
  try {
    // 2. Extensions
    await suClient.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await suClient.query('CREATE EXTENSION IF NOT EXISTS citext;');
    await suClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 3. Roles creation if not exist
    await suClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_migrator') THEN
          CREATE ROLE app_migrator WITH LOGIN PASSWORD 'migrator_pass' CREATEDB;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
          CREATE ROLE app_runtime WITH LOGIN PASSWORD 'runtime_pass' NOSUPERUSER NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_worker') THEN
          CREATE ROLE app_worker WITH LOGIN PASSWORD 'worker_pass' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    // 4. Create base tables
    await suClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email CITEXT UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        college_email_exception BOOLEAN NOT NULL DEFAULT false,
        exception_reason TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        is_synthetic BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        granted_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        is_synthetic BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        entity_id UUID,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. RLS and audit trigger
    await suClient.query(getRlsAndAuditSql());

    // 6. Grants for app_runtime and app_worker
    await suClient.query(`
      GRANT CONNECT ON DATABASE "${dbName}" TO app_runtime, app_worker, app_migrator;
      GRANT USAGE ON SCHEMA public TO app_runtime, app_worker, app_migrator;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime, app_worker;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime, app_worker;
    `);
  } finally {
    suClient.release();
  }

  // 7. Connect as app_runtime (NOBYPASSRLS)
  const runtimeUrl = new URL(testDbSuperuserUrl.toString());
  runtimeUrl.username = 'app_runtime';
  runtimeUrl.password = 'runtime_pass';

  const runtimePool = new Pool({
    connectionString: runtimeUrl.toString(),
  });

  const destroy = async () => {
    try {
      await runtimePool.end();
    } catch {
      // ignore
    }
    try {
      await superuserPool.end();
    } catch {
      // ignore
    }
    const dropClient = await baseDbPool.connect();
    try {
      await dropClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`);
    } finally {
      dropClient.release();
      await baseDbPool.end();
    }
  };

  return {
    dbName,
    superuserPool,
    runtimePool,
    destroy,
  };
}
