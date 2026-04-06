import { NextRequest, NextResponse } from 'next/server';
import { getBSKpis } from '@/lib/pnl/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const periodTo = parseInt(searchParams.get('period_to') || '24302', 10);

    const data = await getBSKpis(periodTo);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching BS KPIs:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
