import { getDb } from './db';
import { getRefDate } from './queries';
import { daysInMonth } from './date-utils';
import { computeCreditScoreV2, type CreditScoreV2Weights, type RiskThresholds } from './credit-score-v2';
import { getSettingsV2 } from './settings';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KpiV2Data {
  total_outstanding: number;
  overdue_customers: number;
  overdue_amount: number;
  overdue_pct: number;
  dso: number | null;
  collection_rate: number | null;
  credit_limit_breaches: number;
  avg_monthly_collection: number | null;
}

export interface CreditUtilizationRow {
  category: string;
  customer_count: number;
  total_outstanding: number;
}

export interface DsoTrendRow {
  month: string;
  dso: number | null;
  ar_outstanding: number;
  credit_sales: number;
}

export interface CreditHealthV2Row {
  debtor_code: string;
  company_name: string;
  debtor_type: string;
  sales_agent: string;
  credit_limit: number;
  total_outstanding: number;
  oldest_due: string | null;
  max_overdue_days: number;
  aging_count: number;
  utilization_pct: number | null;
  risk_tier: string;
  credit_score: number;
}

export interface CustomerInvoiceV2 {
  doc_no: string;
  doc_date: string;
  due_date: string;
  total: number;
  outstanding: number;
  days_overdue: number;
  display_term: string | null;
}

// ─── KPIs V2 ────────────────────────────────────────────────────────────────

export function getKpisV2(startDate: string, endDate: string): KpiV2Data {
  const db = getDb();
  const refDate = getRefDate();

  // Snapshot: Total Outstanding (no date filter)
  const osRow = db.prepare(`
    SELECT ROUND(SUM(Outstanding), 2) AS total_outstanding
    FROM ar_invoice
    WHERE Cancelled = 'F' AND Outstanding > 0
  `).get() as { total_outstanding: number } | undefined;

  // Snapshot: Overdue Customers (no date filter, overdue = DueDate < refDate)
  const overdueRow = db.prepare(`
    SELECT COUNT(DISTINCT DebtorCode) AS cnt,
           ROUND(COALESCE(SUM(Outstanding), 0), 2) AS overdue_amount
    FROM ar_invoice
    WHERE Cancelled = 'F' AND Outstanding > 0
      AND DATE(DueDate, '+8 hours') < $refDate
  `).get({ refDate }) as { cnt: number; overdue_amount: number };

  const totalOs = osRow?.total_outstanding ?? 0;
  const overduePct = totalOs > 0 ? Math.round((overdueRow.overdue_amount / totalOs) * 1000) / 10 : 0;

  // Period: DSO = average of monthly DSO values (matches DSO Trend chart)
  const dsoTrend = getDsoTrendV2(startDate, endDate);
  const validDsoPoints = dsoTrend.filter(d => d.dso != null);
  const dso = validDsoPoints.length > 0
    ? Math.round((validDsoPoints.reduce((s, d) => s + (d.dso ?? 0), 0) / validDsoPoints.length) * 10) / 10
    : null;

  // We still need daysDiff for avg monthly collection calc below
  const daysDiff = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));

  // Period: Collection Rate
  const collectedRow = db.prepare(`
    SELECT ROUND(SUM(LocalPaymentAmt), 2) AS total_collected
    FROM ar_payment
    WHERE Cancelled = 'F'
      AND DATE(DocDate, '+8 hours') >= $startDate
      AND DATE(DocDate, '+8 hours') <= $endDate
  `).get({ startDate, endDate }) as { total_collected: number | null };

  const invoicedRow = db.prepare(`
    SELECT ROUND(SUM(LocalNetTotal), 2) AS total_invoiced
    FROM ar_invoice
    WHERE Cancelled = 'F'
      AND DATE(DocDate, '+8 hours') >= $startDate
      AND DATE(DocDate, '+8 hours') <= $endDate
  `).get({ startDate, endDate }) as { total_invoiced: number | null };

  const totalCollected = collectedRow?.total_collected ?? 0;
  const totalInvoiced = invoicedRow?.total_invoiced ?? 0;
  const collectionRate = totalInvoiced > 0
    ? Math.round((totalCollected / totalInvoiced) * 1000) / 10
    : null;

  // Snapshot: Credit Limit Breaches (no date filter)
  const breachRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM (
      SELECT i.DebtorCode
      FROM ar_invoice i
      JOIN debtor d ON i.DebtorCode = d.DebtorCode
      WHERE i.Cancelled = 'F' AND i.Outstanding > 0
        AND d.CreditLimit > 0
        AND (d.IsActive = 'T' OR d.IsActive IS NULL)
      GROUP BY i.DebtorCode
      HAVING SUM(i.Outstanding) > d.CreditLimit
    )
  `).get() as { cnt: number };

  // Period: Avg Monthly Collection = SUM(collected) / months_in_range
  const monthsInRange = Math.max(1, Math.round(daysDiff / 30.44));
  const avgMonthlyCollection = totalCollected > 0
    ? Math.round((totalCollected / monthsInRange) * 100) / 100
    : null;

  return {
    total_outstanding: totalOs,
    overdue_customers: overdueRow.cnt,
    overdue_amount: overdueRow.overdue_amount,
    overdue_pct: overduePct,
    dso,
    collection_rate: collectionRate,
    credit_limit_breaches: breachRow.cnt,
    avg_monthly_collection: avgMonthlyCollection,
  };
}

// ─── Credit Utilization Distribution (Snapshot — no date filter) ────────────

export function getCreditUtilizationV2(): CreditUtilizationRow[] {
  const db = getDb();

  const sql = `
    SELECT
      CASE
        WHEN d.CreditLimit IS NULL OR d.CreditLimit = 0 THEN 'No Limit Set'
        WHEN COALESCE(inv.total_os, 0) * 1.0 / d.CreditLimit * 100 > 100 THEN 'Over Limit'
        WHEN COALESCE(inv.total_os, 0) * 1.0 / d.CreditLimit * 100 >= 80 THEN 'Near Limit'
        ELSE 'Within Limit'
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
    GROUP BY category
  `;

  return db.prepare(sql).all() as CreditUtilizationRow[];
}

// ─── DSO Trend (Period — uses date range) ───────────────────────────────────

export function getDsoTrendV2(startDate: string, endDate: string): DsoTrendRow[] {
  const db = getDb();
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

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
  const result: DsoTrendRow[] = [];
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

// ─── Credit Health Table V2 ─────────────────────────────────────────────────

export function getCreditHealthTableV2(
  sort = 'total_outstanding',
  order: 'asc' | 'desc' = 'desc',
  page = 1,
  pageSize = 20,
  search = '',
  riskFilter = '',
  categoryFilter = '',
): { rows: CreditHealthV2Row[]; total: number } {
  const db = getDb();
  const refDate = getRefDate();
  const settings = getSettingsV2();

  const weights: CreditScoreV2Weights = settings.creditScoreWeights;
  const thresholds: RiskThresholds = settings.riskThresholds;
  const neutralScore = settings.neutralScore ?? 0;

  // Customer outstanding + overdue data
  const customerSql = `
    SELECT
      d.DebtorCode AS debtor_code,
      d.CompanyName AS company_name,
      d.DebtorType AS debtor_type,
      d.SalesAgent AS sales_agent,
      d.CreditLimit AS credit_limit,
      d.OverdueLimit AS overdue_limit,
      COALESCE(inv.total_os, 0) AS total_outstanding,
      inv.oldest_due,
      CASE
        WHEN inv.oldest_overdue_due IS NOT NULL
        THEN CAST(julianday($refDate) - julianday(inv.oldest_overdue_due) AS INTEGER)
        ELSE 0
      END AS max_overdue_days,
      COALESCE(inv.aging_count, 0) AS aging_count
    FROM debtor d
    LEFT JOIN (
      SELECT
        DebtorCode,
        SUM(Outstanding) AS total_os,
        MIN(DATE(DueDate, '+8 hours')) AS oldest_due,
        MIN(CASE WHEN DATE(DueDate, '+8 hours') < $refDate THEN DATE(DueDate, '+8 hours') END) AS oldest_overdue_due,
        COUNT(CASE WHEN DATE(DueDate, '+8 hours') < $refDate THEN 1 END) AS aging_count
      FROM ar_invoice
      WHERE Cancelled = 'F' AND Outstanding > 0
      GROUP BY DebtorCode
    ) inv ON d.DebtorCode = inv.DebtorCode
    WHERE (d.IsActive = 'T' OR d.IsActive IS NULL)
  `;

  const customers = db.prepare(customerSql).all({ refDate }) as {
    debtor_code: string; company_name: string; debtor_type: string;
    sales_agent: string; credit_limit: number; overdue_limit: number;
    total_outstanding: number; oldest_due: string | null; max_overdue_days: number;
    aging_count: number;
  }[];

  // Payment timeliness: avg days late across paid invoices (last 12 months)
  const timelinessSql = `
    SELECT
      i.DebtorCode,
      AVG(julianday(DATE(p.DocDate, '+8 hours')) - julianday(DATE(i.DueDate, '+8 hours'))) AS avg_days_late
    FROM ar_payment_knock_off ko
    JOIN ar_payment p ON p.DocKey = ko.DocKey
    JOIN ar_invoice i ON i.DocKey = ko.KnockOffDocKey
    WHERE p.Cancelled = 'F'
      AND ko.KnockOffDocType = 'RI'
      AND DATE(p.DocDate, '+8 hours') >= DATE($refDate, '-12 months')
    GROUP BY i.DebtorCode
  `;
  const timelinessData = db.prepare(timelinessSql).all({ refDate }) as {
    DebtorCode: string; avg_days_late: number;
  }[];
  const timelinessMap = new Map(timelinessData.map(r => [r.DebtorCode, r.avg_days_late]));

  // Build rows with credit health scores
  let rows: CreditHealthV2Row[] = customers.map(c => {
    const hasCreditLimit = (c.credit_limit ?? 0) > 0;
    const utilPct = hasCreditLimit ? (c.total_outstanding / c.credit_limit) * 100 : null;

    const overdueLimit = c.overdue_limit ?? 0;
    const creditLimitBreached = hasCreditLimit && c.total_outstanding > c.credit_limit;
    const overdueLimitBreached = overdueLimit > 0 && c.total_outstanding > overdueLimit;

    const avgDaysLate = timelinessMap.get(c.debtor_code) ?? null;

    const score = computeCreditScoreV2({
      creditUtilizationPct: utilPct,
      hasCreditLimit,
      oldestOverdueDays: c.max_overdue_days,
      avgDaysLate,
      creditLimitBreached,
      overdueLimitBreached,
    }, weights, thresholds, neutralScore);

    return {
      debtor_code: c.debtor_code,
      company_name: c.company_name ?? '',
      debtor_type: c.debtor_type ?? '',
      sales_agent: c.sales_agent ?? '',
      credit_limit: c.credit_limit ?? 0,
      total_outstanding: c.total_outstanding,
      oldest_due: c.oldest_due,
      max_overdue_days: c.max_overdue_days,
      aging_count: c.aging_count,
      utilization_pct: utilPct != null ? Math.round(utilPct * 10) / 10 : null,
      risk_tier: score.riskTier,
      credit_score: score.score,
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

  // Filter by risk tier
  if (riskFilter) {
    rows = rows.filter(r => r.risk_tier === riskFilter);
  }

  // Filter by category (debtor type)
  if (categoryFilter) {
    rows = rows.filter(r => r.debtor_type === categoryFilter);
  }

  const total = rows.length;

  // Sort
  const sortKey = sort as keyof CreditHealthV2Row;
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

// ─── Customer Profile ───────────────────────────────────────────────────────

export interface CustomerProfileData {
  display_term: string;
  is_active: boolean;
  debtor_type: string;
  sales_agent: string;
  avg_payment_days: number | null;
  // Contact / general fields
  attention: string;
  phone1: string;
  mobile: string;
  email_address: string;
  area_code: string;
  currency_code: string;
  created_date: string | null;
  // Credit health metrics (always included)
  credit_limit: number;
  total_outstanding: number;
  utilization_pct: number | null;
  aging_count: number;
  oldest_due: string | null;
  max_overdue_days: number;
  credit_score: number;
  risk_tier: string;
}

export function getCustomerProfile(debtorCode: string): CustomerProfileData {
  const db = getDb();
  const refDate = getRefDate();
  const settings = getSettingsV2();
  const weights: CreditScoreV2Weights = settings.creditScoreWeights;
  const thresholds: RiskThresholds = settings.riskThresholds;
  const neutralScore = settings.neutralScore ?? 0;

  // Debtor master data
  const debtor = db.prepare(`
    SELECT
      COALESCE(DisplayTerm, '') AS display_term,
      COALESCE(IsActive, 'F') AS is_active,
      COALESCE(DebtorType, '') AS debtor_type,
      COALESCE(SalesAgent, '') AS sales_agent,
      COALESCE(CreditLimit, 0) AS credit_limit,
      COALESCE(OverdueLimit, 0) AS overdue_limit,
      COALESCE(Attention, '') AS attention,
      COALESCE(Phone1, '') AS phone1,
      COALESCE(Mobile, '') AS mobile,
      COALESCE(EmailAddress, '') AS email_address,
      COALESCE(AreaCode, '') AS area_code,
      COALESCE(CurrencyCode, 'MYR') AS currency_code,
      CreatedTimeStamp AS created_date
    FROM debtor
    WHERE DebtorCode = ?
  `).get(debtorCode) as {
    display_term: string; is_active: string; debtor_type: string; sales_agent: string;
    credit_limit: number; overdue_limit: number;
    attention: string; phone1: string; mobile: string; email_address: string;
    area_code: string; currency_code: string; created_date: string | null;
  } | undefined;

  // Outstanding invoices
  const invoiceStats = db.prepare(`
    SELECT
      COALESCE(SUM(Outstanding), 0) AS total_outstanding,
      MIN(DATE(DueDate, '+8 hours')) AS oldest_due,
      MIN(CASE WHEN DATE(DueDate, '+8 hours') < $refDate THEN DATE(DueDate, '+8 hours') END) AS oldest_overdue_due,
      COUNT(CASE WHEN DATE(DueDate, '+8 hours') < $refDate THEN 1 END) AS aging_count
    FROM ar_invoice
    WHERE Cancelled = 'F' AND Outstanding > 0 AND DebtorCode = $debtorCode
  `).get({ refDate, debtorCode }) as {
    total_outstanding: number; oldest_due: string | null;
    oldest_overdue_due: string | null; aging_count: number;
  };

  const maxOverdueDays = invoiceStats.oldest_overdue_due
    ? Math.max(0, Math.round((new Date(refDate).getTime() - new Date(invoiceStats.oldest_overdue_due).getTime()) / 86400000))
    : 0;

  // Credit utilization
  const creditLimit = debtor?.credit_limit ?? 0;
  const hasCreditLimit = creditLimit > 0;
  const utilPct = hasCreditLimit ? (invoiceStats.total_outstanding / creditLimit) * 100 : null;

  // Avg payment period (last 12 months)
  const timeliness = db.prepare(`
    SELECT
      AVG(julianday(DATE(p.DocDate, '+8 hours')) - julianday(DATE(i.DocDate, '+8 hours'))) AS avg_days
    FROM ar_payment_knock_off ko
    JOIN ar_payment p ON p.DocKey = ko.DocKey
    JOIN ar_invoice i ON i.DocKey = ko.KnockOffDocKey
    WHERE p.Cancelled = 'F'
      AND ko.KnockOffDocType = 'RI'
      AND i.DebtorCode = ?
  `).get(debtorCode) as { avg_days: number | null } | undefined;

  // Avg days late for timeliness scoring (last 12 months, compared to DueDate)
  const avgDaysLateRow = db.prepare(`
    SELECT
      AVG(julianday(DATE(p.DocDate, '+8 hours')) - julianday(DATE(i.DueDate, '+8 hours'))) AS avg_days_late
    FROM ar_payment_knock_off ko
    JOIN ar_payment p ON p.DocKey = ko.DocKey
    JOIN ar_invoice i ON i.DocKey = ko.KnockOffDocKey
    WHERE p.Cancelled = 'F'
      AND ko.KnockOffDocType = 'RI'
      AND DATE(p.DocDate, '+8 hours') >= DATE(?, '-12 months')
      AND i.DebtorCode = ?
  `).get(refDate, debtorCode) as { avg_days_late: number | null } | undefined;

  const avgDaysLate = avgDaysLateRow?.avg_days_late ?? null;

  // Double breach: check BOTH credit limit AND overdue limit
  const overdueLimit = debtor?.overdue_limit ?? 0;
  const creditLimitBreached = hasCreditLimit && invoiceStats.total_outstanding > creditLimit;
  const overdueLimitBreached = overdueLimit > 0 && invoiceStats.total_outstanding > overdueLimit;

  const score = computeCreditScoreV2({
    creditUtilizationPct: utilPct,
    hasCreditLimit,
    oldestOverdueDays: maxOverdueDays,
    avgDaysLate,
    creditLimitBreached,
    overdueLimitBreached,
  }, weights, thresholds, neutralScore);

  return {
    display_term: debtor?.display_term ?? '',
    is_active: (debtor?.is_active ?? 'F') === 'T',
    debtor_type: debtor?.debtor_type ?? '',
    sales_agent: debtor?.sales_agent ?? '',
    avg_payment_days: timeliness?.avg_days != null ? Math.round(timeliness.avg_days) : null,
    attention: debtor?.attention ?? '',
    phone1: debtor?.phone1 ?? '',
    mobile: debtor?.mobile ?? '',
    email_address: debtor?.email_address ?? '',
    area_code: debtor?.area_code ?? '',
    currency_code: debtor?.currency_code ?? 'MYR',
    created_date: debtor?.created_date ?? null,
    credit_limit: creditLimit,
    total_outstanding: invoiceStats.total_outstanding,
    utilization_pct: utilPct != null ? Math.round(utilPct * 10) / 10 : null,
    aging_count: invoiceStats.aging_count,
    oldest_due: invoiceStats.oldest_due,
    max_overdue_days: maxOverdueDays,
    credit_score: score.score,
    risk_tier: score.riskTier,
  };
}
