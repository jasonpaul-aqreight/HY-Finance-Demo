import { getDb } from './db';
import { getPreviousPeriod } from './date-utils';
import { buildCategoryCaseSQL } from '@/lib/shared/expense-categories';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KpiData {
  total_costs: number;
  cogs: number;
  opex: number;
}

export interface TrendRow {
  month: string;
  category: string;
  net_cost: number;
}

export interface CompositionRow {
  category: string;
  net_cost: number;
}

export interface TopExpenseRow {
  acc_no: string;
  account_name: string;
  acc_type: string;
  cost_type: string;
  net_cost: number;
}

export interface BreakdownRow {
  acc_no: string;
  account_name: string;
  net_cost: number;
}

export interface OpexBreakdownRow extends BreakdownRow {
  category: string;
}

export interface FiscalYearRow {
  FiscalYearName: string;
  FromDate: string;
  ToDate: string;
}

// ─── Reusable cost category CASE expression ──────────────────────────────────
// Generated from shared/expense-categories.ts using COALESCE(ParentAccNo, AccNo)
// so that child accounts automatically inherit their parent's category.
// Updated 2026-03-27.

const OPEX_CATEGORY_CASE = buildCategoryCaseSQL('gm');

const COST_CATEGORY_CASE = `
  CASE
    WHEN gm.AccType = 'CO' THEN 'COGS'
    ELSE (${OPEX_CATEGORY_CASE})
  END
`;

// ─── KPI Summary ─────────────────────────────────────────────────────────────

function fetchKpiPeriod(start: string, end: string): KpiData {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(gl.HomeDR - gl.HomeCR), 0) AS total_costs,

      COALESCE(SUM(CASE WHEN gm.AccType = 'CO'
        THEN gl.HomeDR - gl.HomeCR ELSE 0 END), 0) AS cogs,

      COALESCE(SUM(CASE WHEN gm.AccType = 'EP'
        THEN gl.HomeDR - gl.HomeCR ELSE 0 END), 0) AS opex

    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as KpiData;
  return row;
}

export function getCostKpis(start: string, end: string) {
  const current = fetchKpiPeriod(start, end);

  // YoY comparison
  const prevStart = shiftYearBack(start);
  const prevEnd = shiftYearBack(end);
  const previous = fetchKpiPeriod(prevStart, prevEnd);
  const yoy_pct = previous.total_costs !== 0
    ? ((current.total_costs - previous.total_costs) / Math.abs(previous.total_costs)) * 100
    : null;

  return {
    current,
    calculated: {
      cogs_pct_of_total: current.total_costs !== 0
        ? (current.cogs / current.total_costs) * 100 : 0,
      opex_pct_of_total: current.total_costs !== 0
        ? (current.opex / current.total_costs) * 100 : 0,
    },
    yoy_pct,
  };
}

// ─── Monthly Cost Trend ──────────────────────────────────────────────────────

export function getCostTrend(start: string, end: string): TrendRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', gl.TransDate, '+8 hours') AS month,
      ${COST_CATEGORY_CASE} AS category,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY month, category
    ORDER BY month, category
  `).all(start, end) as TrendRow[];
}

// ─── Cost Composition ────────────────────────────────────────────────────────

export function getCostComposition(start: string, end: string): CompositionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      ${COST_CATEGORY_CASE} AS category,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY category
    ORDER BY net_cost DESC
  `).all(start, end) as CompositionRow[];
}

// ─── Top 10 Expenses ─────────────────────────────────────────────────────────

export function getTopExpenses(start: string, end: string): TopExpenseRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      gm.AccNo AS acc_no,
      gm.Description AS account_name,
      gm.AccType AS acc_type,
      CASE WHEN gm.AccType = 'CO' THEN 'COGS' ELSE 'OPEX' END AS cost_type,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY gm.AccNo, gm.Description, gm.AccType
    HAVING SUM(gl.HomeDR) - SUM(gl.HomeCR) > 0
    ORDER BY net_cost DESC
    LIMIT 10
  `).all(start, end) as TopExpenseRow[];
}

// ─── Toggle-aware queries (cost_type param) ─────────────────────────────

export type CostTypeParam = 'all' | 'cogs' | 'opex';
export type GranularityParam = 'daily' | 'weekly' | 'monthly';

function periodExpr(granularity: GranularityParam): string {
  switch (granularity) {
    case 'daily':   return `DATE(gl.TransDate, '+8 hours')`;
    case 'weekly':  return `strftime('%G-W%V', gl.TransDate, '+8 hours')`;
    case 'monthly': return `strftime('%Y-%m', gl.TransDate, '+8 hours')`;
  }
}

export function getCostTrendByType(start: string, end: string, costType: CostTypeParam, granularity: GranularityParam = 'monthly'): TrendRow[] {
  const db = getDb();
  const period = periodExpr(granularity);
  if (costType === 'cogs') {
    return db.prepare(`
      SELECT
        ${period} AS month,
        gm.Description AS category,
        SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
      FROM gldtl gl
      JOIN glmast gm ON gl.AccNo = gm.AccNo
      WHERE gm.AccType = 'CO'
        AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY month, gm.Description
      ORDER BY month, net_cost DESC
    `).all(start, end) as TrendRow[];
  }
  if (costType === 'opex') {
    return db.prepare(`
      SELECT
        ${period} AS month,
        ${COST_CATEGORY_CASE} AS category,
        SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
      FROM gldtl gl
      JOIN glmast gm ON gl.AccNo = gm.AccNo
      WHERE gm.AccType = 'EP'
        AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY month, category
      ORDER BY month, category
    `).all(start, end) as TrendRow[];
  }
  // 'all': group as COGS vs OPEX
  return db.prepare(`
    SELECT
      ${period} AS month,
      CASE WHEN gm.AccType = 'CO' THEN 'COGS' ELSE 'OPEX' END AS category,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY month, category
    ORDER BY month, category
  `).all(start, end) as TrendRow[];
}

export function getCostCompositionByType(start: string, end: string, costType: CostTypeParam): CompositionRow[] {
  const db = getDb();
  if (costType === 'cogs') {
    return db.prepare(`
      SELECT
        gm.Description AS category,
        SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
      FROM gldtl gl
      JOIN glmast gm ON gl.AccNo = gm.AccNo
      WHERE gm.AccType = 'CO'
        AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY gm.Description
      ORDER BY net_cost DESC
    `).all(start, end) as CompositionRow[];
  }
  if (costType === 'opex') {
    return db.prepare(`
      SELECT
        ${COST_CATEGORY_CASE} AS category,
        SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
      FROM gldtl gl
      JOIN glmast gm ON gl.AccNo = gm.AccNo
      WHERE gm.AccType = 'EP'
        AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY category
      ORDER BY net_cost DESC
    `).all(start, end) as CompositionRow[];
  }
  // 'all': COGS vs OPEX
  return db.prepare(`
    SELECT
      CASE WHEN gm.AccType = 'CO' THEN 'COGS' ELSE 'OPEX' END AS category,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY category
    ORDER BY net_cost DESC
  `).all(start, end) as CompositionRow[];
}

export function getTopExpensesByType(start: string, end: string, costType: CostTypeParam, order: 'desc' | 'asc' = 'desc'): TopExpenseRow[] {
  const db = getDb();
  const typeFilter = costType === 'cogs' ? `AND gm.AccType = 'CO'` :
                     costType === 'opex' ? `AND gm.AccType = 'EP'` : '';
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';
  return db.prepare(`
    SELECT
      gm.AccNo AS acc_no,
      gm.Description AS account_name,
      gm.AccType AS acc_type,
      CASE WHEN gm.AccType = 'CO' THEN 'COGS' ELSE 'OPEX' END AS cost_type,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
      ${typeFilter}
    GROUP BY gm.AccNo, gm.Description, gm.AccType
    HAVING SUM(gl.HomeDR) - SUM(gl.HomeCR) > 0
    ORDER BY net_cost ${orderDir}
    LIMIT 10
  `).all(start, end) as TopExpenseRow[];
}

// ─── COGS Breakdown ──────────────────────────────────────────────────────────

export function getCogsBreakdown(start: string, end: string): BreakdownRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      gm.AccNo AS acc_no,
      gm.Description AS account_name,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE gm.AccType = 'CO'
      AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY gm.AccNo, gm.Description
    HAVING SUM(gl.HomeDR) - SUM(gl.HomeCR) <> 0
    ORDER BY net_cost DESC
  `).all(start, end) as BreakdownRow[];
}

// ─── OPEX Breakdown ──────────────────────────────────────────────────────────

export function getOpexBreakdown(start: string, end: string): OpexBreakdownRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      ${COST_CATEGORY_CASE} AS category,
      gm.AccNo AS acc_no,
      gm.Description AS account_name,
      SUM(gl.HomeDR) - SUM(gl.HomeCR) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE gm.AccType = 'EP'
      AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY category, gm.AccNo, gm.Description
    HAVING SUM(gl.HomeDR) - SUM(gl.HomeCR) <> 0
    ORDER BY category, net_cost DESC
  `).all(start, end) as OpexBreakdownRow[];
}

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export function getDateBounds(): { min_date: string; max_date: string } {
  const db = getDb();
  return db.prepare(`
    SELECT
      MIN(DATE(TransDate, '+8 hours')) AS min_date,
      MAX(DATE(TransDate, '+8 hours')) AS max_date
    FROM gldtl
  `).get() as { min_date: string; max_date: string };
}

// ─── Fiscal Years ────────────────────────────────────────────────────────────

export function getFiscalYears(): FiscalYearRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT FiscalYearName, FromDate, ToDate
    FROM fiscal_year
    ORDER BY FromDate DESC
  `).all() as FiscalYearRow[];
}

// ─── V2 Types ─────────────────────────────────────────────────────────────────

export interface KpiDataV2 {
  cogs: number;
  opex: number;
  total_costs: number;
}

export interface TrendRowV2 {
  month: string;
  cogs: number;
  opex: number;
}

export interface CompositionRowV2 {
  type: string;
  amount: number;
}

export interface BreakdownRowV2 {
  acc_no: string;
  account_name: string;
  acc_type: string;
  net_cost: number;
}

// ─── V2 KPI Summary (with YoY) ──────────────────────────────────────────────

function fetchKpiPeriodV2(start: string, end: string): KpiDataV2 {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN gm.AccType = 'CO' THEN gl.HomeDR - gl.HomeCR ELSE 0 END), 0) AS cogs,
      COALESCE(SUM(CASE WHEN gm.AccType = 'EP' THEN gl.HomeDR - gl.HomeCR ELSE 0 END), 0) AS opex,
      COALESCE(SUM(gl.HomeDR - gl.HomeCR), 0) AS total_costs
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE gm.AccType IN ('CO', 'EP')
      AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as KpiDataV2;
}

function shiftYearBack(dateStr: string): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function getCostKpisV2(
  start: string,
  end: string,
  yoyMode: 'same' | 'full' = 'full',
  maxDate?: string,
) {
  // In "same" mode, clamp both periods to the actual data range
  const effectiveEnd = (yoyMode === 'same' && maxDate && maxDate < end)
    ? maxDate
    : end;

  const current = fetchKpiPeriodV2(start, effectiveEnd);
  const prevStart = shiftYearBack(start);
  const prevEnd = shiftYearBack(effectiveEnd);
  const previous = fetchKpiPeriodV2(prevStart, prevEnd);

  const yoy_pct = previous.total_costs !== 0
    ? ((current.total_costs - previous.total_costs) / Math.abs(previous.total_costs)) * 100
    : null;

  return { current, previous, yoy_pct };
}

// ─── V2 Monthly Trend ────────────────────────────────────────────────────────

export function getCostTrendV2(start: string, end: string): { current: TrendRowV2[]; previous: TrendRowV2[] } {
  const db = getDb();
  const sql = `
    SELECT
      strftime('%Y-%m', gl.TransDate, '+8 hours') AS month,
      COALESCE(SUM(CASE WHEN gm.AccType = 'CO' THEN gl.HomeDR - gl.HomeCR ELSE 0 END), 0) AS cogs,
      COALESCE(SUM(CASE WHEN gm.AccType = 'EP' THEN gl.HomeDR - gl.HomeCR ELSE 0 END), 0) AS opex
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE gm.AccType IN ('CO', 'EP')
      AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY month
    ORDER BY month
  `;
  const current = db.prepare(sql).all(start, end) as TrendRowV2[];
  const prevStart = shiftYearBack(start);
  const prevEnd = shiftYearBack(end);
  const previous = db.prepare(sql).all(prevStart, prevEnd) as TrendRowV2[];
  return { current, previous };
}

// ─── V2 Composition (COGS vs OPEX) ──────────────────────────────────────────

export function getCostCompositionV2(start: string, end: string): CompositionRowV2[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      gm.AccType AS type,
      COALESCE(SUM(gl.HomeDR - gl.HomeCR), 0) AS amount
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE gm.AccType IN ('CO', 'EP')
      AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY gm.AccType
  `).all(start, end) as CompositionRowV2[];
}

// ─── V2 Breakdown (all accounts by type) ─────────────────────────────────────

export function getCostBreakdownV2(start: string, end: string): BreakdownRowV2[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      gm.AccNo AS acc_no,
      gm.Description AS account_name,
      gm.AccType AS acc_type,
      COALESCE(SUM(gl.HomeDR - gl.HomeCR), 0) AS net_cost
    FROM gldtl gl
    JOIN glmast gm ON gl.AccNo = gm.AccNo
    WHERE gm.AccType IN ('CO', 'EP')
      AND DATE(gl.TransDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY gm.AccNo, gm.Description, gm.AccType
    HAVING SUM(gl.HomeDR - gl.HomeCR) <> 0
    ORDER BY gm.AccType, net_cost DESC
  `).all(start, end) as BreakdownRowV2[];
}
