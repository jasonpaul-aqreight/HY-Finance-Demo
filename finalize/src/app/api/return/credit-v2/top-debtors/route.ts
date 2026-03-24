import { NextRequest, NextResponse } from 'next/server';
import { getAllCustomerReturns, getAllCustomerReturnsAll } from '@/lib/return/queries-v2';
import { defaultDateRange } from '@/lib/return/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const startParam = searchParams.get('start_date');
  const endParam = searchParams.get('end_date');

  if (!startParam && !endParam) {
    const data = getAllCustomerReturnsAll();
    return NextResponse.json(data);
  }

  const defaults = defaultDateRange();
  const start = startParam ?? defaults.start;
  const end = endParam ?? defaults.end;

  const data = getAllCustomerReturns(start, end);
  return NextResponse.json(data);
}
