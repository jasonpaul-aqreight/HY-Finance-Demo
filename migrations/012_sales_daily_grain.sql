-- ============================================================================
-- 012_sales_daily_grain.sql — Change pc_sales_by_* from monthly to daily grain
--
-- Changes:
--   1. pc_sales_by_customer: month TEXT → doc_date DATE, include CASH accounts
--   2. pc_sales_by_outlet:   month TEXT → doc_date DATE, include CASH accounts
--   3. pc_sales_by_fruit:    month TEXT → doc_date DATE
--
-- Why:
--   - Monthly grain caused group-by breakdowns to overcount when users picked
--     mid-month date ranges (e.g., Sep 15–Oct 15 included ALL of Sep + Oct).
--   - CASH DEBTOR/CASH SALES accounts were excluded from sales breakdowns
--     but included in summary KPIs, creating an 8% gap.
-- ============================================================================

-- ── pc_sales_by_customer ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS pc_sales_by_customer;
CREATE TABLE pc_sales_by_customer (
    doc_date            DATE NOT NULL,
    debtor_code         TEXT NOT NULL,
    company_name        TEXT,
    debtor_type         TEXT,
    sales_agent         TEXT,
    invoice_sales       REAL NOT NULL DEFAULT 0,
    cash_sales          REAL NOT NULL DEFAULT 0,
    credit_notes        REAL NOT NULL DEFAULT 0,
    total_sales         REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (debtor_code, doc_date)
);
CREATE INDEX idx_pc_sales_by_customer_date ON pc_sales_by_customer (doc_date);

-- ── pc_sales_by_outlet ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS pc_sales_by_outlet;
CREATE TABLE pc_sales_by_outlet (
    doc_date            DATE NOT NULL,
    dimension           TEXT NOT NULL,
    dimension_key       TEXT NOT NULL,
    dimension_label     TEXT,
    is_active           TEXT,
    invoice_sales       REAL NOT NULL DEFAULT 0,
    cash_sales          REAL NOT NULL DEFAULT 0,
    credit_notes        REAL NOT NULL DEFAULT 0,
    total_sales         REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    customer_count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (dimension, dimension_key, doc_date)
);
CREATE INDEX idx_pc_sales_by_outlet_date ON pc_sales_by_outlet (doc_date);

-- ── pc_sales_by_fruit ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS pc_sales_by_fruit;
CREATE TABLE pc_sales_by_fruit (
    doc_date            DATE NOT NULL,
    fruit_name          TEXT NOT NULL,
    fruit_country       TEXT NOT NULL DEFAULT '(Unknown)',
    fruit_variant       TEXT NOT NULL DEFAULT '(Unknown)',
    invoice_sales       REAL NOT NULL DEFAULT 0,
    cash_sales          REAL NOT NULL DEFAULT 0,
    credit_notes        REAL NOT NULL DEFAULT 0,
    total_sales         REAL NOT NULL DEFAULT 0,
    total_qty           REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (fruit_name, fruit_country, fruit_variant, doc_date)
);
CREATE INDEX idx_pc_sales_by_fruit_date ON pc_sales_by_fruit (doc_date);
