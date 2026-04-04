import { NextRequest, NextResponse } from 'next/server';
import { getV2PLStatement } from '@/lib/pnl/queries';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fy = sp.get('fy');
  if (!fy) return NextResponse.json({ error: 'fy required' }, { status: 400 });

  const projects = sp.get('projects')?.split(',').filter(Boolean) || undefined;
  const data = await getV2PLStatement(fy, projects);
  return NextResponse.json(data);
}
