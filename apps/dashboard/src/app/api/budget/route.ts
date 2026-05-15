import { NextResponse } from 'next/server';
import { getGlobalBudget, saveGlobalBudget } from '@/lib/budget/queries';

export const dynamic = 'force-dynamic';

function isBudgetAdmin(req: Request) {
  return req.headers.get('x-user-role') === 'admin';
}

export async function GET() {
  try {
    const rows = await getGlobalBudget();
    return NextResponse.json({ budget: rows });
  } catch (err) {
    console.error('Error fetching budget:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!isBudgetAdmin(req)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const { lines, userName, note } = body as {
      lines?: { line_item: string; annual_budget: number; monthly_budget: number }[];
      userName?: string;
      note?: string | null;
    };

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'Missing budget lines' }, { status: 400 });
    }

    const cleanLines = lines.map((line) => ({
      line_item: String(line.line_item || '').trim(),
      annual_budget: Number(line.annual_budget),
      monthly_budget: Number(line.monthly_budget),
    }));

    if (
      cleanLines.some(
        (line) =>
          !line.line_item ||
          !Number.isFinite(line.annual_budget) ||
          !Number.isFinite(line.monthly_budget),
      )
    ) {
      return NextResponse.json({ error: 'Invalid budget line values' }, { status: 400 });
    }

    await saveGlobalBudget(cleanLines, {
      userName: userName || 'Admin',
      note: note ?? null,
    });

    const budget = await getGlobalBudget();
    return NextResponse.json({ ok: true, budget });
  } catch (err) {
    console.error('Error updating budget:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    const isClientError = msg.startsWith('Unsupported budget line_item');
    return NextResponse.json(
      { error: isClientError ? msg : 'Internal server error' },
      { status: isClientError ? 400 : 500 },
    );
  }
}
