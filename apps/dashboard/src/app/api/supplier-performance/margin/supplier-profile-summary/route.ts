import { NextRequest, NextResponse } from 'next/server';
import { getSupplierProfileSummary } from '@/lib/supplier-margin/queries';
import { defaultDateRange } from '@/lib/supplier-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const creditorCode = searchParams.get('creditor_code');
    if (!creditorCode) {
      return NextResponse.json({ error: 'creditor_code is required' }, { status: 400 });
    }

    const defaults = defaultDateRange();
    const start = searchParams.get('start_date') || defaults.start;
    const end = searchParams.get('end_date') || defaults.end;

    const data = await getSupplierProfileSummary(creditorCode, start, end);
    return NextResponse.json(data);
  } catch (err) {
    console.error('supplier-profile-summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
