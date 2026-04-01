import { NextResponse } from 'next/server';
import { getFilterTypes } from '@/lib/customer-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getFilterTypes());
  } catch (err) {
    console.error('Filter types error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
