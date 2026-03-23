import { NextResponse } from 'next/server';
import { getReturnAging } from '@/lib/return/queries-v2';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = getReturnAging();
  return NextResponse.json(data);
}
