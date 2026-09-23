import pg from 'pg';

const { Pool } = pg;

export function createDbPool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: 'evidra-api',
  });
}

export async function closeDbPool(pool: pg.Pool): Promise<void> {
  await pool.end();
}
