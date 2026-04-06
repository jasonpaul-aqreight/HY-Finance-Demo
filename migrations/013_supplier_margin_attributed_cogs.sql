-- Migration 013: Add attributed_cogs to pc_supplier_margin
-- Problem: sales_revenue was duplicated across suppliers (full item revenue on each row)
-- and purchase_total was used as COGS (should be cost of goods SOLD, not purchased).
-- Fix: Builder now stores attributed values; this column stores the supplier's
-- share of COGS = purchase_total × (item_sold_qty / total_item_purchase_qty).

ALTER TABLE pc_supplier_margin
  ADD COLUMN IF NOT EXISTS attributed_cogs NUMERIC(15,2) NOT NULL DEFAULT 0;
