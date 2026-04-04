import { getPool, getRdsPool } from '../postgres';
import { getPreviousPeriod } from './date-utils';

// ─── Note ────────────────────────────────────────────────────────────────────
// Phase 3: All queries read from pc_supplier_margin pre-computed table.
// Margin = sales_revenue - attributed_cogs (per supplier-item-month row).
// sales_revenue and sales_qty are attributed proportionally to each supplier's purchase share.
// attributed_cogs = purchase_total × (item_sold_qty / total_item_purchase_qty).
// purchase_total and purchase_qty remain raw (unattributed) for price analysis.

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

function periodExpr(granularity: Granularity): string {
  switch (granularity) {
    case 'monthly':   return `m.month`;
    case 'quarterly': return `LEFT(m.month, 4) || '-Q' || ((CAST(RIGHT(m.month, 2) AS int) - 1) / 3 + 1)`;
    case 'yearly':    return `LEFT(m.month, 4)`;
  }
}

// ─── Filter helpers ──────────────────────────────────────────────────────────

function buildSupplierTypeFilter(supplierTypes: string[] | undefined, startIdx: number): { sql: string; params: string[]; nextIdx: number } {
  if (!supplierTypes || supplierTypes.length === 0) return { sql: '', params: [], nextIdx: startIdx };
  const placeholders = supplierTypes.map((_, i) => `$${startIdx + i}`).join(',');
  return {
    sql: `AND m.creditor_code IN (SELECT creditorcode FROM supplier WHERE isactive = 'T' AND creditortype IN (${placeholders}))`,
    params: [...supplierTypes],
    nextIdx: startIdx + supplierTypes.length,
  };
}

function buildItemGroupFilter(itemGroups: string[] | undefined, startIdx: number): { sql: string; params: string[]; nextIdx: number } {
  if (!itemGroups || itemGroups.length === 0) return { sql: '', params: [], nextIdx: startIdx };
  const placeholders = itemGroups.map((_, i) => `$${startIdx + i}`).join(',');
  return {
    sql: `AND m.item_group IN (${placeholders})`,
    params: [...itemGroups],
    nextIdx: startIdx + itemGroups.length,
  };
}

function buildSupplierFilter(suppliers: string[] | undefined, startIdx: number): { sql: string; params: string[]; nextIdx: number } {
  if (!suppliers || suppliers.length === 0) return { sql: '', params: [], nextIdx: startIdx };
  const placeholders = suppliers.map((_, i) => `$${startIdx + i}`).join(',');
  return {
    sql: `AND m.creditor_code IN (${placeholders})`,
    params: [...suppliers],
    nextIdx: startIdx + suppliers.length,
  };
}

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export async function getDateBoundsV2(): Promise<{ min_date: string; max_date: string }> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      MIN(month || '-01') AS min_date,
      MAX(month || '-01') AS max_date
    FROM pc_supplier_margin
  `);
  return rows[0] as { min_date: string; max_date: string };
}

// ─── Dimensions ──────────────────────────────────────────────────────────────

export async function getDimensionsV2(): Promise<{
  suppliers: Array<{ AccNo: string; CompanyName: string }>;
  supplierTypes: Array<{ CreditorType: string; Description: string }>;
  itemGroups: Array<{ ItemGroup: string; Description: string }>;
}> {
  const pool = getPool();

  const [suppliersRes, supplierTypesRes, itemGroupsRes] = await Promise.all([
    pool.query(`
      SELECT DISTINCT m.creditor_code AS "AccNo", m.creditor_name AS "CompanyName"
      FROM pc_supplier_margin m
      JOIN supplier s ON m.creditor_code = s.creditorcode
      WHERE m.creditor_code IS NOT NULL AND s.isactive = 'T'
      ORDER BY "CompanyName"
    `),
    pool.query(`
      SELECT creditortype AS "CreditorType", description AS "Description"
      FROM supplier_type
      ORDER BY description
    `),
    pool.query(`
      SELECT itemgroup AS "ItemGroup", description AS "Description" FROM product_group ORDER BY itemgroup
    `),
  ]);

  return {
    suppliers: suppliersRes.rows,
    supplierTypes: supplierTypesRes.rows,
    itemGroups: itemGroupsRes.rows,
  };
}

// ─── Margin Summary (KPIs) ──────────────────────────────────────────────────

async function fetchMarginPeriodV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): Promise<{ revenue: number; cogs: number }> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params];

  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(m.sales_revenue), 0)::float AS revenue,
      COALESCE(SUM(m.attributed_cogs), 0)::float AS cogs
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      ${stFilter.sql}
      ${igFilter.sql}
  `, params);
  return rows[0] as { revenue: number; cogs: number };
}

export async function getMarginSummaryV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): Promise<{
  period: { start: string; end: string; prevStart: string; prevEnd: string };
  current: MarginSummaryV2;
  previous: MarginSummaryV2;
  growth: { revenue_pct: number | null; cogs_pct: number | null; profit_pct: number | null; margin_delta: number | null };
}> {
  const current = await fetchMarginPeriodV2(start, end, supplierTypes, itemGroups);
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);
  const previous = await fetchMarginPeriodV2(prevStart, prevEnd, supplierTypes, itemGroups);

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

export async function getMarginTrendV2(
  start: string,
  end: string,
  granularity: Granularity,
  supplierTypes?: string[],
  itemGroups?: string[],
  suppliers?: string[]
): Promise<TrendRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);
  const pExpr = periodExpr(granularity);
  const perSupplier = suppliers && suppliers.length > 0;

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const supFilter = buildSupplierFilter(suppliers, idx);
  idx = supFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...supFilter.params, ...igFilter.params];

  const selectSupplier = perSupplier
    ? `m.creditor_code, m.creditor_name AS company_name,`
    : '';
  const groupBySupplier = perSupplier ? `, m.creditor_code, m.creditor_name` : '';

  const { rows } = await pool.query(`
    SELECT
      ${pExpr} AS period,
      ${selectSupplier}
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2)::float AS profit
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      ${stFilter.sql}
      ${supFilter.sql}
      ${igFilter.sql}
    GROUP BY ${pExpr}${groupBySupplier}
    ORDER BY ${pExpr} ASC
  `, params);
  return rows as TrendRowV2[];
}

// ─── Top/Bottom Suppliers ────────────────────────────────────────────────────

export async function getTopBottomSuppliersV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[],
  limit = 10,
  order: 'asc' | 'desc' = 'desc',
  sortBy: 'profit' | 'margin_pct' = 'profit'
): Promise<TopBottomRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const limitIdx = idx; idx += 1;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params, limit];

  const { rows } = await pool.query(`
    SELECT
      m.creditor_code,
      m.creditor_name AS company_name,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2)::float AS profit
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      ${stFilter.sql}
      ${igFilter.sql}
    GROUP BY m.creditor_code, m.creditor_name
    ORDER BY ${sortBy === 'margin_pct' ? 'margin_pct' : 'profit'} ${order === 'asc' ? 'ASC' : 'DESC'} NULLS LAST
    LIMIT $${limitIdx}
  `, params);
  return rows as TopBottomRowV2[];
}

// ─── Top/Bottom Items ─────────────────────────────────────────────────────────

export async function getTopBottomItemsV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[],
  limit = 10,
  order: 'asc' | 'desc' = 'desc',
  sortBy: 'profit' | 'margin_pct' = 'profit'
): Promise<TopBottomItemRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const limitIdx = idx; idx += 1;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params, limit];

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      m.item_description AS item_name,
      m.item_group,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2)::float AS profit
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      ${stFilter.sql}
      ${igFilter.sql}
    GROUP BY m.item_code, m.item_description, m.item_group
    ORDER BY ${sortBy === 'margin_pct' ? 'margin_pct' : 'profit'} ${order === 'asc' ? 'ASC' : 'DESC'} NULLS LAST
    LIMIT $${limitIdx}
  `, params);
  return rows as TopBottomItemRowV2[];
}

// ─── Supplier Table ──────────────────────────────────────────────────────────

export async function getSupplierTableV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[],
  suppliers?: string[]
): Promise<SupplierTableRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const supFilter = buildSupplierFilter(suppliers, idx);
  idx = supFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...supFilter.params, ...igFilter.params];

  const { rows } = await pool.query(`
    SELECT
      m.creditor_code,
      m.creditor_name AS company_name,
      m.creditor_type AS supplier_type,
      COUNT(DISTINCT m.item_code)::int AS item_count,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.attributed_cogs)::numeric, 2)::float AS cogs,
      ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2)::float AS gross_profit,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      ${stFilter.sql}
      ${supFilter.sql}
      ${igFilter.sql}
    GROUP BY m.creditor_code, m.creditor_name, m.creditor_type
    ORDER BY revenue DESC
  `, params);
  return rows as SupplierTableRowV2[];
}

// ─── Item List (for dropdown) ───────────────────────────────────────────────

export async function getItemListV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): Promise<ItemListRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params];

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      MIN(COALESCE(m.item_description, m.item_code)) AS item_description,
      ROUND(SUM(m.purchase_qty)::numeric, 2)::float AS total_qty,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS total_buy
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      AND m.purchase_qty > 0
      ${stFilter.sql}
      ${igFilter.sql}
    GROUP BY m.item_code
    ORDER BY total_buy DESC
  `, params);
  return rows as ItemListRowV2[];
}

// ─── Item Sell Price (all from RDS raw line items for accuracy) ──────────────
// Pre-computed table uses attributed sales (proportional to supplier purchase share),
// which distorts avg when total_purchases < total_sales for an item.
// RDS gives true transaction-level avg/min/max.

export async function getItemSellPriceV2(
  itemCode: string,
  start: string,
  end: string
): Promise<ItemSellPriceV2> {
  const rds = getRdsPool();

  try {
    const { rows } = await rds.query(`
      SELECT
        ROUND((SUM("SubTotalExTax") / NULLIF(SUM("Qty"), 0))::numeric, 2)::float AS avg_sell_price,
        ROUND(MIN("UnitPrice")::numeric, 2)::float AS min_sell_price,
        ROUND(MAX("UnitPrice")::numeric, 2)::float AS max_sell_price
      FROM (
        SELECT d."LocalSubTotalExTax" AS "SubTotalExTax", d."Qty", d."UnitPrice"
        FROM dbo."IVDTL" d
        JOIN dbo."IV" h ON d."DocKey" = h."DocKey"
        WHERE h."Cancelled" = 'F'
          AND d."ItemCode" = $1
          AND d."Qty" > 0 AND d."UnitPrice" > 0
          AND DATE(h."DocDate" + INTERVAL '8 hours') BETWEEN $2 AND $3
        UNION ALL
        SELECT d."LocalSubTotalExTax", d."Qty", d."UnitPrice"
        FROM dbo."CSDTL" d
        JOIN dbo."CS" h ON d."DocKey" = h."DocKey"
        WHERE h."Cancelled" = 'F'
          AND d."ItemCode" = $1
          AND d."Qty" > 0 AND d."UnitPrice" > 0
          AND DATE(h."DocDate" + INTERVAL '8 hours') BETWEEN $2 AND $3
      ) combined
    `, [itemCode, start, end]);

    const row = rows[0] as ItemSellPriceV2 | undefined;
    return row ?? { avg_sell_price: null, min_sell_price: null, max_sell_price: null };
  } catch {
    // RDS unavailable — fall back to pre-computed table
    const pool = getPool();
    const startMonth = start.substring(0, 7);
    const endMonth = end.substring(0, 7);
    const { rows } = await pool.query(`
      SELECT
        ROUND((SUM(m.sales_revenue) / NULLIF(SUM(m.sales_qty), 0))::numeric, 2)::float AS avg_sell_price,
        NULL::float AS min_sell_price,
        NULL::float AS max_sell_price
      FROM pc_supplier_margin m
      WHERE m.item_code = $1
        AND m.month BETWEEN $2 AND $3
        AND m.is_active = 'T'
        AND m.sales_qty > 0
    `, [itemCode, startMonth, endMonth]);
    const row = rows[0] as ItemSellPriceV2 | undefined;
    return row ?? { avg_sell_price: null, min_sell_price: null, max_sell_price: null };
  }
}

// ─── Item Supplier Summary (per-supplier stats for one item) ────────────────

export async function getItemSupplierSummaryV2(
  itemCode: string,
  start: string,
  end: string
): Promise<ItemSupplierSummaryRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const sellPrice = await getItemSellPriceV2(itemCode, start, end);
  const avgSell = sellPrice.avg_sell_price ?? 0;

  const { rows } = await pool.query(`
    SELECT
      m.creditor_code,
      m.creditor_name,
      ROUND(MIN(m.min_unit_price)::numeric, 2)::float AS min_price,
      ROUND(MAX(m.max_unit_price)::numeric, 2)::float AS max_price,
      ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2)::float AS avg_price,
      ROUND(SUM(m.purchase_qty)::numeric, 2)::float AS total_qty,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS total_buy,
      ROUND((SUM(m.purchase_qty) * $1)::numeric, 2)::float AS est_sales,
      CASE WHEN $1 > 0
        THEN ROUND((($1 - SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0)) / $1 * 100)::numeric, 2)::float
        ELSE NULL
      END AS est_margin_pct
    FROM pc_supplier_margin m
    WHERE m.item_code = $2
      AND m.month BETWEEN $3 AND $4
      AND m.is_active = 'T'
      AND m.purchase_qty > 0
    GROUP BY m.creditor_code, m.creditor_name
    ORDER BY total_buy DESC
  `, [avgSell, itemCode, startMonth, endMonth]);
  return rows as ItemSupplierSummaryRowV2[];
}

// ─── Item Price Monthly (per-supplier monthly trend for one item) ───────────

export async function getItemPriceMonthlyV2(
  itemCode: string,
  start: string,
  end: string
): Promise<ItemPriceMonthlyRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      m.month AS year_month,
      m.creditor_code,
      m.creditor_name,
      ROUND(m.avg_unit_cost::numeric, 2)::float AS avg_buy_price,
      ROUND(m.purchase_qty::numeric, 2)::float AS total_qty
    FROM pc_supplier_margin m
    WHERE m.item_code = $1
      AND m.month BETWEEN $2 AND $3
      AND m.is_active = 'T'
      AND m.purchase_qty > 0
    ORDER BY m.month ASC
  `, [itemCode, startMonth, endMonth]);
  return rows as ItemPriceMonthlyRowV2[];
}

// ─── Item Price Weekly — not available from pc_supplier_margin (monthly only)
// Returns monthly data as fallback

export async function getItemPriceWeeklyV2(
  itemCode: string,
  start: string,
  end: string
): Promise<ItemPriceMonthlyRowV2[]> {
  // pc_supplier_margin only has monthly granularity; return monthly as fallback
  return getItemPriceMonthlyV2(itemCode, start, end);
}

// ─── Supplier Items (items for a specific supplier, for expandable rows) ────

export async function getSupplierItemsV2(
  creditorCode: string,
  start: string,
  end: string,
  itemGroups?: string[]
): Promise<SupplierItemRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 4;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [creditorCode, startMonth, endMonth, ...igFilter.params];

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      MIN(COALESCE(m.item_description, m.item_code)) AS item_description,
      ROUND(SUM(m.purchase_qty)::numeric, 2)::float AS total_qty,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS total_cost,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
      AND m.is_active = 'T'
      AND m.purchase_qty > 0
      ${igFilter.sql}
    GROUP BY m.item_code
    ORDER BY total_cost DESC
  `, params);
  return rows as SupplierItemRowV2[];
}

// ─── Supplier Sparklines (monthly margin for all suppliers) ─────────────────

export async function getSupplierSparklinesV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): Promise<SupplierSparklineRowV2[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params];

  const { rows } = await pool.query(`
    SELECT
      m.creditor_code,
      m.month AS year_month,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.is_active = 'T'
      ${stFilter.sql}
      ${igFilter.sql}
    GROUP BY m.creditor_code, m.month
    ORDER BY m.creditor_code, m.month
  `, params);
  return rows as SupplierSparklineRowV2[];
}

// ─── Supplier Margin Distribution ───────────────────────────────────────────

export interface DistributionBucket {
  bucket: string;
  count: number;
}

export async function getSupplierMarginDistributionV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): Promise<DistributionBucket[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params];

  const { rows } = await pool.query(`
    WITH supplier_margin AS (
      SELECT
        m.creditor_code,
        SUM(m.sales_revenue)::float AS rev,
        SUM(m.attributed_cogs)::float AS cost
      FROM pc_supplier_margin m
      WHERE m.month BETWEEN $1 AND $2
        AND m.is_active = 'T'
        ${stFilter.sql}
        ${igFilter.sql}
      GROUP BY m.creditor_code
    )
    SELECT bucket, COUNT(*)::int AS count
    FROM (
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
        END AS bucket
      FROM supplier_margin
    ) bucketed
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
  `, params);
  return rows as DistributionBucket[];
}

// ─── Item Margin Distribution ────────────────────────────────────────────────

export async function getItemMarginDistributionV2(
  start: string,
  end: string,
  supplierTypes?: string[],
  itemGroups?: string[]
): Promise<DistributionBucket[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  let idx = 3;
  const stFilter = buildSupplierTypeFilter(supplierTypes, idx);
  idx = stFilter.nextIdx;
  const igFilter = buildItemGroupFilter(itemGroups, idx);
  idx = igFilter.nextIdx;

  const params: unknown[] = [startMonth, endMonth, ...stFilter.params, ...igFilter.params];

  const { rows } = await pool.query(`
    WITH item_margin AS (
      SELECT
        m.item_code,
        SUM(m.sales_revenue)::float AS rev,
        SUM(m.attributed_cogs)::float AS cost
      FROM pc_supplier_margin m
      WHERE m.month BETWEEN $1 AND $2
        AND m.is_active = 'T'
        ${stFilter.sql}
        ${igFilter.sql}
      GROUP BY m.item_code
      HAVING SUM(m.sales_revenue) > 0
    )
    SELECT bucket, COUNT(*)::int AS count
    FROM (
      SELECT
        CASE
          WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 0 THEN '< 0%'
          WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 5 THEN '0-5%'
          WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 10 THEN '5-10%'
          WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 15 THEN '10-15%'
          WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 20 THEN '15-20%'
          WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 30 THEN '20-30%'
          ELSE '30%+'
        END AS bucket
      FROM item_margin
    ) bucketed
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
  `, params);
  return rows as DistributionBucket[];
}
