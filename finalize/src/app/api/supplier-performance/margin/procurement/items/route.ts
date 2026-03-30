import { NextResponse } from 'next/server';
import { getItemListProcurement } from '@/lib/supplier-margin/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start_date');
    const end = searchParams.get('end_date');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    const result = getItemListProcurement(start, end);
    return NextResponse.json(result);
  } catch (err) {
    console.error('procurement/items error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch procurement items' },
      { status: 500 }
    );
  }
}
