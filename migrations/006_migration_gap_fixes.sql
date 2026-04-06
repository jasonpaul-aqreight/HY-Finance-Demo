-- Migration 006: Schema changes for migration gap fixes
-- See docs/migration-gap-fix-plan.md for full context

-- Fix 1.5: Add is_active to pc_customer_margin for inactive customer filtering
ALTER TABLE pc_customer_margin ADD COLUMN IF NOT EXISTS is_active TEXT DEFAULT 'T';
