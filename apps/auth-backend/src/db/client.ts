import pg from 'pg';

const { Pool } = pg;

// TODO: Use this pool once we migrate from in-memory token store to PostgreSQL
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://pmos:pmos@localhost:5432/pmos_auth',
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
