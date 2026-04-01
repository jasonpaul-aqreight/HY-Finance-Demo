import { NextRequest, NextResponse } from 'next/server';
import { getItemSupplierSummaryV2, getItemSellPriceV2 } from '@/lib/supplier-margin/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const start = params.get('start_date') ?? '';
    const end = params.get('end_date') ?? '';
    const itemCode = params.get('item_code') ?? '';

    if (!itemCode) {
      return NextResponse.json({ error: 'item_code is required' }, { status: 400 });
    }

    const suppliers = await getItemSupplierSummaryV2(itemCode, start, end);
    const sellPrice = await getItemSellPriceV2(itemCode, start, end);

    return NextResponse.json({ suppliers, sellPrice });
  } catch (err) {
    console.error('item-summary error:', err);
    return NextResponse.json({ error: 'Failed to fetch item summary' }, { status: 500 });
  }
}
