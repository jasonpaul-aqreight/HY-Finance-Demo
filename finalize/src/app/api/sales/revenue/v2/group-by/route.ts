import { NextRequest, NextResponse } from 'next/server';
import {
  getGroupByData,
  getGroupByDataStacked,
  STACK_OPTIONS,
  type GroupByDimension,
  type StackDimension,
} from '@/lib/sales/queries-v2';

const VALID_GROUPS: GroupByDimension[] = ['customer', 'customer-type', 'agent', 'outlet', 'fruit', 'fruit-country', 'fruit-variant'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const group = params.get('group') as GroupByDimension;
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');
  const stack = params.get('stack') as StackDimension | null;

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

  if (stack) {
    const validStacks = STACK_OPTIONS[group];
    if (!validStacks?.includes(stack)) {
      return NextResponse.json(
        { error: `Invalid stack '${stack}' for group '${group}'. Valid: ${validStacks?.join(', ') ?? 'none'}` },
        { status: 400 }
      );
    }
    const data = getGroupByDataStacked(group, stack, startDate, endDate);
    return NextResponse.json({ group, stack, data });
  }

  const data = getGroupByData(group, startDate, endDate);
  return NextResponse.json({ group, data });
}
