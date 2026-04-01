import { NextRequest, NextResponse } from 'next/server';
import { getCustomerReturnTrend } from '@/lib/return/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const debtorCode = searchParams.get('debtor_code');
    if (!debtorCode) {
      return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
    }

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const data = await getCustomerReturnTrend(debtorCode, startDate, endDate);
    return NextResponse.json(data);
  } catch (err) {
    console.error('customer-return-trend error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
