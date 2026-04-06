import { NextRequest, NextResponse } from 'next/server';
import { getPriceSpread } from '@/lib/supplier-margin/queries';
import { defaultDateRange } from '@/lib/supplier-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const defaults = defaultDateRange();
    const start = searchParams.get('start_date') || defaults.start;
    const end = searchParams.get('end_date') || defaults.end;

    const suppliers = searchParams.getAll('supplier');
    const itemGroups = searchParams.getAll('item_group');
    const data = await getPriceSpread(start, end, suppliers, itemGroups);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching price spread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price spread' },
      { status: 500 },
    );
  }
}
