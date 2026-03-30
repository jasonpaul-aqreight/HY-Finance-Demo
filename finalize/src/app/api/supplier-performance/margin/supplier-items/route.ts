import { NextRequest, NextResponse } from 'next/server';
import { getSupplierItems } from '@/lib/supplier-margin/queries';
import { defaultDateRange } from '@/lib/supplier-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const creditorCode = searchParams.get('creditor_code');

    if (!creditorCode) {
      return NextResponse.json(
        { error: 'creditor_code is required' },
        { status: 400 },
      );
    }

    const defaults = defaultDateRange();
    const start = searchParams.get('start_date') ?? defaults.start;
    const end = searchParams.get('end_date') ?? defaults.end;

    const data = getSupplierItems(creditorCode, start, end);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching supplier items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier items' },
      { status: 500 },
    );
  }
}
