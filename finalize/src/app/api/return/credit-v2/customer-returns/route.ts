import { NextRequest, NextResponse } from 'next/server';
import { getCustomerReturnDetails } from '@/lib/return/queries-v2';
import { defaultDateRange } from '@/lib/return/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const debtorCode = searchParams.get('debtor_code');
  if (!debtorCode) {
    return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
  }

  const defaults = defaultDateRange();
  const start = searchParams.get('start_date') ?? defaults.start;
  const end = searchParams.get('end_date') ?? defaults.end;

  const data = getCustomerReturnDetails(debtorCode, start, end);
  return NextResponse.json(data);
}
