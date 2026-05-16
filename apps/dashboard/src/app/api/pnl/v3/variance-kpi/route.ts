import { NextRequest, NextResponse } from 'next/server';
import { getVarianceKpiTiles } from '@/lib/ai-insight/data-fetcher';
import type { FiscalPeriod, FiscalRange } from '@/lib/ai-insight/types';

export const dynamic = 'force-dynamic';

const FINANCIAL_KPI_CODES = new Set(['NS', 'CO', 'EP']);

function parsePeriod(req: NextRequest): FiscalPeriod {
  const sp = req.nextUrl.searchParams;
  const fiscalYear = sp.get('fy');
  if (!fiscalYear) throw new Error('fy required');
  const range = (sp.get('range') || 'fy') as FiscalRange;
  if (!['fy', 'last12', 'ytd'].includes(range)) throw new Error('invalid range');
  return { fiscalYear, range };
}

export async function GET(req: NextRequest) {
  try {
    const period = parsePeriod(req);
    const tiles = await getVarianceKpiTiles(period);
    return NextResponse.json({
      tiles: tiles.filter((tile) => FINANCIAL_KPI_CODES.has(tile.code)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('required') || message.includes('invalid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
