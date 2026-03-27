# Customer Profit Margin Dashboard

> **URL path:** `/customer-margin`
>
> **Banner title:** "Customer Profit Margin Report"
>
> **Banner description:** "Tracks profit margin trends by customer to identify high-value relationships and optimize pricing strategies."

---

## 1. Purpose & User Goals

This page answers the question: **"How profitable is each customer, and how are margins trending over time?"**

Key user goals:

- See overall profitability at a glance (net sales, COGS, gross profit, margin %).
- Identify which customers generate the highest profit and which operate at thin or negative margins.
- Understand how margins change month-over-month.
- Evaluate the distribution of margin percentages across the entire customer base.
- Quantify the impact of credit notes (returns) on per-customer profitability.
- Drill into any customer row to open a **Customer Profile Modal** with payment health, return history, and sold-item details.

---

## 2. Page Layout

The page renders inside a 1 400 px max-width container with `p-4` / `md:p-6` padding.

| Order | Section | Description |
|-------|---------|-------------|
| 1 | **Filter Bar** | Date range picker (shared DateRangeSection). |
| 2 | **--- Overview ---** | Section divider. |
| 3 | **KPI Cards** | Five summary cards in a responsive grid. |
| 4 | **--- Margin Trends ---** | Section divider. |
| 5 | **Profitability Trend Chart** | Combo chart (bars + line), full width. |
| 6 | **--- Customer Rankings ---** | Section divider. |
| 7 | **Top Customers Chart** (3/5 width) + **Margin Distribution Chart** (2/5 width) | Side-by-side on large screens (`lg:grid-cols-5`). |
| 8 | **Tabbed Section** | Two tabs: "Customer Analysis" and "Credit Note Impact". |
| 8a | -- Tab: Customer Analysis | Customer Margin Table (sortable, paginated, searchable). |
| 8b | -- Tab: Credit Note Impact | Credit Note Impact Table (paginated). |

### Components that exist but are NOT wired into the shell

The following components are built and export valid widgets, but are **not imported** by the dashboard shell. They are available for future use or can be added to the layout:

| Component | Card title | Data source |
|-----------|-----------|-------------|
| MarginByTypeChart | "Margin by Customer Type" | `GET /api/customer-margin/margin/by-type` |
| ProductGroupMarginChart | "Product Group Margin Breakdown" | `GET /api/customer-margin/margin/by-product-group` |
| TopByMarginChart | "Top 10 by Margin % (min RM 10K revenue)" | `GET /api/customer-margin/margin/customers` (sort=margin_pct) |
| TopByProfitChart | "Top 10 by Gross Profit" | `GET /api/customer-margin/margin/customers` (sort=gross_profit) |
| ProductCustomerMatrix | "Product Group x Customer Matrix" | `GET /api/customer-margin/margin/product-customer` |
| MonthlyPivotTable | "Monthly Margin Pivot (Top 20 Customers)" | `GET /api/customer-margin/margin/customers` + per-row monthly calls |
| DataQualityPanel | "Data Quality" | `GET /api/customer-margin/margin/data-quality` |

---

## 3. Filters

### 3.1 Date Range (visible in FilterBar)

| Control | Type | Details |
|---------|------|---------|
| Start date | Month-year picker | URL param `start`. Default: start of month 12 months before the latest data date (`bounds.max_date`). |
| End date | Month-year picker | URL param `end`. Default: end of month of latest data date. |
| Presets | Quick buttons | 3M, 6M, 12M, YTD (provided by shared DateRangeSection). |

The date bounds are fetched once from `GET /api/customer-margin/margin/date-bounds` and used to constrain the picker range.

### 3.2 URL-Synced Filters (defined in filter state, not all exposed in UI)

The filter state type `MarginDashboardFilters` supports the following fields, all persisted as URL search params:

| Filter | URL param | Type | Notes |
|--------|-----------|------|-------|
| startDate | `start` | `string` (YYYY-MM-DD) | |
| endDate | `end` | `string` (YYYY-MM-DD) | |
| customers | `customer` (repeated) | `string[]` | debtor.DebtorCode values |
| types | `type` (repeated) | `string[]` | debtor.DebtorType values |
| agents | `agent` (repeated) | `string[]` | debtor.SalesAgent values |
| productGroups | `group` (repeated) | `string[]` | item.ItemGroup values |

All filter changes trigger a URL push (no page reload) via browser transition.

### 3.3 Filter Lookup Endpoints

These static lookups populate filter dropdowns:

| Endpoint | Returns |
|----------|---------|
| `GET /api/customer-margin/filters/customers` | `{ code, name }[]` -- Active debtors who have at least one non-cancelled invoice. Sorted by CompanyName. |
| `GET /api/customer-margin/filters/types` | `string[]` -- Distinct debtor.DebtorType values (active debtors only), with `NULL` mapped to `"Unassigned"`. Sorted alphabetically. |
| `GET /api/customer-margin/filters/agents` | `{ agent, description, is_active }[]` -- All rows from sales_agent table. Sorted by SalesAgent. |
| `GET /api/customer-margin/filters/product-groups` | `string[]` -- All item_group.ItemGroup values plus a synthetic `"Unclassified"` entry. Sorted alphabetically. |

---

## 4. KPI Cards

Five cards displayed in a responsive grid: 2 columns on mobile, 3 on medium, 5 on large screens.

| # | Card title | Value | Formula | Colour logic |
|---|-----------|-------|---------|-------------|
| 1 | **Net Sales** | `formatRM(total_revenue)` | `SUM(IV.LocalNetTotal) + SUM(DN.LocalNetTotal) - SUM(CN.LocalNetTotal)` where each doc has Cancelled='F' (DN also allows NULL) | Default foreground |
| 2 | **Total COGS** | `formatRM(total_cogs)` | `SUM(ivdtl.LocalTotalCost) + SUM(dndtl.LocalTotalCost) - SUM(cndtl.UnitCost * cndtl.Qty)`, non-negative costs only for IV/DN | Default foreground |
| 3 | **Gross Profit** | `formatRM(gross_profit)` | Net Sales - Total COGS | Green (`text-emerald-600`) when >= 0; Red (`text-red-600`) when < 0 |
| 4 | **Overall Margin** | `formatMarginPct(margin_pct)` | `(Gross Profit / Net Sales) * 100`, rounded to 2 decimals | `marginColor()`: < 10% = red, 10-20% = amber, >= 20% = green |
| 5 | **Active Customers** | `formatCount(active_customers)` | `COUNT(DISTINCT debtor_code)` across all document types | Default foreground |

**Subtitle formulas** shown below each card value:
- Net Sales: "IV + DN - CN"
- Total COGS: "Cost of goods sold"
- Gross Profit: "Net Sales - COGS"
- Overall Margin: "Gross Profit / Net Sales"
- Active Customers: (none)

### Data source

`GET /api/customer-margin/margin/kpi`

Query params: `date_from`, `date_to`, `customer` (repeated), `type` (repeated), `agent` (repeated).

Response shape:
```
{
  total_revenue: number,
  total_cogs: number,
  gross_profit: number,
  margin_pct: number,
  active_customers: number,
  iv_revenue: number,
  cn_revenue: number,
  return_rate_pct: number
}
```

### Revenue calculation details

Revenue and COGS are computed from a UNION ALL of three document types:
- **IV** (Invoice): `src = 'IV'`, revenue = iv.LocalNetTotal, cost = SUM(ivdtl.LocalTotalCost) where cost >= 0
- **DN** (Debit Note): `src = 'DN'`, revenue = dn.LocalNetTotal, cost = SUM(dndtl.LocalTotalCost) where cost >= 0
- **CN** (Credit Note): `src = 'CN'`, revenue = cn.LocalNetTotal, cost = SUM(cndtl.UnitCost * cndtl.Qty)

Net revenue = IV revenue + DN revenue - CN revenue.
Net COGS = IV cost + DN cost - CN cost.

All dates are converted to MYT before comparison: `DATE(DocDate, '+8 hours') BETWEEN start AND end`.

Only active customers are included: query JOINs to `debtor` where `debtor.IsActive = 'T'`, and optionally filters by `debtor.DebtorType` and `debtor.SalesAgent`.

---

## 5. Charts

### 5.1 Profitability Trend (MarginTrendChart)

| Property | Value |
|----------|-------|
| Card title | "Profitability Trend" |
| Chart type | Composed chart: vertical bars + overlay line |
| Height | 360 px |
| X-axis | `period` (YYYY-MM format, monthly grouping) |
| Left Y-axis | Gross profit in MYR (formatted as `{value/1M}M`) |
| Right Y-axis | Margin % (formatted as `{value}%`, auto domain) |
| Bar series | `gross_profit` -- name "Gross Profit", fill `#3b82f6` (blue), radius `[2,2,0,0]` |
| Line series | `margin_pct` -- name "Margin %", stroke `#ef4444` (red), strokeWidth 2, dot radius 2.5 |
| Tooltip | Custom: shows period label, each series with colour dot, RM formatting for profit, `{value.toFixed(1)}%` for margin |

**Data source:** `GET /api/customer-margin/margin/trend`

Query params: `date_from`, `date_to`, `customer`, `type`, `agent`.

Response shape: `TrendRow[]`
```
{
  period: string,      // "YYYY-MM"
  revenue: number,
  cogs: number,
  gross_profit: number,
  margin_pct: number
}
```

The query groups by `strftime('%Y-%m', DocDate, '+8 hours')` and filters to active customers only (with optional DebtorType/SalesAgent subfilter).

---

### 5.2 Customer Margin Distribution (MarginDistributionChart)

| Property | Value |
|----------|-------|
| Card title | "Customer Margin Distribution" |
| Chart type | Donut / pie chart (inner radius 55, outer radius 100) |
| Height | 320 px |
| Data key | `count` (number of customers in each bucket) |
| Name key | `bucket` |
| Label | Outer label showing `"{bucket} ({count})"`, hidden when slice < 3% of total |

**Margin buckets and colours:**

| Bucket | Colour |
|--------|--------|
| `< 0%` | `#ef4444` (red) |
| `0-5%` | `#f97316` (orange) |
| `5-10%` | `#eab308` (yellow) |
| `10-15%` | `#84cc16` (lime) |
| `15-20%` | `#22c55e` (green) |
| `20-30%` | `#10b981` (emerald) |
| `30%+` | `#059669` (dark emerald) |

Only customers with net revenue > RM 1,000 are included in the distribution.

**Data source:** `GET /api/customer-margin/margin/distribution`

Query params: `date_from`, `date_to`, `customer`, `type`, `agent`.

Response shape: `DistributionBucket[]`
```
{
  bucket: string,   // e.g. "10-15%"
  count: number,
  min_val: number,
  max_val: number
}
```

---

### 5.3 Top Customers Chart (TopCustomersChart)

| Property | Value |
|----------|-------|
| Card title | Dynamic: `"{Top|Bottom} 10 Customers"` |
| Chart type | Horizontal bar chart (layout="vertical") |
| Height | 320 px |
| Y-axis | Customer name (truncated to 35 characters), width 200 px |
| X-axis | Value axis (RM or %) depending on metric toggle |

**Toggle controls (two button groups in the card header):**

| Toggle | Options | Default |
|--------|---------|---------|
| Metric | **Gross Profit** / **Margin %** | Gross Profit |
| Direction | **Highest** / **Lowest** | Highest |

**Behaviour by metric:**

| Metric | Sort column | API limit | Extra filter | Bar colours |
|--------|------------|-----------|-------------|-------------|
| Gross Profit | `gross_profit` | Top 10 | None | Green palette: `#10b981`, `#34d399`, `#6ee7b7`, `#a7f3d0`, `#d1fae5`, `#059669`, `#047857`, `#065f46`, `#064e3b`, `#022c22` |
| Margin % | `margin_pct` | Top 50, then client-filter to 10 | `revenue >= 10000` (RM 10K minimum) | Purple palette: `#8b5cf6`, `#a78bfa`, `#c4b5fd`, `#ddd6fe`, `#ede9fe`, `#7c3aed`, `#6d28d9`, `#5b21b6`, `#4c1d95`, `#3b0764` |

When "Margin %" is selected, a subtitle appears: "min RM 10K revenue".

When "Lowest" is selected, sort order becomes ascending.

**Data source:** `GET /api/customer-margin/margin/customers` with `sort=gross_profit|margin_pct`, `order=asc|desc`, `page=1`, `limit=10|50`.

---

### 5.4 Margin by Customer Type (MarginByTypeChart) -- NOT IN SHELL

| Property | Value |
|----------|-------|
| Card title | "Margin by Customer Type" |
| Chart type | Vertical bar chart |
| Height | 320 px |
| X-axis | `"{debtor_type} ({customer_count})"`, rotated -20 degrees |
| Y-axis | Margin % |
| Bar | `margin_pct`, fill `#8b5cf6` (purple), top-position labels |

**Data source:** `GET /api/customer-margin/margin/by-type`

Query params: `date_from`, `date_to`, `customer`, `type`, `agent`.

Response shape: `TypeMarginRow[]`
```
{
  debtor_type: string,
  customer_count: number,
  revenue: number,
  cogs: number,
  gross_profit: number,
  margin_pct: number
}
```

Groups by `COALESCE(debtor.DebtorType, 'Unassigned')`, active customers only, ordered by revenue DESC.

---

### 5.5 Product Group Margin Breakdown (ProductGroupMarginChart) -- NOT IN SHELL

| Property | Value |
|----------|-------|
| Card title | "Product Group Margin Breakdown" |
| Chart type | Vertical grouped bar chart with dual Y-axes |
| Height | 320 px |
| X-axis | `item_group`, rotated -15 degrees |
| Left Y-axis | RM values (Revenue and COGS) |
| Right Y-axis | Margin % |
| Bar 1 | `revenue` -- name "Revenue", fill `#3b82f6` (blue) |
| Bar 2 | `cogs` -- name "COGS", fill `#f97316` (orange) |
| Bar 3 | `margin_pct` -- name "Margin %", fill `#10b981` (green), mapped to right Y-axis |

**Data source:** `GET /api/customer-margin/margin/by-product-group`

Query params: `date_from`, `date_to`, `customer`, `type`, `agent`, `group`.

Response shape: `ProductGroupRow[]`
```
{
  item_group: string,
  revenue: number,
  cogs: number,
  gross_profit: number,
  margin_pct: number
}
```

Detail-level query joins ivdtl/cndtl/dndtl to the item table, grouping by `COALESCE(NULLIF(item.ItemGroup, ''), 'Unclassified')`. Filters to active customers and respects product group filter. Excludes rows where ItemCode is NULL or empty.

---

### 5.6 Top 10 by Margin % (TopByMarginChart) -- NOT IN SHELL

| Property | Value |
|----------|-------|
| Card title | "Top 10 by Margin % (min RM 10K revenue)" |
| Chart type | Horizontal bar chart |
| Height | 320 px |
| Filter | Client-side: only customers with `revenue >= 10000` |
| Sort | `margin_pct` DESC, fetch top 50, then slice to 10 after filtering |
| Bar colours | Purple gradient palette (10 colours) |
| Y-axis name width | 140 px, truncated to 25 chars |

Uses the same customers endpoint as Top Customers Chart.

---

### 5.7 Top 10 by Gross Profit (TopByProfitChart) -- NOT IN SHELL

| Property | Value |
|----------|-------|
| Card title | "Top 10 by Gross Profit" |
| Chart type | Horizontal bar chart |
| Height | 320 px |
| Sort | `gross_profit` DESC, page 1, limit 10 |
| Bar colours | Green gradient palette (10 colours) |
| Y-axis name width | 140 px, truncated to 25 chars |

Uses the same customers endpoint as Top Customers Chart.

---

### 5.8 Product-Customer Matrix (ProductCustomerMatrix) -- NOT IN SHELL

| Property | Value |
|----------|-------|
| Card title | "Product Group x Customer Matrix" |
| Chart type | Heatmap table (not a chart library -- rendered as an HTML table with background colours) |
| Toggle | "Show/Hide Matrix" link in header; collapsed by default |
| Rows | Up to 30 customers (sliced client-side) |
| Columns | All unique `item_group` values from the data, sorted alphabetically |
| Cell value | `margin_pct` formatted as `"{value.toFixed(1)}%"`, or em-dash when no data |
| Cell colour | `marginBgColor()`: < 0% = `bg-red-100`, 0-5% = `bg-red-50`, 5-10% = `bg-amber-50`, 10-20% = `bg-emerald-50`, >= 20% = `bg-emerald-100` |
| Sticky column | First column (customer name) is sticky on horizontal scroll |

**Data source:** `GET /api/customer-margin/margin/product-customer`

Query params: `date_from`, `date_to`, `customer`, `type`, `agent`, `group`.

Response shape: `ProductCustomerCell[]`
```
{
  debtor_code: string,
  company_name: string | null,
  item_group: string,
  revenue: number,
  cogs: number,
  margin_pct: number
}
```

Server limits to 500 rows. Groups by `(debtor_code, item_group)`, ordered by revenue DESC.

---

## 6. Tables

### 6.1 Customer Margin Table (Customer Analysis tab)

The primary analysis table. Sortable, paginated, with an inline customer search/filter.

| Property | Value |
|----------|-------|
| Card title | "Customer Analysis" |
| Page size | 20 rows per page |
| Default sort | `gross_profit` DESC |

#### Columns

| # | Header | Field | Format | Alignment | Sort | Notes |
|---|--------|-------|--------|-----------|------|-------|
| 1 | Code | `debtor_code` | Plain text | Left | No | Muted colour, small text |
| 2 | Name | `company_name` | Plain text | Left | Yes (`company_name`) | Truncated at 200 px, bold |
| 3 | Type | `debtor_type` | Badge (secondary variant) | Left | No | |
| 4 | Revenue | `revenue` | `formatRM()` | Right | Yes (`revenue`) | |
| 5 | COGS | `cogs` | `formatRM()` | Right | Yes (`cogs`) | |
| 6 | Gross Profit | `gross_profit` | `formatRM()` | Right | Yes (`gross_profit`) | Green when >= 0, red when < 0 |
| 7 | Margin % | `margin_pct` | `formatMarginPct()` | Right | Yes (`margin_pct`) | `marginColor()`: < 10% red, 10-20% amber, >= 20% green |
| 8 | Trend | sparkline + arrow | Inline sparkline chart + trend indicator | Left | No | See below |

**Allowed sort columns:** `revenue`, `cogs`, `gross_profit`, `margin_pct`, `iv_count`, `cn_count`, `return_rate_pct`, `company_name`.

#### Trend column

Each row fetches its own monthly margin data to render a **sparkline** (100 px wide, 28 px tall mini line chart of `margin_pct` over time). Alongside the sparkline, a trend indicator arrow is shown:

| Indicator | Condition | Display |
|-----------|-----------|---------|
| Up | Current period margin > prior period margin + 0.5 pp | Green triangle (filled up) |
| Down | Current period margin < prior period margin - 0.5 pp | Red triangle (filled down) |
| Flat | Within +/- 0.5 pp | Grey em-dash |

Sparkline colour: green (`#10b981`) if last value >= first value, red (`#ef4444`) otherwise.

The trend direction is computed server-side by comparing the customer's margin_pct for the selected period against the equivalent-length prior period (e.g., if viewing Jan-Jun, compare against Jul-Dec of the prior span).

#### Customer search (inline combobox)

A multi-select combobox in the table header allows filtering by specific customers:

- Opens a dropdown with search input and checkbox list.
- Fetches all active customers from `GET /api/customer-margin/filters/customers`.
- Search matches against both `code` and `name` (case-insensitive).
- Results limited to 50 matches in the dropdown.
- Selected count shown as a pill badge.
- "Clear" button appears when any customers are selected.

#### CSV Export

A "CSV" button exports the current page data with headers: `Code, Name, Type, Revenue, COGS, Gross Profit, Margin %, Trend`. Downloads as `customer_margins.csv`.

#### Pagination

- Footer shows `"{total} customers total"` on the left.
- Prev / Next buttons with `"Page {n} of {total}"` text.
- Page resets to 1 when sort column, sort order, or customer filter changes.

#### Row click -> Customer Profile Modal

Clicking any row (except the Trend cell, which stops propagation) opens a `CustomerProfileModal` with:

| Prop | Value |
|------|-------|
| `debtorCode` | The clicked row's `debtor_code` |
| `companyName` | The clicked row's `company_name` |
| `defaultTab` | `"sold-items"` |
| `initialStartDate` | Current filter `startDate` |
| `initialEndDate` | Current filter `endDate` |

The modal contains three tabs: **Payment**, **Returns**, and **Sold Items** (default). It fetches additional data from payment, return, and customer-margin APIs.

#### Data source

`GET /api/customer-margin/margin/customers`

Query params: `date_from`, `date_to`, `customer` (repeated), `type` (repeated), `agent` (repeated), `sort`, `order`, `page`, `limit`.

Response shape:
```
{
  rows: [
    {
      debtor_code: string,
      company_name: string | null,
      debtor_type: string | null,
      sales_agent: string | null,
      revenue: number,
      cogs: number,
      gross_profit: number,
      margin_pct: number,
      iv_count: number,
      cn_count: number,
      return_rate_pct: number,
      trend: "up" | "down" | "flat"   // added server-side
    }
  ],
  total: number
}
```

The `trend` field is computed server-side by fetching the same query for the equivalent prior period (using `getPreviousPeriod()`) and comparing each customer's `margin_pct`. Threshold: +/- 0.5 percentage points.

#### Sparkline data source (per-row)

`GET /api/customer-margin/margin/customers/{code}/monthly`

Query params: `date_from`, `date_to`.

Response shape: `CustomerMonthlyRow[]`
```
{
  period: string,       // "YYYY-MM"
  revenue: number,
  cogs: number,
  gross_profit: number,
  margin_pct: number
}
```

---

### 6.2 Monthly Pivot Table (MonthlyPivotTable) -- NOT IN SHELL

| Property | Value |
|----------|-------|
| Card title | "Monthly Margin Pivot (Top 20 Customers)" |
| Toggle | "Show/Hide Pivot Table" link; collapsed by default |
| Rows | Top 20 customers by gross profit |
| Columns | Last 12 months of the selected date range (YYYY-MM format) |
| Cell value | `margin_pct` formatted as `"{value.toFixed(1)}%"`, or em-dash when no data |
| Cell colour | `marginBgColor()`: same heatmap scale as Product-Customer Matrix |
| Sticky column | First column (customer name) |

Each row fetches monthly data independently via `GET /api/customer-margin/margin/customers/{code}/monthly`.

---

### 6.3 Credit Note Impact Table (Credit Note Impact tab)

| Property | Value |
|----------|-------|
| Card title | "Credit Note Impact on Margins" |
| Page size | 20 rows per page (client-side pagination) |
| Sort | `return_rate_pct` DESC (server-side, fixed) |
| Limit | 100 customers max (server-side) |
| Filter | Only customers with `cn_revenue > 0` |

#### Columns

| # | Header | Field | Format | Colour logic |
|---|--------|-------|--------|-------------|
| 1 | Customer | `company_name` (falls back to `debtor_code`) | Truncated at 200 px, bold | Default |
| 2 | IV Revenue | `iv_revenue` | `formatRM()` | Default |
| 3 | CN Amount | `cn_revenue` | `formatRM()` | Always red (`text-red-600`) |
| 4 | Return Rate | `return_rate_pct` | `formatMarginPct()` | > 10% = red, 5-10% = amber, <= 5% = default |
| 5 | Margin Before | `margin_before` | `formatMarginPct()` | Default |
| 6 | Margin After | `margin_after` | `formatMarginPct()` | Default |
| 7 | Margin Lost | `margin_lost` | `formatMarginPct()` with +/- prefix | Positive loss = red, negative loss (improvement) = green |

**Margin calculation details:**
- `margin_before` = `(iv_revenue - iv_cost) / iv_revenue * 100` -- margin without any credit notes
- `margin_after` = `((iv_revenue - cn_revenue) - (iv_cost - cn_cost)) / (iv_revenue - cn_revenue) * 100` -- margin after credit notes
- `margin_lost` = `margin_before - margin_after` -- positive means credit notes hurt margins

#### Data source

`GET /api/customer-margin/margin/credit-note-impact`

Query params: `date_from`, `date_to`, `customer`, `type`, `agent`.

Response shape: `CreditNoteImpactRow[]`
```
{
  debtor_code: string,
  company_name: string | null,
  iv_revenue: number,
  cn_revenue: number,
  return_rate_pct: number,
  margin_before: number,
  margin_after: number,
  margin_lost: number
}
```

---

## 7. Data Quality Panel -- NOT IN SHELL

A collapsible card that reveals data quality metrics when expanded.

| Property | Value |
|----------|-------|
| Card title | "Data Quality" |
| Default state | Collapsed (header only) |
| Header badge | `"{anomalous_lines} cost anomalies detected"` |
| Icon | Warning triangle (amber) |

#### Metrics (6 tiles in a 2/3-column grid)

| # | Label | Field | Format | Notes |
|---|-------|-------|--------|-------|
| 1 | Cost Anomalies (cost > 5x revenue) | `anomalous_lines` | `formatCount()` + " lines" | Amber-coloured value. Counts ivdtl rows where `LocalTotalCost > LocalSubTotal * 5` and `LocalSubTotal > 0`. |
| 2 | Excess Cost Capped | `anomalous_cost_total` | `formatRM()` | Total excess = `SUM(LocalTotalCost - LocalSubTotal * 5)` for anomalous lines |
| 3 | Missing ItemGroup | `missing_item_group_pct` | `"{value}% of lines"` | Percentage of ivdtl lines (with non-empty ItemCode) where item.ItemGroup is NULL or empty |
| 4 | Missing ItemCode (text lines) | `missing_item_code_lines` | `formatCount()` + " lines" | Count of ivdtl rows where ItemCode is NULL or empty |
| 5 | Invoices Without Agent | `invoices_no_agent` | `formatCount()` | Count of iv rows where SalesAgent is NULL or empty |
| 6 | Date Coverage | `date_range.first` to `date_range.last` | Date strings | MIN and MAX DocDate from iv table (all time, not filtered by date range) |

#### Data source

`GET /api/customer-margin/margin/data-quality`

Query params: `date_from`, `date_to` (only these two; no customer/type/agent filters).

Response shape:
```
{
  anomalous_lines: number,
  anomalous_cost_total: number,
  missing_item_group_pct: number,
  missing_item_code_lines: number,
  invoices_no_agent: number,
  date_range: { first: string, last: string }
}
```

---

## 8. API Contracts

### 8.1 Summary of All Endpoints

| # | Method | Path | Query Params | Response Type |
|---|--------|------|-------------|---------------|
| 1 | GET | `/api/customer-margin/margin/date-bounds` | (none) | `{ min_date, max_date }` |
| 2 | GET | `/api/customer-margin/margin/kpi` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]` | `KpiData` |
| 3 | GET | `/api/customer-margin/margin/trend` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]` | `TrendRow[]` |
| 4 | GET | `/api/customer-margin/margin/customers` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]`, `sort`, `order`, `page`, `limit` | `{ rows: CustomerMarginRow[], total }` |
| 5 | GET | `/api/customer-margin/margin/customers/{code}/monthly` | `date_from`, `date_to` | `CustomerMonthlyRow[]` |
| 6 | GET | `/api/customer-margin/margin/customers/{code}/products` | `date_from`, `date_to` | `{ data: ProductRow[] }` |
| 7 | GET | `/api/customer-margin/margin/by-type` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]` | `TypeMarginRow[]` |
| 8 | GET | `/api/customer-margin/margin/by-product-group` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]`, `group[]` | `ProductGroupRow[]` |
| 9 | GET | `/api/customer-margin/margin/distribution` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]` | `DistributionBucket[]` |
| 10 | GET | `/api/customer-margin/margin/product-customer` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]`, `group[]` | `ProductCustomerCell[]` |
| 11 | GET | `/api/customer-margin/margin/credit-note-impact` | `date_from`, `date_to`, `customer[]`, `type[]`, `agent[]` | `CreditNoteImpactRow[]` |
| 12 | GET | `/api/customer-margin/margin/data-quality` | `date_from`, `date_to` | `DataQualityMetrics` |
| 13 | GET | `/api/customer-margin/filters/customers` | (none) | `{ code, name }[]` |
| 14 | GET | `/api/customer-margin/filters/types` | (none) | `string[]` |
| 15 | GET | `/api/customer-margin/filters/agents` | (none) | `{ agent, description, is_active }[]` |
| 16 | GET | `/api/customer-margin/filters/product-groups` | (none) | `string[]` |

### 8.2 Shared Query Behaviour

All date-filtered endpoints default to the hardcoded fallback range `2020-12-01` to `2025-10-31` when no `date_from`/`date_to` params are provided.

**Common filter parameters across margin endpoints:**

| Param | Maps to | Filtering logic |
|-------|---------|----------------|
| `date_from` / `date_to` | `DATE(h.DocDate, '+8 hours') BETWEEN ? AND ?` | Applied to iv, dn, cn header tables |
| `customer` | `h.DebtorCode IN (...)` | Filters the raw document union |
| `type` | `d.DebtorType IN (...)` | Filters via JOIN or subquery on debtor table |
| `agent` | `d.SalesAgent IN (...)` | Same as type |
| `group` | `item_group IN (...)` (detail-level queries only) | Filters on item.ItemGroup after join |

All margin queries exclude inactive customers (`debtor.IsActive = 'T'`).

All margin queries exclude cancelled documents (`iv.Cancelled='F'`, `cn.Cancelled='F'`, `dn.Cancelled='F' OR dn.Cancelled IS NULL`).

### 8.3 Error Handling

All endpoints return `{ error: "Internal server error" }` with HTTP 500 on failure, logging the error to server console.

### 8.4 Response Type Definitions

```
KpiData {
  total_revenue: number
  total_cogs: number
  gross_profit: number
  margin_pct: number
  active_customers: number
  iv_revenue: number
  cn_revenue: number
  return_rate_pct: number
}

TrendRow {
  period: string          // "YYYY-MM"
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
}

CustomerMarginRow {
  debtor_code: string
  company_name: string | null
  debtor_type: string | null
  sales_agent: string | null
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
  iv_count: number
  cn_count: number
  return_rate_pct: number
}

CustomerMonthlyRow {
  period: string          // "YYYY-MM"
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
}

ProductRow {
  item_code: string
  description: string
  product_group: string | null
  qty_sold: number
  revenue: number
  cost: number
  margin_pct: number
}

TypeMarginRow {
  debtor_type: string
  customer_count: number
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
}

ProductGroupRow {
  item_group: string
  revenue: number
  cogs: number
  gross_profit: number
  margin_pct: number
}

DistributionBucket {
  bucket: string
  count: number
  min_val: number
  max_val: number
}

CreditNoteImpactRow {
  debtor_code: string
  company_name: string | null
  iv_revenue: number
  cn_revenue: number
  return_rate_pct: number
  margin_before: number
  margin_after: number
  margin_lost: number
}

ProductCustomerCell {
  debtor_code: string
  company_name: string | null
  item_group: string
  revenue: number
  cogs: number
  margin_pct: number
}

DataQualityMetrics {
  anomalous_lines: number
  anomalous_cost_total: number
  missing_item_group_pct: number
  missing_item_code_lines: number
  invoices_no_agent: number
  date_range: { first: string, last: string }
}
```

---

## 9. Formatting Reference

| Function | Behaviour | Example |
|----------|-----------|---------|
| `formatRM(value, decimals=0)` | `"RM {value}"` with locale `en-MY`, negative shows `"-RM {abs}"` | `formatRM(1234567)` -> `"RM 1,234,567"` |
| `formatRMCompact(value)` | Shorthand: >= 1M shows `"RM {x}M"`, >= 1K shows `"RM {x}K"` | `formatRMCompact(1500000)` -> `"RM 1.5M"` |
| `formatMarginPct(value)` | `"{value.toFixed(1)}%"` | `formatMarginPct(12.345)` -> `"12.3%"` |
| `formatCount(value)` | Locale-formatted integer | `formatCount(1500)` -> `"1,500"` |
| `marginColor(pct)` | < 10% = `text-red-600`, 10-20% = `text-amber-600`, >= 20% = `text-emerald-600` | |
| `marginBgColor(pct)` | < 0% = `bg-red-100`, 0-5% = `bg-red-50`, 5-10% = `bg-amber-50`, 10-20% = `bg-emerald-50`, >= 20% = `bg-emerald-100` | |

---

## 10. Database Tables Referenced

| Table | Role | Key columns used |
|-------|------|-----------------|
| `iv` | Invoice headers | DocKey, DocDate, DebtorCode, LocalNetTotal, Cancelled, SalesAgent |
| `ivdtl` | Invoice line items | DocKey, ItemCode, LocalSubTotal, LocalTotalCost, Description, Qty |
| `dn` | Debit note headers | DocKey, DocDate, DebtorCode, LocalNetTotal, Cancelled |
| `dndtl` | Debit note line items | DocKey, ItemCode, LocalSubTotal, LocalTotalCost |
| `cn` | Credit note headers | DocKey, DocDate, DebtorCode, LocalNetTotal, Cancelled |
| `cndtl` | Credit note line items | DocKey, ItemCode, LocalSubTotal, UnitCost, Qty |
| `debtor` | Customer master | DebtorCode, CompanyName, DebtorType, SalesAgent, IsActive |
| `item` | Product master | ItemCode, ItemGroup |
| `item_group` | Product group lookup | ItemGroup, Description |
| `sales_agent` | Sales agent lookup | SalesAgent, Description, IsActive |
