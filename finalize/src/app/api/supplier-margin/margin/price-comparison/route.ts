import { NextRequest, NextResponse } from 'next/server';
import { getPriceComparison } from '@/lib/supplier-margin/queries';
import { defaultDateRange } from '@/lib/supplier-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const defaults = defaultDateRange();
    const start = searchParams.get('start_date') ?? defaults.start;
    const end = searchParams.get('end_date') ?? defaults.end;
    const limit = parseInt(searchParams.get('limit') ?? '200', 10);

    const data = getPriceComparison(start, end, limit);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price comparison' },
      { status: 500 },
    );
  }
}
