import { getPool, queryRds } from '../postgres';
import { getRefDate } from './queries';
import { daysInMonth } from './date-utils';
import { computeCreditScoreV2 } from './credit-score-v2';
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

// ─── KPIs V2 (from pc_ar_customer_snapshot + pc_ar_monthly) ─────────────────

export async function getKpisV2(startDate: string, endDate: string): Promise<KpiV2Data> {
  const pool = getPool();
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  // Latest snapshot
  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
  if (!latest?.d) {
    return { total_outstanding: 0, overdue_customers: 0, overdue_amount: 0, overdue_pct: 0,
      dso: null, collection_rate: null, credit_limit_breaches: 0, avg_monthly_collection: null };
  }

  // Snapshot: Total Outstanding
  const osRow = (await pool.query(`
    SELECT ROUND(SUM(total_outstanding)::numeric, 2)::float AS total_outstanding
    FROM pc_ar_customer_snapshot WHERE snapshot_date = $1 AND total_outstanding > 0
      AND company_name NOT ILIKE 'CASH DEBT%' AND company_name NOT ILIKE 'CASH SALES%'
  `, [latest.d])).rows[0] as { total_outstanding: number } | undefined;

  // Snapshot: Overdue Customers
  const overdueRow = (await pool.query(`
    SELECT
      COUNT(DISTINCT debtor_code)::int AS cnt,
      ROUND(COALESCE(SUM(overdue_amount), 0)::numeric, 2)::float AS overdue_amount
    FROM pc_ar_customer_snapshot
    WHERE snapshot_date = $1 AND overdue_amount > 0
      AND company_name NOT ILIKE 'CASH DEBT%' AND company_name NOT ILIKE 'CASH SALES%'
  `, [latest.d])).rows[0] as { cnt: number; overdue_amount: number };

  const totalOs = osRow?.total_outstanding ?? 0;
  const overduePct = totalOs > 0 ? Math.round((overdueRow.overdue_amount / totalOs) * 1000) / 10 : 0;

  // Period: DSO
  const dsoTrend = await getDsoTrendV2(startDate, endDate);
  const validDsoPoints = dsoTrend.filter(d => d.dso != null);
  const dso = validDsoPoints.length > 0
    ? Math.round((validDsoPoints.reduce((s, d) => s + (d.dso ?? 0), 0) / validDsoPoints.length) * 10) / 10
    : null;

  // Period: Collection Rate (from pc_ar_monthly)
  const collRow = (await pool.query(`
    SELECT
      COALESCE(SUM(collected), 0)::float AS total_collected,
      COALESCE(SUM(invoiced), 0)::float AS total_invoiced
    FROM pc_ar_monthly
    WHERE month BETWEEN $1 AND $2
  `, [startMonth, endMonth])).rows[0] as { total_collected: number; total_invoiced: number };

  const collectionRate = collRow.total_invoiced > 0
    ? Math.round((collRow.total_collected / collRow.total_invoiced) * 1000) / 10
    : null;

  // Snapshot: Credit Limit Breaches
  const breachRow = (await pool.query(`
    SELECT COUNT(*)::int AS cnt
    FROM pc_ar_customer_snapshot
    WHERE snapshot_date = $1
      AND credit_limit > 0
      AND total_outstanding > credit_limit
      AND is_active = 'T'
      AND company_name NOT ILIKE 'CASH DEBT%' AND company_name NOT ILIKE 'CASH SALES%'
  `, [latest.d])).rows[0] as { cnt: number };

  // Period: Avg Monthly Collection
  const daysDiff = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const monthsInRange = Math.max(1, Math.round(daysDiff / 30.44));
  const avgMonthlyCollection = collRow.total_collected > 0
    ? Math.round((collRow.total_collected / monthsInRange) * 100) / 100
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

// ─── Credit Utilization V2 (from pc_ar_customer_snapshot) ───────────────────

export async function getCreditUtilizationV2(): Promise<CreditUtilizationRow[]> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
  if (!latest?.d) return [];

  const { rows } = await pool.query(`
    SELECT
      CASE
        WHEN credit_limit IS NULL OR credit_limit = 0 THEN 'No Limit Set'
        WHEN total_outstanding / credit_limit * 100 > 100 THEN 'Over Limit'
        WHEN total_outstanding / credit_limit * 100 >= 80 THEN 'Near Limit'
        ELSE 'Within Limit'
      END AS category,
      COUNT(*)::int AS customer_count,
      ROUND(SUM(COALESCE(total_outstanding, 0))::numeric, 2)::float AS total_outstanding
    FROM pc_ar_customer_snapshot
    WHERE snapshot_date = $1 AND (is_active = 'T' OR is_active IS NULL)
      AND company_name NOT ILIKE 'CASH DEBT%'
      AND company_name NOT ILIKE 'CASH SALES%'
    GROUP BY category
  `, [latest.d]);

  return rows;
}

// ─── DSO Trend V2 (from pc_ar_monthly) ─────────────────────────────────────

export async function getDsoTrendV2(startDate: string, endDate: string): Promise<DsoTrendRow[]> {
  const pool = getPool();
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      month,
      total_outstanding::float AS ar_outstanding,
      invoiced::float AS credit_sales
    FROM pc_ar_monthly
    WHERE month BETWEEN $1 AND $2
    ORDER BY month
  `, [startMonth, endMonth]);

  return rows.map((r: { month: string; ar_outstanding: number; credit_sales: number }) => {
    const days = daysInMonth(r.month);
    const dso = r.credit_sales > 0
      ? Math.round((r.ar_outstanding / r.credit_sales) * days * 10) / 10
      : null;
    return {
      month: r.month,
      dso,
      ar_outstanding: Math.round(r.ar_outstanding),
      credit_sales: Math.round(r.credit_sales),
    };
  });
}

// ─── Credit Health Table V2 (from pc_ar_customer_snapshot) ─────────────────

export async function getCreditHealthTableV2(
  sort = 'total_outstanding',
  order: 'asc' | 'desc' = 'desc',
  page = 1,
  pageSize = 20,
  search = '',
  riskFilter = '',
  categoryFilter = '',
): Promise<{ rows: CreditHealthV2Row[]; total: number }> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
  if (!latest?.d) return { rows: [], total: 0 };

  // Fetch raw inputs and recalculate scores using current settings
  const settings = await getSettingsV2();
  const rawRows = (await pool.query(`
    SELECT
      debtor_code,
      COALESCE(company_name, '') AS company_name,
      COALESCE(debtor_type, '') AS debtor_type,
      COALESCE(sales_agent, '') AS sales_agent,
      COALESCE(credit_limit, 0)::float AS credit_limit,
      COALESCE(total_outstanding, 0)::float AS total_outstanding,
      COALESCE(overdue_limit, 0)::float AS overdue_limit,
      COALESCE(overdue_amount, 0)::float AS overdue_amount,
      oldest_due_date AS oldest_due,
      COALESCE(max_overdue_days, 0)::int AS max_overdue_days,
      COALESCE(invoice_count, 0)::int AS aging_count,
      utilization_pct::float AS utilization_pct,
      avg_days_late::float AS avg_days_late
    FROM pc_ar_customer_snapshot
    WHERE snapshot_date = $1 AND (is_active = 'T' OR is_active IS NULL)
      AND company_name NOT ILIKE 'CASH DEBT%'
      AND company_name NOT ILIKE 'CASH SALES%'
  `, [latest.d])).rows;

  // Recalculate credit_score and risk_tier from current settings
  let rows: CreditHealthV2Row[] = rawRows.map((r: Record<string, unknown>) => {
    const creditLimit = Number(r.credit_limit) || 0;
    const totalOutstanding = Number(r.total_outstanding) || 0;
    const overdueLimit = Number(r.overdue_limit) || 0;
    const overdueAmt = Number(r.overdue_amount) || 0;

    const result = computeCreditScoreV2(
      {
        creditUtilizationPct: r.utilization_pct != null ? Number(r.utilization_pct) : null,
        hasCreditLimit: creditLimit > 0,
        oldestOverdueDays: Number(r.max_overdue_days) || 0,
        avgDaysLate: r.avg_days_late != null ? Number(r.avg_days_late) : null,
        creditLimitBreached: creditLimit > 0 && totalOutstanding > creditLimit,
        overdueLimitBreached: overdueLimit > 0 && overdueAmt > overdueLimit,
      },
      settings.creditScoreWeights,
      settings.riskThresholds,
    );

    return {
      debtor_code: r.debtor_code as string,
      company_name: r.company_name as string,
      debtor_type: r.debtor_type as string,
      sales_agent: r.sales_agent as string,
      credit_limit: creditLimit,
      total_outstanding: totalOutstanding,
      oldest_due: r.oldest_due as string | null,
      max_overdue_days: Number(r.max_overdue_days) || 0,
      aging_count: Number(r.aging_count) || 0,
      utilization_pct: r.utilization_pct != null ? Number(r.utilization_pct) : null,
      credit_score: result.score,
      risk_tier: result.riskTier,
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

// ─── Customer Profile (from pc_ar_customer_snapshot) ───────────────────────

export interface CustomerProfileData {
  display_term: string;
  is_active: boolean;
  debtor_type: string;
  sales_agent: string;
  avg_payment_days: number | null;
  attention: string;
  phone1: string;
  mobile: string;
  email_address: string;
  area_code: string;
  currency_code: string;
  created_date: string | null;
  credit_limit: number;
  total_outstanding: number;
  utilization_pct: number | null;
  aging_count: number;
  oldest_due: string | null;
  max_overdue_days: number;
  credit_score: number;
  risk_tier: string;
}

export async function getCustomerProfile(debtorCode: string): Promise<CustomerProfileData> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);

  const snapshot = latest?.d ? (await pool.query(`
    SELECT *
    FROM pc_ar_customer_snapshot
    WHERE snapshot_date = $1 AND debtor_code = $2
  `, [latest.d, debtorCode])).rows[0] as Record<string, unknown> | undefined : undefined;

  // Fallback to customer lookup for master data
  const debtor = (await pool.query(`
    SELECT
      COALESCE(displayterm, '') AS display_term,
      COALESCE(isactive, 'F') AS is_active,
      COALESCE(debtortype, '') AS debtor_type,
      COALESCE(salesagent, '') AS sales_agent,
      COALESCE(creditlimit, 0) AS credit_limit,
      COALESCE(attention, '') AS attention,
      COALESCE(phone1, '') AS phone1,
      COALESCE(mobile, '') AS mobile,
      COALESCE(emailaddress, '') AS email_address,
      COALESCE(areacode, '') AS area_code,
      COALESCE(currencycode, 'MYR') AS currency_code,
      createdtimestamp AS created_date
    FROM customer
    WHERE debtorcode = $1
  `, [debtorCode])).rows[0] as Record<string, unknown> | undefined;

  // Recalculate credit score from current settings
  const creditLimit = Number(snapshot?.credit_limit ?? debtor?.credit_limit ?? 0);
  const totalOutstanding = Number(snapshot?.total_outstanding ?? 0);
  const overdueLimit = Number(snapshot?.overdue_limit ?? 0);
  const overdueAmt = Number(snapshot?.overdue_amount ?? 0);
  const maxOverdueDays = Number(snapshot?.max_overdue_days ?? 0);
  const utilPct = snapshot?.utilization_pct != null ? Number(snapshot.utilization_pct) : null;
  const avgDaysLate = snapshot?.avg_days_late != null ? Number(snapshot.avg_days_late) : null;

  const settings = await getSettingsV2();
  const scoreResult = computeCreditScoreV2(
    {
      creditUtilizationPct: utilPct,
      hasCreditLimit: creditLimit > 0,
      oldestOverdueDays: maxOverdueDays,
      avgDaysLate,
      creditLimitBreached: creditLimit > 0 && totalOutstanding > creditLimit,
      overdueLimitBreached: overdueLimit > 0 && overdueAmt > overdueLimit,
    },
    settings.creditScoreWeights,
    settings.riskThresholds,
  );

  return {
    display_term: (snapshot?.display_term ?? debtor?.display_term ?? '') as string,
    is_active: ((snapshot?.is_active ?? debtor?.is_active ?? 'F') as string) === 'T',
    debtor_type: (snapshot?.debtor_type ?? debtor?.debtor_type ?? '') as string,
    sales_agent: (snapshot?.sales_agent ?? debtor?.sales_agent ?? '') as string,
    avg_payment_days: snapshot?.avg_payment_days != null ? Math.round(Number(snapshot.avg_payment_days)) : null,
    attention: (snapshot?.attention ?? debtor?.attention ?? '') as string,
    phone1: (snapshot?.phone1 ?? debtor?.phone1 ?? '') as string,
    mobile: (snapshot?.mobile ?? debtor?.mobile ?? '') as string,
    email_address: (snapshot?.email_address ?? debtor?.email_address ?? '') as string,
    area_code: (snapshot?.area_code ?? debtor?.area_code ?? '') as string,
    currency_code: (snapshot?.currency_code ?? debtor?.currency_code ?? 'MYR') as string,
    created_date: (snapshot?.created_timestamp ?? debtor?.created_date ?? null) as string | null,
    credit_limit: creditLimit,
    total_outstanding: totalOutstanding,
    utilization_pct: utilPct != null ? Math.round(utilPct * 10) / 10 : null,
    aging_count: Number(snapshot?.invoice_count ?? 0),
    oldest_due: (snapshot?.oldest_due_date ?? null) as string | null,
    max_overdue_days: maxOverdueDays,
    credit_score: scoreResult.score,
    risk_tier: scoreResult.riskTier,
  };
}
