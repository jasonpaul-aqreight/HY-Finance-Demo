import { NextRequest, NextResponse } from 'next/server';
import { getCustomerInvoices, getRefDate } from '@/lib/payment/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const debtorCode = searchParams.get('debtor_code');
    if (!debtorCode) {
      return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
    }

    const refDate = getRefDate();
    const invoices = getCustomerInvoices(debtorCode, refDate);
    return NextResponse.json(invoices);
  } catch (err) {
    console.error('customer-invoices error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
