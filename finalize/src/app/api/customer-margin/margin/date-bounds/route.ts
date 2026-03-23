import { NextResponse } from 'next/server';
import { getDateBounds } from '@/lib/customer-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bounds = getDateBounds();
    return NextResponse.json(bounds);
  } catch (err) {
    console.error('date-bounds error:', err);
    return NextResponse.json({ error: 'Failed to fetch date bounds' }, { status: 500 });
  }
}
