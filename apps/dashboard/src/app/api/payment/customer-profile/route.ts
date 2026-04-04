import { NextRequest, NextResponse } from 'next/server';
import { getCustomerProfile } from '@/lib/payment/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const debtorCode = searchParams.get('debtor_code');
    if (!debtorCode) {
      return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
    }

    const data = await getCustomerProfile(debtorCode);
    return NextResponse.json(data);
  } catch (err) {
    console.error('customer-profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
