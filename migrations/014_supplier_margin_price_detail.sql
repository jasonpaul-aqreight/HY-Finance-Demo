-- Migration 014: Add line-item price detail columns to pc_supplier_margin
-- The existing avg_unit_cost is a monthly weighted average (purchase_total / purchase_qty).
-- For the Price Comparison tab's supplier detail view, we need individual line-item
-- granularity for min/max prices and the most recent transaction price.

ALTER TABLE pc_supplier_margin
  ADD COLUMN IF NOT EXISTS min_unit_price REAL,
  ADD COLUMN IF NOT EXISTS max_unit_price REAL,
  ADD COLUMN IF NOT EXISTS last_unit_price REAL;

COMMENT ON COLUMN pc_supplier_margin.min_unit_price IS 'Minimum individual UnitPrice from PIDTL in this supplier-item-month';
COMMENT ON COLUMN pc_supplier_margin.max_unit_price IS 'Maximum individual UnitPrice from PIDTL in this supplier-item-month';
COMMENT ON COLUMN pc_supplier_margin.last_unit_price IS 'UnitPrice from the most recent transaction (by DocDate) in this supplier-item-month';
