# Sales Report

> Net sales tracking page providing daily, weekly, and monthly views of sales performance with multi-dimensional breakdown analysis.

---

## 1. Purpose & User Goals

The Sales Report is the primary net sales monitoring page. It answers:

- What is our total net sales for the selected period?
- How much comes from invoiced credit sales vs. immediate cash sales?
- How large are our credit note deductions (returns and adjustments)?
- Are net sales trending up or down over time?
- Which customers, products, sales agents, or outlets contribute the most net sales?

This is the "top line" page — the starting point for understanding business performance before diving into costs, margins, or payment health.

---

## 2. Page Layout

From top to bottom:

1. **Page Banner** — Title "Sales Report" with subtitle: "Provides net sales tracking on a daily, weekly, and monthly basis to monitor sales trends and performance."
2. **Date Range Filter** — Month-year pickers, range summary, and quick-preset buttons.
3. **KPI Cards** — A responsive row of four summary metric cards.
4. **Net Sales Trend Chart** — A stacked bar chart showing net sales components over time with granularity toggle.
5. **Sales Breakdown Section** — A card containing:
   - A "Group by" dimension picker (four options).
   - Advanced filters (dimension-specific dropdowns and search).
   - A horizontal bar chart of selected rows.
   - A sortable, paginated data table with row-level selection checkboxes.

All sections respond to the global date range filter.

### Responsive Behavior

| Breakpoint | KPI Cards | Layout |
|------------|-----------|--------|
| Mobile (<640px) | 2 per row | Single column, stacked vertically |
| Tablet (640–1279px) | 3 per row | Single column, stacked vertically |
| Desktop (1280px+) | 4 per row | Full width, all sections visible |

Maximum content width: 1600px, horizontally centered.

---

## 3. KPI Cards

Four cards displayed in a responsive grid. All values formatted as Malaysian Ringgit (RM).

### 3.1 Net Sales

- **Label:** "Net Sales"
- **Value:** Total net sales for the selected date range
- **Formula:** Invoice Sales + Cash Sales − Credit Notes
- **Subtitle:** "Invoice + Cash Sales − Credit Notes"
- **Format:** RM with thousands separator, no decimals (e.g., "RM 88,213,960")

### 3.2 Invoice Sales

- **Label:** "Invoice Sales"
- **Value:** Total sales from credit-term invoices
- **Formula:** Sum of all non-cancelled invoice totals within the date range
- **Subtitle:** "Billed on credit terms to customer"
- **Format:** RM with thousands separator

### 3.3 Cash Sales

- **Label:** "Cash Sales"
- **Value:** Total sales from immediate-payment sales (includes POS transactions)
- **Formula:** Sum of all non-cancelled cash sale totals within the date range
- **Subtitle:** "Immediate payment"
- **Format:** RM with thousands separator

### 3.4 Credit Notes

- **Label:** "Credit Notes"
- **Value:** Total value of credit notes issued (returns and adjustments)
- **Formula:** Sum of all non-cancelled credit note totals within the date range (absolute value)
- **Subtitle:** "Goods returns & adjustments"
- **Format:** Displayed as a positive number with a minus sign prefix, rendered in red text (e.g., "-RM 1,013,268")
- **Styling:** Negative indicator — red text color to signal this is a deduction from revenue

---

## 4. Charts

### 4.1 Net Sales Trend

A stacked vertical bar chart showing net sales components over time.

**Chart dimensions:** 380px height, full responsive width.

**X-axis:** Time period, formatted based on the selected granularity:

| Granularity | Format | Example |
|-------------|--------|---------|
| Daily | "MMM d" | "Dec 15" |
| Weekly | "WNN" (ISO week number) | "W50" |
| Monthly | "MMM YY" | "Dec 24" |

**Y-axis:** Net Sales in RM. Large values abbreviated using compact notation (e.g., "1.2M", "350K"). A reference line is drawn at zero.

**Bar segments (stacked):**

| Segment | Position | Color | Description |
|---------|----------|-------|-------------|
| Invoice Sales | Bottom | Dark blue (#2E5090) | Sum of invoice totals per period |
| Cash Sales | Top | Green (#548235) | Sum of cash sale totals per period. Top corners rounded. |
| Credit Notes | Below zero line | Red (#C00000) | Negative sum of credit note totals per period. Bottom corners rounded. |

The combined height of Invoice + Cash Sales segments, minus the Credit Notes segment, represents net sales for that period.

**Legend:** Horizontal legend below the chart header showing three items with colored squares:
- Invoice (dark blue)
- Cash Sales (green)
- Credit Notes (red)

**Tooltip:** On hover over any bar, shows:
- Period label (formatted per granularity)
- Invoice Sales value (RM)
- Cash Sales value (RM)
- Credit Notes value (RM)

**Grid:** Dashed grid lines (horizontal and vertical).

**Controls:**
- **Granularity toggle** — Three buttons in the card header: "Daily", "Weekly", "Monthly". Default: Monthly. Switching re-fetches the trend data for the current date range.

### 4.2 Sales Breakdown Chart (Horizontal Bar)

A horizontal bar chart showing the top selected items from the breakdown table.

**Chart dimensions:** Dynamic height — minimum 400px, grows at 48px per additional bar. Full responsive width.

**Y-axis (vertical):** Dimension member name (e.g., customer name, product name). Maximum label width: 280px, truncated if longer. Font: 12px.

**X-axis (horizontal):** Net Sales in RM. Large values abbreviated with compact notation. Domain starts at 0.

**Bars:**
- Fixed height: 28px per bar.
- Right-side rounded corners (radius 3px).
- Each bar uses a distinct color from a rotating 10-color palette.
- A right-aligned RM-formatted label is displayed at the end of each bar showing its value. Font: 10px.

**Data shown:** Only the rows currently selected via checkboxes in the table below (up to 10). Sorted by net sales descending.

**Tooltip:** Shows "Net Sales: RM X" on hover.

**Grid:** Vertical dashed lines only (perpendicular to bars, serving as value reference lines).

---

## 5. Tables

### 5.1 Sales Breakdown Table

A sortable, paginated data table displayed below the breakdown chart.

**Row Selection:**
- Each row has a checkbox in the first column.
- Up to 10 rows can be selected at a time. When the limit is reached, unselected checkboxes are disabled.
- Selected rows drive the chart above (not the table search/filters).
- A selection counter displays "N/10 selected" above the table.
- Two action buttons:
  - **"Top 10"** — Resets selection to the top 10 rows by net sales.
  - **"Untick All"** — Clears all selections.
- Default selection on page load or dimension change: the top 10 rows by net sales.

**Row Styling:**
- Alternating row backgrounds for readability (every other row has a subtle tinted background).

**Columns vary by dimension:**

#### Customer

| Column | Description | Format |
|--------|-------------|--------|
| (checkbox) | Row selection | Checkbox |
| Code | Customer account number | Text |
| Customer Name | Most common name for this customer code | Blue underlined link (clickable — opens Customer Profile modal) |
| Customer Type | Customer classification; "(Uncategorized)" if not assigned | Text |
| Net Sales | Net sales = invoice + cash − credit notes | RM currency |
| Invoice Sales | Sum of invoice totals | RM currency |
| Cash Sales | Sum of cash sale totals | RM currency |
| Credit Note Amt | Sum of credit note totals | RM currency |

#### Product

| Column | Description | Format |
|--------|-------------|--------|
| (checkbox) | Row selection | Checkbox |
| Product | Product name; includes country and variant as additional data | Text |
| Country | Country of origin | Text |
| Variant | Product variant | Text |
| Net Sales | Net sales at line-item level | RM currency |
| Qty Sold | Sum of quantities from invoices and cash sales | Number (rounded, locale-formatted) |

#### Sales Agent

| Column | Description | Format |
|--------|-------------|--------|
| (checkbox) | Row selection | Checkbox |
| Sales Agent | Sales agent code/name; "(Unassigned)" if not assigned | Text |
| Active | Whether the agent is currently active | "True" / "False" |
| Net Sales | Net sales for this agent | RM currency |
| Invoice Sales | Sum of invoice totals | RM currency |
| Cash Sales | Sum of cash sale totals | RM currency |
| Customers | Count of distinct customers served by this agent | Number |

#### Outlet

| Column | Description | Format |
|--------|-------------|--------|
| (checkbox) | Row selection | Checkbox |
| Location | Outlet/warehouse name; "(Unassigned)" if not assigned | Text |
| Net Sales | Net sales for this outlet | RM currency |
| Invoice Sales | Sum of invoice totals | RM currency |
| Cash Sales | Sum of cash sale totals | RM currency |
| Credit Note Amt | Sum of credit note totals | RM currency |

**Sorting:**
- All columns are sortable by clicking the column header.
- Sort indicators: bidirectional arrow (unsorted), down arrow (descending), up arrow (ascending).
- Clicking a sorted column toggles between descending and ascending.
- Default sort: Net Sales, descending.
- Changing sort resets to page 1.

**Pagination:**
- Server-style pagination below the table.
- Page size options: 10, 25, 50, 100 rows per page.
- Shows total row count.
- Default page size: 25.

**Excel Export:**
- "Export Excel" button in the table header area.
- Exports ALL sorted rows (not just the current page) as an .xlsx file.
- Filename format: "sales-by-{dimension}" (e.g., "sales-by-customer.xlsx").
- Column widths: 30 characters for name columns, 16 characters for numeric columns.

---

## 6. Filters & Controls

### 6.1 Date Range Filter

- **Location:** Top of the page, below the banner.
- **Controls:**
  - **Start month picker** — Selects the first day of the chosen month.
  - **End month picker** — Selects the last day of the chosen month.
  - Both pickers are bounded by the earliest and latest document dates found in the data.
- **Range summary:** Displayed between the pickers and presets, formatted as "MMM yyyy — MMM yyyy (N months)" (e.g., "Nov 2024 — Oct 2025 (12 months)").
- **Quick presets:**

  | Button | Behavior |
  |--------|----------|
  | 3M | Last 3 calendar months from the latest available data date |
  | 6M | Last 6 calendar months from the latest available data date |
  | 12M | Last 12 calendar months from the latest available data date |
  | YTD | January 1 of the current year through the latest available data date |

- **Default:** If no prior state exists, defaults to the 12 months ending at the last month with data. The end date is set to the last day of the latest data month; the start date is set to the first day of the month 11 months prior.
- **Key behavior:** Presets calculate relative to the latest data date (not today's date), ensuring presets always show data even if the data sync hasn't run today.
- **Effect:** Changing the date range re-fetches all KPI, trend, and breakdown data.

### 6.2 Group By Dimension Picker

- **Location:** Header of the "Sales Breakdown" card.
- **Control:** Dropdown select (4 options).
- **Options:**

  | Value | Label |
  |-------|-------|
  | Customer | Customer |
  | Product | Product |
  | Sales Agent | Sales Agent |
  | Outlet | Outlet |

- **Default:** Customer.
- **Effect:** Switching the dimension re-fetches the breakdown data, resets the advanced filters, resets search, and resets the chart selection to the new top 10.

### 6.3 Advanced Filters (Dimension-Specific)

Located above the breakdown table. Controls vary by the selected dimension:

#### Customer Dimension
- **Search input:** Placeholder "Search by customer code or name". Case-insensitive substring match across customer code and name.
- **Customer Type dropdown:** Single-select dropdown showing all customer types found in the data. Includes an "All Customer Types" option (default) that clears the filter. Searchable within the dropdown.

#### Product Dimension
- **Search input:** Placeholder "Search by product name". Case-insensitive substring match on the product name.

Three interdependent dropdown filters that scope each other:

- **Product Name dropdown:** Shows all product names. Options are narrowed when Country or Variant is selected.
- **Country dropdown:** Shows all countries (excludes "(Unknown)"). Options are narrowed when Product Name or Variant is selected.
- **Variant dropdown:** Shows all variants (excludes "(Unknown)"). Options are narrowed when Product Name or Country is selected.

All three filters are applied with AND logic. When any filter changes, the selected chart items reset to the new top 10.

#### Sales Agent Dimension
- **Search input:** Placeholder "Search by sales agent name". Case-insensitive substring match.
- **Status dropdown:** Options: "All Status" (default), "Active", "Inactive". Filters by the sales agent's active flag.

#### Outlet Dimension
- **Search input:** Placeholder "Search by location". Case-insensitive substring match.
- No additional dropdown filters.

**Important:** Search and dropdown filters affect the table rows. The chart is driven by the checkbox selection (which may include rows that are currently filtered out of view).

### 6.4 Granularity Toggle

- **Location:** Header of the "Net Sales Trend" card.
- **Options:** Daily, Weekly, Monthly (toggle buttons).
- **Default:** Monthly.
- **Effect:** Changes the time bucket used for the trend chart. Re-fetches trend data.

---

## 7. Cross-Page Navigation

### Customer Profile Modal

- **Trigger:** Clicking a customer name (blue underlined link) in the breakdown table when in Customer dimension.
- **Opens:** The Customer Profile modal (see doc 08 for full specification).
- **Default view:** Sales Transactions (context-appropriate for the Sales Report page).
- **Date scope:** The modal inherits the current date range from the Sales Report filters.
- **Behavior:** The modal opens as a large overlay (90% viewport width and height). Closing it returns to the Sales Report with all filters preserved.

No other cross-page navigation exists on this page.

---

## 8. Business Rules

### Revenue Formula

```
Net Sales = Invoice Sales + Cash Sales − Credit Notes
```

- **Invoice Sales:** Sum of all non-cancelled invoice totals within the date range.
- **Cash Sales:** Sum of all non-cancelled cash sale totals within the date range. Includes POS (Point-of-Sale) transactions — these are already counted within cash sales and must never be added separately.
- **Credit Notes:** Sum of all non-cancelled credit note totals within the date range. Subtracted from revenue.
- Invoices and Cash Sales are **mutually exclusive** — there is no risk of double-counting.

### Data Level Distinction

- **Header-level aggregation** (Customer, Sales Agent, Outlet dimensions): Uses document-level totals (one total per invoice/cash sale/credit note). This reflects the total transaction value per customer/agent/outlet.
- **Line-item-level aggregation** (Product dimension): Uses individual line items from invoices, cash sales, and credit notes. This reflects net sales per product. Line-item subtotals may not perfectly sum to header totals due to document-level adjustments (rounding, discounts).

### Cancelled Records

All calculations exclude cancelled documents. Only non-cancelled records contribute to any metric.

### Timezone

All document dates are stored in UTC. Eight hours are added to convert to Malaysia Time (MYT, UTC+8) before any date grouping, filtering, or display.

### Currency

- All monetary values displayed in Malaysian Ringgit (RM).
- Format: "RM" prefix with thousands separators, no decimal places (e.g., "RM 1,234,567").
- Y-axis abbreviation: "M" for millions, "K" for thousands (e.g., "7.5M").

### Null & Missing Value Handling

- Customer type: Displayed as "(Uncategorized)" when not assigned.
- Sales agent: Displayed as "(Unassigned)" when not assigned.
- Outlet location: Displayed as "(Unassigned)" when not assigned.
- Product country/variant: "(Unknown)" values are excluded from the Country and Variant filter dropdowns but retained in the data table.

### Default Date Range Initialization

The page initializes with the latest 12 months of available data:
1. Find the latest date with transaction data.
2. Set the end date to the last day of that month.
3. Set the start date to the first day of the month 11 months before the end month.

This ensures the page always shows data on first load, even if the data sync hasn't run recently.

### Data Stability During Filter Changes

When users change filters (date range, dimension, advanced filters), the previously displayed data remains visible until new data arrives. This prevents the UI from flashing empty/skeleton states during brief loading periods.

---

## 9. Screenshot References

> Screenshots to be captured in Session 12.

- `screenshots/sales/default.png` — Default view (12M, Customer dimension, Monthly granularity)
- `screenshots/sales/kpi-cards.png` — Close-up of the four KPI cards
- `screenshots/sales/trend-daily.png` — Trend chart in Daily granularity
- `screenshots/sales/trend-weekly.png` — Trend chart in Weekly granularity
- `screenshots/sales/breakdown-product.png` — Breakdown by Product with filters
- `screenshots/sales/breakdown-agent.png` — Breakdown by Sales Agent
- `screenshots/sales/breakdown-outlet.png` — Breakdown by Outlet
- `screenshots/sales/customer-profile-modal.png` — Customer Profile modal opened from Sales page
- `screenshots/sales/excel-export.png` — Excel export button and behavior
- `screenshots/sales/pagination.png` — Table pagination controls
