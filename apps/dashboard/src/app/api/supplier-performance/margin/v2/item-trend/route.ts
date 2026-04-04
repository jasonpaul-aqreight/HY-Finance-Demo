import { NextRequest, NextResponse } from 'next/server';
import { getItemPriceMonthlyV2, getItemPriceWeeklyV2 } from '@/lib/supplier-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const start = params.get('start_date') ?? '';
    const end = params.get('end_date') ?? '';
    const itemCode = params.get('item_code') ?? '';
    const granularity = params.get('granularity') ?? 'monthly';

    if (!itemCode) {
      return NextResponse.json({ error: 'item_code is required' }, { status: 400 });
    }

    const result = granularity === 'weekly'
      ? await getItemPriceWeeklyV2(itemCode, start, end)
      : await getItemPriceMonthlyV2(itemCode, start, end);
    return NextResponse.json(result);
  } catch (err) {
    console.error('item-trend error:', err);
    return NextResponse.json({ error: 'Failed to fetch item trend' }, { status: 500 });
  }
}
