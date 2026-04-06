import { NextRequest, NextResponse } from 'next/server';
import { getMarginSummary } from '@/lib/supplier-margin/queries';
import { defaultDateRange } from '@/lib/supplier-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const defaults = defaultDateRange();
    const start = searchParams.get('start_date') || defaults.start;
    const end = searchParams.get('end_date') || defaults.end;

    const data = await getMarginSummary(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching margin summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch margin summary' },
      { status: 500 },
    );
  }
}
