import { NextResponse } from 'next/server';
import { getCreditUtilizationV2 } from '@/lib/payment/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getCreditUtilizationV2();
    return NextResponse.json(data);
  } catch (err) {
    console.error('v2/credit-utilization error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
