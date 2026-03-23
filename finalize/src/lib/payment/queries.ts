import { getDb } from './db';
import { toYearMonth, monthEnd, getMonthsBack, priorMonth, daysInMonth } from './date-utils';
import { computeCreditScore, type CreditScoreResult } from './credit-score';
import { getSettings } from './settings';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Filters {
  debtorTypes?: string[];
  agents?: string[];
  customer?: string;
  terms?: string[];
}

export interface AgingBucket {
  bucket: string;
  invoice_count: number;
  total_outstanding: number;
}

export interface KpiData {
  total_outstanding: number;
  overdue_amount: number;
  dso: number | null;
  collection_rate: number | null;
  over_credit_count: number;
  prev_total_outstanding: number | null;
  prev_overdue_amount: number | null;
  prev_dso: number | null;
  prev_collection_rate: number | null;
  prev_over_credit_count: number | null;
}

export interface CollectionRow {
  month: string;
  total_collected: number;
  payment_count: number;
  total_invoiced: number;
  invoice_count: number;
}

export interface DsoRow {
  month: string;
  dso: number | null;
  ar_outstanding: number;
  credit_sales: number;
}

export interface CreditUtilRow {
  category: string;
  customer_count: number;
  total_outstanding: number;
}

export interface CreditHealthRow {
  debtor_code: string;
  company_name: string;
  debtor_type: string;
  sales_agent: string;
  credit_limit: number;
  total_outstanding: number;
  utilization_pct: number | null;
  overdue_amount: number;
  oldest_overdue: string | null;
  credit_score: number;
  risk_level: string;
  timeliness_score: number;
  utilization_score: number;
  cn_frequency_score: number;
  aging_concentration_score: number;
}

export interface CustomerInvoice {
  doc_no: string;
  doc_date: string;
  due_date: string;
  local_net_total: number;
  outstanding: number;
  days_overdue: number;
}

// ─── Filter helpers ──────────────────────────────────────────────────────────

function buildFilterClauses(filters: Filters, invoiceAlias = 'i', debtorAlias = 'd'): { where: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.debtorTypes && filters.debtorTypes.length > 0) {
    const placeholders = filters.debtorTypes.map((_, i) => `$dt_${i}`).join(', ');
    clauses.push(`${debtorAlias}.DebtorType IN (${placeholders})`);
    filters.debtorTypes.forEach((dt, i) => { params[`dt_${i}`] = dt; });
  }
  if (filters.agents && filters.agents.length > 0) {
    const placeholders = filters.agents.map((_, i) => `$ag_${i}`).join(', ');
    clauses.push(`${debtorAlias}.SalesAgent IN (${placeholders})`);
    filters.agents.forEach((ag, i) => { params[`ag_${i}`] = ag; });
  }
  if (filters.customer) {
    clauses.push(`${invoiceAlias}.DebtorCode = $customer`);
    params.customer = filters.customer;
  }
  if (filters.terms && filters.terms.length > 0) {
    const placeholders = filters.terms.map((_, i) => `$tm_${i}`).join(', ');
    clauses.push(`${debtorAlias}.DisplayTerm IN (${placeholders})`);
    filters.terms.forEach((t, i) => { params[`tm_${i}`] = t; });
  }

  return { where: clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '', params };
}

// ─── Reference Date ──────────────────────────────────────────────────────────

export function getRefDate(): string {
  // Use today's date in MYT (UTC+8)
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

// ─── Dimensions ──────────────────────────────────────────────────────────────

export function getDimensions() {
  const db = getDb();
  const debtorTypes = db.prepare(
    `SELECT DISTINCT DebtorType FROM debtor WHERE DebtorType IS NOT NULL AND DebtorType != '' ORDER BY DebtorType`
  ).all() as { DebtorType: string }[];

  const agents = db.prepare(
    `SELECT DISTINCT SalesAgent FROM debtor WHERE SalesAgent IS NOT NULL AND SalesAgent != '' ORDER BY SalesAgent`
  ).all() as { SalesAgent: string }[];

  const customers = db.prepare(
    `SELECT DebtorCode, CompanyName FROM debtor ORDER BY CompanyName`
  ).all() as { DebtorCode: string; CompanyName: string }[];

  return {
    debtorTypes: debtorTypes.map(r => r.DebtorType),
    agents: agents.map(r => r.SalesAgent),
    customers: customers.map(r => ({ code: r.DebtorCode, name: r.CompanyName })),
  };
}

// ─── Aging Buckets ───────────────────────────────────────────────────────────

export function getAgingBuckets(refDate: string, filters: Filters = {}): AgingBucket[] {
  const db = getDb();
  const { where, params } = buildFilterClauses(filters);

  const sql = `
    SELECT
      CASE
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) <= 0 THEN 'Not Yet Due'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 1 AND 30 THEN '1-30 Days'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 31 AND 60 THEN '31-60 Days'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 61 AND 90 THEN '61-90 Days'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 91 AND 120 THEN '91-120 Days'
        ELSE '120+ Days'
      END AS bucket,
      COUNT(*) AS invoice_count,
      ROUND(SUM(i.Outstanding), 2) AS total_outstanding
    FROM ar_invoice i
    LEFT JOIN debtor d ON i.DebtorCode = d.DebtorCode
    WHERE i.Cancelled = 'F' AND i.Outstanding > 0
      ${where}
    GROUP BY bucket
    ORDER BY MIN(julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')))
  `;

  return db.prepare(sql).all({ refDate, ...params }) as AgingBucket[];
}

// ─── Aging Buckets by Dimension ──────────────────────────────────────────────

export interface AgingByDimensionRow {
  bucket: string;
  dimension: string;
  total_outstanding: number;
  invoice_count: number;
}

export function getAgingBucketsByDimension(
  refDate: string,
  groupBy: 'agent' | 'type',
  filters: Filters = {},
): AgingByDimensionRow[] {
  const db = getDb();
  const { where, params } = buildFilterClauses(filters);

  const dimensionCol = groupBy === 'agent'
    ? "COALESCE(d.SalesAgent, 'Unassigned')"
    : "COALESCE(d.DebtorType, 'Uncategorized')";

  const sql = `
    SELECT
      CASE
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) <= 0 THEN 'Not Yet Due'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 1 AND 30 THEN '1-30 Days'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 31 AND 60 THEN '31-60 Days'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 61 AND 90 THEN '61-90 Days'
        WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) BETWEEN 91 AND 120 THEN '91-120 Days'
        ELSE '120+ Days'
      END AS bucket,
      ${dimensionCol} AS dimension,
      COUNT(*) AS invoice_count,
      ROUND(SUM(i.Outstanding), 2) AS total_outstanding
    FROM ar_invoice i
    LEFT JOIN debtor d ON i.DebtorCode = d.DebtorCode
    WHERE i.Cancelled = 'F' AND i.Outstanding > 0
      ${where}
    GROUP BY bucket, dimension
    ORDER BY MIN(julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours'))), dimension
  `;

  return db.prepare(sql).all({ refDate, ...params }) as AgingByDimensionRow[];
}

// ─── Collection Trend ────────────────────────────────────────────────────────

export function getCollectionTrend(startMonth: string, endMonth: string, filters: Filters = {}): CollectionRow[] {
  const db = getDb();
  const { where: fWhere, params: fParams } = buildFilterClauses(filters, 'p', 'd');

  // Monthly collections
  const paymentsSql = `
    SELECT strftime('%Y-%m', p.DocDate, '+8 hours') AS month,
           COUNT(*) AS payment_count,
           ROUND(SUM(p.LocalPaymentAmt), 2) AS total_collected
    FROM ar_payment p
    LEFT JOIN debtor d ON p.DebtorCode = d.DebtorCode
    WHERE (p.Cancelled = 'F')
      AND strftime('%Y-%m', p.DocDate, '+8 hours') BETWEEN $startMonth AND $endMonth
      ${fWhere.replace(/p\.DebtorCode/g, 'p.DebtorCode')}
    GROUP BY month ORDER BY month
  `;
  const payments = db.prepare(paymentsSql).all({ startMonth, endMonth, ...fParams }) as {
    month: string; payment_count: number; total_collected: number;
  }[];

  const { where: iWhere, params: iParams } = buildFilterClauses(filters, 'i', 'd');

  // Monthly invoiced
  const invoicesSql = `
    SELECT strftime('%Y-%m', i.DocDate, '+8 hours') AS month,
           COUNT(*) AS invoice_count,
           ROUND(SUM(i.LocalNetTotal), 2) AS total_invoiced
    FROM ar_invoice i
    LEFT JOIN debtor d ON i.DebtorCode = d.DebtorCode
    WHERE (i.Cancelled = 'F')
      AND strftime('%Y-%m', i.DocDate, '+8 hours') BETWEEN $startMonth AND $endMonth
      ${iWhere}
    GROUP BY month ORDER BY month
  `;
  const invoices = db.prepare(invoicesSql).all({ startMonth, endMonth, ...iParams }) as {
    month: string; invoice_count: number; total_invoiced: number;
  }[];

  // Merge into month list
  const payMap = new Map(payments.map(p => [p.month, p]));
  const invMap = new Map(invoices.map(i => [i.month, i]));

  // Generate all months in range
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const result: CollectionRow[] = [];
  let cy = sy, cm = sm;
  while (cy < ey || (cy === ey && cm <= em)) {
    const m = `${cy}-${String(cm).padStart(2, '0')}`;
    const pay = payMap.get(m);
    const inv = invMap.get(m);
    result.push({
      month: m,
      total_collected: pay?.total_collected ?? 0,
      payment_count: pay?.payment_count ?? 0,
      total_invoiced: inv?.total_invoiced ?? 0,
      invoice_count: inv?.invoice_count ?? 0,
    });
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }
  return result;
}

// ─── DSO Trend ───────────────────────────────────────────────────────────────

export function getDsoTrend(startMonth: string, endMonth: string): DsoRow[] {
  const db = getDb();

  // Get monthly totals for each table
  const invMonthly = db.prepare(`
    SELECT strftime('%Y-%m', DocDate, '+8 hours') AS month, SUM(LocalNetTotal) AS total
    FROM ar_invoice WHERE Cancelled = 'F'
    GROUP BY month ORDER BY month
  `).all() as { month: string; total: number }[];

  const payMonthly = db.prepare(`
    SELECT strftime('%Y-%m', DocDate, '+8 hours') AS month, SUM(LocalPaymentAmt) AS total
    FROM ar_payment WHERE Cancelled = 'F'
    GROUP BY month ORDER BY month
  `).all() as { month: string; total: number }[];

  const cnMonthly = db.prepare(`
    SELECT strftime('%Y-%m', DocDate, '+8 hours') AS month, SUM(LocalNetTotal) AS total
    FROM ar_cn WHERE Cancelled = 'F'
    GROUP BY month ORDER BY month
  `).all() as { month: string; total: number }[];

  const refMonthly = db.prepare(`
    SELECT strftime('%Y-%m', DocDate, '+8 hours') AS month, SUM(LocalPaymentAmt) AS total
    FROM ar_refund WHERE Cancelled = 'F'
    GROUP BY month ORDER BY month
  `).all() as { month: string; total: number }[];

  // Build lookup maps
  const toMap = (arr: { month: string; total: number }[]) =>
    new Map(arr.map(r => [r.month, r.total]));
  const invMap = toMap(invMonthly);
  const payMap = toMap(payMonthly);
  const cnMap = toMap(cnMonthly);
  const refMap = toMap(refMonthly);

  // Get all months from earliest to endMonth
  const allMonths = new Set([...invMap.keys(), ...payMap.keys(), ...cnMap.keys(), ...refMap.keys()]);
  const sortedMonths = [...allMonths].sort();

  // Compute cumulative AR outstanding at end of each month
  let cumInv = 0, cumPay = 0, cumCn = 0, cumRef = 0;
  const monthEndAR = new Map<string, number>();
  const monthSales = new Map<string, number>();

  for (const m of sortedMonths) {
    cumInv += invMap.get(m) ?? 0;
    cumPay += payMap.get(m) ?? 0;
    cumCn += cnMap.get(m) ?? 0;
    cumRef += refMap.get(m) ?? 0;
    monthEndAR.set(m, cumInv - cumPay - cumCn - cumRef);
    monthSales.set(m, invMap.get(m) ?? 0);
  }

  // Filter to requested range and compute DSO
  const result: DsoRow[] = [];
  for (const m of sortedMonths) {
    if (m < startMonth || m > endMonth) continue;
    const arOS = monthEndAR.get(m) ?? 0;
    const sales = monthSales.get(m) ?? 0;
    const days = daysInMonth(m);
    const dso = sales > 0 ? Math.round((arOS / sales) * days * 10) / 10 : null;
    result.push({ month: m, dso, ar_outstanding: Math.round(arOS), credit_sales: Math.round(sales) });
  }

  return result;
}

// ─── Credit Utilization ──────────────────────────────────────────────────────

export function getCreditUtilization(filters: Filters = {}): CreditUtilRow[] {
  const db = getDb();
  const { where, params } = buildFilterClauses(filters, 'inv', 'd');

  const sql = `
    SELECT
      CASE
        WHEN d.CreditLimit IS NULL OR d.CreditLimit = 0 THEN 'No Limit Set'
        WHEN COALESCE(inv.total_os, 0) * 1.0 / d.CreditLimit * 100 > 100 THEN 'Over Limit'
        WHEN COALESCE(inv.total_os, 0) * 1.0 / d.CreditLimit * 100 >= 80 THEN 'Near Limit'
        ELSE 'Under Limit'
      END AS category,
      COUNT(*) AS customer_count,
      ROUND(SUM(COALESCE(inv.total_os, 0)), 2) AS total_outstanding
    FROM debtor d
    LEFT JOIN (
      SELECT DebtorCode, SUM(Outstanding) AS total_os
      FROM ar_invoice WHERE Cancelled = 'F' AND Outstanding > 0
      GROUP BY DebtorCode
    ) inv ON inv.DebtorCode = d.DebtorCode
    WHERE (d.IsActive = 'T' OR d.IsActive IS NULL)
      ${where}
    GROUP BY category
  `;

  return db.prepare(sql).all(params) as CreditUtilRow[];
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export function getKpis(refDate: string, filters: Filters = {}): KpiData {
  const db = getDb();
  const { where, params } = buildFilterClauses(filters);

  // KPI 1 & 2: Total Outstanding and Overdue (current snapshot)
  const osSql = `
    SELECT
      ROUND(SUM(i.Outstanding), 2) AS total_outstanding,
      ROUND(SUM(CASE WHEN DATE(i.DueDate, '+8 hours') < $refDate THEN i.Outstanding ELSE 0 END), 2) AS overdue_amount
    FROM ar_invoice i
    LEFT JOIN debtor d ON i.DebtorCode = d.DebtorCode
    WHERE i.Cancelled = 'F' AND i.Outstanding > 0
      ${where}
  `;
  const osRow = db.prepare(osSql).get({ refDate, ...params }) as {
    total_outstanding: number; overdue_amount: number;
  };

  // KPI 5: Customers over credit limit
  const overCreditSql = `
    SELECT COUNT(DISTINCT i.DebtorCode) AS cnt
    FROM ar_invoice i
    JOIN debtor d ON i.DebtorCode = d.DebtorCode
    WHERE i.Cancelled = 'F' AND i.Outstanding > 0
      AND d.CreditLimit > 0
      ${where}
    GROUP BY i.DebtorCode
    HAVING SUM(i.Outstanding) > d.CreditLimit
  `;
  const overCreditRows = db.prepare(overCreditSql).all({ refDate, ...params });
  const overCreditCount = overCreditRows.length;

  // KPI 3: DSO for current month
  const currentMonth = toYearMonth(refDate);
  const dsoData = getDsoTrend(currentMonth, currentMonth);
  const currentDso = dsoData.length > 0 ? dsoData[0].dso : null;

  // KPI 4: Collection Rate for current month
  const prevMonthYM = priorMonth(currentMonth);
  const prevMonthEndDate = monthEnd(prevMonthYM);

  // Outstanding at start of current month ≈ AR outstanding at end of prior month
  // Use simplified method: just total outstanding at that point
  const dsoAll = getDsoTrend(prevMonthYM, prevMonthYM);
  const arAtMonthStart = dsoAll.length > 0 ? dsoAll[0].ar_outstanding : 0;

  // Collections this month
  const collSql = `
    SELECT ROUND(SUM(p.LocalPaymentAmt), 2) AS collected
    FROM ar_payment p
    LEFT JOIN debtor d ON p.DebtorCode = d.DebtorCode
    WHERE p.Cancelled = 'F'
      AND strftime('%Y-%m', p.DocDate, '+8 hours') = $currentMonth
      ${where.replace(/i\./g, 'p.')}
  `;
  const collRow = db.prepare(collSql).get({ currentMonth, refDate, ...params }) as { collected: number | null };
  const collected = collRow?.collected ?? 0;
  const collectionRate = arAtMonthStart > 0 ? Math.round((collected / arAtMonthStart) * 1000) / 10 : null;

  // ─── Prior month deltas ────────────────────────────────────────────────
  // Prior month DSO
  const prevDso = dsoAll.length > 0 ? dsoAll[0].dso : null;

  // Prior month collection rate
  const prevPrevMonthYM = priorMonth(prevMonthYM);
  const dsoAllPrev = getDsoTrend(prevPrevMonthYM, prevPrevMonthYM);
  const arAtPrevMonthStart = dsoAllPrev.length > 0 ? dsoAllPrev[0].ar_outstanding : 0;
  const prevCollSql = `
    SELECT ROUND(SUM(p.LocalPaymentAmt), 2) AS collected
    FROM ar_payment p
    LEFT JOIN debtor d ON p.DebtorCode = d.DebtorCode
    WHERE p.Cancelled = 'F'
      AND strftime('%Y-%m', p.DocDate, '+8 hours') = $prevMonthYM
      ${where.replace(/i\./g, 'p.')}
  `;
  const prevCollRow = db.prepare(prevCollSql).get({ prevMonthYM, refDate, ...params }) as { collected: number | null };
  const prevCollected = prevCollRow?.collected ?? 0;
  const prevCollectionRate = arAtPrevMonthStart > 0 ? Math.round((prevCollected / arAtPrevMonthStart) * 1000) / 10 : null;

  return {
    total_outstanding: osRow.total_outstanding ?? 0,
    overdue_amount: osRow.overdue_amount ?? 0,
    dso: currentDso,
    collection_rate: collectionRate,
    over_credit_count: overCreditCount,
    prev_total_outstanding: null, // snapshot-based, delta not easily computed
    prev_overdue_amount: null,
    prev_dso: prevDso,
    prev_collection_rate: prevCollectionRate,
    prev_over_credit_count: null,
  };
}

// ─── Credit Health Table ─────────────────────────────────────────────────────

export function getCreditHealthTable(
  refDate: string,
  filters: Filters = {},
  sort = 'credit_score',
  order: 'asc' | 'desc' = 'asc',
  page = 1,
  pageSize = 20,
  search = '',
  agingBucket = '',
  riskLevel = '',
): { rows: CreditHealthRow[]; total: number } {
  const db = getDb();
  const settings = getSettings();
  const twelveMonthsAgo = (() => {
    const [y, m, d] = refDate.split('-').map(Number);
    const dt = new Date(y, m - 1 - settings.lookbackMonths, d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  })();

  // 1. Get all customers with outstanding or active status
  const { where: fWhere, params: fParams } = buildFilterClauses(filters, 'i', 'd');

  // Customer outstanding data
  const customerOsSql = `
    SELECT
      i.DebtorCode,
      SUM(i.Outstanding) AS total_outstanding,
      SUM(CASE WHEN DATE(i.DueDate, '+8 hours') < $refDate THEN i.Outstanding ELSE 0 END) AS overdue_amount,
      MIN(CASE WHEN i.Outstanding > 0 AND DATE(i.DueDate, '+8 hours') < $refDate THEN DATE(i.DueDate, '+8 hours') END) AS oldest_overdue,
      SUM(CASE WHEN julianday($refDate) - julianday(DATE(i.DueDate, '+8 hours')) > 90 THEN i.Outstanding ELSE 0 END) AS os_90plus
    FROM ar_invoice i
    WHERE i.Cancelled = 'F' AND i.Outstanding > 0
    GROUP BY i.DebtorCode
  `;
  const customerOs = db.prepare(customerOsSql).all({ refDate }) as {
    DebtorCode: string; total_outstanding: number; overdue_amount: number;
    oldest_overdue: string | null; os_90plus: number;
  }[];
  const osMap = new Map(customerOs.map(r => [r.DebtorCode, r]));

  // Payment timeliness (last 12 months)
  const timelinessSql = `
    SELECT
      i.DebtorCode,
      AVG(julianday(DATE(p.DocDate, '+8 hours')) - julianday(DATE(i.DueDate, '+8 hours'))) AS avg_days_late
    FROM ar_payment_knock_off ko
    JOIN ar_payment p ON p.DocKey = ko.DocKey
    JOIN ar_invoice i ON i.DocKey = ko.KnockOffDocKey
    WHERE p.Cancelled = 'F'
      AND ko.KnockOffDocType = 'RI'
      AND DATE(p.DocDate, '+8 hours') >= $twelveMonthsAgo
    GROUP BY i.DebtorCode
  `;
  const timelinessData = db.prepare(timelinessSql).all({ twelveMonthsAgo }) as {
    DebtorCode: string; avg_days_late: number;
  }[];
  const timeMap = new Map(timelinessData.map(r => [r.DebtorCode, r.avg_days_late]));

  // CN frequency (last 12 months)
  const cnSql = `
    SELECT DebtorCode, SUM(LocalNetTotal) AS cn_total
    FROM ar_cn WHERE Cancelled = 'F' AND DATE(DocDate, '+8 hours') >= $twelveMonthsAgo
    GROUP BY DebtorCode
  `;
  const cnData = db.prepare(cnSql).all({ twelveMonthsAgo }) as {
    DebtorCode: string; cn_total: number;
  }[];
  const cnMap = new Map(cnData.map(r => [r.DebtorCode, r.cn_total]));

  const inv12Sql = `
    SELECT DebtorCode, SUM(LocalNetTotal) AS inv_total
    FROM ar_invoice WHERE Cancelled = 'F' AND DATE(DocDate, '+8 hours') >= $twelveMonthsAgo
    GROUP BY DebtorCode
  `;
  const inv12Data = db.prepare(inv12Sql).all({ twelveMonthsAgo }) as {
    DebtorCode: string; inv_total: number;
  }[];
  const inv12Map = new Map(inv12Data.map(r => [r.DebtorCode, r.inv_total]));

  // Get all active debtors
  let debtorSql = `SELECT DebtorCode, CompanyName, DebtorType, SalesAgent, CreditLimit, IsActive FROM debtor WHERE 1=1`;
  const debtorParams: Record<string, unknown> = {};

  if (filters.debtorTypes && filters.debtorTypes.length > 0) {
    const placeholders = filters.debtorTypes.map((_, i) => `$fdt_${i}`).join(', ');
    debtorSql += ` AND DebtorType IN (${placeholders})`;
    filters.debtorTypes.forEach((dt, i) => { debtorParams[`fdt_${i}`] = dt; });
  }
  if (filters.agents && filters.agents.length > 0) {
    const placeholders = filters.agents.map((_, i) => `$fag_${i}`).join(', ');
    debtorSql += ` AND SalesAgent IN (${placeholders})`;
    filters.agents.forEach((ag, i) => { debtorParams[`fag_${i}`] = ag; });
  }
  if (filters.customer) {
    debtorSql += ` AND DebtorCode = $fcustomer`;
    debtorParams.fcustomer = filters.customer;
  }

  const debtors = db.prepare(debtorSql).all(debtorParams) as {
    DebtorCode: string; CompanyName: string; DebtorType: string;
    SalesAgent: string; CreditLimit: number; IsActive: string;
  }[];

  // Compute credit scores and build rows
  let rows: CreditHealthRow[] = debtors
    .filter(d => {
      // Only include debtors with outstanding > 0 or active
      const os = osMap.get(d.DebtorCode);
      return os || d.IsActive === 'T';
    })
    .map(d => {
      const os = osMap.get(d.DebtorCode);
      const totalOs = os?.total_outstanding ?? 0;
      const overdue = os?.overdue_amount ?? 0;
      const oldest = os?.oldest_overdue ?? null;
      const os90plus = os?.os_90plus ?? 0;
      const creditLimit = d.CreditLimit ?? 0;
      const hasCreditLimit = creditLimit > 0;
      const utilizationPct = hasCreditLimit ? (totalOs / creditLimit) * 100 : null;
      const avgDaysLate = timeMap.get(d.DebtorCode) ?? null;
      const cnTotal = cnMap.get(d.DebtorCode) ?? 0;
      const invTotal = inv12Map.get(d.DebtorCode) ?? 0;
      const cnRatio = invTotal > 0 ? (cnTotal / invTotal) * 100 : null;
      const hasInvoices = invTotal > 0;
      const hasOutstanding = totalOs > 0;
      const pct90Plus = totalOs > 0 ? (os90plus / totalOs) * 100 : null;

      const score = computeCreditScore({
        avgDaysLate,
        utilizationPct,
        hasCreditLimit,
        cnRatio,
        hasInvoices,
        pct90Plus,
        hasOutstanding,
      }, {
        weights: settings.creditScoreWeights,
        thresholds: settings.riskThresholds,
        neutralScore: settings.neutralScore,
      });

      return {
        debtor_code: d.DebtorCode,
        company_name: d.CompanyName ?? '',
        debtor_type: d.DebtorType ?? '',
        sales_agent: d.SalesAgent ?? '',
        credit_limit: creditLimit,
        total_outstanding: totalOs,
        utilization_pct: utilizationPct != null ? Math.round(utilizationPct * 10) / 10 : null,
        overdue_amount: overdue,
        oldest_overdue: oldest,
        credit_score: score.score,
        risk_level: score.riskLevel,
        timeliness_score: score.timeliness,
        utilization_score: score.utilization,
        cn_frequency_score: score.cnFreq,
        aging_concentration_score: score.aging,
      };
    });

  // Filter by search
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r =>
      r.debtor_code.toLowerCase().includes(s) ||
      r.company_name.toLowerCase().includes(s)
    );
  }

  // Filter by aging bucket
  if (agingBucket) {
    rows = rows.filter(r => {
      if (r.total_outstanding <= 0) return false;
      // Check if this customer has invoices in this bucket
      const custInvoices = db.prepare(`
        SELECT COUNT(*) as cnt FROM ar_invoice
        WHERE DebtorCode = ? AND Cancelled = 'F' AND Outstanding > 0
          AND ${agingBucketCondition(agingBucket, refDate)}
      `).get(r.debtor_code) as { cnt: number };
      return custInvoices.cnt > 0;
    });
  }

  // Filter by risk level
  if (riskLevel) {
    rows = rows.filter(r => r.risk_level === riskLevel);
  }

  const total = rows.length;

  // Sort
  const sortKey = sort as keyof CreditHealthRow;
  rows.sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    if (va < vb) return order === 'asc' ? -1 : 1;
    if (va > vb) return order === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate
  const startIdx = (page - 1) * pageSize;
  rows = rows.slice(startIdx, startIdx + pageSize);

  return { rows, total };
}

function agingBucketCondition(bucket: string, refDate: string): string {
  switch (bucket) {
    case 'Not Yet Due':
      return `julianday('${refDate}') - julianday(DATE(DueDate, '+8 hours')) <= 0`;
    case '1-30 Days':
      return `julianday('${refDate}') - julianday(DATE(DueDate, '+8 hours')) BETWEEN 1 AND 30`;
    case '31-60 Days':
      return `julianday('${refDate}') - julianday(DATE(DueDate, '+8 hours')) BETWEEN 31 AND 60`;
    case '61-90 Days':
      return `julianday('${refDate}') - julianday(DATE(DueDate, '+8 hours')) BETWEEN 61 AND 90`;
    case '91-120 Days':
      return `julianday('${refDate}') - julianday(DATE(DueDate, '+8 hours')) BETWEEN 91 AND 120`;
    case '120+ Days':
      return `julianday('${refDate}') - julianday(DATE(DueDate, '+8 hours')) > 120`;
    default:
      return '1=1';
  }
}

function julianDay(date: string): number {
  // Not used in JS logic, just a placeholder for naming
  return 0;
}

// ─── Customer Invoices ───────────────────────────────────────────────────────

export function getCustomerInvoices(debtorCode: string, refDate: string): CustomerInvoice[] {
  const db = getDb();
  const sql = `
    SELECT
      DocNo AS doc_no,
      DATE(DocDate, '+8 hours') AS doc_date,
      DATE(DueDate, '+8 hours') AS due_date,
      ROUND(LocalNetTotal, 2) AS local_net_total,
      ROUND(Outstanding, 2) AS outstanding,
      CAST(julianday($refDate) - julianday(DATE(DueDate, '+8 hours')) AS INTEGER) AS days_overdue
    FROM ar_invoice
    WHERE DebtorCode = $debtorCode AND Cancelled = 'F' AND Outstanding > 0
    ORDER BY DueDate ASC
  `;
  return db.prepare(sql).all({ debtorCode, refDate }) as CustomerInvoice[];
}
