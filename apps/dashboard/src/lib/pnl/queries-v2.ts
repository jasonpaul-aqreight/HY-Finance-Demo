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

// --- Core helpers --------------------------------------------------------

interface RawPLRow {
  periodno: number;
  acctype: string;
  net_amount: number;
}

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

function buildProjectFilter(projects?: string[], startIdx = 1): { clause: string; params: string[] } {
  if (!projects || projects.length === 0) return { clause: '', params: [] };
  const placeholders = projects.map((_, i) => `$${startIdx + i}`).join(',');
  return { clause: `AND pp.proj_no IN (${placeholders})`, params: projects };
}

async function queryPLRaw(periodFrom: number, periodTo: number, projects?: string[]): Promise<RawPLRow[]> {
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

  return result.rows as RawPLRow[];
}

function aggregatePL(rows: RawPLRow[]): PLAggregates {
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

function groupByPeriod(rows: RawPLRow[]): Record<number, RawPLRow[]> {
  const byPeriod: Record<number, RawPLRow[]> = {};
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

// --- Section 1: KPI Summary ----------------------------------------------

export async function getV2PLKpis(fy: string, projects?: string[]): Promise<V2KpiData> {
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);

  const latestPeriod = Math.min(await getLatestPeriod(), to);
  const rows = await queryPLRaw(from, latestPeriod, projects);
  const byPeriod = groupByPeriod(rows);

  // Current month = latest period with data
  const currentMonthRows = byPeriod[latestPeriod] || [];
  const prevMonthRows = byPeriod[latestPeriod - 1] || [];
  const curr = aggregatePL(currentMonthRows);
  const prev = aggregatePL(prevMonthRows);

  // Sparkline: last 6 months
  const sparklineStart = Math.max(from, latestPeriod - 5);
  const sparkline = [];
  for (let p = sparklineStart; p <= latestPeriod; p++) {
    const agg = aggregatePL(byPeriod[p] || []);
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

// --- Section 2: Monthly P&L Trend ----------------------------------------

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

  const rows = await queryPLRaw(periodFrom, periodTo, projects);
  const byPeriod = groupByPeriod(rows);

  const data: V2MonthlyRow[] = [];
  let totalNP = 0;
  let count = 0;

  for (let p = periodFrom; p <= periodTo; p++) {
    const agg = aggregatePL(byPeriod[p] || []);
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

// --- Section 3: Full P&L Statement ---------------------------------------

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

// --- Section 4: Segment Profitability ------------------------------------

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

  const rows = result.rows as { segment: string; segment_name: string; acctype: string; net_amount: number }[];

  const bySegment: Record<string, { name: string; types: Record<string, number> }> = {};
  for (const r of rows) {
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

// --- Section 5: Expense Breakdown ----------------------------------------

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

  const rows = result.rows as { accno: string; name: string; amount: number }[];

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const topItems: V2ExpenseItem[] = rows.slice(0, topN).map(r => ({
    accno: r.accno,
    name: r.name,
    amount: r.amount,
    pct_of_total: total !== 0 ? (r.amount / total) * 100 : 0,
  }));

  const othersTotal = rows.slice(topN).reduce((s, r) => s + r.amount, 0);
  if (othersTotal !== 0) {
    topItems.push({
      accno: 'OTHERS',
      name: 'Others',
      amount: othersTotal,
      pct_of_total: total !== 0 ? (othersTotal / total) * 100 : 0,
    });
  }

  // Get net sales for expense-to-revenue ratio
  const plRows = await queryPLRaw(from, latestPeriod, projects);
  const agg = aggregatePL(plRows);

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

  const rows = result.rows as { periodno: number; accno: string; name: string; amount: number }[];

  // Find top 5 expense groups overall
  const totals: Record<string, { name: string; total: number }> = {};
  for (const r of rows) {
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
    const periodRows = rows.filter(r => r.periodno === p);
    const expenses: Record<string, number> = {};
    for (const accno of top5) {
      const match = periodRows.find(r => r.accno === accno);
      expenses[totals[accno].name] = match ? match.amount : 0;
    }
    trendResult.push({ period: p, label: periodLabel(p), expenses });
  }

  return trendResult;
}

// --- Section 6: COGS Analysis --------------------------------------------

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

  const rows = result.rows as { periodno: number; accno: string; description: string; net_amount: number }[];

  // Build monthly COGS composition
  const monthly: V2COGSMonthly[] = [];
  for (let p = from; p <= latestPeriod; p++) {
    const periodRows = rows.filter(r => r.periodno === p);
    const components: V2COGSComponent[] = periodRows
      .filter(r => r.net_amount !== 0)
      .map(r => ({ accno: r.accno, name: r.description, amount: r.net_amount }));
    const total = components.reduce((s, c) => s + c.amount, 0);
    monthly.push({ period: p, label: periodLabel(p), components, total });
  }

  // Compute ratios across the full period
  const totalCOGS = rows.reduce((s, r) => s + r.net_amount, 0);

  // Get net sales for ratio
  const plRows = await queryPLRaw(from, latestPeriod, projects);
  const agg = aggregatePL(plRows);

  // Find specific COGS components for ratios
  const purchases = rows
    .filter(r => r.description.toLowerCase().includes('purchase') && !r.description.toLowerCase().includes('return'))
    .reduce((s, r) => s + r.net_amount, 0);
  const discounts = Math.abs(rows
    .filter(r => r.description.toLowerCase().includes('discount'))
    .reduce((s, r) => s + r.net_amount, 0));
  const returns = Math.abs(rows
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

// --- Section 7: Financial Health -----------------------------------------

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
  const plRows = await queryPLRaw(from, latestPeriod);
  const plAgg = aggregatePL(plRows);

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

// --- Section 8: Year-over-Year Comparison --------------------------------

export async function getV2YoY(fy: string): Promise<V2YoYLineItem[]> {
  const fyNum = fyNameToNumber(fy);
  const { from: currFrom, to: currTo } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);
  const latestPeriod = await getLatestPeriod();

  const currRows = await queryPLRaw(currFrom, Math.min(latestPeriod, currTo));
  const priorRows = await queryPLRaw(priorFrom, priorTo);

  const curr = aggregatePL(currRows);
  const prior = aggregatePL(priorRows);

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
