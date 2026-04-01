import { NextRequest, NextResponse } from 'next/server';
import { getSupplierMarginDistributionV2, getItemMarginDistributionV2 } from '@/lib/supplier-margin/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const start = params.get('start_date') ?? '';
    const end = params.get('end_date') ?? '';
    const supplierTypes = params.getAll('supplier_type');
    const itemGroups = params.getAll('item_group');

    const entity = params.get('entity') === 'items' ? 'items' : 'suppliers';
    const queryFn = entity === 'items' ? getItemMarginDistributionV2 : getSupplierMarginDistributionV2;
    const result = await queryFn(
      start,
      end,
      supplierTypes.length > 0 ? supplierTypes : undefined,
      itemGroups.length > 0 ? itemGroups : undefined
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('distribution error:', err);
    return NextResponse.json({ error: 'Failed to fetch distribution' }, { status: 500 });
  }
}
