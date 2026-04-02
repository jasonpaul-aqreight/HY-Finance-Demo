import { getPool, queryRds } from '../postgres';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReturnOverview {
  total_return_value: number;
  return_count: number;
  total_knocked_off: number;
  total_refunded: number;
  total_unresolved: number;
  reconciled_count: number;
  partial_count: number;
  outstanding_count: number;
  reconciliation_rate: number;
  total_sales: number;
  return_rate_pct: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface TrendRowV2 {
  period: string;
  return_value: number;
  unresolved: number;
  count: number;
}

export interface TopDebtorRow {
  debtor_code: string;
  company_name: string;
  return_count: number;
  total_return_value: number;
  total_knocked_off: number;
  total_refunded: number;
  unresolved: number;
  outstanding_count: number;
}

export interface CustomerReturnRow {
  doc_key: number;
  doc_no: string;
  doc_date: string;
  net_total: number;
  knocked_off: number;
  refunded: number;
  unresolved: number;
  reason: string;
  our_invoice_no: string;
}

export type ReturnProductDimension = 'item' | 'fruit' | 'variant' | 'country';

export interface ReturnProductRow {
  name: string;
  cn_count: number;
  total_qty: number;
  total_value: number;
  goods_returned_qty: number;
  credit_only_qty: number;
}

export interface RefundLogRow {
  doc_no: string;
  doc_date: string;
  debtor_code: string;
  company_name: string;
  payment_amt: number;
  payment_method: string | null;
  payment_by: string | null;
}

export interface RefundSummary {
  total_refunded: number;
  refund_count: number;
  total_knocked_off: number;
  total_return_value: number;
  total_unresolved: number;
  knock_off_pct: number;
  refund_pct: number;
  unresolved_pct: number;
}

export interface CustomerReturnSummary {
  return_count: number;
  unresolved: number;
}

export interface CustomerReturnTrendRow {
  month: string;
  count: number;
  value: number;
}

export type ReturnProductMetric = 'frequency' | 'value';

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getReturnOverview(start: string, end: string): Promise<ReturnOverview> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  // Aggregate from pc_return_monthly
  const { rows: [row] } = await pool.query(`
    SELECT
      COALESCE(SUM(cn_count), 0)::int AS return_count,
      COALESCE(SUM(cn_total), 0)::float AS total_return_value,
      COALESCE(SUM(knock_off_total), 0)::float AS total_knocked_off,
      COALESCE(SUM(refund_total), 0)::float AS total_refunded,
      COALESCE(SUM(unresolved_total), 0)::float AS total_unresolved,
      COALESCE(SUM(reconciled_count), 0)::int AS reconciled_count,
      COALESCE(SUM(partial_count), 0)::int AS partial_count,
      COALESCE(SUM(outstanding_count), 0)::int AS outstanding_count
    FROM pc_return_monthly
    WHERE month BETWEEN $1 AND $2
  `, [startMonth, endMonth]);

  const result = row as ReturnOverview;
  result.reconciliation_rate = result.return_count > 0
    ? (result.reconciled_count / result.return_count) * 100
    : 0;

  // Total sales from pc_sales_daily for return rate calculation
  const { rows: [salesRow] } = await pool.query(`
    SELECT COALESCE(SUM(net_revenue), 0)::float AS total_sales
    FROM pc_sales_daily
    WHERE doc_date BETWEEN $1 AND $2
  `, [start, end]);

  result.total_sales = salesRow.total_sales;
  result.return_rate_pct = result.total_sales > 0
    ? (result.total_return_value / result.total_sales) * 100
    : 0;

  return result;
}

export async function getReturnAging(): Promise<AgingBucket[]> {
  const pool = getPool();

  // Get latest snapshot date
  const { rows: [latest] } = await pool.query(
    `SELECT MAX(snapshot_date) AS d FROM pc_return_aging`
  );
  if (!latest?.d) return [];

  const { rows } = await pool.query(`
    SELECT
      bucket,
      count::int AS count,
      amount::float AS amount
    FROM pc_return_aging
    WHERE snapshot_date = $1
    ORDER BY
      CASE bucket
        WHEN '0-30 days' THEN 1
        WHEN '31-60 days' THEN 2
        WHEN '61-90 days' THEN 3
        WHEN '91-180 days' THEN 4
        WHEN '180+ days' THEN 5
      END
  `, [latest.d]);
  return rows;
}

export async function getReturnTrend(start: string, end: string): Promise<TrendRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      month AS period,
      cn_total::float AS return_value,
      unresolved_total::float AS unresolved,
      cn_count::int AS count
    FROM pc_return_monthly
    WHERE month BETWEEN $1 AND $2
    ORDER BY month
  `, [startMonth, endMonth]);
  return rows;
}

export async function getAllCustomerReturns(start: string, end: string): Promise<TopDebtorRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      debtor_code,
      COALESCE(MAX(company_name), debtor_code) AS company_name,
      COALESCE(SUM(cn_count), 0)::int AS return_count,
      COALESCE(SUM(cn_total), 0)::float AS total_return_value,
      COALESCE(SUM(knock_off_total), 0)::float AS total_knocked_off,
      COALESCE(SUM(refund_total), 0)::float AS total_refunded,
      COALESCE(SUM(unresolved), 0)::float AS unresolved,
      COALESCE(SUM(outstanding_count), 0)::int AS outstanding_count
    FROM pc_return_by_customer
    WHERE month BETWEEN $1 AND $2
    GROUP BY debtor_code
    ORDER BY total_return_value DESC
  `, [startMonth, endMonth]);
  return rows;
}

export async function getAllCustomerReturnsAll(): Promise<TopDebtorRow[]> {
  const pool = getPool();

  const { rows } = await pool.query(`
    SELECT
      debtor_code,
      COALESCE(MAX(company_name), debtor_code) AS company_name,
      COALESCE(SUM(cn_count), 0)::int AS return_count,
      COALESCE(SUM(cn_total), 0)::float AS total_return_value,
      COALESCE(SUM(knock_off_total), 0)::float AS total_knocked_off,
      COALESCE(SUM(refund_total), 0)::float AS total_refunded,
      COALESCE(SUM(unresolved), 0)::float AS unresolved,
      COALESCE(SUM(outstanding_count), 0)::int AS outstanding_count
    FROM pc_return_by_customer
    GROUP BY debtor_code
    ORDER BY total_return_value DESC
  `);
  return rows;
}

export async function getCustomerReturnDetailsAll(debtorCode: string): Promise<CustomerReturnRow[]> {
  return queryRds<CustomerReturnRow>(`
    SELECT
      cn."DocKey" AS doc_key,
      cn."DocNo" AS doc_no,
      (cn."DocDate" + INTERVAL '8 hours')::date::text AS doc_date,
      cn."LocalNetTotal" AS net_total,
      COALESCE(arcn."KnockOffAmt", 0)::float AS knocked_off,
      COALESCE(arcn."RefundAmt", 0)::float AS refunded,
      (cn."LocalNetTotal" - COALESCE(arcn."KnockOffAmt", 0) - COALESCE(arcn."RefundAmt", 0)) AS unresolved,
      COALESCE(cn."Reason", '') AS reason,
      COALESCE(cn."OurInvoiceNo", '') AS our_invoice_no
    FROM dbo."CN" cn
    LEFT JOIN dbo."ARCN" arcn
      ON arcn."SourceKey" = cn."DocKey" AND arcn."SourceType" = 'CN' AND arcn."Cancelled" = 'F'
    WHERE cn."Cancelled" = 'F'
      AND cn."CNType" = 'RETURN'
      AND cn."DebtorCode" = $1
    ORDER BY cn."DocDate" DESC
  `, [debtorCode]);
}

export async function getCustomerReturnDetails(debtorCode: string, start: string, end: string): Promise<CustomerReturnRow[]> {
  return queryRds<CustomerReturnRow>(`
    SELECT
      cn."DocKey" AS doc_key,
      cn."DocNo" AS doc_no,
      (cn."DocDate" + INTERVAL '8 hours')::date::text AS doc_date,
      cn."LocalNetTotal" AS net_total,
      COALESCE(arcn."KnockOffAmt", 0)::float AS knocked_off,
      COALESCE(arcn."RefundAmt", 0)::float AS refunded,
      (cn."LocalNetTotal" - COALESCE(arcn."KnockOffAmt", 0) - COALESCE(arcn."RefundAmt", 0)) AS unresolved,
      COALESCE(cn."Reason", '') AS reason,
      COALESCE(cn."OurInvoiceNo", '') AS our_invoice_no
    FROM dbo."CN" cn
    LEFT JOIN dbo."ARCN" arcn
      ON arcn."SourceKey" = cn."DocKey" AND arcn."SourceType" = 'CN' AND arcn."Cancelled" = 'F'
    WHERE cn."Cancelled" = 'F'
      AND cn."CNType" = 'RETURN'
      AND cn."DebtorCode" = $1
      AND (cn."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date
    ORDER BY cn."DocDate" DESC
  `, [debtorCode, start, end]);
}

export async function getReturnProducts(start: string, end: string, dimension: ReturnProductDimension = 'item', metric: ReturnProductMetric = 'frequency'): Promise<ReturnProductRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const dimensionConfig: Record<ReturnProductDimension, { select: string; groupBy: string; filter: string }> = {
    item: {
      select: `COALESCE(item_description, item_code) AS name`,
      groupBy: `item_code, item_description`,
      filter: '',
    },
    fruit: {
      select: `COALESCE(fruit_name, 'OTHERS') AS name`,
      groupBy: `COALESCE(fruit_name, 'OTHERS')`,
      filter: `AND item_code NOT LIKE 'ZZ-%' AND item_code NOT LIKE 'XX-%' AND item_code NOT LIKE 'RE-%'`,
    },
    variant: {
      select: `COALESCE(fruit_name, 'OTHERS') || ' — ' || COALESCE(fruit_variant, 'OTHERS') AS name`,
      groupBy: `COALESCE(fruit_name, 'OTHERS'), COALESCE(fruit_variant, 'OTHERS')`,
      filter: `AND item_code NOT LIKE 'ZZ-%' AND item_code NOT LIKE 'XX-%' AND item_code NOT LIKE 'RE-%'`,
    },
    country: {
      select: `COALESCE(fruit_country, '(Unknown)') AS name`,
      groupBy: `COALESCE(fruit_country, '(Unknown)')`,
      filter: `AND item_code NOT LIKE 'ZZ-%' AND item_code NOT LIKE 'XX-%' AND item_code NOT LIKE 'RE-%'`,
    },
  };

  const cfg = dimensionConfig[dimension];
  const orderBy = metric === 'value' ? 'total_value' : 'cn_count';

  const { rows } = await pool.query(`
    SELECT
      ${cfg.select},
      COALESCE(SUM(cn_count), 0)::int AS cn_count,
      COALESCE(SUM(total_qty), 0)::float AS total_qty,
      COALESCE(SUM(total_amount), 0)::float AS total_value,
      COALESCE(SUM(goods_returned_qty), 0)::float AS goods_returned_qty,
      COALESCE(SUM(credit_only_qty), 0)::float AS credit_only_qty
    FROM pc_return_products
    WHERE month BETWEEN $1 AND $2
      AND item_code IS NOT NULL AND item_code != ''
      AND item_code NOT LIKE 'ZZ-ZZ-ZBKT%'
      ${cfg.filter}
    GROUP BY ${cfg.groupBy}
    ORDER BY ${orderBy} DESC
    LIMIT 10
  `, [startMonth, endMonth]);
  return rows;
}

export async function getRefundSummary(start: string, end: string): Promise<RefundSummary> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows: [row] } = await pool.query(`
    SELECT
      COALESCE(SUM(cn_total), 0)::float AS total_return_value,
      COALESCE(SUM(knock_off_total), 0)::float AS total_knocked_off,
      COALESCE(SUM(refund_total), 0)::float AS total_refunded,
      COALESCE(SUM(unresolved_total), 0)::float AS total_unresolved
    FROM pc_return_monthly
    WHERE month BETWEEN $1 AND $2
  `, [startMonth, endMonth]);

  // Actual refund transaction count from RDS
  const [refundCountRow] = await queryRds<{ cnt: number }>(`
    SELECT COUNT(*)::int AS cnt
    FROM dbo."ARRefund"
    WHERE ("Cancelled" = 'F' OR "Cancelled" IS NULL)
      AND ("DocDate" + INTERVAL '8 hours')::date BETWEEN $1::date AND $2::date
  `, [start, end]);

  const total = row.total_return_value || 1; // avoid div by zero
  return {
    total_refunded: row.total_refunded,
    refund_count: refundCountRow.cnt,
    total_knocked_off: row.total_knocked_off,
    total_return_value: row.total_return_value,
    total_unresolved: row.total_unresolved,
    knock_off_pct: (row.total_knocked_off / total) * 100,
    refund_pct: (row.total_refunded / total) * 100,
    unresolved_pct: (row.total_unresolved / total) * 100,
  };
}

export async function getRefundLog(start: string, end: string, limit = 20): Promise<RefundLogRow[]> {
  return queryRds<RefundLogRow>(`
    SELECT
      r."DocNo" AS doc_no,
      (r."DocDate" + INTERVAL '8 hours')::date::text AS doc_date,
      r."DebtorCode" AS debtor_code,
      COALESCE(d."CompanyName", r."DebtorCode") AS company_name,
      r."LocalPaymentAmt" AS payment_amt,
      rd."PaymentMethod" AS payment_method,
      rd."PaymentBy" AS payment_by
    FROM dbo."ARRefund" r
    LEFT JOIN dbo."Debtor" d ON d."AccNo" = r."DebtorCode"
    LEFT JOIN dbo."ARRefundDetail" rd ON rd."DocKey" = r."DocKey" AND rd."Seq" = 1
    WHERE (r."Cancelled" = 'F' OR r."Cancelled" IS NULL)
      AND (r."DocDate" + INTERVAL '8 hours')::date BETWEEN $1::date AND $2::date
    ORDER BY r."DocDate" DESC
    LIMIT $3
  `, [start, end, limit]);
}

// ─── Customer Return Summary (for profile metrics) ──────────────────────

export async function getCustomerReturnSummary(debtorCode: string): Promise<CustomerReturnSummary> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(cn_count), 0)::int AS return_count,
      COALESCE(SUM(unresolved), 0)::float AS unresolved
    FROM pc_return_by_customer
    WHERE debtor_code = $1
  `, [debtorCode]);

  const row = rows[0];
  return {
    return_count: row?.return_count ?? 0,
    unresolved: Math.max(0, row?.unresolved ?? 0),
  };
}

// ─── Customer Return Trend (date-range scoped) ─────────────────────────

export async function getCustomerReturnTrend(debtorCode: string, startDate: string, endDate: string): Promise<CustomerReturnTrendRow[]> {
  const pool = getPool();
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  // Generate month series and LEFT JOIN to fill gaps with zeros
  const { rows } = await pool.query(`
    WITH months AS (
      SELECT TO_CHAR(d, 'YYYY-MM') AS month
      FROM generate_series($2::date, $3::date, '1 month'::interval) AS d
    ),
    returns AS (
      SELECT
        month,
        COALESCE(SUM(cn_count), 0)::int AS count,
        COALESCE(SUM(cn_total), 0)::float AS value
      FROM pc_return_by_customer
      WHERE debtor_code = $1
        AND month BETWEEN $4 AND $5
      GROUP BY month
    )
    SELECT m.month, COALESCE(r.count, 0)::int AS count, COALESCE(r.value, 0)::float AS value
    FROM months m
    LEFT JOIN returns r ON r.month = m.month
    ORDER BY m.month
  `, [debtorCode, startDate, endDate, startMonth, endMonth]);
  return rows;
}

export async function getReturnDateBounds(): Promise<{ min_date: string; max_date: string }> {
  const [row] = await queryRds<{ min_date: string; max_date: string }>(`
    SELECT
      MIN(("DocDate" + INTERVAL '8 hours')::date)::text AS min_date,
      MAX(("DocDate" + INTERVAL '8 hours')::date)::text AS max_date
    FROM dbo."CN"
    WHERE ("Cancelled" = 'F' OR "Cancelled" IS NULL) AND "CNType" = 'RETURN'
  `, []);
  return row;
}
