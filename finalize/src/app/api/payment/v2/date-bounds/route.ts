import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payment/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        MIN(DATE(DocDate, '+8 hours')) AS min_date,
        MAX(DATE(DocDate, '+8 hours')) AS max_date
      FROM ar_invoice
      WHERE Cancelled = 'F'
    `).get() as { min_date: string; max_date: string } | undefined;

    return NextResponse.json({
      min_date: row?.min_date ?? '',
      max_date: row?.max_date ?? '',
    });
  } catch (err) {
    console.error('date-bounds error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
