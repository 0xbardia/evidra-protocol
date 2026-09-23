import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';

export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const directory = new URL('../migrations/', import.meta.url);
  const filenames = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const filename of filenames) {
    const already = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations WHERE filename = $1', [filename]);
    if (already.rowCount) continue;
    const sql = await readFile(new URL(filename, directory), 'utf8');
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await connection.query('COMMIT');
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const { createDbPool, closeDbPool } = await import('./pool.js');
  const pool = createDbPool(url);
  try { await migrate(pool); } finally { await closeDbPool(pool); }
}
