import { getPool } from './db';
import { toMonth } from './date-utils';
import type { GroupByDimension, GroupByRow } from './types';

export type { GroupByDimension, GroupByRow } from './types';

// ─── Group-by: Customer ─────────────────────────────────────────────────────

async function getByCustomer(startMonth: string, endMonth: string): Promise<GroupByRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      debtor_code AS code,
      MAX(company_name) AS name,
      COALESCE(MAX(debtor_type), '(Uncategorized)') AS customer_type,
      COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
      COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
      COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
      COALESCE(SUM(total_sales), 0)::float AS total_sales,
      COALESCE(SUM(doc_count), 0)::int AS doc_count
    FROM pc_sales_by_customer
    WHERE month BETWEEN $1 AND $2
    GROUP BY debtor_code
    ORDER BY total_sales DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Group-by: Customer Type ────────────────────────────────────────────────

async function getByCustomerType(startMonth: string, endMonth: string): Promise<GroupByRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      dimension_key AS name,
      MAX(dimension_label) AS description,
      COALESCE(SUM(customer_count), 0)::int AS customer_count,
      COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
      COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
      COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
      COALESCE(SUM(total_sales), 0)::float AS total_sales,
      COALESCE(SUM(doc_count), 0)::int AS doc_count
    FROM pc_sales_by_outlet
    WHERE dimension = 'type' AND month BETWEEN $1 AND $2
    GROUP BY dimension_key
    ORDER BY total_sales DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Group-by: Sales Agent ──────────────────────────────────────────────────

async function getByAgent(startMonth: string, endMonth: string): Promise<GroupByRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      dimension_key AS name,
      MAX(dimension_label) AS description,
      MAX(is_active) AS is_active,
      COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
      COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
      COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
      COALESCE(SUM(total_sales), 0)::float AS total_sales,
      COALESCE(SUM(doc_count), 0)::int AS doc_count,
      COALESCE(SUM(customer_count), 0)::int AS unique_customers
    FROM pc_sales_by_outlet
    WHERE dimension = 'agent' AND month BETWEEN $1 AND $2
    GROUP BY dimension_key
    ORDER BY total_sales DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Group-by: Outlet ───────────────────────────────────────────────────────

async function getByOutlet(startMonth: string, endMonth: string): Promise<GroupByRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      dimension_key AS name,
      COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
      COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
      COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
      COALESCE(SUM(total_sales), 0)::float AS total_sales,
      COALESCE(SUM(doc_count), 0)::int AS doc_count
    FROM pc_sales_by_outlet
    WHERE dimension = 'location' AND month BETWEEN $1 AND $2
    GROUP BY dimension_key
    ORDER BY total_sales DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Group-by: Fruit (granular: Name + Country + Variant) ─────────────────

async function getByFruit(startMonth: string, endMonth: string): Promise<GroupByRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      fruit_name AS name,
      fruit_country,
      fruit_variant,
      COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
      COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
      COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
      COALESCE(SUM(total_sales), 0)::float AS total_sales,
      COALESCE(SUM(total_qty), 0)::float AS qty_sold,
      COALESCE(SUM(doc_count), 0)::int AS doc_count
    FROM pc_sales_by_fruit
    WHERE month BETWEEN $1 AND $2
    GROUP BY fruit_name, fruit_country, fruit_variant
    ORDER BY total_sales DESC
  `, [startMonth, endMonth]);
  return rows;
}

// ─── Unified entry point ────────────────────────────────────────────────────

export async function getGroupByData(
  group: GroupByDimension,
  start: string,
  end: string,
): Promise<GroupByRow[]> {
  const startMonth = toMonth(start);
  const endMonth = toMonth(end);
  switch (group) {
    case 'customer':       return getByCustomer(startMonth, endMonth);
    case 'customer-type':  return getByCustomerType(startMonth, endMonth);
    case 'agent':          return getByAgent(startMonth, endMonth);
    case 'outlet':         return getByOutlet(startMonth, endMonth);
    case 'fruit':          return getByFruit(startMonth, endMonth);
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

export async function getCustomerSalesSummary(debtorCode: string, start: string, end: string): Promise<CustomerSalesSummary> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
      COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
      COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
      COALESCE(SUM(total_sales), 0)::float AS total_sales,
      COALESCE(SUM(doc_count), 0)::int AS doc_count
    FROM pc_sales_by_customer
    WHERE debtor_code = $1 AND month BETWEEN $2 AND $3
  `, [debtorCode, toMonth(start), toMonth(end)]);
  return rows[0];
}

export interface CustomerSalesTrendRow {
  month: string;
  total_sales: number;
  invoice_sales: number;
  cash_sales: number;
  credit_notes: number;
}

export async function getCustomerSalesTrend(debtorCode: string, start: string, end: string): Promise<CustomerSalesTrendRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      month,
      invoice_sales::float AS invoice_sales,
      cash_sales::float AS cash_sales,
      credit_notes::float AS credit_notes,
      total_sales::float AS total_sales
    FROM pc_sales_by_customer
    WHERE debtor_code = $1 AND month BETWEEN $2 AND $3
    ORDER BY month
  `, [debtorCode, toMonth(start), toMonth(end)]);
  return rows;
}
