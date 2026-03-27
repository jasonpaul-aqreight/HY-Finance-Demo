# Supplier Profit Margin Dashboard

> **URL path:** `/supplier-margin`

## 1. Purpose & User Goals

This page analyzes profit margin trends for suppliers, supporting negotiation and procurement strategies. It answers questions such as:

- What is the overall gross profit margin across all suppliers for a given period?
- Which suppliers yield the highest (or lowest) profit margins?
- Which individual items are sold at a loss or with dangerously thin margins?
- How do purchase prices compare to selling prices across the product catalog?
- For a given item, which supplier offers the cheapest purchase price, and how have prices trended over time?
- For a specific supplier, what items do they supply, and are any of them sole-source (single supplier)?

**Key business note:** Margin calculations use `pidtl.LocalSubTotal` (actual purchase cost per supplier) rather than `ivdtl.LocalTotalCost` (AutoCount's blended/weighted-average COGS). This gives a more accurate per-supplier margin picture.

---

## 2. Page Layout

The page is structured top-to-bottom as follows:

1. **Page banner** -- title "Supplier Profit Margin Report" with subtitle "Analyzes profit margin trends for suppliers, supporting negotiation and procurement strategies."
2. **Filter bar** -- date range picker
3. **KPI cards** -- five summary metrics in a single row
4. **Profitability Trend chart** -- full-width composed bar+line chart
5. **Top/Bottom chart + Distribution chart** -- side by side (3:2 column ratio on large screens)
6. **Purchase vs Selling Price scatter chart** -- full-width
7. **Tabbed section** with two tabs:
   - **Supplier Analysis** -- sortable, paginated supplier table with sparklines; row click opens Supplier Profile Modal
   - **Item Pricing** -- item search, price trend chart by supplier, and supplier comparison table

Maximum content width is 1600px, centered.

---

## 3. Filters

### 3.1 Date Range

| Control | Details |
|---------|---------|
| Start date | Date picker; defaults to 12 months before the latest available date |
| End date | Date picker; defaults to the last day of the month containing the latest transaction |

Date bounds are fetched from the earliest and latest `DocDate` (converted to MYT via +8 hours) across the `iv`, `cs`, and `pi` tables where `Cancelled = 'F'`.

Default window: 12 months inclusive (start of month 11 months prior through end of the latest month).

### 3.2 URL Query Parameters

All filter state is persisted in the URL:

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | `YYYY-MM-DD` | Period start date |
| `end` | `YYYY-MM-DD` | Period end date |
| `g` | `monthly` / `quarterly` / `yearly` | Granularity (default: `monthly`) |
| `supplier` | string (repeatable) | Filter to specific supplier codes |
| `ig` | string (repeatable) | Filter to specific item groups |

---

## 4. KPI Cards

Five cards displayed in a responsive grid (2 columns on small screens, 5 on extra-large).

| # | Card Title | Value | Formula / Source | Conditional Color |
|---|------------|-------|------------------|-------------------|
| 1 | **Gross Sales** | RM formatted, 0 decimals | Sum of `ivdtl.LocalSubTotalExTax` (invoices) + `csdtl.LocalSubTotalExTax` (cash sales) for non-cancelled docs in period, only for items that also appear in purchase records | -- |
| 2 | **Purchase Cost** | RM formatted, 0 decimals | For each item: (average purchase price from `pidtl.LocalSubTotal / pidtl.Qty`) multiplied by sold quantity from IV+CS | -- |
| 3 | **Gross Profit** | RM formatted, 0 decimals | Gross Sales minus Purchase Cost | Green (`text-emerald-600`) if >= 0; Red (`text-red-600`) if < 0 |
| 4 | **Overall Margin** | Percentage, 1 decimal | (Gross Profit / Gross Sales) * 100 | Green if >= 20%; Amber if >= 10%; Red if < 10% |
| 5 | **Active Suppliers** | Integer, locale-formatted | Count of distinct `pi.CreditorCode` with non-cancelled purchase invoices in period | -- |

Each card shows a small formula subtitle below the value (e.g., "IV + CS (excl. credit notes)", "Avg purchase price x sold qty", etc.).

**Margin color thresholds (used throughout the page):**
- >= 20% -- green (`text-emerald-600`)
- >= 10% -- amber (`text-amber-600`)
- < 10% -- red (`text-red-600`)

---

## 5. Charts

### 5.1 Profitability Trend (Composed Bar + Line)

- **Title:** "Profitability Trend"
- **Subtitle:** "Gross Profit (bars) with Margin % overlay (line)"
- **Chart type:** Composed chart with bars and an overlaid line
- **Granularity:** Monthly (hardcoded to `monthly` in the current implementation)
- **Height:** 360px

| Series | Axis | Data Key | Color | Description |
|--------|------|----------|-------|-------------|
| Gross Profit (bars) | Left Y-axis (RM) | `profit` | `#10b981` (emerald) | Revenue minus COGS per period |
| Margin % (line) | Right Y-axis (%) | `margin_pct` | `#ef4444` (red) | (profit / revenue) * 100 per period |

- **X-axis:** Period label (e.g., "2025-01", "2025-02")
- **Left Y-axis:** Abbreviated RM values (e.g., "1.2M", "500K")
- **Right Y-axis:** Percentage, domain starts at 0
- **Tooltip:** Shows period label, Gross Profit in RM, Margin % with 1 decimal

**Data derivation per period:**
- `revenue`: sum of `ivdtl.LocalSubTotalExTax` + `csdtl.LocalSubTotalExTax` for items that have purchase records
- `cogs`: sum of (sold quantity * item's average purchase price from `pidtl`)
- `profit`: revenue - cogs
- `margin_pct`: (profit / revenue) * 100

The average purchase price is computed over the entire selected date range (not per period), so each period reflects consistent unit costs without inventory timing distortions.

---

### 5.2 Top/Bottom Suppliers or Items (Horizontal Bar Chart)

- **Title:** Dynamic, e.g., "Top 10 Suppliers" or "Bottom 10 Items"
- **Chart type:** Horizontal bar chart
- **Height:** 320px

**Three toggle groups in the header:**

| Toggle | Options | Default |
|--------|---------|---------|
| Entity | Suppliers / Items | Suppliers |
| Metric | Gross Profit / Margin % | Gross Profit |
| Direction | Highest / Lowest | Highest |

| Toggle Combination | Sort Field | Sort Order |
|--------------------|------------|------------|
| Highest + Gross Profit | `profit` | Descending |
| Lowest + Gross Profit | `profit` | Ascending |
| Highest + Margin % | `margin_pct` | Descending |
| Lowest + Margin % | `margin_pct` | Ascending |

- Shows exactly 10 entries
- Y-axis: supplier name or item name (truncated at 35 characters)
- X-axis: RM values (when Gross Profit) or percentage (when Margin %)
- Each bar gets a unique color from a 10-color palette:
  - Profit palette: shades of emerald/green
  - Margin palette: shades of violet/purple
- **Tooltip:** Shows name, Gross Profit (RM), Margin %, and Revenue (RM)

**Data source (suppliers):** Attributed revenue and cost computed by weighting each supplier's share of purchased quantity for each item against the item's total purchased quantity across all suppliers.

**Data source (items):** Per-item revenue, COGS, profit, and margin.

---

### 5.3 Purchase vs Selling Price (Scatter Chart)

- **Title:** "Purchase vs Selling Price"
- **Subtitle:** "Each dot is an item. Above the diagonal = profit. Dot size = revenue volume."
- **Chart type:** Scatter plot
- **Height:** 600px

**Axes:**
- X-axis: Average Purchase Price (RM) -- derived from `pidtl.LocalSubTotal / pidtl.Qty`
- Y-axis: Average Selling Price (RM) -- derived from `ivdtl.LocalSubTotalExTax / ivdtl.Qty` + `csdtl.LocalSubTotalExTax / csdtl.Qty`
- Z-axis (bubble size): Revenue volume; range mapped to dot radius 40-400

**Reference line:** Dashed diagonal from (0,0) to (maxPrice, maxPrice). Points above this line are profitable; below means loss.

**Three scatter series (color-coded by margin tier):**

| Series | Condition | Fill Color | Stroke |
|--------|-----------|------------|--------|
| Healthy (>5%) | `margin_pct > 5` | `#10b981` (emerald) | `#059669` |
| Low Margin (0-5%) | `0 <= margin_pct <= 5` | `#f59e0b` (amber) | `#d97706` |
| Loss (<0%) | `margin_pct < 0` | `#ef4444` (red) | `#dc2626` |

**Local filters (within the chart):**

| Filter | Type | Description |
|--------|------|-------------|
| Margin view toggle | All Items / Outliers Only | "Outliers" shows only items with margin < 0% or > 40% |
| Supplier multi-select | Searchable checkbox dropdown | Filters scatter points to items supplied by selected suppliers; options derived from currently visible points |
| Item multi-select | Searchable checkbox dropdown | Filters to specific item codes; options cascade from supplier selection |
| Reset button | Button | Clears all local filters; shown only when filters are active |

- **Item count indicator:** "Showing X of Y items" displayed in top-right
- **Hover tooltip:** Item name, item code, supplier names, purchase price, selling price, margin %, revenue
- **Click behavior:** Clicking a dot opens a pinned detail dialog (modal overlay) showing the same fields in a grid layout; dismissed by clicking outside or the close button

---

### 5.4 Margin Distribution (Donut Chart)

- **Title:** "Supplier Margin Distribution" or "Item Margin Distribution" (depends on toggle)
- **Chart type:** Donut (pie with inner radius)
- **Height:** 320px
- **Inner radius:** 55px, **Outer radius:** 100px

**Entity toggle:** Suppliers / Items (button group in header)

**Margin buckets and colors:**

| Bucket | Color |
|--------|-------|
| < 0% | `#ef4444` (red) |
| 0-5% | `#f97316` (orange) |
| 5-10% | `#eab308` (yellow) |
| 10-15% | `#84cc16` (lime) |
| 15-20% | `#22c55e` (green) |
| 20-30% | `#10b981` (emerald) |
| 30%+ | `#059669` (dark emerald) |

- **Labels:** Each slice with >= 3% share shows an external label: "bucket (count)"
- **Tooltip:** Shows count of suppliers or items in the bucket
- **Legend:** Shown below the chart

---

### 5.5 Sparklines (Inline Mini Charts in Supplier Table)

- **Dimensions:** 100px wide x 28px tall
- **Type:** Mini line chart (no axes, no dots, no animation)
- **Data:** Array of monthly margin percentages for each supplier, ordered chronologically
- **Color logic:** Green (`hsl(152, 69%, 40%)`) if last value >= first value (trending up); Red (`hsl(0, 72%, 51%)`) if last < first (trending down)
- **Fallback:** Shows "---" dash if fewer than 2 data points

---

## 6. Tables

### 6.1 Supplier Analysis Table

- **Title:** "Supplier Analysis"
- **Page size:** 20 rows per page
- **Default sort:** `attributed_revenue` descending

**Toolbar controls:**
- Supplier search combobox (multi-select, searchable by code or name; sources from `creditor` table where `IsActive = 'T'`)
- Clear selection button (visible when suppliers are selected)
- Export CSV button (exports all filtered/sorted rows)

**Columns:**

| # | Column Header | Data Source | Alignment | Sortable | Format |
|---|---------------|-------------|-----------|----------|--------|
| 1 | Code | `creditor.AccNo` (via `pi.CreditorCode`) | Left | No | Monospace, small text |
| 2 | Supplier Name | `creditor.CompanyName` | Left | Yes | Truncated at ~200px |
| 3 | Type | `creditor_type.Description` | Left | No | Small text; "---" if null |
| 4 | Items | Count of distinct `pidtl.ItemCode` for this supplier | Right | Yes | Integer |
| 5 | Revenue | Attributed revenue (weighted by supplier's share of purchased quantity) | Right | Yes | RM, monospace |
| 6 | Purchase Cost | Attributed COGS (weighted similarly) | Right | Yes | RM, monospace |
| 7 | Profit | Attributed profit (revenue - cost) | Right | Yes | RM, monospace, bold |
| 8 | Trend | Monthly margin sparkline + directional arrow | Center | No | Sparkline (100x28px) + arrow indicator |
| 9 | Margin % | (Attributed profit / Attributed revenue) * 100 | Right | Yes | Percentage, 1 decimal; color-coded |

**Trend arrow logic:** Compares current-period margin to prior-period margin (same-length lookback). Threshold: +/- 0.5 percentage points.
- Up arrow (green `text-emerald-600`): current margin > prior + 0.5pp
- Down arrow (red `text-red-600`): current margin < prior - 0.5pp
- Dash (muted): within 0.5pp

**Alternating row shading:** Even rows have `bg-muted/20`.

**Pagination:** Previous / Next buttons; shows "{total} suppliers . page X of Y".

**CSV export columns:** Supplier Code, Supplier Name, Type, Revenue, Purchase Cost, Profit, Trend, Margin %, Items.

**Row click action:** Opens the **Supplier Profile Modal** (see Section 6.2).

---

### 6.2 Supplier Profile Modal

Triggered by clicking any row in the Supplier Analysis table. Displays as a dialog overlay (90% viewport width, 90% max height).

**Header section** (fixed at top, with muted background):
- Supplier name (large, bold)
- Active/Inactive badge (green if `creditor.IsActive = 'T'`, red otherwise)
- Supplier code (monospace)
- Two KPI cards:
  - **Items Supplied** -- count of distinct items this supplier provided in the period
  - **Single Supplier Items** (with warning icon) -- count of items where this is the ONLY supplier in the period; highlighted in amber

**Scrollable body** contains the **Purchase Items Tab**:

**Date range controls:** Independent start/end date pickers (initialized from the dashboard's current date range).

**Period-dependent KPI cards** (4 cards in a row):

| Card | Value | Source |
|------|-------|--------|
| Revenue | RM formatted | Attributed revenue for this supplier |
| Total Spend | RM formatted | Attributed COGS for this supplier |
| Gross Profit | RM formatted | Revenue - Spend |
| Margin | Percentage, color-coded | (Profit / Revenue) * 100 |

**Item detail table** with sortable columns:

| Column | Data Key | Sortable |
|--------|----------|----------|
| Item Code | `pidtl.ItemCode` | Yes |
| Description | `item.Description` | Yes |
| Qty Purchased | `pidtl.Qty` aggregated | Yes |
| Avg Purchase Price | `pidtl.LocalSubTotal / pidtl.Qty` | Yes |
| Revenue | Sales revenue from IV+CS for this item | Yes |
| COGS | Avg purchase price * sold qty | Yes |
| Margin % | (Revenue - COGS) / Revenue * 100 | Yes |
| Price Trend | Mini sparkline of monthly average purchase prices | No |

- Items that are single-supplier are flagged with a warning icon
- Search box filters by item code or description
- Price trend sparklines show monthly average purchase prices: green line if price decreased or stayed flat, red if price increased

---

## 7. Item Pricing Panel

Accessed via the "Item Pricing" tab in the tabbed section. Designed for procurement analysis -- comparing purchase prices across suppliers for a specific item.

### 7.1 Item Search

- Searchable combobox that filters items by code or description
- Each dropdown entry shows: item code (monospace), item description, and supplier count badge
- Item list sourced from all items in `pidtl` with at least 1 supplier in the period, ordered by total purchase spend descending

### 7.2 Empty State

When no item is selected: centered icon with message "Search for an item above to compare supplier pricing trends."

### 7.3 Price Trend by Supplier (Line Chart)

Shown after selecting an item.

- **Title:** "Price Trend by Supplier"
- **Subtitle:** "Monthly average purchase price (MYR) -- click legend to toggle suppliers"
- **Height:** 400px
- **Chart type:** Multi-line chart, one line per supplier

| Attribute | Description |
|-----------|-------------|
| X-axis | Year-month (e.g., "2025-01") |
| Y-axis | Average purchase price in RM (2 decimal places) |
| Lines | One per supplier, each with a distinct color from a 20-color palette |
| Dots | Shown at each data point (radius 3) |
| Missing months | Lines connect across gaps (`connectNulls`) |

**Tooltip:** Shows month, then each supplier name with their price, sorted by price ascending.

**Color palette (20 colors):** Blue, red, green, orange, purple, cyan, rose, indigo, amber, emerald, violet, teal, fuchsia, orange-red, slate-blue, lime, pink, sky, plum, dark-red.

### 7.4 Supplier Comparison Table

Shown below the price trend chart after selecting an item.

- **Title:** "Supplier Comparison"
- **Subtitle:** "Sorted by average price (cheapest first) -- best deal highlighted"

**Columns:**

| # | Column Header | Description | Format |
|---|---------------|-------------|--------|
| 1 | Supplier Code | `pi.CreditorCode` | Monospace; preceded by a colored dot matching the chart line color |
| 2 | Supplier Name | `creditor.CompanyName` | Truncated at ~200px |
| 3 | Avg Price | Average `pidtl.UnitPrice` across all transactions in period | RM, 2 decimals |
| 4 | Latest Price | Unit price from the most recent purchase transaction | RM, 2 decimals |
| 5 | Min | Minimum `pidtl.UnitPrice` in period | RM, 2 decimals, muted |
| 6 | Max | Maximum `pidtl.UnitPrice` in period | RM, 2 decimals, muted |
| 7 | Qty | Total `pidtl.Qty` purchased from this supplier | Locale-formatted integer |
| 8 | Trend | Price direction comparing last two months | Arrow: red up-arrow = price increasing, green down-arrow = decreasing, dash = flat |
| 9 | Last Purchase | Date of the most recent purchase transaction | Date string |

**Row highlighting:**
- The cheapest supplier row (lowest average price) has an emerald background tint
- Other rows have alternating muted shading

**Trend determination:** Compares the supplier's average buy price in the most recent month vs. the previous month. Change > 0.5% = up, < -0.5% = down, otherwise flat.

---

## 8. API Contracts

All endpoints accept GET requests and return JSON. Currency values are in MYR. Dates use `YYYY-MM-DD` format. All date filtering converts `DocDate` from UTC to MYT (+8 hours) before comparison.

### 8.1 Date Bounds

**Endpoint:** `GET /api/supplier-margin/margin/date-bounds`

**Parameters:** None

**Response:**
```
{
  "min_date": "2024-01-15",
  "max_date": "2025-12-31"
}
```

---

### 8.2 Dimensions

**Endpoint:** `GET /api/supplier-margin/margin/dimensions`

**Parameters:** None

**Response:**
```
{
  "suppliers": [
    { "AccNo": "300-C001", "CompanyName": "Supplier Name" }
  ],
  "itemGroups": [
    { "ItemGroup": "FRUIT", "Description": "Fresh Fruits" }
  ]
}
```

---

### 8.3 Margin Summary (KPIs)

**Endpoint:** `GET /api/supplier-margin/margin/summary`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | No | Period start (defaults to system default range) |
| `end_date` | No | Period end |

**Response:**
```
{
  "period": { "start": "...", "end": "...", "prevStart": "...", "prevEnd": "..." },
  "current": {
    "revenue": 5000000,
    "cogs": 3800000,
    "profit": 1200000,
    "margin_pct": 24.0,
    "active_suppliers": 85,
    "items_count": 320
  },
  "previous": {
    "revenue": 4500000,
    "cogs": 3400000,
    "profit": 1100000,
    "margin_pct": 24.4
  },
  "growth": {
    "revenue_pct": 11.1,
    "cogs_pct": 11.8,
    "profit_pct": 9.1,
    "margin_delta": -0.4
  },
  "top_supplier": { "name": "Best Supplier", "margin_pct": 35.2 },
  "lowest_supplier": { "name": "Lowest Supplier", "margin_pct": 2.1 }
}
```

**Notes:**
- Previous period is the same-length window immediately preceding the selected range
- `top_supplier` and `lowest_supplier` are filtered to suppliers with attributed revenue >= RM 50,000

---

### 8.4 Margin Trend

**Endpoint:** `GET /api/supplier-margin/margin/trend`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | No | Period start |
| `end_date` | No | Period end |
| `granularity` | No | `monthly` (default) / `quarterly` / `yearly` |

**Response:**
```
{
  "granularity": "monthly",
  "data": [
    {
      "period": "2025-01",
      "revenue": 450000,
      "cogs": 340000,
      "profit": 110000,
      "margin_pct": 24.4
    }
  ]
}
```

---

### 8.5 Top/Bottom Suppliers

**Endpoint:** `GET /api/supplier-margin/margin/v2/top-bottom`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | Yes | Period start |
| `end_date` | Yes | Period end |
| `limit` | No | Number of results (default: 10) |
| `order` | No | `desc` (default) or `asc` |
| `sort_by` | No | `profit` (default) or `margin_pct` |
| `supplier_type` | No | Repeatable; filter by creditor type |
| `item_group` | No | Repeatable; filter by item group |

**Response:** Array of objects:
```
[
  {
    "creditor_code": "300-C001",
    "company_name": "Supplier Name",
    "margin_pct": 28.5,
    "revenue": 500000,
    "profit": 142500
  }
]
```

---

### 8.6 Top/Bottom Items

**Endpoint:** `GET /api/supplier-margin/margin/v2/top-bottom-items`

**Parameters:** Same as Section 8.5.

**Response:** Array of objects:
```
[
  {
    "item_code": "FRT-001",
    "item_name": "Item Description",
    "item_group": "FRUIT",
    "margin_pct": 32.1,
    "revenue": 120000,
    "profit": 38520
  }
]
```

---

### 8.7 Margin Distribution

**Endpoint:** `GET /api/supplier-margin/margin/distribution`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | Yes | Period start |
| `end_date` | Yes | Period end |
| `entity` | No | `suppliers` (default) or `items` |
| `supplier_type` | No | Repeatable |
| `item_group` | No | Repeatable |

**Response:** Array of bucket objects:
```
[
  { "bucket": "< 0%", "count": 5 },
  { "bucket": "0-5%", "count": 12 },
  { "bucket": "5-10%", "count": 20 },
  { "bucket": "10-15%", "count": 18 },
  { "bucket": "15-20%", "count": 15 },
  { "bucket": "20-30%", "count": 10 },
  { "bucket": "30%+", "count": 5 }
]
```

---

### 8.8 Price Spread (Scatter Data)

**Endpoint:** `GET /api/supplier-margin/margin/price-spread`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | No | Period start |
| `end_date` | No | Period end |
| `supplier` | No | Repeatable; filter by supplier codes |
| `item_group` | No | Repeatable; filter by item groups |

**Response:**
```
{
  "data": [
    {
      "item_code": "FRT-001",
      "item_name": "Green Apple",
      "avg_purchase_price": 3.50,
      "avg_selling_price": 5.20,
      "margin_pct": 32.7,
      "revenue": 85000,
      "supplier_names": "Supplier A,Supplier B",
      "supplier_codes": "300-C001,300-C002"
    }
  ]
}
```

---

### 8.9 Supplier Table

**Endpoint:** `GET /api/supplier-margin/margin/suppliers`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | No | Period start |
| `end_date` | No | Period end |
| `supplier` | No | Repeatable; filter to specific supplier codes |
| `item_group` | No | Repeatable; filter by item groups |

**Response:**
```
{
  "data": [
    {
      "creditor_code": "300-C001",
      "company_name": "Supplier Name",
      "supplier_type": "Local",
      "attributed_revenue": 500000,
      "attributed_cogs": 380000,
      "attributed_profit": 120000,
      "margin_pct": 24.0,
      "avg_purchase_price": 3.80,
      "avg_selling_price": 5.00,
      "price_spread": 1.20,
      "items_supplied": 25,
      "trend": "up"
    }
  ]
}
```

**Trend computation:** The API fetches data for both the selected period and a same-length prior period. For each supplier, it compares margin_pct. If current > prior + 0.5pp: "up". If current < prior - 0.5pp: "down". Otherwise: "flat".

---

### 8.10 Supplier Sparklines

**Endpoint:** `GET /api/supplier-margin/margin/sparklines`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | No | Period start |
| `end_date` | No | Period end |
| `supplier` | No | Repeatable |
| `item_group` | No | Repeatable |

**Response:**
```
{
  "data": {
    "300-C001": [22.5, 23.1, 21.8, 24.0, ...],
    "300-C002": [15.2, 14.8, 16.0, ...]
  }
}
```

Values are monthly margin percentages, ordered chronologically (oldest first).

---

### 8.11 Supplier Profile Summary

**Endpoint:** `GET /api/supplier-margin/margin/supplier-profile-summary`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `creditor_code` | Yes | Supplier account number |
| `start_date` | No | Period start |
| `end_date` | No | Period end |

**Response:**
```
{
  "is_active": true,
  "single_supplier_count": 5,
  "single_supplier_items": ["FRT-001", "FRT-003", "VEG-012", "VEG-015", "PKG-002"]
}
```

`single_supplier_items` lists item codes where this supplier is the ONLY source during the period.

---

### 8.12 Supplier Item Breakdown

**Endpoint:** `GET /api/supplier-margin/margin/supplier-items`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `creditor_code` | Yes | Supplier account number |
| `start_date` | Yes | Period start |
| `end_date` | Yes | Period end |

**Response:** Array of item rows with purchase and sales data for the specific supplier.

---

### 8.13 Supplier Item Price Trends

**Endpoint:** `GET /api/supplier-margin/margin/supplier-item-trends`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `creditor_code` | Yes | Supplier account number |
| `start_date` | No | Period start |
| `end_date` | No | Period end |

**Response:**
```
{
  "data": [
    {
      "item_code": "FRT-001",
      "prices": [3.20, 3.25, 3.30, 3.50, ...]
    }
  ]
}
```

`prices` is an array of monthly average purchase prices, oldest first.

---

### 8.14 Procurement Items List

**Endpoint:** `GET /api/supplier-margin/margin/procurement/items`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | Yes | Period start |
| `end_date` | Yes | Period end |

**Response:** Array of items with supplier counts, ordered by total purchase spend descending:
```
[
  {
    "item_code": "FRT-001",
    "item_description": "Green Apple",
    "supplier_count": 3,
    "total_qty": 5000,
    "total_buy": 17500
  }
]
```

---

### 8.15 Procurement Item Summary (Supplier Comparison)

**Endpoint:** `GET /api/supplier-margin/margin/procurement/item-summary`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `item_code` | Yes | Item code to analyze |
| `start_date` | Yes | Period start |
| `end_date` | Yes | Period end |

**Response:**
```
{
  "suppliers": [
    {
      "creditor_code": "300-C001",
      "creditor_name": "Supplier A",
      "avg_price": 3.20,
      "min_price": 2.80,
      "max_price": 3.60,
      "latest_price": 3.40,
      "latest_date": "2025-11-15",
      "total_qty": 2000,
      "total_buy": 6400,
      "trend": "up",
      "is_cheapest": true
    }
  ],
  "sellPrice": {
    "avg_sell_price": 5.00,
    "min_sell_price": 4.50,
    "max_sell_price": 5.50
  }
}
```

Suppliers are sorted by `avg_price` ascending (cheapest first). `is_cheapest` is true for the supplier(s) with the lowest average price.

---

### 8.16 Item Price Trend (Monthly/Weekly)

**Endpoint:** `GET /api/supplier-margin/margin/v2/item-trend`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `item_code` | Yes | Item code |
| `start_date` | Yes | Period start |
| `end_date` | Yes | Period end |
| `granularity` | No | `monthly` (default) or `weekly` |

**Response:** Array of per-supplier monthly price points:
```
[
  {
    "year_month": "2025-01",
    "creditor_code": "300-C001",
    "creditor_name": "Supplier A",
    "avg_buy_price": 3.25,
    "total_qty": 500
  }
]
```

---

## 9. Database Tables Referenced

| Table | Role |
|-------|------|
| `iv` / `ivdtl` | Sales invoices and line items |
| `cs` / `csdtl` | Cash sales and line items |
| `pi` / `pidtl` | Purchase invoices and line items |
| `item` | Item master (ItemCode, Description, ItemGroup) |
| `item_group` | Item group lookup |
| `creditor` | Supplier master (AccNo, CompanyName, IsActive, CreditorType) |
| `creditor_type` | Supplier type lookup (CreditorType, Description) |

**Key columns used:**
- `pidtl.LocalSubTotal` -- actual purchase cost (supplier-specific, not blended)
- `pidtl.Qty` -- purchased quantity
- `pidtl.UnitPrice` -- unit purchase price (used in item pricing analysis)
- `ivdtl.LocalSubTotalExTax` / `csdtl.LocalSubTotalExTax` -- sales revenue excluding tax
- `DocDate` -- always converted via `+8 hours` for MYT timezone before date grouping or filtering
- `Cancelled` -- filtered to `'F'` (non-cancelled) on all transaction tables

**Margin attribution model:** When an item is supplied by multiple suppliers, revenue and cost are attributed proportionally based on each supplier's share of total purchased quantity for that item.
