import { NextRequest, NextResponse } from 'next/server';
import { getV2YoY } from '@/lib/pnl/queries';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fy = sp.get('fy');
  if (!fy) return NextResponse.json({ error: 'fy required' }, { status: 400 });

  const data = await getV2YoY(fy);
  return NextResponse.json(data);
}
