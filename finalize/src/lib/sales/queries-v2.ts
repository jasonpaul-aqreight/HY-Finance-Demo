import { getDb } from './db';
import type { GroupByDimension, GroupByRow } from './types';

export type { GroupByDimension, GroupByRow } from './types';

// ─── Group-by: Customer ─────────────────────────────────────────────────────

function getByCustomer(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      s.DebtorCode AS code,
      MAX(s.DebtorName) AS name,
      COALESCE(MAX(d.DebtorType), '(Uncategorized)') AS customer_type,
      COALESCE(SUM(CASE WHEN s.src='IV' THEN s.NetTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN s.src='CS' THEN s.NetTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN s.src='CN' THEN s.NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN s.src IN ('IV','CS') THEN s.NetTotal
        WHEN s.src='CN' THEN -s.NetTotal
        ELSE 0
      END), 0) AS total_sales,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, DebtorCode, DebtorName, NetTotal, DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT 'CS', DebtorCode, DebtorName, NetTotal, DocDate FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT 'CN', DebtorCode, DebtorName, NetTotal, DocDate FROM cn WHERE Cancelled='F'
    ) s
    LEFT JOIN debtor d ON s.DebtorCode = d.DebtorCode
    WHERE DATE(s.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY s.DebtorCode
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Group-by: Customer Type ────────────────────────────────────────────────

function getByCustomerType(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(d.DebtorType, '(Uncategorized)') AS name,
      COALESCE(MAX(dt.Description), d.DebtorType, '(Uncategorized)') AS description,
      COUNT(DISTINCT s.DebtorCode) AS customer_count,
      COALESCE(SUM(CASE WHEN s.src='IV' THEN s.NetTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN s.src='CS' THEN s.NetTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN s.src='CN' THEN s.NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN s.src IN ('IV','CS') THEN s.NetTotal
        WHEN s.src='CN' THEN -s.NetTotal
        ELSE 0
      END), 0) AS total_sales,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, DebtorCode, NetTotal, DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT 'CS', DebtorCode, NetTotal, DocDate FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT 'CN', DebtorCode, NetTotal, DocDate FROM cn WHERE Cancelled='F'
    ) s
    LEFT JOIN debtor d ON s.DebtorCode = d.DebtorCode
    LEFT JOIN debtor_type dt ON d.DebtorType = dt.DebtorType
    WHERE DATE(s.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(d.DebtorType, '(Uncategorized)')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Group-by: Sales Agent ──────────────────────────────────────────────────

function getByAgent(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(s.SalesAgent, '(Unassigned)') AS name,
      MAX(a.Description) AS description,
      MAX(a.IsActive) AS is_active,
      COALESCE(SUM(CASE WHEN s.src='IV' THEN s.NetTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN s.src='CS' THEN s.NetTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN s.src='CN' THEN s.NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN s.src IN ('IV','CS') THEN s.NetTotal
        WHEN s.src='CN' THEN -s.NetTotal
        ELSE 0
      END), 0) AS total_sales,
      COUNT(*) AS doc_count,
      COUNT(DISTINCT s.DebtorCode) AS unique_customers
    FROM (
      SELECT 'IV' AS src, SalesAgent, DebtorCode, NetTotal, DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT 'CS', SalesAgent, DebtorCode, NetTotal, DocDate FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT 'CN', SalesAgent, DebtorCode, NetTotal, DocDate FROM cn WHERE Cancelled='F'
    ) s
    LEFT JOIN sales_agent a ON s.SalesAgent = a.SalesAgent
    WHERE DATE(s.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(s.SalesAgent, '(Unassigned)')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Group-by: Outlet ───────────────────────────────────────────────────────

function getByOutlet(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(SalesLocation, '(Unassigned)') AS name,
      COALESCE(SUM(CASE WHEN src='IV' THEN NetTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN src='CS' THEN NetTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN src='CN' THEN NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN NetTotal
        WHEN src='CN' THEN -NetTotal
        ELSE 0
      END), 0) AS total_sales,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, SalesLocation, NetTotal, DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT 'CS', SalesLocation, NetTotal, DocDate FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT 'CN', SalesLocation, NetTotal, DocDate FROM cn WHERE Cancelled='F'
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(SalesLocation, '(Unassigned)')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Group-by: Fruit (granular: Name + Country + Variant) ─────────────────

function getByFruit(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(FruitName, 'OTHERS') AS name,
      COALESCE(FruitCountry, '(Unknown)') AS fruit_country,
      COALESCE(FruitVariant, '(Unknown)') AS fruit_variant,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN SubTotal
        WHEN src='CN' THEN -SubTotal
        ELSE 0
      END), 0) AS total_sales,
      SUM(CASE WHEN src IN ('IV','CS') THEN ABS(Qty) ELSE 0 END) AS qty_sold,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, DocDate, SubTotal, Qty, FruitName, FruitCountry, FruitVariant FROM sales_invoice
      UNION ALL
      SELECT 'CS', DocDate, SubTotal, Qty, FruitName, FruitCountry, FruitVariant FROM sales_cash
      UNION ALL
      SELECT 'CN', DocDate, SubTotal, Qty, FruitName, FruitCountry, FruitVariant FROM sales_credit_note
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(FruitName, 'OTHERS'), COALESCE(FruitCountry, '(Unknown)'), COALESCE(FruitVariant, '(Unknown)')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Unified entry point ────────────────────────────────────────────────────

export function getGroupByData(
  group: GroupByDimension,
  start: string,
  end: string,
): GroupByRow[] {
  switch (group) {
    case 'customer':       return getByCustomer(start, end);
    case 'customer-type':  return getByCustomerType(start, end);
    case 'agent':          return getByAgent(start, end);
    case 'outlet':         return getByOutlet(start, end);
    case 'fruit':          return getByFruit(start, end);
  }
}

// ─── Customer Sales Summary (for profile) ───────────────────────────────────

export interface CustomerSalesSummary {
  total_sales: number;
  invoice_sales: number;
  cash_sales: number;
  credit_notes: number;
  doc_count: number;
}

export function getCustomerSalesSummary(debtorCode: string, start: string, end: string): CustomerSalesSummary {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN src='IV' THEN NetTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN src='CS' THEN NetTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN src='CN' THEN NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN NetTotal
        WHEN src='CN' THEN -NetTotal
        ELSE 0
      END), 0) AS total_sales,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, NetTotal, DocDate FROM iv WHERE Cancelled='F' AND DebtorCode = ?
      UNION ALL
      SELECT 'CS', NetTotal, DocDate FROM cs WHERE Cancelled='F' AND DebtorCode = ?
      UNION ALL
      SELECT 'CN', NetTotal, DocDate FROM cn WHERE Cancelled='F' AND DebtorCode = ?
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(debtorCode, debtorCode, debtorCode, start, end) as CustomerSalesSummary;
  return row;
}

export interface CustomerSalesTrendRow {
  month: string;
  total_sales: number;
  invoice_sales: number;
  cash_sales: number;
  credit_notes: number;
}

export function getCustomerSalesTrend(debtorCode: string, start: string, end: string): CustomerSalesTrendRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', DocDate, '+8 hours') AS month,
      COALESCE(SUM(CASE WHEN src='IV' THEN NetTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN src='CS' THEN NetTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN src='CN' THEN NetTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN NetTotal
        WHEN src='CN' THEN -NetTotal
        ELSE 0
      END), 0) AS total_sales
    FROM (
      SELECT 'IV' AS src, NetTotal, DocDate FROM iv WHERE Cancelled='F' AND DebtorCode = ?
      UNION ALL
      SELECT 'CS', NetTotal, DocDate FROM cs WHERE Cancelled='F' AND DebtorCode = ?
      UNION ALL
      SELECT 'CN', NetTotal, DocDate FROM cn WHERE Cancelled='F' AND DebtorCode = ?
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY month
    ORDER BY month
  `).all(debtorCode, debtorCode, debtorCode, start, end) as CustomerSalesTrendRow[];
}
