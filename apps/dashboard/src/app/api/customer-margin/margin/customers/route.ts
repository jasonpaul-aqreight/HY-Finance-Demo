import { NextRequest, NextResponse } from 'next/server';
import { getCustomerMargins, type MarginFilters } from '@/lib/customer-margin/queries';
import { defaultFullRange, getPreviousPeriod } from '@/lib/customer-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const defaults = defaultFullRange();
    const filters: MarginFilters = {
      start: searchParams.get('date_from') || defaults.start,
      end: searchParams.get('date_to') || defaults.end,
      customers: searchParams.getAll('customer').filter(Boolean),
      types: searchParams.getAll('type').filter(Boolean),
      agents: searchParams.getAll('agent').filter(Boolean),
    };
    const sort = searchParams.get('sort') ?? 'gross_profit';
    const order = searchParams.get('order') ?? 'desc';
    const page = parseInt(searchParams.get('page') ?? '1') || 1;
    const limit = parseInt(searchParams.get('limit') ?? '50') || 50;

    const current = await getCustomerMargins(filters, sort, order, page, limit);

    // Prior-period trend comparison
    const { prevStart, prevEnd } = getPreviousPeriod(filters.start, filters.end);
    const priorFilters: MarginFilters = { ...filters, start: prevStart, end: prevEnd };
    const prior = await getCustomerMargins(priorFilters, 'gross_profit', 'desc', 1, 99999);
    const prevMap = new Map(prior.rows.map(r => [r.debtor_code, r.margin_pct]));

    const rows = current.rows.map(r => {
      const prev = prevMap.get(r.debtor_code) ?? 0;
      const curr = r.margin_pct;
      const trend: 'up' | 'down' | 'flat' =
        curr > prev + 0.5 ? 'up' : curr < prev - 0.5 ? 'down' : 'flat';
      return { ...r, trend };
    });

    return NextResponse.json({ rows, total: current.total });
  } catch (err) {
    console.error('Customers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
