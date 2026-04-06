-- ============================================================================
-- 008_sales_schema_fixes.sql — Fix Sales pre-computed table schemas
--
-- 1. pc_sales_by_customer: rename debtor_name → company_name
-- 2. pc_sales_by_fruit: add invoice_sales, cash_sales, credit_notes columns
--
-- Safe to re-run (uses IF EXISTS / IF NOT EXISTS guards).
-- Data will be repopulated by the next sync service run.
-- ============================================================================

-- ── 1. Rename debtor_name → company_name in pc_sales_by_customer ─────────

ALTER TABLE pc_sales_by_customer
  RENAME COLUMN debtor_name TO company_name;

-- ── 2. Add breakdown columns to pc_sales_by_fruit ────────────────────────

ALTER TABLE pc_sales_by_fruit
  ADD COLUMN IF NOT EXISTS invoice_sales REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_sales    REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_notes  REAL NOT NULL DEFAULT 0;
