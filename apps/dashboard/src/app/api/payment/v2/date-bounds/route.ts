import { NextResponse } from 'next/server';
import { getPool } from '@/lib/payment/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT
        MIN(month) || '-01' AS min_date,
        MAX(month) || '-01' AS max_date
      FROM pc_ar_monthly
      WHERE invoiced > 0
    `);

    return NextResponse.json({
      min_date: rows[0]?.min_date ?? '',
      max_date: rows[0]?.max_date ?? '',
    });
  } catch (err) {
    console.error('date-bounds error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
