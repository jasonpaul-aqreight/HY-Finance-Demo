import { getDb } from './db';
import { fyNameToNumber, fyToPeriodRange, periodLabel, decodePeriod } from './period-utils';
import { getBSSnapshot, getFiscalYears } from './queries';
import type { BSTrendRow } from './queries';

// Re-export V2 P&L queries used by V3 (except KPIs which V3 overrides)
export { getV2PLMonthly, getV2PLStatement, getV2YoY } from './queries-v2';
// V3 still exports getV2PLKpis for backward compat, but getV3PLKpis is preferred
export { getV2PLKpis } from './queries-v2';

import { getV2PLStatement } from './queries-v2';
import type { V2KpiData } from '@/types/pnl-v2';

/**
 * V3 KPIs: YTD totals instead of latest-month snapshot.
 * Uses the P&L statement YTD column for accurate full-period KPIs.
 */
export function getV3PLKpis(fy: string, projects?: string[]): V2KpiData {
  const data = getV2PLStatement(fy, projects);

  // Extract YTD totals from the statement groups
  let net_sales = 0;
  let cogs = 0;
  let other_income = 0;
  let expenses = 0;

  for (const group of data.groups) {
    const ytd = group.subtotal.ytd;
    switch (group.acc_type) {
      case 'SL': net_sales += ytd; break;
      case 'SA': net_sales += ytd; break; // sales adjustments
      case 'CO': cogs += ytd; break;
      case 'OI': other_income += ytd; break;
      case 'EP': expenses += ytd; break;
    }
  }

  const gross_profit = net_sales - cogs;
  const net_profit = gross_profit + other_income - expenses;

  const gross_margin_pct = net_sales !== 0 ? (gross_profit / net_sales) * 100 : 0;
  const net_margin_pct = net_sales !== 0 ? (net_profit / net_sales) * 100 : 0;
  const expense_ratio = net_sales !== 0 ? (expenses / net_sales) * 100 : 0;

  return {
    net_sales,
    gross_profit,
    gross_margin_pct,
    other_income,
    expenses,
    net_profit,
    net_margin_pct,
    expense_ratio,
    // prev_ fields and sparkline not used by V3 KPI cards, set defaults
    prev_net_sales: 0,
    prev_gross_profit: 0,
    prev_gross_margin_pct: 0,
    prev_net_profit: 0,
    prev_net_margin_pct: 0,
    prev_expense_ratio: 0,
    sparkline: [],
  };
}

/**
 * BS Trend with range support (FY/Last12M/YTD).
 * Computes a snapshot for each period in the range.
 */
export function getV3BSTrend(fy: string, range = 'fy'): BSTrendRow[] {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from: fyFrom, to: fyTo } = fyToPeriodRange(fyNum);

  // Find latest period with BS data
  const latestRow = db.prepare('SELECT MAX(PeriodNo) as maxP FROM pbalance').get() as { maxP: number };
  const latestPeriod = Math.min(latestRow.maxP, fyTo);

  let periodFrom: number;
  let periodTo: number;

  switch (range) {
    case 'last12':
      periodTo = latestPeriod;
      periodFrom = periodTo - 11;
      break;
    case 'ytd':
      periodFrom = fyFrom;
      periodTo = latestPeriod;
      break;
    case 'fy':
    default:
      periodFrom = fyFrom;
      periodTo = latestPeriod;
      break;
  }

  const result: BSTrendRow[] = [];
  for (let p = periodFrom; p <= periodTo; p++) {
    const snapshot = getBSSnapshot(p);
    result.push({
      period: p,
      label: periodLabel(p),
      total_assets: snapshot.total_assets,
      total_liabilities: snapshot.total_liabilities,
      equity: snapshot.equity,
    });
  }

  return result;
}

/**
 * BS Comparison -- returns current and prior period snapshots.
 * Accepts FY string and computes periodTo from it.
 * Prior period = 12 months before current.
 */
export function getV3BSComparison(fy: string) {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { to: fyTo } = fyToPeriodRange(fyNum);

  const latestRow = db.prepare('SELECT MAX(PeriodNo) as maxP FROM pbalance').get() as { maxP: number };
  const periodTo = Math.min(latestRow.maxP, fyTo);

  const current = getBSSnapshot(periodTo);
  const prior = getBSSnapshot(periodTo - 12);

  return { current, prior };
}

/**
 * Multi-year P&L summary — returns aggregated totals for all fiscal years with data.
 */
export interface MultiYearPLRow {
  fy: string;
  fyNumber: number;
  isPartial: boolean;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  other_income: number;
  expenses: number;
  net_profit: number;
  net_margin_pct: number;
  taxation: number;
  npat: number;
}

export function getMultiYearPL(): MultiYearPLRow[] {
  const db = getDb();
  const fiscalYears = getFiscalYears();

  // Find the latest period with data globally
  const latestRow = db.prepare('SELECT MAX(PeriodNo) as maxP FROM pbalance WHERE HomeDR != 0 OR HomeCR != 0').get() as { maxP: number };
  const globalLatest = latestRow.maxP;

  const results: MultiYearPLRow[] = [];

  for (const fy of fiscalYears) {
    const match = fy.FiscalYearName.match(/(\d{4})/);
    if (!match) continue;
    const fyNum = parseInt(match[1], 10);
    const { from: periodFrom, to: periodTo } = fyToPeriodRange(fyNum);
    const effectiveTo = Math.min(globalLatest, periodTo);

    if (effectiveTo < periodFrom) continue; // no data for this FY

    const isPartial = effectiveTo < periodTo;

    // Query raw P&L data for this FY range
    const rows = db.prepare(`
      SELECT
        gm.AccType,
        CASE
          WHEN plf.CreditAsPositive = 'T' THEN SUM(pb.HomeCR) - SUM(pb.HomeDR)
          ELSE SUM(pb.HomeDR) - SUM(pb.HomeCR)
        END AS net_amount
      FROM pbalance pb
      JOIN gl_mast gm ON pb.AccNo = gm.AccNo
      JOIN acc_type at ON gm.AccType = at.AccType
      JOIN pl_format plf ON gm.AccType = plf.AccType
      WHERE at.IsBSType = 'F'
        AND pb.PeriodNo BETWEEN ? AND ?
      GROUP BY gm.AccType, plf.CreditAsPositive
      ORDER BY plf.Seq
    `).all(periodFrom, effectiveTo) as { AccType: string; net_amount: number }[];

    const byType: Record<string, number> = {};
    for (const r of rows) {
      byType[r.AccType] = (byType[r.AccType] || 0) + r.net_amount;
    }

    const sales = byType['SL'] || 0;
    const sales_adj = byType['SA'] || 0;
    const net_sales = sales + sales_adj;
    const cogs = byType['CO'] || 0;
    const gross_profit = net_sales - cogs;
    const other_income = byType['OI'] || 0;
    const expenses = byType['EP'] || 0;
    const net_profit = gross_profit + other_income - expenses;
    const taxation = byType['TX'] || 0;
    const npat = net_profit - taxation;

    results.push({
      fy: `FY${fyNum}`,
      fyNumber: fyNum,
      isPartial,
      net_sales,
      cogs,
      gross_profit,
      gross_margin_pct: net_sales !== 0 ? (gross_profit / net_sales) * 100 : 0,
      other_income,
      expenses,
      net_profit,
      net_margin_pct: net_sales !== 0 ? (net_profit / net_sales) * 100 : 0,
      taxation,
      npat,
    });
  }

  // Sort ascending by FY number
  results.sort((a, b) => a.fyNumber - b.fyNumber);
  return results;
}
