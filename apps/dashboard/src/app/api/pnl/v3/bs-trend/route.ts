import { NextRequest, NextResponse } from 'next/server';
import { getV3BSTrend } from '@/lib/pnl/queries';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fy = sp.get('fy');
  if (!fy) return NextResponse.json({ error: 'fy required' }, { status: 400 });

  const range = sp.get('range') || 'fy';
  const data = await getV3BSTrend(fy, range);
  return NextResponse.json(data);
}
