import { NextResponse } from 'next/server';
import { getFilterCustomers } from '@/lib/customer-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getFilterCustomers());
  } catch (err) {
    console.error('Filter customers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
