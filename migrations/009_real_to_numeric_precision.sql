-- Migration 009: Fix floating-point precision for monetary values
-- Problem: REAL (float4) only has ~7 digits of precision, causing rounding errors
-- on large MYR amounts (e.g., RM 21,550,056.90 stored as RM 21,550,058).
-- Solution: Change monetary columns to NUMERIC(15,2) for exact decimal arithmetic.
-- Non-monetary columns (percentages, scores, quantities) use NUMERIC(12,4) for precision.

BEGIN;

-- ============================================================
-- pc_sales_daily
-- ============================================================
ALTER TABLE pc_sales_daily
  ALTER COLUMN invoice_total TYPE NUMERIC(15,2),
  ALTER COLUMN cash_total TYPE NUMERIC(15,2),
  ALTER COLUMN cn_total TYPE NUMERIC(15,2),
  ALTER COLUMN net_revenue TYPE NUMERIC(15,2);

-- ============================================================
-- pc_sales_by_customer
-- ============================================================
ALTER TABLE pc_sales_by_customer
  ALTER COLUMN invoice_sales TYPE NUMERIC(15,2),
  ALTER COLUMN cash_sales TYPE NUMERIC(15,2),
  ALTER COLUMN credit_notes TYPE NUMERIC(15,2),
  ALTER COLUMN total_sales TYPE NUMERIC(15,2);

-- ============================================================
-- pc_sales_by_outlet
-- ============================================================
ALTER TABLE pc_sales_by_outlet
  ALTER COLUMN invoice_sales TYPE NUMERIC(15,2),
  ALTER COLUMN cash_sales TYPE NUMERIC(15,2),
  ALTER COLUMN credit_notes TYPE NUMERIC(15,2),
  ALTER COLUMN total_sales TYPE NUMERIC(15,2);

-- ============================================================
-- pc_sales_by_fruit
-- ============================================================
ALTER TABLE pc_sales_by_fruit
  ALTER COLUMN invoice_sales TYPE NUMERIC(15,2),
  ALTER COLUMN cash_sales TYPE NUMERIC(15,2),
  ALTER COLUMN credit_notes TYPE NUMERIC(15,2),
  ALTER COLUMN total_sales TYPE NUMERIC(15,2),
  ALTER COLUMN total_qty TYPE NUMERIC(12,4);

-- ============================================================
-- pc_ar_monthly
-- ============================================================
ALTER TABLE pc_ar_monthly
  ALTER COLUMN invoiced TYPE NUMERIC(15,2),
  ALTER COLUMN collected TYPE NUMERIC(15,2),
  ALTER COLUMN cn_applied TYPE NUMERIC(15,2),
  ALTER COLUMN refunded TYPE NUMERIC(15,2),
  ALTER COLUMN total_outstanding TYPE NUMERIC(15,2),
  ALTER COLUMN total_billed TYPE NUMERIC(15,2);

-- ============================================================
-- pc_ar_customer_snapshot
-- ============================================================
ALTER TABLE pc_ar_customer_snapshot
  ALTER COLUMN credit_limit TYPE NUMERIC(15,2),
  ALTER COLUMN overdue_limit TYPE NUMERIC(15,2),
  ALTER COLUMN total_outstanding TYPE NUMERIC(15,2),
  ALTER COLUMN overdue_amount TYPE NUMERIC(15,2),
  ALTER COLUMN utilization_pct TYPE NUMERIC(8,2),
  ALTER COLUMN avg_payment_days TYPE NUMERIC(8,2),
  ALTER COLUMN credit_score TYPE NUMERIC(8,2);

-- ============================================================
-- pc_ar_aging_history
-- ============================================================
ALTER TABLE pc_ar_aging_history
  ALTER COLUMN total_outstanding TYPE NUMERIC(15,2);

-- ============================================================
-- pc_return_monthly
-- ============================================================
ALTER TABLE pc_return_monthly
  ALTER COLUMN cn_total TYPE NUMERIC(15,2),
  ALTER COLUMN knock_off_total TYPE NUMERIC(15,2),
  ALTER COLUMN refund_total TYPE NUMERIC(15,2),
  ALTER COLUMN unresolved_total TYPE NUMERIC(15,2);

-- ============================================================
-- pc_return_by_customer
-- ============================================================
ALTER TABLE pc_return_by_customer
  ALTER COLUMN cn_total TYPE NUMERIC(15,2),
  ALTER COLUMN knock_off_total TYPE NUMERIC(15,2),
  ALTER COLUMN refund_total TYPE NUMERIC(15,2),
  ALTER COLUMN unresolved TYPE NUMERIC(15,2);

-- ============================================================
-- pc_return_products
-- ============================================================
ALTER TABLE pc_return_products
  ALTER COLUMN total_qty TYPE NUMERIC(12,4),
  ALTER COLUMN total_amount TYPE NUMERIC(15,2);

-- ============================================================
-- pc_return_aging
-- ============================================================
ALTER TABLE pc_return_aging
  ALTER COLUMN amount TYPE NUMERIC(15,2);

-- ============================================================
-- pc_customer_margin
-- ============================================================
ALTER TABLE pc_customer_margin
  ALTER COLUMN iv_revenue TYPE NUMERIC(15,2),
  ALTER COLUMN iv_cost TYPE NUMERIC(15,2),
  ALTER COLUMN cn_revenue TYPE NUMERIC(15,2),
  ALTER COLUMN cn_cost TYPE NUMERIC(15,2),
  ALTER COLUMN dn_revenue TYPE NUMERIC(15,2),
  ALTER COLUMN dn_cost TYPE NUMERIC(15,2);

-- ============================================================
-- pc_customer_margin_by_product
-- ============================================================
ALTER TABLE pc_customer_margin_by_product
  ALTER COLUMN revenue TYPE NUMERIC(15,2),
  ALTER COLUMN cogs TYPE NUMERIC(15,2),
  ALTER COLUMN qty_sold TYPE NUMERIC(12,4);

-- ============================================================
-- pc_supplier_margin
-- ============================================================
ALTER TABLE pc_supplier_margin
  ALTER COLUMN purchase_qty TYPE NUMERIC(12,4),
  ALTER COLUMN purchase_total TYPE NUMERIC(15,2),
  ALTER COLUMN avg_unit_cost TYPE NUMERIC(12,4),
  ALTER COLUMN sales_qty TYPE NUMERIC(12,4),
  ALTER COLUMN sales_revenue TYPE NUMERIC(15,2);

-- ============================================================
-- pc_pnl_period
-- ============================================================
ALTER TABLE pc_pnl_period
  ALTER COLUMN home_dr TYPE NUMERIC(15,2),
  ALTER COLUMN home_cr TYPE NUMERIC(15,2);

-- ============================================================
-- pc_opening_balance
-- ============================================================
ALTER TABLE pc_opening_balance
  ALTER COLUMN home_dr TYPE NUMERIC(15,2),
  ALTER COLUMN home_cr TYPE NUMERIC(15,2);

-- ============================================================
-- pc_expense_monthly
-- ============================================================
ALTER TABLE pc_expense_monthly
  ALTER COLUMN total_dr TYPE NUMERIC(15,2),
  ALTER COLUMN total_cr TYPE NUMERIC(15,2),
  ALTER COLUMN net_amount TYPE NUMERIC(15,2);

COMMIT;
