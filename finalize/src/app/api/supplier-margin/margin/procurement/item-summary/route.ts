import { NextResponse } from 'next/server';
import { getItemProcurementSummary } from '@/lib/supplier-margin/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start_date');
    const end = searchParams.get('end_date');
    const itemCode = searchParams.get('item_code');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    if (!itemCode) {
      return NextResponse.json(
        { error: 'item_code is required' },
        { status: 400 }
      );
    }

    const result = getItemProcurementSummary(itemCode, start, end);
    return NextResponse.json(result);
  } catch (err) {
    console.error('procurement/item-summary error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch item procurement summary' },
      { status: 500 }
    );
  }
}
