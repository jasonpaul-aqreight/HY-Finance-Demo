import { NextResponse } from 'next/server';
import { getPool } from '@/lib/sales/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      MIN(doc_date)::text AS min_date,
      MAX(doc_date)::text AS max_date
    FROM pc_sales_daily
  `);

  return NextResponse.json(rows[0]);
}
