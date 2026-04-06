import { NextRequest, NextResponse } from 'next/server';
import { getCostKpis } from '@/lib/expenses/queries';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get('start_date') ?? '2025-03-01';
  const end = params.get('end_date') ?? '2026-02-28';

  try {
    const data = await getCostKpis(start, end);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
