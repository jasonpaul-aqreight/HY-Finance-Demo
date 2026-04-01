import { NextRequest, NextResponse } from 'next/server';
import { getCreditHealthTableV2 } from '@/lib/payment/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const sort = searchParams.get('sort') ?? 'total_outstanding';
    const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('page_size') ?? '20', 10);
    const search = searchParams.get('search') ?? '';
    const risk = searchParams.get('risk') ?? '';
    const category = searchParams.get('category') ?? '';

    const data = await getCreditHealthTableV2(sort, order, page, pageSize, search, risk, category);
    return NextResponse.json(data);
  } catch (err) {
    console.error('v2/credit-health error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
