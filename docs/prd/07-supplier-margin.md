# Supplier Performance

> **Page Title:** "Supplier Performance"
> **Page Description:** "Analyzes profit margin trends for suppliers, supporting negotiation and procurement strategies."

---

## 1. Purpose & User Goals

The Supplier Performance page answers: **"Which suppliers give us the best deals — and where are we losing money?"**

Unlike the Customer Margin page (which looks at who you *sell to*), this page looks at who you *buy from*. It calculates profitability at the **item level** by matching each product's purchase cost (from purchase invoices) to its selling price (from sales invoices and cash sales). When an item is supplied by multiple suppliers, revenue and cost are **attributed proportionally** based on each supplier's share of total purchased quantity.

- **What's our overall purchasing margin?** Five KPI cards with Est. Net Sales, Est. Cost of Sales, Est. Gross Profit, Gross Margin %, and active supplier count
- **How are margins trending?** Monthly profitability chart combining profit bars with margin % line
- **Who are the best/worst performers?** Top/Bottom 10 chart with entity, metric, and direction toggles
- **How is our supplier base distributed?** Margin distribution bar chart across 7 buckets
- **Which individual items are profitable or loss-making?** Interactive scatter plot of purchase vs. selling price
- **How does each supplier perform in detail?** Sortable supplier table with sparkline trends, linking to supplier profile modal
- **Which supplier offers the best price for a specific item?** Price comparison panel with trend charts and supplier comparison table

**Key caveat for users:** Because the system does not track which supplier's stock was sold to which customer, net sales, cost of sales, and profit per supplier are **estimated** — split based on each supplier's share of total purchases. Quantity purchased, average purchase price, and total spend use **actual data** from purchase invoices. All "Est." labels throughout the page reinforce this distinction.

**Same formula, different lens:** Both Customer Margin and Supplier Performance calculate `(Selling Price − Purchase Price) / Selling Price`, but Customer Margin slices by who you sell to; Supplier Performance slices by who you buy from.

---

## 2. Page Layout

### Top-to-Bottom Section Order

```
┌─────────────────────────────────────────────────┐
│  Filter Bar (date range picker, bordered card)   │
├─────────────────────────────────────────────────┤
│  KPI Cards (5 cards)                             │
│  [Purchase Cost] [Est. Net Sales] [Gross Profit] │
│  [Avg Margin %] [Suppliers]                      │
├─────────────────────────────────────────────────┤
│  ┌────────────────────┬────────────────────┐     │
│  │ Profitability      │ Margin             │     │
│  │ Trend Chart        │ Distribution Chart │     │
│  │ (bar+line, 3/5)    │ (donut, 2/5)       │     │
│  └────────────────────┴────────────────────┘     │
├─────────────────────────────────────────────────┤
│  Top/Bottom Chart (horizontal bar)               │
├─────────────────────────────────────────────────┤
│  Purchase vs Selling Price Scatter Chart         │
├─────────────────────────────────────────────────┤
│  Tabbed Section                                  │
│  [Supplier Analysis | Price Comparison]          │
│  (full width)                                    │
└─────────────────────────────────────────────────┘
```

### Width / Responsiveness

| Row | Content | Width / Responsiveness |
|-----|---------|----------------------|
| 1 | Filter Bar | Full width |
| 2 | KPI Cards | 2 columns small, 3 columns medium, 5 columns extra-large |
| 3 | Profitability Trend + Margin Distribution | Side-by-side on large screens; stacked on small |
| 4 | Top/Bottom Chart | Full width |
| 5 | Purchase vs Selling Price Scatter | Full width |
| 6 | Tabbed Section | Full width |

Maximum content width: 1600px, centered.

---

## 3. Filters & Controls

### 3.1 Date Range Filter

A single date range section inside a bordered card, using shared date range pickers (start and end).

**Default range:** 12 months ending at the latest month in the dataset (inclusive). Start date = first day of the month 11 months before the latest month; end date = last day of the latest month.

Date bounds are fetched from the earliest and latest transaction dates (converted to Malaysia Time, UTC+8) across invoice, cash sale, and purchase invoice tables where document is not cancelled.

### 3.2 Additional Filter Infrastructure (Not Exposed in UI)

The filter system internally tracks these fields, but the UI only shows the date range picker:

- **Supplier multi-select** — filter to specific supplier codes
- **Item Group multi-select** — filter by item group

These filters exist in the data layer and are used for internal data fetching, but no UI controls are provided to the user on the main page. They are noted here for the production team to decide whether to expose them.

### 3.3 URL Parameters

Filter state is **not persisted** in the URL. All state is managed client-side.

### 3.4 Granularity

The trend chart is hardcoded to **monthly** granularity. No granularity toggle is exposed to the user.

---

## 4. KPI Cards

Five cards in a single responsive row (2 columns on small screens, 5 on extra-large). All show the full date range totals.

### Card 1: Est. Net Sales

- **Label:** "Est. Net Sales"
- **Value:** RM amount, no decimals (e.g., "RM 75,600,000")
- **Formula subtitle:** "Invoice + Cash Sale (excl. credit notes)"
- **Formula:** Sum of invoice sales + cash sale revenue for items that also have purchase records, within the selected date range
- **Notes:** Only non-cancelled documents. Uses local currency amounts. Only items with purchase records are included (ensures apples-to-apples comparison).

### Card 2: Est. Cost of Sales

- **Label:** "Est. Cost of Sales"
- **Value:** RM amount, no decimals
- **Formula subtitle:** "Avg purchase price × sold qty"
- **Formula:** For each item: (average purchase price from purchase invoices across the entire date range) × quantity sold from invoices + cash sales
- **Notes:** Average purchase price is computed over the entire selected date range (not per period), providing consistent unit costs without inventory timing distortions.

### Card 3: Est. Gross Profit

- **Label:** "Est. Gross Profit"
- **Value:** RM amount, no decimals
- **Formula subtitle:** "Est. Net Sales − Est. Cost of Sales"
- **Color logic:** Green if ≥ 0, Red if < 0

### Card 4: Gross Margin %

- **Label:** "Gross Margin %"
- **Value:** Percentage to 1 decimal (e.g., "9.3%"), or "—" if null
- **Formula subtitle:** "Gross Profit ÷ Net Sales"
- **Formula:** (Est. Gross Profit ÷ Est. Net Sales) × 100
- **Color logic:** Red if < 10%, Amber if 10–20%, Green if ≥ 20%

### Card 5: Active Suppliers

- **Label:** "Active Suppliers"
- **Value:** Integer with thousands separator (e.g., "107")
- **Formula:** Count of distinct supplier codes with non-cancelled purchase invoices in the date range

**Loading state:** 5 skeleton placeholder cards (animated pulse) while data loads.

---

## 5. Charts

### 5.1 Profitability Trend (Composed Bar + Line)

- **Title:** "Profitability Trend"
- **Subtitle:** "Est. Gross Profit (bars) with Margin % overlay (line)"
- **Chart type:** Composed chart with bars and an overlaid line (dual Y-axis)
- **Height:** Fixed at 360px
- **Granularity:** Monthly only (hardcoded)

| Series | Axis | Color | Description |
|--------|------|-------|-------------|
| Est. Gross Profit (bars) | Left Y-axis (RM) | `#10b981` (emerald) | Net Sales minus Cost of Sales per month |
| Margin % (line) | Right Y-axis (%) | `#ef4444` (red) | (Profit ÷ Net Sales) × 100 per month, with dots at each data point |

- **X-axis:** Month labels formatted as "Jan 25", "Feb 25" etc.
- **Left Y-axis:** Abbreviated RM values (e.g., "1.2M", "500K")
- **Right Y-axis:** Percentage, domain starts at 0
- **Tooltip:** Shows period, Est. Gross Profit (RM formatted), and Margin % (1 decimal)
- **Legend:** Shown below the chart

### 5.2 Top/Bottom Suppliers or Items (Horizontal Bar Chart)

- **Position:** Full width, standalone row below the Trend + Distribution row
- **Title:** Dynamic, e.g., "Top 10 Suppliers" or "Bottom 10 Items"
- **Chart type:** Horizontal bar chart with rounded end caps
- **Height:** Fixed at 320px

**Three toggle groups in the header (button pair styling):**

| Toggle | Options | Default |
|--------|---------|---------|
| Entity | Suppliers / Items | Suppliers |
| Metric | Gross Profit / Margin % | Gross Profit |
| Direction | Highest / Lowest | Highest |

**Behavior:**
- Shows exactly 10 entries
- Y-axis: entity name (truncated at 50 characters), 280px width, font size 12px
- X-axis: RM values (Gross Profit mode) or percentage (Margin % mode)
- Each bar gets a unique color from a 10-color palette:
  - Profit mode: shades of emerald/green
  - Margin % mode: shades of violet/purple

**Tooltip:** Shows entity name, Gross Profit (RM), Margin % (1 decimal), and Net Sales (RM).

**Empty state:** "No data for selected period" centered in the chart area.

### 5.3 Margin Distribution (Vertical Bar Chart)

- **Position:** Right side of the Trend + Distribution row (2/5 width on large screens)
- **Title:** "Supplier Margin Distribution" or "Item Margin Distribution" (depends on toggle)
- **Chart type:** Vertical bar chart (NOT donut)
- **Height:** Matches Profitability Trend card height (360px container, card stretches to fill row)

**Entity toggle:** Suppliers / Items (button pair in header)

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

- **X-axis:** Bucket labels
- **Y-axis:** Count of suppliers or items
- **Bar labels:** Count shown above each bar
- **Tooltip:** Shows bucket label, count of entities, and percentage of total
- **Empty buckets:** Shown with zero height (all 7 buckets always rendered)

### 5.4 Purchase vs Selling Price (Scatter Chart)

- **Title:** "Purchase vs Selling Price"
- **Subtitle:** "Each dot is an item. Above the diagonal = profit. Dot size = revenue volume."
- **Chart type:** Scatter plot (bubble chart)
- **Height:** Fixed at 600px

**Axes:**
- X-axis: Avg Purchase / Unit (RM) — labeled at bottom
- Y-axis: Avg Selling Price (RM) — labeled on left
- Z-axis (bubble size): Revenue volume, range mapped to dot radius 40–400

**Reference line:** Dashed diagonal from (0,0) to (maxPrice, maxPrice). Points above = profit; below = loss.

**Three scatter series (color-coded by margin tier):**

| Series | Condition | Fill Color | Stroke | Opacity |
|--------|-----------|------------|--------|---------|
| Healthy (>5%) | margin_pct > 5 | `#10b981` (emerald) | `#059669` | 0.7 |
| Low Margin (0-5%) | 0 ≤ margin_pct ≤ 5 | `#f59e0b` (amber) | `#d97706` | 0.7 |
| Loss (<0%) | margin_pct < 0 | `#ef4444` (red) | `#dc2626` | 0.7 |

**Legend:** Shown below the chart, centered.

**Local filters (within the chart card):**

| Filter | Type | Description |
|--------|------|-------------|
| Margin view toggle | All Items / Outliers Only | "Outliers" shows only items with margin < 0% or > 40% |
| Supplier multi-select | Searchable checkbox dropdown with badges | Filters to items supplied by selected suppliers; options derived from currently visible points |
| Item multi-select | Searchable checkbox dropdown with badges | Filters to specific items; options cascade from margin view → supplier selection |
| Reset button | Button | Clears all local filters; shown only when any filter is active |
| Item count indicator | Text | "Showing X of Y items" in top-right |

**Filter cascade order:** Margin view → Supplier filter → Item filter. When margin view changes, stale supplier selections are cleared. When suppliers change, stale item selections are cleared.

**Click behavior:** Clicking a dot opens a pinned detail dialog (modal overlay with semi-transparent backdrop). The dialog shows:
- Item name (bold), item code (monospace), supplier names
- Grid layout: Purchase price, Selling price, Margin % (colored), Revenue
- Dismissed by clicking the backdrop or the close (×) button

**Hover tooltip:** Only shown when no point is pinned. Shows item name, code, supplier names, purchase price, selling price, margin %, and revenue.

### 5.5 Sparklines (Inline Mini Charts in Supplier Table)

- **Dimensions:** 100px wide × 28px tall
- **Type:** Mini line chart (no axes, no dots, no animation)
- **Data:** Array of monthly margin percentages (with period labels) for each supplier, ordered chronologically
- **Color logic:** Green (`#10b981`) if last value ≥ first value (trending up or flat); Red (`#ef4444`) if last < first (trending down)
- **Fallback:** Shows "—" dash if fewer than 2 data points
- **Clickable:** Clicking the sparkline opens a popover with detailed margin trend data (see Sparkline Tooltip Popover below)
- **Expand icon:** A small expand icon appears on hover to indicate clickability

#### Sparkline Tooltip Popover (Standardized)

All sparklines across the dashboard use a consistent popover pattern when clicked:

1. **Header:** Entity name (truncated), value range (first → last), percentage change with directional arrow (▲/▼) and color, month count
2. **Chart:** Full LineChart (340×120px) with CartesianGrid, labeled axes, and hover tooltip showing exact values
3. **Table:** Scrollable monthly data table (max 200px height) with relevant columns

**Supplier Performance table tooltip columns:** Month | Margin %
**Customer Margin table tooltip columns:** Month | Revenue | Margin %
**Supplier Profile item tooltip columns:** Month | Avg Price | Qty

**Color semantics are context-aware:**
- Margin sparklines: Green = margin increasing (good), Red = margin decreasing (bad)
- Price sparklines: Green = price decreasing (good for procurement), Red = price increasing (bad)

---

## 6. Tables

### 6.1 Supplier Analysis Table (Tab: "Supplier Analysis")

The primary table listing every supplier with their financial performance.

**Header:**
- Title: "Supplier Analysis"
- Estimation explanation note with info icon: explains that Est. values are attributed proportionally, while purchase data is actual
- Multi-select supplier combobox (searchable by code or name, shows badge count when active)
- Clear selection button (visible when suppliers are selected)
- Export Excel button (.xlsx format)

**Columns:**

| # | Column Header | Sortable | Details |
|---|---------------|----------|---------|
| 1 | Code | No | Supplier account code, monospace, small text |
| 2 | Supplier Name | Yes | Blue underlined link — opens supplier profile modal on click. Truncated at ~200px |
| 3 | Type | No | Supplier type classification, or "—" if null |
| 4 | Items | Yes | Count of distinct items supplied |
| 5 | Est. Net Sales | Yes | Attributed net sales (RM formatted) |
| 6 | Est. Cost of Sales | Yes | Attributed cost of sales (RM formatted) |
| 7 | Est. Gross Profit | Yes | Attributed gross profit (RM formatted, bold) |
| 8 | Trend | No | Clickable sparkline (100×28px) with hover expand icon. Opens popover with margin trend chart and monthly data table. Fixed 130px width |
| 9 | Margin % | Yes | Percentage to 1 decimal, plain text (no color coding — sparkline color conveys trend direction) |

**Trend indicator:** The sparkline color (green/red) indicates overall direction. Detailed change information (exact values, percentage change) is available in the sparkline tooltip popover.

**Row styling:** Alternating row shading — even rows have a subtle muted background.

**Sorting:**
- Default: Est. Net Sales descending
- Click any sortable column header to toggle sort direction
- Changing sort resets to page 1

**Pagination:**
- Default: 25 rows per page
- Options: 10, 25, 50
- Shows "Showing X–Y of Z suppliers · Page N of M"
- Previous / Next buttons

**Table container:** Height-locked to prevent layout shift during page transitions.

**Excel export columns:** Supplier Code, Supplier Name, Type, Items, Est. Net Sales, Est. Cost of Sales, Est. Gross Profit, Margin %.

**Supplier name click:** Opens the **Supplier Profile Modal** in the "Items Supplied" view by default (not the profile overview).

### 6.2 Supplier Profile Modal

Triggered by clicking a supplier name (blue link) in the Supplier Analysis table. Displays as a fixed overlay (90% viewport width, 90% viewport height) with semi-transparent backdrop.

**The modal has two views** that the user can switch between:

#### Header (shared across both views)

- Supplier name (extra-large, extra-bold)
- Supplier code (monospace) and Active/Inactive badge (green animated dot for active, red static for inactive)
- "SUPPLIER" badge (indigo) on the right
- Close button (×)

#### View A: Profile View

Contains three sections:

**Section 1 — Supplier Details + Log**
Side-by-side layout: details grid (left) + log panel (right, 384px wide).

Details are a 3-column grid with dividers:
- **General:** Supplier Type, Purchase Agent, Supplier Since
- **Contact:** Contact Person, Phone, Mobile, Email
- **Terms:** Payment Terms, Credit Limit, Currency

Log panel contains a single button: "Items Supplied" → switches to Items view.

**Section 2 — Performance**
Date range picker with presets (independent from the dashboard filters).

**Statistics — 2 side-by-side cards:**
- Margin Performance: Semi-circle gauge visualization (0–50% scale), colored by margin thresholds
- Supply Dependency: Large fraction display (sole count / total variants) + horizontal stacked bar (multi-source blue vs. sole supplier amber)

**Trends — 2 side-by-side charts:**
- Purchase Trend & Margin: 3 KPI cards (Accumulated Purchase Cost, Avg Gross Margin, Est. Gross Profit) + composed bar chart (purchase cost bars + margin % line), 220px height
- Top 5 Items: Toggle (Est. Gross Profit / Margin %), 3 KPI cards (Top Item, Top Value, Top 5 Total) + horizontal bar chart, 220px height

#### View B: Items Supplied View

Back button (returns to Profile view) + "Items Supplied" title with estimation explanation note + search box (item code or name) + independent date range picker.

**Filter controls:**
- Sole Source Only toggle button (amber styling when active, shows count badge). When active, explanatory text appears.
- Product dropdown filter (searchable)
- Variant dropdown filter (searchable, cascades from product selection)

**Items table columns:**

| # | Column | Sortable | Details |
|---|--------|----------|---------|
| 1 | (icon) | No | Warning icon (amber) for sole supplier items |
| 2 | Item Code | Yes | Monospace, small text |
| 3 | Description | Yes | Truncated at ~280px |
| 4 | Qty Purchased | Yes | Right-aligned, tabular nums |
| 5 | Avg Purchase / Unit | Yes | Right-aligned, monospace, RM with 2 decimals |
| 6 | Price Trend | No | Clickable sparkline that opens a popover on click |
| 7 | Est. Net Sales | Yes | Right-aligned, monospace, RM |
| 8 | Est. Cost of Sales | Yes | Right-aligned, monospace, RM |
| 9 | Margin % | Yes | Right-aligned, color-coded |

**Default sort:** Margin % descending.

**Sole supplier rows:** Highlighted with amber background tint.

**Price Trend popover (on sparkline click):**
- Header: Item description, price change (RM first → RM last), percentage change with direction arrow
- Expanded line chart: 120px height, monthly average purchase price with dots
- Monthly data table: Month, Avg Price, Qty

**Footer:** "Showing N items" with filter context.

---

## 7. Price Comparison Panel (Tab: "Price Comparison")

Accessed via the second tab in the tabbed section. Designed for procurement analysis — comparing purchase prices across suppliers for a specific item.

### 7.1 Filter Row

A 4-column grid at the top:

| Control | Description |
|---------|-------------|
| Search | Text input with search icon, filters items by code or description. Clears product/country/variant when used |
| Product | Dropdown selector, shows product names with item counts, sorted by total purchase spend descending. Clears country/variant/search when changed |
| Country | Dropdown selector, enabled only when a product is selected. Cascading from product. Clears variant/search when changed |
| Variant | Dropdown selector, enabled only when a product is selected. Cascading from product + country. Clears search when changed |

Date range label below filters shows the current date range context.

### 7.2 Layout

Side-by-side layout: **item list on the left (2/5 width) + charts on the right (3/5 width)**. Minimum height 500px.

### 7.3 Item List (Left Panel)

- Shows when search text is entered OR a product is selected
- Scrollable list (max height = viewport - 360px) with alternating row shading
- Each item row shows: description (bold, small), item code (monospace), supplier count badge
- **Sort order:** Items with ≥ 2 suppliers appear first, then sorted by total purchase spend descending
- Maximum 100 items displayed
- Active item highlighted with blue-50 background and blue left border

**Empty state (no product or search):** Centered icon with "Select a product or search to browse items"

### 7.4 Selected Item Bar

When an item is selected, a blue-tinted banner appears showing the item code (monospace, blue) and description, with a close (×) button.

### 7.5 Price Trend by Supplier (Line Chart)

Shown after selecting an item, on the right side.

- **Title:** "Price Trend by Supplier"
- **Subtitle:** "Monthly Avg Purchase / Unit (MYR) — click legend to toggle suppliers"
- **Height:** 300px
- **Chart type:** Multi-line chart, one line per supplier

| Attribute | Description |
|-----------|-------------|
| X-axis | Year-month (e.g., "2025-01") |
| Y-axis | Average purchase price in RM (2 decimal places) |
| Lines | One per supplier, each with a distinct color from a 20-color palette |
| Dots | Shown at each data point (radius 3) |
| Missing months | Lines connect across gaps |

**Tooltip:** Shows month, then each supplier name with their price (sorted by price ascending, cheapest first).

**Legend:** Clickable — click to show/hide specific suppliers.

**Color palette (20 colors):** Blue, Red, Green, Orange, Purple, Cyan, Rose, Indigo, Amber, Emerald, Violet, Teal, Fuchsia, Orange-Red, Slate-Blue, Lime, Pink, Sky, Plum, Dark-Red.

### 7.6 Supplier Comparison Table

Shown below the price trend chart after selecting an item.

- **Title:** "Supplier Comparison"
- **Subtitle:** "Sorted by average price (cheapest first) — best deal highlighted"

**Columns:**

| # | Column | Details |
|---|--------|---------|
| 1 | Supplier | Colored dot (matching chart line) + supplier name (bold). Code not shown as separate column |
| 2 | Avg Price | Average unit price across the period, RM with 2 decimals, right-aligned monospace |
| 3 | Latest | Most recent purchase price, RM with 2 decimals, right-aligned monospace |
| 4 | Min | Minimum unit price, RM with 2 decimals, right-aligned monospace, muted text |
| 5 | Max | Maximum unit price, RM with 2 decimals, right-aligned monospace, muted text |
| 6 | Qty | Total quantity purchased, right-aligned monospace |

**Row highlighting:**
- Cheapest supplier: emerald background tint (light green in light mode, dark emerald in dark mode)
- Other rows: alternating muted shading

**Empty state:** "No supplier data available" centered.

**Not shown:** Trend arrows, Last Purchase date (these exist in the backend API but are not rendered in the UI).

---

## 8. Business Rules

### 8.1 Multi-Supplier Attribution Model

When an item is supplied by multiple suppliers, revenue and cost are attributed proportionally:

```
Supplier A's share = (Qty purchased from A ÷ Total qty purchased from all suppliers) × Item's total net sales
```

This means a supplier who provides 60% of the purchased quantity for an item is attributed 60% of that item's net sales. The same logic applies to cost attribution.

**Practical implication:** No supplier's net sales or profit figure is "exact" — they are estimates based on purchasing volume share. This is why all monetary columns in the supplier table carry the "Est." prefix.

### 8.2 Revenue Calculation

```
Est. Net Sales = Invoice Sales + Cash Sale Revenue (for items with purchase records only)
```

- Only non-cancelled documents
- Uses local currency amounts (MYR)
- Dates converted to Malaysia Time (UTC+8) before filtering

### 8.3 Cost of Sales Calculation

```
Est. Cost of Sales = Average Purchase Price × Sold Quantity (per item)
```

- Average purchase price is from `purchase invoice line detail` local subtotal ÷ quantity
- Average is computed over the **entire selected date range** (not per period)
- This provides stable unit costs without inventory timing distortions

### 8.4 Margin Calculation and Color Thresholds

```
Margin % = (Est. Gross Profit ÷ Est. Net Sales) × 100
```

| Margin % Range | Color | Meaning |
|---------------|-------|---------|
| < 10% | Red | Thin margins — typical for fresh produce but needs monitoring |
| 10% – 20% | Amber | Moderate — workable |
| ≥ 20% | Green | Healthy margin |

### 8.5 Non-Product Item Exclusions

Items matching the pattern `ZZ-ZZ%` (non-product codes such as pallet charges) are excluded from all margin calculations. This exclusion is applied at the data sync level, with a safety-net filter in the query layer.

### 8.6 Product Taxonomy in Procurement

The item pricing panel uses a three-level product taxonomy for browsing:
- **Product name** (e.g., "Apple", "Dragon Fruit")
- **Country of origin** (e.g., "China", "New Zealand")
- **Variant** (e.g., "Red Delicious", "Cavendish")

These are derived from the `product` lookup table, not from the item description text.

### 8.7 Sole Supplier / Single Source Determination

An item is flagged as "sole source" when it has only **one** supplier in the selected date range. This is determined by product variant, not individual SKU — the modal states "no other supplier supplies these product variants."

### 8.8 Sparkline Trend Indicator

The sparkline color conveys direction at a glance (green = improving, red = declining). Clicking the sparkline opens a standardized tooltip popover showing the exact first-to-last change percentage, a full chart with axes, and a monthly data table. No separate trend arrows are displayed — the tooltip popover provides more precise and unambiguous trend information.

### 8.9 Data Source

All queries read from the `pc_supplier_margin` pre-computed table (monthly aggregates by supplier × item). This table is populated during the sync process and avoids expensive live joins across transaction tables.

### 8.10 Currency and Formatting

| Element | Format |
|---------|--------|
| Currency values | "RM" prefix, thousands separators (e.g., "RM 1,234,567") |
| Compact currency | "1.2M", "500K" for chart axes |
| Unit prices | "RM" prefix, 2 decimal places (e.g., "RM 3.50") |
| Percentages | 1 decimal place (e.g., "9.3%") |
| Counts | Thousands separators (e.g., "1,234") |
| Negative values | Colored red |
| Null/missing values | Shown as "—" |

---

## 9. Red Flags for Business Users

| Signal | What It Means | Suggested Action |
|--------|--------------|-----------------|
| Gross Margin % < 10% (red) | Razor-thin margins across all suppliers | Review purchasing strategy and pricing |
| Margin trend line declining steadily | Supplier costs rising faster than selling prices | Renegotiate or find alternative suppliers |
| Large red slice in distribution chart (< 0%) | Multiple suppliers/items with negative margins | Investigate loss-making relationships |
| Big red dots below diagonal in scatter chart | Popular products sold at a loss | Fix pricing or switch supplier |
| High sole-source count in supplier profile | Too dependent on one supplier for multiple items | Diversify sourcing for vulnerable items |
| Red sparklines on high-revenue suppliers (click for details) | Margins eroding on your biggest suppliers | Urgent — small margin change has large RM impact |
| Price trend lines diverging (item pricing panel) | Different suppliers pricing the same item very differently | Potential negotiation or switching opportunity |

---

## 10. Cross-Page Navigation

### Outbound Navigation

| Trigger | Destination | Details |
|---------|-------------|---------|
| Click supplier name (blue link) in Supplier Analysis table | Supplier Profile Modal | Opens to "Items Supplied" view by default. Passes supplier code, name, current date range, and pre-loaded metrics. |

### Contextual Relationships

| Question | This Page | Better Page |
|----------|-----------|-------------|
| "Which supplier gives the best margin?" | **Primary page for this** | — |
| "Who do we buy the most from?" | Shows attributed net sales column | — |
| "Which items are we selling at a loss?" | **Scatter chart highlights loss items** | — |
| "Which supplier is cheapest for [product]?" | **Price Comparison tab** | — |
| "Are supplier prices going up?" | Trend chart + sparklines + price comparison trends | — |
| "Are we too dependent on one supplier?" | **Supplier profile: sole source count** | — |
| "Which customers are most profitable?" | Not covered | Customer Margin |
| "What's our official margin?" | Item-level estimates only | Financial Statements (P&L) |

---

## 11. Screenshot References

### Default View — KPI Cards, Profitability Trend & Margin Distribution

![Top Section](screenshots/supplier-margin/top-section.png)

### Top/Bottom Chart & Purchase vs Selling Price Scatter

![Middle Info](screenshots/supplier-margin/middle-info.png)

### Purchase vs Selling Price (Detail)

![Purchase vs Supplier](screenshots/supplier-margin/purchase-vs-supplier.png)

### Supplier Analysis Table

![Supplier Margin Table](screenshots/supplier-margin/supplier-margin-table.png)

### Price Comparison Tab

![Price Comparison](screenshots/supplier-margin/price-comparison:png.png)

### Supplier Profile — Items Supplied View

![Item View](screenshots/supplier-margin/item-view.png)

### Supplier Profile — Sole Source Toggle Active

![Sole Supplier](screenshots/supplier-margin/sole-supplier.png)

