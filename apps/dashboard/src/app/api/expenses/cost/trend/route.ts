import { NextRequest, NextResponse } from 'next/server';
import { getCostTrendByType, type CostTypeParam, type GranularityParam } from '@/lib/expenses/queries';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get('start_date') ?? '2025-03-01';
  const end = params.get('end_date') ?? '2026-02-28';
  const costType = (params.get('cost_type') ?? 'all') as CostTypeParam;
  const granularity = (params.get('granularity') ?? 'monthly') as GranularityParam;

  try {
    const data = await getCostTrendByType(start, end, costType, granularity);
    return NextResponse.json({ granularity, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
