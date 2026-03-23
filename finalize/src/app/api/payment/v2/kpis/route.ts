import { NextRequest, NextResponse } from 'next/server';
import { getKpisV2 } from '@/lib/payment/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('start_date') ?? '';
    const endDate = searchParams.get('end_date') ?? '';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const kpis = getKpisV2(startDate, endDate);
    return NextResponse.json(kpis);
  } catch (err) {
    console.error('v2/kpis error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
