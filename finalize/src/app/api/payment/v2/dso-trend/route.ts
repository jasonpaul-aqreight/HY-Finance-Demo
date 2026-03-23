import { NextRequest, NextResponse } from 'next/server';
import { getDsoTrendV2 } from '@/lib/payment/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('start_date') ?? '';
    const endDate = searchParams.get('end_date') ?? '';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const data = getDsoTrendV2(startDate, endDate);
    return NextResponse.json(data);
  } catch (err) {
    console.error('v2/dso-trend error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
