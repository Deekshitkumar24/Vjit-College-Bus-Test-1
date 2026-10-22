import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:@localhost:5432/collegebus' });

async function verify() {
  const colRes = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name IN ('college_email_exception', 'exception_reason')
    ORDER BY column_name;
  `);

  console.log('=== P0-T3 DATABASE COLUMNS VERIFICATION ===');
  console.log('Database: Native PostgreSQL 16 on localhost:5432 / collegebus');
  for (const r of colRes.rows) {
    console.log(`Column: ${r.column_name} | Type: ${r.data_type} | Nullable: ${r.is_nullable} | Default: ${r.column_default}`);
  }

  const extRes = await pool.query(`SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';`);
  console.log(`Extension: ${extRes.rows[0]?.extname} (version ${extRes.rows[0]?.extversion})`);

  const migRes = await pool.query(`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;`);
  console.log('Applied Migrations:');
  for (const m of migRes.rows) {
    console.log(` - ${m.migration_name} (at ${m.finished_at})`);
  }

  await pool.end();
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
