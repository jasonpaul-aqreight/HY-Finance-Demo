import { NextRequest, NextResponse } from 'next/server';
import {
  getGroupByData,
  type GroupByDimension,
} from '@/lib/sales/queries-v2';

const VALID_GROUPS: GroupByDimension[] = ['customer', 'customer-type', 'agent', 'outlet', 'fruit'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const group = params.get('group') as GroupByDimension;
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');

  if (!group || !VALID_GROUPS.includes(group)) {
    return NextResponse.json(
      { error: `Invalid group. Must be one of: ${VALID_GROUPS.join(', ')}` },
      { status: 400 }
    );
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'start_date and end_date are required' },
      { status: 400 }
    );
  }

  const data = await getGroupByData(group, startDate, endDate);
  return NextResponse.json({ group, data });
}
