import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/sales/db';

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const start = sp.get('start_date') ?? '2000-01-01';
  const end = sp.get('end_date') ?? '2099-12-31';
  const granularity = sp.get('granularity') ?? 'monthly';

  let periodExpr: string;
  switch (granularity) {
    case 'daily':
      periodExpr = "strftime('%Y-%m-%d', DocDate, '+8 hours')";
      break;
    case 'weekly':
      periodExpr = "strftime('%Y-W%W', DocDate, '+8 hours')";
      break;
    default:
      periodExpr = "strftime('%Y-%m', DocDate, '+8 hours')";
  }

  const db = getDb();
  const rows = db.prepare(`
    SELECT
      period,
      invoice_revenue,
      cashsales_revenue,
      cn_amount,
      AVG(invoice_revenue + cashsales_revenue + cn_amount)
        OVER (ORDER BY period ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg
    FROM (
      SELECT
        ${periodExpr} AS period,
        COALESCE(SUM(CASE WHEN src='IV' THEN NetTotal ELSE 0 END), 0) AS invoice_revenue,
        COALESCE(SUM(CASE WHEN src='CS' THEN NetTotal ELSE 0 END), 0) AS cashsales_revenue,
        COALESCE(SUM(CASE WHEN src='CN' THEN -NetTotal ELSE 0 END), 0) AS cn_amount
      FROM (
        SELECT 'IV' AS src, NetTotal, DocDate FROM iv WHERE Cancelled='F'
        UNION ALL
        SELECT 'CS', NetTotal, DocDate FROM cs WHERE Cancelled='F'
        UNION ALL
        SELECT 'CN', NetTotal, DocDate FROM cn WHERE Cancelled='F'
      )
      WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY period
    )
    ORDER BY period
  `).all(start, end);

  return NextResponse.json({ data: rows });
}
