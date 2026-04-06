import { NextResponse } from 'next/server';
import { getMultiYearPL } from '@/lib/pnl/queries';

export async function GET() {
  const data = await getMultiYearPL();
  return NextResponse.json(data);
}
