# Customer Margin

> **Page Title:** "Customer Margin"
> **Page Description:** "Analyzes customer-level profitability by comparing revenue against Cost of Sales (COGS) at the item level, enabling margin comparisons across customers."

---

## 1. Purpose & User Goals

The Customer Margin page answers: **"Which customers make us the most money — and which ones don't?"**

Unlike the Sales page (which tracks revenue volume) or the P&L page (which uses general ledger Cost of Sales), this page calculates profitability at the **item level** — matching each product's purchase cost to its selling price per customer. This gives the most accurate picture of customer-to-customer margin differences.

- **Who is most profitable?** Ranked customer list by gross profit (RM) and margin (%)
- **How are margins trending?** Monthly gross profit bars with margin % overlay
- **Where do most customers fall?** Distribution chart showing how many customers sit in each margin bucket
- **Are returns hurting margins?** Credit Note Impact tab showing before/after margin comparison
- **Which customers need attention?** Sparkline trends showing margin direction per customer

**Key caveat for users:** Absolute margin numbers on this page may not match the P&L statement (which uses general ledger Cost of Sales). However, the **relative rankings** — who is more or less profitable — are accurate and actionable. Use this page for customer comparisons, not for official financial reporting.

---

## 2. Page Layout

The page follows a single continuous scroll with components in this order:

| Row | Content | Width / Responsiveness |
|-----|---------|----------------------|
| 1 | **Date Range Filter** — start/end month pickers | Full width |
| 2 | **KPI Cards** — 5 summary cards | 5 across on desktop, 2–3 columns on tablet, stacked on mobile |
| 3 | **Profitability Trend Chart** (left, 60%) + **Margin Distribution Chart** (right, 40%) | Side-by-side on large screens; stacked on small |
| 4 | **Top Customers Chart** | Full width |
| 5 | **Tabbed Section** — "Customer Analysis" tab and "Credit Note Impact" tab | Full width, height-locked container to prevent layout shift when switching tabs |

---

## 3. Filters & Controls

### 3.1 Date Range Filter

Two month-year pickers (start and end), constrained by the earliest and latest months with available data.

**Default range:** 12 months ending at the latest month in the dataset (inclusive). Start date = first day of the month 12 months before the latest month; end date = last day of the latest month.

### 3.2 Additional Filter Infrastructure (Not Yet Exposed in UI)

The system has full backend support for the following filters, but they are **not currently visible** in the UI:

- **Customer multi-select** — filter to specific customers by code
- **Customer Type** — filter by debtor type classification
- **Sales Agent** — filter by assigned sales agent
- **Product Group** — filter by item group

These are noted here for the production team to decide whether to expose them.

---

## 4. KPI Cards

Five cards in a single responsive row. All show the full date range totals.

### Card 1: Net Sales

- **Label:** "Net Sales"
- **Value:** RM amount, no decimals (e.g., "RM 12,345,678")
- **Formula:** Sum of all invoice revenue + debit note revenue − credit note revenue, within the selected date range
- **Notes:** Only non-cancelled documents. Uses local currency amounts.

### Card 2: Cost of Sales

- **Label:** "Cost of Sales"
- **Value:** RM amount, no decimals
- **Formula:** Sum of invoice cost + debit note cost − credit note cost (item-level costing), clamped to non-negative
- **Notes:** This is item-level Cost of Sales, not GL-based. May differ from the P&L page.

### Card 3: Gross Profit

- **Label:** "Gross Profit"
- **Value:** RM amount, no decimals
- **Formula:** Net Sales − Cost of Sales
- **Color logic:** Green if ≥ 0, Red if < 0

### Card 4: Gross Margin %

- **Label:** "Gross Margin %"
- **Value:** Percentage to 1 decimal (e.g., "18.5%")
- **Formula:** (Gross Profit ÷ Net Sales) × 100
- **Color logic:** Red if < 10%, Amber if 10–20%, Green if ≥ 20%
- **Edge case:** If Net Sales = 0, display "0.0%"

### Card 5: Active Customers

- **Label:** "Active Customers"
- **Value:** Count with thousands separator (e.g., "1,234")
- **Formula:** Count of distinct customers with any transaction in the date range

**Loading state:** 5 skeleton placeholder cards while data loads.

---

## 5. Charts

### 5.1 Profitability Trend Chart

- **Position:** Full width, below KPI cards
- **Chart type:** Combined bar + line chart (dual Y-axis)
- **Height:** Fixed at 360px
- **Left Y-axis (bars):** Gross Profit in RM, blue bars
- **Right Y-axis (line):** Margin % in red
- **X-axis:** Month labels formatted as abbreviated month + 2-digit year (e.g., "Jan 25", "Feb 25")
- **Tooltip:** On hover, shows period, gross profit (RM formatted), and margin %
- **Behavior:** Bars can extend below zero (loss months), with the zero line visible

### 5.2 Top Customers Chart

- **Position:** Full width, standalone row below the Trend + Distribution row
- **Chart type:** Horizontal bar chart
- **Height:** Fixed at 320px

**Toggle controls** (button pairs in the chart header):

| Toggle | Options | Default |
|--------|---------|---------|
| Metric | Gross Profit / Margin % | Gross Profit |
| Direction | Highest / Lowest | Highest |

**Filtering logic by metric:**

| Metric | Filter Rule | Reason |
|--------|-------------|--------|
| Gross Profit | Show top/bottom 10 by gross profit, no minimum revenue | All customers relevant for profit ranking |
| Margin % | Only customers with ≥ RM 10,000 revenue, then show top/bottom 10 | Prevents tiny accounts with extreme % from dominating the chart |

**Bar colors:**
- Gross Profit mode: Green palette (10 graduated shades)
- Margin % mode: Purple palette (10 graduated shades)

**Display:** Customer names truncated to 50 characters. Y-axis width: 280px, font size 12px. Sorted by selected metric and direction.

### 5.3 Margin Distribution Chart

- **Position:** Right side of the Trend + Distribution row (40% width on large screens)
- **Chart type:** Vertical bar chart with predefined buckets
- **Height:** Matches Profitability Trend card height (360px container, card stretches to fill row)
- **Minimum revenue threshold:** Only customers with > RM 1,000 revenue are included (reduces noise from near-zero accounts)

**Buckets and colors:**

| Bucket | Color | Interpretation |
|--------|-------|---------------|
| < 0% | Red | Losing money on these customers |
| 0–5% | Orange | Barely breaking even |
| 5–10% | Yellow | Thin margins |
| 10–15% | Lime | Acceptable — sweet spot for produce |
| 15–20% | Green | Good margins |
| 20–30% | Emerald | Strong margins |
| 30%+ | Dark Emerald | Excellent margins |

**Tooltip:** Shows bucket label, customer count, and percentage of total customers in that bucket.

---

## 6. Tables

The main data section uses a **tabbed interface** with two tabs: "Customer Analysis" and "Credit Note Impact". The tab container uses **height locking** — container maintains its height when switching tabs or paginating to prevent page jumping.

### 6.1 Customer Analysis Table (Tab: "Customer Analysis")

The primary table showing every customer's margin performance.

**Header controls:**

| Control | Description |
|---------|-------------|
| Customer multi-select | Combobox to filter by specific customers (search by name or code). Shows "N customers selected" badge when active. Clear button to reset. |
| Export Excel | Downloads .xlsx with columns: Code, Name, Type, Net Sales, Cost of Sales, Gross Profit, Margin % |

**Columns:**

| Column | Format | Sortable | Details |
|--------|--------|----------|---------|
| Code | Text (small, muted) | No | Customer account code |
| Name | Text (medium weight) | Yes | Blue underlined link — opens customer profile modal on click |
| Customer Type | Badge | No | Customer type classification, or "Unassigned" if none |
| Net Sales | RM, no decimals | Yes | Total sales (invoices + debit notes − credit notes) |
| Cost of Sales | RM, no decimals | Yes | Item-level cost of sales |
| Gross Profit | RM, no decimals | Yes | Net Sales − Cost of Sales |
| Trend | Clickable sparkline | No | Mini line chart (margin % over time) with tooltip popover on click |
| Margin % | Percentage, 1 decimal | Yes | (Gross Profit ÷ Net Sales) × 100 |

**Trend column details:**
- Sparkline: Miniature line chart showing monthly margin % for that customer over the selected date range
- Color: Green if ending margin ≥ starting margin, Red if ending margin < starting margin
- Clickable: Opens a standardized tooltip popover showing customer name, margin range with % change, a full line chart with axes, and a monthly data table (Month | Revenue | Margin %)
- Expand icon appears on hover to indicate clickability
- Each customer's monthly data is fetched individually to render the sparkline

**Sorting:**
- Default: Gross Profit descending
- Click any sortable column header to toggle sort direction
- Changing sort resets to page 1

**Pagination:**
- Default: 25 rows per page
- Options: 10, 25, 50
- Server-side pagination

**Customer profile modal:**
- Click any customer name (blue link) to open the customer profile modal
- Default tab: "Sales" (showing this customer's sales breakdown)
- Modal receives the customer code, name, and current date range

**Loading state:** "Loading..." centered in a 160px height placeholder area.

### 6.2 Credit Note Impact Table (Tab: "Credit Note Impact")

Shows how returns (credit notes) affect each customer's margin — comparing what the margin would be without any returns vs. the actual margin after accounting for returns.

**Header controls:**

| Control | Description |
|---------|-------------|
| Search | Text input — filters by customer name or code (case-insensitive, immediate) |
| Export Excel | Downloads .xlsx with columns: Customer, Invoice Sales, Credit Note Amt, Return Rate %, Margin Before, Margin After, Margin Lost |

**Columns:**

| Column | Format | Sortable | Color Logic |
|--------|--------|----------|-------------|
| Customer | Text | Yes | Customer name (falls back to code if name is missing) |
| Invoice Sales | RM, no decimals | Yes | Invoice revenue before any credit notes |
| Credit Note Amt | RM, no decimals, always red | Yes | Total credit note value — always displayed in red |
| Return Rate | Percentage, 1 decimal | Yes | (Credit Note Amt ÷ Invoice Sales) × 100. Red if > 10%, Amber if > 5% |
| Margin Before | Percentage, 1 decimal | Yes | What the margin would be if no credit notes existed |
| Margin After | Percentage, 1 decimal | Yes | Actual margin after accounting for credit notes |
| Margin Lost | Percentage, 1 decimal | Yes | Difference in percentage points. Red if positive (margin lost), Green if negative (margin gained) |

**How to read the Margin Lost column:**
- **Positive value (red):** Returns hurt this customer's margin by this many percentage points
- **Negative value (green):** Returns of low-margin items actually improved the overall margin
- **Example:** Margin Before 18%, Margin After 12% → Margin Lost = 6 pp (shown in red)

**Sorting:**
- Default: Margin Lost descending (worst offenders — customers whose returns hurt margins most — appear first)
- Client-side sorting (all rows sorted in memory)

**Pagination:**
- Default: 25 rows per page
- Options: 10, 25, 50
- Maximum 100 customers returned (enforced by backend)

**Loading state:** "Loading..." centered in a 160px height placeholder area.

---

## 7. Business Rules

### 7.1 Item-Level Costing vs. GL-Based Costing

This page uses **item-level costing**: for each product sold, the system looks up the actual purchase cost of that specific item and multiplies by quantity. This is different from the P&L page, which uses **GL-based Cost of Sales** (total debits and credits in Cost of Sales accounts).

**Why both exist:**
- Item-level costing gives accurate per-customer and per-product margins
- GL-based Cost of Sales is the official accounting figure and may include adjustments, write-offs, or timing differences not reflected at the item level

**Practical implication:** Cost of Sales on this page may differ from Cost of Sales on the P&L page. Always use P&L for official reporting. Use this page for relative customer comparisons.

### 7.2 Revenue Calculation

```
Net Sales = Invoice + Debit Note − Credit Note
```

- Only non-cancelled documents are included
- Only active customer records are included (`is_active = 'T'` filter applied on all queries)
- All amounts use local currency (MYR) net totals (after line-item discounts)
- Dates are converted to Malaysia Time (UTC+8) before applying the date range filter

### 7.3 Cost of Sales Calculation

```
Cost of Sales = Invoice Cost + Debit Note Cost − Credit Note Cost
```

- Invoice/DN cost: Sum of item-level total cost from line details (only where cost ≥ 0)
- CN cost: Sum of (unit cost × quantity) from credit note line details
- Result is clamped to non-negative at the aggregate level

### 7.4 Gross Profit and Margin %

```
Gross Profit = Net Sales − Cost of Sales
Margin % = (Gross Profit ÷ Net Sales) × 100
```

- If Net Sales = 0, Margin % = 0 (avoids division by zero)
- Margin % is rounded to 2 decimal places in calculations, displayed to 1 decimal

### 7.5 Margin Color Thresholds

| Margin % Range | Color | Meaning |
|---------------|-------|---------|
| < 10% | Red | Problem — below acceptable profitability |
| 10% – 20% | Amber | Acceptable but room for improvement |
| ≥ 20% | Green | Healthy margin |

### 7.6 Return Rate Calculation

```
Return Rate % = (Credit Note Amt ÷ Invoice Sales) × 100
```

This measures returns as a proportion of invoiced sales only (credit notes do not reduce the denominator).

### 7.7 Credit Note Impact Formulas

```
Margin Before = (Invoice Sales − Invoice Cost) ÷ Invoice Sales × 100
Margin After  = ((Invoice Sales − Credit Note Revenue) − (Invoice Cost − Credit Note Cost)) ÷ (Invoice Sales − Credit Note Revenue) × 100
Margin Lost   = Margin Before − Margin After
```

- Margin Before: hypothetical margin if no credit notes existed
- Margin After: actual margin incorporating credit notes
- Margin Lost: positive means returns hurt margin; negative means returns of low-margin items improved overall margin

### 7.8 Distribution Chart Threshold

The Margin Distribution Chart only includes customers with **> RM 1,000 revenue**. This filters out near-zero accounts that would create misleading extreme percentages.

### 7.9 Top Customers by Margin % Threshold

When ranking customers by Margin %, only customers with **≥ RM 10,000 revenue** are included. This prevents tiny accounts with extreme margin percentages (e.g., one RM 50 sale at 90% margin) from dominating the rankings.

### 7.10 Currency and Formatting

| Element | Format |
|---------|--------|
| Currency values | "RM" prefix, thousands separators, no decimals (e.g., "RM 1,234,567") |
| Compact currency | "RM 1.2M" for large values on chart axes |
| Percentages | 1 decimal place (e.g., "18.5%") |
| Counts | Thousands separators (e.g., "1,234") |
| Negative monetary values | Standard minus sign, colored red |

---

## 8. Red Flags for Business Users

This section helps users know what to watch for:

| Signal | What It Means | Suggested Action |
|--------|--------------|-----------------|
| Growing "< 0%" bucket in distribution | More customers becoming unprofitable | Review pricing strategy for affected customers |
| High-revenue customer with < 10% margin | Big customer but barely profitable | Pricing renegotiation opportunity |
| Red sparklines on large customers (click for details) | Margin eroding over time | Investigate — are costs rising or prices being discounted? |
| Margin Lost > 5 percentage points | Returns significantly hurting profitability | Check product quality or return process for that customer |
| Many customers in 0–5% bucket | Widespread thin margins | Systemic pricing or cost issue |

---

## 9. Cross-Page Navigation

### Outbound Navigation

| Trigger | Destination | Details |
|---------|-------------|---------|
| Click customer name (blue link) in Customer Analysis table | Customer Profile Modal | Opens to "Sales" tab by default. Passes customer code, name, and current date range. |

### Contextual Relationships

| Question | This Page | Better Page |
|----------|-----------|-------------|
| "Who buys the most?" | Shows revenue column but not primary focus | Sales Report |
| "Who makes us the most money?" | **Primary page for this** | — |
| "What's our official margin?" | Item-level only (may differ from GL Cost of Sales) | Financial Statements (P&L) |
| "Which customers are unprofitable?" | **Primary page for this** | — |
| "Are returns hurting our margins?" | **Credit Note Impact tab** | — |
| "Who pays on time?" | Not covered | Payment Collection |

---

## 10. Components Built But Not Currently Displayed

The following components are fully implemented in the codebase but **not wired into the main page layout**. They are production-ready and available for future activation:

| Component | Description |
|-----------|-------------|
| Margin by Customer Type | Bar chart showing margin % grouped by customer type classification |
| Product Group Margin | Three-series bar chart: Net Sales, Cost of Sales, and Margin % by product group |
| Top by Margin % (standalone) | Dedicated horizontal bar chart for top 10 by margin % (min RM 10K revenue) |
| Top by Profit (standalone) | Dedicated horizontal bar chart for top 10 by gross profit |
| Product × Customer Matrix | Pivot table showing margin % at the intersection of customer and product group |
| Monthly Pivot Table | Margin % by month (columns) × customer (rows), with color-coded cells |
| Data Quality Panel | Collapsible panel showing: cost anomalies (cost > 5× revenue), missing item groups, missing item codes, invoices without sales agent, date coverage |

These are noted for the production team to evaluate for inclusion.

---

## 11. Screenshot References

*Screenshots to be captured in Session 12.*

---

## 12. Drift from Legacy Documentation

The following differences were discovered by reverse-engineering the live codebase (this spec reflects the **actual current implementation**):

| Area | Old Documentation | Actual Implementation |
|------|------------------|----------------------|
| Displayed components | All charts and tables shown in a single page | **7 components removed from shell** — MarginByTypeChart, ProductGroupMarginChart, TopByMarginChart, TopByProfitChart, ProductCustomerMatrix, MonthlyPivotTable, DataQualityPanel are built but not wired into the layout |
| Filter UI | Generic date filter only | Date range filter visible; **customer, customer type, sales agent, and product group filters** fully built in backend/hooks but not exposed in UI |
| Customer table filter | No in-table filtering | **Multi-select customer combobox** added in table header with search and badge count |
| Credit Note Impact default sort | "Sorted by Return Rate (highest first)" | Default sort is **Margin Lost descending** (worst margin impact first) |
| Profile modal | "Customer Profile Modal" (generic) | Uses **redesigned customer profile** with specific tab defaulting ("Sales" tab) and date range passing |
| Trend column | Not documented in old specs | **Clickable sparkline** per customer row — fetches monthly data individually, click opens popover with margin trend chart and monthly data table (Month, Revenue, Margin %) |
| Export format | CSV export | **Excel (.xlsx) export** with configured column headers |
| Table alignment | Right-aligned numbers | **Customer Analysis table:** all columns left-aligned. **Credit Note Impact table:** text columns left-aligned, numeric columns (Invoice Sales, Credit Note Amt, Return Rate, Margin Before, Margin After, Margin Lost) right-aligned. |
