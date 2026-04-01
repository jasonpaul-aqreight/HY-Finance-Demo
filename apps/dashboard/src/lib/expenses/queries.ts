import { getPool } from '../postgres';
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert YYYY-MM-DD date string to YYYY-MM month string */
function toMonth(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function shiftYearBack(dateStr: string): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Reusable cost category CASE expression ──────────────────────────────────
// Built from shared/expense-categories.ts using COALESCE(parent_acc_no, acc_no)
// so that child accounts automatically inherit their parent's category.
// The pc_expense_monthly table uses snake_case columns, so we build the SQL
// with alias 'e' and remap ParentAccNo → parent_acc_no, AccNo → acc_no.

function buildPcCategoryCaseSQL(alias = 'e'): string {
  // buildCategoryCaseSQL produces COALESCE(gm.ParentAccNo, gm.AccNo) references.
  // We replace them with the pc table's snake_case columns.
  return buildCategoryCaseSQL(alias)
    .replace(new RegExp(`${alias}\\.ParentAccNo`, 'g'), `${alias}.parent_acc_no`)
    .replace(new RegExp(`${alias}\\.AccNo`, 'g'), `${alias}.acc_no`);
}

const OPEX_CATEGORY_CASE = buildPcCategoryCaseSQL('e');

const COST_CATEGORY_CASE = `
  CASE
    WHEN e.acc_type = 'CO' THEN 'COGS'
    ELSE (${OPEX_CATEGORY_CASE})
  END
`;

// ─── KPI Summary ─────────────────────────────────────────────────────────────

async function fetchKpiPeriod(start: string, end: string): Promise<KpiData> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(net_amount), 0)::float AS total_costs,
      COALESCE(SUM(CASE WHEN acc_type = 'CO' THEN net_amount ELSE 0 END), 0)::float AS cogs,
      COALESCE(SUM(CASE WHEN acc_type = 'EP' THEN net_amount ELSE 0 END), 0)::float AS opex
    FROM pc_expense_monthly
    WHERE acc_type IN ('CO', 'EP')
      AND month BETWEEN $1 AND $2
  `, [startMonth, endMonth]);
  return rows[0];
}

export async function getCostKpis(start: string, end: string) {
  const current = await fetchKpiPeriod(start, end);

  // YoY comparison
  const prevStart = shiftYearBack(start);
  const prevEnd = shiftYearBack(end);
  const previous = await fetchKpiPeriod(prevStart, prevEnd);
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

export async function getCostTrend(start: string, end: string): Promise<TrendRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      e.month,
      ${COST_CATEGORY_CASE} AS category,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
    GROUP BY e.month, category
    ORDER BY e.month, category
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Cost Composition ────────────────────────────────────────────────────────

export async function getCostComposition(start: string, end: string): Promise<CompositionRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      ${COST_CATEGORY_CASE} AS category,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
    GROUP BY category
    ORDER BY net_cost DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Top 10 Expenses ─────────────────────────────────────────────────────────

export async function getTopExpenses(start: string, end: string): Promise<TopExpenseRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      e.acc_no,
      e.account_name,
      e.acc_type,
      CASE WHEN e.acc_type = 'CO' THEN 'COGS' ELSE 'OPEX' END AS cost_type,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
    GROUP BY e.acc_no, e.account_name, e.acc_type
    HAVING SUM(e.net_amount) > 0
    ORDER BY net_cost DESC
    LIMIT 10
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Toggle-aware queries (cost_type param) ─────────────────────────────

export type CostTypeParam = 'all' | 'cogs' | 'opex';
export type GranularityParam = 'daily' | 'weekly' | 'monthly';

export async function getCostTrendByType(start: string, end: string, costType: CostTypeParam, granularity: GranularityParam = 'monthly'): Promise<TrendRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);

  // pc_expense_monthly only supports monthly granularity; daily/weekly
  // fall back to monthly since the pre-computed table is month-level.
  if (costType === 'cogs') {
    const { rows } = await pool.query(`
      SELECT
        e.month,
        e.account_name AS category,
        SUM(e.net_amount)::float AS net_cost
      FROM pc_expense_monthly e
      WHERE e.acc_type = 'CO'
        AND e.month BETWEEN $1 AND $2
      GROUP BY e.month, e.account_name
      ORDER BY e.month, net_cost DESC
    `, [startMonth, endMonth]);
    return rows;
  }
  if (costType === 'opex') {
    const { rows } = await pool.query(`
      SELECT
        e.month,
        ${COST_CATEGORY_CASE} AS category,
        SUM(e.net_amount)::float AS net_cost
      FROM pc_expense_monthly e
      WHERE e.acc_type = 'EP'
        AND e.month BETWEEN $1 AND $2
      GROUP BY e.month, category
      ORDER BY e.month, category
    `, [startMonth, endMonth]);
    return rows;
  }
  // 'all': group as COGS vs OPEX
  const { rows } = await pool.query(`
    SELECT
      e.month,
      CASE WHEN e.acc_type = 'CO' THEN 'COGS' ELSE 'OPEX' END AS category,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
    GROUP BY e.month, category
    ORDER BY e.month, category
  `, [startMonth, endMonth]);
  return rows;
}

export async function getCostCompositionByType(start: string, end: string, costType: CostTypeParam): Promise<CompositionRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  if (costType === 'cogs') {
    const { rows } = await pool.query(`
      SELECT
        e.account_name AS category,
        SUM(e.net_amount)::float AS net_cost
      FROM pc_expense_monthly e
      WHERE e.acc_type = 'CO'
        AND e.month BETWEEN $1 AND $2
      GROUP BY e.account_name
      ORDER BY net_cost DESC
    `, [startMonth, endMonth]);
    return rows;
  }
  if (costType === 'opex') {
    const { rows } = await pool.query(`
      SELECT
        ${COST_CATEGORY_CASE} AS category,
        SUM(e.net_amount)::float AS net_cost
      FROM pc_expense_monthly e
      WHERE e.acc_type = 'EP'
        AND e.month BETWEEN $1 AND $2
      GROUP BY category
      ORDER BY net_cost DESC
    `, [startMonth, endMonth]);
    return rows;
  }
  // 'all': COGS vs OPEX
  const { rows } = await pool.query(`
    SELECT
      CASE WHEN e.acc_type = 'CO' THEN 'COGS' ELSE 'OPEX' END AS category,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
    GROUP BY category
    ORDER BY net_cost DESC
  `, [startMonth, endMonth]);
  return rows;
}

export async function getTopExpensesByType(start: string, end: string, costType: CostTypeParam, order: 'desc' | 'asc' = 'desc'): Promise<TopExpenseRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const typeFilter = costType === 'cogs' ? `AND e.acc_type = 'CO'` :
                     costType === 'opex' ? `AND e.acc_type = 'EP'` : '';
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';
  const { rows } = await pool.query(`
    SELECT
      e.acc_no,
      e.account_name,
      e.acc_type,
      CASE WHEN e.acc_type = 'CO' THEN 'COGS' ELSE 'OPEX' END AS cost_type,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
      ${typeFilter}
    GROUP BY e.acc_no, e.account_name, e.acc_type
    HAVING SUM(e.net_amount) > 0
    ORDER BY net_cost ${orderDir}
    LIMIT 10
  `, [startMonth, endMonth]);
  return rows;
}

// ─── COGS Breakdown ──────────────────────────────────────────────────────────

export async function getCogsBreakdown(start: string, end: string): Promise<BreakdownRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      e.acc_no,
      e.account_name,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type = 'CO'
      AND e.month BETWEEN $1 AND $2
    GROUP BY e.acc_no, e.account_name
    HAVING SUM(e.net_amount) <> 0
    ORDER BY net_cost DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── OPEX Breakdown ──────────────────────────────────────────────────────────

export async function getOpexBreakdown(start: string, end: string): Promise<OpexBreakdownRow[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      ${COST_CATEGORY_CASE} AS category,
      e.acc_no,
      e.account_name,
      SUM(e.net_amount)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type = 'EP'
      AND e.month BETWEEN $1 AND $2
    GROUP BY category, e.acc_no, e.account_name
    HAVING SUM(e.net_amount) <> 0
    ORDER BY category, net_cost DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export async function getDateBounds(): Promise<{ min_date: string; max_date: string }> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      MIN(month) || '-01' AS min_date,
      MAX(month) || '-01' AS max_date
    FROM pc_expense_monthly
  `);
  return rows[0];
}

// ─── Fiscal Years ────────────────────────────────────────────────────────────

export async function getFiscalYears(): Promise<FiscalYearRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      fiscalyearname AS "FiscalYearName",
      fromdate AS "FromDate",
      todate AS "ToDate"
    FROM fiscal_year
    ORDER BY fromdate DESC
  `);
  return rows;
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

async function fetchKpiPeriodV2(start: string, end: string): Promise<KpiDataV2> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN acc_type = 'CO' THEN net_amount ELSE 0 END), 0)::float AS cogs,
      COALESCE(SUM(CASE WHEN acc_type = 'EP' THEN net_amount ELSE 0 END), 0)::float AS opex,
      COALESCE(SUM(net_amount), 0)::float AS total_costs
    FROM pc_expense_monthly
    WHERE acc_type IN ('CO', 'EP')
      AND month BETWEEN $1 AND $2
  `, [startMonth, endMonth]);
  return rows[0];
}

export async function getCostKpisV2(
  start: string,
  end: string,
  yoyMode: 'same' | 'full' = 'full',
  maxDate?: string,
) {
  // In "same" mode, clamp both periods to the actual data range
  const effectiveEnd = (yoyMode === 'same' && maxDate && maxDate < end)
    ? maxDate
    : end;

  const current = await fetchKpiPeriodV2(start, effectiveEnd);
  const prevStart = shiftYearBack(start);
  const prevEnd = shiftYearBack(effectiveEnd);
  const previous = await fetchKpiPeriodV2(prevStart, prevEnd);

  const yoy_pct = previous.total_costs !== 0
    ? ((current.total_costs - previous.total_costs) / Math.abs(previous.total_costs)) * 100
    : null;

  return { current, previous, yoy_pct };
}

// ─── V2 Monthly Trend ────────────────────────────────────────────────────────

export async function getCostTrendV2(start: string, end: string): Promise<{ current: TrendRowV2[]; previous: TrendRowV2[] }> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const sql = `
    SELECT
      month,
      COALESCE(SUM(CASE WHEN acc_type = 'CO' THEN net_amount ELSE 0 END), 0)::float AS cogs,
      COALESCE(SUM(CASE WHEN acc_type = 'EP' THEN net_amount ELSE 0 END), 0)::float AS opex
    FROM pc_expense_monthly
    WHERE acc_type IN ('CO', 'EP')
      AND month BETWEEN $1 AND $2
    GROUP BY month
    ORDER BY month
  `;
  const current = (await pool.query(sql, [startMonth, endMonth])).rows;
  const prevStartMonth = toMonth(shiftYearBack(start));
  const prevEndMonth = toMonth(shiftYearBack(end));
  const previous = (await pool.query(sql, [prevStartMonth, prevEndMonth])).rows;
  return { current, previous };
}

// ─── V2 Composition (COGS vs OPEX) ──────────────────────────────────────────

export async function getCostCompositionV2(start: string, end: string): Promise<CompositionRowV2[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      acc_type AS type,
      COALESCE(SUM(net_amount), 0)::float AS amount
    FROM pc_expense_monthly
    WHERE acc_type IN ('CO', 'EP')
      AND month BETWEEN $1 AND $2
    GROUP BY acc_type
  `, [startMonth, endMonth]);
  return rows;
}

// ─── V2 Breakdown (all accounts by type) ─────────────────────────────────────

export async function getCostBreakdownV2(start: string, end: string): Promise<BreakdownRowV2[]> {
  const pool = getPool();
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  const { rows } = await pool.query(`
    SELECT
      e.acc_no,
      e.account_name,
      e.acc_type,
      COALESCE(SUM(e.net_amount), 0)::float AS net_cost
    FROM pc_expense_monthly e
    WHERE e.acc_type IN ('CO', 'EP')
      AND e.month BETWEEN $1 AND $2
    GROUP BY e.acc_no, e.account_name, e.acc_type
    HAVING SUM(e.net_amount) <> 0
    ORDER BY e.acc_type, net_cost DESC
  `, [startMonth, endMonth]);
  return rows;
}
