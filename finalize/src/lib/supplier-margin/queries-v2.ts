import { getDb } from './db';
import { getPreviousPeriod } from './date-utils';

// ─── Note ────────────────────────────────────────────────────────────────────
// Margin calculations use PIDTL.LocalSubTotal (actual purchase cost per supplier)
// instead of IVDTL.LocalTotalCost (AutoCount's blended/weighted-average COGS).

// ─── Types ───────────────────────────────────────────────────────────────────

export type Granularity = 'monthly' | 'quarterly' | 'yearly';

export interface MarginSummaryV2 {
  revenue: number;
  cogs: number;
  profit: number;
  margin_pct: number | null;
}

export interface TrendRowV2 {
  period: string;
  margin_pct: number | null;
  revenue: number;
  profit: number;
  // Optional: supplier-level when supplier filter active
  creditor_code?: string;
  company_name?: string;
}

export interface TopBottomRowV2 {
  creditor_code: string;
  company_name: string;
  margin_pct: number | null;
  revenue: number;
  profit: number;
}

export interface TopBottomItemRowV2 {
  item_code: string;
  item_name: string;
  item_group: string | null;
  margin_pct: number | null;
  revenue: number;
  profit: number;
}

export interface SupplierTableRowV2 {
  creditor_code: string;
  company_name: string;
  supplier_type: string | null;
  item_count: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number | null;
}

// ─── Item Price Comparison Types ────────────────────────────────────────────

export interface ItemListRowV2 {
  item_code: string;
  item_description: string;
  total_qty: number;
  total_buy: number;
}

export interface ItemSupplierSummaryRowV2 {
  creditor_code: string;
  creditor_name: string;
  min_price: number;
  max_price: number;
  avg_price: number;
  total_qty: number;
  total_buy: number;
  est_sales: number;
  est_margin_pct: number | null;
}

export interface ItemSellPriceV2 {
  avg_sell_price: number | null;
  min_sell_price: number | null;
  max_sell_price: number | null;
}

export interface ItemPriceMonthlyRowV2 {
  year_month: string;
  creditor_code: string;
  creditor_name: string;
  avg_buy_price: number;
  total_qty: number;
}

export interface SupplierItemRowV2 {
  item_code: string;
  item_description: string;
  total_qty: number;
  total_cost: number;
  margin_pct: number | null;
}

export interface SupplierSparklineRowV2 {
  creditor_code: string;
  year_month: string;
  margin_pct: number | null;
}

// ─── Granularity ─────────────────────────────────────────────────────────────

function periodExpr(granularity: Granularity, alias: string): string {
  switch (granularity) {
    case 'monthly':   return `strftime('%Y-%m', ${alias}.DocDate, '+8 hours')`;
    case 'quarterly': return `strftime('%Y', ${alias}.DocDate, '+8 hours') || '-Q' || ((CAST(strftime('%m', ${alias}.DocDate, '+8 hours') AS INTEGER) + 2) / 3)`;
    case 'yearly':    return `strftime('%Y', ${alias}.DocDate, '+8 hours')`;
  }
}

// ─── Filter helpers ──────────────────────────────────────────────────────────

function buildSupplierTypeFilter(supplierTypes: string[] | undefined, tableAlias: string): { sql: string; params: string[] } {
  if (!supplierTypes || supplierTypes.length === 0) return { sql: '', params: [] };
  const placeholders = supplierTypes.map(() => '?').join(',');
  return {
    sql: `AND ${tableAlias}.CreditorCode IN (SELECT AccNo FROM creditor WHERE IsActive = 'T' AND CreditorType IN (${placeholders}))`,
    params: [...supplierTypes],
  };
}

function buildItemGroupFilter(itemGroups: string[] | undefined, itemAlias: string): { sql: string; params: string[] } {
  if (!itemGroups || itemGroups.length === 0) return { sql: '', params: [] };
  const placeholders = itemGroups.map(() => '?').join(',');
  return {
    sql: `AND ${itemAlias}.ItemGroup IN (${placeholders})`,
    params: [...itemGroups],
  };
}

function buildSupplierFilter(suppliers: string[] | undefined, tableAlias: string): { sql: string; params: string[] } {
  if (!suppliers || suppliers.length === 0) return { sql: '', params: [] };
  const placeholders = suppliers.map(() => '?').join(',');
  return {
    sql: `AND ${tableAlias}.CreditorCode IN (${placeholders})`,
    params: [...suppliers],
  };
}

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export function getDateBoundsV2() {
  const db = getDb();
  return db.prepare(`
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
}

// ─── Dimensions ──────────────────────────────────────────────────────────────

export function getDimensionsV2() {
  const db = getDb();

  const suppliers = db.prepare(`
    SELECT DISTINCT c.AccNo, c.CompanyName
    FROM creditor c
    JOIN pi ON c.AccNo = pi.CreditorCode
    WHERE pi.Cancelled = 'F' AND c.IsActive = 'T'
    ORDER BY c.CompanyName
  `).all() as Array<{ AccNo: string; CompanyName: string }>;

  const supplierTypes = db.prepare(`
    SELECT CreditorType, Description
    FROM creditor_type
    WHERE IsActive = 'T'
    ORDER BY Description
  `).all() as Array<{ CreditorType: string; Description: string }>;

  const itemGroups = db.prepare(`
    SELECT ItemGroup, Description FROM item_group ORDER BY ItemGroup
  `).all() as Array<{ ItemGroup: string; Description: string }>;

  return { suppliers, supplierTypes, itemGroups };
}

// ─── Margin Summary (KPIs) ──────────────────────────────────────────────────

function fetchMarginPeriodV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
) {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const hasPiFilters = stFilter.sql || igFilter.sql;

  // If supplier type or item group filters active, use PI-based attribution
  if (hasPiFilters) {
    const params: (string | number)[] = [];
    // supplier_items CTE
    params.push(...stFilter.params);
    params.push(...igFilter.params);
    params.push(start, end);
    // item_sales CTE (iv)
    params.push(...igFilter.params);
    params.push(start, end);
    // item_sales CTE (cs)
    params.push(...igFilter.params);
    params.push(start, end);

    const row = db.prepare(`
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
          ${stFilter.sql}
          ${igFilter.sql}
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
          JOIN item i ON ivd.ItemCode = i.ItemCode
          WHERE iv.Cancelled = 'F'
            AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
            ${igFilter.sql}
            AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
          GROUP BY ivd.ItemCode
          UNION ALL
          SELECT
            csd.ItemCode,
            SUM(csd.LocalSubTotalExTax) AS revenue,
            SUM(csd.Qty) AS sold_qty
          FROM cs
          JOIN csdtl csd ON cs.DocKey = csd.DocKey
          JOIN item i ON csd.ItemCode = i.ItemCode
          WHERE cs.Cancelled = 'F'
            AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
            ${igFilter.sql}
            AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
          GROUP BY csd.ItemCode
        ) GROUP BY ItemCode
      ),
      item_total AS (
        SELECT ItemCode, SUM(purchased_qty) AS total_qty
        FROM supplier_items GROUP BY ItemCode
      )
      SELECT
        COALESCE(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) AS revenue,
        COALESCE(SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)), 0) AS cogs
      FROM supplier_items si
      JOIN item_sales ist ON si.ItemCode = ist.ItemCode
      JOIN item_total itp ON si.ItemCode = itp.ItemCode
    `).get(...params) as { revenue: number; cogs: number };
    return row;
  }

  // No filters: cost of goods sold — avg purchase price × sold qty
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

export function getMarginSummaryV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
) {
  const current = fetchMarginPeriodV2(start, end, supplierTypes, itemGroups);
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);
  const previous = fetchMarginPeriodV2(prevStart, prevEnd, supplierTypes, itemGroups);

  const curProfit = current.revenue - current.cogs;
  const prevProfit = previous.revenue - previous.cogs;
  const curMargin = current.revenue > 0 ? (curProfit / current.revenue) * 100 : null;
  const prevMargin = previous.revenue > 0 ? (prevProfit / previous.revenue) * 100 : null;

  const pct = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;

  return {
    period: { start, end, prevStart, prevEnd },
    current: {
      revenue: current.revenue,
      cogs: current.cogs,
      profit: curProfit,
      margin_pct: curMargin,
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
  };
}

// ─── Margin Trend ────────────────────────────────────────────────────────────

export function getMarginTrendV2(
  start: string,
  end: string,
  granularity: Granularity,
  supplierTypes?: string[],
  itemGroups?: string[],
  suppliers?: string[]
): TrendRowV2[] {
  const db = getDb();
  const pExpr = periodExpr(granularity, 'iv');
  const pExprCs = periodExpr(granularity, 'cs');
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');
  const supFilter = buildSupplierFilter(suppliers, 'pi');

  const hasFilters = stFilter.sql || supFilter.sql;
  const perSupplier = suppliers && suppliers.length > 0;

  // If supplier/type filters active, use PI-based attribution
  if (hasFilters || perSupplier) {
    const params: (string | number)[] = [];
    // supplier_items CTE
    params.push(...stFilter.params);
    params.push(...supFilter.params);
    params.push(...igFilter.params);
    params.push(start, end);
    // item_sales CTE (iv)
    params.push(...igFilter.params);
    params.push(start, end);
    // item_sales CTE (cs)
    params.push(...igFilter.params);
    params.push(start, end);

    const selectSupplier = perSupplier
      ? `si.CreditorCode AS creditor_code, c.CompanyName AS company_name,`
      : '';
    const joinCreditor = perSupplier ? `JOIN creditor c ON si.CreditorCode = c.AccNo AND c.IsActive = 'T'` : '';
    const groupBySupplier = perSupplier ? `, si.CreditorCode, c.CompanyName` : '';

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
          ${stFilter.sql}
          ${supFilter.sql}
          ${igFilter.sql}
          AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY pi.CreditorCode, pd.ItemCode
      ),
      item_sales AS (
        SELECT ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
          SELECT
            ivd.ItemCode,
            ${pExpr} AS period,
            SUM(ivd.LocalSubTotalExTax) AS revenue,
            SUM(ivd.Qty) AS sold_qty
          FROM iv
          JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
          JOIN item i ON ivd.ItemCode = i.ItemCode
          WHERE iv.Cancelled = 'F'
            AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
            ${igFilter.sql}
            AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
          GROUP BY ivd.ItemCode, period
          UNION ALL
          SELECT
            csd.ItemCode,
            ${pExprCs} AS period,
            SUM(csd.LocalSubTotalExTax) AS revenue,
            SUM(csd.Qty) AS sold_qty
          FROM cs
          JOIN csdtl csd ON cs.DocKey = csd.DocKey
          JOIN item i ON csd.ItemCode = i.ItemCode
          WHERE cs.Cancelled = 'F'
            AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
            ${igFilter.sql}
            AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
          GROUP BY csd.ItemCode, period
        ) GROUP BY ItemCode, period
      ),
      item_total AS (
        SELECT ItemCode, SUM(purchased_qty) AS total_qty
        FROM supplier_items GROUP BY ItemCode
      )
      SELECT
        ist.period,
        ${selectSupplier}
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
      JOIN item_sales ist ON si.ItemCode = ist.ItemCode
      JOIN item_total itp ON si.ItemCode = itp.ItemCode
      ${joinCreditor}
      GROUP BY ist.period${groupBySupplier}
      ORDER BY ist.period ASC
    `).all(...params) as TrendRowV2[];
  }

  // No filters: cost of goods sold trend — avg purchase price × sold qty per period
  const igFilterSimple = buildItemGroupFilter(itemGroups, 'i');

  const purchaseParams: (string | number)[] = [...igFilterSimple.params, start, end];
  const salesParams: (string | number)[] = [...igFilterSimple.params, start, end, ...igFilterSimple.params, start, end];

  const igJoin = igFilterSimple.sql ? 'JOIN item i ON ivd.ItemCode = i.ItemCode' : '';
  const igJoinCs = igFilterSimple.sql ? 'JOIN item i ON csd.ItemCode = i.ItemCode' : '';
  const igJoinPurchase = igFilterSimple.sql ? 'JOIN item i ON pd.ItemCode = i.ItemCode' : '';

  return db.prepare(`
    WITH item_purchase AS (
      SELECT
        pd.ItemCode,
        SUM(pd.LocalSubTotal) / NULLIF(SUM(pd.Qty), 0) AS avg_purchase_price
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      ${igJoinPurchase}
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        AND pd.Qty > 0
        ${igFilterSimple.sql}
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pd.ItemCode
    ),
    item_sales_by_period AS (
      SELECT ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          ${pExpr} AS period,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        ${igJoin}
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilterSimple.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode, period
        UNION ALL
        SELECT
          csd.ItemCode,
          ${pExprCs} AS period,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        ${igJoinCs}
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilterSimple.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode, period
      ) GROUP BY ItemCode, period
    )
    SELECT
      s.period,
      ROUND(
        (SUM(s.revenue) - SUM(s.sold_qty * p.avg_purchase_price))
        / NULLIF(SUM(s.revenue), 0) * 100, 2
      ) AS margin_pct,
      ROUND(SUM(s.revenue), 2) AS revenue,
      ROUND(SUM(s.revenue) - SUM(s.sold_qty * p.avg_purchase_price), 2) AS profit
    FROM item_sales_by_period s
    JOIN item_purchase p ON s.ItemCode = p.ItemCode
    GROUP BY s.period
    ORDER BY s.period ASC
  `).all(...purchaseParams, ...salesParams) as TrendRowV2[];
}

// ─── Top/Bottom Suppliers ────────────────────────────────────────────────────

export function getTopBottomSuppliersV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[],
  limit = 10,
  order: 'asc' | 'desc' = 'desc',
  sortBy: 'profit' | 'margin_pct' = 'profit'
): TopBottomRowV2[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [];
  // supplier_items CTE
  params.push(...stFilter.params);
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (iv)
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (cs)
  params.push(...igFilter.params);
  params.push(start, end);
  // LIMIT
  params.push(limit);

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
        ${stFilter.sql}
        ${igFilter.sql}
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
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode
    )
    SELECT
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
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    JOIN item_total itp ON si.ItemCode = itp.ItemCode
    JOIN creditor c ON si.CreditorCode = c.AccNo
    WHERE c.IsActive = 'T'
    GROUP BY si.CreditorCode, c.CompanyName
    ORDER BY ${sortBy === 'margin_pct' ? 'margin_pct' : 'profit'} ${order === 'asc' ? 'ASC' : 'DESC'}
    LIMIT ?
  `).all(...params) as TopBottomRowV2[];
}

// ─── Top/Bottom Items ─────────────────────────────────────────────────────────

export function getTopBottomItemsV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[],
  limit = 10,
  order: 'asc' | 'desc' = 'desc',
  sortBy: 'profit' | 'margin_pct' = 'profit'
): TopBottomItemRowV2[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [];
  // supplier_items CTE
  params.push(...stFilter.params);
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (iv)
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (cs)
  params.push(...igFilter.params);
  params.push(start, end);
  // LIMIT
  params.push(limit);

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
        ${stFilter.sql}
        ${igFilter.sql}
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
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode
    )
    SELECT
      si.ItemCode AS item_code,
      i2.Description AS item_name,
      i2.ItemGroup AS item_group,
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
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    JOIN item_total itp ON si.ItemCode = itp.ItemCode
    JOIN item i2 ON si.ItemCode = i2.ItemCode
    GROUP BY si.ItemCode, i2.Description, i2.ItemGroup
    ORDER BY ${sortBy === 'margin_pct' ? 'margin_pct' : 'profit'} ${order === 'asc' ? 'ASC' : 'DESC'}
    LIMIT ?
  `).all(...params) as TopBottomItemRowV2[];
}

// ─── Supplier Table ──────────────────────────────────────────────────────────

export function getSupplierTableV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[],
  suppliers?: string[]
): SupplierTableRowV2[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');
  const supFilter = buildSupplierFilter(suppliers, 'pi');

  const params: (string | number)[] = [];
  // supplier_items CTE
  params.push(...stFilter.params);
  params.push(...supFilter.params);
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (iv)
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (cs)
  params.push(...igFilter.params);
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
        ${stFilter.sql}
        ${supFilter.sql}
        ${igFilter.sql}
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
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode
    )
    SELECT
      si.CreditorCode AS creditor_code,
      c.CompanyName AS company_name,
      ct.Description AS supplier_type,
      COUNT(DISTINCT si.ItemCode) AS item_count,
      ROUND(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 2) AS revenue,
      ROUND(SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)), 2) AS cogs,
      ROUND(
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
        - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)), 2
      ) AS gross_profit,
      ROUND(
        (SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
         - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)))
        / NULLIF(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) * 100, 2
      ) AS margin_pct
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode
    JOIN item_total itp ON si.ItemCode = itp.ItemCode
    JOIN creditor c ON si.CreditorCode = c.AccNo
    LEFT JOIN creditor_type ct ON c.CreditorType = ct.CreditorType
    WHERE c.IsActive = 'T'
    GROUP BY si.CreditorCode, c.CompanyName, ct.Description
    ORDER BY revenue DESC
  `).all(...params) as SupplierTableRowV2[];
}

// ─── Item List (for dropdown) ───────────────────────────────────────────────

export function getItemListV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): ItemListRowV2[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [
    ...stFilter.params,
    ...igFilter.params,
    start, end,
  ];

  return db.prepare(`
    SELECT
      pd.ItemCode AS item_code,
      COALESCE(i.Description, pd.ItemCode) AS item_description,
      ROUND(SUM(pd.Qty), 2) AS total_qty,
      ROUND(SUM(pd.SubTotal), 2) AS total_buy
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN item i ON pd.ItemCode = i.ItemCode
    WHERE pi.Cancelled = 'F'
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND pd.Qty > 0
      ${stFilter.sql}
      ${igFilter.sql}
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY pd.ItemCode, i.Description
    ORDER BY total_buy DESC
  `).all(...params) as ItemListRowV2[];
}

// ─── Item Sell Price (from sales invoices) ──────────────────────────────────

export function getItemSellPriceV2(
  itemCode: string,
  start: string,
  end: string
): ItemSellPriceV2 {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      ROUND(SUM(LocalSubTotalExTax) / NULLIF(SUM(Qty), 0), 2) AS avg_sell_price,
      ROUND(MIN(UnitPrice), 2) AS min_sell_price,
      ROUND(MAX(UnitPrice), 2) AS max_sell_price
    FROM (
      SELECT ivd.LocalSubTotalExTax, ivd.Qty, ivd.UnitPrice
      FROM iv
      JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
      WHERE iv.Cancelled = 'F'
        AND ivd.ItemCode = ?
        AND ivd.Qty > 0 AND ivd.UnitPrice > 0
        AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
      UNION ALL
      SELECT csd.LocalSubTotalExTax, csd.Qty, csd.UnitPrice
      FROM cs
      JOIN csdtl csd ON cs.DocKey = csd.DocKey
      WHERE cs.Cancelled = 'F'
        AND csd.ItemCode = ?
        AND csd.Qty > 0 AND csd.UnitPrice > 0
        AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
    )
  `).get(itemCode, start, end, itemCode, start, end) as ItemSellPriceV2 | undefined;

  return row ?? { avg_sell_price: null, min_sell_price: null, max_sell_price: null };
}

// ─── Item Supplier Summary (per-supplier stats for one item) ────────────────

export function getItemSupplierSummaryV2(
  itemCode: string,
  start: string,
  end: string
): ItemSupplierSummaryRowV2[] {
  const db = getDb();
  const sellPrice = getItemSellPriceV2(itemCode, start, end);
  const avgSell = sellPrice.avg_sell_price ?? 0;

  return db.prepare(`
    SELECT
      pi.CreditorCode AS creditor_code,
      c.CompanyName AS creditor_name,
      ROUND(MIN(pd.UnitPrice), 2) AS min_price,
      ROUND(MAX(pd.UnitPrice), 2) AS max_price,
      ROUND(AVG(pd.UnitPrice), 2) AS avg_price,
      ROUND(SUM(pd.Qty), 2) AS total_qty,
      ROUND(SUM(pd.SubTotal), 2) AS total_buy,
      ROUND(SUM(pd.Qty) * ?, 2) AS est_sales,
      CASE WHEN ? > 0
        THEN ROUND((? - AVG(pd.UnitPrice)) / ? * 100, 2)
        ELSE NULL
      END AS est_margin_pct
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN creditor c ON pi.CreditorCode = c.AccNo
    WHERE pi.Cancelled = 'F' AND (c.IsActive = 'T' OR c.IsActive IS NULL)
      AND pd.ItemCode = ?
      AND pd.Qty > 0
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY pi.CreditorCode, c.CompanyName
    ORDER BY total_buy DESC
  `).all(avgSell, avgSell, avgSell, avgSell, itemCode, start, end) as ItemSupplierSummaryRowV2[];
}

// ─── Item Price Monthly (per-supplier monthly trend for one item) ───────────

export function getItemPriceMonthlyV2(
  itemCode: string,
  start: string,
  end: string
): ItemPriceMonthlyRowV2[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', pi.DocDate, '+8 hours') AS year_month,
      pi.CreditorCode AS creditor_code,
      c.CompanyName AS creditor_name,
      ROUND(AVG(pd.UnitPrice), 2) AS avg_buy_price,
      ROUND(SUM(pd.Qty), 2) AS total_qty
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN creditor c ON pi.CreditorCode = c.AccNo
    WHERE pi.Cancelled = 'F' AND (c.IsActive = 'T' OR c.IsActive IS NULL)
      AND pd.ItemCode = ?
      AND pd.Qty > 0
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY year_month, pi.CreditorCode, c.CompanyName
    ORDER BY year_month ASC
  `).all(itemCode, start, end) as ItemPriceMonthlyRowV2[];
}

// ─── Item Price Weekly (per-supplier weekly trend for one item) ──────────────

export function getItemPriceWeeklyV2(
  itemCode: string,
  start: string,
  end: string
): ItemPriceMonthlyRowV2[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-W%W', pi.DocDate, '+8 hours') AS year_month,
      pi.CreditorCode AS creditor_code,
      c.CompanyName AS creditor_name,
      ROUND(AVG(pd.UnitPrice), 2) AS avg_buy_price,
      ROUND(SUM(pd.Qty), 2) AS total_qty
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN creditor c ON pi.CreditorCode = c.AccNo
    WHERE pi.Cancelled = 'F' AND (c.IsActive = 'T' OR c.IsActive IS NULL)
      AND pd.ItemCode = ?
      AND pd.Qty > 0
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY year_month, pi.CreditorCode, c.CompanyName
    ORDER BY year_month ASC
  `).all(itemCode, start, end) as ItemPriceMonthlyRowV2[];
}

// ─── Supplier Items (items for a specific supplier, for expandable rows) ────

export function getSupplierItemsV2(
  creditorCode: string,
  start: string,
  end: string,
  itemGroups?: string[]
): SupplierItemRowV2[] {
  const db = getDb();
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [
    start, end,        // sell_prices CTE (iv)
    start, end,        // sell_prices CTE (cs)
    creditorCode,      // main WHERE: CreditorCode
    ...igFilter.params,
    start, end,        // main WHERE: date range
  ];

  return db.prepare(`
    WITH sell_prices AS (
      SELECT ItemCode, AVG(avg_sell) AS avg_sell FROM (
        SELECT
          ivd.ItemCode,
          AVG(ivd.UnitPrice) AS avg_sell
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        WHERE iv.Cancelled = 'F'
          AND ivd.Qty > 0 AND ivd.UnitPrice > 0
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          AVG(csd.UnitPrice) AS avg_sell
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        WHERE cs.Cancelled = 'F'
          AND csd.Qty > 0 AND csd.UnitPrice > 0
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    )
    SELECT
      pd.ItemCode AS item_code,
      COALESCE(i.Description, pd.ItemCode) AS item_description,
      ROUND(SUM(pd.Qty), 2) AS total_qty,
      ROUND(SUM(pd.SubTotal), 2) AS total_cost,
      CASE WHEN sp.avg_sell > 0
        THEN ROUND((sp.avg_sell - AVG(pd.UnitPrice)) / sp.avg_sell * 100, 2)
        ELSE NULL
      END AS margin_pct
    FROM pi
    JOIN pidtl pd ON pi.DocKey = pd.DocKey
    LEFT JOIN item i ON pd.ItemCode = i.ItemCode
    LEFT JOIN sell_prices sp ON pd.ItemCode = sp.ItemCode
    WHERE pi.Cancelled = 'F'
      AND pi.CreditorCode = ?
      AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
      AND pd.Qty > 0
      ${igFilter.sql}
      AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY pd.ItemCode, i.Description, sp.avg_sell
    ORDER BY total_cost DESC
  `).all(...params) as SupplierItemRowV2[];
}

// ─── Supplier Sparklines (monthly margin for all suppliers) ─────────────────

export function getSupplierSparklinesV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): SupplierSparklineRowV2[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [];
  // supplier_items CTE
  params.push(...stFilter.params);
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (iv)
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (cs)
  params.push(...igFilter.params);
  params.push(start, end);

  return db.prepare(`
    WITH supplier_items AS (
      SELECT
        pi.CreditorCode,
        pd.ItemCode,
        strftime('%Y-%m', pi.DocDate, '+8 hours') AS period,
        SUM(pd.Qty) AS purchased_qty,
        SUM(pd.LocalSubTotal) AS purchase_total
      FROM pi
      JOIN pidtl pd ON pi.DocKey = pd.DocKey
      JOIN item i ON pd.ItemCode = i.ItemCode
      WHERE pi.Cancelled = 'F'
        AND pd.ItemCode IS NOT NULL AND pd.ItemCode != ''
        ${stFilter.sql}
        ${igFilter.sql}
        AND DATE(pi.DocDate, '+8 hours') BETWEEN ? AND ?
      GROUP BY pi.CreditorCode, pd.ItemCode, period
    ),
    item_sales AS (
      SELECT ItemCode, period, SUM(revenue) AS revenue, SUM(sold_qty) AS sold_qty FROM (
        SELECT
          ivd.ItemCode,
          strftime('%Y-%m', iv.DocDate, '+8 hours') AS period,
          SUM(ivd.LocalSubTotalExTax) AS revenue,
          SUM(ivd.Qty) AS sold_qty
        FROM iv
        JOIN ivdtl ivd ON iv.DocKey = ivd.DocKey
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode, period
        UNION ALL
        SELECT
          csd.ItemCode,
          strftime('%Y-%m', cs.DocDate, '+8 hours') AS period,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode, period
      ) GROUP BY ItemCode, period
    ),
    item_total AS (
      SELECT ItemCode, period, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode, period
    )
    SELECT
      si.CreditorCode AS creditor_code,
      si.period AS year_month,
      ROUND(
        (SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0))
         - SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)))
        / NULLIF(SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)), 0) * 100, 2
      ) AS margin_pct
    FROM supplier_items si
    JOIN item_sales ist ON si.ItemCode = ist.ItemCode AND si.period = ist.period
    JOIN item_total itp ON si.ItemCode = itp.ItemCode AND si.period = itp.period
    GROUP BY si.CreditorCode, si.period
    ORDER BY si.CreditorCode, si.period
  `).all(...params) as SupplierSparklineRowV2[];
}

// ─── Supplier Margin Distribution ───────────────────────────────────────────

export interface DistributionBucket {
  bucket: string;
  count: number;
}

export function getSupplierMarginDistributionV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): DistributionBucket[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [];
  // supplier_items CTE
  params.push(...stFilter.params);
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (iv)
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (cs)
  params.push(...igFilter.params);
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
        ${stFilter.sql}
        ${igFilter.sql}
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
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode
    ),
    supplier_margin AS (
      SELECT
        si.CreditorCode,
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)) AS rev,
        SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)) AS cost
      FROM supplier_items si
      JOIN item_sales ist ON si.ItemCode = ist.ItemCode
      JOIN item_total itp ON si.ItemCode = itp.ItemCode
      JOIN creditor c ON si.CreditorCode = c.AccNo
      WHERE c.IsActive = 'T'
      GROUP BY si.CreditorCode
    )
    SELECT
      CASE
        WHEN rev IS NULL OR rev = 0 THEN '< 0%'
        WHEN (rev - cost) / rev * 100 < 0 THEN '< 0%'
        WHEN (rev - cost) / rev * 100 < 5 THEN '0-5%'
        WHEN (rev - cost) / rev * 100 < 10 THEN '5-10%'
        WHEN (rev - cost) / rev * 100 < 15 THEN '10-15%'
        WHEN (rev - cost) / rev * 100 < 20 THEN '15-20%'
        WHEN (rev - cost) / rev * 100 < 30 THEN '20-30%'
        ELSE '30%+'
      END AS bucket,
      COUNT(*) AS count
    FROM supplier_margin
    GROUP BY bucket
    ORDER BY
      CASE bucket
        WHEN '< 0%' THEN 1
        WHEN '0-5%' THEN 2
        WHEN '5-10%' THEN 3
        WHEN '10-15%' THEN 4
        WHEN '15-20%' THEN 5
        WHEN '20-30%' THEN 6
        ELSE 7
      END
  `).all(...params) as DistributionBucket[];
}

// ─── Item Margin Distribution ────────────────────────────────────────────────

export function getItemMarginDistributionV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): DistributionBucket[] {
  const db = getDb();
  const stFilter = buildSupplierTypeFilter(supplierTypes, 'pi');
  const igFilter = buildItemGroupFilter(itemGroups, 'i');

  const params: (string | number)[] = [];
  // supplier_items CTE
  params.push(...stFilter.params);
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (iv)
  params.push(...igFilter.params);
  params.push(start, end);
  // item_sales CTE (cs)
  params.push(...igFilter.params);
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
        ${stFilter.sql}
        ${igFilter.sql}
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
        JOIN item i ON ivd.ItemCode = i.ItemCode
        WHERE iv.Cancelled = 'F'
          AND ivd.ItemCode IS NOT NULL AND ivd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(iv.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY ivd.ItemCode
        UNION ALL
        SELECT
          csd.ItemCode,
          SUM(csd.LocalSubTotalExTax) AS revenue,
          SUM(csd.Qty) AS sold_qty
        FROM cs
        JOIN csdtl csd ON cs.DocKey = csd.DocKey
        JOIN item i ON csd.ItemCode = i.ItemCode
        WHERE cs.Cancelled = 'F'
          AND csd.ItemCode IS NOT NULL AND csd.ItemCode != ''
          ${igFilter.sql}
          AND DATE(cs.DocDate, '+8 hours') BETWEEN ? AND ?
        GROUP BY csd.ItemCode
      ) GROUP BY ItemCode
    ),
    item_total AS (
      SELECT ItemCode, SUM(purchased_qty) AS total_qty
      FROM supplier_items GROUP BY ItemCode
    ),
    item_margin AS (
      SELECT
        si.ItemCode,
        SUM(ist.revenue * si.purchased_qty / NULLIF(itp.total_qty, 0)) AS rev,
        SUM(si.purchase_total * ist.sold_qty / NULLIF(itp.total_qty, 0)) AS cost
      FROM supplier_items si
      JOIN item_sales ist ON si.ItemCode = ist.ItemCode
      JOIN item_total itp ON si.ItemCode = itp.ItemCode
      GROUP BY si.ItemCode
      HAVING rev > 0
    )
    SELECT
      CASE
        WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 0 THEN '< 0%'
        WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 5 THEN '0-5%'
        WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 10 THEN '5-10%'
        WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 15 THEN '10-15%'
        WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 20 THEN '15-20%'
        WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 30 THEN '20-30%'
        ELSE '30%+'
      END AS bucket,
      COUNT(*) AS count
    FROM item_margin
    GROUP BY bucket
    ORDER BY
      CASE bucket
        WHEN '< 0%' THEN 1
        WHEN '0-5%' THEN 2
        WHEN '5-10%' THEN 3
        WHEN '10-15%' THEN 4
        WHEN '15-20%' THEN 5
        WHEN '20-30%' THEN 6
        ELSE 7
      END
  `).all(...params) as DistributionBucket[];
}
