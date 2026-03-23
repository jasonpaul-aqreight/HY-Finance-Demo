import { getDb } from './db';
import { decodePeriod, encodePeriod, periodLabel } from './period-utils';

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

// --- Helper: aggregate PBalance by AccType for a period range -------------

interface RawPLRow {
  PeriodNo: number;
  AccType: string;
  net_amount: number;
}

function queryPLRaw(
  periodFrom: number,
  periodTo: number,
  project?: string
): RawPLRow[] {
  const db = getDb();
  const projectFilter = project && project !== 'ALL'
    ? `AND pb.ProjNo = ?`
    : '';
  const params: (number | string)[] = [periodFrom, periodTo];
  if (project && project !== 'ALL') params.push(project);

  return db.prepare(`
    SELECT
      pb.PeriodNo,
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
      ${projectFilter}
    GROUP BY pb.PeriodNo, gm.AccType, plf.CreditAsPositive
    ORDER BY pb.PeriodNo, plf.Seq
  `).all(...params) as RawPLRow[];
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

export function getPLSummary(
  periodFrom: number,
  periodTo: number,
  priorFrom: number,
  priorTo: number,
  project?: string
): PLSummaryResponse {
  const rows = queryPLRaw(periodFrom, periodTo, project);
  const priorRows = queryPLRaw(priorFrom, priorTo, project);

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

export function getPLKpis(
  periodFrom: number,
  periodTo: number,
  priorFrom: number,
  priorTo: number,
  project?: string
): PLKpisResponse {
  const rows = queryPLRaw(periodFrom, periodTo, project);
  const priorRows = queryPLRaw(priorFrom, priorTo, project);

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

export function getExpenseBreakdown(
  periodFrom: number,
  periodTo: number,
  project?: string,
  topN = 10
): ExpenseCategory[] {
  const db = getDb();
  const projectFilter = project && project !== 'ALL'
    ? `AND pb.ProjNo = ?`
    : '';
  const params: (number | string)[] = [periodFrom, periodTo];
  if (project && project !== 'ALL') params.push(project);

  const rows = db.prepare(`
    SELECT
      COALESCE(gm.ParentAccNo, gm.AccNo) AS expense_group_accno,
      COALESCE(
        (SELECT p.Description FROM gl_mast p WHERE p.AccNo = gm.ParentAccNo),
        gm.Description
      ) AS expense_group_name,
      SUM(pb.HomeDR) - SUM(pb.HomeCR) AS net_expense
    FROM pbalance pb
    JOIN gl_mast gm ON pb.AccNo = gm.AccNo
    WHERE gm.AccType = 'EP'
      AND pb.PeriodNo BETWEEN ? AND ?
      ${projectFilter}
    GROUP BY COALESCE(gm.ParentAccNo, gm.AccNo)
    HAVING SUM(pb.HomeDR) - SUM(pb.HomeCR) <> 0
    ORDER BY net_expense DESC
  `).all(...params) as { expense_group_accno: string; expense_group_name: string; net_expense: number }[];

  const total = rows.reduce((sum, r) => sum + r.net_expense, 0);

  // Take top N and bucket the rest as "Others"
  const topItems = rows.slice(0, topN);
  const othersTotal = rows.slice(topN).reduce((sum, r) => sum + r.net_expense, 0);

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

export function getPLTrend(periodsBack = 24): PLTrendRow[] {
  const db = getDb();

  // Find the latest period with data
  const latest = db.prepare('SELECT MAX(PeriodNo) as maxP FROM pbalance').get() as { maxP: number };
  const from = latest.maxP - periodsBack + 1;

  const rows = queryPLRaw(from, latest.maxP);

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

export function getPLByProject(periodFrom: number, periodTo: number): ProjectPLRow[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      CASE WHEN pb.ProjNo = '' THEN 'Unallocated' ELSE pb.ProjNo END AS project,
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
    GROUP BY CASE WHEN pb.ProjNo = '' THEN 'Unallocated' ELSE pb.ProjNo END,
             gm.AccType, plf.CreditAsPositive
  `).all(periodFrom, periodTo) as { project: string; AccType: string; net_amount: number }[];

  // Group by project
  const byProject: Record<string, Record<string, number>> = {};
  for (const r of rows) {
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

export function getBSSnapshot(periodTo: number, project?: string): BSSnapshotResponse {
  const db = getDb();

  const projectFilter = project && project !== 'ALL' ? `AND ProjNo = ?` : '';
  const projParams = project && project !== 'ALL' ? [project] : [];

  // Opening balances
  const openRows = db.prepare(`
    SELECT AccNo, SUM(COALESCE(HomeDR, 0)) - SUM(COALESCE(HomeCR, 0)) AS open_net
    FROM obalance
    WHERE 1=1 ${projectFilter}
    GROUP BY AccNo
  `).all(...projParams) as { AccNo: string; open_net: number }[];

  const openMap: Record<string, number> = {};
  for (const r of openRows) openMap[r.AccNo] = r.open_net;

  // Movements from earliest period to periodTo
  const minRow = db.prepare('SELECT MIN(PeriodNo) as minP FROM pbalance').get() as { minP: number };
  const earliestPeriod = minRow.minP;

  const moveRows = db.prepare(`
    SELECT AccNo, SUM(COALESCE(HomeDR, 0)) - SUM(COALESCE(HomeCR, 0)) AS move_net
    FROM pbalance
    WHERE PeriodNo BETWEEN ? AND ?
      ${projectFilter}
    GROUP BY AccNo
  `).all(earliestPeriod, periodTo, ...projParams) as { AccNo: string; move_net: number }[];

  const moveMap: Record<string, number> = {};
  for (const r of moveRows) moveMap[r.AccNo] = r.move_net;

  // Get all BS accounts with their types
  const bsAccounts = db.prepare(`
    SELECT gm.AccNo, gm.AccType, bsf.CreditAsPositive
    FROM gl_mast gm
    JOIN acc_type at ON gm.AccType = at.AccType
    JOIN bs_format bsf ON gm.AccType = bsf.AccType
    WHERE at.IsBSType = 'T'
  `).all() as { AccNo: string; AccType: string; CreditAsPositive: string }[];

  // Aggregate by AccType
  const byType: Record<string, number> = {};
  for (const acc of bsAccounts) {
    const rawNet = (openMap[acc.AccNo] || 0) + (moveMap[acc.AccNo] || 0);
    const signedNet = acc.CreditAsPositive === 'T' ? -rawNet : rawNet;
    byType[acc.AccType] = (byType[acc.AccType] || 0) + signedNet;
  }

  // AccType descriptions
  const typeNames = db.prepare(`SELECT AccType, Description FROM acc_type WHERE IsBSType = 'T'`).all() as { AccType: string; Description: string }[];
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
  // Prior years' P&L not yet closed to RE must be included
  const accumulatedPLRows = queryPLRaw(earliestPeriod, periodTo, project);
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

export function getBSKpis(periodTo: number): BSKpisResponse {
  const snapshot = getBSSnapshot(periodTo);
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

export function getBSTrend(periodsBack = 12): BSTrendRow[] {
  const db = getDb();
  const latest = db.prepare('SELECT MAX(PeriodNo) as maxP FROM pbalance').get() as { maxP: number };
  const from = latest.maxP - periodsBack + 1;

  const result: BSTrendRow[] = [];
  for (let p = from; p <= latest.maxP; p++) {
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

// --- Query 9: Fiscal Years -----------------------------------------------

export function getFiscalYears(): FiscalYearRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT fy.FiscalYearName, fy.FromDate, fy.ToDate, fy.IsActive
    FROM fiscal_year fy
    WHERE EXISTS (
      SELECT 1 FROM pbalance pb
      WHERE pb.PeriodNo >= (CAST(strftime('%Y', fy.FromDate) AS INTEGER) * 12 + CAST(strftime('%m', fy.FromDate) AS INTEGER))
        AND pb.PeriodNo <= (CAST(strftime('%Y', fy.ToDate) AS INTEGER) * 12 + CAST(strftime('%m', fy.ToDate) AS INTEGER))
        AND (pb.HomeDR <> 0 OR pb.HomeCR <> 0)
    )
    ORDER BY fy.FromDate DESC
  `).all() as FiscalYearRow[];
}

// --- Query 10: Projects --------------------------------------------------

export function getProjects(): ProjectRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT ProjNo, Description, IsActive
    FROM project
    ORDER BY Description
  `).all() as ProjectRow[];
}
