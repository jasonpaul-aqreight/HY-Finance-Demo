import { NextResponse } from 'next/server';
import { getDateBounds } from '@/lib/expenses/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDateBounds();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
