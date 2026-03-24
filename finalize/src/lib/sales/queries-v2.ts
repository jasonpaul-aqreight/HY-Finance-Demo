import { getDb } from './db';
import type { GroupByDimension, StackDimension, GroupByRow, StackedRow } from './types';

export { STACK_OPTIONS } from './types';
export type { GroupByDimension, StackDimension, GroupByRow, StackedRow } from './types';

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

// ─── Group-by: Fruit Name ─────────────────────────────────────────────────

function getByFruit(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(FruitName, 'OTHERS') AS name,
      COALESCE(SUM(CASE WHEN src='IV' THEN SubTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN src='CS' THEN SubTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN src='CN' THEN SubTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN SubTotal
        WHEN src='CN' THEN -SubTotal
        ELSE 0
      END), 0) AS total_sales,
      SUM(CASE WHEN src IN ('IV','CS') THEN ABS(Qty) ELSE 0 END) AS qty_sold,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, DocDate, SubTotal, Qty, FruitName FROM sales_invoice
      UNION ALL
      SELECT 'CS', DocDate, SubTotal, Qty, FruitName FROM sales_cash
      UNION ALL
      SELECT 'CN', DocDate, SubTotal, Qty, FruitName FROM sales_credit_note
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(FruitName, 'OTHERS')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Group-by: Fruit Country ──────────────────────────────────────────────

function getByFruitCountry(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(FruitCountry, '(Unknown)') AS name,
      COALESCE(SUM(CASE WHEN src='IV' THEN SubTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN src='CS' THEN SubTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN src='CN' THEN SubTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN SubTotal
        WHEN src='CN' THEN -SubTotal
        ELSE 0
      END), 0) AS total_sales,
      SUM(CASE WHEN src IN ('IV','CS') THEN ABS(Qty) ELSE 0 END) AS qty_sold,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, DocDate, SubTotal, Qty, FruitCountry FROM sales_invoice
      UNION ALL
      SELECT 'CS', DocDate, SubTotal, Qty, FruitCountry FROM sales_cash
      UNION ALL
      SELECT 'CN', DocDate, SubTotal, Qty, FruitCountry FROM sales_credit_note
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(FruitCountry, '(Unknown)')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Group-by: Fruit Variant ──────────────────────────────────────────────

function getByFruitVariant(start: string, end: string): GroupByRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(FruitName, 'OTHERS') || ' — ' || COALESCE(FruitVariant, 'OTHERS') AS name,
      COALESCE(FruitName, 'OTHERS') AS fruit_name,
      COALESCE(FruitVariant, 'OTHERS') AS fruit_variant,
      COALESCE(SUM(CASE WHEN src='IV' THEN SubTotal ELSE 0 END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN src='CS' THEN SubTotal ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN src='CN' THEN SubTotal ELSE 0 END), 0) AS credit_notes,
      COALESCE(SUM(CASE
        WHEN src IN ('IV','CS') THEN SubTotal
        WHEN src='CN' THEN -SubTotal
        ELSE 0
      END), 0) AS total_sales,
      SUM(CASE WHEN src IN ('IV','CS') THEN ABS(Qty) ELSE 0 END) AS qty_sold,
      COUNT(*) AS doc_count
    FROM (
      SELECT 'IV' AS src, DocDate, SubTotal, Qty, FruitName, FruitVariant FROM sales_invoice
      UNION ALL
      SELECT 'CS', DocDate, SubTotal, Qty, FruitName, FruitVariant FROM sales_cash
      UNION ALL
      SELECT 'CN', DocDate, SubTotal, Qty, FruitName, FruitVariant FROM sales_credit_note
    )
    WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY COALESCE(FruitName, 'OTHERS'), COALESCE(FruitVariant, 'OTHERS')
    ORDER BY total_sales DESC
  `).all(start, end) as GroupByRow[];
}

// ─── Unified entry point ────────────────────────────────────────────────────

export function getGroupByData(group: GroupByDimension, start: string, end: string): GroupByRow[] {
  switch (group) {
    case 'customer':       return getByCustomer(start, end);
    case 'customer-type':  return getByCustomerType(start, end);
    case 'agent':          return getByAgent(start, end);
    case 'outlet':         return getByOutlet(start, end);
    case 'fruit':          return getByFruit(start, end);
    case 'fruit-country':  return getByFruitCountry(start, end);
    case 'fruit-variant':  return getByFruitVariant(start, end);
  }
}

// ─── Stacked chart support ─────────────────────────────────────────────────

type AnyDim = GroupByDimension | StackDimension;

// Dimensions that require line-item tables (fruit data)
const LINE_ITEM_DIMS: Set<AnyDim> = new Set(['fruit', 'fruit-country', 'fruit-variant']);

interface DimMapping {
  /** Expression used in SELECT for display name */
  selectExpr: string;
  /** Expression used in GROUP BY (must not use aggregates) */
  groupExpr: string;
  joins: string[];
  /** Optional CTE to resolve display names (for customer dimension) */
  cte?: string;
  /** Join to attach CTE-resolved names */
  cteJoin?: string;
  /** Number of extra ? params the CTE needs (bound before the main WHERE params) */
  cteParams?: number;
}

function getDimMapping(dim: AnyDim, role: 'primary' | 'stack'): DimMapping {
  switch (dim) {
    case 'customer':
      // Group by DebtorCode, resolve canonical name via CTE so all sub-groups
      // (per agent, fruit, etc.) get the same display name as the base query.
      // CTE uses ? placeholders for date params (bound separately).
      return {
        selectExpr: `_cust_${role}.canonical_name`,
        groupExpr: 's.DebtorCode',
        joins: [],
        cte: `_cust_names_${role} AS (
          SELECT DebtorCode, MAX(DebtorName) AS canonical_name
          FROM (
            SELECT DebtorCode, DebtorName, DocDate FROM iv WHERE Cancelled='F'
            UNION ALL SELECT DebtorCode, DebtorName, DocDate FROM cs WHERE Cancelled='F'
            UNION ALL SELECT DebtorCode, DebtorName, DocDate FROM cn WHERE Cancelled='F'
          ) WHERE DATE(DocDate, '+8 hours') BETWEEN ? AND ?
          GROUP BY DebtorCode
        )`,
        cteJoin: `LEFT JOIN _cust_names_${role} _cust_${role} ON s.DebtorCode = _cust_${role}.DebtorCode`,
        /** Number of extra ? params this CTE needs (start, end) */
        cteParams: 2,
      };
    case 'customer-type':
      return {
        selectExpr: "COALESCE(d.DebtorType, '(Uncategorized)')",
        groupExpr: "COALESCE(d.DebtorType, '(Uncategorized)')",
        joins: ['LEFT JOIN debtor d ON s.DebtorCode = d.DebtorCode'],
      };
    case 'fruit':
      return { selectExpr: "COALESCE(s.FruitName, 'OTHERS')", groupExpr: "COALESCE(s.FruitName, 'OTHERS')", joins: [] };
    case 'fruit-country':
      return { selectExpr: "COALESCE(s.FruitCountry, '(Unknown)')", groupExpr: "COALESCE(s.FruitCountry, '(Unknown)')", joins: [] };
    case 'fruit-variant':
      // When used as a stack dimension (e.g. group=fruit, stack=variant), return
      // just the variant name so it doesn't repeat the fruit prefix.
      // When used as a primary dimension, return the full "Fruit — Variant" combo.
      if (role === 'stack') {
        return { selectExpr: "COALESCE(s.FruitVariant, 'OTHERS')", groupExpr: "COALESCE(s.FruitVariant, 'OTHERS')", joins: [] };
      }
      return {
        selectExpr: "COALESCE(s.FruitName,'OTHERS') || ' — ' || COALESCE(s.FruitVariant,'OTHERS')",
        groupExpr: "COALESCE(s.FruitName,'OTHERS') || ' — ' || COALESCE(s.FruitVariant,'OTHERS')",
        joins: [],
      };
    case 'agent':
      return { selectExpr: "COALESCE(s.SalesAgent, '(Unassigned)')", groupExpr: "COALESCE(s.SalesAgent, '(Unassigned)')", joins: [] };
    case 'outlet':
      return { selectExpr: "COALESCE(s.SalesLocation, '(Unassigned)')", groupExpr: "COALESCE(s.SalesLocation, '(Unassigned)')", joins: [] };
  }
}

export function getGroupByDataStacked(
  group: GroupByDimension,
  stack: StackDimension,
  start: string,
  end: string,
): StackedRow[] {
  const db = getDb();
  const primary = getDimMapping(group, 'primary');
  const secondary = getDimMapping(stack, 'stack');

  // Collect joins and CTEs
  const allJoins = [...new Set([...primary.joins, ...secondary.joins])];
  if (primary.cteJoin) allJoins.push(primary.cteJoin);
  if (secondary.cteJoin) allJoins.push(secondary.cteJoin);
  const ctes = [primary.cte, secondary.cte].filter(Boolean);

  // Use line-item tables (SubTotal) when either dimension needs fruit data,
  // otherwise use header tables (NetTotal) to match base query totals.
  const needsLineItems = LINE_ITEM_DIMS.has(group) || LINE_ITEM_DIMS.has(stack);

  const unionSql = needsLineItems
    ? `
      SELECT 'IV' AS src, DocDate, SubTotal AS Amount, DebtorCode, DebtorName,
             SalesAgent, SalesLocation, FruitName, FruitCountry, FruitVariant
      FROM sales_invoice
      UNION ALL
      SELECT 'CS', DocDate, SubTotal, DebtorCode, DebtorName,
             SalesAgent, SalesLocation, FruitName, FruitCountry, FruitVariant
      FROM sales_cash
      UNION ALL
      SELECT 'CN', DocDate, SubTotal, DebtorCode, DebtorName,
             SalesAgent, SalesLocation, FruitName, FruitCountry, FruitVariant
      FROM sales_credit_note`
    : `
      SELECT 'IV' AS src, DocDate, NetTotal AS Amount, DebtorCode, DebtorName,
             SalesAgent, SalesLocation, NULL AS FruitName, NULL AS FruitCountry, NULL AS FruitVariant
      FROM iv WHERE Cancelled='F'
      UNION ALL
      SELECT 'CS', DocDate, NetTotal, DebtorCode, DebtorName,
             SalesAgent, SalesLocation, NULL, NULL, NULL
      FROM cs WHERE Cancelled='F'
      UNION ALL
      SELECT 'CN', DocDate, NetTotal, DebtorCode, DebtorName,
             SalesAgent, SalesLocation, NULL, NULL, NULL
      FROM cn WHERE Cancelled='F'`;

  const ctePart = ctes.length > 0 ? `WITH ${ctes.join(',\n')}` : '';

  const sql = `
    ${ctePart}
    SELECT
      ${primary.selectExpr} AS primary_name,
      ${secondary.selectExpr} AS stack_name,
      COALESCE(SUM(CASE
        WHEN s.src IN ('IV','CS') THEN s.Amount
        WHEN s.src='CN' THEN -s.Amount
        ELSE 0
      END), 0) AS total_sales
    FROM (${unionSql}
    ) s
    ${allJoins.join('\n    ')}
    WHERE DATE(s.DocDate, '+8 hours') BETWEEN ? AND ?
    GROUP BY ${primary.groupExpr}, ${secondary.groupExpr}
    ORDER BY total_sales DESC
  `;

  // Build params: CTE params (date range for each CTE that needs it) come first,
  // then the main WHERE date range params.
  const params: string[] = [];
  if (primary.cteParams) params.push(start, end);
  if (secondary.cteParams) params.push(start, end);
  params.push(start, end); // main WHERE clause

  return db.prepare(sql).all(...params) as StackedRow[];
}
