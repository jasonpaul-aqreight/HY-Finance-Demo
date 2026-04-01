import { NextRequest, NextResponse } from 'next/server';
import { getRefundSummary, getRefundLog } from '@/lib/return/queries-v2';
import { defaultDateRange } from '@/lib/return/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const defaults = defaultDateRange();
  const start = searchParams.get('start_date') || defaults.start;
  const end = searchParams.get('end_date') || defaults.end;
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);

  const [summary, recent] = await Promise.all([
    getRefundSummary(start, end),
    getRefundLog(start, end, limit),
  ]);

  return NextResponse.json({ summary, recent });
}
