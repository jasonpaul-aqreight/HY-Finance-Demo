import { getDb } from './db';

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

// ─── Constants ───────────────────────────────────────────────────────────────

const RETURN_FILTER = `(a.Cancelled = 'F' OR a.Cancelled IS NULL) AND a.CNType = 'RETURN'`;
const DATE_MYT = (col: string) => `DATE(${col}, '+8 hours')`;

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getReturnOverview(start: string, end: string): ReturnOverview {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) AS return_count,
      COALESCE(SUM(a.LocalNetTotal), 0) AS total_return_value,
      COALESCE(SUM(COALESCE(a.KnockOffAmt, 0)), 0) AS total_knocked_off,
      COALESCE(SUM(COALESCE(a.RefundAmt, 0)), 0) AS total_refunded,
      COALESCE(SUM(a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)), 0) AS total_unresolved,
      SUM(CASE WHEN COALESCE(a.KnockOffAmt, 0) + COALESCE(a.RefundAmt, 0) >= a.LocalNetTotal THEN 1 ELSE 0 END) AS reconciled_count,
      SUM(CASE WHEN COALESCE(a.KnockOffAmt, 0) + COALESCE(a.RefundAmt, 0) > 0
                AND COALESCE(a.KnockOffAmt, 0) + COALESCE(a.RefundAmt, 0) < a.LocalNetTotal THEN 1 ELSE 0 END) AS partial_count,
      SUM(CASE WHEN COALESCE(a.KnockOffAmt, 0) + COALESCE(a.RefundAmt, 0) = 0 THEN 1 ELSE 0 END) AS outstanding_count
    FROM arcn a
    WHERE ${RETURN_FILTER}
      AND ${DATE_MYT('a.DocDate')} BETWEEN ? AND ?
  `).get(start, end) as ReturnOverview;

  row.reconciliation_rate = row.return_count > 0
    ? (row.reconciled_count / row.return_count) * 100
    : 0;

  // Compute return rate as % of total sales in the same period
  const salesRow = db.prepare(`
    SELECT COALESCE(SUM(LocalNetTotal), 0) AS total_sales
    FROM ar_invoice
    WHERE (Cancelled = 'F' OR Cancelled IS NULL)
      AND ${DATE_MYT('DocDate')} BETWEEN ? AND ?
  `).get(start, end) as { total_sales: number };

  row.total_sales = salesRow.total_sales;
  row.return_rate_pct = salesRow.total_sales > 0
    ? (row.total_return_value / salesRow.total_sales) * 100
    : 0;

  return row;
}

export function getReturnAging(): AgingBucket[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      CASE
        WHEN julianday('now') - julianday(a.DocDate, '+8 hours') <= 30 THEN '0-30 days'
        WHEN julianday('now') - julianday(a.DocDate, '+8 hours') <= 60 THEN '31-60 days'
        WHEN julianday('now') - julianday(a.DocDate, '+8 hours') <= 90 THEN '61-90 days'
        WHEN julianday('now') - julianday(a.DocDate, '+8 hours') <= 180 THEN '91-180 days'
        ELSE '180+ days'
      END AS bucket,
      COUNT(*) AS count,
      COALESCE(SUM(a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)), 0) AS amount
    FROM arcn a
    WHERE ${RETURN_FILTER}
      AND (a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)) > 0.01
    GROUP BY bucket
    ORDER BY MIN(julianday('now') - julianday(a.DocDate, '+8 hours'))
  `).all() as AgingBucket[];
}

export function getReturnTrend(start: string, end: string): TrendRowV2[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', a.DocDate, '+8 hours') AS period,
      COALESCE(SUM(a.LocalNetTotal), 0) AS return_value,
      COALESCE(SUM(a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)), 0) AS unresolved,
      COUNT(*) AS count
    FROM arcn a
    WHERE ${RETURN_FILTER}
      AND ${DATE_MYT('a.DocDate')} BETWEEN ? AND ?
    GROUP BY period
    ORDER BY period
  `).all(start, end) as TrendRowV2[];
}

export function getAllCustomerReturns(start: string, end: string): TopDebtorRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.DebtorCode AS debtor_code,
      COALESCE(d.CompanyName, a.DebtorCode) AS company_name,
      COUNT(*) AS return_count,
      COALESCE(SUM(a.LocalNetTotal), 0) AS total_return_value,
      COALESCE(SUM(COALESCE(a.KnockOffAmt, 0)), 0) AS total_knocked_off,
      COALESCE(SUM(COALESCE(a.RefundAmt, 0)), 0) AS total_refunded,
      COALESCE(SUM(a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)), 0) AS unresolved,
      SUM(CASE WHEN COALESCE(a.KnockOffAmt, 0) + COALESCE(a.RefundAmt, 0) = 0 THEN 1 ELSE 0 END) AS outstanding_count
    FROM arcn a
    LEFT JOIN debtor d ON d.DebtorCode = a.DebtorCode
    WHERE ${RETURN_FILTER}
      AND ${DATE_MYT('a.DocDate')} BETWEEN ? AND ?
    GROUP BY a.DebtorCode, d.CompanyName
    ORDER BY total_return_value DESC
  `).all(start, end) as TopDebtorRow[];
}

export function getCustomerReturnDetails(debtorCode: string, start: string, end: string): CustomerReturnRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.DocKey AS doc_key,
      a.DocNo AS doc_no,
      DATE(a.DocDate, '+8 hours') AS doc_date,
      a.LocalNetTotal AS net_total,
      COALESCE(a.KnockOffAmt, 0) AS knocked_off,
      COALESCE(a.RefundAmt, 0) AS refunded,
      (a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)) AS unresolved,
      COALESCE(a.Reason, cn.Reason, '') AS reason,
      COALESCE(a.OurInvoiceNo, '') AS our_invoice_no
    FROM arcn a
    LEFT JOIN cn ON cn.DocKey = a.SourceKey AND a.SourceType = 'CN'
    WHERE ${RETURN_FILTER}
      AND a.DebtorCode = ?
      AND ${DATE_MYT('a.DocDate')} BETWEEN ? AND ?
    ORDER BY a.DocDate DESC
  `).all(debtorCode, start, end) as CustomerReturnRow[];
}

export type ReturnProductMetric = 'frequency' | 'value';

export function getReturnProducts(start: string, end: string, dimension: ReturnProductDimension = 'item', metric: ReturnProductMetric = 'frequency'): ReturnProductRow[] {
  const db = getDb();

  const dimensionConfig: Record<ReturnProductDimension, { select: string; groupBy: string }> = {
    item: {
      select: `dtl.Description AS name`,
      groupBy: `dtl.ItemCode, dtl.Description`,
    },
    fruit: {
      select: `COALESCE(i.FruitName, 'OTHERS') AS name`,
      groupBy: `COALESCE(i.FruitName, 'OTHERS')`,
    },
    variant: {
      select: `COALESCE(i.FruitName, 'OTHERS') || ' — ' || COALESCE(i.FruitVariant, 'OTHERS') AS name`,
      groupBy: `COALESCE(i.FruitName, 'OTHERS'), COALESCE(i.FruitVariant, 'OTHERS')`,
    },
    country: {
      select: `COALESCE(i.FruitCountry, '(Unknown)') AS name`,
      groupBy: `COALESCE(i.FruitCountry, '(Unknown)')`,
    },
  };

  const cfg = dimensionConfig[dimension];

  return db.prepare(`
    SELECT
      ${cfg.select},
      COUNT(DISTINCT dtl.DocKey) AS cn_count,
      COALESCE(SUM(dtl.Qty), 0) AS total_qty,
      COALESCE(SUM(dtl.LocalSubTotal), 0) AS total_value,
      COALESCE(SUM(CASE WHEN dtl.GoodsReturn = 'T' THEN dtl.Qty ELSE 0 END), 0) AS goods_returned_qty,
      COALESCE(SUM(CASE WHEN dtl.GoodsReturn = 'F' OR dtl.GoodsReturn IS NULL THEN dtl.Qty ELSE 0 END), 0) AS credit_only_qty
    FROM cndtl dtl
    JOIN cn ON cn.DocKey = dtl.DocKey
    LEFT JOIN sales.item i ON dtl.ItemCode = i.ItemCode
    WHERE (cn.Cancelled = 'F' OR cn.Cancelled IS NULL)
      AND cn.CNType = 'RETURN'
      AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
      AND dtl.ItemCode NOT LIKE 'ZZ-ZZ-ZBKT%'
      AND ${DATE_MYT('cn.DocDate')} BETWEEN ? AND ?
    GROUP BY ${cfg.groupBy}
    ORDER BY ${metric === 'value' ? 'total_value' : 'cn_count'} DESC
    LIMIT 10
  `).all(start, end) as ReturnProductRow[];
}

export function getRefundSummary(start: string, end: string): RefundSummary {
  const db = getDb();

  // Settlement breakdown from ARCN RETURN records
  const settlement = db.prepare(`
    SELECT
      COALESCE(SUM(a.LocalNetTotal), 0) AS total_return_value,
      COALESCE(SUM(COALESCE(a.KnockOffAmt, 0)), 0) AS total_knocked_off,
      COALESCE(SUM(COALESCE(a.RefundAmt, 0)), 0) AS total_refunded,
      COALESCE(SUM(a.LocalNetTotal - COALESCE(a.KnockOffAmt, 0) - COALESCE(a.RefundAmt, 0)), 0) AS total_unresolved
    FROM arcn a
    WHERE ${RETURN_FILTER}
      AND ${DATE_MYT('a.DocDate')} BETWEEN ? AND ?
  `).get(start, end) as { total_return_value: number; total_knocked_off: number; total_refunded: number; total_unresolved: number };

  // Refund count from ar_refund
  const refundCount = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM ar_refund
    WHERE (Cancelled = 'F' OR Cancelled IS NULL)
      AND ${DATE_MYT('DocDate')} BETWEEN ? AND ?
  `).get(start, end) as { cnt: number };

  const total = settlement.total_return_value || 1; // avoid div by zero
  return {
    total_refunded: settlement.total_refunded,
    refund_count: refundCount.cnt,
    total_knocked_off: settlement.total_knocked_off,
    total_return_value: settlement.total_return_value,
    total_unresolved: settlement.total_unresolved,
    knock_off_pct: (settlement.total_knocked_off / total) * 100,
    refund_pct: (settlement.total_refunded / total) * 100,
    unresolved_pct: (settlement.total_unresolved / total) * 100,
  };
}

export function getRefundLog(start: string, end: string, limit = 20): RefundLogRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      r.DocNo AS doc_no,
      DATE(r.DocDate, '+8 hours') AS doc_date,
      r.DebtorCode AS debtor_code,
      COALESCE(d.CompanyName, r.DebtorCode) AS company_name,
      r.LocalPaymentAmt AS payment_amt,
      rd.PaymentMethod AS payment_method,
      rd.PaymentBy AS payment_by
    FROM ar_refund r
    LEFT JOIN debtor d ON d.DebtorCode = r.DebtorCode
    LEFT JOIN ar_refund_dtl rd ON rd.DocKey = r.DocKey AND rd.Seq = 1
    WHERE (r.Cancelled = 'F' OR r.Cancelled IS NULL)
      AND ${DATE_MYT('r.DocDate')} BETWEEN ? AND ?
    ORDER BY r.DocDate DESC
    LIMIT ?
  `).all(start, end, limit) as RefundLogRow[];
}

export function getReturnDateBounds(): { min_date: string; max_date: string } {
  const db = getDb();
  return db.prepare(`
    SELECT
      MIN(DATE(DocDate, '+8 hours')) AS min_date,
      MAX(DATE(DocDate, '+8 hours')) AS max_date
    FROM arcn
    WHERE (Cancelled = 'F' OR Cancelled IS NULL) AND CNType = 'RETURN'
  `).get() as { min_date: string; max_date: string };
}
