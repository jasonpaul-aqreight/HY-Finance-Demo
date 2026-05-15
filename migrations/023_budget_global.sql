-- Global budget baseline: one row per kept line item, applied across all fiscal years.
-- Replaces the fiscal-year-keyed `budget` table and the snapshot/manual `source` concept.
-- Kept line items: Net Sales, Cost of Sales, Operating Costs, Other Income.
-- Computed lines (Gross Profit, Net Profit) are dropped.

CREATE TABLE IF NOT EXISTS budget_global (
  line_item        TEXT PRIMARY KEY,
  monthly_budget   NUMERIC(18,2) NOT NULL,
  annual_budget    NUMERIC(18,2) NOT NULL,
  approved_by      TEXT,
  note             TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Older local databases may not have the metadata columns before this
-- migration runs. Add them temporarily so the seed query is safe, then drop
-- the legacy table at the end of the migration.
ALTER TABLE budget ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE budget ADD COLUMN IF NOT EXISTS note TEXT;

-- Seed from latest FY rows for the 4 kept line items (skips Gross Profit / Net Profit).
INSERT INTO budget_global (line_item, monthly_budget, annual_budget, approved_by, note, updated_at)
SELECT line_item, monthly_budget, annual_budget, approved_by, note, updated_at
FROM (
  SELECT DISTINCT ON (line_item) line_item, monthly_budget, annual_budget, approved_by, note, updated_at
  FROM budget
  WHERE line_item IN ('Net Sales', 'Cost of Sales', 'Operating Costs', 'Other Income')
  ORDER BY line_item, fiscal_year DESC, updated_at DESC
) latest
ON CONFLICT (line_item) DO NOTHING;

-- Other Income may not exist in legacy table; ensure row.
INSERT INTO budget_global (line_item, monthly_budget, annual_budget)
VALUES ('Other Income', 0, 0)
ON CONFLICT (line_item) DO NOTHING;

DROP TABLE IF EXISTS budget;
