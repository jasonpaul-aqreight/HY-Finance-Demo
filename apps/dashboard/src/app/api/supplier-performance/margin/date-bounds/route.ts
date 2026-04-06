import { NextResponse } from 'next/server';
import { getDateBounds } from '@/lib/supplier-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bounds = await getDateBounds();
    return NextResponse.json(bounds);
  } catch (error) {
    console.error('Error fetching date bounds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch date bounds' },
      { status: 500 },
    );
  }
}
