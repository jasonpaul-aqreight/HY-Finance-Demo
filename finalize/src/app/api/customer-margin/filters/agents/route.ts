import { NextResponse } from 'next/server';
import { getFilterAgents } from '@/lib/customer-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(getFilterAgents());
  } catch (err) {
    console.error('Filter agents error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
