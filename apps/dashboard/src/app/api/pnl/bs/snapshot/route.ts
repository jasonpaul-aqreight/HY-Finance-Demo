import { NextRequest, NextResponse } from 'next/server';
import { getBSSnapshot } from '@/lib/pnl/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const periodTo = parseInt(searchParams.get('period_to') || '24302', 10);
    const project = searchParams.get('project') || undefined;

    const data = await getBSSnapshot(periodTo, project);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching BS snapshot:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
