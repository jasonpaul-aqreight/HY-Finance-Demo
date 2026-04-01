import { NextRequest, NextResponse } from 'next/server';
import { getReturnOverview } from '@/lib/return/queries-v2';
import { defaultDateRange } from '@/lib/return/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const defaults = defaultDateRange();
  const start = searchParams.get('start_date') || defaults.start;
  const end = searchParams.get('end_date') || defaults.end;

  const data = await getReturnOverview(start, end);
  return NextResponse.json(data);
}
