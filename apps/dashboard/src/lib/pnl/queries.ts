import { getPool } from '../postgres';
import { decodePeriod, encodePeriod, periodLabel, fyNameToNumber, fyToPeriodRange, fyPeriods } from './period-utils';
import { getExpenseCategory, CATEGORY_ORDER } from '@/lib/shared/expense-categories';
import type {
  V2KpiData,
  V2MonthlyRow,
  V2MonthlyResponse,
  V2StatementResponse,
  V2StatementGroup,
  V2StatementAccount,
  V2PeriodValues,
  V2SegmentRow,
  V2ExpenseResponse,
  V2ExpenseItem,
  V2ExpenseTrendRow,
  V2COGSResponse,
  V2COGSMonthly,
  V2COGSComponent,
  V2HealthResponse,
  V2YoYLineItem,
} from '@/types/pnl-v2';

// --- Interfaces ----------------------------------------------------------

export interface PLMonthlyRow {
  PeriodNo: number;
  year: number;
  month: number;
  AccType: string;
  acc_type_name: string;
  project: string;
  net_amount: number;
}

export interface PLLineItem {
  code: string;
  label: string;
  type: 'detail' | 'subtotal' | 'total' | 'grandtotal' | 'margin';
  monthly: number[];
  ytd: number;
  prior_ytd: number | null;
  yoy_pct: number | null;
}

export interface PLSummaryResponse {
  fiscal_year: string;
  project: string;
  currency: string;
  months: { period: number; label: string; fy_month: number }[];
  line_items: PLLineItem[];
}

export interface ExpenseCategory {
  expense_group_accno: string;
  expense_group_name: string;
  net_expense: number;
  pct_of_total: number;
}

export interface PLTrendRow {
  period: number;
  label: string;
  net_sales: number;
  gross_profit: number;
  net_profit: number;
}

export interface ProjectPLRow {
  project: string;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gp_pct: number;
  other_income: number;
  expenses: number;
  net_profit: number;
  np_pct: number;
}

export interface BSRow {
  AccType: string;
  acc_type_name: string;
  balance: number;
}

export interface BSSnapshotResponse {
  period_to: number;
  period_label: string;
  items: BSRow[];
  total_assets: number;
  total_liabilities: number;
  equity: number;
  current_assets: number;
  current_liabilities: number;
  net_current_assets: number;
  current_year_pl: number;
}

export interface BSKpisResponse {
  total_assets: number;
  total_liabilities: number;
  current_ratio: number;
  working_capital: number;
  debt_to_equity: number;
  equity_ratio: number;
}

export interface BSTrendRow {
  period: number;
  label: string;
  total_assets: number;
  total_liabilities: number;
  equity: number;
}

export interface FiscalYearRow {
  FiscalYearName: string;
  FromDate: string;
  ToDate: string;
  IsActive: string;
}

export interface ProjectRow {
  ProjNo: string;
  Description: string;
  IsActive: string;
}

// --- Helper: aggregate pc_pnl_period by AccType for a period range -------

interface RawPLRow {
  PeriodNo: number;
  AccType: string;
  net_amount: number;
}

async function queryPLRaw(
  periodFrom: number,
  periodTo: number,
  project?: string
): Promise<RawPLRow[]> {
  const pool = getPool();
  const params: (number | string)[] = [periodFrom, periodTo];
  let projectFilter = '';
  if (project && project !== 'ALL') {
    params.push(project);
    projectFilter = `AND pp.proj_no = $${params.length}`;
  }

  const sql = `
    SELECT
      pp.period_no AS "PeriodNo",
      pp.acc_type AS "AccType",
      (CASE
        WHEN plf.creditaspositive = 'T' THEN SUM(pp.home_cr) - SUM(pp.home_dr)
        ELSE SUM(pp.home_dr) - SUM(pp.home_cr)
      END)::float AS net_amount
    FROM pc_pnl_period pp
    JOIN pl_format plf ON pp.acc_type = plf.acctype
    WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
      AND pp.period_no BETWEEN $1 AND $2
      ${projectFilter}
    GROUP BY pp.period_no, pp.acc_type, plf.creditaspositive, plf.seq
    ORDER BY pp.period_no, plf.seq
  `;

  const { rows } = await pool.query(sql, params);
  return rows as RawPLRow[];
}

// Helper: compute P&L aggregates from raw rows
interface PLAggregates {
  sales: number;
  sales_adj: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  other_income: number;
  expenses: number;
  net_profit: number;
  taxation: number;
  net_profit_after_tax: number;
}

function aggregatePL(rows: RawPLRow[]): PLAggregates {
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
  const net_profit_after_tax = net_profit - taxation;
  return { sales, sales_adj, net_sales, cogs, gross_profit, other_income, expenses, net_profit, taxation, net_profit_after_tax };
}

// --- Query 1: P&L Summary ------------------------------------------------

export async function getPLSummary(
  periodFrom: number,
  periodTo: number,
  priorFrom: number,
  priorTo: number,
  project?: string
): Promise<PLSummaryResponse> {
  const rows = await queryPLRaw(periodFrom, periodTo, project);
  const priorRows = await queryPLRaw(priorFrom, priorTo, project);

  // Group current rows by period
  const byPeriod: Record<number, RawPLRow[]> = {};
  for (const r of rows) {
    if (!byPeriod[r.PeriodNo]) byPeriod[r.PeriodNo] = [];
    byPeriod[r.PeriodNo].push(r);
  }

  // Build months array
  const months: { period: number; label: string; fy_month: number }[] = [];
  for (let p = periodFrom; p <= periodTo; p++) {
    const { month } = decodePeriod(p);
    const fyMonth = month >= 3 ? month - 2 : month + 10;
    months.push({ period: p, label: periodLabel(p), fy_month: fyMonth });
  }

  // Monthly values per AccType
  const accTypes = ['SL', 'SA', 'CO', 'OI', 'EP', 'TX'];
  const monthlyByType: Record<string, number[]> = {};
  for (const at of accTypes) {
    monthlyByType[at] = months.map(m => {
      const periodRows = byPeriod[m.period] || [];
      const match = periodRows.find(r => r.AccType === at);
      return match ? match.net_amount : 0;
    });
  }

  // Current YTD
  const currentAgg = aggregatePL(rows);
  // Prior YTD
  const priorAgg = aggregatePL(priorRows);

  function yoy(curr: number, prior: number): number | null {
    if (prior === 0 && curr === 0) return null;
    if (prior === 0) return null;
    return ((curr - prior) / Math.abs(prior)) * 100;
  }

  // Monthly computed rows
  const monthlyNetSales = months.map((_, i) => monthlyByType['SL'][i] + monthlyByType['SA'][i]);
  const monthlyGP = months.map((_, i) => monthlyNetSales[i] - monthlyByType['CO'][i]);
  const monthlyNP = months.map((_, i) => monthlyGP[i] + monthlyByType['OI'][i] - monthlyByType['EP'][i]);
  const monthlyNPAT = months.map((_, i) => monthlyNP[i] - monthlyByType['TX'][i]);
  const monthlyGPPct = months.map((_, i) => monthlyNetSales[i] !== 0 ? (monthlyGP[i] / monthlyNetSales[i]) * 100 : 0);
  const monthlyNPPct = months.map((_, i) => monthlyNetSales[i] !== 0 ? (monthlyNP[i] / monthlyNetSales[i]) * 100 : 0);

  const lineItems: PLLineItem[] = [
    {
      code: 'SL', label: 'SALES', type: 'detail',
      monthly: monthlyByType['SL'], ytd: currentAgg.sales,
      prior_ytd: priorAgg.sales, yoy_pct: yoy(currentAgg.sales, priorAgg.sales),
    },
    {
      code: 'SA', label: 'SALES ADJUSTMENTS', type: 'detail',
      monthly: monthlyByType['SA'], ytd: currentAgg.sales_adj,
      prior_ytd: priorAgg.sales_adj, yoy_pct: yoy(currentAgg.sales_adj, priorAgg.sales_adj),
    },
    {
      code: 'NS', label: 'NET SALES', type: 'subtotal',
      monthly: monthlyNetSales, ytd: currentAgg.net_sales,
      prior_ytd: priorAgg.net_sales, yoy_pct: yoy(currentAgg.net_sales, priorAgg.net_sales),
    },
    {
      code: 'CO', label: 'COST OF GOODS SOLD', type: 'detail',
      monthly: monthlyByType['CO'], ytd: currentAgg.cogs,
      prior_ytd: priorAgg.cogs, yoy_pct: yoy(currentAgg.cogs, priorAgg.cogs),
    },
    {
      code: 'GP', label: 'GROSS PROFIT / (LOSS)', type: 'total',
      monthly: monthlyGP, ytd: currentAgg.gross_profit,
      prior_ytd: priorAgg.gross_profit, yoy_pct: yoy(currentAgg.gross_profit, priorAgg.gross_profit),
    },
    {
      code: 'GPM', label: 'Gross Margin %', type: 'margin',
      monthly: monthlyGPPct,
      ytd: currentAgg.net_sales !== 0 ? (currentAgg.gross_profit / currentAgg.net_sales) * 100 : 0,
      prior_ytd: priorAgg.net_sales !== 0 ? (priorAgg.gross_profit / priorAgg.net_sales) * 100 : 0,
      yoy_pct: null,
    },
    {
      code: 'OI', label: 'OTHER INCOMES', type: 'detail',
      monthly: monthlyByType['OI'], ytd: currentAgg.other_income,
      prior_ytd: priorAgg.other_income, yoy_pct: yoy(currentAgg.other_income, priorAgg.other_income),
    },
    {
      code: 'EP', label: 'EXPENSES', type: 'detail',
      monthly: monthlyByType['EP'], ytd: currentAgg.expenses,
      prior_ytd: priorAgg.expenses, yoy_pct: yoy(currentAgg.expenses, priorAgg.expenses),
    },
    {
      code: 'NP', label: 'NET PROFIT / (LOSS)', type: 'total',
      monthly: monthlyNP, ytd: currentAgg.net_profit,
      prior_ytd: priorAgg.net_profit, yoy_pct: yoy(currentAgg.net_profit, priorAgg.net_profit),
    },
    {
      code: 'NPM', label: 'Net Margin %', type: 'margin',
      monthly: monthlyNPPct,
      ytd: currentAgg.net_sales !== 0 ? (currentAgg.net_profit / currentAgg.net_sales) * 100 : 0,
      prior_ytd: priorAgg.net_sales !== 0 ? (priorAgg.net_profit / priorAgg.net_sales) * 100 : 0,
      yoy_pct: null,
    },
    {
      code: 'TX', label: 'TAXATION', type: 'detail',
      monthly: monthlyByType['TX'], ytd: currentAgg.taxation,
      prior_ytd: priorAgg.taxation, yoy_pct: yoy(currentAgg.taxation, priorAgg.taxation),
    },
    {
      code: 'NPAT', label: 'NET PROFIT / (LOSS) AFTER TAXATION', type: 'grandtotal',
      monthly: monthlyNPAT, ytd: currentAgg.net_profit_after_tax,
      prior_ytd: priorAgg.net_profit_after_tax, yoy_pct: yoy(currentAgg.net_profit_after_tax, priorAgg.net_profit_after_tax),
    },
  ];

  // Derive FY name from periodFrom
  const { year: startYear } = decodePeriod(periodFrom);
  const fyName = `FY${startYear + 1}`;

  return {
    fiscal_year: fyName,
    project: project || 'ALL',
    currency: 'MYR',
    months,
    line_items: lineItems,
  };
}

// --- Query 2: P&L KPIs ---------------------------------------------------

export interface PLKpisResponse {
  net_sales: number;
  gross_profit: number;
  gross_margin_pct: number;
  net_profit: number;
  net_margin_pct: number;
  expense_ratio: number;
  operating_margin_pct: number;
  prior_net_sales: number;
  prior_gross_profit: number;
  prior_gross_margin_pct: number;
  prior_net_profit: number;
  prior_net_margin_pct: number;
  prior_expense_ratio: number;
  // Monthly sparkline data
  monthly_net_sales: number[];
  monthly_gross_profit: number[];
  monthly_net_profit: number[];
}

export async function getPLKpis(
  periodFrom: number,
  periodTo: number,
  priorFrom: number,
  priorTo: number,
  project?: string
): Promise<PLKpisResponse> {
  const rows = await queryPLRaw(periodFrom, periodTo, project);
  const priorRows = await queryPLRaw(priorFrom, priorTo, project);

  const curr = aggregatePL(rows);
  const prior = aggregatePL(priorRows);

  // Monthly sparklines
  const byPeriod: Record<number, RawPLRow[]> = {};
  for (const r of rows) {
    if (!byPeriod[r.PeriodNo]) byPeriod[r.PeriodNo] = [];
    byPeriod[r.PeriodNo].push(r);
  }

  const monthlySales: number[] = [];
  const monthlyGP: number[] = [];
  const monthlyNP: number[] = [];
  for (let p = periodFrom; p <= periodTo; p++) {
    const pRows = byPeriod[p] || [];
    const agg = aggregatePL(pRows);
    monthlySales.push(agg.net_sales);
    monthlyGP.push(agg.gross_profit);
    monthlyNP.push(agg.net_profit);
  }

  return {
    net_sales: curr.net_sales,
    gross_profit: curr.gross_profit,
    gross_margin_pct: curr.net_sales !== 0 ? (curr.gross_profit / curr.net_sales) * 100 : 0,
    net_profit: curr.net_profit,
    net_margin_pct: curr.net_sales !== 0 ? (curr.net_profit / curr.net_sales) * 100 : 0,
    expense_ratio: curr.net_sales !== 0 ? (curr.expenses / curr.net_sales) * 100 : 0,
    operating_margin_pct: curr.net_sales !== 0
      ? ((curr.gross_profit + curr.other_income - curr.expenses) / curr.net_sales) * 100 : 0,
    prior_net_sales: prior.net_sales,
    prior_gross_profit: prior.gross_profit,
    prior_gross_margin_pct: prior.net_sales !== 0 ? (prior.gross_profit / prior.net_sales) * 100 : 0,
    prior_net_profit: prior.net_profit,
    prior_net_margin_pct: prior.net_sales !== 0 ? (prior.net_profit / prior.net_sales) * 100 : 0,
    prior_expense_ratio: prior.net_sales !== 0 ? (prior.expenses / prior.net_sales) * 100 : 0,
    monthly_net_sales: monthlySales,
    monthly_gross_profit: monthlyGP,
    monthly_net_profit: monthlyNP,
  };
}

// --- Query 3: Expense Breakdown -------------------------------------------

export async function getExpenseBreakdown(
  periodFrom: number,
  periodTo: number,
  project?: string,
  topN = 10
): Promise<ExpenseCategory[]> {
  const pool = getPool();
  const params: (number | string)[] = [periodFrom, periodTo];
  let projectFilter = '';
  if (project && project !== 'ALL') {
    params.push(project);
    projectFilter = `AND pp.proj_no = $${params.length}`;
  }

  const sql = `
    SELECT
      COALESCE(pp.parent_acc_no, pp.acc_no) AS expense_group_accno,
      COALESCE(
        (SELECT ga.description FROM gl_account ga WHERE ga.accno = pp.parent_acc_no),
        pp.account_name
      ) AS expense_group_name,
      (SUM(pp.home_dr) - SUM(pp.home_cr))::float AS net_expense
    FROM pc_pnl_period pp
    WHERE pp.acc_type = 'EP'
      AND pp.period_no BETWEEN $1 AND $2
      ${projectFilter}
    GROUP BY COALESCE(pp.parent_acc_no, pp.acc_no),
             COALESCE(
               (SELECT ga.description FROM gl_account ga WHERE ga.accno = pp.parent_acc_no),
               pp.account_name
             )
    HAVING SUM(pp.home_dr) - SUM(pp.home_cr) <> 0
    ORDER BY net_expense DESC
  `;

  const { rows } = await pool.query(sql, params);
  const typedRows = rows as { expense_group_accno: string; expense_group_name: string; net_expense: number }[];

  const total = typedRows.reduce((sum, r) => sum + r.net_expense, 0);

  // Take top N and bucket the rest as "Others"
  const topItems = typedRows.slice(0, topN);
  const othersTotal = typedRows.slice(topN).reduce((sum, r) => sum + r.net_expense, 0);

  const result: ExpenseCategory[] = topItems.map(r => ({
    expense_group_accno: r.expense_group_accno,
    expense_group_name: r.expense_group_name,
    net_expense: r.net_expense,
    pct_of_total: total !== 0 ? (r.net_expense / total) * 100 : 0,
  }));

  if (othersTotal !== 0) {
    result.push({
      expense_group_accno: 'OTHERS',
      expense_group_name: 'Others',
      net_expense: othersTotal,
      pct_of_total: total !== 0 ? (othersTotal / total) * 100 : 0,
    });
  }

  return result;
}

// --- Query 4: P&L Trend --------------------------------------------------

export async function getPLTrend(periodsBack = 24): Promise<PLTrendRow[]> {
  const pool = getPool();

  // Find the latest period with data
  const latestResult = await pool.query(
    `SELECT MAX(period_no)::int as "maxP" FROM pc_pnl_period`
  );
  const latest = latestResult.rows[0] as { maxP: number };
  const from = latest.maxP - periodsBack + 1;

  const rows = await queryPLRaw(from, latest.maxP);

  // Group by period
  const byPeriod: Record<number, RawPLRow[]> = {};
  for (const r of rows) {
    if (!byPeriod[r.PeriodNo]) byPeriod[r.PeriodNo] = [];
    byPeriod[r.PeriodNo].push(r);
  }

  const result: PLTrendRow[] = [];
  for (let p = from; p <= latest.maxP; p++) {
    const pRows = byPeriod[p] || [];
    const agg = aggregatePL(pRows);
    result.push({
      period: p,
      label: periodLabel(p),
      net_sales: agg.net_sales,
      gross_profit: agg.gross_profit,
      net_profit: agg.net_profit,
    });
  }

  return result;
}

// --- Query 5: P&L by Project ---------------------------------------------

export async function getPLByProject(periodFrom: number, periodTo: number): Promise<ProjectPLRow[]> {
  const pool = getPool();

  const sql = `
    SELECT
      CASE WHEN pp.proj_no = '' THEN 'Unallocated' ELSE pp.proj_no END AS project,
      pp.acc_type AS "AccType",
      (CASE
        WHEN plf.creditaspositive = 'T' THEN SUM(pp.home_cr) - SUM(pp.home_dr)
        ELSE SUM(pp.home_dr) - SUM(pp.home_cr)
      END)::float AS net_amount
    FROM pc_pnl_period pp
    JOIN pl_format plf ON pp.acc_type = plf.acctype
    WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
      AND pp.period_no BETWEEN $1 AND $2
    GROUP BY CASE WHEN pp.proj_no = '' THEN 'Unallocated' ELSE pp.proj_no END,
             pp.acc_type, plf.creditaspositive
  `;

  const { rows } = await pool.query(sql, [periodFrom, periodTo]);
  const typedRows = rows as { project: string; AccType: string; net_amount: number }[];

  // Group by project
  const byProject: Record<string, Record<string, number>> = {};
  for (const r of typedRows) {
    if (!byProject[r.project]) byProject[r.project] = {};
    byProject[r.project][r.AccType] = (byProject[r.project][r.AccType] || 0) + r.net_amount;
  }

  return Object.entries(byProject)
    .map(([proj, types]) => {
      const sales = (types['SL'] || 0) + (types['SA'] || 0);
      const cogs = types['CO'] || 0;
      const gp = sales - cogs;
      const oi = types['OI'] || 0;
      const ep = types['EP'] || 0;
      const np = gp + oi - ep;
      return {
        project: proj,
        net_sales: sales,
        cogs,
        gross_profit: gp,
        gp_pct: sales !== 0 ? (gp / sales) * 100 : 0,
        other_income: oi,
        expenses: ep,
        net_profit: np,
        np_pct: sales !== 0 ? (np / sales) * 100 : 0,
      };
    })
    .filter(p => p.net_sales !== 0 || p.cogs !== 0 || p.expenses !== 0)
    .sort((a, b) => b.net_sales - a.net_sales);
}

// --- Query 6: Balance Sheet Snapshot --------------------------------------

export async function getBSSnapshot(periodTo: number, project?: string): Promise<BSSnapshotResponse> {
  const pool = getPool();

  const projParams: string[] = [];
  let projectFilter = '';
  if (project && project !== 'ALL') {
    projParams.push(project);
    projectFilter = `AND proj_no = $${projParams.length}`;
  }

  // Opening balances from pc_opening_balance
  const openSql = `
    SELECT acc_no AS "AccNo", (SUM(COALESCE(home_dr, 0)) - SUM(COALESCE(home_cr, 0)))::float AS open_net
    FROM pc_opening_balance
    WHERE 1=1 ${projectFilter}
    GROUP BY acc_no
  `;
  const openResult = await pool.query(openSql, projParams);
  const openRows = openResult.rows as { AccNo: string; open_net: number }[];

  const openMap: Record<string, number> = {};
  for (const r of openRows) openMap[r.AccNo] = r.open_net;

  // Movements from earliest period to periodTo using pc_pnl_period
  const minResult = await pool.query('SELECT MIN(period_no)::int as "minP" FROM pc_pnl_period');
  const earliestPeriod = (minResult.rows[0] as { minP: number }).minP;

  const moveParams: (number | string)[] = [earliestPeriod, periodTo];
  let moveProjectFilter = '';
  if (project && project !== 'ALL') {
    moveParams.push(project);
    moveProjectFilter = `AND proj_no = $${moveParams.length}`;
  }

  const moveSql = `
    SELECT acc_no AS "AccNo", (SUM(COALESCE(home_dr, 0)) - SUM(COALESCE(home_cr, 0)))::float AS move_net
    FROM pc_pnl_period
    WHERE period_no BETWEEN $1 AND $2
      ${moveProjectFilter}
    GROUP BY acc_no
  `;
  const moveResult = await pool.query(moveSql, moveParams);
  const moveRows = moveResult.rows as { AccNo: string; move_net: number }[];

  const moveMap: Record<string, number> = {};
  for (const r of moveRows) moveMap[r.AccNo] = r.move_net;

  // Get all BS accounts with their types (still from lookup tables)
  const bsSql = `
    SELECT gm.accno AS "AccNo", gm.acctype AS "AccType", bsf.creditaspositive AS "CreditAsPositive"
    FROM gl_account gm
    JOIN account_type at ON gm.acctype = at.acctype
    JOIN bs_format bsf ON gm.acctype = bsf.acctype
    WHERE at.isbstype = 'T'
  `;
  const bsResult = await pool.query(bsSql);
  const bsAccounts = bsResult.rows as { AccNo: string; AccType: string; CreditAsPositive: string }[];

  // Aggregate by AccType
  const byType: Record<string, number> = {};
  for (const acc of bsAccounts) {
    const rawNet = (openMap[acc.AccNo] || 0) + (moveMap[acc.AccNo] || 0);
    const signedNet = acc.CreditAsPositive === 'T' ? -rawNet : rawNet;
    byType[acc.AccType] = (byType[acc.AccType] || 0) + signedNet;
  }

  // AccType descriptions
  const typeNamesResult = await pool.query(`SELECT acctype AS "AccType", description AS "Description" FROM account_type WHERE isbstype = 'T'`);
  const typeNames = typeNamesResult.rows as { AccType: string; Description: string }[];
  const nameMap: Record<string, string> = {};
  for (const t of typeNames) nameMap[t.AccType] = t.Description;

  const items: BSRow[] = ['FA', 'OA', 'CA', 'CL', 'LL', 'OL', 'CP', 'RE'].map(at => ({
    AccType: at,
    acc_type_name: nameMap[at] || at,
    balance: byType[at] || 0,
  }));

  const fa = byType['FA'] || 0;
  const oa = byType['OA'] || 0;
  const ca = byType['CA'] || 0;
  const cl = byType['CL'] || 0;
  const ll = byType['LL'] || 0;
  const ol = byType['OL'] || 0;
  const cp = byType['CP'] || 0;
  const re = byType['RE'] || 0;

  const netCurrentAssets = ca - cl;
  const totalAssets = fa + oa + netCurrentAssets;
  const totalLiabilities = cl + ll + ol;
  const equity = cp + re;

  // Accumulated P&L from inception (for retained earnings bridge)
  const accumulatedPLRows = await queryPLRaw(earliestPeriod, periodTo, project);
  const currentYearPL = aggregatePL(accumulatedPLRows).net_profit_after_tax;

  return {
    period_to: periodTo,
    period_label: periodLabel(periodTo),
    items,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    equity,
    current_assets: ca,
    current_liabilities: cl,
    net_current_assets: netCurrentAssets,
    current_year_pl: currentYearPL,
  };
}

// --- Query 7: Balance Sheet KPIs -----------------------------------------

export async function getBSKpis(periodTo: number): Promise<BSKpisResponse> {
  const snapshot = await getBSSnapshot(periodTo);
  const { current_assets, current_liabilities, total_assets, total_liabilities, equity } = snapshot;

  return {
    total_assets: total_assets,
    total_liabilities: total_liabilities,
    current_ratio: current_liabilities !== 0 ? current_assets / current_liabilities : 0,
    working_capital: current_assets - current_liabilities,
    debt_to_equity: equity !== 0 ? total_liabilities / equity : 0,
    equity_ratio: total_assets !== 0 ? equity / total_assets : 0,
  };
}

// --- Query 8: Balance Sheet Trend ----------------------------------------

export async function getBSTrend(periodsBack = 12): Promise<BSTrendRow[]> {
  const pool = getPool();
  const latestResult = await pool.query('SELECT MAX(period_no)::int as "maxP" FROM pc_pnl_period');
  const latest = latestResult.rows[0] as { maxP: number };
  const from = latest.maxP - periodsBack + 1;

  const result: BSTrendRow[] = [];
  for (let p = from; p <= latest.maxP; p++) {
    const snapshot = await getBSSnapshot(p);
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

// --- Query 9: Fiscal Years -----------------------------------------------

export async function getFiscalYears(): Promise<FiscalYearRow[]> {
  const pool = getPool();
  const sql = `
    SELECT
      fy.fiscalyearname AS "FiscalYearName",
      fy.fromdate AS "FromDate",
      fy.todate AS "ToDate",
      fy.isactive AS "IsActive"
    FROM fiscal_year fy
    WHERE EXISTS (
      SELECT 1 FROM pc_pnl_period pp
      WHERE pp.period_no >= (EXTRACT(YEAR FROM fy.fromdate::date)::int * 12 + EXTRACT(MONTH FROM fy.fromdate::date)::int)
        AND pp.period_no <= (EXTRACT(YEAR FROM fy.todate::date)::int * 12 + EXTRACT(MONTH FROM fy.todate::date)::int)
        AND (pp.home_dr <> 0 OR pp.home_cr <> 0)
    )
    ORDER BY fy.fromdate DESC
  `;
  const { rows } = await pool.query(sql);
  return rows as FiscalYearRow[];
}

// --- Query 10: Projects --------------------------------------------------

export async function getProjects(): Promise<ProjectRow[]> {
  const pool = getPool();
  const sql = `
    SELECT
      projno AS "ProjNo",
      description AS "Description",
      isactive AS "IsActive"
    FROM project
    ORDER BY description
  `;
  const { rows } = await pool.query(sql);
  return rows as ProjectRow[];
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 Types & Functions (consolidated from queries-v2.ts)
// ═══════════════════════════════════════════════════════════════════════════

// --- V2 Core helpers (lowercase field names, projects[] support) ----------

interface RawPLRowV2 {
  periodno: number;
  acctype: string;
  net_amount: number;
}

interface PLAggregatesV2 {
  sales: number;
  sales_adj: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  other_income: number;
  expenses: number;
  net_profit: number;
  taxation: number;
  net_profit_after_tax: number;
}

function buildProjectFilter(projects?: string[], startIdx = 1): { clause: string; params: string[] } {
  if (!projects || projects.length === 0) return { clause: '', params: [] };
  const placeholders = projects.map((_, i) => `$${startIdx + i}`).join(',');
  return { clause: `AND pp.proj_no IN (${placeholders})`, params: projects };
}

async function queryPLRawV2(periodFrom: number, periodTo: number, projects?: string[]): Promise<RawPLRowV2[]> {
  const pool = getPool();
  const { clause, params } = buildProjectFilter(projects, 3);

  const result = await pool.query(`
    SELECT
      pp.period_no AS periodno,
      pp.acc_type AS acctype,
      (CASE
        WHEN plf.creditaspositive = 'T' THEN SUM(pp.home_cr) - SUM(pp.home_dr)
        ELSE SUM(pp.home_dr) - SUM(pp.home_cr)
      END)::float AS net_amount
    FROM pc_pnl_period pp
    JOIN pl_format plf ON pp.acc_type = plf.acctype
    WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
      AND pp.period_no BETWEEN $1 AND $2
      ${clause}
    GROUP BY pp.period_no, pp.acc_type, plf.creditaspositive, plf.seq
    ORDER BY pp.period_no, plf.seq
  `, [periodFrom, periodTo, ...params]);

  return result.rows as RawPLRowV2[];
}

function aggregatePLV2(rows: RawPLRowV2[]): PLAggregatesV2 {
  const byType: Record<string, number> = {};
  for (const r of rows) {
    byType[r.acctype] = (byType[r.acctype] || 0) + r.net_amount;
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
  const net_profit_after_tax = net_profit - taxation;
  return { sales, sales_adj, net_sales, cogs, gross_profit, other_income, expenses, net_profit, taxation, net_profit_after_tax };
}

function groupByPeriod(rows: RawPLRowV2[]): Record<number, RawPLRowV2[]> {
  const byPeriod: Record<number, RawPLRowV2[]> = {};
  for (const r of rows) {
    if (!byPeriod[r.periodno]) byPeriod[r.periodno] = [];
    byPeriod[r.periodno].push(r);
  }
  return byPeriod;
}

async function getLatestPeriod(): Promise<number> {
  const pool = getPool();
  // Only consider periods that have actual P&L transactions (not just BS entries)
  const result = await pool.query(`
    SELECT MAX(pp.period_no)::int as maxp
    FROM pc_pnl_period pp
    WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
      AND (pp.home_dr <> 0 OR pp.home_cr <> 0)
  `);
  return result.rows[0].maxp;
}

// --- V2 Section 1: KPI Summary -------------------------------------------

export async function getV2PLKpis(fy: string, projects?: string[]): Promise<V2KpiData> {
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);

  const latestPeriod = Math.min(await getLatestPeriod(), to);
  const rows = await queryPLRawV2(from, latestPeriod, projects);
  const byPeriod = groupByPeriod(rows);

  // Current month = latest period with data
  const currentMonthRows = byPeriod[latestPeriod] || [];
  const prevMonthRows = byPeriod[latestPeriod - 1] || [];
  const curr = aggregatePLV2(currentMonthRows);
  const prev = aggregatePLV2(prevMonthRows);

  // Sparkline: last 6 months
  const sparklineStart = Math.max(from, latestPeriod - 5);
  const sparkline = [];
  for (let p = sparklineStart; p <= latestPeriod; p++) {
    const agg = aggregatePLV2(byPeriod[p] || []);
    sparkline.push({
      period: p,
      label: periodLabel(p),
      net_sales: agg.net_sales,
      gross_profit: agg.gross_profit,
      net_profit: agg.net_profit,
    });
  }

  return {
    net_sales: curr.net_sales,
    gross_profit: curr.gross_profit,
    gross_margin_pct: curr.net_sales !== 0 ? (curr.gross_profit / curr.net_sales) * 100 : 0,
    net_profit: curr.net_profit,
    net_margin_pct: curr.net_sales !== 0 ? (curr.net_profit / curr.net_sales) * 100 : 0,
    expense_ratio: curr.net_sales !== 0 ? (curr.expenses / curr.net_sales) * 100 : 0,
    other_income: curr.other_income,
    expenses: curr.expenses,
    prev_net_sales: prev.net_sales,
    prev_gross_profit: prev.gross_profit,
    prev_gross_margin_pct: prev.net_sales !== 0 ? (prev.gross_profit / prev.net_sales) * 100 : 0,
    prev_net_profit: prev.net_profit,
    prev_net_margin_pct: prev.net_sales !== 0 ? (prev.net_profit / prev.net_sales) * 100 : 0,
    prev_expense_ratio: prev.net_sales !== 0 ? (prev.expenses / prev.net_sales) * 100 : 0,
    sparkline,
  };
}

// --- V2 Section 2: Monthly P&L Trend -------------------------------------

export async function getV2PLMonthly(fy: string, projects?: string[], range = 'fy'): Promise<V2MonthlyResponse> {
  const fyNum = fyNameToNumber(fy);
  const { from: fyFrom, to: fyTo } = fyToPeriodRange(fyNum);
  const latestPeriod = await getLatestPeriod();

  let periodFrom: number;
  let periodTo: number;

  switch (range) {
    case 'last12':
      periodTo = Math.min(latestPeriod, fyTo);
      periodFrom = periodTo - 11;
      break;
    case 'ytd':
      periodFrom = fyFrom;
      periodTo = Math.min(latestPeriod, fyTo);
      break;
    case 'all':
      periodFrom = fyFrom;
      periodTo = fyTo;
      break;
    case 'fy':
    default:
      periodFrom = fyFrom;
      periodTo = Math.min(latestPeriod, fyTo);
      break;
  }

  const rows = await queryPLRawV2(periodFrom, periodTo, projects);
  const byPeriod = groupByPeriod(rows);

  const data: V2MonthlyRow[] = [];
  let totalNP = 0;
  let count = 0;

  for (let p = periodFrom; p <= periodTo; p++) {
    const agg = aggregatePLV2(byPeriod[p] || []);
    data.push({
      period: p,
      label: periodLabel(p),
      net_sales: agg.net_sales,
      cogs: agg.cogs,
      gross_profit: agg.gross_profit,
      other_income: agg.other_income,
      expenses: agg.expenses,
      net_profit: agg.net_profit,
    });
    totalNP += agg.net_profit;
    count++;
  }

  return {
    data,
    avg_net_profit: count > 0 ? totalNP / count : 0,
  };
}

// --- V2 Section 3: Full P&L Statement ------------------------------------

export async function getV2PLStatement(fy: string, projects?: string[]): Promise<V2StatementResponse> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from: fyFrom, to: fyTo } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);
  const latestPeriod = Math.min(await getLatestPeriod(), fyTo);
  const prevPeriod = latestPeriod - 1;

  // Build the months array for the current FY (up to latest period)
  const periods = fyPeriods(fyFrom, latestPeriod);
  const monthLabels = periods.map(p => ({ period: p, label: periodLabel(p) }));
  const numMonths = periods.length;
  const zeros = () => new Array(numMonths).fill(0) as number[];

  const { clause: projClause, params: projParams } = buildProjectFilter(projects, 3);

  // Get account-level detail for all needed periods
  // Group by parent_acc_no where available so child accounts roll up into their parent
  const accountResult = await pool.query(`
    SELECT
      pp.acc_type AS acctype,
      COALESCE(pp.parent_acc_no, pp.acc_no) AS accno,
      COALESCE(
        (SELECT ga.description FROM gl_account ga WHERE ga.accno = pp.parent_acc_no),
        pp.account_name
      ) AS description,
      pp.period_no AS periodno,
      plf.seq,
      (CASE
        WHEN plf.creditaspositive = 'T' THEN SUM(pp.home_cr) - SUM(pp.home_dr)
        ELSE SUM(pp.home_dr) - SUM(pp.home_cr)
      END)::float AS net_amount
    FROM pc_pnl_period pp
    JOIN pl_format plf ON pp.acc_type = plf.acctype
    WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
      AND pp.period_no BETWEEN $1 AND $2
      ${projClause}
    GROUP BY pp.acc_type, pp.parent_acc_no, pp.acc_no, pp.account_name, pp.period_no, plf.seq, plf.creditaspositive
    ORDER BY plf.seq, COALESCE(pp.parent_acc_no, pp.acc_no)
  `, [priorFrom, fyTo, ...projParams]);

  const accountRows = accountResult.rows as {
    acctype: string; accno: string; description: string;
    periodno: number; seq: number; net_amount: number;
  }[];

  // Pivot: for each account, sum amounts for each column + monthly array
  interface AccData {
    accno: string;
    description: string;
    accType: string;
    seq: number;
    current_month: number;
    prev_month: number;
    ytd: number;
    prior_ytd: number;
    monthly: number[];
  }

  const accMap: Record<string, AccData> = {};
  for (const r of accountRows) {
    // Layer 3: For expenses (EP), group by expense category instead of individual account
    let key = r.accno;
    let description = r.description;
    if (r.acctype === 'EP') {
      const category = getExpenseCategory(r.accno);
      key = `CAT:${category}`;
      description = category;
    }

    if (!accMap[key]) {
      accMap[key] = {
        accno: key, description, accType: r.acctype, seq: r.seq,
        current_month: 0, prev_month: 0, ytd: 0, prior_ytd: 0, monthly: zeros(),
      };
    }
    const a = accMap[key];
    if (r.periodno === latestPeriod) a.current_month += r.net_amount;
    if (r.periodno === prevPeriod) a.prev_month += r.net_amount;
    if (r.periodno >= fyFrom && r.periodno <= latestPeriod) a.ytd += r.net_amount;
    if (r.periodno >= priorFrom && r.periodno <= priorTo) a.prior_ytd += r.net_amount;
    const mIdx = periods.indexOf(r.periodno);
    if (mIdx >= 0) a.monthly[mIdx] += r.net_amount;
  }

  // Get account_type descriptions and PLFormat ordering
  const plFormatResult = await pool.query(`
    SELECT plf.acctype, plf.seq, at.description
    FROM pl_format plf
    JOIN account_type at ON plf.acctype = at.acctype
    WHERE plf.rowtype = 'A'
    ORDER BY plf.seq
  `);

  const plFormat = plFormatResult.rows as { acctype: string; seq: number; description: string }[];

  // Group accounts by AccType
  const groups: V2StatementGroup[] = [];
  for (const fmt of plFormat) {
    const accounts: V2StatementAccount[] = Object.values(accMap)
      .filter(a => a.accType === fmt.acctype)
      .filter(a => a.current_month !== 0 || a.prev_month !== 0 || a.ytd !== 0 || a.prior_ytd !== 0)
      .sort((a, b) => {
        // For EP categories, sort by defined category order
        if (a.accType === 'EP' && a.accno.startsWith('CAT:')) {
          const ai = CATEGORY_ORDER.indexOf(a.description);
          const bi = CATEGORY_ORDER.indexOf(b.description);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        }
        return a.accno.localeCompare(b.accno);
      })
      .map(a => ({
        accno: a.accno,
        description: a.description,
        current_month: a.current_month,
        prev_month: a.prev_month,
        ytd: a.ytd,
        prior_ytd: a.prior_ytd,
        monthly: a.monthly,
      }));

    const subtotal: V2PeriodValues = {
      current_month: accounts.reduce((s, a) => s + a.current_month, 0),
      prev_month: accounts.reduce((s, a) => s + a.prev_month, 0),
      ytd: accounts.reduce((s, a) => s + a.ytd, 0),
      prior_ytd: accounts.reduce((s, a) => s + a.prior_ytd, 0),
      monthly: accounts.reduce((s, a) => s.map((v, i) => v + a.monthly[i]), zeros()),
    };

    groups.push({
      acc_type: fmt.acctype,
      acc_type_name: fmt.description,
      seq: fmt.seq,
      accounts,
      subtotal,
    });
  }

  // Compute derived rows
  const emptyPV: V2PeriodValues = { current_month: 0, prev_month: 0, ytd: 0, prior_ytd: 0, monthly: zeros() };
  const getSubtotal = (accType: string): V2PeriodValues =>
    groups.find(g => g.acc_type === accType)?.subtotal || emptyPV;

  const sl = getSubtotal('SL');
  const sa = getSubtotal('SA');
  const co = getSubtotal('CO');
  const oi = getSubtotal('OI');
  const ep = getSubtotal('EP');
  const tx = getSubtotal('TX');

  const add = (a: V2PeriodValues, b: V2PeriodValues): V2PeriodValues => ({
    current_month: a.current_month + b.current_month,
    prev_month: a.prev_month + b.prev_month,
    ytd: a.ytd + b.ytd,
    prior_ytd: a.prior_ytd + b.prior_ytd,
    monthly: a.monthly.map((v, i) => v + b.monthly[i]),
  });

  const sub = (a: V2PeriodValues, b: V2PeriodValues): V2PeriodValues => ({
    current_month: a.current_month - b.current_month,
    prev_month: a.prev_month - b.prev_month,
    ytd: a.ytd - b.ytd,
    prior_ytd: a.prior_ytd - b.prior_ytd,
    monthly: a.monthly.map((v, i) => v - b.monthly[i]),
  });

  const netSales = add(sl, sa);
  const grossProfit = sub(netSales, co);
  const netProfit = sub(add(grossProfit, oi), ep);
  const netProfitAfterTax = sub(netProfit, tx);

  // Compute margin percentages
  const marginPct = (numerator: V2PeriodValues, denominator: V2PeriodValues) => ({
    monthly: numerator.monthly.map((v, i) => denominator.monthly[i] !== 0 ? (v / denominator.monthly[i]) * 100 : 0),
    ytd: denominator.ytd !== 0 ? (numerator.ytd / denominator.ytd) * 100 : 0,
    prior_ytd: denominator.prior_ytd !== 0 ? (numerator.prior_ytd / denominator.prior_ytd) * 100 : 0,
  });

  return {
    current_period_label: periodLabel(latestPeriod),
    prev_period_label: periodLabel(prevPeriod),
    months: monthLabels,
    groups,
    computed: {
      net_sales: netSales,
      gross_profit: grossProfit,
      net_profit: netProfit,
      net_profit_after_tax: netProfitAfterTax,
      gpm: marginPct(grossProfit, netSales),
      npm: marginPct(netProfit, netSales),
    },
  };
}

// --- V2 Section 4: Segment Profitability ---------------------------------

export async function getV2Segments(fy: string): Promise<V2SegmentRow[]> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(await getLatestPeriod(), to);

  const result = await pool.query(`
    SELECT
      CASE WHEN pp.proj_no = '' THEN 'Unassigned' ELSE pp.proj_no END AS segment,
      COALESCE(p.description, CASE WHEN pp.proj_no = '' THEN 'Unassigned' ELSE pp.proj_no END) AS segment_name,
      pp.acc_type AS acctype,
      (CASE
        WHEN plf.creditaspositive = 'T' THEN SUM(pp.home_cr) - SUM(pp.home_dr)
        ELSE SUM(pp.home_dr) - SUM(pp.home_cr)
      END)::float AS net_amount
    FROM pc_pnl_period pp
    JOIN pl_format plf ON pp.acc_type = plf.acctype
    LEFT JOIN project p ON pp.proj_no = p.projno
    WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
      AND pp.period_no BETWEEN $1 AND $2
    GROUP BY CASE WHEN pp.proj_no = '' THEN 'Unassigned' ELSE pp.proj_no END,
             COALESCE(p.description, CASE WHEN pp.proj_no = '' THEN 'Unassigned' ELSE pp.proj_no END),
             pp.acc_type, plf.creditaspositive
  `, [from, latestPeriod]);

  const segRows = result.rows as { segment: string; segment_name: string; acctype: string; net_amount: number }[];

  const bySegment: Record<string, { name: string; types: Record<string, number> }> = {};
  for (const r of segRows) {
    if (!bySegment[r.segment]) bySegment[r.segment] = { name: r.segment_name, types: {} };
    bySegment[r.segment].types[r.acctype] = (bySegment[r.segment].types[r.acctype] || 0) + r.net_amount;
  }

  return Object.entries(bySegment)
    .map(([seg, { name, types }]) => {
      const ns = (types['SL'] || 0) + (types['SA'] || 0);
      const cogs = types['CO'] || 0;
      const gp = ns - cogs;
      const ep = types['EP'] || 0;
      const oi = types['OI'] || 0;
      const np = gp + oi - ep;
      return {
        segment: seg,
        segment_name: name,
        net_sales: ns,
        cogs,
        gross_profit: gp,
        gm_pct: ns !== 0 ? (gp / ns) * 100 : 0,
        expenses: ep,
        net_profit: np,
      };
    })
    .filter(s => s.net_sales !== 0 || s.cogs !== 0 || s.expenses !== 0)
    .sort((a, b) => b.net_sales - a.net_sales);
}

// --- V2 Section 5: Expense Breakdown -------------------------------------

export async function getV2Expenses(fy: string, projects?: string[], topN = 10): Promise<V2ExpenseResponse> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(await getLatestPeriod(), to);
  const { clause, params } = buildProjectFilter(projects, 3);

  const result = await pool.query(`
    SELECT
      COALESCE(pp.parent_acc_no, pp.acc_no) AS accno,
      COALESCE(
        (SELECT ga.description FROM gl_account ga WHERE ga.accno = pp.parent_acc_no),
        pp.account_name
      ) AS name,
      (SUM(pp.home_dr) - SUM(pp.home_cr))::float AS amount
    FROM pc_pnl_period pp
    WHERE pp.acc_type = 'EP'
      AND pp.period_no BETWEEN $1 AND $2
      ${clause}
    GROUP BY COALESCE(pp.parent_acc_no, pp.acc_no), pp.account_name
    HAVING SUM(pp.home_dr) - SUM(pp.home_cr) <> 0
    ORDER BY amount DESC
  `, [from, latestPeriod, ...params]);

  const expRows = result.rows as { accno: string; name: string; amount: number }[];

  const total = expRows.reduce((s, r) => s + r.amount, 0);

  const topItems: V2ExpenseItem[] = expRows.slice(0, topN).map(r => ({
    accno: r.accno,
    name: r.name,
    amount: r.amount,
    pct_of_total: total !== 0 ? (r.amount / total) * 100 : 0,
  }));

  const othersTotal = expRows.slice(topN).reduce((s, r) => s + r.amount, 0);
  if (othersTotal !== 0) {
    topItems.push({
      accno: 'OTHERS',
      name: 'Others',
      amount: othersTotal,
      pct_of_total: total !== 0 ? (othersTotal / total) * 100 : 0,
    });
  }

  // Get net sales for expense-to-revenue ratio
  const plRows = await queryPLRawV2(from, latestPeriod, projects);
  const agg = aggregatePLV2(plRows);

  return {
    items: topItems,
    total_expenses: total,
    expense_to_revenue_ratio: agg.net_sales !== 0 ? (total / agg.net_sales) * 100 : 0,
  };
}

export async function getV2ExpensesTrend(fy: string, projects?: string[]): Promise<V2ExpenseTrendRow[]> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(await getLatestPeriod(), to);
  const { clause, params } = buildProjectFilter(projects, 3);

  const result = await pool.query(`
    SELECT
      pp.period_no AS periodno,
      COALESCE(pp.parent_acc_no, pp.acc_no) AS accno,
      COALESCE(
        (SELECT ga.description FROM gl_account ga WHERE ga.accno = pp.parent_acc_no),
        pp.account_name
      ) AS name,
      (SUM(pp.home_dr) - SUM(pp.home_cr))::float AS amount
    FROM pc_pnl_period pp
    WHERE pp.acc_type = 'EP'
      AND pp.period_no BETWEEN $1 AND $2
      ${clause}
    GROUP BY pp.period_no, COALESCE(pp.parent_acc_no, pp.acc_no), pp.account_name
    HAVING SUM(pp.home_dr) - SUM(pp.home_cr) <> 0
    ORDER BY pp.period_no
  `, [from, latestPeriod, ...params]);

  const trendRows = result.rows as { periodno: number; accno: string; name: string; amount: number }[];

  // Find top 5 expense groups overall
  const totals: Record<string, { name: string; total: number }> = {};
  for (const r of trendRows) {
    if (!totals[r.accno]) totals[r.accno] = { name: r.name, total: 0 };
    totals[r.accno].total += r.amount;
  }
  const top5 = Object.entries(totals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([accno]) => accno);

  // Build monthly rows
  const trendResult: V2ExpenseTrendRow[] = [];
  for (let p = from; p <= latestPeriod; p++) {
    const periodRows = trendRows.filter(r => r.periodno === p);
    const expenses: Record<string, number> = {};
    for (const accno of top5) {
      const match = periodRows.find(r => r.accno === accno);
      expenses[totals[accno].name] = match ? match.amount : 0;
    }
    trendResult.push({ period: p, label: periodLabel(p), expenses });
  }

  return trendResult;
}

// --- V2 Section 6: COGS Analysis -----------------------------------------

export async function getV2COGS(fy: string, projects?: string[]): Promise<V2COGSResponse> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(await getLatestPeriod(), to);
  const { clause, params } = buildProjectFilter(projects, 3);

  const result = await pool.query(`
    SELECT
      pp.period_no AS periodno,
      pp.acc_no AS accno,
      pp.account_name AS description,
      (SUM(pp.home_dr) - SUM(pp.home_cr))::float AS net_amount
    FROM pc_pnl_period pp
    WHERE pp.acc_type = 'CO'
      AND pp.period_no BETWEEN $1 AND $2
      ${clause}
    GROUP BY pp.period_no, pp.acc_no, pp.account_name
    ORDER BY pp.period_no, pp.acc_no
  `, [from, latestPeriod, ...params]);

  const cogsRows = result.rows as { periodno: number; accno: string; description: string; net_amount: number }[];

  // Build monthly COGS composition
  const monthly: V2COGSMonthly[] = [];
  for (let p = from; p <= latestPeriod; p++) {
    const periodRows = cogsRows.filter(r => r.periodno === p);
    const components: V2COGSComponent[] = periodRows
      .filter(r => r.net_amount !== 0)
      .map(r => ({ accno: r.accno, name: r.description, amount: r.net_amount }));
    const total = components.reduce((s, c) => s + c.amount, 0);
    monthly.push({ period: p, label: periodLabel(p), components, total });
  }

  // Compute ratios across the full period
  const totalCOGS = cogsRows.reduce((s, r) => s + r.net_amount, 0);

  // Get net sales for ratio
  const plRows = await queryPLRawV2(from, latestPeriod, projects);
  const agg = aggregatePLV2(plRows);

  // Find specific COGS components for ratios
  const purchases = cogsRows
    .filter(r => r.description.toLowerCase().includes('purchase') && !r.description.toLowerCase().includes('return'))
    .reduce((s, r) => s + r.net_amount, 0);
  const discounts = Math.abs(cogsRows
    .filter(r => r.description.toLowerCase().includes('discount'))
    .reduce((s, r) => s + r.net_amount, 0));
  const returns = Math.abs(cogsRows
    .filter(r => r.description.toLowerCase().includes('return'))
    .reduce((s, r) => s + r.net_amount, 0));

  return {
    monthly,
    ratios: {
      cogs_revenue_pct: agg.net_sales !== 0 ? (totalCOGS / agg.net_sales) * 100 : 0,
      discount_purchases_pct: purchases !== 0 ? (discounts / purchases) * 100 : 0,
      returns_purchases_pct: purchases !== 0 ? (returns / purchases) * 100 : 0,
    },
  };
}

// --- V2 Section 7: Financial Health --------------------------------------

export async function getV2Health(fy: string): Promise<V2HealthResponse> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(await getLatestPeriod(), to);

  // Get BS data for current ratio & working capital from pc_opening_balance
  const openResult = await pool.query(`
    SELECT acc_no AS accno, (SUM(COALESCE(home_dr, 0)) - SUM(COALESCE(home_cr, 0)))::float AS open_net
    FROM pc_opening_balance
    GROUP BY acc_no
  `);
  const openRows = openResult.rows as { accno: string; open_net: number }[];
  const openMap: Record<string, number> = {};
  for (const r of openRows) openMap[r.accno] = r.open_net;

  // Movements up to latest period from pc_pnl_period
  const minResult = await pool.query('SELECT MIN(period_no)::int as "minP" FROM pc_pnl_period');
  const earliestPeriod = (minResult.rows[0] as { minP: number }).minP;

  const moveResult = await pool.query(`
    SELECT acc_no AS accno, (SUM(COALESCE(home_dr, 0)) - SUM(COALESCE(home_cr, 0)))::float AS move_net
    FROM pc_pnl_period
    WHERE period_no BETWEEN $1 AND $2
    GROUP BY acc_no
  `, [earliestPeriod, latestPeriod]);
  const moveRows = moveResult.rows as { accno: string; move_net: number }[];
  const moveMap: Record<string, number> = {};
  for (const r of moveRows) moveMap[r.accno] = r.move_net;

  // BS accounts (still from lookup tables)
  const bsResult = await pool.query(`
    SELECT gm.accno, gm.acctype, gm.description, bsf.creditaspositive
    FROM gl_account gm
    JOIN account_type at ON gm.acctype = at.acctype
    JOIN bs_format bsf ON gm.acctype = bsf.acctype
    WHERE at.isbstype = 'T'
  `);
  const bsAccounts = bsResult.rows as { accno: string; acctype: string; description: string; creditaspositive: string }[];

  const byType: Record<string, number> = {};
  for (const acc of bsAccounts) {
    const rawNet = (openMap[acc.accno] || 0) + (moveMap[acc.accno] || 0);
    const signedNet = acc.creditaspositive === 'T' ? -rawNet : rawNet;
    byType[acc.acctype] = (byType[acc.acctype] || 0) + signedNet;
  }

  const ca = byType['CA'] || 0;
  const cl = byType['CL'] || 0;
  const currentRatio = cl !== 0 ? ca / cl : 0;
  const workingCapital = ca - cl;

  // AR Turnover
  const tradeDebtors = bsAccounts
    .filter(a => a.acctype === 'CA' && a.description.toUpperCase().includes('DEBTOR'));
  const arBalance = tradeDebtors.reduce((s, a) => {
    const raw = (openMap[a.accno] || 0) + (moveMap[a.accno] || 0);
    return s + (a.creditaspositive === 'T' ? -raw : raw);
  }, 0);

  const arOpenBalance = tradeDebtors.reduce((s, a) => {
    const raw = openMap[a.accno] || 0;
    return s + (a.creditaspositive === 'T' ? -raw : raw);
  }, 0);
  const avgAR = (arOpenBalance + arBalance) / 2;

  // AP Turnover
  const tradeCreditors = bsAccounts
    .filter(a => a.acctype === 'CL' && a.description.toUpperCase().includes('CREDITOR'));
  const apBalance = tradeCreditors.reduce((s, a) => {
    const raw = (openMap[a.accno] || 0) + (moveMap[a.accno] || 0);
    return s + (a.creditaspositive === 'T' ? -raw : raw);
  }, 0);
  const apOpenBalance = tradeCreditors.reduce((s, a) => {
    const raw = openMap[a.accno] || 0;
    return s + (a.creditaspositive === 'T' ? -raw : raw);
  }, 0);
  const avgAP = (apOpenBalance + apBalance) / 2;

  // Get net sales and COGS for turnover
  const plRows = await queryPLRawV2(from, latestPeriod);
  const plAgg = aggregatePLV2(plRows);

  const arTurnover = avgAR !== 0 ? plAgg.net_sales / avgAR : 0;
  const apTurnover = avgAP !== 0 ? plAgg.cogs / avgAP : 0;

  return {
    current_ratio: currentRatio,
    working_capital: workingCapital,
    ar_turnover: arTurnover,
    ap_turnover: apTurnover,
    ar_days: arTurnover !== 0 ? 365 / arTurnover : 0,
    ap_days: apTurnover !== 0 ? 365 / apTurnover : 0,
  };
}

// --- V2 Section 8: Year-over-Year Comparison -----------------------------

export async function getV2YoY(fy: string): Promise<V2YoYLineItem[]> {
  const fyNum = fyNameToNumber(fy);
  const { from: currFrom, to: currTo } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);
  const latestPeriod = await getLatestPeriod();

  const currRows = await queryPLRawV2(currFrom, Math.min(latestPeriod, currTo));
  const priorRows = await queryPLRawV2(priorFrom, priorTo);

  const curr = aggregatePLV2(currRows);
  const prior = aggregatePLV2(priorRows);

  function growthPct(c: number, p: number): number | null {
    if (p === 0 && c === 0) return null;
    if (p === 0) return null;
    return ((c - p) / Math.abs(p)) * 100;
  }

  const items: { label: string; type: string; curr: number; prior: number }[] = [
    { label: 'Net Sales', type: 'NS', curr: curr.net_sales, prior: prior.net_sales },
    { label: 'Cost of Goods Sold', type: 'CO', curr: curr.cogs, prior: prior.cogs },
    { label: 'Gross Profit', type: 'GP', curr: curr.gross_profit, prior: prior.gross_profit },
    { label: 'Other Income', type: 'OI', curr: curr.other_income, prior: prior.other_income },
    { label: 'Expenses', type: 'EP', curr: curr.expenses, prior: prior.expenses },
    { label: 'Net Profit', type: 'NP', curr: curr.net_profit, prior: prior.net_profit },
    { label: 'Taxation', type: 'TX', curr: curr.taxation, prior: prior.taxation },
    { label: 'Net Profit After Tax', type: 'NPAT', curr: curr.net_profit_after_tax, prior: prior.net_profit_after_tax },
  ];

  return items.map(i => ({
    line_item: i.label,
    acc_type: i.type,
    current_fy: i.curr,
    prior_fy: i.prior,
    change: i.curr - i.prior,
    growth_pct: growthPct(i.curr, i.prior),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// V3 Types & Functions (consolidated from queries-v3.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * V3 KPIs: YTD totals instead of latest-month snapshot.
 * Uses the P&L statement YTD column for accurate full-period KPIs.
 */
export async function getV3PLKpis(fy: string, projects?: string[]): Promise<V2KpiData> {
  const data = await getV2PLStatement(fy, projects);

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
export async function getV3BSTrend(fy: string, range = 'fy'): Promise<BSTrendRow[]> {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { from: fyFrom, to: fyTo } = fyToPeriodRange(fyNum);

  // Find latest period with data
  const latestResult = await pool.query('SELECT MAX(period_no) AS "maxP" FROM pc_pnl_period');
  const latestRow = latestResult.rows[0] as { maxP: number };
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
    const snapshot = await getBSSnapshot(p);
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
export async function getV3BSComparison(fy: string) {
  const pool = getPool();
  const fyNum = fyNameToNumber(fy);
  const { to: fyTo } = fyToPeriodRange(fyNum);

  const latestResult = await pool.query('SELECT MAX(period_no) AS "maxP" FROM pc_pnl_period');
  const latestRow = latestResult.rows[0] as { maxP: number };
  const periodTo = Math.min(latestRow.maxP, fyTo);

  const current = await getBSSnapshot(periodTo);
  const prior = await getBSSnapshot(periodTo - 12);

  return { current, prior };
}

/**
 * Multi-year P&L summary -- returns aggregated totals for all fiscal years with data.
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

export async function getMultiYearPL(): Promise<MultiYearPLRow[]> {
  const pool = getPool();
  const fiscalYears = await getFiscalYears();

  // Find the latest period with data globally
  const latestResult = await pool.query(
    `SELECT MAX(period_no) AS "maxP" FROM pc_pnl_period WHERE home_dr != 0 OR home_cr != 0`
  );
  const latestRow = latestResult.rows[0] as { maxP: number };
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

    // Query P&L data from pc_pnl_period for this FY range
    const { rows: fyRows } = await pool.query<{ AccType: string; net_amount: number }>(`
      SELECT
        pp.acc_type AS "AccType",
        (CASE
          WHEN plf.creditaspositive = 'T' THEN SUM(pp.home_cr) - SUM(pp.home_dr)
          ELSE SUM(pp.home_dr) - SUM(pp.home_cr)
        END)::float AS "net_amount"
      FROM pc_pnl_period pp
      JOIN pl_format plf ON pp.acc_type = plf.acctype
      WHERE pp.acc_type IN (SELECT acctype FROM account_type WHERE isbstype = 'F')
        AND pp.period_no BETWEEN $1 AND $2
      GROUP BY pp.acc_type, plf.creditaspositive, plf.seq
      ORDER BY plf.seq
    `, [periodFrom, effectiveTo]);

    const byType: Record<string, number> = {};
    for (const r of fyRows) {
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
