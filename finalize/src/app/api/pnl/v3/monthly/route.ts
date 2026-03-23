import { NextRequest, NextResponse } from 'next/server';
import { getV2PLMonthly } from '@/lib/pnl/queries-v3';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fy = sp.get('fy');
  if (!fy) return NextResponse.json({ error: 'fy required' }, { status: 400 });

  const projects = sp.get('projects')?.split(',').filter(Boolean) || undefined;
  const range = sp.get('range') || 'fy';
  const data = getV2PLMonthly(fy, projects, range);
  return NextResponse.json(data);
}
