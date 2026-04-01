import { getPool } from '../postgres';
import { getPreviousPeriod } from './date-utils';
import { getItemPriceMonthlyV2, getItemSellPriceV2 } from './queries-v2';
import type { ItemSellPriceV2 } from './queries-v2';

// ─── Note ────────────────────────────────────────────────────────────────────
// Phase 3: All queries read from pc_supplier_margin pre-computed table.
// Margin = sales_revenue - purchase_total (per supplier-item-month row).

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

function periodExpr(granularity: Granularity): string {
  switch (granularity) {
    case 'monthly':   return `m.month`;
    case 'quarterly': return `LEFT(m.month, 4) || '-Q' || ((CAST(RIGHT(m.month, 2) AS int) - 1) / 3 + 1)`;
    case 'yearly':    return `LEFT(m.month, 4)`;
  }
}

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export async function getDateBounds(): Promise<{ min_date: string; max_date: string }> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      MIN(month || '-01') AS min_date,
      MAX(month || '-01') AS max_date
    FROM pc_supplier_margin
  `);
  return rows[0];
}

// ─── Dimensions ──────────────────────────────────────────────────────────────

export async function getSuppliers(): Promise<Array<{ accno: string; companyname: string }>> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT DISTINCT m.creditor_code AS accno, m.creditor_name AS companyname
    FROM pc_supplier_margin m
    JOIN supplier s ON m.creditor_code = s.creditorcode
    WHERE m.creditor_code IS NOT NULL AND s.isactive = 'T'
    ORDER BY companyname
  `);
  return rows;
}

export async function getItemGroups(): Promise<Array<{ itemgroup: string; description: string }>> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT itemgroup, description FROM product_group ORDER BY itemgroup`);
  return rows;
}

// ─── Margin Summary (KPIs) ──────────────────────────────────────────────────

async function fetchMarginPeriod(start: string, end: string): Promise<{ revenue: number; cogs: number }> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(m.sales_revenue), 0)::float AS revenue,
      COALESCE(SUM(m.purchase_total), 0)::float AS cogs
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
  `, [startMonth, endMonth]);
  return rows[0];
}

// Minimum revenue threshold for top/lowest supplier KPI: RM 50,000
const SUPPLIER_KPI_MIN_REVENUE = 50000;

async function fetchTopLowestSupplier(start: string, end: string): Promise<{ top: { name: string; margin_pct: number } | null; lowest: { name: string; margin_pct: number } | null }> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      m.creditor_name AS name,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS rev,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
    GROUP BY m.creditor_code, m.creditor_name
    HAVING SUM(m.sales_revenue) >= $3
    ORDER BY margin_pct DESC
  `, [startMonth, endMonth, SUPPLIER_KPI_MIN_REVENUE]);

  if (rows.length === 0) return { top: null, lowest: null };

  return {
    top: { name: rows[0].name, margin_pct: rows[0].margin_pct },
    lowest: { name: rows[rows.length - 1].name, margin_pct: rows[rows.length - 1].margin_pct },
  };
}

export async function getMarginSummary(start: string, end: string) {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const current = await fetchMarginPeriod(start, end);
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);
  const previous = await fetchMarginPeriod(prevStart, prevEnd);

  const curProfit = current.revenue - current.cogs;
  const prevProfit = previous.revenue - previous.cogs;
  const curMargin = current.revenue > 0 ? (curProfit / current.revenue) * 100 : null;
  const prevMargin = previous.revenue > 0 ? (prevProfit / previous.revenue) * 100 : null;

  const pct = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;

  const { top, lowest } = await fetchTopLowestSupplier(start, end);

  // Active supplier count
  const supplierCountResult = await pool.query(`
    SELECT COUNT(DISTINCT m.creditor_code)::int AS cnt
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.sales_revenue > 0
  `, [startMonth, endMonth]);
  const supplierCount = supplierCountResult.rows[0] as { cnt: number };

  // Distinct items supplied count
  const itemsResult = await pool.query(`
    SELECT COUNT(DISTINCT m.item_code)::int AS cnt
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.purchase_qty > 0
  `, [startMonth, endMonth]);
  const itemsRow = itemsResult.rows[0] as { cnt: number };

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

export async function getMarginTrend(
  start: string,
  end: string,
  granularity: Granularity
): Promise<TrendRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);
  const pExpr = periodExpr(granularity);

  const { rows } = await pool.query(`
    SELECT
      ${pExpr} AS period,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS cogs,
      ROUND((SUM(m.sales_revenue) - SUM(m.purchase_total))::numeric, 2)::float AS profit,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
    GROUP BY ${pExpr}
    ORDER BY ${pExpr} ASC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Top 10 Supplier Trend (B2) ─────────────────────────────────────────────

export async function getSupplierTrend(
  start: string,
  end: string,
  granularity: Granularity
): Promise<SupplierTrendRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);
  const pExpr = periodExpr(granularity);

  // First find top 10 suppliers by revenue
  const topResult = await pool.query(`
    SELECT m.creditor_code AS creditorcode
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
    GROUP BY m.creditor_code
    ORDER BY SUM(m.sales_revenue) DESC
    LIMIT 10
  `, [startMonth, endMonth]);

  const topSuppliers = topResult.rows as Array<{ creditorcode: string }>;
  if (topSuppliers.length === 0) return [];

  const codes = topSuppliers.map(s => s.creditorcode);
  const codeParams = codes.map((_, i) => `$${i + 3}`).join(',');

  const { rows } = await pool.query(`
    SELECT
      ${pExpr} AS period,
      m.creditor_code,
      m.creditor_name AS company_name,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND((SUM(m.sales_revenue) - SUM(m.purchase_total))::numeric, 2)::float AS profit
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.creditor_code IN (${codeParams})
    GROUP BY ${pExpr}, m.creditor_code, m.creditor_name
    ORDER BY ${pExpr} ASC
  `, [startMonth, endMonth, ...codes]);
  return rows;
}

// ─── Margin by Item Group (B3) ──────────────────────────────────────────────

export async function getMarginByItemGroup(
  start: string,
  end: string,
  granularity: Granularity
): Promise<ItemGroupRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);
  const pExpr = periodExpr(granularity);

  const { rows } = await pool.query(`
    SELECT
      COALESCE(m.item_group, 'UNGROUPED') AS item_group,
      ${pExpr} AS period,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS cogs,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
    GROUP BY COALESCE(m.item_group, 'UNGROUPED'), ${pExpr}
    ORDER BY ${pExpr} ASC, revenue DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Supplier Table (C) ─────────────────────────────────────────────────────

export async function getSupplierTable(
  start: string,
  end: string,
  supplierCodes?: string[],
  itemGroups?: string[]
): Promise<SupplierRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const params: (string | number)[] = [startMonth, endMonth];
  let paramIdx = 3;

  let supplierFilter = '';
  if (supplierCodes && supplierCodes.length > 0) {
    const placeholders = supplierCodes.map((_, i) => `$${paramIdx + i}`).join(',');
    supplierFilter = `AND m.creditor_code IN (${placeholders})`;
    params.push(...supplierCodes);
    paramIdx += supplierCodes.length;
  }

  let itemGroupFilter = '';
  if (itemGroups && itemGroups.length > 0) {
    const placeholders = itemGroups.map((_, i) => `$${paramIdx + i}`).join(',');
    itemGroupFilter = `AND m.item_group IN (${placeholders})`;
    params.push(...itemGroups);
    paramIdx += itemGroups.length;
  }

  const { rows } = await pool.query(`
    SELECT
      m.creditor_code,
      m.creditor_name AS company_name,
      m.creditor_type AS supplier_type,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS attributed_revenue,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS attributed_cogs,
      ROUND((SUM(m.sales_revenue) - SUM(m.purchase_total))::numeric, 2)::float AS attributed_profit,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct,
      ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2)::float AS avg_purchase_price,
      ROUND((SUM(m.sales_revenue) / NULLIF(SUM(m.sales_qty), 0))::numeric, 2)::float AS avg_selling_price,
      ROUND(
        (SUM(m.sales_revenue) / NULLIF(SUM(m.sales_qty), 0)
        - SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2
      )::float AS price_spread,
      COUNT(DISTINCT m.item_code)::int AS items_supplied
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      ${supplierFilter}
      ${itemGroupFilter}
    GROUP BY m.creditor_code, m.creditor_name, m.creditor_type
    ORDER BY attributed_revenue DESC
  `, params);
  return rows;
}

// ─── Supplier Sparklines (monthly margin per supplier) ──────────────────────

export interface SparklineRow {
  creditor_code: string;
  period: string;
  margin_pct: number | null;
}

export async function getSupplierSparklines(
  start: string,
  end: string,
  supplierCodes?: string[],
  itemGroups?: string[]
): Promise<SparklineRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const params: (string | number)[] = [startMonth, endMonth];
  let paramIdx = 3;

  let supplierFilter = '';
  if (supplierCodes && supplierCodes.length > 0) {
    const placeholders = supplierCodes.map((_, i) => `$${paramIdx + i}`).join(',');
    supplierFilter = `AND m.creditor_code IN (${placeholders})`;
    params.push(...supplierCodes);
    paramIdx += supplierCodes.length;
  }

  let itemGroupFilter = '';
  if (itemGroups && itemGroups.length > 0) {
    const placeholders = itemGroups.map((_, i) => `$${paramIdx + i}`).join(',');
    itemGroupFilter = `AND m.item_group IN (${placeholders})`;
    params.push(...itemGroups);
    paramIdx += itemGroups.length;
  }

  const { rows } = await pool.query(`
    SELECT
      m.creditor_code,
      m.month AS period,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      ${supplierFilter}
      ${itemGroupFilter}
    GROUP BY m.creditor_code, m.month
    ORDER BY m.creditor_code, m.month
  `, params);
  return rows;
}

// ─── Supplier Item Breakdown (C expanded) ───────────────────────────────────

export async function getSupplierItems(
  creditorCode: string,
  start: string,
  end: string
): Promise<SupplierItemRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      m.item_description AS description,
      m.item_group,
      ROUND(SUM(m.purchase_qty)::numeric, 2)::float AS qty_purchased,
      ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2)::float AS avg_purchase_price,
      ROUND(SUM(m.sales_qty)::numeric, 0)::float AS qty_sold,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS cogs,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
    GROUP BY m.item_code, m.item_description, m.item_group
    ORDER BY revenue DESC
  `, [creditorCode, startMonth, endMonth]);
  return rows;
}

// ─── Supplier Item Price Trends (for profile sparklines) ────────────────────

export interface SupplierItemPriceMonth {
  month: string;
  avg_price: number;
  qty: number;
}

export interface SupplierItemPriceTrend {
  item_code: string;
  prices: number[]; // monthly avg prices, oldest first
  monthly: SupplierItemPriceMonth[]; // full monthly detail for popover
}

export async function getSupplierItemPriceTrends(
  creditorCode: string,
  start: string,
  end: string
): Promise<SupplierItemPriceTrend[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      m.month,
      ROUND(m.avg_unit_cost::numeric, 2)::float AS avg_price,
      ROUND(m.purchase_qty::numeric)::float AS qty
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
      AND m.purchase_qty > 0
    ORDER BY m.item_code, m.month
  `, [creditorCode, startMonth, endMonth]);

  // Group by item_code
  const map = new Map<string, { prices: number[]; monthly: SupplierItemPriceMonth[] }>();
  for (const r of rows) {
    if (!map.has(r.item_code)) map.set(r.item_code, { prices: [], monthly: [] });
    const entry = map.get(r.item_code)!;
    entry.prices.push(r.avg_price);
    entry.monthly.push({ month: r.month, avg_price: r.avg_price, qty: r.qty });
  }

  return Array.from(map.entries()).map(([item_code, { prices, monthly }]) => ({ item_code, prices, monthly }));
}

// ─── Price Comparison (D1) ──────────────────────────────────────────────────

export async function getPriceComparison(
  start: string,
  end: string,
  limit = 200
): Promise<PriceComparisonRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      m.item_description AS item_name,
      m.item_group,
      m.creditor_name AS supplier_name,
      ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2)::float AS avg_purchase_price,
      ROUND((SUM(m.sales_revenue) / NULLIF(SUM(m.sales_qty), 0))::numeric, 2)::float AS avg_selling_price,
      ROUND(
        (SUM(m.sales_revenue) / NULLIF(SUM(m.sales_qty), 0)
        - SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2
      )::float AS price_spread,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS margin_pct,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
    GROUP BY m.item_code, m.item_description, m.item_group, m.creditor_code, m.creditor_name
    HAVING SUM(m.sales_revenue) > 0
    ORDER BY revenue DESC
    LIMIT $3
  `, [startMonth, endMonth, limit]);
  return rows;
}

// ─── Price Spread Top 10 (D2) ───────────────────────────────────────────────

export async function getPriceSpread(
  start: string,
  end: string,
  suppliers: string[] = [],
  itemGroups: string[] = [],
): Promise<PriceSpreadRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const params: (string | number)[] = [startMonth, endMonth];
  let paramIdx = 3;

  let supplierFilter = '';
  if (suppliers.length) {
    const placeholders = suppliers.map((_, i) => `$${paramIdx + i}`).join(',');
    supplierFilter = `AND m.creditor_code IN (${placeholders})`;
    params.push(...suppliers);
    paramIdx += suppliers.length;
  }

  let itemGroupFilter = '';
  if (itemGroups.length) {
    const placeholders = itemGroups.map((_, i) => `$${paramIdx + i}`).join(',');
    itemGroupFilter = `AND m.item_group IN (${placeholders})`;
    params.push(...itemGroups);
    paramIdx += itemGroups.length;
  }

  const { rows } = await pool.query(`
    WITH item_stats AS (
      SELECT
        m.item_code,
        MIN(m.item_description) AS item_name,
        ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2)::float AS avg_purchase_price,
        ROUND((SUM(m.sales_revenue) / NULLIF(SUM(m.sales_qty), 0))::numeric, 2)::float AS avg_selling_price,
        ROUND(
          ((SUM(m.sales_revenue) - SUM(m.purchase_total))
          / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
        )::float AS margin_pct,
        ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS revenue,
        STRING_AGG(DISTINCT m.creditor_name, ',') AS supplier_names,
        STRING_AGG(DISTINCT m.creditor_code, ',') AS supplier_codes
      FROM pc_supplier_margin m
      WHERE m.month BETWEEN $1 AND $2
        ${supplierFilter}
        ${itemGroupFilter}
      GROUP BY m.item_code
      HAVING SUM(m.sales_revenue) > 0
    )
    SELECT
      item_code,
      item_name,
      avg_purchase_price,
      avg_selling_price,
      margin_pct,
      revenue,
      supplier_names,
      supplier_codes
    FROM item_stats
    ORDER BY margin_pct ASC
  `, params);
  return rows;
}

// ─── Procurement: Item List (multi-supplier items only) ─────────────────────

export interface ProcurementItemRow {
  item_code: string;
  item_description: string;
  fruit_name: string | null;
  fruit_country: string | null;
  fruit_variant: string | null;
  supplier_count: number;
  total_qty: number;
  total_buy: number;
}

export async function getItemListProcurement(
  start: string,
  end: string
): Promise<ProcurementItemRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const { rows } = await pool.query(`
    SELECT
      m.item_code,
      MIN(COALESCE(m.item_description, m.item_code)) AS item_description,
      MIN(m.fruit_name) AS fruit_name,
      MIN(p.fruitcountry) AS fruit_country,
      MIN(p.fruitvariant) AS fruit_variant,
      COUNT(DISTINCT m.creditor_code)::int AS supplier_count,
      ROUND(SUM(m.purchase_qty)::numeric, 2)::float AS total_qty,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS total_buy
    FROM pc_supplier_margin m
    LEFT JOIN product p ON m.item_code = p.itemcode
    WHERE m.month BETWEEN $1 AND $2
      AND m.purchase_qty > 0
    GROUP BY m.item_code
    HAVING COUNT(DISTINCT m.creditor_code) >= 1
    ORDER BY total_buy DESC
  `, [startMonth, endMonth]);
  return rows;
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

export interface ProcurementSummaryResponse {
  suppliers: ProcurementSupplierRow[];
  sellPrice: ItemSellPriceV2;
}

export async function getItemProcurementSummary(
  itemCode: string,
  start: string,
  end: string
): Promise<ProcurementSummaryResponse> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  // 1. Per-supplier aggregate stats
  const summaryResult = await pool.query(`
    SELECT
      m.creditor_code,
      m.creditor_name,
      ROUND(MIN(m.avg_unit_cost)::numeric, 2)::float AS min_price,
      ROUND(MAX(m.avg_unit_cost)::numeric, 2)::float AS max_price,
      ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2)::float AS avg_price,
      ROUND(SUM(m.purchase_qty)::numeric, 2)::float AS total_qty,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS total_buy
    FROM pc_supplier_margin m
    WHERE m.item_code = $1
      AND m.month BETWEEN $2 AND $3
      AND m.purchase_qty > 0
    GROUP BY m.creditor_code, m.creditor_name
    ORDER BY avg_price ASC
  `, [itemCode, startMonth, endMonth]);
  const summaryRows = summaryResult.rows as Array<{
    creditor_code: string; creditor_name: string;
    min_price: number; max_price: number; avg_price: number;
    total_qty: number; total_buy: number;
  }>;

  // 2. Latest purchase price per supplier (most recent month with data)
  const latestResult = await pool.query(`
    SELECT DISTINCT ON (m.creditor_code)
      m.creditor_code,
      m.avg_unit_cost::float AS latest_price,
      m.month || '-01' AS latest_date
    FROM pc_supplier_margin m
    WHERE m.item_code = $1
      AND m.month BETWEEN $2 AND $3
      AND m.purchase_qty > 0
    ORDER BY m.creditor_code, m.month DESC
  `, [itemCode, startMonth, endMonth]);
  const latestMap = new Map(
    latestResult.rows.map((r: { creditor_code: string; latest_price: number; latest_date: string }) => [r.creditor_code, r])
  );

  // 3. Trend: compare last 2 months from monthly data
  const monthlyData = await getItemPriceMonthlyV2(itemCode, start, end);
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
  const sellPrice = await getItemSellPriceV2(itemCode, start, end);

  return { suppliers, sellPrice };
}

// ─── Supplier Profile Summary ───────────────────────────────────────────────

export interface SupplierProfileSummary {
  is_active: boolean;
  items_supplied_count: number;
  single_supplier_count: number;    // count of sole-source fruit+variant pairs
  total_variant_count: number;      // total unique fruit+variant pairs
  single_supplier_items: string[];  // item codes belonging to sole-source variants
}

// Extract fruit+variant key from description: "MANDARIN CHINA LOKAM ..." -> "MANDARIN CHINA LOKAM"
function extractVariantKey(description: string): string {
  const words = description.split(' ');
  if (words.length < 3) return description;
  const variantWords: string[] = [words[0], words[1]]; // fruit + country
  for (let i = 2; i < words.length; i++) {
    if (/^\d|^[XSML]{1,3}$|^PCS$|^KG$/i.test(words[i])) break;
    variantWords.push(words[i]);
  }
  return variantWords.join(' ');
}

export async function getSupplierProfileSummary(creditorCode: string, start: string, end: string): Promise<SupplierProfileSummary> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  // Is active
  const credResult = await pool.query(`SELECT isactive FROM supplier WHERE accno = $1`, [creditorCode]);
  const cred = credResult.rows[0] as { isactive: string } | undefined;
  const isActive = (cred?.isactive ?? 'F') === 'T';

  // Items supplied by this supplier in period that also have sales
  const supplierItemsResult = await pool.query(`
    SELECT DISTINCT m.item_code AS itemcode, m.item_description AS description
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
      AND m.purchase_qty > 0
      AND m.sales_revenue > 0
  `, [creditorCode, startMonth, endMonth]);
  const supplierItems = supplierItemsResult.rows as { itemcode: string; description: string }[];

  if (supplierItems.length === 0) {
    return { is_active: isActive, items_supplied_count: 0, single_supplier_count: 0, total_variant_count: 0, single_supplier_items: [] };
  }

  // Build variant key -> item codes mapping for this supplier
  const variantToItems = new Map<string, string[]>();
  for (const { itemcode, description } of supplierItems) {
    const vk = extractVariantKey(description || itemcode);
    if (!variantToItems.has(vk)) variantToItems.set(vk, []);
    variantToItems.get(vk)!.push(itemcode);
  }

  // Get ALL supplier-item combos in period to build variant -> suppliers mapping
  const allPurchasesResult = await pool.query(`
    SELECT DISTINCT m.creditor_code, m.item_description AS description
    FROM pc_supplier_margin m
    WHERE m.month BETWEEN $1 AND $2
      AND m.purchase_qty > 0
  `, [startMonth, endMonth]);
  const allPurchases = allPurchasesResult.rows as { creditor_code: string; description: string }[];

  // Build variant key -> set of suppliers
  const variantSuppliers = new Map<string, Set<string>>();
  for (const { creditor_code, description } of allPurchases) {
    const vk = extractVariantKey(description || '');
    if (!variantSuppliers.has(vk)) variantSuppliers.set(vk, new Set());
    variantSuppliers.get(vk)!.add(creditor_code);
  }

  // Find sole-source variants (only this supplier provides that fruit+variant)
  const soleVariants: string[] = [];
  const soleItemCodes: string[] = [];
  for (const [vk, itemCodes] of variantToItems) {
    const suppliersSet = variantSuppliers.get(vk);
    if (suppliersSet && suppliersSet.size === 1) {
      soleVariants.push(vk);
      soleItemCodes.push(...itemCodes);
    }
  }

  return {
    is_active: isActive,
    items_supplied_count: supplierItems.length,
    single_supplier_count: soleVariants.length,
    total_variant_count: variantToItems.size,
    single_supplier_items: soleItemCodes,
  };
}

// ─── Supplier Details (contact, terms, etc.) ────────────────────────────────

export interface SupplierDetails {
  creditor_code: string;
  company_name: string;
  is_active: boolean;
  creditor_type: string;
  purchase_agent: string;
  supplier_since: string;
  pic: string;
  phone: string;
  mobile: string;
  email: string;
  payment_terms: string;
  credit_limit: number;
  currency: string;
}

export async function getSupplierDetails(creditorCode: string): Promise<SupplierDetails | null> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      c.accno, c.companyname, c.isactive, c.creditortype,
      c.purchaseagent, c.createdtimestamp, c.attention,
      c.phone1, c.mobile, c.emailaddress,
      c.displayterm, c.creditlimit, c.currencycode,
      ct.description AS creditortypedesc
    FROM supplier c
    LEFT JOIN supplier_type ct ON c.creditortype = ct.creditortype
    WHERE c.accno = $1
  `, [creditorCode]);

  const row = rows[0] as {
    accno: string; companyname: string; isactive: string; creditortype: string;
    purchaseagent: string; createdtimestamp: string; attention: string;
    phone1: string; mobile: string; emailaddress: string;
    displayterm: string; creditlimit: number; currencycode: string;
    creditortypedesc: string | null;
  } | undefined;

  if (!row) return null;

  return {
    creditor_code: row.accno,
    company_name: row.companyname,
    is_active: row.isactive === 'T',
    creditor_type: row.creditortypedesc || row.creditortype || '',
    purchase_agent: row.purchaseagent || '',
    supplier_since: row.createdtimestamp ? String(row.createdtimestamp).split(' ')[0] : '',
    pic: row.attention || '',
    phone: row.phone1 || '',
    mobile: row.mobile || '',
    email: row.emailaddress || '',
    payment_terms: row.displayterm || '',
    credit_limit: row.creditlimit ?? 0,
    currency: row.currencycode || 'MYR',
  };
}

// ─── Supplier Performance (margin trend + top items) ────────────────────────

export interface SupplierMarginTrendRow {
  period: string;
  purchase_cost: number;
  attributed_revenue: number;
  margin_pct: number | null;
}

export interface SupplierTopItemRow {
  item: string;
  profit: number;
  margin_pct: number;
}

export interface SupplierPerformance {
  margin_trend: SupplierMarginTrendRow[];
  top_items: SupplierTopItemRow[];
  total_purchase_cost: number;
  attributed_revenue: number;
  attributed_profit: number;
  avg_margin: number;
}

export async function getSupplierPerformance(creditorCode: string, start: string, end: string): Promise<SupplierPerformance> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  // Monthly trend: purchase cost + margin
  const trendResult = await pool.query(`
    SELECT
      m.month AS period,
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS purchase_cost,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS attributed_revenue,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 1
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
    GROUP BY m.month
    ORDER BY m.month
  `, [creditorCode, startMonth, endMonth]);
  const trendRows = trendResult.rows as SupplierMarginTrendRow[];

  // Top 5 items by gross profit
  const topItemsResult = await pool.query(`
    SELECT
      m.item_description AS item,
      ROUND((SUM(m.sales_revenue) - SUM(m.purchase_total))::numeric, 2)::float AS profit,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 1
      )::float AS margin_pct
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
    GROUP BY m.item_code, m.item_description
    HAVING SUM(m.sales_revenue) > 0
    ORDER BY profit DESC
    LIMIT 5
  `, [creditorCode, startMonth, endMonth]);
  const topItems = topItemsResult.rows as SupplierTopItemRow[];

  // Overall KPIs
  const overallResult = await pool.query(`
    SELECT
      ROUND(SUM(m.purchase_total)::numeric, 2)::float AS total_purchase_cost,
      ROUND(SUM(m.sales_revenue)::numeric, 2)::float AS attributed_revenue,
      ROUND((SUM(m.sales_revenue) - SUM(m.purchase_total))::numeric, 2)::float AS attributed_profit,
      ROUND(
        ((SUM(m.sales_revenue) - SUM(m.purchase_total))
        / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
      )::float AS avg_margin
    FROM pc_supplier_margin m
    WHERE m.creditor_code = $1
      AND m.month BETWEEN $2 AND $3
  `, [creditorCode, startMonth, endMonth]);

  const overallRow = overallResult.rows[0] as {
    total_purchase_cost: number;
    attributed_revenue: number;
    attributed_profit: number;
    avg_margin: number;
  } | undefined;

  return {
    margin_trend: trendRows,
    top_items: topItems,
    total_purchase_cost: overallRow?.total_purchase_cost ?? 0,
    attributed_revenue: overallRow?.attributed_revenue ?? 0,
    attributed_profit: overallRow?.attributed_profit ?? 0,
    avg_margin: overallRow?.avg_margin ?? 0,
  };
}
