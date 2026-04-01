import { NextResponse } from 'next/server';
import { getFiscalYears } from '@/lib/pnl/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getFiscalYears();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching fiscal years:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
