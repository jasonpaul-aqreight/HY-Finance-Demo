import { NextRequest, NextResponse } from 'next/server';
import { getAgingBuckets, getRefDate } from '@/lib/payment/queries';
import type { Filters } from '@/lib/payment/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const refDate = getRefDate();
    const filters: Filters = {};

    const debtorTypes = searchParams.getAll('debtor_type');
    if (debtorTypes.length > 0) filters.debtorTypes = debtorTypes;

    const agents = searchParams.getAll('agent');
    if (agents.length > 0) filters.agents = agents;

    const customer = searchParams.get('customer');
    if (customer) filters.customer = customer;

    const terms = searchParams.getAll('term');
    if (terms.length > 0) filters.terms = terms;

    const buckets = await getAgingBuckets(refDate, filters);
    return NextResponse.json(buckets);
  } catch (err) {
    console.error('aging error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
