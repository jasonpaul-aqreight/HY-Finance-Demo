-- ============================================================================
-- 001_base_tables.sql — Lookup / reference tables for Hoi-Yong Finance
-- Only small, slowly-changing master data. All transaction tables live on RDS.
-- Column names kept as PascalCase to match AutoCount source.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- CUSTOMER & CUSTOMER TYPE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE customer (
    DebtorCode          TEXT PRIMARY KEY,
    CompanyName         TEXT,
    DebtorType          TEXT,
    SalesAgent          TEXT,
    DisplayTerm         TEXT,
    CreditLimit         REAL,
    AllowExceedCreditLimit TEXT,
    OverdueLimit        REAL DEFAULT 0,
    IsActive            TEXT,
    Attention           TEXT DEFAULT '',
    Phone1              TEXT DEFAULT '',
    Mobile              TEXT DEFAULT '',
    EmailAddress        TEXT DEFAULT '',
    AreaCode            TEXT DEFAULT '',
    CurrencyCode        TEXT DEFAULT 'MYR',
    CreatedTimeStamp    TEXT
);

CREATE TABLE customer_type (
    DebtorType          TEXT PRIMARY KEY,
    Description         TEXT,
    IsActive            TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- SUPPLIER & SUPPLIER TYPE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE supplier (
    AccNo               TEXT PRIMARY KEY,
    CompanyName         TEXT,
    CreditorType        TEXT,
    IsActive            TEXT,
    Attention           TEXT,
    Phone1              TEXT,
    Mobile              TEXT,
    EmailAddress        TEXT,
    DisplayTerm         TEXT,
    CreditLimit         REAL,
    CurrencyCode        TEXT,
    PurchaseAgent       TEXT,
    CreatedTimeStamp    TEXT
);

CREATE TABLE supplier_type (
    CreditorType        TEXT PRIMARY KEY,
    Description         TEXT,
    IsActive            TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- PRODUCT & PRODUCT GROUP
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE product (
    ItemCode            TEXT PRIMARY KEY,
    Description         TEXT,
    ItemGroup           TEXT,
    ItemType            TEXT,
    UDF_BoC             TEXT,
    Category            TEXT,
    Variety             TEXT,
    DisplayName         TEXT,
    FruitName           TEXT,
    FruitCountry        TEXT,
    FruitVariant        TEXT,
    IsActive            TEXT
);

CREATE TABLE product_group (
    ItemGroup           TEXT PRIMARY KEY,
    Description         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- SALES AGENT
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE sales_agent (
    SalesAgent          TEXT PRIMARY KEY,
    Description         TEXT,
    IsActive            TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- GENERAL LEDGER ACCOUNTS & ACCOUNT TYPES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE gl_account (
    AccNo               TEXT PRIMARY KEY,
    ParentAccNo         TEXT,
    Description         TEXT,
    AccType             TEXT NOT NULL,
    SpecialAccType      TEXT
);

CREATE TABLE account_type (
    AccType             TEXT PRIMARY KEY,
    Description         TEXT NOT NULL,
    IsBSType            TEXT NOT NULL
);

-- ────────────────────────────────────────────────────────────────────────────
-- FISCAL YEAR & PROJECT
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE fiscal_year (
    FiscalYearName      TEXT PRIMARY KEY,
    FromDate            TEXT NOT NULL,
    ToDate              TEXT NOT NULL,
    IsActive            TEXT NOT NULL
);

CREATE TABLE project (
    ProjNo              TEXT PRIMARY KEY,
    Description         TEXT NOT NULL,
    IsActive            TEXT DEFAULT 'T'
);

-- ────────────────────────────────────────────────────────────────────────────
-- P&L AND BALANCE SHEET FORMAT (rendering config for financial statements)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE pl_format (
    Seq                 INTEGER PRIMARY KEY,
    RowType             TEXT NOT NULL,
    AccType             TEXT,
    Description         TEXT,
    CreditAsPositive    TEXT NOT NULL
);

CREATE TABLE bs_format (
    Seq                 INTEGER PRIMARY KEY,
    RowType             TEXT NOT NULL,
    AccType             TEXT,
    Description         TEXT,
    CreditAsPositive    TEXT NOT NULL
);
