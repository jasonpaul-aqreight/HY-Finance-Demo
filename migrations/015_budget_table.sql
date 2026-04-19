-- Budget table: stores AI-generated budget suggestions approved by users.
-- One row per P&L line item per fiscal year (5 rows per FY).

CREATE TABLE IF NOT EXISTS budget (
  id            SERIAL PRIMARY KEY,
  fiscal_year   VARCHAR(20)    NOT NULL,
  line_item     VARCHAR(50)    NOT NULL,
  annual_budget NUMERIC(15, 2) NOT NULL,
  monthly_budget NUMERIC(15, 2) NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (fiscal_year, line_item)
);
