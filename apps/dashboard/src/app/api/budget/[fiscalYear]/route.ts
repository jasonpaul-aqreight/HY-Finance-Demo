import { NextResponse } from 'next/server';
import { getBudget } from '@/lib/budget/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fiscalYear: string }> },
) {
  try {
    const { fiscalYear } = await params;
    const rows = await getBudget(fiscalYear);
    if (rows.length === 0) {
      return NextResponse.json({ budget: null });
    }
    return NextResponse.json({ budget: rows });
  } catch (err) {
    console.error('Error fetching budget:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
