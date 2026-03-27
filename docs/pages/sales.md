# Sales Report Dashboard

> **URL path:** `/sales`
>
> **Description:** Provides revenue tracking on a daily, weekly, and monthly basis to monitor sales trends and performance.

---

## 1. Purpose & User Goals

This page gives users a comprehensive view of sales revenue across the business. It answers questions such as:

- What is our total net sales for the selected period?
- How much revenue comes from invoiced credit sales vs. immediate cash sales?
- How large are our credit note deductions (returns and adjustments)?
- Is revenue trending up or down compared to the same period last year?
- Which customers, fruits, agents, outlets, or categories contribute the most revenue?
- How does revenue break down when cross-referencing two dimensions (e.g., top customers stacked by fruit)?

---

## 2. Page Layout

From top to bottom the page contains:

1. **Page Banner** -- Title "Sales Report" with the subtitle describing its purpose.
2. **Date Range Filter** -- A row containing month-year pickers, a human-readable range summary, and quick-preset buttons.
3. **KPI Cards** -- A responsive grid of four summary cards (Net Sales, Invoice Sales, Cash Sales, Credit Notes).
4. **Net Sales Trend Chart** -- A composed bar-and-line chart showing revenue over time with optional prior-period overlay.
5. **Sales Breakdown Section** -- A card containing:
   - A "Group by" dimension picker (seven options).
   - A horizontal bar chart of the selected rows.
   - Filter controls (search, dropdown) and a sortable data table with row-level selection checkboxes.

All sections respond to the global date range filter. Filter state is persisted in URL query parameters so that links can be shared.

`[Screenshot: docs/screenshots/sales/default.png]`

---

## 3. Filters

### 3.1 Date Range Filter

- **Location:** Top of the page, below the banner.
- **Controls:**
  - **Start month picker** -- selects the first day of the chosen month.
  - **End month picker** -- selects the last day of the chosen month.
  - Both pickers are bounded by the earliest and latest document dates found in the data.
- **Range summary:** Displayed between the pickers and presets, formatted as "MMM yyyy -- MMM yyyy (N months)".
- **Quick presets:**
  | Button | Behaviour |
  |--------|-----------|
  | 3M | Sets the range to the most recent 3 calendar months |
  | 6M | Sets the range to the most recent 6 calendar months |
  | 12M | Sets the range to the most recent 12 calendar months |
  | YTD | Sets the range from 1 Jan of the current year through the latest available month |
- **Default value:** If no dates are in the URL, defaults to the 12 months ending at the last month with data (inclusive).
- **Effect:** Changing the date range re-fetches all KPI, trend, and group-by data.

### 3.2 Group By Dimension Picker

- **Location:** Header of the "Sales Breakdown" card.
- **Options (toggle buttons):**
  | Value | Label |
  |-------|-------|
  | customer | Customer |
  | customer-type | Customer Category |
  | fruit | Fruit |
  | fruit-country | Country |
  | fruit-variant | Variant |
  | agent | Sales Agent |
  | outlet | Outlet |
- **Default:** `customer`.
- **Effect:** Switching the dimension re-fetches the breakdown data and resets the chart selection and any stack-by choice.

### 3.3 Group By Table Filters

Located above the breakdown table. Controls vary by dimension:

| Dimension | Search placeholder | Dropdown filter |
|-----------|--------------------|-----------------|
| Customer | "Search by customer code or name" | Category (single-select from Debtor.DebtorType values, plus "All Categories") |
| Customer Category | "Search by category" | -- |
| Fruit | "Search by fruit name" | -- |
| Country | "Search by country" | -- |
| Variant | "Search by variant name" | Fruit (multi-select with search, derived from the fruit portion of each variant row) |
| Sales Agent | "Search by agent name" | Status: All Status / Active / Inactive |
| Outlet | "Search by location" | -- |

Search is a case-insensitive substring match across the relevant fields. These filters affect only the table rows; the chart is driven by the row-selection checkboxes (see Section 6).

### 3.4 Granularity Toggle (Trend Chart)

- **Location:** Header of the "Net Sales Trend" card.
- **Options:** Daily, Weekly, Monthly (toggle buttons).
- **Default:** `monthly`.
- **Effect:** Changes the time-bucket used for the trend chart.

---

## 4. KPI Cards

Displayed as a 4-column responsive grid. All values are formatted as Malaysian Ringgit (RM).

### 4.1 Net Sales

- **What it shows:** The overall net revenue for the selected date range.
- **Calculation:** SUM of IV.NetTotal + SUM of CS.NetTotal - SUM of CN.NetTotal, where each table is filtered to Cancelled = 'F' and DocDate (converted to MYT) falls within the selected range.
- **Subtitle:** "Invoice + Cash Sales - Credit Notes"
- **Data source:** IV.NetTotal, CS.NetTotal, CN.NetTotal (header-level totals).

### 4.2 Invoice Sales

- **What it shows:** Total revenue from credit-term invoices.
- **Calculation:** SUM of IV.NetTotal where IV.Cancelled = 'F' and DocDate (MYT) is in range.
- **Subtitle:** "Billed on credit terms to customer"
- **Data source:** IV.NetTotal.

### 4.3 Cash Sales

- **What it shows:** Total revenue from immediate-payment cash sales.
- **Calculation:** SUM of CS.NetTotal where CS.Cancelled = 'F' and DocDate (MYT) is in range.
- **Subtitle:** "Immediate payment"
- **Data source:** CS.NetTotal.

### 4.4 Credit Notes

- **What it shows:** Total value of credit notes issued (goods returns and adjustments). Displayed as a positive number but rendered in red with a minus sign prefix.
- **Calculation:** SUM of CN.NetTotal (absolute value) where CN.Cancelled = 'F' and DocDate (MYT) is in range.
- **Subtitle:** "Goods returns & adjustments"
- **Data source:** CN.NetTotal.

---

## 5. Charts

### 5.1 Net Sales Trend

- **Chart type:** Composed chart -- stacked vertical bars with an optional dashed line overlay.
- **X-axis:** Time period (formatted depending on granularity):
  - Daily: "MMM d" (e.g., "Jan 5")
  - Weekly: "WNN" (e.g., "W03"), year prefix stripped
  - Monthly: "MMM YY" (e.g., "Jan 25")
- **Y-axis:** Revenue in RM. Large values abbreviated (e.g., "1.2M", "350K").
- **Bar breakdown (default mode, no prior period):**
  - Bottom segment: Invoice Sales (blue, #2E5090) -- SUM of IV.NetTotal per period
  - Top segment: Cash Sales (green, #548235) -- SUM of CS.NetTotal per period
  - Negative segment: Credit Notes (red, #C00000) -- negative SUM of CN.NetTotal per period
  - Bars are stacked; the combined height represents net sales.
- **Prior-period overlay (toggled via "Show Prior Period" button):**
  - A dashed grey line (#94a3b8) plots the net sales from the same date range shifted back by one year.
  - When active, bar colors change to indicate year-over-year performance:
    - Green (#16a34a) if the current period's net sales >= prior period's net sales (growth).
    - Red (#dc2626) if below prior period (decline).
    - Credit Notes bar remains red regardless.
  - The prior-period line breaks (does not connect) where prior data is missing.
- **Legend:**
  - Default mode: Invoice (blue square), Cash Sales (green square), Credit Notes (red square).
  - Prior-period mode: Growth (green square), Decline (red square), Credit Notes (red square), Prior Period (grey dashed line).
- **Tooltip:** On hover, shows:
  - Period label (formatted per granularity)
  - Invoice Sales value (RM)
  - Cash Sales value (RM)
  - Credit Notes value (RM)
  - Prior Period Net Sales value (RM) -- only when prior-period overlay is active
- **Interactions:**
  - Granularity toggle (Daily / Weekly / Monthly) in the card header.
  - "Show Prior Period" / "Hide Prior Period" toggle button.
- **Data source:** IV.NetTotal, CS.NetTotal, CN.NetTotal grouped by time period using DocDate (MYT).

### 5.2 Sales Breakdown Chart (Horizontal Bar)

- **Chart type:** Horizontal bar chart.
- **Y-axis:** Dimension name (e.g., customer name, fruit name). Max width 180px, truncated if longer.
- **X-axis:** Total Sales in RM. Large values abbreviated.
- **Data shown:** Only the rows selected via checkboxes in the table below (up to 10). Sorted by total_sales descending.
- **Bar labels:** Each bar has a right-aligned RM-formatted label showing its value.
- **Bar height:** Fixed at 28px per bar. Chart height dynamically scales (minimum 400px, 48px per row).
- **Default mode (no stacking):**
  - Each bar represents total_sales for one group member.
  - Bars are colored using a rotating palette of 10 colors.
  - Tooltip shows "Total Sales: RM X".
- **Stacked mode:**
  - Available when a "Stack by" dimension is selected.
  - Each bar is subdivided by the stack dimension's categories (up to 8 categories globally, or 4 per fruit when stacking by Variant). Remaining categories are grouped into "Others".
  - A color-coded legend appears below the chart.
  - Tooltip shows a breakdown of each stack category's value plus a total.
  - Valid stack-by options per group-by dimension:

    | Group By | Stack By Options |
    |----------|-----------------|
    | Customer | Sales Agent, Fruit, Country, Outlet |
    | Customer Category | Sales Agent, Fruit, Country |
    | Fruit | Customer Category, Variant |
    | Country | Fruit |
    | Variant | Customer Category |
    | Sales Agent | Fruit, Country, Outlet |
    | Outlet | Country, Fruit |

  - When stacking Fruit by Variant, a notice appears: "Showing top 4 variants per fruit to prevent overcrowding."
- **Data source:** Depends on dimension -- see Section 6 for calculation details per dimension.

---

## 6. Tables

### 6.1 Sales Breakdown Table

A scrollable, sortable data table displayed below the breakdown chart. Maximum visible height is 500px with vertical scroll.

**Row selection:**
- Each row has a checkbox in the first column.
- Up to 10 rows can be selected at a time. Additional checkboxes are disabled when the limit is reached.
- Selected rows drive the chart above (not the table filters).
- A "Reset" button restores the default selection (top 10 by total_sales).
- A counter displays "N/10 selected".
- Default selection on load or dimension change: the top 10 rows by total_sales.

**Row click behavior (Customer dimension only):**
- Clicking a row (outside the checkbox) opens a Customer Profile modal showing the customer's sold items, scoped to the current date range.

**Columns vary by dimension:**

#### Customer
| Column | Description | Alignment |
|--------|-------------|-----------|
| Code | Debtor.DebtorCode (customer account number) | Left |
| Customer Name | Most common DebtorName across IV/CS/CN for this DebtorCode | Left |
| Category | Debtor.DebtorType (joined from Debtor table); "(Uncategorized)" if null | Left |
| Total Sales | Net sales = invoice_sales + cash_sales - credit_notes | Right (RM) |
| Invoice Sales | SUM of IV.NetTotal for this customer | Right (RM) |
| Cash Sales | SUM of CS.NetTotal for this customer | Right (RM) |
| Credit Note | SUM of CN.NetTotal for this customer | Right (RM) |

- **Data source:** IV, CS, CN (header tables) joined to Debtor on DebtorCode. Grouped by DebtorCode.

#### Customer Category
| Column | Description | Alignment |
|--------|-------------|-----------|
| Category | Debtor.DebtorType; "(Uncategorized)" if null | Left |
| Count | Number of distinct customers (COUNT DISTINCT DebtorCode) | Right |
| Total Sales | Net sales for all customers in this category | Right (RM) |
| Invoice Sales | SUM of IV.NetTotal for the category | Right (RM) |
| Cash Sales | SUM of CS.NetTotal for the category | Right (RM) |

- **Data source:** IV, CS, CN joined to Debtor and DebtorType. Grouped by DebtorType.

#### Fruit
| Column | Description | Alignment |
|--------|-------------|-----------|
| Fruit | FruitName from line-item tables; "OTHERS" if null | Left |
| Total Sales | Net sales at line-item level (invoice + cash - credit note SubTotals) | Right (RM) |
| Invoice Sales | SUM of SubTotal from invoice line items | Right (RM) |
| Cash Sales | SUM of SubTotal from cash sale line items | Right (RM) |
| Credit Note | SUM of SubTotal from credit note line items | Right (RM) |
| Qty Sold | SUM of absolute Qty from IV and CS line items | Right |

- **Data source:** sales_invoice, sales_cash, sales_credit_note (line-item tables). Grouped by FruitName.

#### Country
| Column | Description | Alignment |
|--------|-------------|-----------|
| Country | FruitCountry from line-item tables; "(Unknown)" if null | Left |
| Total Sales | Net sales at line-item level | Right (RM) |
| Invoice Sales | SUM of SubTotal from invoice line items | Right (RM) |
| Cash Sales | SUM of SubTotal from cash sale line items | Right (RM) |
| Credit Note | SUM of SubTotal from credit note line items | Right (RM) |
| Qty Sold | SUM of absolute Qty from IV and CS line items | Right |

- **Data source:** sales_invoice, sales_cash, sales_credit_note. Grouped by FruitCountry.

#### Variant
| Column | Description | Alignment |
|--------|-------------|-----------|
| Fruit -- Variant | Concatenation of FruitName and FruitVariant (e.g., "Apple -- Fuji"); "OTHERS" if null | Left |
| Total Sales | Net sales at line-item level | Right (RM) |
| Invoice Sales | SUM of SubTotal from invoice line items | Right (RM) |
| Cash Sales | SUM of SubTotal from cash sale line items | Right (RM) |
| Credit Note | SUM of SubTotal from credit note line items | Right (RM) |
| Qty Sold | SUM of absolute Qty from IV and CS line items | Right |

- **Data source:** sales_invoice, sales_cash, sales_credit_note. Grouped by FruitName + FruitVariant.

#### Sales Agent
| Column | Description | Alignment |
|--------|-------------|-----------|
| Agent | SalesAgent code; "(Unassigned)" if null | Left |
| Active | SalesAgent.IsActive flag displayed as "True" or "False" | Left |
| Total Sales | Net sales for this agent | Right (RM) |
| Invoice Sales | SUM of IV.NetTotal | Right (RM) |
| Cash Sales | SUM of CS.NetTotal | Right (RM) |
| Customers | COUNT DISTINCT DebtorCode served by this agent | Right |

- **Data source:** IV, CS, CN joined to SalesAgent. Grouped by SalesAgent.

#### Outlet
| Column | Description | Alignment |
|--------|-------------|-----------|
| Location | SalesLocation; "(Unassigned)" if null | Left |
| Total Sales | Net sales for this outlet | Right (RM) |
| Invoice Sales | SUM of IV.NetTotal | Right (RM) |
| Cash Sales | SUM of CS.NetTotal | Right (RM) |
| Credit Note | SUM of CN.NetTotal | Right (RM) |

- **Data source:** IV, CS, CN (header tables). Grouped by SalesLocation.

**Sorting:**
- All columns are sortable by clicking the column header.
- Clicking a sorted column toggles between descending and ascending order.
- Default sort: `total_sales` descending.
- Sort indicators: up arrow, down arrow, or bi-directional arrow (unsorted).

**Pagination:** No pagination. The table is fully loaded and scrollable within a 500px max-height container with a sticky header.

---

## 7. API Contracts

### 7.1 GET `/api/sales/revenue/date-bounds`

- **Purpose:** Returns the earliest and latest document dates in the dataset, used to set the bounds of the date range pickers and calculate the default range.
- **Parameters:** None.
- **Response shape:**
  - `min_date` (string, YYYY-MM-DD) -- earliest DocDate (MYT) across IV and CS where Cancelled = 'F'.
  - `max_date` (string, YYYY-MM-DD) -- latest DocDate (MYT) across IV and CS where Cancelled = 'F'.

### 7.2 GET `/api/sales/revenue/summary`

- **Purpose:** Returns aggregate revenue totals for the KPI cards.
- **Parameters:**
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | start_date | string (YYYY-MM-DD) | No (defaults to 2000-01-01) | Start of date range |
  | end_date | string (YYYY-MM-DD) | No (defaults to 2099-12-31) | End of date range |
- **Response shape:**
  - `current` (object):
    - `invoice_revenue` (number) -- SUM of IV.NetTotal
    - `cashsales_revenue` (number) -- SUM of CS.NetTotal
    - `credit_notes` (number) -- SUM of CN.NetTotal (positive value)
    - `net_revenue` (number) -- invoice_revenue + cashsales_revenue - credit_notes

### 7.3 GET `/api/sales/revenue/trend`

- **Purpose:** Returns time-series revenue data for the Net Sales Trend chart.
- **Parameters:**
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | start_date | string (YYYY-MM-DD) | No (defaults to 2000-01-01) | Start of date range |
  | end_date | string (YYYY-MM-DD) | No (defaults to 2099-12-31) | End of date range |
  | granularity | string | No (defaults to "monthly") | One of: `daily`, `weekly`, `monthly` |
- **Response shape:**
  - `data` (array of objects), each containing:
    - `period` (string) -- time bucket label:
      - Daily: "YYYY-MM-DD"
      - Weekly: "YYYY-WNN"
      - Monthly: "YYYY-MM"
    - `invoice_revenue` (number) -- SUM of IV.NetTotal for the period
    - `cashsales_revenue` (number) -- SUM of CS.NetTotal for the period
    - `cn_amount` (number) -- negative SUM of CN.NetTotal for the period (always <= 0)
    - `moving_avg` (number) -- 3-period moving average of net sales (invoice + cash + credit note amounts)

### 7.4 GET `/api/sales/revenue/v2/group-by`

- **Purpose:** Returns revenue data grouped by a chosen dimension, optionally with a secondary stack dimension for chart breakdowns.
- **Parameters:**
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | group | string | Yes | Dimension to group by. One of: `customer`, `customer-type`, `agent`, `outlet`, `fruit`, `fruit-country`, `fruit-variant` |
  | start_date | string (YYYY-MM-DD) | Yes | Start of date range |
  | end_date | string (YYYY-MM-DD) | Yes | End of date range |
  | stack | string | No | Secondary dimension for stacked chart. Valid values depend on the `group` value (see stacking table in Section 5.2) |
- **Response shape (without stack):**
  - `group` (string) -- echoes the requested group dimension
  - `data` (array of GroupByRow objects). Fields vary by dimension but always include:
    - `name` (string) -- display name for the group member
    - `total_sales` (number) -- net sales (invoice + cash - credit notes)
    - `invoice_sales` (number)
    - `cash_sales` (number)
    - `credit_notes` (number)
    - `doc_count` (number) -- total document count
    - Additional fields depending on dimension: `code`, `customer_type`, `customer_count`, `is_active`, `unique_customers`, `qty_sold`
- **Response shape (with stack):**
  - `group` (string)
  - `stack` (string) -- echoes the requested stack dimension
  - `data` (array of StackedRow objects):
    - `primary_name` (string) -- name of the primary group member
    - `stack_name` (string) -- name of the secondary (stack) category
    - `total_sales` (number) -- net sales for this primary + stack combination

### 7.5 GET `/api/sales/customer-sales-summary`

- **Purpose:** Returns a single customer's sales summary and monthly trend, used by the Customer Profile modal when a customer row is clicked.
- **Parameters:**
  | Param | Type | Required | Description |
  |-------|------|----------|-------------|
  | debtor_code | string | Yes | The customer's DebtorCode |
  | start_date | string (YYYY-MM-DD) | No (defaults to 2024-01-01) | Start of date range |
  | end_date | string (YYYY-MM-DD) | No (defaults to 2025-12-31) | End of date range |
- **Response shape:**
  - `summary` (object):
    - `total_sales` (number)
    - `invoice_sales` (number)
    - `cash_sales` (number)
    - `credit_notes` (number)
    - `doc_count` (number)
  - `trend` (array of objects):
    - `month` (string, "YYYY-MM")
    - `total_sales` (number)
    - `invoice_sales` (number)
    - `cash_sales` (number)
    - `credit_notes` (number)

---

## 8. URL Query Parameters

All filter state is stored in URL search parameters, making the current view shareable via URL.

| Parameter | Maps to | Example |
|-----------|---------|---------|
| `start` | Start date (YYYY-MM-DD) | `2025-04-01` |
| `end` | End date (YYYY-MM-DD) | `2026-03-31` |
| `g` | Granularity for trend chart | `daily`, `weekly`, `monthly` |
| `group` | Group-by dimension | `customer`, `fruit`, `agent`, etc. |
| `stack` | Stack-by dimension for chart | `agent`, `fruit`, etc. (cleared when group changes) |

---

## 9. Key Business Rules

- **Revenue formula:** Net Sales = SUM(IV.NetTotal) + SUM(CS.NetTotal) - SUM(CN.NetTotal), counting only non-cancelled documents (Cancelled = 'F').
- **Timezone:** All DocDate values are stored in UTC. Eight hours are added before any date grouping or filtering to convert to Malaysia Time (MYT, UTC+8).
- **IV and CS are mutually exclusive:** Invoice Sales and Cash Sales never overlap; there is no risk of double-counting.
- **POS transactions** are already included in CS (Cash Sales) and are never added separately.
- **Fruit-level data** uses line-item tables (sales_invoice, sales_cash, sales_credit_note) and their SubTotal column, not the header-level NetTotal.
- **Header-level data** (Customer, Customer Category, Agent, Outlet) uses the document header tables (iv, cs, cn) and their NetTotal column.
- **Stacked queries** use line-item tables when either the primary or stack dimension requires fruit data; otherwise they use header tables to match base-query totals.
- **Currency:** All monetary values are displayed in Malaysian Ringgit (RM).
