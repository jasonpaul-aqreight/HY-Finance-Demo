import { NextRequest, NextResponse } from 'next/server';
import { getDataQuality } from '@/lib/customer-margin/queries';
import { defaultFullRange } from '@/lib/customer-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const defaults = defaultFullRange();
    const start = searchParams.get('date_from') || defaults.start;
    const end = searchParams.get('date_to') || defaults.end;
    return NextResponse.json(await getDataQuality(start, end));
  } catch (err) {
    console.error('Data quality error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
