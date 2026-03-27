import { getDb } from './db';
import { getPreviousPeriod } from './date-utils';
import { getItemPriceMonthlyV2, getItemSellPriceV2 } from './queries-v2';
import type { ItemSellPriceV2 } from './queries-v2';

// ─── Note ────────────────────────────────────────────────────────────────────
// Margin calculations use PIDTL.LocalSubTotal (actual purchase cost per supplier)
// instead of IVDTL.LocalTotalCost (AutoCount's blended/weighted-average COGS).

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarginSummary {
  revenue: number;
  cogs: number;
  profit: number;
  margin_pct: number | null;
  top_supplier: { name: string; margin_pct: number } | null;
  lowest_supplier: { name: string; margin_pct: number } | null;
}

export interface TrendRow {
  period: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin_pct: number | null;
}

export interface SupplierTrendRow {
  period: string;
  creditor_code: string;
  company_name: string;
  margin_pct: number | null;
  revenue: number;
  profit: number;
}

export interface ItemGroupRow {
  item_group: string;
  period: string;
  revenue: number;
  cogs: number;
  margin_pct: number | null;
}

export interface SupplierRow {
  creditor_code: string;
  company_name: string;
  supplier_type: string | null;
  attributed_revenue: number;
  attributed_cogs: number;
  attributed_profit: number;
  margin_pct: number | null;
  avg_purchase_price: number | null;
  avg_selling_price: number | null;
  price_spread: number | null;
  items_supplied: number;
}

export interface SupplierItemRow {
  item_code: string;
  description: string;
  item_group: string | null;
  qty_purchased: number;
  avg_purchase_price: number | null;
  qty_sold: number;
  revenue: number;
  cogs: number;
  margin_pct: number | null;
}

export interface PriceComparisonRow {
  item_code: string;
  item_name: string;
  item_group: string | null;
  supplier_name: string;
  avg_purchase_price: number;
  avg_selling_price: number;
  price_spread: number;
  margin_pct: number | null;
  revenue: number;
}

export interface PriceSpreadRow {
  item_code: string;
  item_name: string;
  avg_purchase_price: number;
  avg_selling_price: number;
  margin_pct: number | null;
  revenue: number;
  supplier_names: string;
  supplier_codes: string;
}

// ─── Granularity ─────────────────────────────────────────────────────────────

export type Granularity = 'monthly' | 'quarterly' | 'yearly';

function periodExpr(granularity: Granularity, alias: string): string {
  switch (granularity) {
    case 'monthly':   return `strftime('%Y-%m', ${alias}.DocDate, '+8 hours')`;
    case 'quarterly': return `strftime('%Y', ${alias}.DocDate, '+8 hours') || '-Q' || ((CAST(strftime('%m', ${alias}.DocDate, '+8 hours') AS INTEGER) + 2) / 3)`;
    case 'yearly':    return `strftime('%Y', ${alias}.DocDate, '+8 hours')`;
  }
}

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export function getDateBounds() {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      MIN(DATE(DocDate, '+8 hours')) AS min_date,
      MAX(DATE(DocDate, '+8 hours')) AS max_date
    FROM (
      SELECT DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT DocDate FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT DocDate FROM pi WHERE Cancelled='F'
    )
  `).get() as { min_date: string; max_date: string };
  return row;
}

// ─── Dimensions ──────────────────────────────────────────────────────────────

export function getSuppliers(): Array<{ AccNo: string; CompanyName: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT c.AccNo, c.CompanyName
    FROM creditor c
    JOIN pi ON c.AccNo = pi.CreditorCode
    WHERE pi.Cancelled = 'F' AND c.IsActive = 'T'
    ORDER BY c.CompanyName
  `).all() as Array<{ AccNo: string; CompanyName: string }>;
}

export function getItemGroups(): Array<{ ItemGroup: string; Description: string }> {
  const db = getDb();
  return db.prepare(`SELECT ItemGroup, Description FROM item_group ORDER BY ItemGroup`).all() as Array<{ ItemGroup: string; Description: string }>;
}

// ─── Margin Summary (KPIs) ──────────────────────────────────────────────────

function fetchMarginPeriod(start: string, end: string) {
  const db = getDb();
  // Cost of goods sold: avg purchase price per item × sold qty
  // This answers "for what we sold, what did it cost based on purchase prices?"
  // Avoids inflated cost from unsold inventory (purchase qty > sold qty).
  const row = db.prepare(`
    WITH item_purchase AS (
      SELECT
        pd.ItemCode,
        SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0) AS avg_purchase_price
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND pd.Qty > 0
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pd.ItemCode
    ),
    item_sales AS (
      SELECT ItemCode, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    )
    SELECT
      COALESCE(SUM(s.revenue), 0) AS revenue,
      COALESCE(SUM(s.sold_qty * p.avg_purchase_price), 0) AS cogs
    FROM item_sales s
    JOIN item_purchase p ON s.ItemCode = p.ItemCode
  `).get(start, end, start, end, start, end) as { revenue: number; cogs: number };
  return row;
}

// Minimum revenue threshold for top/lowest supplier KPI: RM 50,000
const SUPPLIER_KPI_MIN_REVENUE = 50000;

function fetchTopLowestSupplier(start: string, end: string) {
  const db = getDb();
  // Supplier margin: cost adjusted by sold/purchased ratio to exclude unsold inventory
  const rows = db.prepare(`
    WITH supplier_items AS (
      SELECT
        pi.CreditorCode,
        pd.ItemCode,
        SUM(pd.Qty) AS purchased_qty,
        SUM(pd.LocalSubTotal) AS purchase_total
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pi.CreditorCode, pd.ItemCode
    ),
    item_sales AS (
      SELECT ItemCode, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total_purchased AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items
      GROUP BY ItemCode
    )
    SELECT
      c.CompanyName AS name,
      ROUND(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 2) AS rev,
      ROUND(
        (SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
         - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)))
        / NULLIF(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) * 100, 2
      ) AS margin_pct
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    JOIN item_total_purchased itp ON si.ItemCode = itp.ItemCode
    JOIN creditor c ON si.CreditorCode = c.AccNo
    WHERE c.IsActive = 'T'
    GROUP BY si.CreditorCode
    HAVING rev >= ?
    ORDER BY margin_pct DESC
  `).all(start, end, start, end, start, end, SUPPLIER_KPI_MIN_REVENUE) as Array<{ name: string; rev: number; margin_pct: number }>;

  if (rows.length === 0) return { top: null, lowest: null };

  return {
    top: { name: rows[0].name, margin_pct: rows[0].margin_pct },
    lowest: { name: rows[rows.length - 1].name, margin_pct: rows[rows.length - 1].margin_pct },
  };
}

export function getMarginSummary(start: string, end: string) {
  const db = getDb();
  const current = fetchMarginPeriod(start, end);
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);
  const previous = fetchMarginPeriod(prevStart, prevEnd);

  const curProfit = current.revenue - current.cogs;
  const prevProfit = previous.revenue - previous.cogs;
  const curMargin = current.revenue > 0 ? (curProfit / current.revenue) * 100 : null;
  const prevMargin = previous.revenue > 0 ? (prevProfit / previous.revenue) * 100 : null;

  const pct = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;

  const { top, lowest } = fetchTopLowestSupplier(start, end);

  // Active supplier count
  const supplierCount = db.prepare(`
    SELECT COUNT(DISTINCT pi.CreditorCode) AS cnt
    FROM pi
    WHERE pi.Cancelled = 'F'
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as { cnt: number };

  // Distinct items supplied count
  const itemsRow = db.prepare(`
    SELECT COUNT(DISTINCT pd.ItemCode) AS cnt
    FROM pidtl pd
    JOIN pi ON pd.DocKey = pi.DocKey
    WHERE pi.Cancelled = 'F'
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as { cnt: number };

  return {
    period: { start, end, prevStart, prevEnd },
    current: {
      revenue: current.revenue,
      cogs: current.cogs,
      profit: curProfit,
      margin_pct: curMargin,
      active_suppliers: supplierCount.cnt,
      items_count: itemsRow.cnt,
    },
    previous: {
      revenue: previous.revenue,
      cogs: previous.cogs,
      profit: prevProfit,
      margin_pct: prevMargin,
    },
    growth: {
      revenue_pct: pct(current.revenue, previous.revenue),
      cogs_pct: pct(current.cogs, previous.cogs),
      profit_pct: pct(curProfit, prevProfit),
      margin_delta: curMargin != null && prevMargin != null ? curMargin - prevMargin : null,
    },
    top_supplier: top,
    lowest_supplier: lowest,
  };
}

// ─── Margin Trend (B1) ──────────────────────────────────────────────────────

export function getMarginTrend(
  start: string,
  end: string,
  granularity: Granularity
): TrendRow[] {
  const db = getDb();
  const salesPeriod = periodExpr(granularity, 'iv');

  // Cost of goods sold per period: avg purchase price × sold qty
  // Uses the full date range avg purchase price so each period reflects
  // consistent unit costs. Avoids inventory timing distortions.
  return db.prepare(`
    WITH item_purchase AS (
      SELECT
        pd.ItemCode,
        SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0) AS avg_purchase_price
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND pd.Qty > 0
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pd.ItemCode
    ),
    item_sales_by_period AS (
      SELECT ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          ${salesPeriod} AS period,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode, period
        UNION ALL
        SELECT
          csd.ItemCode,
          ${periodExpr(granularity, 'cs')} AS period,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode, period
      ) GROUP BY ItemCode, period
    )
    SELECT
      s.period,
      ROUND(SUM(s.revenue), 2) AS revenue,
      ROUND(SUM(s.sold_qty * p.avg_purchase_price), 2) AS cogs,
      ROUND(SUM(s.revenue) - SUM(s.sold_qty * p.avg_purchase_price), 2) AS profit,
      ROUND(
        (SUM(s.revenue) - SUM(s.sold_qty * p.avg_purchase_price))
        / NULLIF(SUM(s.revenue), 0) * 100, 2
      ) AS margin_pct
    FROM item_sales_by_period s
    JOIN item_purchase p ON s.ItemCode = p.ItemCode
    GROUP BY s.period
    ORDER BY s.period ASC
  `).all(start, end, start, end, start, end) as TrendRow[];
}

// ─── Top 10 Supplier Trend (B2) ─────────────────────────────────────────────

export function getSupplierTrend(
  start: string,
  end: string,
  granularity: Granularity
): SupplierTrendRow[] {
  const db = getDb();
  const pExpr = periodExpr(granularity, 'iv');

  // First find top 10 suppliers by attributed revenue
  const topSuppliers = db.prepare(`
    WITH supplier_items AS (
      SELECT pi.CreditorCode, pd.ItemCode, SUM(pd.Qty) AS purchased_qty
      FROM pi JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F' AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pi.CreditorCode, pd.ItemCode
    ),
    item_sales AS (
      SELECT ItemCode, SUM(revenue) AS revenue FROM (
        SELECT ivd.ItemCode, SUM(ivd.LocalSubTotalExTax) AS revenue
        FROM iv JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F' AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT csd.ItemCode, SUM(csd.LocalSubTotalExTax) AS revenue
        FROM cs JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F' AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty FROM supplier_items GROUP BY ItemCode
    )
    SELECT si.CreditorCode
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    JOIN item_total itp ON si.ItemCode = itp.ItemCode
    GROUP BY si.CreditorCode
    ORDER BY SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)) DESC
    LIMIT 10
  `).all(start, end, start, end, start, end) as Array<{ CreditorCode: string }>;

  if (topSuppliers.length === 0) return [];

  const codes = topSuppliers.map(s => s.CreditorCode);
  const placeholders = codes.map(() => '?').join(',');

  // Get margin trend per supplier per period — cost from PIDTL
  return db.prepare(`
    WITH supplier_items AS (
      SELECT pi.CreditorCode, pd.ItemCode,
             SUM(pd.Qty) AS purchased_qty,
             SUM(pd.LocalSubTotal) AS purchase_total,
             ${periodExpr(granularity, 'pi')} AS period
      FROM pi JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F' AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND pi.CreditorCode IN (${placeholders})
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pi.CreditorCode, pd.ItemCode, period
    ),
    item_sales AS (
      SELECT ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT ivd.ItemCode,
               ${pExpr} AS period,
               SUM(ivd.LocalSubTotalExTax) AS revenue,
               SUM(ivd.Qty) AS sold_qty
        FROM iv JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F' AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode, period
        UNION ALL
        SELECT csd.ItemCode,
               ${periodExpr(granularity, 'cs')} AS period,
               SUM(csd.LocalSubTotalExTax) AS revenue,
               SUM(csd.Qty) AS sold_qty
        FROM cs JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F' AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode, period
      ) GROUP BY ItemCode, period
    ),
    item_total AS (
      SELECT ItemCode, period, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode, period
    )
    SELECT
      si.period,
      si.CreditorCode AS creditor_code,
      c.CompanyName AS company_name,
      ROUND(
        (SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
         - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)))
        / NULLIF(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) * 100, 2
      ) AS margin_pct,
      ROUND(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 2) AS revenue,
      ROUND(
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
        - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)), 2
      ) AS profit
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode AND si.period = ist.period
    JOIN item_total itp ON si.ItemCode = itp.ItemCode AND si.period = itp.period
    JOIN creditor c ON si.CreditorCode = c.AccNo
    WHERE c.IsActive = 'T'
    GROUP BY si.period, si.CreditorCode
    ORDER BY si.period ASC
  `).all(...codes, start, end, start, end, start, end) as SupplierTrendRow[];
}

// ─── Margin by Item Group (B3) ──────────────────────────────────────────────

export function getMarginByItemGroup(
  start: string,
  end: string,
  granularity: Granularity
): ItemGroupRow[] {
  const db = getDb();
  const salesPeriod = periodExpr(granularity, 'iv');

  // Cost of goods sold by item group: avg purchase price × sold qty
  return db.prepare(`
    WITH item_purchase AS (
      SELECT
        pd.ItemCode,
        SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0) AS avg_purchase_price
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND pd.Qty > 0
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pd.ItemCode
    ),
    item_sales_by_group AS (
      SELECT item_group, ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          COALESCE(i.ItemGroup, 'UNGROUPED') AS item_group,
          ivd.ItemCode,
          ${salesPeriod} AS period,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY i.ItemGroup, ivd.ItemCode, period
        UNION ALL
        SELECT
          COALESCE(i.ItemGroup, 'UNGROUPED') AS item_group,
          csd.ItemCode,
          ${periodExpr(granularity, 'cs')} AS period,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY i.ItemGroup, csd.ItemCode, period
      ) GROUP BY item_group, ItemCode, period
    )
    SELECT
      s.item_group,
      s.period,
      ROUND(SUM(s.revenue), 2) AS revenue,
      ROUND(SUM(s.sold_qty * p.avg_purchase_price), 2) AS cogs,
      ROUND(
        (SUM(s.revenue) - SUM(s.sold_qty * p.avg_purchase_price))
        / NULLIF(SUM(s.revenue), 0) * 100, 2
      ) AS margin_pct
    FROM item_sales_by_group s
    JOIN item_purchase p ON s.ItemCode = p.ItemCode
    GROUP BY s.item_group, s.period
    ORDER BY s.period ASC, revenue DESC
  `).all(start, end, start, end, start, end) as ItemGroupRow[];
}

// ─── Supplier Table (C) ─────────────────────────────────────────────────────

export function getSupplierTable(
  start: string,
  end: string,
  supplierCodes?: string[],
  itemGroups?: string[]
): SupplierRow[] {
  const db = getDb();

  const supplierFilter = supplierCodes && supplierCodes.length > 0
    ? `AND pi.CreditorCode IN (${supplierCodes.map(() => '?').join(',')})`
    : '';
  const itemGroupFilter = itemGroups && itemGroups.length > 0
    ? `AND i.ItemGroup IN (${itemGroups.map(() => '?').join(',')})`
    : '';
  const itemGroupFilterSales = itemGroups && itemGroups.length > 0
    ? `AND i2.ItemGroup IN (${itemGroups.map(() => '?').join(',')})`
    : '';

  const params: (string | number)[] = [];

  // supplier_items CTE params
  if (supplierCodes?.length) params.push(...supplierCodes);
  if (itemGroups?.length) params.push(...itemGroups);
  params.push(start, end);

  // item_sales CTE params (iv)
  if (itemGroups?.length) params.push(...itemGroups);
  params.push(start, end);
  // item_sales CTE params (cs)
  if (itemGroups?.length) params.push(...itemGroups);
  params.push(start, end);

  return db.prepare(`
    WITH supplier_items AS (
      SELECT
        pi.CreditorCode,
        pd.ItemCode,
        SUM(pd.Qty) AS purchased_qty,
        SUM(pd.LocalSubTotal) AS purchase_total
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      JOIN item i ON pd.ItemCode = i.ItemCode
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        ${supplierFilter}
        ${itemGroupFilter}
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pi.CreditorCode, pd.ItemCode
    ),
    item_sales AS (
      SELECT ItemCode, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        JOIN item i2 ON ivd.ItemCode = i2.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${itemGroupFilterSales}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i2 ON csd.ItemCode = i2.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${itemGroupFilterSales}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total_purchased AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items
      GROUP BY ItemCode
    )
    SELECT
      si.CreditorCode AS creditor_code,
      c.CompanyName AS company_name,
      ct.Description AS supplier_type,
      ROUND(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 2) AS attributed_revenue,
      ROUND(SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)), 2) AS attributed_cogs,
      ROUND(
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
        - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)), 2
      ) AS attributed_profit,
      ROUND(
        (SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
         - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)))
        / NULLIF(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) * 100, 2
      ) AS margin_pct,
      ROUND(SUM(si.purchase_total) / NULLIF(SUM(si.purchased_qty), 0), 2) AS avg_purchase_price,
      ROUND(
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
        / NULLIF(SUM(ist.sold_qty * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0), 2
      ) AS avg_selling_price,
      ROUND(
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
        / NULLIF(SUM(ist.sold_qty * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0)
        - SUM(si.purchase_total) / NULLIF(SUM(si.purchased_qty), 0), 2
      ) AS price_spread,
      COUNT(DISTINCT si.ItemCode) AS items_supplied
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    JOIN item_total_purchased itp ON si.ItemCode = itp.ItemCode
    JOIN creditor c ON si.CreditorCode = c.AccNo
    LEFT JOIN creditor_type ct ON c.CreditorType = ct.CreditorType
    WHERE c.IsActive = 'T'
    GROUP BY si.CreditorCode, c.CompanyName, ct.Description
    ORDER BY attributed_revenue DESC
  `).all(...params) as SupplierRow[];
}

// ─── Supplier Sparklines (monthly margin per supplier) ──────────────────────

export interface SparklineRow {
  creditor_code: string;
  period: string;
  margin_pct: number | null;
}

export function getSupplierSparklines(
  start: string,
  end: string,
  supplierCodes?: string[],
  itemGroups?: string[]
): SparklineRow[] {
  const db = getDb();

  const supplierFilter = supplierCodes && supplierCodes.length > 0
    ? `AND pi.CreditorCode IN (${supplierCodes.map(() => '?').join(',')})`
    : '';
  const itemGroupFilter = itemGroups && itemGroups.length > 0
    ? `AND i.ItemGroup IN (${itemGroups.map(() => '?').join(',')})`
    : '';
  const itemGroupFilterSales = itemGroups && itemGroups.length > 0
    ? `AND i2.ItemGroup IN (${itemGroups.map(() => '?').join(',')})`
    : '';

  const params: (string | number)[] = [];

  // supplier_items CTE params
  if (supplierCodes?.length) params.push(...supplierCodes);
  if (itemGroups?.length) params.push(...itemGroups);
  params.push(start, end);

  // item_sales CTE params (iv)
  if (itemGroups?.length) params.push(...itemGroups);
  params.push(start, end);
  // item_sales CTE params (cs)
  if (itemGroups?.length) params.push(...itemGroups);
  params.push(start, end);

  return db.prepare(`
    WITH supplier_items AS (
      SELECT
        pi.CreditorCode,
        pd.ItemCode,
        strftime('%Y-%m', datetime(pi.DocDate, '+8 hours')) AS period,
        SUM(pd.Qty) AS purchased_qty,
        SUM(pd.LocalSubTotal) AS purchase_total
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      JOIN item i ON pd.ItemCode = i.ItemCode
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        ${supplierFilter}
        ${itemGroupFilter}
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pi.CreditorCode, pd.ItemCode, period
    ),
    item_sales AS (
      SELECT ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          strftime('%Y-%m', datetime(iv.DocDate, '+8 hours')) AS period,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        JOIN item i2 ON ivd.ItemCode = i2.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${itemGroupFilterSales}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode, period
        UNION ALL
        SELECT
          csd.ItemCode,
          strftime('%Y-%m', datetime(cs.DocDate, '+8 hours')) AS period,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i2 ON csd.ItemCode = i2.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${itemGroupFilterSales}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode, period
      ) GROUP BY ItemCode, period
    ),
    item_total_purchased AS (
      SELECT ItemCode, period, SUM(purchased_qty) AS total_qty
      FROM supplier_items
      GROUP BY ItemCode, period
    )
    SELECT
      si.CreditorCode AS creditor_code,
      si.period,
      ROUND(
        (SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
         - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)))
        / NULLIF(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) * 100, 2
      ) AS margin_pct
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode AND si.period = ist.period
    JOIN item_total_purchased itp ON si.ItemCode = itp.ItemCode AND si.period = itp.period
    GROUP BY si.CreditorCode, si.period
    ORDER BY si.CreditorCode, si.period
  `).all(...params) as SparklineRow[];
}

// ─── Supplier Item Breakdown (C expanded) ───────────────────────────────────

export function getSupplierItems(
  creditorCode: string,
  start: string,
  end: string
): SupplierItemRow[] {
  const db = getDb();

  return db.prepare(`
    WITH supplier_items AS (
      SELECT
        pd.ItemCode,
        SUM(pd.Qty) AS purchased_qty,
        SUM(pd.LocalSubTotal) AS purchase_total
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pi.CreditorCode = ?
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pd.ItemCode
    ),
    item_sales AS (
      SELECT ItemCode, SUM(sold_qty) AS sold_qty, SUM(revenue) AS revenue FROM (
        SELECT
          ivd.ItemCode,
          SUM(ivd.Qty) AS sold_qty,
          SUM(ivd.LocalSubTotalExTax) AS revenue
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.Qty) AS sold_qty,
          SUM(csd.LocalSubTotalExTax) AS revenue
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    )
    SELECT
      si.ItemCode AS item_code,
      i.Description AS description,
      i.ItemGroup AS item_group,
      si.purchased_qty AS qty_purchased,
      ROUND(si.purchase_total / NULLIF(si.purchased_qty, 0), 2) AS avg_purchase_price,
      COALESCE(ist.sold_qty, 0) AS qty_sold,
      COALESCE(ist.revenue, 0) AS revenue,
      ROUND(si.purchase_total / NULLIF(si.purchased_qty, 0) * COALESCE(ist.sold_qty, 0), 2) AS cogs,
      ROUND(
        (COALESCE(ist.revenue, 0) - si.purchase_total / NULLIF(si.purchased_qty, 0) * COALESCE(ist.sold_qty, 0))
        / NULLIF(COALESCE(ist.revenue, 0), 0) * 100, 2
      ) AS margin_pct
    FROM supplier_items si
    JOIN item i ON si.ItemCode = i.ItemCode
    LEFT JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    ORDER BY revenue DESC
  `).all(creditorCode, start, end, start, end, start, end) as SupplierItemRow[];
}

// ─── Supplier Item Price Trends (for profile sparklines) ────────────────────

export interface SupplierItemPriceTrend {
  item_code: string;
  prices: number[]; // 12 monthly avg prices, oldest first
}

export function getSupplierItemPriceTrends(
  creditorCode: string,
  start: string,
  end: string
): SupplierItemPriceTrend[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      pd.ItemCode AS item_code,
      strftime('%Y-%m', pi.DocDate, '+8 hours') AS month,
      ROUND(SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0), 2) AS avg_price
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    WHERE pi.Cancelled = 'F'
      AND pi.CreditorCode = ?
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY pd.ItemCode, month
    ORDER BY pd.ItemCode, month
  `).all(creditorCode, start, end) as { item_code: string; month: string; avg_price: number }[];

  // Group by item_code
  const map = new Map<string, number[]>();
  for (const r of rows) {
    if (!map.has(r.item_code)) map.set(r.item_code, []);
    map.get(r.item_code)!.push(r.avg_price);
  }

  return Array.from(map.entries()).map(([item_code, prices]) => ({ item_code, prices }));
}

// ─── Price Comparison (D1) ──────────────────────────────────────────────────

export function getPriceComparison(
  start: string,
  end: string,
  limit = 200
): PriceComparisonRow[] {
  const db = getDb();

  return db.prepare(`
    WITH purchase_prices AS (
      SELECT
        pd.ItemCode,
        pi.CreditorCode,
        ROUND(SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0), 2) AS avg_purchase_price,
        SUM(pd.Qty) AS purchased_qty
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pd.ItemCode, pi.CreditorCode
    ),
    selling_prices AS (
      SELECT ItemCode,
        ROUND(SUM(total_ex_tax) / NULLIF(SUM(total_qty), 0), 2) AS avg_selling_price,
        SUM(total_ex_tax) AS revenue
      FROM (
        SELECT
          ivd.ItemCode,
          SUM(ivd.LocalSubTotalExTax) AS total_ex_tax,
          SUM(ivd.Qty) AS total_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS total_ex_tax,
          SUM(csd.Qty) AS total_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    )
    SELECT
      pp.ItemCode AS item_code,
      i.Description AS item_name,
      i.ItemGroup AS item_group,
      c.CompanyName AS supplier_name,
      pp.avg_purchase_price,
      sp.avg_selling_price,
      ROUND(sp.avg_selling_price - pp.avg_purchase_price, 2) AS price_spread,
      ROUND((sp.avg_selling_price - pp.avg_purchase_price) / NULLIF(sp.avg_selling_price, 0) * 100, 2) AS margin_pct,
      sp.revenue
    FROM purchase_prices pp
    JOIN selling_prices sp ON pp.ItemCode = sp.ItemCode
    JOIN item i ON pp.ItemCode = i.ItemCode
    JOIN creditor c ON pp.CreditorCode = c.AccNo
    WHERE c.IsActive = 'T'
    ORDER BY sp.revenue DESC
    LIMIT ?
  `).all(start, end, start, end, start, end, limit) as PriceComparisonRow[];
}

// ─── Price Spread Top 10 (D2) ───────────────────────────────────────────────

export function getPriceSpread(
  start: string,
  end: string,
  suppliers: string[] = [],
  itemGroups: string[] = [],
): PriceSpreadRow[] {
  const db = getDb();

  const supplierFilter = suppliers.length
    ? `AND pi.CreditorCode IN (${suppliers.map(() => '?').join(',')})`
    : '';
  const itemGroupFilter = itemGroups.length
    ? `AND i2.ItemGroup IN (${itemGroups.map(() => '?').join(',')})`
    : '';
  const itemGroupJoin = itemGroups.length
    ? 'JOIN item i2 ON pd.ItemCode = i2.ItemCode'
    : '';

  const params: (string | number)[] = [];

  // purchase_prices CTE params
  params.push(start, end);
  if (suppliers.length) params.push(...suppliers);
  if (itemGroups.length) params.push(...itemGroups);

  // selling_prices CTE params (IV then CS)
  params.push(start, end, start, end);

  return db.prepare(`
    WITH purchase_prices AS (
      SELECT
        pd.ItemCode,
        ROUND(SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0), 2) AS avg_purchase_price
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      ${itemGroupJoin}
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
        ${supplierFilter}
        ${itemGroupFilter}
      GROUP BY pd.ItemCode
    ),
    selling_prices AS (
      SELECT ItemCode,
        ROUND(SUM(total_ex_tax) / NULLIF(SUM(total_qty), 0), 2) AS avg_selling_price,
        SUM(total_ex_tax) AS revenue
      FROM (
        SELECT
          ivd.ItemCode,
          SUM(ivd.LocalSubTotalExTax) AS total_ex_tax,
          SUM(ivd.Qty) AS total_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS total_ex_tax,
          SUM(csd.Qty) AS total_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    supplier_names AS (
      SELECT
        pd.ItemCode,
        GROUP_CONCAT(DISTINCT c.CompanyName) AS supplier_names,
        GROUP_CONCAT(DISTINCT pi.CreditorCode) AS supplier_codes
      FROM pidtl pd
      JOIN pi ON pi.DocKey = pd.DocKey
      JOIN creditor c ON pi.CreditorCode = c.AccNo
      WHERE pi.Cancelled = 'F' AND c.IsActive = 'T'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      GROUP BY pd.ItemCode
    )
    SELECT
      pp.ItemCode AS item_code,
      i.Description AS item_name,
      pp.avg_purchase_price,
      sp.avg_selling_price,
      ROUND((sp.avg_selling_price - pp.avg_purchase_price) / NULLIF(sp.avg_selling_price, 0) * 100, 2) AS margin_pct,
      sp.revenue,
      COALESCE(sn.supplier_names, '') AS supplier_names,
      COALESCE(sn.supplier_codes, '') AS supplier_codes
    FROM purchase_prices pp
    JOIN selling_prices sp ON pp.ItemCode = sp.ItemCode
    JOIN item i ON pp.ItemCode = i.ItemCode
    LEFT JOIN supplier_names sn ON pp.ItemCode = sn.ItemCode
    ORDER BY margin_pct ASC
  `).all(...params) as PriceSpreadRow[];
}

// ─── Procurement: Item List (multi-supplier items only) ─────────────────────

export interface ProcurementItemRow {
  item_code: string;
  item_description: string;
  supplier_count: number;
  total_qty: number;
  total_buy: number;
}

export function getItemListProcurement(
  start: string,
  end: string
): ProcurementItemRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      pd.ItemCode AS item_code,
      COALESCE(i.Description, pd.ItemCode) AS item_description,
      COUNT(DISTINCT pi.CreditorCode) AS supplier_count,
      ROUND(SUM(pd.Qty), 2) AS total_qty,
      ROUND(SUM(pd.SubTotal), 2) AS total_buy
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN item i ON pd.ItemCode = i.ItemCode
    WHERE pi.Cancelled = 'F'
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND pd.Qty > 0
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY pd.ItemCode, i.Description
    HAVING COUNT(DISTINCT pi.CreditorCode) >= 1
    ORDER BY total_buy DESC
  `).all(start, end) as ProcurementItemRow[];
}

// ─── Procurement: Item Supplier Summary (with latest price & trend) ─────────

export interface ProcurementSupplierRow {
  creditor_code: string;
  creditor_name: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  latest_price: number;
  latest_date: string;
  total_qty: number;
  total_buy: number;
  trend: 'up' | 'down' | 'flat';
  is_cheapest: boolean;
}

interface SupplierSummaryBase {
  creditor_code: string;
  creditor_name: string;
  min_price: number;
  max_price: number;
  avg_price: number;
  total_qty: number;
  total_buy: number;
}

interface LatestPriceRow {
  creditor_code: string;
  latest_price: number;
  latest_date: string;
}

export interface ProcurementSummaryResponse {
  suppliers: ProcurementSupplierRow[];
  sellPrice: ItemSellPriceV2;
}

export function getItemProcurementSummary(
  itemCode: string,
  start: string,
  end: string
): ProcurementSummaryResponse {
  const db = getDb();

  // 1. Per-supplier aggregate stats
  const summaryRows = db.prepare(`
    SELECT
      pi.CreditorCode AS creditor_code,
      c.CompanyName AS creditor_name,
      ROUND(MIN(pd.UnitPrice), 2) AS min_price,
      ROUND(MAX(pd.UnitPrice), 2) AS max_price,
      ROUND(AVG(pd.UnitPrice), 2) AS avg_price,
      ROUND(SUM(pd.Qty), 2) AS total_qty,
      ROUND(SUM(pd.SubTotal), 2) AS total_buy
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN creditor c ON pi.CreditorCode = c.AccNo
    WHERE pi.Cancelled = 'F' AND (c.IsActive = 'T' OR c.IsActive IS NULL)
      AND pd.ItemCode = ? AND pd.Qty > 0
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY pi.CreditorCode, c.CompanyName
    ORDER BY avg_price ASC
  `).all(itemCode, start, end) as SupplierSummaryBase[];

  // 2. Latest purchase price per supplier (most recent transaction)
  const latestRows = db.prepare(`
    SELECT
      sub.creditor_code,
      sub.latest_price,
      sub.latest_date
    FROM (
      SELECT
        pi.CreditorCode AS creditor_code,
        pd.UnitPrice AS latest_price,
        DATE(pi.DocDate, '+8 hours') AS latest_date,
        ROW_NUMBER() OVER (
          PARTITION BY pi.CreditorCode
          ORDER BY pi.DocDate DESC, pi.DocKey DESC
        ) AS rn
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode = ? AND pd.Qty > 0
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    ) sub
    WHERE sub.rn = 1
  `).all(itemCode, start, end) as LatestPriceRow[];

  const latestMap = new Map(latestRows.map(r => [r.creditor_code, r]));

  // 3. Trend: compare last 2 months from monthly data
  const monthlyData = getItemPriceMonthlyV2(itemCode, start, end);
  const months = [...new Set(monthlyData.map(r => r.year_month))].sort();
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  const trendMap = new Map<string, 'up' | 'down' | 'flat'>();
  if (lastMonth && prevMonth) {
    const lastPrices = new Map(
      monthlyData.filter(r => r.year_month === lastMonth).map(r => [r.creditor_code, r.avg_buy_price])
    );
    const prevPrices = new Map(
      monthlyData.filter(r => r.year_month === prevMonth).map(r => [r.creditor_code, r.avg_buy_price])
    );
    for (const code of lastPrices.keys()) {
      const curr = lastPrices.get(code)!;
      const prev = prevPrices.get(code);
      if (prev == null) {
        trendMap.set(code, 'flat');
      } else {
        const pctChange = ((curr - prev) / prev) * 100;
        trendMap.set(code, pctChange > 0.5 ? 'up' : pctChange < -0.5 ? 'down' : 'flat');
      }
    }
  }

  // 4. Find cheapest (lowest avg_price)
  const minAvg = summaryRows.length > 0
    ? Math.min(...summaryRows.map(r => r.avg_price))
    : Infinity;

  // 5. Merge into final response
  const suppliers: ProcurementSupplierRow[] = summaryRows.map(row => {
    const latest = latestMap.get(row.creditor_code);
    return {
      ...row,
      latest_price: latest?.latest_price ?? row.avg_price,
      latest_date: latest?.latest_date ?? '',
      trend: trendMap.get(row.creditor_code) ?? 'flat',
      is_cheapest: row.avg_price === minAvg,
    };
  });

  // 6. Sell price for margin context
  const sellPrice = getItemSellPriceV2(itemCode, start, end);

  return { suppliers, sellPrice };
}

// ─── Supplier Profile Summary ───────────────────────────────────────────────

export interface SupplierProfileSummary {
  is_active: boolean;
  items_supplied_count: number;
  single_supplier_count: number;
  single_supplier_items: string[];
}

export function getSupplierProfileSummary(creditorCode: string, start: string, end: string): SupplierProfileSummary {
  const db = getDb();

  // Is active
  const cred = db.prepare(`SELECT IsActive FROM creditor WHERE AccNo = ?`).get(creditorCode) as { IsActive: string } | undefined;
  const isActive = (cred?.IsActive ?? 'F') === 'T';

  // Items supplied by this supplier in period
  const supplierItems = db.prepare(`
    SELECT DISTINCT pd.ItemCode
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    WHERE pi.Cancelled = 'F'
      AND pi.CreditorCode = ?
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
  `).all(creditorCode, start, end) as { ItemCode: string }[];
  const supplierItemCodes = supplierItems.map(r => r.ItemCode);

  if (supplierItemCodes.length === 0) {
    return { is_active: isActive, items_supplied_count: 0, single_supplier_count: 0, single_supplier_items: [] };
  }

  // Find which of those items have ONLY this supplier in the period
  const placeholders = supplierItemCodes.map(() => '?').join(',');
  const multiSupplierItems = db.prepare(`
    SELECT DISTINCT pd.ItemCode
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    WHERE pi.Cancelled = 'F'
      AND pd.ItemCode IN (${placeholders})
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND pi.CreditorCode != ?
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
  `).all(...supplierItemCodes, creditorCode, start, end) as { ItemCode: string }[];
  const multiSet = new Set(multiSupplierItems.map(r => r.ItemCode));

  const singleItems = supplierItemCodes.filter(code => !multiSet.has(code));

  return {
    is_active: isActive,
    items_supplied_count: supplierItemCodes.length,
    single_supplier_count: singleItems.length,
    single_supplier_items: singleItems,
  };
}
