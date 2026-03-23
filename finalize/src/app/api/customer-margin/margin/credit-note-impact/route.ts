import { NextRequest, NextResponse } from 'next/server';
import { getCreditNoteImpact, type MarginFilters } from '@/lib/customer-margin/queries';
import { defaultFullRange } from '@/lib/customer-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const defaults = defaultFullRange();
    const filters: MarginFilters = {
      start: searchParams.get('date_from') ?? defaults.start,
      end: searchParams.get('date_to') ?? defaults.end,
      customers: searchParams.getAll('customer').filter(Boolean),
      types: searchParams.getAll('type').filter(Boolean),
      agents: searchParams.getAll('agent').filter(Boolean),
    };
    return NextResponse.json(getCreditNoteImpact(filters));
  } catch (err) {
    console.error('Credit note impact error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
