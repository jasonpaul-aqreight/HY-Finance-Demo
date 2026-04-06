import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/sales/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const start = sp.get('start_date') ?? '2000-01-01';
  const end = sp.get('end_date') ?? '2099-12-31';
  const granularity = sp.get('granularity') ?? 'monthly';

  let periodExpr: string;
  let groupExpr: string;
  let orderExpr: string;
  switch (granularity) {
    case 'daily':
      periodExpr = `doc_date::text`;
      groupExpr = `doc_date`;
      orderExpr = `doc_date`;
      break;
    case 'weekly':
      periodExpr = `TO_CHAR(doc_date, 'IYYY-"W"IW')`;
      groupExpr = `TO_CHAR(doc_date, 'IYYY-"W"IW')`;
      orderExpr = `MIN(doc_date)`;
      break;
    default:
      periodExpr = `TO_CHAR(doc_date, 'YYYY-MM')`;
      groupExpr = `TO_CHAR(doc_date, 'YYYY-MM')`;
      orderExpr = `MIN(doc_date)`;
  }

  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      ${periodExpr} AS period,
      SUM(invoice_total)::float AS invoice_revenue,
      SUM(cash_total)::float AS cashsales_revenue,
      (-SUM(cn_total))::float AS cn_amount,
      AVG(SUM(net_revenue))
        OVER (ORDER BY ${orderExpr} ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)::float AS moving_avg
    FROM pc_sales_daily
    WHERE doc_date BETWEEN $1 AND $2
    GROUP BY ${groupExpr}
    ORDER BY ${orderExpr}
  `, [start, end]);

  return NextResponse.json({ data: rows });
}
