import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSalesSummary, getCustomerSalesTrend } from '@/lib/sales/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const debtorCode = searchParams.get('debtor_code');
    if (!debtorCode) {
      return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
    }

    const start = searchParams.get('start_date') || '2024-01-01';
    const end = searchParams.get('end_date') || '2025-12-31';

    const [summary, trend] = await Promise.all([
      getCustomerSalesSummary(debtorCode, start, end),
      getCustomerSalesTrend(debtorCode, start, end),
    ]);

    return NextResponse.json({ summary, trend });
  } catch (err) {
    console.error('customer-sales-summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
