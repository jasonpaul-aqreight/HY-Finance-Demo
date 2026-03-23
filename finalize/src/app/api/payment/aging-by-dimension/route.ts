import { NextRequest, NextResponse } from 'next/server';
import { getAgingBucketsByDimension, getRefDate } from '@/lib/payment/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const refDate = getRefDate();
    const groupBy = (searchParams.get('group_by') ?? 'agent') as 'agent' | 'type';

    if (groupBy !== 'agent' && groupBy !== 'type') {
      return NextResponse.json({ error: 'group_by must be "agent" or "type"' }, { status: 400 });
    }

    const data = getAgingBucketsByDimension(refDate, groupBy);
    return NextResponse.json(data);
  } catch (err) {
    console.error('aging-by-dimension error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
