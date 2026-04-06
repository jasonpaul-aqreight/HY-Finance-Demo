import { Pool } from 'pg';

// ─── Local PostgreSQL (pc_* tables + lookup tables) ─────────────────────────

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// ─── Remote RDS (drill-down queries for row-level detail) ───────────────────

let rdsPool: Pool | null = null;

export function getRdsPool(): Pool {
  if (!rdsPool) {
    rdsPool = new Pool({
      connectionString: process.env.RDS_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return rdsPool;
}

/** Run a query against RDS with graceful fallback on connection failure */
export async function queryRds<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const pool = getRdsPool();
    const { rows } = await pool.query(sql, params);
    return rows as T[];
  } catch (err) {
    console.error('RDS drill-down query failed:', err);
    return [];
  }
}
