import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/pnl/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getProjects();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching projects:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
