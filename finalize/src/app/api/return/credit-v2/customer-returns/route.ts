import { NextRequest, NextResponse } from 'next/server';
import { getCustomerReturnDetails, getCustomerReturnDetailsAll } from '@/lib/return/queries-v2';
import { defaultDateRange } from '@/lib/return/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const debtorCode = searchParams.get('debtor_code');
  if (!debtorCode) {
    return NextResponse.json({ error: 'debtor_code is required' }, { status: 400 });
  }

  const startParam = searchParams.get('start_date');
  const endParam = searchParams.get('end_date');

  if (!startParam && !endParam) {
    const data = getCustomerReturnDetailsAll(debtorCode);
    return NextResponse.json(data);
  }

  const defaults = defaultDateRange();
  const start = startParam ?? defaults.start;
  const end = endParam ?? defaults.end;

  const data = getCustomerReturnDetails(debtorCode, start, end);
  return NextResponse.json(data);
}
