-- ============================================================================
-- 015_missing_builder_columns.sql — Add columns expected by sync builders
-- ============================================================================

ALTER TABLE pc_ar_monthly
  ADD COLUMN IF NOT EXISTS contra NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE pc_ar_customer_snapshot
  ADD COLUMN IF NOT EXISTS avg_days_late REAL;

ALTER TABLE pc_return_products
  ADD COLUMN IF NOT EXISTS cn_count INTEGER NOT NULL DEFAULT 0;
