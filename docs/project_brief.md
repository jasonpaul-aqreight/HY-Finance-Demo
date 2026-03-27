# Finance Dashboard Module — Project Brief

## 1. Module Overview

**Purpose:** The Finance module provides a consolidated dashboard for tracking revenue, payments, returns, expenses, profitability, and margin analysis across Hoi-Yong's fruit/produce distribution business.

**Target users:**
- Finance director — P&L oversight, margin analysis, credit risk monitoring
- Management — Revenue trends, top customer/supplier performance
- Operations team — Payment collection follow-up, return tracking, expense monitoring

**Business context:** Hoi-Yong is a fruit and produce distributor based in Malaysia. All monetary values are in MYR (Malaysian Ringgit). Data originates from an AutoCount Accounting system backed by PostgreSQL.

---

## 2. Page Inventory

| # | Page Name | URL Path | Description |
|---|-----------|----------|-------------|
| 1 | Sales Report | `/sales` | Revenue tracking on daily, weekly, and monthly basis to monitor sales trends and performance |
| 2 | Payment Collection | `/payment` | Customer payment health, payment aging, outstanding amounts, and credit scoring for risk assessment and cash flow management |
| 3 | Credit Note / Return / Refund | `/return` | Monitors credit notes, product returns, and refunds for financial reconciliation |
| 4 | Financial Statements | `/pnl` | Profit & Loss statement, Year-over-Year comparison, and Balance Sheet overview |
| 5 | Cost Tracking | `/expenses` | Monitors COGS, OPEX, payroll, electricity, packing materials, and top 10 expenses |
| 6 | Customer Profit Margin | `/customer-margin` | Profit margin trends by customer to identify high-value relationships and optimize pricing |
| 7 | Supplier Profit Margin | `/supplier-margin` | Profit margin trends for suppliers, supporting negotiation and procurement strategies |
| 8 | Payment Settings | `/payment/settings` | Configuration for credit score weights and risk threshold parameters |

---

## 3. Navigation & Information Architecture

### Sidebar Navigation

The sidebar displays seven top-level navigation items in the following order:

| Order | Label | Icon | URL |
|-------|-------|------|-----|
| 1 | Sales | TrendingUp (line chart going up) | `/sales` |
| 2 | Payment | CreditCard | `/payment` |
| 3 | Return | RotateCcw (circular arrow) | `/return` |
| 4 | Financials | BarChart3 | `/pnl` |
| 5 | Expenses | Receipt | `/expenses` |
| 6 | Customer Margin | Users (people) | `/customer-margin` |
| 7 | Supplier Margin | Truck | `/supplier-margin` |

### Sidebar Behavior
- The sidebar is collapsible. When collapsed, it shows only icons (with tooltips on hover). When expanded, it shows icon + label.
- Collapsed width: 64px. Expanded width: 224px.
- Active page is highlighted based on URL prefix matching (e.g., `/payment/settings` highlights "Payment").
- Header displays "Hoi-Yong Finance" branding when expanded.

### Page Hierarchy
- **Main pages:** All 7 sidebar items are top-level pages.
- **Sub-pages:** Payment Settings (`/payment/settings`) is a child of Payment. It has a back-arrow link to return to the parent Payment page.
- **Modals:** Customer Profile and Supplier Profile are cross-page modals (not separate routes) — see Section 4.2 and 4.3.

### Layout Structure
- Fixed sidebar on the left.
- Scrollable main content area on the right (full remaining width).
- Each page has a **page banner** at the top with a title and description, followed by the dashboard body.
- Maximum content width: 1600px, centered.

---

## 4. Cross-Cutting Features

### 4.1 Date Range Filter

A shared date range filter is used across multiple pages (Sales, Payment, Return, Supplier Margin, Customer Margin).

**Controls:**
- Two month-year pickers: Start date and End date
- Arrow separator between the two pickers
- Range summary text showing formatted range, e.g., "Jan 2025 -- Dec 2025 (12 months)"

**Presets:**
| Button | Behavior |
|--------|----------|
| 3M | Last 3 months from the latest available data |
| 6M | Last 6 months from the latest available data |
| 12M | Last 12 months from the latest available data |
| YTD | From January 1 of the current year to the latest available data |

**Behavior:**
- Presets calculate relative to the latest data date (not today's date), ensuring presets always show data.
- Date bounds (earliest and latest available dates) are fetched from the database and constrain the pickers.
- Presets and range summary can be independently shown/hidden per page.

### 4.2 Customer Profile Modal

A full-screen modal (90% viewport width, 90% viewport height) that provides a 360-degree view of a single customer. It is accessible from multiple pages: Payment, Return, Sales, and Customer Margin.

**Trigger:** Clicking a customer name or row in any customer-facing table.

**Header Section:**
- Company name (large, bold)
- Active/Inactive status badge
- Customer metadata: debtor code, debtor type, sales agent

**Three Metric Cards (side by side):**

1. **Payment** (blue header)
   - Credit Limit, Outstanding amount, Credit Utilization (with progress bar), Aging Count (with oldest overdue days), Credit Score (out of 100), Risk Tier badge, Payment Term, Average Payment Period (last 12 months)

2. **Returns** (amber header)
   - Return Count (total), Unresolved amount (or "Settled"), Return Trend line chart (last 12 months)

3. **Sales Performance** (green header)
   - Profit Margin percentage, Period Revenue (last 12 months), Revenue Trend line chart

**Tabbed Detail Section (below metrics):**

| Tab Label | Content |
|-----------|---------|
| Pending Payment | Outstanding invoices awaiting payment |
| Return Records | Historical credit notes and returns for this customer |
| Sold Items | Items sold to this customer within a selectable date range |

**Default tab** can be set by the calling page (e.g., Payment page opens to "Pending Payment", Return page opens to "Return Records", Sales/Customer Margin opens to "Sold Items").

### 4.3 Supplier Profile Modal

A full-screen modal (90% viewport width, 90% viewport height) for a single supplier. Accessible from the Supplier Margin page.

**Trigger:** Clicking a supplier name or row in the supplier table.

**Header Section:**
- Company name (large, bold)
- Active/Inactive status badge
- Supplier metadata: creditor code
- Two KPI cards: Items Supplied (count), Single Supplier Items (count, highlighted in amber as a supply-risk indicator)

**Body:**
- Purchase Items tab showing items purchased from this supplier, with date range filtering and single-supplier-risk flagging.

### 4.4 Data Conventions

| Convention | Detail |
|------------|--------|
| Timezone | UTC+8 (MYT). All dates are stored in UTC and must be shifted +8 hours before any date grouping or display. |
| Cancelled records | Always excluded by filtering on `Cancelled = 'F'` (false). |
| Currency | MYR (Malaysian Ringgit), displayed with "RM" prefix (e.g., "RM 1,234"). |
| Currency formatting | `en-MY` locale, no decimal places by default (configurable). Absolute values used for display. |
| Percentage formatting | One decimal place with explicit +/- sign prefix (e.g., "+12.3%", "-4.1%"). Non-finite values display as em-dash ("--"). |
| Count formatting | `en-MY` locale with thousands separators. |
| Growth coloring | Green for positive growth, red for negative, muted for null/non-finite. |
| Revenue formula | SUM(Invoices) + SUM(Cash Sales) - SUM(Credit Notes), where all cancelled records are excluded. |
| LocalNetTotal | Used instead of NetTotal for the rare SGD-denominated records to ensure consistent MYR reporting. |

### 4.5 Filtering Capabilities

Across different pages, users can filter data by:
- Date range (shared filter, see 4.1)
- Outlet / branch
- Time range
- Product weight
- Customer
- Product country, brand, variety
- Supplier
- Sales agent
- Debtor type

---

## 5. Common UI Patterns

### Page Layout Pattern
Every dashboard page follows the same structure:
1. **Page banner** — Title + one-line description (full-width, bordered bottom)
2. **KPI summary cards** — Row of metric cards at the top of the dashboard body (e.g., total revenue, growth %, count)
3. **Date range filter** — Below KPIs or inline with filters
4. **Charts and tables** — Main body content (charts for trends, tables for detail)

### Chart Patterns
- **Line charts** for trend data (monthly revenue, return counts over time)
- **Bar charts** for comparison data (revenue by group, expense categories)
- **Hover tooltips** on all chart data points showing formatted values
- **Responsive containers** that fill available width

### Table Patterns
- Sortable columns (click header to toggle ascending/descending)
- Search/filter input for text-based filtering within tables
- Pagination for large datasets
- Clickable rows that open profile modals (for customer/supplier tables)
- Export capability where applicable

### Responsive Design
- Sidebar collapses to icon-only mode
- Content area uses max-width constraint (1600px) and is horizontally centered
- Grid layouts adapt from multi-column (desktop) to single-column (mobile)
- Metric card grids reflow based on available width

### Loading States
- Skeleton/placeholder UI while data loads
- "Loading dashboard..." text fallback for initial page load

---

## 6. Data Architecture Overview

**Source system:** AutoCount Accounting (PostgreSQL database)

**Data scope:** 37 tables organized across domains:
- **Transaction tables:** Invoices (IV), Cash Sales (CS), Credit Notes (CN), Payments, Purchase records
- **Lookup/reference tables:** Debtors (customers), Creditors (suppliers), Debtor Types, Sales Agents, Items, Accounts
- **Financial tables:** General Ledger, Balance Sheet, P&L accounts

**Domain separation:** Data is logically organized into separate domain databases:
- `sales` — Invoice, Cash Sales, Credit Note transactions and lookups
- `payment` — Payment receipts, aging, credit scoring
- `return` — Credit notes and return records
- `margin` — Purchase and sales data for margin calculation (both customer and supplier)
- `expenses` — Expense accounts and transactions
- `pnl` — General Ledger, P&L, Balance Sheet data

Each domain database is read-only and opened on demand with connection pooling.

**Complete schema:** See `data_dictionary.md` for full table definitions, column types, and relationships.

---

## 7. Per-Page Detail References

Detailed specifications for each page are maintained in `docs/pages/`:

| Page | Reference |
|------|-----------|
| Sales Report | `docs/pages/sales.md` |
| Payment Collection | `docs/pages/payment.md` |
| Credit Note / Return | `docs/pages/return.md` |
| Financial Statements | `docs/pages/pnl.md` |
| Cost Tracking | `docs/pages/expenses.md` |
| Customer Profit Margin | `docs/pages/customer-margin.md` |
| Supplier Profit Margin | `docs/pages/supplier-margin.md` |
| Payment Settings | `docs/pages/payment-settings.md` |
