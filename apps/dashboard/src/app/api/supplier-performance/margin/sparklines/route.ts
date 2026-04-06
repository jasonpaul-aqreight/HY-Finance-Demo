import { NextRequest, NextResponse } from 'next/server';
import { getSupplierSparklines } from '@/lib/supplier-margin/queries';
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

    const rows = await getSupplierSparklines(start, end, suppliers, itemGroups);

    // Aggregate into Record<string, { period, margin_pct }[]> keyed by creditor_code
    const data: Record<string, { period: string; margin_pct: number }[]> = {};
    for (const row of rows) {
      if (!data[row.creditor_code]) data[row.creditor_code] = [];
      data[row.creditor_code].push({
        period: row.period,
        margin_pct: row.margin_pct ?? 0,
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching supplier sparklines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier sparklines' },
      { status: 500 },
    );
  }
}
