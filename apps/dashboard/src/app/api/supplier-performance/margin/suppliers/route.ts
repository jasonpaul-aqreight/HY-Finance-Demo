import { NextRequest, NextResponse } from 'next/server';
import { getSupplierTable } from '@/lib/supplier-margin/queries';
import { defaultDateRange, getPreviousPeriod } from '@/lib/supplier-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const defaults = defaultDateRange();
    const start = searchParams.get('start_date') || defaults.start;
    const end = searchParams.get('end_date') || defaults.end;
    const suppliers = searchParams.getAll('supplier');
    const itemGroups = searchParams.getAll('item_group');

    const current = await getSupplierTable(start, end, suppliers, itemGroups);

    // Prior-period trend comparison
    const { prevStart, prevEnd } = getPreviousPeriod(start, end);
    const prior = await getSupplierTable(prevStart, prevEnd, suppliers, itemGroups);
    const prevMap = new Map(prior.map(r => [r.creditor_code, r.margin_pct ?? 0]));

    const data = current.map(r => {
      const prev = prevMap.get(r.creditor_code) ?? 0;
      const curr = r.margin_pct ?? 0;
      const trend: 'up' | 'down' | 'flat' =
        curr > prev + 0.5 ? 'up' : curr < prev - 0.5 ? 'down' : 'flat';
      return { ...r, trend };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching supplier table:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier table' },
      { status: 500 },
    );
  }
}
