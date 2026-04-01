import { NextResponse } from 'next/server';
import { getMultiYearPL } from '@/lib/pnl/queries-v3';

export async function GET() {
  const data = await getMultiYearPL();
  return NextResponse.json(data);
}
