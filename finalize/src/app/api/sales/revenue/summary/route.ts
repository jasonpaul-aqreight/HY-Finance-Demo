import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/sales/db';

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const start = sp.get('start_date') ?? '2000-01-01';
  const end = sp.get('end_date') ?? '2099-12-31';

  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN src='IV' THEN NetTotal ELSE 0 END), 0) AS invoice_revenue,
      COALESCE(SUM(CASE WHEN src='CS' THEN NetTotal ELSE 0 END), 0) AS cashsales_revenue,
      COALESCE(SUM(CASE WHEN src='CN' THEN NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN NetTotal
        WHEN src='CN' THEN -NetTotal
        ELSE 0
      END), 0) AS net_revenue
    FROM (
      SELECT 'IV' AS src, NetTotal, DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT 'CS', NetTotal, DocDate FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT 'CN', NetTotal, DocDate FROM cn WHERE Cancelled='F'
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end);

  return NextResponse.json({ current: row });
}
