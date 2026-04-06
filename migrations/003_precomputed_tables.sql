-- ============================================================================
-- 003_precomputed_tables.sql — 17 pre-computed tables (pc_* prefix)
--
-- These replace the old materialized views and raw transaction tables.
-- The sync service queries RDS, runs aggregations, and writes results here.
-- Dashboard reads with simple SELECTs — no JOINs needed.
--
-- Design constraints:
--   1. Monthly grain — all pc_* tables keyed by YYYY-MM month
--   2. Full rebuild — each sync truncates and rebuilds (~120K rows, <30s)
--   3. Swap pattern — write to _staging, rename in single transaction
--   4. Denormalized labels — names, types, agents baked in (~24hr lag OK)
--   5. Snapshot tables (ar_customer, aging) are point-in-time, not monthly
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SALES (4 tables)
-- ════════════════════════════════════════════════════════════════════════════

-- Daily sales trend (IV + CS − CN), supports daily/weekly/monthly aggregation
CREATE TABLE pc_sales_daily (
    doc_date            DATE NOT NULL,
    invoice_total       REAL NOT NULL DEFAULT 0,
    cash_total          REAL NOT NULL DEFAULT 0,
    cn_total            REAL NOT NULL DEFAULT 0,
    net_revenue         REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (doc_date)
);

-- Sales by customer × month
-- Covers: getByCustomer, getCustomerSalesSummary, getCustomerSalesTrend
CREATE TABLE pc_sales_by_customer (
    month               TEXT NOT NULL,          -- YYYY-MM
    debtor_code         TEXT NOT NULL,
    company_name        TEXT,
    debtor_type         TEXT,
    sales_agent         TEXT,
    invoice_sales       REAL NOT NULL DEFAULT 0,
    cash_sales          REAL NOT NULL DEFAULT 0,
    credit_notes        REAL NOT NULL DEFAULT 0,
    total_sales         REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (debtor_code, month)
);

-- Sales by dimension (type / agent / location) × month
-- dimension = 'type' | 'agent' | 'location'
-- Covers: getByCustomerType, getByAgent, getByOutlet
CREATE TABLE pc_sales_by_outlet (
    month               TEXT NOT NULL,          -- YYYY-MM
    dimension           TEXT NOT NULL,          -- 'type', 'agent', 'location'
    dimension_key       TEXT NOT NULL,          -- the actual type/agent/location value
    dimension_label     TEXT,                   -- description or display name
    is_active           TEXT,                   -- for agents: active status
    invoice_sales       REAL NOT NULL DEFAULT 0,
    cash_sales          REAL NOT NULL DEFAULT 0,
    credit_notes        REAL NOT NULL DEFAULT 0,
    total_sales         REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    customer_count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (dimension, dimension_key, month)
);

-- Sales by fruit × month (from line-item detail)
-- Covers: getByFruit
CREATE TABLE pc_sales_by_fruit (
    month               TEXT NOT NULL,          -- YYYY-MM
    fruit_name          TEXT NOT NULL,
    fruit_country       TEXT NOT NULL DEFAULT '(Unknown)',
    fruit_variant       TEXT NOT NULL DEFAULT '(Unknown)',
    invoice_sales       REAL NOT NULL DEFAULT 0,
    cash_sales          REAL NOT NULL DEFAULT 0,
    credit_notes        REAL NOT NULL DEFAULT 0,
    total_sales         REAL NOT NULL DEFAULT 0,
    total_qty           REAL NOT NULL DEFAULT 0,
    doc_count           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (fruit_name, fruit_country, fruit_variant, month)
);


-- ════════════════════════════════════════════════════════════════════════════
-- PAYMENT / AR (3 tables)
-- ════════════════════════════════════════════════════════════════════════════

-- Monthly AR activity: invoiced, collected, CN applied, refunded, DSO inputs
-- Covers: getCollectionTrend, getDsoTrend, getDsoTrendV2
CREATE TABLE pc_ar_monthly (
    month               TEXT NOT NULL PRIMARY KEY,  -- YYYY-MM
    invoiced            REAL NOT NULL DEFAULT 0,
    collected           REAL NOT NULL DEFAULT 0,
    cn_applied          REAL NOT NULL DEFAULT 0,
    refunded            REAL NOT NULL DEFAULT 0,
    total_outstanding   REAL NOT NULL DEFAULT 0,
    total_billed        REAL NOT NULL DEFAULT 0,
    customer_count      INTEGER NOT NULL DEFAULT 0
);

-- Per-customer AR snapshot (refreshed daily, not monthly grain)
-- Covers: getKpis, getCreditHealthTable, getCreditUtilization, getCustomerProfile
CREATE TABLE pc_ar_customer_snapshot (
    snapshot_date       TEXT NOT NULL,          -- YYYY-MM-DD
    debtor_code         TEXT NOT NULL,
    company_name        TEXT,
    debtor_type         TEXT,
    sales_agent         TEXT,
    display_term        TEXT,
    credit_limit        REAL DEFAULT 0,
    overdue_limit       REAL DEFAULT 0,
    is_active           TEXT,
    total_outstanding   REAL NOT NULL DEFAULT 0,
    overdue_amount      REAL NOT NULL DEFAULT 0,
    oldest_due_date     TEXT,                  -- YYYY-MM-DD
    max_overdue_days    INTEGER DEFAULT 0,
    invoice_count       INTEGER DEFAULT 0,
    utilization_pct     REAL,
    avg_payment_days    REAL,                  -- average days to pay (timeliness)
    credit_score        REAL,
    risk_tier           TEXT,                  -- 'low', 'moderate', 'elevated', 'high'
    -- Contact info (denormalized from customer for profile view)
    attention           TEXT DEFAULT '',
    phone1              TEXT DEFAULT '',
    mobile              TEXT DEFAULT '',
    email_address       TEXT DEFAULT '',
    area_code           TEXT DEFAULT '',
    currency_code       TEXT DEFAULT 'MYR',
    created_timestamp   TEXT,
    PRIMARY KEY (snapshot_date, debtor_code)
);

-- Aging bucket snapshots over time
-- Covers: getAgingBuckets, getAgingBucketsByDimension
CREATE TABLE pc_ar_aging_history (
    snapshot_date       TEXT NOT NULL,          -- YYYY-MM-DD
    bucket              TEXT NOT NULL,          -- 'Not Yet Due','1-30','31-60','61-90','91-120','120+'
    dimension           TEXT NOT NULL DEFAULT 'all', -- 'all', 'type:{value}', 'agent:{value}'
    invoice_count       INTEGER NOT NULL DEFAULT 0,
    total_outstanding   REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (snapshot_date, bucket, dimension)
);


-- ════════════════════════════════════════════════════════════════════════════
-- RETURN / CREDIT NOTE (4 tables)
-- ════════════════════════════════════════════════════════════════════════════

-- Monthly return overview (cntype = 'RETURN' only)
-- Covers: getReturnOverview, getReturnTrend
CREATE TABLE pc_return_monthly (
    month               TEXT NOT NULL PRIMARY KEY,  -- YYYY-MM
    cn_count            INTEGER NOT NULL DEFAULT 0,
    cn_total            REAL NOT NULL DEFAULT 0,
    knock_off_total     REAL NOT NULL DEFAULT 0,
    refund_total        REAL NOT NULL DEFAULT 0,
    unresolved_total    REAL NOT NULL DEFAULT 0,
    reconciled_count    INTEGER NOT NULL DEFAULT 0,
    partial_count       INTEGER NOT NULL DEFAULT 0,
    outstanding_count   INTEGER NOT NULL DEFAULT 0
);

-- Returns by customer × month
-- Covers: getAllCustomerReturns
CREATE TABLE pc_return_by_customer (
    month               TEXT NOT NULL,          -- YYYY-MM
    debtor_code         TEXT NOT NULL,
    company_name        TEXT,
    cn_count            INTEGER NOT NULL DEFAULT 0,
    cn_total            REAL NOT NULL DEFAULT 0,
    knock_off_total     REAL NOT NULL DEFAULT 0,
    refund_total        REAL NOT NULL DEFAULT 0,
    unresolved          REAL NOT NULL DEFAULT 0,
    outstanding_count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (debtor_code, month)
);

-- Return products by item × month (line-item detail)
-- Covers: getReturnProducts
CREATE TABLE pc_return_products (
    month               TEXT NOT NULL,          -- YYYY-MM
    item_code           TEXT NOT NULL,
    item_description    TEXT,
    fruit_name          TEXT,
    fruit_country       TEXT,
    fruit_variant       TEXT,
    line_count          INTEGER NOT NULL DEFAULT 0,
    total_qty           REAL NOT NULL DEFAULT 0,
    total_amount        REAL NOT NULL DEFAULT 0,
    goods_return_count  INTEGER NOT NULL DEFAULT 0,
    credit_only_count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_code, month)
);

-- Return aging buckets (point-in-time snapshot of unresolved CN aging)
-- Covers: getReturnAging
CREATE TABLE pc_return_aging (
    snapshot_date       TEXT NOT NULL,          -- YYYY-MM-DD
    bucket              TEXT NOT NULL,          -- '0-30 days','31-60 days','61-90 days','91-180 days','180+ days'
    count               INTEGER NOT NULL DEFAULT 0,
    amount              REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (snapshot_date, bucket)
);


-- ════════════════════════════════════════════════════════════════════════════
-- CUSTOMER MARGIN (2 tables)
-- ════════════════════════════════════════════════════════════════════════════

-- Customer margin by debtor × month (IV + DN − CN)
-- Covers: getMarginKpi, getMarginTrend, getCustomerMargins, getCustomerMonthly,
--         getMarginByType, getMarginDistribution, getCreditNoteImpact
CREATE TABLE pc_customer_margin (
    month               TEXT NOT NULL,          -- YYYY-MM
    debtor_code         TEXT NOT NULL,
    company_name        TEXT,
    debtor_type         TEXT,
    sales_agent         TEXT,
    iv_revenue          REAL NOT NULL DEFAULT 0,
    iv_cost             REAL NOT NULL DEFAULT 0,
    cn_revenue          REAL NOT NULL DEFAULT 0,
    cn_cost             REAL NOT NULL DEFAULT 0,
    dn_revenue          REAL NOT NULL DEFAULT 0,
    dn_cost             REAL NOT NULL DEFAULT 0,
    iv_count            INTEGER NOT NULL DEFAULT 0,
    cn_count            INTEGER NOT NULL DEFAULT 0,
    dn_count            INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (debtor_code, month)
);

-- Customer margin by debtor × product group × month
-- Covers: getMarginByProductGroup, getProductCustomerMatrix, getCustomerProducts
CREATE TABLE pc_customer_margin_by_product (
    month               TEXT NOT NULL,          -- YYYY-MM
    debtor_code         TEXT NOT NULL,
    item_group          TEXT NOT NULL,
    item_group_desc     TEXT,
    revenue             REAL NOT NULL DEFAULT 0,
    cogs                REAL NOT NULL DEFAULT 0,
    qty_sold            REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (debtor_code, item_group, month)
);


-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER MARGIN (1 table)
-- ════════════════════════════════════════════════════════════════════════════

-- Supplier margin at supplier × item × month grain
-- Most granular level; dashboard aggregates up for summaries, trends, tables.
-- Covers: getMarginSummary, getMarginTrend, getSupplierTable, getSupplierItems,
--         getPriceComparison, getPriceSpread, getTopBottomSuppliers/Items,
--         getMarginByItemGroup, getSupplierSparklines
CREATE TABLE pc_supplier_margin (
    month               TEXT NOT NULL,          -- YYYY-MM
    creditor_code       TEXT NOT NULL,
    creditor_name       TEXT,
    creditor_type       TEXT,
    item_code           TEXT NOT NULL,
    item_description    TEXT,
    item_group          TEXT,
    fruit_name          TEXT,
    purchase_qty        REAL NOT NULL DEFAULT 0,
    purchase_total      REAL NOT NULL DEFAULT 0,
    avg_unit_cost       REAL DEFAULT 0,
    -- Attributed sales (item-matched from IV+CS)
    sales_qty           REAL NOT NULL DEFAULT 0,
    sales_revenue       REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (creditor_code, item_code, month)
);


-- ════════════════════════════════════════════════════════════════════════════
-- P&L (2 tables)
-- ════════════════════════════════════════════════════════════════════════════

-- P&L period balances (pre-joined with gl_account metadata)
-- Covers: getV2PLKpis, getV2PLMonthly, getV2PLStatement, getV2Segments,
--         getV2Expenses, getV2YoY, getV3PLKpis, getMultiYearPL
CREATE TABLE pc_pnl_period (
    period_no           INTEGER NOT NULL,
    acc_no              TEXT NOT NULL,
    proj_no             TEXT NOT NULL DEFAULT '',
    account_name        TEXT,
    acc_type            TEXT,
    parent_acc_no       TEXT,
    home_dr             REAL NOT NULL DEFAULT 0,
    home_cr             REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (period_no, acc_no, proj_no)
);

-- Opening balances for balance sheet
-- Covers: getV3BSComparison, getV3BSTrend, getV2Health
CREATE TABLE pc_opening_balance (
    period_no           INTEGER NOT NULL,
    acc_no              TEXT NOT NULL,
    proj_no             TEXT NOT NULL DEFAULT '',
    home_dr             REAL NOT NULL DEFAULT 0,
    home_cr             REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (period_no, acc_no, proj_no)
);


-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSES (1 table)
-- ════════════════════════════════════════════════════════════════════════════

-- Monthly expense by GL account (CO + EP account types)
-- Covers: getCostKpis, getCostTrend, getCostComposition, getTopExpenses,
--         getCogsBreakdown, getOpexBreakdown
CREATE TABLE pc_expense_monthly (
    month               TEXT NOT NULL,          -- YYYY-MM
    acc_no              TEXT NOT NULL,
    account_name        TEXT,
    parent_acc_no       TEXT,
    acc_type            TEXT,                   -- 'CO' (COGS) or 'EP' (OpEx)
    total_dr            REAL NOT NULL DEFAULT 0,
    total_cr            REAL NOT NULL DEFAULT 0,
    net_amount          REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (acc_no, month)
);


-- ════════════════════════════════════════════════════════════════════════════
-- INDEXES on pre-computed tables
-- ════════════════════════════════════════════════════════════════════════════

-- Sales
CREATE INDEX idx_pc_sales_cust_month ON pc_sales_by_customer(month);
CREATE INDEX idx_pc_sales_cust_type ON pc_sales_by_customer(debtor_type);
CREATE INDEX idx_pc_sales_outlet_dim ON pc_sales_by_outlet(dimension, month);
CREATE INDEX idx_pc_sales_fruit_month ON pc_sales_by_fruit(month);

-- Payment / AR
CREATE INDEX idx_pc_ar_snap_date ON pc_ar_customer_snapshot(snapshot_date);
CREATE INDEX idx_pc_ar_snap_debtor ON pc_ar_customer_snapshot(debtor_code);
CREATE INDEX idx_pc_ar_snap_type ON pc_ar_customer_snapshot(debtor_type);
CREATE INDEX idx_pc_ar_snap_agent ON pc_ar_customer_snapshot(sales_agent);
CREATE INDEX idx_pc_ar_snap_risk ON pc_ar_customer_snapshot(risk_tier);
CREATE INDEX idx_pc_ar_aging_date ON pc_ar_aging_history(snapshot_date);

-- Return
CREATE INDEX idx_pc_return_cust_month ON pc_return_by_customer(month);
CREATE INDEX idx_pc_return_prod_month ON pc_return_products(month);
CREATE INDEX idx_pc_return_aging_date ON pc_return_aging(snapshot_date);

-- Customer Margin
CREATE INDEX idx_pc_cmargin_month ON pc_customer_margin(month);
CREATE INDEX idx_pc_cmargin_type ON pc_customer_margin(debtor_type);
CREATE INDEX idx_pc_cmargin_agent ON pc_customer_margin(sales_agent);
CREATE INDEX idx_pc_cmargin_prod_month ON pc_customer_margin_by_product(month);
CREATE INDEX idx_pc_cmargin_prod_debtor ON pc_customer_margin_by_product(debtor_code, month);

-- Supplier Margin
CREATE INDEX idx_pc_smargin_month ON pc_supplier_margin(month);
CREATE INDEX idx_pc_smargin_creditor ON pc_supplier_margin(creditor_code, month);
CREATE INDEX idx_pc_smargin_item ON pc_supplier_margin(item_code, month);
CREATE INDEX idx_pc_smargin_group ON pc_supplier_margin(item_group, month);

-- P&L
CREATE INDEX idx_pc_pnl_acctype ON pc_pnl_period(acc_type);
CREATE INDEX idx_pc_pnl_proj ON pc_pnl_period(proj_no);
CREATE INDEX idx_pc_ob_period ON pc_opening_balance(period_no);

-- Expenses
CREATE INDEX idx_pc_expense_month ON pc_expense_monthly(month);
CREATE INDEX idx_pc_expense_type ON pc_expense_monthly(acc_type);
