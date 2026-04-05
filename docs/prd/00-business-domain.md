# Finance Dashboard Module — Business Domain & Rules

> This document describes the business context, data model, and rules for the Finance Dashboard module.
> It is **tech-stack agnostic** — no code, no SQL, no framework references. Written for a PM to create a PRD.

---

## 1. Business Context

### Company Profile

- **Company:** Hoi-Yong — a fruit and produce distributor based in Malaysia
- **Annual Revenue:** Approximately RM 80–88 million
- **Customer Base:** ~710 customers (wholesalers, retailers, market traders, supermarkets)
- **Supplier Base:** ~452 suppliers (farms, importers, consolidators)
- **Product Catalog:** ~6,400 items (fruits, packaging materials, logistics items)
- **Currency:** MYR (Malaysian Ringgit), displayed as "RM" (e.g., "RM 1,234")
- **Rare exception:** Some SGD-denominated records exist — always use AutoCount `Local*` fields (e.g., `LocalNetTotal`) for consistent MYR reporting

### Source System

All financial data originates from **AutoCount Accounting**, a full-featured ERP system. The dashboard reads from AutoCount's database and presents pre-aggregated analytics for management decision-making.

### Target Users

| Role | Access Level | Primary Interest |
|------|-------------|-----------------|
| Admin | Full (read + settings) | System configuration, data sync management |
| Director, Finance | Viewer (read-only) | P&L oversight, margin analysis, net sales trends, payment collection, expense monitoring |

Other application roles (`sales`, `hr`, `management`) do not have access to Finance module pages.

**Readability requirement:** End users are older executives. All text must be high-contrast and easily readable — never use gray, muted, or low-contrast text for important labels or data.

---

## 2. Module Overview

The Finance Dashboard is one module in a larger production application (which already includes Sales and HR modules). It provides 7 main dashboard pages, 1 settings page, and 1 admin page:

| # | Page Name | Purpose |
|---|-----------|---------|
| 1 | **Sales Report** | Net sales tracking (daily/weekly/monthly) — invoices, cash sales, credit notes |
| 2 | **Payment Collection** | Customer credit health, payment aging, outstanding amounts, credit scoring |
| 3 | **Returns** | Credit note tracking, return reconciliation, product return analysis |
| 4 | **Financial Statements** | Profit & Loss statement, Year-over-Year comparison, Balance Sheet |
| 5 | **Expenses** | Cost of Sales (COGS) and Operating Costs (OPEX) breakdown, expense trend analysis, top expenses |
| 6 | **Customer Margin** | Profit margin by customer — identify high-value relationships |
| 7 | **Supplier Performance** | Profit margin by supplier — procurement analysis, price comparison |
| 8 | **Payment Settings** | Configure credit score weights and risk thresholds |
| 9 | **Data Sync (Admin)** | Manage data synchronization from AutoCount to the dashboard |

---

## 3. Navigation & Layout

### Sidebar Navigation

The Finance module integrates into the existing production dashboard sidebar (which already includes Sales, HR, and other modules). Finance appears as a **collapsible navigation group**, collapsed by default.

**Finance Group (when expanded):**

| Order | Label | Icon Description |
|-------|-------|-----------------|
| 1 | Sales Report | Upward trend line |
| 2 | Payment | Credit card |
| 3 | Returns | Circular arrow (undo) |
| 4 | Financials | Bar chart |
| 5 | Expenses | Receipt |
| 6 | Customer Margin | People/users |
| 7 | Supplier Performance | Truck |

**Data Sync:** The Finance sync functionality merges into the existing application-level Sync tab (shared with Sales and HR sync operations).

### Sidebar Behavior

- **Collapsed state:** Shows icons only with tooltips on hover. Narrow width (~64px).
- **Expanded state:** Shows icon + label text. Width ~224px.
- **Active indicator:** Current page is highlighted. Sub-pages highlight their parent (e.g., Payment Settings highlights "Payment").
- **Header:** Displays the company logo when expanded.

### Page Layout Pattern

Every dashboard page follows a consistent structure:

1. **Filter Bar** — Date range controls and page-specific filters.
2. **KPI Summary Cards** — Row of metric cards showing key numbers at a glance.
3. **Charts** — Trend lines, bar charts, distribution charts for visual analysis.
4. **Tables / Detail Sections** — Sortable, paginated data tables or tabbed content areas.

**Content constraints:**
- Maximum content width: 1600px, horizontally centered
- Scrollable main content area (sidebar remains fixed)

---

## 4. Shared Features

### 4.1 Date Range Filter

Used across 6 pages (Sales, Payment, Returns, Expenses, Customer Margin, Supplier Performance).

**Controls:**
- Two month-year pickers (start and end)
- Arrow separator between pickers
- Range summary text (e.g., "Mar 2024 – Feb 2025 (12 months)")

**Preset Buttons:**

| Button | Behavior |
|--------|----------|
| 3M | Last 3 months from the latest available data |
| 6M | Last 6 months from the latest available data |
| 12M | Last 12 months from the latest available data |
| YTD | January 1 of current year to the latest available data |

**Key behaviors:**
- Presets calculate relative to the **latest data date** (not today's date), ensuring presets always show data even if sync hasn't run today
- Pickers are bounded by earliest and latest available dates from the database
- Default initialization: last 12 months from the latest data date

**Exception:** Financial Statements page uses a **financial year dropdown** instead of date range pickers (see Section 8.4).

### 4.2 Entity Profile Modal (Shared Pattern)

Both the Customer and Supplier profile modals share the same design pattern: a large overlay (90% viewport width and height) with a **multi-view architecture** — a main profile view plus detail sub-views. The shared pattern is described here; entity-specific sections follow.

**Shared Header (always visible):**
- Company name (large, bold, full display)
- Entity code (customer code or creditor code)
- Active/Inactive status badge (green or red)
- Entity type badge ("CUSTOMER" in blue, "SUPPLIER" in indigo)

---

#### 4.2.1 Customer Profile Modal

Accessible from multiple pages. Provides a 360-degree view of a single customer.

**Profile View — Section A: Customer Details + Logs (side by side)**

Left — "Customer Details" card with three columns:

| Column | Fields |
|--------|--------|
| General | Customer Type, Sales Agent, Customer Since |
| Contact | Contact Person, Phone, Mobile, Email |
| Financial | Credit Limit, Payment Terms, Currency |

Right — "Logs" panel (3 clickable buttons, each navigating to a sub-view):

| Button | Badge | Opens |
|--------|-------|-------|
| Outstanding Invoices | Red count badge if any outstanding | Outstanding sub-view |
| Return Records | Amber count badge if any unsettled | Returns sub-view |
| Sales Transactions | No badge | Sales sub-view |

**Profile View — Section B: Statistics (lifetime snapshots, no date filter)**

Four equal cards in a row:

1. **Credit Health Score** — Half-gauge (0–100 scale), color-coded green/amber/red. Shows Risk Tier badge (Low/Moderate/High) and lifetime average payment days.
2. **Credit Usage** — Donut chart showing utilization percentage. Color: green <80%, amber 80–100%, red >100%. Shows outstanding amount and credit limit below.
3. **Outstanding Invoices** — Horizontal stacked bar by aging bucket (Not Due, 1–30, 31–60, 61–90, 91–120, 120+ days) with inline legend showing amounts per bucket. Shows overdue total below.
4. **Returns** — Donut chart showing Settled vs Unsettled count. Shows unsettled amount below.

**Profile View — Section C: Trends (date-filtered)**

A shared date range picker controls all three trend charts simultaneously:

1. **Sales & Margin** — KPIs: Net Sales, Avg Margin %, Cost of Sales. Chart: net sales bars + margin % line (dual axis, monthly).
2. **Payment** — KPIs: Collection amount, Collection Rate %, Avg Pay Days. Chart: invoiced bars + collected bars + collection rate % line.
3. **Returns** — KPIs: Total Returns amount, Count. Chart: return value trend line.

**Detail Sub-Views (accessed from Logs panel — not tabs, the entire body swaps):**

| Sub-View | Content | Features |
|----------|---------|----------|
| Outstanding Invoices | Table of unpaid invoices with Doc No, dates, amounts, days overdue | Search by doc number, sortable, no pagination |
| Return Records | Table of credit notes with amounts, knockoff, refund, unsettled status | Search by doc number, sortable, no pagination |
| Sales Transactions | Table of items sold with qty, net sales, cost, margin % | Own independent date range filter, server-side pagination, Excel export |

**Context-sensitive default view:**

| Calling Page | Default View |
|-------------|-------------|
| Payment | Outstanding Invoices |
| Returns | Return Records |
| Sales | Profile (main) |
| Customer Margin | Sales Transactions |

#### 4.2.2 Supplier Profile Modal

Accessible from Supplier Performance page. Uses the shared Entity Profile Modal pattern (see 4.2 above).

**Profile View — Section A: Supplier Details + Log (side by side)**

Left — "Supplier Details" card with three columns:

| Column | Fields |
|--------|--------|
| General | Supplier Type, Purchase Agent, Supplier Since |
| Contact | Contact Person, Phone, Mobile, Email |
| Terms | Payment Terms, Credit Limit, Currency |

Right — "Log" panel with a single clickable button: **"Items Supplied"** → navigates to Items view.

**Context-sensitive default view:**

| Calling Context | Default View |
|----------------|-------------|
| Supplier Performance table row | Items view (opens directly to items list) |
| All other contexts | Profile view |

**Profile View — Section B: Performance (date-filtered)**

A date range picker controls all performance visuals. Two rows:

*Statistics row (2 cards):*

1. **Margin Performance** — Semicircle gauge (0–50% scale), color: green ≥20%, amber ≥10%, red <10%. Shows average margin percentage.
2. **Supply Dependency** — Sole-supplier count (amber) out of total product variants. Horizontal stacked bar showing multi-source (blue) vs. sole-supplier (amber) proportions.

*Trend charts row (2 charts):*

1. **Purchase Trend & Margin** — KPIs: Purchase Cost, Avg Margin %, Est. Gross Profit. Chart: purchase cost bars + margin % line (dual axis, monthly).
2. **Top 5 Items** — Toggle between "Est. Gross Profit" and "Margin %" modes. KPIs: Top Item name, top value, Top 5 total. Horizontal bar chart of top 5 items.

**Items View (accessed from Log panel — entire body swaps):**

- Back arrow to return to profile
- Disclaimer note explaining that net sales, cost of sales, and profit are estimated allocations based on purchase share
- **Own independent date range filter** (separate from profile performance date range)
- **Sole Source Only** toggle filter — filters to items where this is the only supplier for that product variant (amber styling when active)
- **Product** and **Variant** cascading dropdown filters
- Items table with columns: sole-source icon, Item Code, Description, Qty Purchased, Avg Purchase Price, Price Trend (sparkline), Est. Net Sales, Est. Cost of Sales, Margin %
- **Price Trend sparklines:** Inline mini line charts (green = price stable/decreasing, red = price increasing). Click to expand a popover with full chart and monthly price data table.
- Sole-source rows highlighted with subtle amber background

---

## 5. Data Model (Business Entities)

### 5.1 Entity Overview

The system works with these core business entities:

| Entity | Description | Approximate Count |
|--------|-------------|-------------------|
| **Customer** | Buyers of Hoi-Yong's products (wholesalers, retailers, etc.) | ~710 |
| **Customer Type** | Classification of customers (e.g., wholesaler, retailer) | 7 |
| **Supplier** | Vendors who supply products to Hoi-Yong | ~452 |
| **Supplier Type** | Classification of suppliers | 3 |
| **Product** | Individual items in the catalog (fruits, packing materials, etc.) | ~6,400 |
| **Product Group** | Category hierarchy for products | 7 |
| **Sales Agent** | Sales representatives managing customer relationships | ~21 |
| **GL Account** | Chart of accounts (revenue, cost, expense, asset, liability accounts) | ~1,576 |
| **Account Type** | Classification of GL accounts (Sales, COGS, Expense, Asset, etc.) | 16 |
| **Financial Year** | Defined financial year periods (Hoi-Yong uses March–February financial year) | ~8 |
| **Project** | Project or branch codes | ~4 |

### 5.2 Transaction Types

| Transaction | Abbreviation | Description | Volume |
|------------|--------------|-------------|--------|
| **Invoice** | IV | Credit sales to customers (pay-later terms) | ~119K headers, ~1M line items |
| **Cash Sale** | CS | Immediate-payment sales (POS / cash-on-delivery) | ~52K headers, ~379K line items |
| **Credit Note** | CN | Returns, adjustments, refunds issued to customers | ~8.7K headers, ~59K line items |
| **Debit Note** | DN | Supplier credits or rebates received | ~71 headers, ~96 line items |
| **AR Invoice** | — | Accounts receivable invoice records (for aging/payment tracking) | ~171K |
| **AR Payment** | — | Customer payment receipts | ~70K |
| **AR Credit Note** | — | AR-level credit adjustments | ~26K |
| **AR Refund** | — | Cash refunds to customers | ~98 |
| **Purchase Invoice** | PI | Purchases from suppliers | ~45K headers, ~136K line items |
| **GL Entry** | — | General ledger journal lines (all accounting entries) | ~2.2M |

### 5.3 Product Classification (Fruit Taxonomy)

Products are classified into a fruit taxonomy with three levels:

| Level | Example |
|-------|---------|
| **Fruit Name** | Apple, Banana, Mango, Dragon Fruit, Durian |
| **Country of Origin** | USA, China, Australia, Malaysia |
| **Variant** | Fuji, Gala, Cavendish |

**Classification method:**
- **Primary (Tier 1):** Parsed from a structured field (`UDF_BoC`) on the product record (format: "FRUIT → COUNTRY → VARIANT")
- **Fallback (Tier 2):** Pattern-matched from the product description against reference lookup tables of canonical fruit names, countries, and variants
- Products that cannot be classified are marked "Uncategorized"

> **See:** [Fruit Taxonomy Reference](./ref-fruit-taxonomy.md) for detailed parsing rules, reference table structure, alias mappings, and matching algorithm.

**Excluded items:** Products with certain code prefixes (packing materials, pallets, non-product items) are excluded from fruit-based analysis.

### 5.4 Cash vs. Credit Customer Distinction

Two categories of cash-related customer accounts exist in the system, with different treatment:

**Generic "CASH SALES" account (300-C016)**
- An anonymous walk-in bucket with no customer identity
- **Included** in sales revenue totals (cash is valid revenue)
- **Excluded** from payment/AR, return, and customer margin analysis (no identifiable customer relationship)

**Named "CASH DEBTOR-xxx" accounts (~42 accounts)**
- Real businesses and individuals with names, credit limits, payment terms, and repeat transactions
- The word "CASH" in these account names is an accounting artifact — they operate as credit customers
- **Included** in all modules: sales revenue, payment/AR, return analysis, and customer margin

---

## 6. Core Business Rules & Formulas

### 6.1 Revenue

```
Net Revenue = Invoice Sales + Cash Sales − Credit Notes
```

- **Invoice Sales:** Sum of all non-cancelled invoice totals
- **Cash Sales:** Sum of all non-cancelled cash sale totals (includes POS transactions)
- **Credit Notes:** Sum of all non-cancelled credit note totals (subtracted from revenue)
- Invoices and Cash Sales are **mutually exclusive** — no double-counting risk

### 6.2 Cancelled Records

All calculations **exclude cancelled records**. Only documents marked as non-cancelled contribute to any metric.

**Edge case:** Some older **credit note (CN)** and **debit note (DN)** records have a missing (null) cancellation flag instead of explicitly being marked non-cancelled. These are treated as non-cancelled (included in calculations). CN null handling applies in the sync service (return-related aggregations); DN null handling applies in both the sync service and dashboard queries (customer margin calculations).

### 6.3 Timezone Handling

- AutoCount stores all dates in **UTC**
- The dashboard converts to **MYT (Malaysia Time, UTC+8)** before any date grouping or display
- All month keys (e.g., "2025-03") are derived from the Malaysia-time date, not UTC

### 6.4 Currency

- All amounts are in **MYR (Malaysian Ringgit)**
- Display format: "RM" prefix with thousands separators, no decimals by default (e.g., "RM 1,234")
- For rare SGD-denominated records, AutoCount `Local*` fields (e.g., `LocalNetTotal`, `LocalSubTotal`) are used to ensure consistent MYR reporting. See [Data Dictionary Section 9.4](ref-data-dictionary.md#94-multi-currency-handling) for the full field mapping and access patterns.
- Percentages: one decimal place with explicit +/− sign (e.g., "+12.3%", "−4.1%")
- Non-finite values (division by zero, etc.): display as em-dash ("—")
- Growth coloring: **green** for positive, **red** for negative, muted for null/non-finite

### 6.5 Margin Calculation (Universal)

Used consistently across Customer Margin, Supplier Performance, and Financial Statements:

```
Gross Profit = Net Sales − Cost of Sales (COGS)
Margin % = (Gross Profit ÷ Net Sales) × 100
```

For **customer margin** specifically:
```
Net Sales = Invoice Net Sales + Debit Note Net Sales − Credit Note Net Sales
Cost of Sales = Invoice Cost + Debit Note Cost − Credit Note Cost
```

- **Debit Notes** (supplier credits/rebates) are treated as positive adjustments — they increase revenue and reduce COGS, improving the customer's margin

### 6.6 Supplier COGS Attribution

When multiple suppliers provide the same product, COGS and sales revenue are **attributed proportionally** based on each supplier's share of that product's total purchases in the month:

```
Supplier's Attributed Sales = Total Item Sales × (Supplier's Purchase Qty ÷ Total Item Purchase Qty)
Supplier's Attributed COGS = Supplier's Purchase Total × (Item Sold Qty ÷ Total Item Purchase Qty)
```

This means suppliers "compete" for COGS attribution based on their purchase share for each item.

### 6.7 Credit Scoring Algorithm (V2)

A **4-factor weighted model** that scores each customer's credit health from 0 to 100:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Credit Usage | 40% | How much of their credit limit is used |
| Overdue Days | 30% | How long their oldest invoice is overdue |
| Payment Timeliness | 20% | Average lateness of payments (last 12 months) |
| Double Breach | 10% | Whether they've exceeded BOTH credit limit AND overdue limit |

**Utilization Score (40% weight):**
- No credit limit set → neutral score of 50
- Has credit limit → Score = max(0, 100 − utilization%)
- Where utilization% = (outstanding ÷ credit limit) × 100

**Overdue Days Score (30% weight):**

| Oldest Overdue | Score |
|----------------|-------|
| 0 days (current) | 100 |
| 1–30 days | 80 |
| 31–60 days | 60 |
| 61–90 days | 40 |
| 91–120 days | 20 |
| Over 120 days | 0 |

**Payment Timeliness Score (20% weight):**

| Average Days Late | Score |
|-------------------|-------|
| No payment history | 50 (neutral) |
| On time or early | 100 |
| 1–7 days late | 80 |
| 8–14 days late | 60 |
| 15–30 days late | 40 |
| 31–60 days late | 20 |
| Over 60 days late | 0 |

**Double Breach Score (10% weight):**
- If customer exceeds BOTH credit limit AND overdue limit → score = 0
- Otherwise → score = 100

**Final Credit Score:**
```
Score = (Utilization × 0.40) + (Overdue Days × 0.30) + (Timeliness × 0.20) + (Double Breach × 0.10)
```

**Risk Tier Classification:**

| Score Range | Risk Tier |
|-------------|-----------|
| 75 and above | Low Risk |
| 31 to 74 | Moderate Risk |
| 30 and below | High Risk |

**Configurable:** The weights and tier thresholds can be adjusted by the user via the Payment Settings page.

### 6.8 Avg Collection Days

```
Avg Collection Days = (Accounts Receivable Outstanding ÷ Monthly Credit Sales) × Days in Month
Collection Rate = (Amount Collected ÷ Amount Invoiced) × 100  [rolling 12 months]
```

### 6.9 Credit Usage Categories

| Category | Definition |
|----------|------------|
| No Limit Set | Customer has no credit limit defined |
| Within Limit | Outstanding ÷ Credit Limit ≤ 80% |
| Near Limit | 80% < Outstanding ÷ Credit Limit ≤ 100% |
| Over Limit | Outstanding ÷ Credit Limit > 100% |

### 6.10 Return / Credit Note Classification

- **Return type:** Physical goods returned (tracked in return analysis)
- **Adjustment type:** Non-return credits such as discounts or allowances (excluded from return analysis)
- **Goods Return flag:** Each credit note line item is marked as either "goods returned" (physical return) or "credit only" (no physical return)

**Return reconciliation states:**

| State | Definition |
|-------|------------|
| Settled | Credit note fully settled (knockoff against invoices or refunded) |
| Partial | Credit note partially settled |
| Outstanding | Credit note not yet settled |

**Return aging buckets:** 0–30 days, 31–60 days, 61–90 days, 91–180 days, 180+ days

### 6.11 Payment Aging Buckets

For accounts receivable: Current (not yet due), 1–30 days, 31–60 days, 61–90 days, 91–120 days, 120+ days

### 6.12 P&L Structure

```
Net Sales = Sales + Sales Adjustments
Cost of Sales = Cost of Goods Sold
Gross Profit = Net Sales − Cost of Sales
Gross Margin % = (Gross Profit ÷ Net Sales) × 100
Other Income = Non-operating income
Operating Costs = All operating expense categories
Operating Profit = Gross Profit + Other Income − Operating Costs
Net Margin % = (Operating Profit ÷ Net Sales) × 100
Taxation = Tax amounts
Net Profit After Tax = Operating Profit − Taxation
```

**Financial Year Convention:** March to February, where the named year is the **end** year (e.g., FY2025 = March 2024 – February 2025)

### 6.13 Expense Categorization

Expenses are split into two top-level types:

| Type | Description |
|------|-------------|
| **Cost of Sales (COGS)** | Direct costs of products sold |
| **Operating Costs (OPEX)** | Indirect business expenses |

**Operating Costs Sub-Categories (13):**

1. People & Payroll
2. Vehicle & Transport
3. Property & Utilities
4. Depreciation
5. Office & Supplies
6. Equipment & IT
7. Insurance
8. Finance & Banking
9. Professional Fees
10. Marketing & Entertainment
11. Repair & Maintenance
12. Tax & Compliance
13. Other (unmapped accounts)

Expense accounts are organized hierarchically — child accounts inherit their parent account's category automatically.

---

## 7. Data Synchronization

### Overview

The dashboard does **not** read directly from the AutoCount database for most operations. Instead, a separate **Sync Service** periodically extracts, aggregates, and stores data locally for fast dashboard queries.

### Sync Process

**Phase 1 — Reference Data Sync:**
Copy 13 reference/lookup tables from AutoCount (customers, suppliers, products, GL accounts, etc.) into the local database.

**Phase 1b — Product Enrichment:**
After syncing products, enrich each product with fruit classification metadata (fruit name, country, variant) using the two-tier classification method described in Section 5.3.

**Phase 2 — Pre-Computed Aggregation:**
Run aggregation queries against AutoCount to build 17 pre-computed analytics tables:

| Domain | Tables | Grain |
|--------|--------|-------|
| Sales | 4 tables | Daily: net sales total; by customer; by dimension (type/agent/outlet); by product |
| Payment / AR | 3 tables | Monthly AR activity; daily customer snapshot; daily aging snapshot |
| Returns | 4 tables | Monthly overview; by customer; by product; daily aging snapshot |
| Customer Margin | 2 tables | Monthly by customer; monthly by customer × product group |
| Supplier Margin | 1 table | Monthly by supplier × product |
| P&L | 2 tables | By financial year period and account; opening balances |
| Expenses | 1 table | Monthly by GL account |

**Phase 2b — Atomic Swap:**
New data is built into staging tables, then swapped atomically to live tables. Each Phase 2 builder runs inside a database SAVEPOINT — if an individual builder fails, only that table is rolled back while the rest succeed. A sync with partial builder failures is marked as `partial` (not `error`).

### Sync Schedule

- Default: daily at 6 AM MYT (configurable via environment variable or Data Sync admin page)
- Timezone: Asia/Kuala_Lumpur
- Can be triggered manually from the admin page
- Full rebuild takes approximately 30 seconds for ~128K aggregated rows

### Sync Metadata

The system tracks:
- **Sync Jobs:** Each sync run with status (pending/running/success/partial/error), timing, row counts
- **Sync Logs:** Detailed audit trail per table (phase, duration, rows affected)
- **Data Freshness Indicator:** A global banner appears at the top of all dashboard pages when the last sync was not fully successful:
  - **Partial sync:** Amber warning — "Some data may be outdated" with last sync timestamp
  - **Failed sync:** Red alert — "Last data sync failed" with timestamp
  - **Successful sync:** No banner (hidden)

### Drill-Down Data

For detailed views (e.g., individual customer invoices, product-level breakdowns), the dashboard queries AutoCount directly in real-time. Only summary/aggregated views use the local pre-computed data.

---

## 8. Page-Specific Domain Notes

### 8.1 Sales Report

- Supports 3 granularity levels: daily, weekly (ISO week), monthly
- Net sales trend includes a 3-month moving average line
- Optional prior-period overlay for year-over-year comparison
- Breakdown dimensions: customer, customer type, sales agent, outlet/location, product name, product country, product variant
- Includes all customer accounts in net sales totals (both named "CASH DEBTOR-xxx" accounts and generic "CASH SALES")

### 8.2 Payment Collection

- **Two-section layout:** Section 1 "Payment Collection Trend" is date-filtered; Section 2 "Outstanding Payment" shows accumulated totals as of today (not date-filtered)
- Excludes the generic "CASH SALES" account from AR metrics (named "CASH DEBTOR-xxx" accounts are included)
- AR aging supports filtering by dimension: overall, by customer type, by sales agent
- Credit score is recalculated using the latest saved settings (weights are configurable)
- Avg Collection Days trend shows monthly rolling calculation
- Collection trend: monthly invoiced vs. collected amounts
- Role switcher (Admin/Viewer) at the top of the page — only page with this feature

### 8.3 Return / Credit Note

- **Important distinction:** Some sections show period-filtered data (returns within the selected date range), while others show point-in-time snapshots (current unsettled balance regardless of date filter)
- Aging analysis is snapshot-based (always shows current state)
- Product return analysis can be grouped by: item, product, variant, country
- Product return metrics: frequency (count) or value (amount)
- Excludes packing materials and pallets from product return charts

### 8.4 Financial Statements

- Uses **financial year dropdown** instead of date range filter (March–February, where FY2025 = Mar 2024 – Feb 2025)
- Defaults to the second-latest financial year (to ensure complete data)
- Five sections: KPI Summary, Monthly P&L Trend, P&L Statement Table, Multi-Year Comparison, Balance Sheet (trend chart + statement table)
- P&L displayed as hierarchical statement with row types: detail, subtotal, total, grand total, margin. Negative values shown in red.
- Supports multi-year comparison (current vs. prior year)
- Balance Sheet is point-in-time (end of selected period)
- **No pagination** on financial statement tables — use Excel export only

### 8.5 Expenses

- Toggle between All / Cost of Sales / Operating Costs view (global cost type filter)
- Trend chart is **monthly only** (no granularity toggle)
- Top Expenses chart with independent local toggles: cost type (All/Cost of Sales/Operating Costs) and direction (Top 10 / Bottom 10)
- Cost composition shown as donut/pie chart with dynamic legend
- Cost of Sales and Operating Costs breakdown tables (tabbed) are hierarchical — **no pagination, Excel export only**
- YoY comparison: current period vs. same period in prior year

### 8.6 Customer Margin

- Date range filter only (multi-dimension filters for customer, type, agent, product group are planned but not yet exposed in the UI)
- Tabbed analysis: Customer Analysis tab and Credit Note Impact tab
- Credit Note Impact shows margin **before** and **after** credit notes, quantifying margin lost to returns
- Margin distribution histogram with buckets: <0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+
- Trend sparklines per customer for quick visual comparison

### 8.7 Supplier Performance

- Date range filter only (multi-dimension filters for suppliers and item groups are planned but not yet exposed in the UI)
- Tabbed analysis: Supplier Analysis tab and Price Comparison tab
- Price Comparison: min/max/avg purchase price per item across suppliers, with price spread analysis
- Price scatter chart (full width) above the tabs
- Item Pricing Panel: search for items, view price trend by supplier, compare suppliers for the same item
- Single-supplier-risk indicator: items sourced from only one supplier (flagged in amber)
- Supplier profile modal with items supplied and margin performance

### 8.8 Payment Settings

- Sub-page of Payment (accessible via back-arrow navigation)
- Configuration form for credit score model:
  - Weight sliders for the 4 scoring factors (must sum to 100%)
  - Risk tier threshold inputs (Low/Moderate/High boundary scores)
- Changes take effect on next data view (no re-sync required)
- Settings persisted in the database

### 8.9 Data Sync (Admin)

- Shows current sync status and last sync time
- Sync job history with expandable log details (status badges: green = success, amber = partial, red = error)
- Manual sync trigger button
- Schedule configuration (cron expression with human-readable description)
- Designed for non-technical users: friendly status indicators, plain-language descriptions

**Note:** The data freshness banner (see Section 7 — Sync Metadata) is a global feature visible on all dashboard pages, not only the admin sync page.

---

## 9. Data Conventions Summary

| Convention | Rule |
|------------|------|
| Timezone | All dates converted to UTC+8 (Malaysia Time) before grouping or display |
| Cancelled records | Always excluded from all calculations |
| Currency display | "RM" prefix, thousands separators, no decimals (e.g., "RM 1,234") |
| Percentage display | One decimal place with +/− sign (e.g., "+12.3%") |
| Non-finite values | Display as em-dash "—" |
| Growth indicators | Green = positive, Red = negative, Muted = null/non-finite |
| Currency fields | Always use `Local*` fields (e.g., `LocalNetTotal`) for MYR aggregations — never `NetTotal` |
| Data freshness | Global banner on all pages: hidden on success, amber on partial sync, red on failed sync |
| Table sorting | All columns sortable, toggle ascending/descending |
| Table alignment | All data left-justified (no right-aligned numbers) |
| Table pagination | Server-side, selectable: 10, 25, or 50 rows per page |
| Table exceptions | Hierarchical/financial tables: no pagination, Excel export only |
| Table export | Excel (.xlsx) format — never CSV |
| Row click behavior | Only the entity name (blue underlined link) is clickable — rows are NOT clickable |
| Readability | High contrast throughout — no gray/muted text for important labels |
