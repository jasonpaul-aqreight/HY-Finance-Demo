import { getDb } from './db';
import { decodePeriod, encodePeriod, periodLabel, fyNameToNumber, fyToPeriodRange, fyPeriods } from './period-utils';
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

// --- Core helpers (duplicated from queries.ts to avoid modifying V1) ------

interface RawPLRow {
  PeriodNo: number;
  AccType: string;
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

function buildProjectFilter(projects?: string[]): { clause: string; params: string[] } {
  if (!projects || projects.length === 0) return { clause: '', params: [] };
  const placeholders = projects.map(() => '?').join(',');
  return { clause: `AND pb.ProjNo IN (${placeholders})`, params: projects };
}

function queryPLRaw(periodFrom: number, periodTo: number, projects?: string[]): RawPLRow[] {
  const db = getDb();
  const { clause, params } = buildProjectFilter(projects);

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
      ${clause}
    GROUP BY pb.PeriodNo, gm.AccType, plf.CreditAsPositive
    ORDER BY pb.PeriodNo, plf.Seq
  `).all(periodFrom, periodTo, ...params) as RawPLRow[];
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

function groupByPeriod(rows: RawPLRow[]): Record<number, RawPLRow[]> {
  const byPeriod: Record<number, RawPLRow[]> = {};
  for (const r of rows) {
    if (!byPeriod[r.PeriodNo]) byPeriod[r.PeriodNo] = [];
    byPeriod[r.PeriodNo].push(r);
  }
  return byPeriod;
}

function getLatestPeriod(): number {
  const db = getDb();
  // Only consider periods that have actual P&L transactions (not just BS entries)
  const row = db.prepare(`
    SELECT MAX(pb.PeriodNo) as maxP
    FROM pbalance pb
    JOIN gl_mast gm ON pb.AccNo = gm.AccNo
    JOIN acc_type at ON gm.AccType = at.AccType
    WHERE at.IsBSType = 'F'
      AND (pb.HomeDR <> 0 OR pb.HomeCR <> 0)
  `).get() as { maxP: number };
  return row.maxP;
}

// --- Section 1: KPI Summary ----------------------------------------------

export function getV2PLKpis(fy: string, projects?: string[]): V2KpiData {
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);

  const latestPeriod = Math.min(getLatestPeriod(), to);
  const rows = queryPLRaw(from, latestPeriod, projects);
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

export function getV2PLMonthly(fy: string, projects?: string[], range = 'fy'): V2MonthlyResponse {
  const fyNum = fyNameToNumber(fy);
  const { from: fyFrom, to: fyTo } = fyToPeriodRange(fyNum);
  const latestPeriod = getLatestPeriod();

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

  const rows = queryPLRaw(periodFrom, periodTo, projects);
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

export function getV2PLStatement(fy: string, projects?: string[]): V2StatementResponse {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from: fyFrom, to: fyTo } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);
  const latestPeriod = Math.min(getLatestPeriod(), fyTo);
  const prevPeriod = latestPeriod - 1;

  // Build the months array for the current FY (up to latest period)
  const periods = fyPeriods(fyFrom, latestPeriod);
  const monthLabels = periods.map(p => ({ period: p, label: periodLabel(p) }));
  const numMonths = periods.length;
  const zeros = () => new Array(numMonths).fill(0) as number[];

  const { clause: projClause, params: projParams } = buildProjectFilter(projects);

  // Get account-level detail for all needed periods
  const accountRows = db.prepare(`
    SELECT
      gm.AccType,
      gm.AccNo,
      gm.Description,
      pb.PeriodNo,
      plf.Seq,
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
      ${projClause}
    GROUP BY gm.AccType, gm.AccNo, pb.PeriodNo, plf.CreditAsPositive
    ORDER BY plf.Seq, gm.AccNo
  `).all(priorFrom, fyTo, ...projParams) as {
    AccType: string; AccNo: string; Description: string;
    PeriodNo: number; Seq: number; net_amount: number;
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
    const key = r.AccNo;
    if (!accMap[key]) {
      accMap[key] = {
        accno: r.AccNo, description: r.Description, accType: r.AccType, seq: r.Seq,
        current_month: 0, prev_month: 0, ytd: 0, prior_ytd: 0, monthly: zeros(),
      };
    }
    const a = accMap[key];
    if (r.PeriodNo === latestPeriod) a.current_month += r.net_amount;
    if (r.PeriodNo === prevPeriod) a.prev_month += r.net_amount;
    if (r.PeriodNo >= fyFrom && r.PeriodNo <= latestPeriod) a.ytd += r.net_amount;
    if (r.PeriodNo >= priorFrom && r.PeriodNo <= priorTo) a.prior_ytd += r.net_amount;
    const mIdx = periods.indexOf(r.PeriodNo);
    if (mIdx >= 0) a.monthly[mIdx] += r.net_amount;
  }

  // Get acc_type descriptions and PLFormat ordering
  const plFormat = db.prepare(`
    SELECT plf.AccType, plf.Seq, at.Description
    FROM pl_format plf
    JOIN acc_type at ON plf.AccType = at.AccType
    WHERE plf.RowType = 'A'
    ORDER BY plf.Seq
  `).all() as { AccType: string; Seq: number; Description: string }[];

  // Group accounts by AccType
  const groups: V2StatementGroup[] = [];
  for (const fmt of plFormat) {
    const accounts: V2StatementAccount[] = Object.values(accMap)
      .filter(a => a.accType === fmt.AccType)
      .filter(a => a.current_month !== 0 || a.prev_month !== 0 || a.ytd !== 0 || a.prior_ytd !== 0)
      .sort((a, b) => a.accno.localeCompare(b.accno))
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
      acc_type: fmt.AccType,
      acc_type_name: fmt.Description,
      seq: fmt.Seq,
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

export function getV2Segments(fy: string): V2SegmentRow[] {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(getLatestPeriod(), to);

  const rows = db.prepare(`
    SELECT
      CASE WHEN pb.ProjNo = '' THEN 'Unassigned' ELSE pb.ProjNo END AS segment,
      COALESCE(p.Description, CASE WHEN pb.ProjNo = '' THEN 'Unassigned' ELSE pb.ProjNo END) AS segment_name,
      gm.AccType,
      CASE
        WHEN plf.CreditAsPositive = 'T' THEN SUM(pb.HomeCR) - SUM(pb.HomeDR)
        ELSE SUM(pb.HomeDR) - SUM(pb.HomeCR)
      END AS net_amount
    FROM pbalance pb
    JOIN gl_mast gm ON pb.AccNo = gm.AccNo
    JOIN acc_type at ON gm.AccType = at.AccType
    JOIN pl_format plf ON gm.AccType = plf.AccType
    LEFT JOIN project p ON pb.ProjNo = p.ProjNo
    WHERE at.IsBSType = 'F'
      AND pb.PeriodNo BETWEEN ? AND ?
    GROUP BY CASE WHEN pb.ProjNo = '' THEN 'Unassigned' ELSE pb.ProjNo END,
             gm.AccType, plf.CreditAsPositive
  `).all(from, latestPeriod) as { segment: string; segment_name: string; AccType: string; net_amount: number }[];

  const bySegment: Record<string, { name: string; types: Record<string, number> }> = {};
  for (const r of rows) {
    if (!bySegment[r.segment]) bySegment[r.segment] = { name: r.segment_name, types: {} };
    bySegment[r.segment].types[r.AccType] = (bySegment[r.segment].types[r.AccType] || 0) + r.net_amount;
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

export function getV2Expenses(fy: string, projects?: string[], topN = 10): V2ExpenseResponse {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(getLatestPeriod(), to);
  const { clause, params } = buildProjectFilter(projects);

  const rows = db.prepare(`
    SELECT
      COALESCE(gm.ParentAccNo, gm.AccNo) AS accno,
      COALESCE(
        (SELECT p.Description FROM gl_mast p WHERE p.AccNo = gm.ParentAccNo),
        gm.Description
      ) AS name,
      SUM(pb.HomeDR) - SUM(pb.HomeCR) AS amount
    FROM pbalance pb
    JOIN gl_mast gm ON pb.AccNo = gm.AccNo
    WHERE gm.AccType = 'EP'
      AND pb.PeriodNo BETWEEN ? AND ?
      ${clause}
    GROUP BY COALESCE(gm.ParentAccNo, gm.AccNo)
    HAVING SUM(pb.HomeDR) - SUM(pb.HomeCR) <> 0
    ORDER BY amount DESC
  `).all(from, latestPeriod, ...params) as { accno: string; name: string; amount: number }[];

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
  const plRows = queryPLRaw(from, latestPeriod, projects);
  const agg = aggregatePL(plRows);

  return {
    items: topItems,
    total_expenses: total,
    expense_to_revenue_ratio: agg.net_sales !== 0 ? (total / agg.net_sales) * 100 : 0,
  };
}

export function getV2ExpensesTrend(fy: string, projects?: string[]): V2ExpenseTrendRow[] {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(getLatestPeriod(), to);
  const { clause, params } = buildProjectFilter(projects);

  const rows = db.prepare(`
    SELECT
      pb.PeriodNo,
      COALESCE(gm.ParentAccNo, gm.AccNo) AS accno,
      COALESCE(
        (SELECT p.Description FROM gl_mast p WHERE p.AccNo = gm.ParentAccNo),
        gm.Description
      ) AS name,
      SUM(pb.HomeDR) - SUM(pb.HomeCR) AS amount
    FROM pbalance pb
    JOIN gl_mast gm ON pb.AccNo = gm.AccNo
    WHERE gm.AccType = 'EP'
      AND pb.PeriodNo BETWEEN ? AND ?
      ${clause}
    GROUP BY pb.PeriodNo, COALESCE(gm.ParentAccNo, gm.AccNo)
    HAVING SUM(pb.HomeDR) - SUM(pb.HomeCR) <> 0
    ORDER BY pb.PeriodNo
  `).all(from, latestPeriod, ...params) as { PeriodNo: number; accno: string; name: string; amount: number }[];

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
  const result: V2ExpenseTrendRow[] = [];
  for (let p = from; p <= latestPeriod; p++) {
    const periodRows = rows.filter(r => r.PeriodNo === p);
    const expenses: Record<string, number> = {};
    for (const accno of top5) {
      const match = periodRows.find(r => r.accno === accno);
      expenses[totals[accno].name] = match ? match.amount : 0;
    }
    result.push({ period: p, label: periodLabel(p), expenses });
  }

  return result;
}

// --- Section 6: COGS Analysis --------------------------------------------

export function getV2COGS(fy: string, projects?: string[]): V2COGSResponse {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(getLatestPeriod(), to);
  const { clause, params } = buildProjectFilter(projects);

  const rows = db.prepare(`
    SELECT
      pb.PeriodNo,
      gm.AccNo,
      gm.Description,
      SUM(pb.HomeDR) - SUM(pb.HomeCR) AS net_amount
    FROM pbalance pb
    JOIN gl_mast gm ON pb.AccNo = gm.AccNo
    WHERE gm.AccType = 'CO'
      AND pb.PeriodNo BETWEEN ? AND ?
      ${clause}
    GROUP BY pb.PeriodNo, gm.AccNo
    ORDER BY pb.PeriodNo, gm.AccNo
  `).all(from, latestPeriod, ...params) as { PeriodNo: number; AccNo: string; Description: string; net_amount: number }[];

  // Build monthly COGS composition
  const monthly: V2COGSMonthly[] = [];
  for (let p = from; p <= latestPeriod; p++) {
    const periodRows = rows.filter(r => r.PeriodNo === p);
    const components: V2COGSComponent[] = periodRows
      .filter(r => r.net_amount !== 0)
      .map(r => ({ accno: r.AccNo, name: r.Description, amount: r.net_amount }));
    const total = components.reduce((s, c) => s + c.amount, 0);
    monthly.push({ period: p, label: periodLabel(p), components, total });
  }

  // Compute ratios across the full period
  const totalCOGS = rows.reduce((s, r) => s + r.net_amount, 0);

  // Get net sales for ratio
  const plRows = queryPLRaw(from, latestPeriod, projects);
  const agg = aggregatePL(plRows);

  // Find specific COGS components for ratios
  const purchases = rows
    .filter(r => r.Description.toLowerCase().includes('purchase') && !r.Description.toLowerCase().includes('return'))
    .reduce((s, r) => s + r.net_amount, 0);
  const discounts = Math.abs(rows
    .filter(r => r.Description.toLowerCase().includes('discount'))
    .reduce((s, r) => s + r.net_amount, 0));
  const returns = Math.abs(rows
    .filter(r => r.Description.toLowerCase().includes('return'))
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

export function getV2Health(fy: string): V2HealthResponse {
  const db = getDb();
  const fyNum = fyNameToNumber(fy);
  const { from, to } = fyToPeriodRange(fyNum);
  const latestPeriod = Math.min(getLatestPeriod(), to);

  // Get BS data for current ratio & working capital
  const openRows = db.prepare(`
    SELECT AccNo, SUM(COALESCE(HomeDR, 0)) - SUM(COALESCE(HomeCR, 0)) AS open_net
    FROM obalance
    GROUP BY AccNo
  `).all() as { AccNo: string; open_net: number }[];
  const openMap: Record<string, number> = {};
  for (const r of openRows) openMap[r.AccNo] = r.open_net;

  // Movements up to latest period
  const moveRows = db.prepare(`
    SELECT AccNo, SUM(COALESCE(HomeDR, 0)) - SUM(COALESCE(HomeCR, 0)) AS move_net
    FROM pbalance
    WHERE PeriodNo BETWEEN 24255 AND ?
    GROUP BY AccNo
  `).all(latestPeriod) as { AccNo: string; move_net: number }[];
  const moveMap: Record<string, number> = {};
  for (const r of moveRows) moveMap[r.AccNo] = r.move_net;

  // BS accounts
  const bsAccounts = db.prepare(`
    SELECT gm.AccNo, gm.AccType, gm.Description, bsf.CreditAsPositive
    FROM gl_mast gm
    JOIN acc_type at ON gm.AccType = at.AccType
    JOIN bs_format bsf ON gm.AccType = bsf.AccType
    WHERE at.IsBSType = 'T'
  `).all() as { AccNo: string; AccType: string; Description: string; CreditAsPositive: string }[];

  const byType: Record<string, number> = {};
  for (const acc of bsAccounts) {
    const rawNet = (openMap[acc.AccNo] || 0) + (moveMap[acc.AccNo] || 0);
    const signedNet = acc.CreditAsPositive === 'T' ? -rawNet : rawNet;
    byType[acc.AccType] = (byType[acc.AccType] || 0) + signedNet;
  }

  const ca = byType['CA'] || 0;
  const cl = byType['CL'] || 0;
  const currentRatio = cl !== 0 ? ca / cl : 0;
  const workingCapital = ca - cl;

  // AR Turnover
  const tradeDebtors = bsAccounts
    .filter(a => a.AccType === 'CA' && a.Description.toUpperCase().includes('DEBTOR'));
  const arBalance = tradeDebtors.reduce((s, a) => {
    const raw = (openMap[a.AccNo] || 0) + (moveMap[a.AccNo] || 0);
    return s + (a.CreditAsPositive === 'T' ? -raw : raw);
  }, 0);

  const arOpenBalance = tradeDebtors.reduce((s, a) => {
    const raw = openMap[a.AccNo] || 0;
    return s + (a.CreditAsPositive === 'T' ? -raw : raw);
  }, 0);
  const avgAR = (arOpenBalance + arBalance) / 2;

  // AP Turnover
  const tradeCreditors = bsAccounts
    .filter(a => a.AccType === 'CL' && a.Description.toUpperCase().includes('CREDITOR'));
  const apBalance = tradeCreditors.reduce((s, a) => {
    const raw = (openMap[a.AccNo] || 0) + (moveMap[a.AccNo] || 0);
    return s + (a.CreditAsPositive === 'T' ? -raw : raw);
  }, 0);
  const apOpenBalance = tradeCreditors.reduce((s, a) => {
    const raw = openMap[a.AccNo] || 0;
    return s + (a.CreditAsPositive === 'T' ? -raw : raw);
  }, 0);
  const avgAP = (apOpenBalance + apBalance) / 2;

  // Get net sales and COGS for turnover
  const plRows = queryPLRaw(from, latestPeriod);
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

export function getV2YoY(fy: string): V2YoYLineItem[] {
  const fyNum = fyNameToNumber(fy);
  const { from: currFrom, to: currTo } = fyToPeriodRange(fyNum);
  const { from: priorFrom, to: priorTo } = fyToPeriodRange(fyNum - 1);
  const latestPeriod = getLatestPeriod();

  const currRows = queryPLRaw(currFrom, Math.min(latestPeriod, currTo));
  const priorRows = queryPLRaw(priorFrom, priorTo);

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
