import { NextRequest, NextResponse } from 'next/server';
import { getKpisV2 } from '@/lib/payment/queries-v2';
import { getRefDate } from '@/lib/payment/queries';
import { getMonthsBack, monthStart, monthEnd } from '@/lib/payment/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const refDate = getRefDate();
    const months = getMonthsBack(refDate, 12);
    const defaultStart = monthStart(months[0]);
    const defaultEnd = monthEnd(months[months.length - 1]);
    const startDate = searchParams.get('start_date') || defaultStart;
    const endDate = searchParams.get('end_date') || defaultEnd;

    const kpis = await getKpisV2(startDate, endDate);
    return NextResponse.json(kpis);
  } catch (err) {
    console.error('v2/kpis error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
