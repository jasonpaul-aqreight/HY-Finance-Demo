-- Migration 014: Add columns that builders.ts produces but were never migrated
-- Fixes sync errors:
--   pc_ar_monthly: column "contra" does not exist
--   pc_ar_customer_snapshot: column "avg_days_late" does not exist
--   pc_return_products: column "cn_count" does not exist (+ renamed qty columns)

-- ── pc_ar_monthly: add contra column (introduced in c4b56b7) ───────────────
ALTER TABLE pc_ar_monthly
  ADD COLUMN IF NOT EXISTS contra NUMERIC(15,2) NOT NULL DEFAULT 0;

-- ── pc_ar_customer_snapshot: add avg_days_late (introduced in 075ca20) ─────
ALTER TABLE pc_ar_customer_snapshot
  ADD COLUMN IF NOT EXISTS avg_days_late NUMERIC(8,2);

-- ── pc_return_products: rename columns to match builder output (89bfb6c) ───
-- line_count → cn_count, goods_return_count → goods_returned_qty,
-- credit_only_count → credit_only_qty
-- Use DO block for idempotent renames (safe if already renamed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pc_return_products' AND column_name = 'line_count') THEN
    ALTER TABLE pc_return_products RENAME COLUMN line_count TO cn_count;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pc_return_products' AND column_name = 'goods_return_count') THEN
    ALTER TABLE pc_return_products RENAME COLUMN goods_return_count TO goods_returned_qty;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pc_return_products' AND column_name = 'credit_only_count') THEN
    ALTER TABLE pc_return_products RENAME COLUMN credit_only_count TO credit_only_qty;
  END IF;
END $$;

-- Fix column types: qty columns should be NUMERIC, not INTEGER (builder uses SUM of Qty)
ALTER TABLE pc_return_products
  ALTER COLUMN goods_returned_qty TYPE NUMERIC(12,4),
  ALTER COLUMN credit_only_qty TYPE NUMERIC(12,4);

-- Fix PK: builder groups by (month, item_code, item_description) but PK was (item_code, month)
-- Same item_code can have different descriptions across months/documents
ALTER TABLE pc_return_products DROP CONSTRAINT IF EXISTS pc_return_products_pkey;
ALTER TABLE pc_return_products DROP CONSTRAINT IF EXISTS pc_return_products_staging_pkey;
UPDATE pc_return_products SET item_description = '' WHERE item_description IS NULL;
ALTER TABLE pc_return_products ALTER COLUMN item_description SET NOT NULL,
                              ALTER COLUMN item_description SET DEFAULT '';
ALTER TABLE pc_return_products ADD PRIMARY KEY (item_code, item_description, month);
