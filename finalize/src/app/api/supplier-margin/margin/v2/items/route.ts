import { NextRequest, NextResponse } from 'next/server';
import { getItemListV2 } from '@/lib/supplier-margin/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const start = params.get('start_date') ?? '';
    const end = params.get('end_date') ?? '';
    const supplierTypes = params.getAll('supplier_type');
    const itemGroups = params.getAll('item_group');

    const result = getItemListV2(
      start,
      end,
      supplierTypes.length > 0 ? supplierTypes : undefined,
      itemGroups.length > 0 ? itemGroups : undefined
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('items error:', err);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
