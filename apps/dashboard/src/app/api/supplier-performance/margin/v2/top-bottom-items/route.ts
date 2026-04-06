import { NextRequest, NextResponse } from 'next/server';
import { getTopBottomItemsV2 } from '@/lib/supplier-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const start = params.get('start_date') ?? '';
    const end = params.get('end_date') ?? '';
    const supplierTypes = params.getAll('supplier_type');
    const itemGroups = params.getAll('item_group');

    const limit = parseInt(params.get('limit') ?? '10', 10);
    const order = params.get('order') === 'asc' ? 'asc' : 'desc';
    const sortBy = params.get('sort_by') === 'margin_pct' ? 'margin_pct' as const : 'profit' as const;

    const result = await getTopBottomItemsV2(
      start,
      end,
      supplierTypes.length > 0 ? supplierTypes : undefined,
      itemGroups.length > 0 ? itemGroups : undefined,
      limit,
      order,
      sortBy
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('top-bottom-items error:', err);
    return NextResponse.json({ error: 'Failed to fetch top/bottom items' }, { status: 500 });
  }
}
