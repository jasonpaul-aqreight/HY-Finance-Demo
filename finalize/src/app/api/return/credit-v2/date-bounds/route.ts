import { NextResponse } from 'next/server';
import { getReturnDateBounds } from '@/lib/return/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = getReturnDateBounds();
  return NextResponse.json(data);
}
