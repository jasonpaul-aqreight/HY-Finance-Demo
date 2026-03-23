import { NextResponse } from 'next/server';
import { getDateBounds } from '@/lib/expenses/queries';

export async function GET() {
  try {
    const data = getDateBounds();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
