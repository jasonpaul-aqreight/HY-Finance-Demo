import { getPool, queryRds } from '../postgres';
import { toYearMonth, monthEnd, getMonthsBack, priorMonth, daysInMonth } from './date-utils';
import { computeCreditScore, type CreditScoreResult } from './credit-score';
import { computeCreditScoreV2 } from './credit-score-v2';
import { getSettings } from './settings';
import { getSettingsV2 } from './settings';

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
  collection_days: number | null;
  collection_rate: number | null;
  over_credit_count: number;
  prev_total_outstanding: number | null;
  prev_overdue_amount: number | null;
  prev_collection_days: number | null;
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

export interface CollectionDaysRow {
  month: string;
  collection_days: number | null;
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

// ─── Snapshot Filter Helper ─────────────────────────────────────────────────

function buildSnapshotFilter(filters: Filters, alias = 's', startIdx = 1): { where: string; params: unknown[]; nextIdx: number } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIdx;

  if (filters.debtorTypes && filters.debtorTypes.length > 0) {
    const placeholders = filters.debtorTypes.map(() => `$${idx++}`).join(', ');
    clauses.push(`${alias}.debtor_type IN (${placeholders})`);
    params.push(...filters.debtorTypes);
  }
  if (filters.agents && filters.agents.length > 0) {
    const placeholders = filters.agents.map(() => `$${idx++}`).join(', ');
    clauses.push(`${alias}.sales_agent IN (${placeholders})`);
    params.push(...filters.agents);
  }
  if (filters.customer) {
    clauses.push(`${alias}.debtor_code = $${idx++}`);
    params.push(filters.customer);
  }
  if (filters.terms && filters.terms.length > 0) {
    const placeholders = filters.terms.map(() => `$${idx++}`).join(', ');
    clauses.push(`${alias}.display_term IN (${placeholders})`);
    params.push(...filters.terms);
  }

  return { where: clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '', params, nextIdx: idx };
}

// Bucket name mapping: pc_ar_aging_history uses short names, UI expects full names
const BUCKET_DISPLAY: Record<string, string> = {
  'Not Yet Due': 'Not Yet Due',
  '1-30': '1-30 Days',
  '31-60': '31-60 Days',
  '61-90': '61-90 Days',
  '91-120': '91-120 Days',
  '120+': '120+ Days',
};

const BUCKET_ORDER = ['Not Yet Due', '1-30', '31-60', '61-90', '91-120', '120+'];

// ─── Reference Date ──────────────────────────────────────────────────────────

export function getRefDate(): string {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

// ─── Dimensions (from lookup tables — unchanged) ────────────────────────────

export async function getDimensions() {
  const pool = getPool();
  const [dtRes, agRes, custRes] = await Promise.all([
    pool.query(`SELECT DISTINCT debtortype FROM customer WHERE debtortype IS NOT NULL AND debtortype != '' ORDER BY debtortype`),
    pool.query(`SELECT DISTINCT salesagent FROM customer WHERE salesagent IS NOT NULL AND salesagent != '' ORDER BY salesagent`),
    pool.query(`SELECT debtorcode, companyname FROM customer ORDER BY companyname`),
  ]);

  return {
    debtorTypes: dtRes.rows.map((r: { debtortype: string }) => r.debtortype),
    agents: agRes.rows.map((r: { salesagent: string }) => r.salesagent),
    customers: custRes.rows.map((r: { debtorcode: string; companyname: string }) => ({ code: r.debtorcode, name: r.companyname })),
  };
}

// ─── Aging Buckets (from pc_ar_aging_history) ───────────────────────────────

export async function getAgingBuckets(refDate: string, filters: Filters = {}): Promise<AgingBucket[]> {
  const pool = getPool();

  // Get latest snapshot date
  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_aging_history`);
  if (!latest?.d) return [];
  const snapshotDate = latest.d;

  const hasFilters = (filters.debtorTypes?.length ?? 0) > 0 || (filters.agents?.length ?? 0) > 0;

  let rows: { bucket: string; invoice_count: number; total_outstanding: number }[];

  if (!hasFilters) {
    // No filters — use pre-aggregated 'all' dimension
    ({ rows } = await pool.query(`
      SELECT bucket, invoice_count::int AS invoice_count, total_outstanding::float AS total_outstanding
      FROM pc_ar_aging_history
      WHERE snapshot_date = $1 AND dimension = 'all'
    `, [snapshotDate]));
  } else {
    // Build dimension filters from the aging history breakdown rows
    const dimClauses: string[] = [];
    const params: unknown[] = [snapshotDate];
    let idx = 2;

    if (filters.debtorTypes?.length) {
      const placeholders = filters.debtorTypes.map(() => `$${idx++}`).join(', ');
      dimClauses.push(`(dimension IN (${filters.debtorTypes.map((t) => `'type:' || $${idx - filters.debtorTypes!.length + filters.debtorTypes!.indexOf(t)}`).join(', ')}))`);
      // Simpler approach: match dimension pattern
      dimClauses.length = 0; // reset
      idx = 2; // reset
      const typePatterns = filters.debtorTypes.map(() => `$${idx++}`);
      dimClauses.push(`dimension IN (${typePatterns.join(', ')})`);
      params.push(...filters.debtorTypes.map(t => `type:${t}`));
    }
    if (filters.agents?.length) {
      const agentPatterns = filters.agents.map(() => `$${idx++}`);
      dimClauses.push(`dimension IN (${agentPatterns.join(', ')})`);
      params.push(...filters.agents.map(a => `agent:${a}`));
    }

    // When both type and agent filters are provided, we can't intersect from the
    // pre-computed table (it stores them separately). Fall back to snapshot table.
    if ((filters.debtorTypes?.length ?? 0) > 0 && (filters.agents?.length ?? 0) > 0) {
      const { where: snWhere, params: snParams } = buildSnapshotFilter(filters, 's', 2);
      ({ rows } = await pool.query(`
        SELECT
          CASE
            WHEN s.max_overdue_days <= 0 THEN 'Not Yet Due'
            WHEN s.max_overdue_days <= 30 THEN '1-30'
            WHEN s.max_overdue_days <= 60 THEN '31-60'
            WHEN s.max_overdue_days <= 90 THEN '61-90'
            WHEN s.max_overdue_days <= 120 THEN '91-120'
            ELSE '120+'
          END AS bucket,
          COUNT(*)::int AS invoice_count,
          SUM(s.total_outstanding)::float AS total_outstanding
        FROM pc_ar_customer_snapshot s
        WHERE s.snapshot_date = $1 AND s.total_outstanding > 0
          ${snWhere}
        GROUP BY bucket
      `, [snapshotDate, ...snParams]));
    } else {
      ({ rows } = await pool.query(`
        SELECT bucket, SUM(invoice_count)::int AS invoice_count, SUM(total_outstanding)::float AS total_outstanding
        FROM pc_ar_aging_history
        WHERE snapshot_date = $1 AND ${dimClauses.join(' OR ')}
        GROUP BY bucket
      `, params));
    }
  }

  return BUCKET_ORDER
    .map(b => {
      const row = rows.find((r: { bucket: string }) => r.bucket === b);
      return row ? { ...row, bucket: BUCKET_DISPLAY[b] || b } : null;
    })
    .filter((r): r is AgingBucket => r !== null);
}

// ─── Aging Buckets by Dimension (from pc_ar_aging_history) ──────────────────

export interface AgingByDimensionRow {
  bucket: string;
  dimension: string;
  total_outstanding: number;
  invoice_count: number;
}

export async function getAgingBucketsByDimension(
  refDate: string,
  groupBy: 'agent' | 'type',
  filters: Filters = {},
): Promise<AgingByDimensionRow[]> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_aging_history`);
  if (!latest?.d) return [];

  const prefix = groupBy === 'agent' ? 'agent:' : 'type:';

  const { rows } = await pool.query(`
    SELECT
      bucket,
      REPLACE(dimension, $2, '') AS dimension,
      invoice_count::int AS invoice_count,
      total_outstanding::float AS total_outstanding
    FROM pc_ar_aging_history
    WHERE snapshot_date = $1 AND dimension LIKE $2 || '%'
    ORDER BY bucket, dimension
  `, [latest.d, prefix]);

  return rows.map((r: AgingByDimensionRow) => ({
    ...r,
    bucket: BUCKET_DISPLAY[r.bucket] || r.bucket,
  }));
}

// ─── Collection Trend (from pc_ar_monthly) ──────────────────────────────────

export interface CollectionTrendResult {
  data: CollectionRow[];
  avg_pay_days: number | null;
}

export async function getCollectionTrend(startMonth: string, endMonth: string, filters: Filters = {}): Promise<CollectionTrendResult> {
  // Generate all months in range
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const months: string[] = [];
  let cy = sy, cm = sm;
  while (cy < ey || (cy === ey && cm <= em)) {
    months.push(`${cy}-${String(cm).padStart(2, '0')}`);
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }

  let avgPayDays: number | null = null;

  // Customer-specific: query RDS for per-customer invoiced/collected by month
  if (filters.customer) {
    const [invoiceRows, paymentRows, payDaysRows] = await Promise.all([
      queryRds<{ month: string; total_invoiced: number; invoice_count: number }>(`
        SELECT
          TO_CHAR(("DocDate" + INTERVAL '8 hours'), 'YYYY-MM') AS month,
          SUM("LocalNetTotal")::float AS total_invoiced,
          COUNT(*)::int AS invoice_count
        FROM dbo."ARInvoice"
        WHERE "DebtorCode" = $1 AND "Cancelled" = 'F'
          AND TO_CHAR(("DocDate" + INTERVAL '8 hours'), 'YYYY-MM') BETWEEN $2 AND $3
        GROUP BY TO_CHAR(("DocDate" + INTERVAL '8 hours'), 'YYYY-MM')
      `, [filters.customer, startMonth, endMonth]),
      queryRds<{ month: string; total_collected: number; payment_count: number }>(`
        SELECT
          TO_CHAR(("DocDate" + INTERVAL '8 hours'), 'YYYY-MM') AS month,
          SUM("LocalPaymentAmt")::float AS total_collected,
          COUNT(*)::int AS payment_count
        FROM dbo."ARPayment"
        WHERE "Cancelled" = 'F'
          AND "DebtorCode" = $1
          AND TO_CHAR(("DocDate" + INTERVAL '8 hours'), 'YYYY-MM') BETWEEN $2 AND $3
        GROUP BY TO_CHAR(("DocDate" + INTERVAL '8 hours'), 'YYYY-MM')
      `, [filters.customer, startMonth, endMonth]),
      queryRds<{ avg_days: number | null }>(`
        SELECT AVG(pay."DocDate"::date - inv."DocDate"::date)::float AS avg_days
        FROM dbo."ARInvoice" inv
        JOIN dbo."ARPaymentKnockOff" ko
          ON ko."KnockOffDocKey" = inv."DocKey" AND ko."KnockOffDocType" = 'RI'
        JOIN dbo."ARPayment" pay ON ko."DocKey" = pay."DocKey"
        WHERE inv."Cancelled" = 'F' AND pay."Cancelled" = 'F'
          AND inv."DebtorCode" = $1
          AND TO_CHAR((pay."DocDate" + INTERVAL '8 hours'), 'YYYY-MM') BETWEEN $2 AND $3
      `, [filters.customer, startMonth, endMonth]),
    ]);

    const invoiceMap = new Map(invoiceRows.map(r => [r.month, r]));
    const paymentMap = new Map(paymentRows.map(r => [r.month, r]));
    avgPayDays = payDaysRows[0]?.avg_days != null ? Math.round(payDaysRows[0].avg_days) : null;

    return {
      data: months.map(m => ({
        month: m,
        total_collected: paymentMap.get(m)?.total_collected ?? 0,
        payment_count: paymentMap.get(m)?.payment_count ?? 0,
        total_invoiced: invoiceMap.get(m)?.total_invoiced ?? 0,
        invoice_count: invoiceMap.get(m)?.invoice_count ?? 0,
      })),
      avg_pay_days: avgPayDays,
    };
  }

  // Aggregate: use pre-computed table
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      month,
      COALESCE(invoiced, 0)::float AS total_invoiced,
      COALESCE(collected, 0)::float AS total_collected,
      customer_count::int AS customer_count,
      COALESCE(invoice_count, 0)::int AS invoice_count,
      COALESCE(payment_count, 0)::int AS payment_count
    FROM pc_ar_monthly
    WHERE month BETWEEN $1 AND $2
    ORDER BY month
  `, [startMonth, endMonth]);

  const monthMap = new Map(rows.map((r: { month: string }) => [r.month, r]));

  return {
    data: months.map(m => {
      const row = monthMap.get(m) as { total_invoiced: number; total_collected: number; invoice_count: number; payment_count: number } | undefined;
      return {
        month: m,
        total_collected: row?.total_collected ?? 0,
        payment_count: row?.payment_count ?? 0,
        total_invoiced: row?.total_invoiced ?? 0,
        invoice_count: row?.invoice_count ?? 0,
      };
    }),
    avg_pay_days: null,
  };
}

// ─── Collection Days Trend (from pc_ar_monthly — already has cumulative outstanding)

export async function getCollectionDaysTrend(startMonth: string, endMonth: string): Promise<CollectionDaysRow[]> {
  const pool = getPool();

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
    const d = daysInMonth(r.month);
    const collection_days = r.credit_sales > 0
      ? Math.round((r.ar_outstanding / r.credit_sales) * d * 10) / 10
      : null;
    return {
      month: r.month,
      collection_days,
      ar_outstanding: Math.round(r.ar_outstanding),
      credit_sales: Math.round(r.credit_sales),
    };
  });
}

// ─── Credit Utilization (from pc_ar_customer_snapshot) ──────────────────────

export async function getCreditUtilization(filters: Filters = {}): Promise<CreditUtilRow[]> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
  if (!latest?.d) return [];

  const { where, params, nextIdx } = buildSnapshotFilter(filters, 's', 2);

  const { rows } = await pool.query(`
    SELECT
      CASE
        WHEN s.credit_limit IS NULL OR s.credit_limit = 0 THEN 'No Limit Set'
        WHEN s.total_outstanding / s.credit_limit * 100 > 100 THEN 'Over Limit'
        WHEN s.total_outstanding / s.credit_limit * 100 >= 80 THEN 'Near Limit'
        ELSE 'Under Limit'
      END AS category,
      COUNT(*)::int AS customer_count,
      ROUND(SUM(s.total_outstanding)::numeric, 2)::float AS total_outstanding
    FROM pc_ar_customer_snapshot s
    WHERE s.snapshot_date = $1 AND s.is_active = 'T'
      AND s.company_name NOT ILIKE 'CASH SALES%'
      ${where}
    GROUP BY category
  `, [latest.d, ...params]);

  return rows;
}

// ─── KPIs (from pc_ar_customer_snapshot + pc_ar_monthly) ────────────────────

export async function getKpis(refDate: string, filters: Filters = {}): Promise<KpiData> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
  if (!latest?.d) {
    return { total_outstanding: 0, overdue_amount: 0, collection_days: null, collection_rate: null, over_credit_count: 0,
      prev_total_outstanding: null, prev_overdue_amount: null, prev_collection_days: null, prev_collection_rate: null, prev_over_credit_count: null };
  }

  const { where, params } = buildSnapshotFilter(filters, 's', 2);

  // KPI 1 & 2: Total Outstanding and Overdue
  const osRow = (await pool.query(`
    SELECT
      ROUND(SUM(s.total_outstanding)::numeric, 2)::float AS total_outstanding,
      ROUND(SUM(s.overdue_amount)::numeric, 2)::float AS overdue_amount
    FROM pc_ar_customer_snapshot s
    WHERE s.snapshot_date = $1 AND s.total_outstanding > 0
      AND s.company_name NOT ILIKE 'CASH SALES%'
      ${where}
  `, [latest.d, ...params])).rows[0] as { total_outstanding: number; overdue_amount: number };

  // KPI 5: Customers over credit limit
  const overCreditRow = (await pool.query(`
    SELECT COUNT(*)::int AS cnt
    FROM pc_ar_customer_snapshot s
    WHERE s.snapshot_date = $1
      AND s.credit_limit > 0
      AND s.total_outstanding > s.credit_limit
      AND s.company_name NOT ILIKE 'CASH SALES%'
      ${where}
  `, [latest.d, ...params])).rows[0] as { cnt: number };

  // KPI 3: Collection Days
  const currentMonth = toYearMonth(refDate);
  const cdData = await getCollectionDaysTrend(currentMonth, currentMonth);
  const currentCd = cdData.length > 0 ? cdData[0].collection_days : null;

  // KPI 4: Collection Rate
  const prevMonthYM = priorMonth(currentMonth);
  const cdPrev = await getCollectionDaysTrend(prevMonthYM, prevMonthYM);
  const arAtMonthStart = cdPrev.length > 0 ? cdPrev[0].ar_outstanding : 0;

  const collMonthRow = (await pool.query(`
    SELECT COALESCE(collected, 0)::float AS collected
    FROM pc_ar_monthly WHERE month = $1
  `, [currentMonth])).rows[0] as { collected: number } | undefined;
  const collected = collMonthRow?.collected ?? 0;
  const collectionRate = arAtMonthStart > 0 ? Math.round((collected / arAtMonthStart) * 1000) / 10 : null;

  // Prior month deltas
  const prevCd = cdPrev.length > 0 ? cdPrev[0].collection_days : null;
  const prevPrevMonthYM = priorMonth(prevMonthYM);
  const cdPrevPrev = await getCollectionDaysTrend(prevPrevMonthYM, prevPrevMonthYM);
  const arAtPrevMonthStart = cdPrevPrev.length > 0 ? cdPrevPrev[0].ar_outstanding : 0;

  const prevCollMonthRow = (await pool.query(`
    SELECT COALESCE(collected, 0)::float AS collected
    FROM pc_ar_monthly WHERE month = $1
  `, [prevMonthYM])).rows[0] as { collected: number } | undefined;
  const prevCollected = prevCollMonthRow?.collected ?? 0;
  const prevCollectionRate = arAtPrevMonthStart > 0 ? Math.round((prevCollected / arAtPrevMonthStart) * 1000) / 10 : null;

  return {
    total_outstanding: osRow.total_outstanding ?? 0,
    overdue_amount: osRow.overdue_amount ?? 0,
    collection_days: currentCd,
    collection_rate: collectionRate,
    over_credit_count: overCreditRow.cnt,
    prev_total_outstanding: null,
    prev_overdue_amount: null,
    prev_collection_days: prevCd,
    prev_collection_rate: prevCollectionRate,
    prev_over_credit_count: null,
  };
}

// ─── Credit Health Table (from pc_ar_customer_snapshot) ─────────────────────

export async function getCreditHealthTable(
  refDate: string,
  filters: Filters = {},
  sort = 'credit_score',
  order: 'asc' | 'desc' = 'asc',
  page = 1,
  pageSize = 20,
  search = '',
  agingBucket = '',
  riskLevel = '',
): Promise<{ rows: CreditHealthRow[]; total: number }> {
  const pool = getPool();

  const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
  if (!latest?.d) return { rows: [], total: 0 };

  const { where, params } = buildSnapshotFilter(filters, 's', 2);

  // Read pre-computed snapshot with credit scores
  let rows: CreditHealthRow[] = (await pool.query(`
    SELECT
      s.debtor_code,
      COALESCE(s.company_name, '') AS company_name,
      COALESCE(s.debtor_type, '') AS debtor_type,
      COALESCE(s.sales_agent, '') AS sales_agent,
      COALESCE(s.credit_limit, 0)::float AS credit_limit,
      COALESCE(s.total_outstanding, 0)::float AS total_outstanding,
      s.utilization_pct::float AS utilization_pct,
      COALESCE(s.overdue_amount, 0)::float AS overdue_amount,
      s.oldest_due_date AS oldest_overdue,
      COALESCE(s.credit_score, 50)::float AS credit_score,
      COALESCE(s.risk_tier, 'moderate') AS risk_level,
      COALESCE(s.avg_payment_days, 0)::float AS avg_payment_days,
      COALESCE(s.max_overdue_days, 0)::int AS max_overdue_days
    FROM pc_ar_customer_snapshot s
    WHERE s.snapshot_date = $1
      AND (s.is_active = 'T' OR s.total_outstanding > 0)
      AND s.company_name NOT ILIKE 'CASH SALES%'
      ${where}
  `, [latest.d, ...params])).rows.map((r: {
    debtor_code: string; company_name: string; debtor_type: string; sales_agent: string;
    credit_limit: number; total_outstanding: number; utilization_pct: number | null;
    overdue_amount: number; oldest_overdue: string | null; credit_score: number;
    risk_level: string; avg_payment_days: number; max_overdue_days: number;
  }) => {
    // Derive component scores from available snapshot data
    const utilScore = r.utilization_pct != null ? Math.max(0, Math.round(100 - r.utilization_pct)) : 50;
    const timeScore = r.avg_payment_days > 0
      ? Math.max(0, Math.min(100, Math.round(100 - ((r.avg_payment_days - 30) / 60) * 100)))
      : 50;
    const agingScore = r.max_overdue_days > 0
      ? Math.max(0, Math.round(100 - (r.max_overdue_days / 120) * 100))
      : 100;

    return {
      debtor_code: r.debtor_code,
      company_name: r.company_name,
      debtor_type: r.debtor_type,
      sales_agent: r.sales_agent,
      credit_limit: r.credit_limit,
      total_outstanding: r.total_outstanding,
      utilization_pct: r.utilization_pct != null ? Math.round(r.utilization_pct * 10) / 10 : null,
      overdue_amount: r.overdue_amount,
      oldest_overdue: r.oldest_overdue,
      credit_score: r.credit_score,
      risk_level: r.risk_level,
      timeliness_score: timeScore,
      utilization_score: utilScore,
      cn_frequency_score: 50, // not available in snapshot
      aging_concentration_score: agingScore,
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

  // Filter by risk level
  if (riskLevel) {
    rows = rows.filter(r => r.risk_level === riskLevel);
  }

  // Filter by aging bucket (approximate: check overdue_amount > 0 for overdue buckets)
  if (agingBucket && agingBucket !== 'Not Yet Due') {
    rows = rows.filter(r => r.overdue_amount > 0);
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

// ─── Customer Invoices (RDS drill-down — row-level detail) ──────────────────

export async function getCustomerInvoices(debtorCode: string, refDate: string): Promise<CustomerInvoice[]> {
  return queryRds<CustomerInvoice>(`
    SELECT
      a."DocNo" AS doc_no,
      (a."DocDate" + INTERVAL '8 hours')::date::text AS doc_date,
      (a."DueDate" + INTERVAL '8 hours')::date::text AS due_date,
      ROUND(a."LocalNetTotal"::numeric, 2)::float AS local_net_total,
      ROUND(a."Outstanding"::numeric, 2)::float AS outstanding,
      ($2::date - a."DueDate"::date)::int AS days_overdue
    FROM dbo."ARInvoice" a
    WHERE a."DebtorCode" = $1 AND a."Cancelled" = 'F' AND a."Outstanding" > 0
    ORDER BY a."DueDate" ASC
  `, [debtorCode, refDate]);
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 Types & Functions (consolidated from queries-v2.ts)
// ═══════════════════════════════════════════════════════════════════════════

// ─── V2 Types ──────────────────────────────────────────────────────────────

export interface KpiV2Data {
  total_outstanding: number;
  overdue_customers: number;
  overdue_amount: number;
  overdue_pct: number;
  collection_days: number | null;
  collection_rate: number | null;
  credit_limit_breaches: number;
  avg_monthly_collection: number | null;
}

export interface CreditUtilizationRow {
  category: string;
  customer_count: number;
  total_outstanding: number;
}

export interface CollectionDaysTrendRow {
  month: string;
  collection_days: number | null;
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
      collection_days: null, collection_rate: null, credit_limit_breaches: 0, avg_monthly_collection: null };
  }

  // Snapshot: Total Outstanding
  const osRow = (await pool.query(`
    SELECT ROUND(SUM(total_outstanding)::numeric, 2)::float AS total_outstanding
    FROM pc_ar_customer_snapshot WHERE snapshot_date = $1 AND total_outstanding > 0
      AND company_name NOT ILIKE 'CASH SALES%'
  `, [latest.d])).rows[0] as { total_outstanding: number } | undefined;

  // Snapshot: Overdue Customers
  const overdueRow = (await pool.query(`
    SELECT
      COUNT(DISTINCT debtor_code)::int AS cnt,
      ROUND(COALESCE(SUM(overdue_amount), 0)::numeric, 2)::float AS overdue_amount
    FROM pc_ar_customer_snapshot
    WHERE snapshot_date = $1 AND overdue_amount > 0
      AND company_name NOT ILIKE 'CASH SALES%'
  `, [latest.d])).rows[0] as { cnt: number; overdue_amount: number };

  const totalOs = osRow?.total_outstanding ?? 0;
  const overduePct = totalOs > 0 ? Math.round((overdueRow.overdue_amount / totalOs) * 1000) / 10 : 0;

  // Period: Collection Days
  const cdTrend = await getCollectionDaysTrendV2(startDate, endDate);
  const validCdPoints = cdTrend.filter(d => d.collection_days != null);
  const collectionDays = validCdPoints.length > 0
    ? Math.round((validCdPoints.reduce((s, d) => s + (d.collection_days ?? 0), 0) / validCdPoints.length) * 10) / 10
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
      AND company_name NOT ILIKE 'CASH SALES%'
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
    collection_days: collectionDays,
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
      AND company_name NOT ILIKE 'CASH SALES%'
    GROUP BY category
  `, [latest.d]);

  return rows;
}

// ─── Collection Days Trend V2 (from pc_ar_monthly) ──────────────────────────

export async function getCollectionDaysTrendV2(startDate: string, endDate: string): Promise<CollectionDaysTrendRow[]> {
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
    const d = daysInMonth(r.month);
    const collection_days = r.credit_sales > 0
      ? Math.round((r.ar_outstanding / r.credit_sales) * d * 10) / 10
      : null;
    return {
      month: r.month,
      collection_days,
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
