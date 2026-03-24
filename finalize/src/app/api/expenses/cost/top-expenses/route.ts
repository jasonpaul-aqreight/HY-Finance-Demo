import { NextRequest, NextResponse } from 'next/server';
import { getTopExpensesByType, type CostTypeParam } from '@/lib/expenses/queries';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get('start_date') ?? '2025-03-01';
  const end = params.get('end_date') ?? '2026-02-28';
  const costType = (params.get('cost_type') ?? 'all') as CostTypeParam;
  const order = (params.get('order') ?? 'desc') as 'desc' | 'asc';

  try {
    const data = getTopExpensesByType(start, end, costType, order);
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
