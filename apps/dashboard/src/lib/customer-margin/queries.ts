import { getPool, queryRds } from '../postgres';

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export async function getDateBounds(): Promise<{ min_date: string; max_date: string }> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      MIN(month) || '-01' AS min_date,
      MAX(month) || '-01' AS max_date
    FROM pc_customer_margin
  `);
  return rows[0] as { min_date: string; max_date: string };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarginFilters {
  start: string;
  end: string;
  customers?: string[];
  types?: string[];
  agents?: string[];
  productGroups?: string[];
}

export interface KpiData {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  margin_pct: number;
  active_customers: number;
  iv_revenue: number;
  cn_revenue: number;
  return_rate_pct: number;
}

export interface TrendRow {
  period: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
}

export interface CustomerMarginRow {
  debtor_code: string;
  company_name: string | null;
  debtor_type: string | null;
  sales_agent: string | null;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
  iv_count: number;
  cn_count: number;
  return_rate_pct: number;
}

export interface CustomerMonthlyRow {
  period: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
}

export interface TypeMarginRow {
  debtor_type: string;
  customer_count: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
}

export interface ProductGroupRow {
  item_group: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
}

export interface DistributionBucket {
  bucket: string;
  count: number;
  min_val: number;
  max_val: number;
}

export interface CreditNoteImpactRow {
  debtor_code: string;
  company_name: string | null;
  iv_revenue: number;
  cn_revenue: number;
  return_rate_pct: number;
  margin_before: number;
  margin_after: number;
  margin_lost: number;
}

export interface DataQualityMetrics {
  anomalous_lines: number;
  anomalous_cost_total: number;
  missing_item_group_pct: number;
  missing_item_code_lines: number;
  invoices_no_agent: number;
  date_range: { first: string; last: string };
}

export interface ProductCustomerCell {
  debtor_code: string;
  company_name: string | null;
  item_group: string;
  revenue: number;
  cogs: number;
  margin_pct: number;
}

export interface ProductRow {
  item_code: string;
  description: string;
  product_group: string | null;
  qty_sold: number;
  revenue: number;
  cost: number;
  margin_pct: number;
}

// ─── Filter Helpers ──────────────────────────────────────────────────────────

function buildMarginFilter(
  filters: MarginFilters,
  alias = 'm',
  startIdx = 1,
): { where: string; params: unknown[]; nextIdx: number } {
  const clauses: string[] = [
    `${alias}.is_active = 'T'`,
    `${alias}.month BETWEEN $${startIdx} AND $${startIdx + 1}`,
  ];
  const params: unknown[] = [filters.start.substring(0, 7), filters.end.substring(0, 7)];
  let idx = startIdx + 2;

  if (filters.customers?.length) {
    const placeholders = filters.customers.map((_, i) => `$${idx + i}`).join(',');
    clauses.push(`${alias}.debtor_code IN (${placeholders})`);
    params.push(...filters.customers);
    idx += filters.customers.length;
  }
  if (filters.types?.length) {
    const placeholders = filters.types.map((_, i) => `$${idx + i}`).join(',');
    clauses.push(`${alias}.debtor_type IN (${placeholders})`);
    params.push(...filters.types);
    idx += filters.types.length;
  }
  if (filters.agents?.length) {
    const placeholders = filters.agents.map((_, i) => `$${idx + i}`).join(',');
    clauses.push(`${alias}.sales_agent IN (${placeholders})`);
    params.push(...filters.agents);
    idx += filters.agents.length;
  }

  return { where: clauses.join(' AND '), params, nextIdx: idx };
}

/**
 * Build filter for pc_customer_margin_by_product.
 * Customer/type/agent filters use a subquery against pc_customer_margin
 * to resolve valid debtor_codes. productGroups filter applies directly.
 */
function buildProductFilter(
  filters: MarginFilters,
  alias = 'p',
  startIdx = 1,
): { where: string; params: unknown[]; nextIdx: number } {
  const clauses: string[] = [`${alias}.month BETWEEN $${startIdx} AND $${startIdx + 1}`];
  const params: unknown[] = [filters.start.substring(0, 7), filters.end.substring(0, 7)];
  let idx = startIdx + 2;

  // Always filter to active customers; optionally add customer/type/agent filters
  const subClauses: string[] = [`is_active = 'T'`, `month BETWEEN $${1} AND $${2}`];
  if (filters.customers?.length) {
    const placeholders = filters.customers.map((_, i) => `$${idx + i}`).join(',');
    subClauses.push(`debtor_code IN (${placeholders})`);
    params.push(...filters.customers);
    idx += filters.customers.length;
  }
  if (filters.types?.length) {
    const placeholders = filters.types.map((_, i) => `$${idx + i}`).join(',');
    subClauses.push(`debtor_type IN (${placeholders})`);
    params.push(...filters.types);
    idx += filters.types.length;
  }
  if (filters.agents?.length) {
    const placeholders = filters.agents.map((_, i) => `$${idx + i}`).join(',');
    subClauses.push(`sales_agent IN (${placeholders})`);
    params.push(...filters.agents);
    idx += filters.agents.length;
  }
  clauses.push(`${alias}.debtor_code IN (SELECT DISTINCT debtor_code FROM pc_customer_margin WHERE ${subClauses.join(' AND ')})`);

  if (filters.productGroups?.length) {
    const placeholders = filters.productGroups.map((_, i) => `$${idx + i}`).join(',');
    clauses.push(`${alias}.item_group IN (${placeholders})`);
    params.push(...filters.productGroups);
    idx += filters.productGroups.length;
  }

  return { where: clauses.join(' AND '), params, nextIdx: idx };
}

// ─── 1. KPI Summary ─────────────────────────────────────────────────────────

export async function getMarginKpi(filters: MarginFilters): Promise<KpiData> {
  const pool = getPool();
  const { where, params } = buildMarginFilter(filters, 'm');

  const row = (await pool.query(`
    SELECT
      COALESCE(SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue), 0)::float AS total_revenue,
      COALESCE(SUM(m.iv_cost + m.dn_cost - m.cn_cost), 0)::float AS total_cogs,
      COALESCE(SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
             - SUM(m.iv_cost + m.dn_cost - m.cn_cost), 0)::float AS gross_profit,
      CASE WHEN SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) > 0
           THEN ROUND(((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
                       - SUM(m.iv_cost + m.dn_cost - m.cn_cost))
                      / SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct,
      COUNT(DISTINCT m.debtor_code)::int AS active_customers,
      COALESCE(SUM(m.iv_revenue), 0)::float AS iv_revenue,
      COALESCE(SUM(m.cn_revenue), 0)::float AS cn_revenue,
      CASE WHEN SUM(m.iv_revenue) > 0
           THEN ROUND((SUM(m.cn_revenue) / SUM(m.iv_revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS return_rate_pct
    FROM pc_customer_margin m
    WHERE ${where}
  `, params)).rows[0] as KpiData;

  return row;
}

// ─── 2. Margin Trend ─────────────────────────────────────────────────────────

export async function getMarginTrend(filters: MarginFilters): Promise<TrendRow[]> {
  const pool = getPool();
  const { where, params } = buildMarginFilter(filters, 'm');

  return (await pool.query(`
    SELECT
      m.month AS period,
      ROUND(SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.iv_cost + m.dn_cost - m.cn_cost)::numeric, 2)::float AS cogs,
      ROUND((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
           - SUM(m.iv_cost + m.dn_cost - m.cn_cost))::numeric, 2)::float AS gross_profit,
      CASE WHEN SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) > 0
           THEN ROUND(((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
                       - SUM(m.iv_cost + m.dn_cost - m.cn_cost))
                      / SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct
    FROM pc_customer_margin m
    WHERE ${where}
    GROUP BY m.month
    ORDER BY m.month
  `, params)).rows as TrendRow[];
}

// ─── 3. Customer Margins (paginated) ─────────────────────────────────────────

export async function getCustomerMargins(
  filters: MarginFilters,
  sort: string = 'gross_profit',
  order: string = 'desc',
  page: number = 1,
  limit: number = 50
): Promise<{ rows: CustomerMarginRow[]; total: number }> {
  const pool = getPool();
  const { where, params, nextIdx } = buildMarginFilter(filters, 'm');

  const allowedSorts = ['revenue', 'cogs', 'gross_profit', 'margin_pct', 'iv_count', 'cn_count', 'return_rate_pct', 'company_name'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'gross_profit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const baseQuery = `
    FROM (
      SELECT
        m.debtor_code,
        MAX(m.company_name) AS company_name,
        COALESCE(MAX(m.debtor_type), 'Unassigned') AS debtor_type,
        MAX(m.sales_agent) AS sales_agent,
        ROUND(SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)::numeric, 2)::float AS revenue,
        ROUND(SUM(m.iv_cost + m.dn_cost - m.cn_cost)::numeric, 2)::float AS cogs,
        SUM(m.iv_count)::int AS iv_count,
        SUM(m.cn_count)::int AS cn_count,
        COALESCE(SUM(m.iv_revenue), 0)::float AS iv_rev,
        COALESCE(SUM(m.cn_revenue), 0)::float AS cn_rev
      FROM pc_customer_margin m
      WHERE ${where}
      GROUP BY m.debtor_code
    ) c
  `;

  const totalResult = (await pool.query(`SELECT COUNT(*) AS cnt ${baseQuery}`, params)).rows[0] as { cnt: number };
  const total = Number(totalResult.cnt);

  const rows = (await pool.query(`
    SELECT
      c.debtor_code,
      c.company_name,
      c.debtor_type,
      c.sales_agent,
      c.revenue,
      c.cogs,
      ROUND((c.revenue - c.cogs)::numeric, 2)::float AS gross_profit,
      CASE WHEN c.revenue > 0
           THEN ROUND(((c.revenue - c.cogs) / c.revenue * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct,
      c.iv_count,
      c.cn_count,
      CASE WHEN c.iv_rev > 0
           THEN ROUND((c.cn_rev / c.iv_rev * 100)::numeric, 2)::float
           ELSE 0 END AS return_rate_pct
    ${baseQuery}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
  `, [...params, limit, offset])).rows as CustomerMarginRow[];

  return { rows, total };
}

// ─── 4. Customer Monthly Breakdown ───────────────────────────────────────────

export async function getCustomerMonthly(code: string, start: string, end: string): Promise<CustomerMonthlyRow[]> {
  const pool = getPool();
  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  return (await pool.query(`
    SELECT
      m.month AS period,
      ROUND(SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.iv_cost + m.dn_cost - m.cn_cost)::numeric, 2)::float AS cogs,
      ROUND((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
           - SUM(m.iv_cost + m.dn_cost - m.cn_cost))::numeric, 2)::float AS gross_profit,
      CASE WHEN SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) > 0
           THEN ROUND(((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
                       - SUM(m.iv_cost + m.dn_cost - m.cn_cost))
                      / SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct
    FROM pc_customer_margin m
    WHERE m.debtor_code = $1
      AND m.month BETWEEN $2 AND $3
    GROUP BY m.month
    ORDER BY m.month
  `, [code, startMonth, endMonth])).rows as CustomerMonthlyRow[];
}

// ─── 4b. Customer Product Breakdown (RDS drill-down) ────────────────────────

export async function getCustomerProducts(
  code: string, start: string, end: string,
  page = 1, limit = 25,
): Promise<{ rows: ProductRow[]; total: number }> {
  const offset = (page - 1) * limit;

  const countResult = await queryRds<{ total: number }>(`
    WITH lines AS (
      SELECT dtl."ItemCode" AS item_code
      FROM dbo."IVDTL" dtl
      JOIN dbo."IV" h ON h."DocKey" = dtl."DocKey"
      WHERE h."Cancelled" = 'F'
        AND h."DebtorCode" = $1
        AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date
      UNION ALL
      SELECT dtl."ItemCode" AS item_code
      FROM dbo."DNDTL" dtl
      JOIN dbo."DN" h ON h."DocKey" = dtl."DocKey"
      WHERE (h."Cancelled" = 'F' OR h."Cancelled" IS NULL)
        AND h."DebtorCode" = $1
        AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date
      UNION ALL
      SELECT dtl."ItemCode" AS item_code
      FROM dbo."CNDTL" dtl
      JOIN dbo."CN" h ON h."DocKey" = dtl."DocKey"
      WHERE h."Cancelled" = 'F'
        AND h."DebtorCode" = $1
        AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date
    )
    SELECT COUNT(DISTINCT item_code)::integer AS total FROM lines
  `, [code, start, end]);

  const total = countResult[0]?.total ?? 0;

  const rows = await queryRds<{
    item_code: string;
    description: string;
    product_group: string | null;
    qty_sold: number;
    revenue: number;
    cost: number;
  }>(`
    WITH lines AS (
      SELECT
        dtl."ItemCode" AS item_code,
        dtl."Description" AS description,
        dtl."Qty" AS qty,
        dtl."LocalSubTotal" AS revenue,
        CASE WHEN dtl."LocalTotalCost" >= 0 THEN dtl."LocalTotalCost" ELSE 0 END AS cost
      FROM dbo."IVDTL" dtl
      JOIN dbo."IV" h ON h."DocKey" = dtl."DocKey"
      WHERE h."Cancelled" = 'F'
        AND h."DebtorCode" = $1
        AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date

      UNION ALL

      SELECT
        dtl."ItemCode" AS item_code,
        dtl."Description" AS description,
        dtl."Qty" AS qty,
        dtl."LocalSubTotal" AS revenue,
        CASE WHEN dtl."LocalTotalCost" >= 0 THEN dtl."LocalTotalCost" ELSE 0 END AS cost
      FROM dbo."DNDTL" dtl
      JOIN dbo."DN" h ON h."DocKey" = dtl."DocKey"
      WHERE (h."Cancelled" = 'F' OR h."Cancelled" IS NULL)
        AND h."DebtorCode" = $1
        AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date

      UNION ALL

      SELECT
        dtl."ItemCode" AS item_code,
        dtl."Description" AS description,
        -dtl."Qty" AS qty,
        -dtl."LocalSubTotal" AS revenue,
        -(dtl."Qty" * COALESCE(dtl."UnitCost", 0)) AS cost
      FROM dbo."CNDTL" dtl
      JOIN dbo."CN" h ON h."DocKey" = dtl."DocKey"
      WHERE h."Cancelled" = 'F'
        AND h."DebtorCode" = $1
        AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $2::date AND $3::date
    )
    SELECT
      l.item_code,
      MIN(l.description) AS description,
      MIN(i."ItemGroup") AS product_group,
      SUM(l.qty)::integer AS qty_sold,
      ROUND(SUM(l.revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(l.cost)::numeric, 2)::float AS cost
    FROM lines l
    LEFT JOIN dbo."Item" i ON i."ItemCode" = l.item_code
    GROUP BY l.item_code
    ORDER BY revenue DESC
    LIMIT $4 OFFSET $5
  `, [code, start, end, limit, offset]);

  return {
    total,
    rows: rows.map(r => ({
      ...r,
      margin_pct: r.revenue !== 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 10000) / 100 : 0,
    })),
  };
}

// ─── 5. Margin by Customer Type ──────────────────────────────────────────────

export async function getMarginByType(filters: MarginFilters): Promise<TypeMarginRow[]> {
  const pool = getPool();
  const { where, params } = buildMarginFilter(filters, 'm');

  return (await pool.query(`
    SELECT
      COALESCE(m.debtor_type, 'Unassigned') AS debtor_type,
      COUNT(DISTINCT m.debtor_code)::int AS customer_count,
      ROUND(SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(m.iv_cost + m.dn_cost - m.cn_cost)::numeric, 2)::float AS cogs,
      ROUND((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
           - SUM(m.iv_cost + m.dn_cost - m.cn_cost))::numeric, 2)::float AS gross_profit,
      CASE WHEN SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) > 0
           THEN ROUND(((SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
                       - SUM(m.iv_cost + m.dn_cost - m.cn_cost))
                      / SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct
    FROM pc_customer_margin m
    WHERE ${where}
    GROUP BY COALESCE(m.debtor_type, 'Unassigned')
    ORDER BY revenue DESC
  `, params)).rows as TypeMarginRow[];
}

// ─── 6. Margin by Product Group ─────────────────────────────────────────────

export async function getMarginByProductGroup(filters: MarginFilters): Promise<ProductGroupRow[]> {
  const pool = getPool();
  const { where, params } = buildProductFilter(filters, 'p');

  return (await pool.query(`
    SELECT
      p.item_group,
      ROUND(SUM(p.revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(p.cogs)::numeric, 2)::float AS cogs,
      ROUND((SUM(p.revenue) - SUM(p.cogs))::numeric, 2)::float AS gross_profit,
      CASE WHEN SUM(p.revenue) > 0
           THEN ROUND(((SUM(p.revenue) - SUM(p.cogs)) / SUM(p.revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct
    FROM pc_customer_margin_by_product p
    WHERE ${where}
    GROUP BY p.item_group
    ORDER BY revenue DESC
  `, params)).rows as ProductGroupRow[];
}

// ─── 7. Product x Customer Matrix ────────────────────────────────────────────

export async function getProductCustomerMatrix(filters: MarginFilters): Promise<ProductCustomerCell[]> {
  const pool = getPool();
  const { where, params } = buildProductFilter(filters, 'p');

  return (await pool.query(`
    SELECT
      p.debtor_code,
      c.companyname AS company_name,
      p.item_group,
      ROUND(SUM(p.revenue)::numeric, 2)::float AS revenue,
      ROUND(SUM(p.cogs)::numeric, 2)::float AS cogs,
      CASE WHEN SUM(p.revenue) > 0
           THEN ROUND(((SUM(p.revenue) - SUM(p.cogs)) / SUM(p.revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_pct
    FROM pc_customer_margin_by_product p
    LEFT JOIN customer c ON p.debtor_code = c.debtorcode
    WHERE ${where}
    GROUP BY p.debtor_code, p.item_group, c.companyname
    ORDER BY revenue DESC
    LIMIT 500
  `, params)).rows as ProductCustomerCell[];
}

// ─── 8. Credit Note Impact ───────────────────────────────────────────────────

export async function getCreditNoteImpact(filters: MarginFilters): Promise<CreditNoteImpactRow[]> {
  const pool = getPool();
  const { where, params } = buildMarginFilter(filters, 'm');

  return (await pool.query(`
    SELECT
      c.debtor_code,
      c.company_name,
      c.iv_revenue,
      c.cn_revenue,
      CASE WHEN c.iv_revenue > 0 THEN ROUND((c.cn_revenue / c.iv_revenue * 100)::numeric, 2)::float ELSE 0 END AS return_rate_pct,
      CASE WHEN c.iv_revenue > 0
           THEN ROUND(((c.iv_revenue - c.iv_cost) / c.iv_revenue * 100)::numeric, 2)::float ELSE 0 END AS margin_before,
      CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
           THEN ROUND((((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost)) / (c.iv_revenue - c.cn_revenue) * 100)::numeric, 2)::float
           ELSE 0 END AS margin_after,
      CASE WHEN c.iv_revenue > 0
           THEN ROUND(
             ((c.iv_revenue - c.iv_cost) / c.iv_revenue * 100
             - CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
                    THEN ((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost)) / (c.iv_revenue - c.cn_revenue) * 100
                    ELSE 0 END)::numeric, 2)::float
           ELSE 0 END AS margin_lost
    FROM (
      SELECT
        m.debtor_code,
        MAX(m.company_name) AS company_name,
        COALESCE(SUM(m.iv_revenue), 0)::float AS iv_revenue,
        COALESCE(SUM(m.iv_cost), 0)::float AS iv_cost,
        COALESCE(SUM(m.cn_revenue), 0)::float AS cn_revenue,
        COALESCE(SUM(m.cn_cost), 0)::float AS cn_cost
      FROM pc_customer_margin m
      WHERE ${where}
      GROUP BY m.debtor_code
    ) c
    WHERE c.cn_revenue > 0
    ORDER BY return_rate_pct DESC
    LIMIT 100
  `, params)).rows as CreditNoteImpactRow[];
}

// ─── 9. Margin Distribution ─────────────────────────────────────────────────

export async function getMarginDistribution(filters: MarginFilters): Promise<DistributionBucket[]> {
  const pool = getPool();
  const { where, params } = buildMarginFilter(filters, 'm');

  return (await pool.query(`
    SELECT
      CASE
        WHEN margin_pct < 0 THEN '< 0%'
        WHEN margin_pct < 5 THEN '0-5%'
        WHEN margin_pct < 10 THEN '5-10%'
        WHEN margin_pct < 15 THEN '10-15%'
        WHEN margin_pct < 20 THEN '15-20%'
        WHEN margin_pct < 30 THEN '20-30%'
        ELSE '30%+'
      END AS bucket,
      COUNT(*) AS count,
      CASE
        WHEN margin_pct < 0 THEN -999
        WHEN margin_pct < 5 THEN 0
        WHEN margin_pct < 10 THEN 5
        WHEN margin_pct < 15 THEN 10
        WHEN margin_pct < 20 THEN 15
        WHEN margin_pct < 30 THEN 20
        ELSE 30
      END AS min_val,
      CASE
        WHEN margin_pct < 0 THEN 0
        WHEN margin_pct < 5 THEN 5
        WHEN margin_pct < 10 THEN 10
        WHEN margin_pct < 15 THEN 15
        WHEN margin_pct < 20 THEN 20
        WHEN margin_pct < 30 THEN 30
        ELSE 100
      END AS max_val
    FROM (
      SELECT
        m.debtor_code,
        CASE WHEN SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) > 0
             THEN (SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
                 - SUM(m.iv_cost + m.dn_cost - m.cn_cost))
                / SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) * 100
             ELSE -999 END AS margin_pct
      FROM pc_customer_margin m
      WHERE ${where}
      GROUP BY m.debtor_code
      HAVING SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) > 1000
    ) t2
    GROUP BY bucket, min_val, max_val
    ORDER BY min_val
  `, params)).rows as DistributionBucket[];
}

// ─── 10-13. Filter Lookups ──────────────────────────────────────────────────

export async function getFilterCustomers(): Promise<{ code: string; name: string | null }[]> {
  const pool = getPool();
  return (await pool.query(`
    SELECT d.debtorcode AS code, d.companyname AS name
    FROM customer d
    WHERE d.isactive = 'T'
      AND EXISTS (SELECT 1 FROM pc_customer_margin m WHERE m.debtor_code = d.debtorcode)
    ORDER BY d.companyname
  `)).rows as { code: string; name: string | null }[];
}

export async function getFilterTypes(): Promise<string[]> {
  const pool = getPool();
  return (await pool.query(`
    SELECT DISTINCT COALESCE(debtortype, 'Unassigned') AS t
    FROM customer
    WHERE isactive = 'T'
    ORDER BY t
  `)).rows.map((r: { t: string }) => r.t);
}

export async function getFilterAgents(): Promise<{ agent: string; description: string | null; is_active: string }[]> {
  const pool = getPool();
  return (await pool.query(`
    SELECT salesagent AS agent, description AS description, isactive AS is_active
    FROM sales_agent
    ORDER BY salesagent
  `)).rows as { agent: string; description: string | null; is_active: string }[];
}

export async function getFilterProductGroups(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT itemgroup AS g, description AS d FROM product_group ORDER BY g
  `);
  const groups = (result.rows as { g: string; d: string | null }[]).map(r => r.g);
  groups.push('Unclassified');
  return groups;
}

// ─── 14. Data Quality (RDS drill-down) ──────────────────────────────────────

export async function getDataQuality(start: string, end: string): Promise<DataQualityMetrics> {
  const anomalous = (await queryRds<{ cnt: number; excess: number }>(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(dtl."LocalTotalCost" - dtl."LocalSubTotal" * 5), 0)::float AS excess
    FROM dbo."IVDTL" dtl
    JOIN dbo."IV" h ON h."DocKey" = dtl."DocKey"
    WHERE h."Cancelled" = 'F'
      AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $1::date AND $2::date
      AND dtl."LocalTotalCost" > dtl."LocalSubTotal" * 5
      AND dtl."LocalSubTotal" > 0
  `, [start, end]))[0] ?? { cnt: 0, excess: 0 };

  const missingGroup = (await queryRds<{ pct: number }>(`
    SELECT
      ROUND((SUM(CASE WHEN i."ItemGroup" IS NULL OR i."ItemGroup" = '' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1)::float AS pct
    FROM dbo."IVDTL" dtl
    JOIN dbo."IV" h ON h."DocKey" = dtl."DocKey"
    LEFT JOIN dbo."Item" i ON i."ItemCode" = dtl."ItemCode"
    WHERE h."Cancelled" = 'F' AND dtl."ItemCode" IS NOT NULL AND dtl."ItemCode" != ''
      AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $1::date AND $2::date
  `, [start, end]))[0] ?? { pct: 0 };

  const missingCode = (await queryRds<{ cnt: number }>(`
    SELECT COUNT(*) AS cnt
    FROM dbo."IVDTL" dtl
    JOIN dbo."IV" h ON h."DocKey" = dtl."DocKey"
    WHERE h."Cancelled" = 'F'
      AND (dtl."ItemCode" IS NULL OR dtl."ItemCode" = '')
      AND (h."DocDate" + INTERVAL '8 hours')::date BETWEEN $1::date AND $2::date
  `, [start, end]))[0] ?? { cnt: 0 };

  const noAgent = (await queryRds<{ cnt: number }>(`
    SELECT COUNT(*) AS cnt FROM dbo."IV"
    WHERE "Cancelled" = 'F' AND ("SalesAgent" IS NULL OR "SalesAgent" = '')
      AND ("DocDate" + INTERVAL '8 hours')::date BETWEEN $1::date AND $2::date
  `, [start, end]))[0] ?? { cnt: 0 };

  const dateRange = (await queryRds<{ first_date: string; last_date: string }>(`
    SELECT
      MIN(("DocDate" + INTERVAL '8 hours')::date)::text AS first_date,
      MAX(("DocDate" + INTERVAL '8 hours')::date)::text AS last_date
    FROM dbo."IV" WHERE "Cancelled" = 'F'
  `))[0] ?? { first_date: '', last_date: '' };

  return {
    anomalous_lines: Number(anomalous.cnt),
    anomalous_cost_total: Math.round(Number(anomalous.excess)),
    missing_item_group_pct: Number(missingGroup.pct),
    missing_item_code_lines: Number(missingCode.cnt),
    invoices_no_agent: Number(noAgent.cnt),
    date_range: { first: dateRange.first_date, last: dateRange.last_date },
  };
}
