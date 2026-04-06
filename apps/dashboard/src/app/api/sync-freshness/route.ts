import { NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT status, completed_at, error_message
       FROM sync_job
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return NextResponse.json({ status: 'none' });
    }

    return NextResponse.json(rows[0]);
  } catch {
    return NextResponse.json({ status: 'none' });
  }
}
