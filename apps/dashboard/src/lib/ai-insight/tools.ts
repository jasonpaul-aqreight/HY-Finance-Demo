import { getPool, queryRds } from '../postgres';
import type { AiTool } from './types';

// ─── Column whitelists (from spec Section 9) ────────────────────────────────

const LOCAL_WHITELIST: Record<string, string[]> = {
  pc_sales_daily: ['doc_date', 'invoice_total', 'cash_total', 'cn_total', 'net_revenue', 'doc_count'],
  pc_sales_by_customer: ['doc_date', 'debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'doc_count'],
  pc_sales_by_outlet: ['doc_date', 'dimension', 'dimension_key', 'dimension_label', 'is_active', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'doc_count', 'customer_count'],
  pc_sales_by_fruit: ['doc_date', 'fruit_name', 'fruit_country', 'fruit_variant', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'total_qty', 'doc_count'],
  pc_ar_monthly: ['month', 'invoiced', 'collected', 'cn_applied', 'refunded', 'total_outstanding', 'total_billed', 'customer_count'],
  pc_ar_customer_snapshot: ['debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'display_term', 'credit_limit', 'total_outstanding', 'overdue_amount', 'utilization_pct', 'credit_score', 'risk_tier', 'is_active', 'invoice_count', 'avg_payment_days', 'max_overdue_days'],
  pc_ar_aging_history: ['snapshot_date', 'bucket', 'dimension', 'invoice_count', 'total_outstanding'],
  pc_customer_margin: ['month', 'debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'is_active', 'iv_revenue', 'dn_revenue', 'cn_revenue', 'iv_cost', 'dn_cost', 'cn_cost', 'iv_count', 'cn_count'],
  pc_supplier_margin: ['month', 'creditor_code', 'creditor_name', 'item_code', 'item_group', 'is_active', 'sales_revenue', 'attributed_cogs', 'purchase_qty', 'purchase_value'],
  pc_return_monthly: ['month', 'cn_count', 'cn_total', 'knock_off_total', 'refund_total', 'unresolved_total', 'reconciled_count', 'partial_count', 'outstanding_count'],
  pc_return_products: ['month', 'item_code', 'item_description', 'fruit_name', 'fruit_variant', 'fruit_country', 'cn_count', 'total_qty', 'total_amount', 'goods_returned_qty', 'credit_only_qty'],
  pc_return_aging: ['snapshot_date', 'bucket', 'count', 'amount'],
  pc_return_by_customer: ['month', 'debtor_code', 'company_name', 'cn_count', 'cn_total', 'knock_off_total', 'refund_total', 'unresolved', 'outstanding_count'],
  pc_expense_monthly: ['month', 'acc_no', 'account_name', 'acc_type', 'net_amount'],
  pc_pnl_period: ['period_no', 'acc_type', 'acc_no', 'account_name', 'parent_acc_no', 'home_dr', 'home_cr', 'proj_no'],
};

const RDS_WHITELIST: Record<string, string[]> = {
  'dbo.IV': ['DocNo', 'DocDate', 'DebtorCode', 'LocalNetTotal', 'Description', 'SalesAgent', 'SalesLocation', 'Cancelled'],
  'dbo.CS': ['DocNo', 'DocDate', 'DebtorCode', 'LocalNetTotal', 'Description', 'SalesAgent', 'SalesLocation', 'Cancelled'],
  'dbo.CN': ['DocNo', 'DocDate', 'DebtorCode', 'LocalNetTotal', 'Description', 'SalesAgent', 'CNType', 'Cancelled'],
  'dbo.ARInvoice': ['DocNo', 'DocDate', 'DueDate', 'DebtorCode', 'LocalNetTotal', 'Outstanding', 'DisplayTerm', 'Cancelled'],
  'dbo.ARPayment': ['DocNo', 'DocDate', 'DebtorCode', 'LocalPaymentAmt', 'Description', 'Cancelled'],
  'dbo.ARPaymentKnockOff': ['DocKey', 'KnockOffDocKey', 'KnockOffAmt', 'KnockOffDate'],
};

const ROW_LIMIT = 100;

// RDS tables that require Cancelled='F' to exclude voided documents. The
// LLM is instructed to include this filter, but we ALSO inject it server-side
// (see executeRdsQuery) so prompt drift can never let a cancelled document
// leak into the analysis.
const RDS_CANCELLED_FILTER_TABLES = new Set([
  'dbo.IV',
  'dbo.CS',
  'dbo.CN',
  'dbo.ARInvoice',
  'dbo.ARPayment',
]);

// Words/sequences that should never appear inside an LLM-supplied WHERE clause.
// Statement separators, comment markers, and any keyword that would let the
// model exfiltrate or mutate data outside the intended SELECT.
const WHERE_CLAUSE_BLOCKLIST: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /;/, label: 'statement terminator (;)' },
  { pattern: /--/, label: 'line comment (--)' },
  { pattern: /\/\*/, label: 'block comment start (/*)' },
  { pattern: /\*\//, label: 'block comment end (*/)' },
  { pattern: /\bUNION\b/i, label: 'UNION' },
  { pattern: /\bSELECT\b/i, label: 'nested SELECT' },
  { pattern: /\bINSERT\b/i, label: 'INSERT' },
  { pattern: /\bUPDATE\b/i, label: 'UPDATE' },
  { pattern: /\bDELETE\b/i, label: 'DELETE' },
  { pattern: /\bDROP\b/i, label: 'DROP' },
  { pattern: /\bTRUNCATE\b/i, label: 'TRUNCATE' },
  { pattern: /\bALTER\b/i, label: 'ALTER' },
  { pattern: /\bEXEC\b/i, label: 'EXEC' },
  { pattern: /\bEXECUTE\b/i, label: 'EXECUTE' },
  { pattern: /\bGRANT\b/i, label: 'GRANT' },
  { pattern: /\bREVOKE\b/i, label: 'REVOKE' },
  { pattern: /\bxp_\w+/i, label: 'extended stored procedure (xp_*)' },
  { pattern: /\bsp_\w+/i, label: 'system stored procedure (sp_*)' },
];

function validateWhereClauseSafety(where: string | undefined | null): string | null {
  if (!where) return null;
  for (const { pattern, label } of WHERE_CLAUSE_BLOCKLIST) {
    if (pattern.test(where)) {
      return `WHERE clause rejected: contains disallowed token (${label}). Use only column comparisons with $1/$2 parameter placeholders.`;
    }
  }
  return null;
}

function ensureRdsCancelledFilter(table: string, where: string | undefined): string | undefined {
  if (!RDS_CANCELLED_FILTER_TABLES.has(table)) return where;
  // Already present (any case)? Leave it untouched.
  if (where && /Cancelled\s*=\s*'F'/i.test(where)) return where;
  const filter = `Cancelled = 'F'`;
  if (!where || !where.trim()) return filter;
  return `(${where}) AND ${filter}`;
}

// ─── Tool definitions ───────────────────────────────────────────────────────

export const AI_TOOLS: AiTool[] = [
  {
    name: 'query_local_table',
    description: `Query a pre-calculated local PostgreSQL table (pc_* tables). These tables are pre-aggregated and should be queried first before trying RDS tables. Available tables: ${Object.keys(LOCAL_WHITELIST).join(', ')}. Maximum ${ROW_LIMIT} rows returned. Only whitelisted columns are allowed.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        table: {
          type: 'string',
          description: 'The table name (e.g., pc_ar_monthly)',
          enum: Object.keys(LOCAL_WHITELIST),
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to select (must be from the allowed list for this table)',
        },
        where_clause: {
          type: 'string',
          description: 'Optional WHERE clause (without the WHERE keyword). Use $1, $2, etc. for parameters.',
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Parameter values for the WHERE clause placeholders',
        },
        order_by: {
          type: 'string',
          description: 'Optional ORDER BY clause (without the ORDER BY keywords)',
        },
        limit: {
          type: 'number',
          description: `Maximum rows to return (default: ${ROW_LIMIT}, max: ${ROW_LIMIT})`,
        },
      },
      required: ['table', 'columns'],
    },
  },
  {
    name: 'query_rds_table',
    description: `Query a remote RDS table for drill-down detail when pc_* tables are insufficient. Available tables: ${Object.keys(RDS_WHITELIST).join(', ')}. Maximum ${ROW_LIMIT} rows returned. Only whitelisted columns are allowed. RDS queries for dbo.IV, dbo.CS, dbo.CN, dbo.ARInvoice, dbo.ARPayment MUST include Cancelled = 'F' in the WHERE clause.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        table: {
          type: 'string',
          description: 'The table name (e.g., dbo.IV)',
          enum: Object.keys(RDS_WHITELIST),
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to select (must be from the allowed list for this table)',
        },
        where_clause: {
          type: 'string',
          description: "WHERE clause (without the WHERE keyword). Must include Cancelled = 'F' for applicable tables.",
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Parameter values for the WHERE clause placeholders',
        },
        order_by: {
          type: 'string',
          description: 'Optional ORDER BY clause (without the ORDER BY keywords)',
        },
        limit: {
          type: 'number',
          description: `Maximum rows to return (default: ${ROW_LIMIT}, max: ${ROW_LIMIT})`,
        },
      },
      required: ['table', 'columns', 'where_clause'],
    },
  },
];

// ─── Tool execution ──────────────────────────────────────────────────────────

interface QueryInput {
  table: string;
  columns: string[];
  where_clause?: string;
  params?: string[];
  order_by?: string;
  limit?: number;
}

function validateColumns(table: string, columns: string[], whitelist: Record<string, string[]>): string | null {
  const allowed = whitelist[table];
  if (!allowed) return `Table "${table}" is not accessible.`;

  const invalid = columns.filter(c => !allowed.includes(c));
  if (invalid.length > 0) return `Columns not allowed for ${table}: ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}`;

  return null;
}

export async function executeToolCall(
  toolName: string,
  input: QueryInput,
): Promise<string> {
  try {
    if (toolName === 'query_local_table') {
      return await executeLocalQuery(input);
    } else if (toolName === 'query_rds_table') {
      return await executeRdsQuery(input);
    }
    return `Unknown tool: ${toolName}`;
  } catch (err) {
    return `Error executing query: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeLocalQuery(input: QueryInput): Promise<string> {
  const colError = validateColumns(input.table, input.columns, LOCAL_WHITELIST);
  if (colError) return colError;

  const whereError = validateWhereClauseSafety(input.where_clause);
  if (whereError) return whereError;
  const orderByError = validateWhereClauseSafety(input.order_by);
  if (orderByError) return orderByError.replace('WHERE clause', 'ORDER BY clause');

  const limit = Math.min(input.limit ?? ROW_LIMIT, ROW_LIMIT);

  // Auto-deduplicate snapshot table: use latest snapshot_date and DISTINCT ON debtor_code
  if (input.table === 'pc_ar_customer_snapshot') {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    const snapshotDate = latest?.d;
    const snapshotFilter = snapshotDate ? `snapshot_date = '${snapshotDate}'` : null;
    const cols = input.columns.map(c => `"${c}"`).join(', ');
    let sql = `SELECT DISTINCT ON ("debtor_code") ${cols} FROM ${input.table}`;
    const conditions: string[] = [];
    if (snapshotFilter) conditions.push(snapshotFilter);
    if (input.where_clause) conditions.push(input.where_clause);
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY "debtor_code"`;
    if (input.order_by) {
      // Wrap in subquery to allow custom ordering on deduplicated results
      sql = `SELECT * FROM (${sql}) sub ORDER BY ${input.order_by}`;
    }
    sql += ` LIMIT ${limit}`;
    const { rows } = await pool.query(sql, input.params ?? []);
    if (rows.length === 0) return 'No rows returned.';
    return formatRowsAsTable(rows);
  }

  let sql = `SELECT ${input.columns.map(c => `"${c}"`).join(', ')} FROM ${input.table}`;
  if (input.where_clause) sql += ` WHERE ${input.where_clause}`;
  if (input.order_by) sql += ` ORDER BY ${input.order_by}`;
  sql += ` LIMIT ${limit}`;

  const pool = getPool();
  const { rows } = await pool.query(sql, input.params ?? []);

  if (rows.length === 0) return 'No rows returned.';
  return formatRowsAsTable(rows);
}

async function executeRdsQuery(input: QueryInput): Promise<string> {
  const colError = validateColumns(input.table, input.columns, RDS_WHITELIST);
  if (colError) return colError;

  const whereError = validateWhereClauseSafety(input.where_clause);
  if (whereError) return whereError;
  const orderByError = validateWhereClauseSafety(input.order_by);
  if (orderByError) return orderByError.replace('WHERE clause', 'ORDER BY clause');

  // Server-side enforcement: dbo.IV/CS/CN/ARInvoice/ARPayment must be filtered
  // to non-cancelled documents. Belt-and-braces with the prompt-level rule.
  const whereWithCancelled = ensureRdsCancelledFilter(input.table, input.where_clause);

  const limit = Math.min(input.limit ?? ROW_LIMIT, ROW_LIMIT);
  let sql = `SELECT TOP ${limit} ${input.columns.map(c => `[${c}]`).join(', ')} FROM ${input.table}`;
  if (whereWithCancelled) sql += ` WHERE ${whereWithCancelled}`;
  if (input.order_by) sql += ` ORDER BY ${input.order_by}`;

  const rows = await queryRds<Record<string, unknown>>(sql, input.params ?? []);

  if (rows.length === 0) return 'No rows returned.';
  return formatRowsAsTable(rows);
}

function formatRowsAsTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No data.';

  const cols = Object.keys(rows[0]);
  const header = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${cols.map(c => formatValue(r[c])).join(' | ')} |`).join('\n');

  return `${rows.length} row(s) returned:\n\n${header}\n${sep}\n${body}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return v.toLocaleString('en-MY');
  return String(v);
}
