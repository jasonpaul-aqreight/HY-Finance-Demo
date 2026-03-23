import { NextRequest, NextResponse } from 'next/server';
import { getV2YoY } from '@/lib/pnl/queries-v3';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fy = sp.get('fy');
  if (!fy) return NextResponse.json({ error: 'fy required' }, { status: 400 });

  const data = getV2YoY(fy);
  return NextResponse.json(data);
}
