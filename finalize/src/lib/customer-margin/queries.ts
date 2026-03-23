import { getDb } from './db';

// ─── Date Bounds ─────────────────────────────────────────────────────────────

export function getDateBounds() {
  const db = getDb();
  return db.prepare(`
    SELECT
      MIN(DATE(DocDate, '+8 hours')) AS min_date,
      MAX(DATE(DocDate, '+8 hours')) AS max_date
    FROM (
      SELECT DocDate FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT DocDate FROM dn WHERE Cancelled='F' OR Cancelled IS NULL
      UNION ALL
      SELECT DocDate FROM cn WHERE Cancelled='F'
    )
  `).get() as { min_date: string; max_date: string };
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

// ─── Filter Helpers ──────────────────────────────────────────────────────────

function buildHeaderFilterWhere(filters: MarginFilters, prefix = ''): { where: string; params: unknown[] } {
  const p = prefix ? `${prefix}.` : '';
  const clauses: string[] = [`DATE(${p}DocDate, '+8 hours') BETWEEN ? AND ?`];
  const params: unknown[] = [filters.start, filters.end];

  if (filters.customers?.length) {
    clauses.push(`${p}DebtorCode IN (${filters.customers.map(() => '?').join(',')})`);
    params.push(...filters.customers);
  }

  return { where: clauses.join(' AND '), params };
}

function addDebtorFilters(filters: MarginFilters, params: unknown[]): string {
  const clauses: string[] = [];
  if (filters.types?.length) {
    clauses.push(`d.DebtorType IN (${filters.types.map(() => '?').join(',')})`);
    params.push(...filters.types);
  }
  if (filters.agents?.length) {
    clauses.push(`d.SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
    params.push(...filters.agents);
  }
  return clauses.length ? ' AND ' + clauses.join(' AND ') : '';
}

// ─── 1. KPI Summary ─────────────────────────────────────────────────────────

export function getMarginKpi(filters: MarginFilters): KpiData {
  const db = getDb();
  const { where: hWhere, params: hParams } = buildHeaderFilterWhere(filters, 'h');

  // Build combined query with optional debtor type/agent filters
  const debtorJoin = (filters.types?.length || filters.agents?.length)
    ? 'JOIN debtor d ON combined.debtor_code = d.DebtorCode' : '';
  const debtorFilter = (filters.types?.length || filters.agents?.length)
    ? (() => { const p: unknown[] = []; const s = addDebtorFilters(filters, p); return { sql: s, params: p }; })()
    : { sql: '', params: [] };

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(net_revenue), 0) AS total_revenue,
      COALESCE(SUM(net_cogs), 0) AS total_cogs,
      COALESCE(SUM(net_revenue) - SUM(net_cogs), 0) AS gross_profit,
      CASE WHEN SUM(net_revenue) > 0
           THEN ROUND((SUM(net_revenue) - SUM(net_cogs)) / SUM(net_revenue) * 100, 2)
           ELSE 0 END AS margin_pct,
      COUNT(DISTINCT debtor_code) AS active_customers,
      COALESCE(SUM(iv_rev), 0) AS iv_revenue,
      COALESCE(SUM(cn_rev), 0) AS cn_revenue,
      CASE WHEN SUM(iv_rev) > 0
           THEN ROUND(SUM(cn_rev) / SUM(iv_rev) * 100, 2)
           ELSE 0 END AS return_rate_pct
    FROM (
      SELECT
        debtor_code,
        SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END) AS net_revenue,
        SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END) AS net_cogs,
        SUM(CASE WHEN src = 'IV' THEN revenue ELSE 0 END) AS iv_rev,
        SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END) AS cn_rev
      FROM (
        SELECT 'IV' AS src, h.DebtorCode AS debtor_code, h.LocalNetTotal AS revenue,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost,
               h.DocDate
        FROM iv h WHERE h.Cancelled='F' AND ${hWhere}
        UNION ALL
        SELECT 'DN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM dndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM dn h WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND ${hWhere}
        UNION ALL
        SELECT 'CN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM cn h WHERE h.Cancelled='F' AND ${hWhere}
      )
      GROUP BY debtor_code
    ) combined
    ${debtorJoin}
    WHERE 1=1 ${debtorFilter.sql}
  `).get(...hParams, ...hParams, ...hParams, ...debtorFilter.params) as KpiData;

  return row;
}

// ─── 2. Margin Trend ─────────────────────────────────────────────────────────

export function getMarginTrend(filters: MarginFilters): TrendRow[] {
  const db = getDb();
  const { where, params } = buildHeaderFilterWhere(filters, 'h');

  // For type/agent filters we need a subquery approach
  let customerFilter = '';
  const extraParams: unknown[] = [];
  if (filters.types?.length || filters.agents?.length) {
    const clauses: string[] = [];
    if (filters.types?.length) {
      clauses.push(`DebtorType IN (${filters.types.map(() => '?').join(',')})`);
      extraParams.push(...filters.types);
    }
    if (filters.agents?.length) {
      clauses.push(`SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
      extraParams.push(...filters.agents);
    }
    customerFilter = `AND debtor_code IN (SELECT DebtorCode FROM debtor WHERE ${clauses.join(' AND ')})`;
  }

  const rows = db.prepare(`
    SELECT
      period,
      ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END), 2) AS revenue,
      ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END), 2) AS cogs,
      ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
          + SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END), 2) AS gross_profit,
      CASE WHEN (SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)) > 0
           THEN ROUND(
             (SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
              - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)
              - SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
              + SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END))
             / (SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)) * 100, 2)
           ELSE 0 END AS margin_pct
    FROM (
      SELECT 'IV' AS src, h.DebtorCode AS debtor_code,
             strftime('%Y-%m', h.DocDate, '+8 hours') AS period,
             h.LocalNetTotal AS revenue,
             COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost
      FROM iv h WHERE h.Cancelled='F' AND ${where}
      UNION ALL
      SELECT 'DN', h.DebtorCode, strftime('%Y-%m', h.DocDate, '+8 hours'),
             h.LocalNetTotal,
             COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM dndtl d WHERE d.DocKey = h.DocKey), 0)
      FROM dn h WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND ${where}
      UNION ALL
      SELECT 'CN', h.DebtorCode, strftime('%Y-%m', h.DocDate, '+8 hours'),
             h.LocalNetTotal,
             COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0)
      FROM cn h WHERE h.Cancelled='F' AND ${where}
    )
    WHERE 1=1 ${customerFilter}
    GROUP BY period
    ORDER BY period
  `).all(...params, ...params, ...params, ...extraParams) as TrendRow[];

  return rows;
}

// ─── 3. Customer Margins (paginated) ─────────────────────────────────────────

export function getCustomerMargins(
  filters: MarginFilters,
  sort: string = 'gross_profit',
  order: string = 'desc',
  page: number = 1,
  limit: number = 50
): { rows: CustomerMarginRow[]; total: number } {
  const db = getDb();
  const { where, params } = buildHeaderFilterWhere(filters, 'h');

  const extraParams: unknown[] = [];
  let debtorFilter = '';
  if (filters.types?.length || filters.agents?.length) {
    const clauses: string[] = [];
    if (filters.types?.length) {
      clauses.push(`d.DebtorType IN (${filters.types.map(() => '?').join(',')})`);
      extraParams.push(...filters.types);
    }
    if (filters.agents?.length) {
      clauses.push(`d.SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
      extraParams.push(...filters.agents);
    }
    debtorFilter = ' AND ' + clauses.join(' AND ');
  }

  const allowedSorts = ['revenue', 'cogs', 'gross_profit', 'margin_pct', 'iv_count', 'cn_count', 'return_rate_pct', 'company_name'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'gross_profit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const baseQuery = `
    FROM (
      SELECT
        debtor_code,
        ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
            - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END), 2) AS revenue,
        ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
            - SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END), 2) AS cogs,
        SUM(CASE WHEN src = 'IV' THEN 1 ELSE 0 END) AS iv_count,
        SUM(CASE WHEN src = 'CN' THEN 1 ELSE 0 END) AS cn_count,
        COALESCE(SUM(CASE WHEN src = 'IV' THEN revenue ELSE 0 END), 0) AS iv_rev,
        COALESCE(SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END), 0) AS cn_rev
      FROM (
        SELECT 'IV' AS src, h.DebtorCode AS debtor_code, h.LocalNetTotal AS revenue,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost,
               h.DocDate
        FROM iv h WHERE h.Cancelled='F' AND ${where}
        UNION ALL
        SELECT 'DN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM dndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM dn h WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND ${where}
        UNION ALL
        SELECT 'CN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM cn h WHERE h.Cancelled='F' AND ${where}
      )
      GROUP BY debtor_code
    ) c
    LEFT JOIN debtor d ON c.debtor_code = d.DebtorCode
    WHERE 1=1 ${debtorFilter}
  `;

  const allParams = [...params, ...params, ...params, ...extraParams];

  const total = (db.prepare(`SELECT COUNT(*) as cnt ${baseQuery}`).get(...allParams) as { cnt: number }).cnt;

  const rows = db.prepare(`
    SELECT
      c.debtor_code,
      d.CompanyName AS company_name,
      COALESCE(d.DebtorType, 'Unassigned') AS debtor_type,
      d.SalesAgent AS sales_agent,
      c.revenue,
      c.cogs,
      ROUND(c.revenue - c.cogs, 2) AS gross_profit,
      CASE WHEN c.revenue > 0
           THEN ROUND((c.revenue - c.cogs) / c.revenue * 100, 2)
           ELSE 0 END AS margin_pct,
      c.iv_count,
      c.cn_count,
      CASE WHEN c.iv_rev > 0
           THEN ROUND(c.cn_rev / c.iv_rev * 100, 2)
           ELSE 0 END AS return_rate_pct
    ${baseQuery}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...allParams, limit, offset) as CustomerMarginRow[];

  return { rows, total };
}

// ─── 4. Customer Monthly Breakdown ───────────────────────────────────────────

export function getCustomerMonthly(code: string, start: string, end: string): CustomerMonthlyRow[] {
  const db = getDb();

  return db.prepare(`
    SELECT
      period,
      ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END), 2) AS revenue,
      ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END), 2) AS cogs,
      ROUND(SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
          + SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END), 2) AS gross_profit,
      CASE WHEN (SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)) > 0
           THEN ROUND(
             (SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
              - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)
              - SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
              + SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END))
             / (SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END)) * 100, 2)
           ELSE 0 END AS margin_pct
    FROM (
      SELECT 'IV' AS src, strftime('%Y-%m', h.DocDate, '+8 hours') AS period,
             h.LocalNetTotal AS revenue,
             COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost
      FROM iv h WHERE h.Cancelled='F' AND h.DebtorCode = ?
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
      UNION ALL
      SELECT 'DN', strftime('%Y-%m', h.DocDate, '+8 hours'),
             h.LocalNetTotal,
             COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM dndtl d WHERE d.DocKey = h.DocKey), 0)
      FROM dn h WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND h.DebtorCode = ?
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
      UNION ALL
      SELECT 'CN', strftime('%Y-%m', h.DocDate, '+8 hours'),
             h.LocalNetTotal,
             COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0)
      FROM cn h WHERE h.Cancelled='F' AND h.DebtorCode = ?
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
    )
    GROUP BY period
    ORDER BY period
  `).all(code, start, end, code, start, end, code, start, end) as CustomerMonthlyRow[];
}

// ─── 4b. Customer Product Breakdown ─────────────────────────────────────────

export interface ProductRow {
  item_code: string;
  description: string;
  product_group: string | null;
  qty_sold: number;
  revenue: number;
  cost: number;
  margin_pct: number;
}

export function getCustomerProducts(code: string, start: string, end: string): ProductRow[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      dtl.ItemCode AS item_code,
      dtl.Description AS description,
      i.ItemGroup AS product_group,
      SUM(dtl.Qty) AS qty_sold,
      ROUND(SUM(dtl.LocalSubTotal), 2) AS revenue,
      ROUND(SUM(COALESCE(dtl.LocalTotalCost, 0)), 2) AS cost
    FROM ivdtl dtl
    JOIN iv ON iv.DocKey = dtl.DocKey
    LEFT JOIN item i ON i.ItemCode = dtl.ItemCode
    WHERE iv.Cancelled = 'F'
      AND iv.DebtorCode = ?
      AND DATE(datetime(iv.DocDate, '+8 hours')) BETWEEN ? AND ?
    GROUP BY dtl.ItemCode
    ORDER BY revenue DESC
    LIMIT 50
  `).all(code, start, end) as { item_code: string; description: string; product_group: string | null; qty_sold: number; revenue: number; cost: number }[];

  return rows.map(r => ({
    ...r,
    margin_pct: r.revenue !== 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 10000) / 100 : 0,
  }));
}

// ─── 5. Margin by Customer Type ──────────────────────────────────────────────

export function getMarginByType(filters: MarginFilters): TypeMarginRow[] {
  const db = getDb();
  const { where, params } = buildHeaderFilterWhere(filters, 'h');

  return db.prepare(`
    SELECT
      COALESCE(d.DebtorType, 'Unassigned') AS debtor_type,
      COUNT(DISTINCT c.debtor_code) AS customer_count,
      ROUND(SUM(c.net_revenue), 2) AS revenue,
      ROUND(SUM(c.net_cogs), 2) AS cogs,
      ROUND(SUM(c.net_revenue) - SUM(c.net_cogs), 2) AS gross_profit,
      CASE WHEN SUM(c.net_revenue) > 0
           THEN ROUND((SUM(c.net_revenue) - SUM(c.net_cogs)) / SUM(c.net_revenue) * 100, 2)
           ELSE 0 END AS margin_pct
    FROM (
      SELECT
        debtor_code,
        SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END) AS net_revenue,
        SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END) AS net_cogs
      FROM (
        SELECT 'IV' AS src, h.DebtorCode AS debtor_code, h.LocalNetTotal AS revenue,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost,
               h.DocDate
        FROM iv h WHERE h.Cancelled='F' AND ${where}
        UNION ALL
        SELECT 'DN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM dndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM dn h WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND ${where}
        UNION ALL
        SELECT 'CN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM cn h WHERE h.Cancelled='F' AND ${where}
      )
      GROUP BY debtor_code
    ) c
    LEFT JOIN debtor d ON c.debtor_code = d.DebtorCode
    GROUP BY COALESCE(d.DebtorType, 'Unassigned')
    ORDER BY revenue DESC
  `).all(...params, ...params, ...params) as TypeMarginRow[];
}

// ─── 6. Margin by Product Group (detail-level with anomaly cap) ──────────────

export function getMarginByProductGroup(filters: MarginFilters): ProductGroupRow[] {
  const db = getDb();
  const { where, params } = buildHeaderFilterWhere(filters);

  const customerSubquery = (filters.types?.length || filters.agents?.length)
    ? (() => {
        const clauses: string[] = [];
        const p: unknown[] = [];
        if (filters.types?.length) {
          clauses.push(`DebtorType IN (${filters.types.map(() => '?').join(',')})`);
          p.push(...filters.types);
        }
        if (filters.agents?.length) {
          clauses.push(`SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
          p.push(...filters.agents);
        }
        return { sql: `AND h.DebtorCode IN (SELECT DebtorCode FROM debtor WHERE ${clauses.join(' AND ')})`, params: p };
      })()
    : { sql: '', params: [] };

  let pgFilter = '';
  const pgParams: unknown[] = [];
  if (filters.productGroups?.length) {
    pgFilter = `AND item_group IN (${filters.productGroups.map(() => '?').join(',')})`;
    pgParams.push(...filters.productGroups);
  }

  return db.prepare(`
    SELECT
      item_group,
      ROUND(SUM(CASE WHEN src = 'IV' THEN line_rev ELSE 0 END)
          + SUM(CASE WHEN src = 'DN' THEN line_rev ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END), 2) AS revenue,
      ROUND(SUM(CASE WHEN src = 'IV' THEN line_cost ELSE 0 END)
          + SUM(CASE WHEN src = 'DN' THEN line_cost ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN line_cost ELSE 0 END), 2) AS cogs,
      ROUND(
        (SUM(CASE WHEN src IN ('IV','DN') THEN line_rev ELSE 0 END)
         - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END))
        - (SUM(CASE WHEN src IN ('IV','DN') THEN line_cost ELSE 0 END)
           - SUM(CASE WHEN src = 'CN' THEN line_cost ELSE 0 END)), 2) AS gross_profit,
      CASE WHEN (SUM(CASE WHEN src IN ('IV','DN') THEN line_rev ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END)) > 0
           THEN ROUND(
             ((SUM(CASE WHEN src IN ('IV','DN') THEN line_rev ELSE 0 END)
               - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END))
              - (SUM(CASE WHEN src IN ('IV','DN') THEN line_cost ELSE 0 END)
                 - SUM(CASE WHEN src = 'CN' THEN line_cost ELSE 0 END)))
             / (SUM(CASE WHEN src IN ('IV','DN') THEN line_rev ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END)) * 100, 2)
           ELSE 0 END AS margin_pct
    FROM (
      SELECT 'IV' AS src,
             COALESCE(NULLIF(i.ItemGroup, ''), 'Unclassified') AS item_group,
             dtl.LocalSubTotal AS line_rev,
             MIN(dtl.LocalTotalCost, dtl.LocalSubTotal * 5) AS line_cost
      FROM ivdtl dtl
      JOIN iv h ON dtl.DocKey = h.DocKey
      LEFT JOIN item i ON dtl.ItemCode = i.ItemCode
      WHERE h.Cancelled='F' AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
        ${customerSubquery.sql}

      UNION ALL

      SELECT 'CN',
             COALESCE(NULLIF(i.ItemGroup, ''), 'Unclassified'),
             dtl.LocalSubTotal,
             dtl.UnitCost * dtl.Qty
      FROM cndtl dtl
      JOIN cn h ON dtl.DocKey = h.DocKey
      LEFT JOIN item i ON dtl.ItemCode = i.ItemCode
      WHERE h.Cancelled='F' AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
        ${customerSubquery.sql}

      UNION ALL

      SELECT 'DN',
             COALESCE(NULLIF(i.ItemGroup, ''), 'Unclassified'),
             dtl.LocalSubTotal,
             MIN(dtl.LocalTotalCost, dtl.LocalSubTotal * 5)
      FROM dndtl dtl
      JOIN dn h ON dtl.DocKey = h.DocKey
      LEFT JOIN item i ON dtl.ItemCode = i.ItemCode
      WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
        ${customerSubquery.sql}
    )
    WHERE 1=1 ${pgFilter}
    GROUP BY item_group
    ORDER BY revenue DESC
  `).all(
    filters.start, filters.end, ...customerSubquery.params,
    filters.start, filters.end, ...customerSubquery.params,
    filters.start, filters.end, ...customerSubquery.params,
    ...pgParams
  ) as ProductGroupRow[];
}

// ─── 7. Product x Customer Matrix ────────────────────────────────────────────

export function getProductCustomerMatrix(filters: MarginFilters): ProductCustomerCell[] {
  const db = getDb();

  const customerSubquery = (filters.types?.length || filters.agents?.length)
    ? (() => {
        const clauses: string[] = [];
        const p: unknown[] = [];
        if (filters.types?.length) {
          clauses.push(`DebtorType IN (${filters.types.map(() => '?').join(',')})`);
          p.push(...filters.types);
        }
        if (filters.agents?.length) {
          clauses.push(`SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
          p.push(...filters.agents);
        }
        return { sql: `AND h.DebtorCode IN (SELECT DebtorCode FROM debtor WHERE ${clauses.join(' AND ')})`, params: p };
      })()
    : { sql: '', params: [] };

  let custFilter = '';
  const custParams: unknown[] = [];
  if (filters.customers?.length) {
    custFilter = `AND h.DebtorCode IN (${filters.customers.map(() => '?').join(',')})`;
    custParams.push(...filters.customers);
  }

  return db.prepare(`
    SELECT
      debtor_code,
      d.CompanyName AS company_name,
      item_group,
      ROUND(SUM(CASE WHEN src = 'IV' THEN line_rev ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END), 2) AS revenue,
      ROUND(SUM(CASE WHEN src = 'IV' THEN line_cost ELSE 0 END)
          - SUM(CASE WHEN src = 'CN' THEN line_cost ELSE 0 END), 2) AS cogs,
      CASE WHEN (SUM(CASE WHEN src = 'IV' THEN line_rev ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END)) > 0
           THEN ROUND(
             ((SUM(CASE WHEN src = 'IV' THEN line_rev ELSE 0 END)
               - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END))
              - (SUM(CASE WHEN src = 'IV' THEN line_cost ELSE 0 END)
                 - SUM(CASE WHEN src = 'CN' THEN line_cost ELSE 0 END)))
             / (SUM(CASE WHEN src = 'IV' THEN line_rev ELSE 0 END)
                - SUM(CASE WHEN src = 'CN' THEN line_rev ELSE 0 END)) * 100, 2)
           ELSE 0 END AS margin_pct
    FROM (
      SELECT 'IV' AS src, h.DebtorCode AS debtor_code,
             COALESCE(NULLIF(i.ItemGroup, ''), 'Unclassified') AS item_group,
             dtl.LocalSubTotal AS line_rev,
             MIN(dtl.LocalTotalCost, dtl.LocalSubTotal * 5) AS line_cost
      FROM ivdtl dtl
      JOIN iv h ON dtl.DocKey = h.DocKey
      LEFT JOIN item i ON dtl.ItemCode = i.ItemCode
      WHERE h.Cancelled='F' AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
        ${custFilter} ${customerSubquery.sql}

      UNION ALL

      SELECT 'CN', h.DebtorCode,
             COALESCE(NULLIF(i.ItemGroup, ''), 'Unclassified'),
             dtl.LocalSubTotal,
             dtl.UnitCost * dtl.Qty
      FROM cndtl dtl
      JOIN cn h ON dtl.DocKey = h.DocKey
      LEFT JOIN item i ON dtl.ItemCode = i.ItemCode
      WHERE h.Cancelled='F' AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
        AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
        ${custFilter} ${customerSubquery.sql}
    )
    LEFT JOIN debtor d ON debtor_code = d.DebtorCode
    GROUP BY debtor_code, item_group
    HAVING revenue > 0
    ORDER BY revenue DESC
    LIMIT 500
  `).all(
    filters.start, filters.end, ...custParams, ...customerSubquery.params,
    filters.start, filters.end, ...custParams, ...customerSubquery.params,
  ) as ProductCustomerCell[];
}

// ─── 8. Credit Note Impact ───────────────────────────────────────────────────

export function getCreditNoteImpact(filters: MarginFilters): CreditNoteImpactRow[] {
  const db = getDb();
  const { where, params } = buildHeaderFilterWhere(filters, 'h');

  const extraParams: unknown[] = [];
  let debtorFilter = '';
  if (filters.types?.length || filters.agents?.length) {
    const clauses: string[] = [];
    if (filters.types?.length) {
      clauses.push(`d.DebtorType IN (${filters.types.map(() => '?').join(',')})`);
      extraParams.push(...filters.types);
    }
    if (filters.agents?.length) {
      clauses.push(`d.SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
      extraParams.push(...filters.agents);
    }
    debtorFilter = ' AND ' + clauses.join(' AND ');
  }

  return db.prepare(`
    SELECT
      c.debtor_code,
      d.CompanyName AS company_name,
      c.iv_revenue,
      c.cn_revenue,
      CASE WHEN c.iv_revenue > 0 THEN ROUND(c.cn_revenue / c.iv_revenue * 100, 2) ELSE 0 END AS return_rate_pct,
      CASE WHEN c.iv_revenue > 0
           THEN ROUND((c.iv_revenue - c.iv_cost) / c.iv_revenue * 100, 2) ELSE 0 END AS margin_before,
      CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
           THEN ROUND(((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost)) / (c.iv_revenue - c.cn_revenue) * 100, 2)
           ELSE 0 END AS margin_after,
      CASE WHEN c.iv_revenue > 0
           THEN ROUND(
             (c.iv_revenue - c.iv_cost) / c.iv_revenue * 100
             - CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
                    THEN ((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost)) / (c.iv_revenue - c.cn_revenue) * 100
                    ELSE 0 END, 2)
           ELSE 0 END AS margin_lost
    FROM (
      SELECT
        debtor_code,
        COALESCE(SUM(CASE WHEN src = 'IV' THEN revenue ELSE 0 END), 0) AS iv_revenue,
        COALESCE(SUM(CASE WHEN src = 'IV' THEN cost ELSE 0 END), 0) AS iv_cost,
        COALESCE(SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END), 0) AS cn_revenue,
        COALESCE(SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END), 0) AS cn_cost
      FROM (
        SELECT 'IV' AS src, h.DebtorCode AS debtor_code, h.LocalNetTotal AS revenue,
               COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost,
               h.DocDate
        FROM iv h WHERE h.Cancelled='F' AND ${where}
        UNION ALL
        SELECT 'CN', h.DebtorCode, h.LocalNetTotal,
               COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0),
               h.DocDate
        FROM cn h WHERE h.Cancelled='F' AND ${where}
      )
      GROUP BY debtor_code
    ) c
    LEFT JOIN debtor d ON c.debtor_code = d.DebtorCode
    WHERE c.cn_revenue > 0 ${debtorFilter}
    ORDER BY return_rate_pct DESC
    LIMIT 100
  `).all(...params, ...params, ...extraParams) as CreditNoteImpactRow[];
}

// ─── 9. Margin Distribution ─────────────────────────────────────────────────

export function getMarginDistribution(filters: MarginFilters): DistributionBucket[] {
  const db = getDb();
  const { where, params } = buildHeaderFilterWhere(filters, 'h');

  const extraParams: unknown[] = [];
  let debtorFilter = '';
  if (filters.types?.length || filters.agents?.length) {
    const clauses: string[] = [];
    if (filters.types?.length) {
      clauses.push(`d.DebtorType IN (${filters.types.map(() => '?').join(',')})`);
      extraParams.push(...filters.types);
    }
    if (filters.agents?.length) {
      clauses.push(`d.SalesAgent IN (${filters.agents.map(() => '?').join(',')})`);
      extraParams.push(...filters.agents);
    }
    debtorFilter = ' AND ' + clauses.join(' AND ');
  }

  return db.prepare(`
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
        c.debtor_code,
        CASE WHEN c.net_revenue > 0
             THEN (c.net_revenue - c.net_cogs) / c.net_revenue * 100
             ELSE -999 END AS margin_pct
      FROM (
        SELECT
          debtor_code,
          SUM(CASE WHEN src IN ('IV','DN') THEN revenue ELSE 0 END)
            - SUM(CASE WHEN src = 'CN' THEN revenue ELSE 0 END) AS net_revenue,
          SUM(CASE WHEN src IN ('IV','DN') THEN cost ELSE 0 END)
            - SUM(CASE WHEN src = 'CN' THEN cost ELSE 0 END) AS net_cogs
        FROM (
          SELECT 'IV' AS src, h.DebtorCode AS debtor_code, h.LocalNetTotal AS revenue,
                 COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM ivdtl d WHERE d.DocKey = h.DocKey), 0) AS cost,
                 h.DocDate
          FROM iv h WHERE h.Cancelled='F' AND ${where}
          UNION ALL
          SELECT 'DN', h.DebtorCode, h.LocalNetTotal,
                 COALESCE((SELECT SUM(MIN(d.LocalTotalCost, d.LocalSubTotal * 5)) FROM dndtl d WHERE d.DocKey = h.DocKey), 0),
                 h.DocDate
          FROM dn h WHERE (h.Cancelled='F' OR h.Cancelled IS NULL) AND ${where}
          UNION ALL
          SELECT 'CN', h.DebtorCode, h.LocalNetTotal,
                 COALESCE((SELECT SUM(d.UnitCost * d.Qty) FROM cndtl d WHERE d.DocKey = h.DocKey), 0),
                 h.DocDate
          FROM cn h WHERE h.Cancelled='F' AND ${where}
        )
        GROUP BY debtor_code
      ) c
      LEFT JOIN debtor d ON c.debtor_code = d.DebtorCode
      WHERE c.net_revenue > 1000 ${debtorFilter}
    )
    GROUP BY bucket
    ORDER BY min_val
  `).all(...params, ...params, ...params, ...extraParams) as DistributionBucket[];
}

// ─── 10-13. Filter Lookups ──────────────────────────────────────────────────

export function getFilterCustomers(): { code: string; name: string | null }[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.DebtorCode AS code, d.CompanyName AS name
    FROM debtor d
    WHERE EXISTS (SELECT 1 FROM iv WHERE iv.DebtorCode = d.DebtorCode AND iv.Cancelled = 'F')
    ORDER BY d.CompanyName
  `).all() as { code: string; name: string | null }[];
}

export function getFilterTypes(): string[] {
  const db = getDb();
  return (db.prepare(`
    SELECT DISTINCT COALESCE(DebtorType, 'Unassigned') AS t
    FROM debtor
    ORDER BY t
  `).all() as { t: string }[]).map(r => r.t);
}

export function getFilterAgents(): { agent: string; description: string | null; is_active: string }[] {
  const db = getDb();
  return db.prepare(`
    SELECT SalesAgent AS agent, Description AS description, IsActive AS is_active
    FROM sales_agent
    ORDER BY SalesAgent
  `).all() as { agent: string; description: string | null; is_active: string }[];
}

export function getFilterProductGroups(): string[] {
  const db = getDb();
  const groups = (db.prepare(`
    SELECT ItemGroup AS g, Description AS d FROM item_group ORDER BY g
  `).all() as { g: string; d: string | null }[]).map(r => r.g);
  groups.push('Unclassified');
  return groups;
}

// ─── 14. Data Quality ────────────────────────────────────────────────────────

export function getDataQuality(start: string, end: string): DataQualityMetrics {
  const db = getDb();

  const anomalous = db.prepare(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(dtl.LocalTotalCost - dtl.LocalSubTotal * 5), 0) AS excess
    FROM ivdtl dtl
    JOIN iv h ON dtl.DocKey = h.DocKey
    WHERE h.Cancelled = 'F'
      AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
      AND dtl.LocalTotalCost > dtl.LocalSubTotal * 5
      AND dtl.LocalSubTotal > 0
  `).get(start, end) as { cnt: number; excess: number };

  const missingGroup = db.prepare(`
    SELECT
      ROUND(SUM(CASE WHEN i.ItemGroup IS NULL OR i.ItemGroup = '' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pct
    FROM ivdtl dtl
    JOIN iv h ON dtl.DocKey = h.DocKey
    LEFT JOIN item i ON dtl.ItemCode = i.ItemCode
    WHERE h.Cancelled = 'F' AND dtl.ItemCode IS NOT NULL AND dtl.ItemCode != ''
      AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as { pct: number };

  const missingCode = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM ivdtl dtl
    JOIN iv h ON dtl.DocKey = h.DocKey
    WHERE h.Cancelled = 'F'
      AND (dtl.ItemCode IS NULL OR dtl.ItemCode = '')
      AND DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as { cnt: number };

  const noAgent = db.prepare(`
    SELECT COUNT(*) AS cnt FROM iv
    WHERE Cancelled = 'F' AND (SalesAgent IS NULL OR SalesAgent = '')
      AND DATE(DocDate, '+8 hours') BETWEEN ? AND ?
  `).get(start, end) as { cnt: number };

  const dateRange = db.prepare(`
    SELECT
      MIN(DATE(DocDate, '+8 hours')) AS first_date,
      MAX(DATE(DocDate, '+8 hours')) AS last_date
    FROM iv WHERE Cancelled = 'F'
  `).get() as { first_date: string; last_date: string };

  return {
    anomalous_lines: anomalous.cnt,
    anomalous_cost_total: Math.round(anomalous.excess),
    missing_item_group_pct: missingGroup.pct,
    missing_item_code_lines: missingCode.cnt,
    invoices_no_agent: noAgent.cnt,
    date_range: { first: dateRange.first_date, last: dateRange.last_date },
  };
}
