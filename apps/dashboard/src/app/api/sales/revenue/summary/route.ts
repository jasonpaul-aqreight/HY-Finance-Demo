import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/sales/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const start = sp.get('start_date') ?? '2000-01-01';
  const end = sp.get('end_date') ?? '2099-12-31';

  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(invoice_total), 0)::float AS invoice_revenue,
      COALESCE(SUM(cash_total), 0)::float AS cashsales_revenue,
      COALESCE(SUM(cn_total), 0)::float AS credit_notes,
      COALESCE(SUM(net_revenue), 0)::float AS net_revenue
    FROM pc_sales_daily
    WHERE doc_date BETWEEN $1 AND $2
  `, [start, end]);

  return NextResponse.json({ current: rows[0] });
}
