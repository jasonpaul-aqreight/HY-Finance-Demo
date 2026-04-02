import { queryRds } from '../postgres';
import { getPool } from './db';
import type { GroupByDimension, GroupByRow } from './types';

export type { GroupByDimension, GroupByRow } from './types';

// ─── Group-by: Customer ─────────────────────────────────────────────────────

async function getByCustomer(start: string, end: string): Promise<GroupByRow[]> {
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
    WHERE doc_date BETWEEN $1 AND $2
    GROUP BY debtor_code
    ORDER BY total_sales DESC
  `, [start, end]);
  return rows;
}

// ─── Group-by: Customer Type ────────────────────────────────────────────────

async function getByCustomerType(start: string, end: string): Promise<GroupByRow[]> {
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
    WHERE dimension = 'type' AND doc_date BETWEEN $1 AND $2
    GROUP BY dimension_key
    ORDER BY total_sales DESC
  `, [start, end]);
  return rows;
}

// ─── Group-by: Sales Agent ──────────────────────────────────────────────────

interface AgentDistinctCustomerRow {
  name: string;
  unique_customers: number;
}

async function getAgentDistinctCustomerCounts(start: string, end: string): Promise<Map<string, number>> {
  const rows = await queryRds<AgentDistinctCustomerRow>(`
    WITH sales AS (
      SELECT
        ("DocDate" + INTERVAL '8 hours')::date AS doc_date,
        "DebtorCode",
        COALESCE("SalesAgent", '(Unassigned)') AS name
      FROM dbo."IV"
      WHERE "Cancelled" = 'F'

      UNION ALL

      SELECT
        ("DocDate" + INTERVAL '8 hours')::date AS doc_date,
        "DebtorCode",
        COALESCE("SalesAgent", '(Unassigned)') AS name
      FROM dbo."CS"
      WHERE "Cancelled" = 'F'

      UNION ALL

      SELECT
        ("DocDate" + INTERVAL '8 hours')::date AS doc_date,
        "DebtorCode",
        COALESCE("SalesAgent", '(Unassigned)') AS name
      FROM dbo."CN"
      WHERE "Cancelled" = 'F'
    )
    SELECT
      name,
      COUNT(DISTINCT "DebtorCode")::int AS unique_customers
    FROM sales
    WHERE doc_date BETWEEN $1 AND $2
    GROUP BY name
  `, [start, end]);

  return new Map(rows.map((row) => [row.name, row.unique_customers]));
}

async function getByAgent(start: string, end: string): Promise<GroupByRow[]> {
  const pool = getPool();
  const [{ rows }, distinctCustomerCounts] = await Promise.all([
    pool.query(`
      SELECT
        dimension_key AS name,
        MAX(dimension_label) AS description,
        MAX(is_active) AS is_active,
        COALESCE(SUM(invoice_sales), 0)::float AS invoice_sales,
        COALESCE(SUM(cash_sales), 0)::float AS cash_sales,
        COALESCE(SUM(credit_notes), 0)::float AS credit_notes,
        COALESCE(SUM(total_sales), 0)::float AS total_sales,
        COALESCE(SUM(doc_count), 0)::int AS doc_count
      FROM pc_sales_by_outlet
      WHERE dimension = 'agent' AND doc_date BETWEEN $1 AND $2
      GROUP BY dimension_key
      ORDER BY total_sales DESC
    `, [start, end]),
    getAgentDistinctCustomerCounts(start, end),
  ]);

  return rows.map((row) => ({
    ...row,
    unique_customers: distinctCustomerCounts.get(String(row.name)) ?? 0,
  }));
}

// ─── Group-by: Outlet ───────────────────────────────────────────────────────

async function getByOutlet(start: string, end: string): Promise<GroupByRow[]> {
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
    WHERE dimension = 'location' AND doc_date BETWEEN $1 AND $2
    GROUP BY dimension_key
    ORDER BY total_sales DESC
  `, [start, end]);
  return rows;
}

// ─── Group-by: Fruit (granular: Name + Country + Variant) ─────────────────

async function getByFruit(start: string, end: string): Promise<GroupByRow[]> {
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
    WHERE doc_date BETWEEN $1 AND $2
    GROUP BY fruit_name, fruit_country, fruit_variant
    ORDER BY total_sales DESC
  `, [start, end]);
  return rows;
}

// ─── Unified entry point ────────────────────────────────────────────────────

export async function getGroupByData(
  group: GroupByDimension,
  start: string,
  end: string,
): Promise<GroupByRow[]> {
  switch (group) {
    case 'customer':       return getByCustomer(start, end);
    case 'customer-type':  return getByCustomerType(start, end);
    case 'agent':          return getByAgent(start, end);
    case 'outlet':         return getByOutlet(start, end);
    case 'fruit':          return getByFruit(start, end);
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
    WHERE debtor_code = $1 AND doc_date BETWEEN $2 AND $3
  `, [debtorCode, start, end]);
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
      TO_CHAR(doc_date, 'YYYY-MM') AS month,
      SUM(invoice_sales)::float AS invoice_sales,
      SUM(cash_sales)::float AS cash_sales,
      SUM(credit_notes)::float AS credit_notes,
      SUM(total_sales)::float AS total_sales
    FROM pc_sales_by_customer
    WHERE debtor_code = $1 AND doc_date BETWEEN $2 AND $3
    GROUP BY TO_CHAR(doc_date, 'YYYY-MM')
    ORDER BY month
  `, [debtorCode, start, end]);
  return rows;
}
