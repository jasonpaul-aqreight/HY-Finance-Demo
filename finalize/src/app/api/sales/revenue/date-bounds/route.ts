import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sales/db';

export function GET() {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      MIN(DATE(DocDate, '+8 hours')) AS min_date,
      MAX(DATE(DocDate, '+8 hours')) AS max_date
    FROM (
      SELECT DocDate FROM iv WHERE Cancelled = 'F'
      UNION ALL
      SELECT DocDate FROM cs WHERE Cancelled = 'F'
    )
  `).get() as { min_date: string; max_date: string };

  return NextResponse.json(row);
}
