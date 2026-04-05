# Financial Statements

> **Page:** Financial Statements
> **Route:** `/financial`
> **Last Updated:** 2026-04-03 (Session 6 — reverse-engineered from live codebase)

---

## 1. Purpose & User Goals

The Financial Statements page provides a comprehensive view of the company's financial health through two core accounting reports:

- **Profit & Loss (P&L) Statement** — Shows revenue, costs, and profitability over a financial year, answering: *"Are we making or losing money, and where?"*
- **Balance Sheet** — Shows what the company owns, owes, and is worth at a point in time, answering: *"What is our financial position right now?"*

**Key questions this page answers for executives:**

| Question | Answered By |
|----------|-------------|
| What are our total sales and profit this year? | KPI cards (Row 1 & 2) |
| Are we profitable after all costs? | Net Profit KPI + P&L Statement |
| How do costs compare to revenue? | Expense Ratio KPI + Monthly Trend |
| Can we pay our short-term bills? | Current Ratio KPI (from Balance Sheet) |
| Which months were best/worst? | Monthly P&L Trend chart |
| How does this year compare to prior years? | Multi-Year Comparison section |
| What do we own vs. owe? | Balance Sheet section |
| Is our financial position improving or declining? | Balance Sheet Trend chart |

---

## 2. Page Layout

The page follows the standard dashboard layout (fixed sidebar, max-width 1600px centered content area).

### Top-to-Bottom Section Order

```
┌─────────────────────────────────────────────────┐
│  Filter Bar (financial year selector)              │
├─────────────────────────────────────────────────┤
│  KPI Cards — Row 1 (4 cards)                     │
│  [Net Sales] [Cost of Sales (COGS)] [Gross Profit]│
│  [Operating Costs (OPEX)]                         │
├─────────────────────────────────────────────────┤
│  KPI Cards — Row 2 (4 cards)                     │
│  [Operating Profit] [Profit/Loss] [Expense Ratio] │
│  [Current Ratio]                                 │
├─────────────────────────────────────────────────┤
│  Monthly P&L Trend (combo chart)                 │
├─────────────────────────────────────────────────┤
│  ── Section Header: "Profit & Loss Statement" ── │
│  P&L Statement Table (hierarchical, exportable)  │
├─────────────────────────────────────────────────┤
│  ── Section Header: "Multi-Year Comparison" ──   │
│  ┌──────────────────┬──────────────────────┐     │
│  │ Small Multiples  │ Comparison Table     │     │
│  │ (8 mini charts)  │ (multi-year + trend) │     │
│  └──────────────────┴──────────────────────┘     │
├─────────────────────────────────────────────────┤
│  ── Section Header: "Balance Sheet" ──           │
│  ┌──────────────────┬──────────────────────┐     │
│  │ BS Trend Chart   │ BS Statement Table   │     │
│  │ (3-line chart)   │ (current vs prior)   │     │
│  └──────────────────┴──────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### Responsive Behavior

- **Desktop (XL+):** Multi-Year Comparison and Balance Sheet sections use a 2-column grid (side by side)
- **Tablet/Mobile:** All sections stack to single column
- Section headers use a subtle highlighted background to visually separate major sections

---

## 3. KPI Cards

Eight KPI cards arranged in two rows of four. Each card is a rounded container with a subtle border.

### Row 1: Revenue & Costs

| # | Label | Value | Formula | Format |
|---|-------|-------|---------|--------|
| 1 | **Net Sales** | YTD total | Sales + Sales Adjustments | RM currency |
| 2 | **Cost of Sales (COGS)** | YTD total | Net Sales − Gross Profit | RM currency |
| 3 | **Gross Profit** | YTD total | Net Sales − Cost of Sales | RM currency, color-coded |
| 4 | **Operating Costs (OPEX)** | YTD total | Sum of all operating expenses | RM currency |

### Row 2: Profitability & Ratios

| # | Label | Value | Formula | Format |
|---|-------|-------|---------|--------|
| 5 | **Operating Profit** | YTD total | Gross Profit − Operating Costs | RM currency, color-coded |
| 6 | **Profit/Loss** | Amount + margin | Net Profit and Net Margin % | RM currency + percentage, color-coded |
| 7 | **Expense Ratio** | Percentage | Operating Costs ÷ Net Sales × 100 | Percentage |
| 8 | **Current Ratio** | Ratio | Current Assets ÷ Current Liabilities (from Balance Sheet) | Decimal (e.g., 2.50) |

### Color Rules (Alarm States)

Cards 5, 6, and 8 use full alarm states (ring border + background tint + text color):

- **Positive value** → green highlight border + green background tint + green text
- **Negative value** → red highlight border + red background tint + red text
- **Current Ratio** specifically: green if ≥ 1.0, red if < 1.0

Card 3 (Gross Profit) uses **color-coded text only** (green if ≥ 0, red if negative) — no alarm ring or background tint.

All other cards (1, 2, 4, 7) use neutral styling.

### Loading State

While data loads, both rows show skeleton placeholders matching the 4-column card grid.

---

## 4. Charts

### 4.1 Monthly P&L Trend

A combination chart showing monthly financial performance across the selected financial year.

**Chart Type:** Mixed bar + line chart

**Data Series:**

| Series | Visual | Color | Description |
|--------|--------|-------|-------------|
| Profit (positive months) | Bar | Green | Net profit when positive; bars extend upward |
| Loss (negative months) | Bar | Red | Net profit when negative; bars extend downward |
| Net Sales | Line | Blue | Monthly sales revenue |
| Cost of Sales | Line | Orange | Monthly cost of goods sold |
| Operating Costs | Line | Purple | Monthly operating expenses |

**Axes:**
- **X-axis:** Month labels (Mar, Apr, May, ... Feb)
- **Y-axis:** Compact RM format (e.g., RM 500K, RM 10.5M)

**Interactions:**
- **Hover:** Tooltip showing all series values for that month in compact RM format
- Zero values are excluded from tooltip

**Legend:** Grid layout below chart showing all 4 series with color indicators

---

### 4.2 Multi-Year Small Multiples

Eight mini bar charts displayed in a 2×4 grid, each showing one P&L line item across financial years.

**Categories (in order):**

| # | Category | Bar Color |
|---|----------|-----------|
| 1 | Net Sales | Blue |
| 2 | Cost of Sales | Orange |
| 3 | Gross Profit | Green |
| 4 | Other Income | Purple |
| 5 | Operating Costs | Indigo |
| 6 | Net Profit | Red |
| 7 | Taxation | Gray |
| 8 | Net Profit After Tax | Orange |

**Per Mini Chart:**
- **Height:** ~80px (compact)
- **X-axis:** Financial year labels abbreviated (e.g., '25, '24, '23)
- **Y-axis:** Hidden (auto-scaled per chart)
- **Reference line:** Y=0 baseline shown for categories that can go negative
- **Hover tooltip:** Full category name + compact RM value

**Data Scope:** Shows the selected financial year plus the 3 prior financial years (up to 4 years total).

---

### 4.3 Balance Sheet Trend

A line chart showing the trajectory of the company's financial position over time.

**Data Series (3 lines):**

| Series | Color | Description |
|--------|-------|-------------|
| Total Assets | Blue | Everything the company owns |
| Total Liabilities | Red | Everything the company owes |
| Equity | Green | Net worth (Assets − Liabilities) |

**Visual Details:**
- Line stroke width: 2px
- Data point dots at each period
- Y-axis: Compact RM format (K/M abbreviations)
- Chart height: ~320px
- Matches the height of the Balance Sheet table beside it

---

## 5. Tables

### 5.1 P&L Statement Table

A hierarchical, collapsible accounting statement showing detailed income and expense accounts by month.

**Table Structure:**

| Column | Description | Sticky | Alignment |
|--------|-------------|--------|-----------|
| Account | Account name (min 160px) | Yes (left) | Left |
| Month columns | One per month in financial year (Mar–Feb) | No | Right |
| Year to Date | Year-to-date total | No | Right |
| Prior Year | Same period in prior financial year | No | Right |
| vs Last Year | Year-over-year change percentage | No | Right |

**Account Type Groups (display order):**

| Code | Group Name | Description |
|------|-----------|-------------|
| SL | Sales | Revenue accounts |
| SA | Sales Adjustments | Returns, discounts, rebates |
| CO | Cost of Goods Sold | Direct product costs |
| OI | Other Income | Non-operating income |
| EP | Expenses | Operating expenses (categorized) |
| TX | Taxation | Tax accounts |

**Collapsible Rows:**
- Each group header is clickable — click to expand/collapse detail accounts
- Disclosure indicator: ▶ (collapsed) / ▼ (expanded)
- Empty groups (all zeros across all columns) are hidden entirely

**Account Rollup:** Child accounts roll up to their parent account. The table displays parent-level accounts by default; expanding shows the individual child accounts.

**Computed Rows (auto-inserted between groups):**

| After Group | Computed Row | Style | Formula |
|-------------|-------------|-------|---------|
| CO | **Gross Profit / (Loss)** | Bold, shaded background | Net Sales − Cost of Sales |
| CO | *Gross Margin %* | Italic, small text | (Gross Profit ÷ Net Sales) × 100 |
| EP | **Net Profit / (Loss)** | Bold, shaded background | Gross Profit + Other Income − Expenses |
| EP | *Net Margin %* | Italic, small text | (Net Profit ÷ Net Sales) × 100 |
| TX | **Net Profit After Tax** | Bold, darkest shading | Net Profit − Taxation |

**Row Styling:**

| Type | Background | Font |
|------|-----------|------|
| Detail (account) | None | Normal |
| Subtotal (group total) | Light shading | Semi-bold |
| Total (computed) | Medium shading | Bold |
| Grand total (Net Profit After Tax) | Dark shading | Bold |
| Margin % | None | Italic, small, muted |

**Number Formatting:**
- All amounts use standard number format (no RM prefix in table cells)
- Zero values display as en-dash (–)
- Negative values display in red text
- vs Last Year column: green for positive change, red for negative change

**Horizontal Scrolling:** The table scrolls horizontally to accommodate all month columns. The Account column remains sticky on the left.

**Export:** "Export Excel" button in the table header. Exports all rows (expanded) with columns: Account, all month columns, Year to Date, Prior Year. File format: .xlsx

**No pagination** — this is a hierarchical accounting table, not a data listing.

---

### 5.2 Multi-Year Comparison Table

A summary table comparing key P&L line items across multiple financial years.

**Columns:**

| Column | Description | Alignment |
|--------|-------------|-----------|
| Line Item | P&L category name (min 140px, sticky left) | Left |
| FY columns | One per financial year in range | Right |
| Trend | Change indicator (current vs prior year) | Center |

**Line Items (in order):**

| Line Item | Style | Description |
|-----------|-------|-------------|
| Net Sales | Normal | Total revenue |
| Cost of Sales | Normal | Cost of goods |
| **Gross Profit** | Bold | Revenue less Cost of Sales |
| *Gross Margin %* | Italic, small, muted | Profitability ratio |
| Other Income | Normal | Non-operating income |
| Operating Costs | Normal | Operating expenses |
| **Net Profit** | Bold | Bottom-line profit |
| *Net Margin %* | Italic, small, muted | Net profitability ratio |
| Taxation | Normal | Tax amounts |
| **Net Profit After Tax** | Bold | Net Profit After Tax |

**Visual Highlights:**
- The currently selected financial year column is highlighted with a shaded background and bold text
- Partial financial years (incomplete data) are marked with an asterisk (*) and a footer note: *"* Partial financial year (data not yet complete)"*

**Trend Arrows (comparing current FY vs. prior FY):**

| Arrow | Color | Condition |
|-------|-------|-----------|
| ↑ {value} | Green | Increase > 2% (or > 2 percentage points for margin rows) |
| ↓ {value} | Red | Decrease < −2% (or < −2pp for margin rows) |
| → {value} | Muted | Change within ±2% (flat) |

- Amount rows show percentage change (e.g., ↑ 15.2%)
- Margin rows show percentage point change (e.g., ↑ 2.5pp)

---

### 5.3 Balance Sheet Statement Table

A snapshot comparison table showing the company's assets, liabilities, and equity at two points in time.

**Columns:**

| Column | Description | Alignment |
|--------|-------------|-----------|
| Description | Line item name | Left |
| Current | Latest period balance | Right |
| Prior | Balance from 12 months earlier | Right |
| Change | Current − Prior | Right |
| % | Percentage change | Right |

**Line Items (in order):**

| Section | Line Item | Style |
|---------|-----------|-------|
| **Assets** | Fixed Assets | Detail |
| | Other Assets | Detail |
| | Current Assets | Detail |
| | Current Liabilities | Detail (shown as negative) |
| | — | Divider |
| | **Net Current Assets** | Subtotal (shaded) |
| | **Total Assets** | Total (darker shading) |
| | | |
| **Financed By** | *(section header with top border)* | |
| | Capital | Detail |
| | Retained Earnings | Detail (includes current year P&L) |
| | Long Term Liabilities | Detail |
| | Other Liabilities | Detail |
| | — | Divider |
| | **Total Equity & Liabilities** | Grand total (darkest shading) |

**Visual Details:**
- Detail rows use alternating row shading for readability
- Negative values displayed in red
- Change % column uses color: green for positive changes, red for negative
- Zero values display as en-dash (–)

**Balance Sheet Identity:** Total Assets must always equal Total Equity & Liabilities (Assets = Liabilities + Equity).

**Export:** "Export Excel" button. Exports columns: Description, Current, Prior, Change. File format: .xlsx

**No pagination** — this is a fixed-structure financial statement.

---

## 6. Filters & Controls

### Financial Year Selector

| Control | Type | Default | Options |
|---------|------|---------|---------|
| Financial Year | Dropdown | 2nd most recent FY (most complete data) | All financial years with data (e.g., FY2023, FY2024, FY2025) |

**Center Display:** The filter bar shows a centered label indicating the full date range of the selected financial year:
> **Financial Year 2025 (Mar 2024 – Feb 2025)**

If data for the current financial year is incomplete, the end month shows the actual latest month with data (e.g., "Mar 2024 – Oct 2024") rather than the theoretical end (Feb 2025).

### Financial Year Convention

- Financial year runs **March to February**
- The named year is the **end** year: FY2025 = March 2024 through February 2025
- This aligns with Malaysian financial year conventions used by the source accounting system

### Expand/Collapse Controls

- P&L Statement group headers are clickable to expand/collapse account details
- Default state: all groups collapsed (showing subtotals only)

### Export Controls

- "Export Excel" button on P&L Statement table header
- "Export Excel" button on Balance Sheet table header
- Both generate downloadable .xlsx files

---

## 7. Cross-Page Navigation

This page is primarily a **consumption page** — users view financial data but do not navigate to other pages from here.

| Element | Interaction | Destination |
|---------|-------------|-------------|
| Sidebar navigation | Click menu item | Other dashboard pages |

**No clickable entities** within tables or charts — financial statements display account names and amounts without drill-down links. This is consistent with standard accounting report presentation where the data is the destination.

---

## 8. Business Rules

### P&L Calculation Waterfall

```
Sales (SL)
+ Sales Adjustments (SA)
= NET SALES

− Cost of Goods Sold (CO)
= GROSS PROFIT
  → Gross Margin % = (Gross Profit ÷ Net Sales) × 100

+ Other Income (OI)
− Operating Expenses (EP)
= NET PROFIT (a.k.a. Operating Profit)
  → Net Margin % = (Net Profit ÷ Net Sales) × 100

− Taxation (TX)
= NET PROFIT AFTER TAX
```

### Account Type System

The chart of accounts uses a type classification system:

**P&L Account Types (revenue & expense):**
- **SL** — Sales/Revenue
- **SA** — Sales Adjustments
- **CO** — Cost of Goods Sold
- **OI** — Other Income
- **EP** — Expenses/Operating Expenses
- **TX** — Taxation

**Balance Sheet Account Types (assets, liabilities, equity):**
- **FA** — Fixed Assets
- **OA** — Other Assets
- **CA** — Current Assets
- **CL** — Current Liabilities
- **LL** — Long-term Liabilities
- **OL** — Other Liabilities
- **CP** — Capital (Share Capital)
- **RE** — Retained Earnings

### Sign Convention

Accounting systems store debits and credits separately. The display sign depends on account type:

- **Credit-as-positive accounts** (liabilities, equity, revenue): the displayed balance is the negation of the raw debit-minus-credit difference
- **Debit-as-positive accounts** (assets, expenses): the displayed balance equals the raw debit-minus-credit difference
- This ensures that revenue, liabilities, and equity show as positive numbers in their respective reports

### Account Hierarchy & Rollup

- Accounts may have a parent account relationship
- Child accounts roll up to their parent for display purposes
- The P&L statement displays parent-level rows by default; expanding shows children
- Example: individual salary accounts (Salary–Manager, Salary–Driver) roll up to a parent "Salary" account

### Balance Sheet Calculations

```
Net Current Assets = Current Assets − Current Liabilities
Total Assets = Fixed Assets + Other Assets + Net Current Assets

Equity = Capital + Retained Earnings (including current year P&L)
Total Equity & Liabilities = Equity + Long-term Liabilities + Other Liabilities

CHECK: Total Assets = Total Equity & Liabilities (must balance)
```

**Current Ratio** = Current Assets ÷ Current Liabilities
- Measures short-term liquidity (ability to pay bills coming due)
- Value ≥ 1.0 is healthy (green); < 1.0 indicates potential cash flow issues (red)

### Retained Earnings

Retained Earnings on the Balance Sheet includes the accumulated current-year P&L. This is a running total from inception, not just the current financial year.

### Multi-Year Comparison Rules

- Shows the selected financial year plus 3 prior years (up to 4 years total)
- Partial financial years are detected automatically (latest data period < FY end period)
- Trend arrows use a ±2% dead zone — changes within ±2% are shown as flat (→)
- Amount rows show percentage change; margin rows show percentage point (pp) change

### Period Encoding

The system uses a numeric period encoding: `year × 12 + month`. For example:
- March 2024 = 24,291
- February 2025 = 24,302
- Financial Year 2025 spans period 24,291 to 24,302

This encoding is an internal convention — the UI always displays human-readable month/year labels.

### Data Currency

- All amounts are in MYR (Malaysian Ringgit)
- Display format: "RM" prefix for KPI cards and chart tooltips; no prefix in table cells
- Compact format used where space is limited: K for thousands, M for millions (e.g., RM 10.5M)

---

## 9. Screenshot References

*Screenshots to be captured in Session 12.*

Planned captures:

| # | Description | State |
|---|-------------|-------|
| 1 | Full page — default view with KPI cards and trend chart | Default FY selected |
| 2 | Monthly P&L Trend — hover tooltip | Hovering over a month |
| 3 | P&L Statement — collapsed (default) | All groups collapsed |
| 4 | P&L Statement — one group expanded | Showing detail accounts |
| 5 | Multi-Year Comparison — small multiples + table | With trend arrows visible |
| 6 | Balance Sheet section — trend chart + statement table | Side by side on desktop |
| 7 | Filter bar — financial year dropdown open | Showing available FY options |

---

## Appendix: Differences Found During Reverse-Engineering

The following discrepancies were discovered between the previous technical documentation (`docs/pages/pnl.md`) and the live codebase:

| Area | Previous Doc | Actual (Live Codebase) |
|------|-------------|----------------------|
| Route | `/pnl` | `/financial` |
| Project filter | Documented as dropdown in filter bar | Not rendered in UI (exists in API but unused) |
| Range control | Documented as user-selectable (fy/last12/ytd) | Internal state only — no UI control exposed |
| KPI data scope | Latest month values | YTD totals extracted from full P&L statement |
| Multi-year scope | All available years | ±3 years around selected financial year (up to 7 years) |
| BS table rows | Basic listing | Alternating row shading for readability |
| Filter default | Latest FY | 2nd most recent FY (most complete data) |
