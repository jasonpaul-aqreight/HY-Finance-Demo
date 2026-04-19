import { NextRequest, NextResponse } from 'next/server';
import { getCollectionDaysTrendV2, getRefDate } from '@/lib/payment/queries';
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

    const data = await getCollectionDaysTrendV2(startDate, endDate);
    return NextResponse.json(data);
  } catch (err) {
    console.error('v2/collection-days-trend error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
