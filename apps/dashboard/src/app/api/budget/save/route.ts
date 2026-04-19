import { NextResponse } from 'next/server';
import { saveBudget } from '@/lib/budget/queries';
import { getV2PLStatement } from '@/lib/pnl/queries';

export const dynamic = 'force-dynamic';

/**
 * Approve AI-generated budget: computes headline P&L budget lines from
 * the fiscal year's actual data (monthly average x 12) and saves them.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fiscalYear } = body as { fiscalYear: string };

    if (!fiscalYear) {
      return NextResponse.json({ error: 'Missing fiscalYear' }, { status: 400 });
    }

    const stmt = await getV2PLStatement(fiscalYear);
    const monthCount = stmt.months.length || 1;

    // Compute headline P&L budget lines (same logic as fv_budget_suggestions)
    const computed = stmt.computed;
    const netSales = computed.net_sales.ytd;
    const grossProfit = computed.gross_profit.ytd;
    const netProfit = computed.net_profit.ytd;

    // Derive COGS and Operating Costs from statement groups
    let cogs = 0;
    let expenses = 0;
    for (const g of stmt.groups) {
      if (g.acc_type === 'CO') cogs += g.subtotal.ytd;
      if (g.acc_type === 'EP') expenses += g.subtotal.ytd;
    }

    const headlines = [
      { name: 'Net Sales', value: netSales },
      { name: 'Cost of Sales', value: cogs },
      { name: 'Gross Profit', value: grossProfit },
      { name: 'Operating Costs', value: expenses },
      { name: 'Net Profit', value: netProfit },
    ];

    const lines = headlines.map(h => {
      const monthly = Math.round(h.value / monthCount);
      return { line_item: h.name, monthly_budget: monthly, annual_budget: monthly * 12 };
    });

    await saveBudget(fiscalYear, lines);
    return NextResponse.json({ ok: true, lines });
  } catch (err) {
    console.error('Error approving budget:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
