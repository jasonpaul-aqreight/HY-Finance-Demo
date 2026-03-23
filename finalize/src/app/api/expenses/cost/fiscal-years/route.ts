import { NextResponse } from 'next/server';
import { getFiscalYears } from '@/lib/expenses/queries';

export async function GET() {
  try {
    const data = getFiscalYears();
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
