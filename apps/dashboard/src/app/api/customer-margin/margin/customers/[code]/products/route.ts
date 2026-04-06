import { NextRequest, NextResponse } from 'next/server';
import { getCustomerProducts } from '@/lib/customer-margin/queries';
import { defaultFullRange } from '@/lib/customer-margin/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { searchParams } = req.nextUrl;
    const defaults = defaultFullRange();
    const start = searchParams.get('date_from') || defaults.start;
    const end = searchParams.get('date_to') || defaults.end;
    const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
    const limit = parseInt(searchParams.get('limit') ?? '25', 10) || 25;
    const result = await getCustomerProducts(code, start, end, page, limit);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Customer products error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
