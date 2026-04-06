-- Migration 010: Fix two audit gaps
-- Gap 2.3: Add invoice_count and payment_count to pc_ar_monthly
-- Gap 2.6: Add is_active to pc_supplier_margin (matching pc_customer_margin pattern)

-- ── Gap 2.3: Collection trend counts ────────────────────────────────────────
ALTER TABLE pc_ar_monthly ADD COLUMN IF NOT EXISTS invoice_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pc_ar_monthly ADD COLUMN IF NOT EXISTS payment_count INTEGER NOT NULL DEFAULT 0;

-- ── Gap 2.6: Supplier margin inactive filtering ──────────────────��─────────
ALTER TABLE pc_supplier_margin ADD COLUMN IF NOT EXISTS is_active TEXT NOT NULL DEFAULT 'T';
