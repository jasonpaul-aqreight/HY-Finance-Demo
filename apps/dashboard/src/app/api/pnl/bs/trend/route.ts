import { NextRequest, NextResponse } from 'next/server';
import { getBSTrend } from '@/lib/pnl/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const periods = parseInt(searchParams.get('periods') || '12', 10);

    const data = await getBSTrend(periods);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching BS trend:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
