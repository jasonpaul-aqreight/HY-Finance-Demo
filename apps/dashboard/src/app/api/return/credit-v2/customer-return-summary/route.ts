import { NextRequest, NextResponse } from 'next/server';
import { getCustomerReturnSummary } from '@/lib/return/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const debtorCode = searchParams.get('debtor_code');
    if (!debtorCode) {
      return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
    }

    const data = await getCustomerReturnSummary(debtorCode);
    return NextResponse.json(data);
  } catch (err) {
    console.error('customer-return-summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
