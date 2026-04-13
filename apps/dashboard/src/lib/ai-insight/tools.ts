import type Anthropic from '@anthropic-ai/sdk';
import { getPool, queryRds } from '../postgres';

// ─── Column whitelists (from spec Section 9) ────────────────────────────────

const LOCAL_WHITELIST: Record<string, string[]> = {
  pc_sales_daily: ['doc_date', 'invoice_total', 'cash_total', 'cn_total', 'net_revenue', 'doc_count'],
  pc_sales_by_customer: ['doc_date', 'debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'doc_count'],
  pc_sales_by_outlet: ['doc_date', 'dimension', 'dimension_key', 'dimension_label', 'is_active', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'doc_count', 'customer_count'],
  pc_sales_by_fruit: ['doc_date', 'fruit_name', 'fruit_country', 'fruit_variant', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'total_qty', 'doc_count'],
  pc_ar_monthly: ['month', 'invoiced', 'collected', 'cn_applied', 'refunded', 'total_outstanding', 'total_billed', 'customer_count'],
  pc_ar_customer_snapshot: ['debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'display_term', 'credit_limit', 'total_outstanding', 'overdue_amount', 'utilization_pct', 'credit_score', 'risk_tier', 'is_active', 'invoice_count', 'avg_payment_days', 'max_overdue_days'],
  pc_ar_aging_history: ['snapshot_date', 'bucket', 'dimension', 'dimension_key', 'invoice_count', 'total_outstanding'],
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

// ─── Tool definitions for Claude ─────────────────────────────────────────────

export const AI_TOOLS: Anthropic.Tool[] = [
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
  const error = validateColumns(input.table, input.columns, LOCAL_WHITELIST);
  if (error) return error;

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
  const error = validateColumns(input.table, input.columns, RDS_WHITELIST);
  if (error) return error;

  const limit = Math.min(input.limit ?? ROW_LIMIT, ROW_LIMIT);
  let sql = `SELECT TOP ${limit} ${input.columns.map(c => `[${c}]`).join(', ')} FROM ${input.table}`;
  if (input.where_clause) sql += ` WHERE ${input.where_clause}`;
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
