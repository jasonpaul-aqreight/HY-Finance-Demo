# Financial Statements Dashboard (P&L & Balance Sheet)

**URL path:** `/pnl`

---

## 1. Purpose & User Goals

This page provides a comprehensive view of the company's financial health through two major sections: a **Profit & Loss (Income) Statement** and a **Balance Sheet** overview. Users can:

- Review YTD revenue, costs, and profitability at a glance via KPI summary cards.
- Examine monthly P&L trends within a fiscal year (net sales, COGS, OPEX, net profit).
- Drill into the full income statement with expandable account-type groups and per-month columns.
- Compare P&L performance across up to 4 fiscal years with a multi-year table and small-multiple bar charts.
- View the balance sheet position (assets, liabilities, equity) for the selected fiscal year versus the prior year.
- Track balance sheet trends (total assets, total liabilities, equity) month by month within the fiscal year.

The page banner reads: **"Financial Statements"** with the subtitle *"Profit & Loss statement, Year-over-Year comparison, and Balance Sheet overview."*

---

## 2. Page Layout

The page is divided into the following sections, rendered top to bottom:

| Order | Section | Description |
|-------|---------|-------------|
| 1 | **Filter Bar** | Fiscal year selector with centered FY label showing date range |
| 2 | **KPI Summary Cards** | Two rows of 4 cards each (8 total) |
| 3 | **Monthly P&L Trend** | Combo chart (bars + lines) |
| 4 | **P&L Statement** | Full income statement table with expandable rows (section header: "Profit & Loss Statement") |
| 5 | **Multi-Year Comparison** | Side-by-side: small-multiple charts (left) + comparison table (right) (section header: "Multi-Year Comparison") |
| 6 | **Balance Sheet** | Side-by-side: BS trend line chart (left) + BS statement table (right) (section header: "Balance Sheet") |

All content is constrained to a max width of 1600px, horizontally centered.

---

## 3. Filters

### 3.1 Fiscal Year Selector

A single dropdown control at the top of the page.

| Property | Value |
|----------|-------|
| Label | "Fiscal Year" (placeholder text) |
| Options | Loaded from the fiscal years API; displayed as `FY{year}` (e.g., `FY2025`) |
| Default | The **second most recent** fiscal year (most likely to have complete data) |
| State key | `fiscalYear` (string, e.g. `"FY2025"`) |

When a fiscal year is selected, a centered label displays:

> **Fiscal Year 2025 (Mar 2024 -- {latest month with data})**

The start month is always **March of (FY year - 1)** and the end is either the latest month that has actual data or **February of FY year** (whichever comes first).

### 3.2 Fiscal Year Convention

The fiscal year runs **March to February**:

- **FY2025** spans March 2024 through February 2025.
- Internally, each month is encoded as a **period number** = `year * 12 + month`. For example, March 2024 = `2024 * 12 + 3 = 24291`.
- `fyToPeriodRange(2025)` returns `{ from: 24291, to: 24302 }` (Mar 2024 to Feb 2025).
- Fiscal month index: Mar = 1, Apr = 2, ..., Jan = 11, Feb = 12.

### 3.3 Range Parameter

An internal `range` parameter (not currently exposed in the filter bar UI) controls the time span for trend charts. Possible values:

| Value | Meaning |
|-------|---------|
| `fy` (default) | Full fiscal year, from FY start to the latest period with data |
| `last12` | Latest 12 months ending at the most recent period with data |
| `ytd` | Same as `fy` in current implementation |

### 3.4 Fiscal Years Data Source

**Endpoint:** `GET /api/pnl/filters/fiscal-years`

Queries the `fiscal_year` table, returning only fiscal years that have at least one period with non-zero debit or credit entries in `pbalance`. Results are sorted by `fiscal_year.FromDate` descending (most recent first).

Each option has:
- `FiscalYearName` -- e.g. `"Fiscal Year 2025"`
- `FromDate`, `ToDate` -- date strings
- `IsActive` -- `"T"` or `"F"`

---

## 4. KPI Cards

Two rows of 4 cards each, totaling **8 KPI cards**. All figures are YTD totals for the selected fiscal year.

### Row 1: Revenue & Costs

| Card | Title | Value | Subtitle |
|------|-------|-------|----------|
| 1 | **Net Sales** | `RM {net_sales}` | -- |
| 2 | **COGS** | `RM {cogs}` | "Cost of Goods Sold" |
| 3 | **Gross Profit** | `RM {gross_profit}` | "Sales - COGS" |
| 4 | **OPEX** | `RM {expenses}` | "Operating Expenses" |

- **Gross Profit** is colored green if positive, red if negative.

### Row 2: Profitability & Ratios

| Card | Title | Value | Subtitle |
|------|-------|-------|----------|
| 5 | **Operating Profit (EBIT)** | `RM {operating_profit}` | "Gross Profit - OPEX" |
| 6 | **Net Profit** | `RM {net_profit}` | "EBIT + Other Income - Tax \| Margin: {net_margin_pct}%" |
| 7 | **Expense Ratio** | `{expense_ratio}%` | "OPEX / Net Sales" |
| 8 | **Current Ratio** | `{current_ratio}` (2 decimals) | "Current Assets / Current Liabilities" |

### KPI Computation

```
cogs            = net_sales - gross_profit
operating_profit = gross_profit - expenses
net_margin_pct  = (net_profit / net_sales) * 100
expense_ratio   = (expenses / net_sales) * 100
current_ratio   = current_assets / |current_liabilities|
```

### Visual Indicators

- **Operating Profit** and **Net Profit** cards have an alarm ring: green if positive, red if negative.
- **Current Ratio** card: green ring if >= 1.0, red ring if < 1.0.
- Negative monetary values are displayed in red text.

### Data Sources

- **KPI values** (net_sales, gross_profit, expenses, net_profit, etc.) come from the KPIs API.
- **Current Ratio** comes from the Balance Sheet Comparison API (current year snapshot).

---

## 5. P&L Section

### 5.1 P&L Statement Table

A horizontally scrollable table displaying the full income statement in accounting format.

#### Column Structure

| Column | Description |
|--------|-------------|
| **Account** | Account type name or individual account description (sticky left column, min 160px) |
| **{Month}** columns | One column per month in the fiscal year (header shows abbreviated month name only, e.g. "Mar", "Apr") |
| **YTD** | Year-to-date total (separated by a left border) |
| **Prior YTD** | Same-period total from the prior fiscal year |
| **YoY %** | Year-over-year percentage change between YTD and Prior YTD |

#### Row Hierarchy and Account Types

The table groups rows by **account type** (from the `acc_type` / `pl_format` tables). Each group is collapsible:

| Account Type Code | Typical Name | Role in P&L |
|-------------------|-------------|-------------|
| `SL` | Sales | Revenue |
| `SA` | Sales Adjustments | Revenue adjustments (returns, discounts) |
| `CO` | Cost of Goods Sold | Direct costs |
| `OI` | Other Income | Non-operating income |
| `EP` | Expenses | Operating expenses |
| `TX` | Taxation | Tax provision |

- **Group header rows** (subtotal style) are clickable to expand/collapse. They show a triangle indicator and the subtotal amounts across all columns.
- **Detail rows** (shown when expanded) display individual general ledger accounts indented under their group, with alternating row shading.
- Empty groups (all months zero, YTD zero, Prior YTD zero) are hidden.

#### Computed Summary Rows

Computed rows are inserted after specific account type groups:

| After Group | Computed Row | Style | Formula |
|-------------|-------------|-------|---------|
| `CO` (COGS) | **Gross Profit / (Loss)** | Bold, darker background | Net Sales - COGS |
| `CO` (COGS) | *Gross Margin %* | Italic, small text | (Gross Profit / Net Sales) * 100 |
| `EP` (Expenses) | **Net Profit / (Loss)** | Bold, darker background | Gross Profit + Other Income - Expenses |
| `EP` (Expenses) | *Net Margin %* | Italic, small text | (Net Profit / Net Sales) * 100 |
| `TX` (Taxation) | **Net Profit / (Loss) After Taxation** | Bold, darkest background (grand total) | Net Profit - Taxation |

#### YoY % Column Logic

- For monetary rows: `((YTD - Prior YTD) / |Prior YTD|) * 100` -- displayed as `+X.X%` or `-X.X%`, colored green for positive, red for negative.
- For margin rows: shows the absolute percentage-point difference, e.g. `+2.3pp` or `-1.1pp`.
- If Prior YTD is zero and YTD is non-zero: displays `"New"`.

#### Formatting

- Monetary values: whole numbers with thousands separators (locale `en-MY`). Zero values display as an en-dash (`--`).
- Negative values: displayed in red text.
- Percentages: one decimal place with `%` suffix.
- Account names: converted from uppercase to title case (e.g., "COST OF GOODS SOLD" becomes "Cost of Goods Sold"), with common small words kept lowercase ("of", "the", "and", etc.).

### 5.2 Monthly P&L Trend Chart

A combo chart (composed chart with bars and lines) showing monthly P&L metrics for the selected fiscal year.

#### Chart Type
Combined bar + line chart.

#### Series

| Series | Chart Type | Color | Notes |
|--------|-----------|-------|-------|
| **Net Profit (+)** | Bar (stacked) | Green (`#22c55e`) | Only months with net profit >= 0 |
| **Net Profit (-)** | Bar (stacked) | Red (`#ef4444`) | Only months with net profit < 0 |
| **Net Sales** | Line | Blue (`#2E5090`) | With dots (radius 3) |
| **COGS** | Line | Orange (`#ED7D31`) | With dots (radius 3) |
| **OPEX** | Line | Purple (`#8b5cf6`) | With dots (radius 3) |

- X-axis: month labels (e.g., "Mar 2024", "Apr 2024").
- Y-axis: formatted as compact RM values (e.g., "RM 500K", "RM 1.2M").
- Tooltip: shows compact RM value; for net profit bars, zero values are suppressed and the label is unified as "Net Profit" regardless of sign.
- Custom legend showing: Net Profit (split green/red swatch), Net Sales (blue line), COGS (orange line), OPEX (purple line).
- Chart height: 360px.

#### Data Points Per Month

Each month provides: `net_sales`, `cogs`, `gross_profit`, `other_income`, `expenses`, `net_profit`.

### 5.3 Year-over-Year Comparison

A two-panel layout comparing P&L across multiple fiscal years.

#### Left Panel: Small-Multiple Bar Charts

A 2-column grid of 8 mini bar charts, one per P&L line item:

| Chart | Data Key | Bar Color |
|-------|----------|-----------|
| Net Sales | `net_sales` | `#2E5090` (blue) |
| COGS | `cogs` | `#ED7D31` (orange) |
| Gross Profit | `gross_profit` | `#22c55e` (green) |
| Other Income | `other_income` | `#8b5cf6` (purple) |
| OPEX | `expenses` | `#6366f1` (indigo) |
| Net Profit | `net_profit` | `#ef4444` (red) |
| Taxation | `taxation` | `#94a3b8` (slate) |
| NPAT | `npat` | `#f97316` (orange) |

- X-axis labels: abbreviated FY names (e.g., `'2022`, `'2023`, `'2024`, `'2025`).
- Each mini chart is 80px tall.
- Below each chart: the latest FY value in compact RM format.
- A reference line at y=0 is shown if any data point is negative.

#### Data Window

The comparison shows up to **4 fiscal years**: the selected FY and the 3 preceding FYs. For example, if FY2025 is selected, the charts show FY2022 through FY2025.

#### Right Panel: Multi-Year Comparison Table

| Column | Description |
|--------|-------------|
| **Line Item** | Row label |
| **FY{year}** columns | One column per fiscal year in the window (the selected FY column is highlighted) |
| **Trend** | Arrow indicator comparing selected FY to prior FY |

Partial fiscal years (where data is not yet complete through February) are marked with an asterisk (`*`) in the header, with a footnote: *"Partial fiscal year (data not yet complete)"*.

#### Table Line Items

| Row | Key | Style |
|-----|-----|-------|
| Net Sales | `net_sales` | Normal |
| COGS | `cogs` | Normal |
| **Gross Profit** | `gross_profit` | Bold, highlighted row |
| *Gross Margin %* | `gross_margin_pct` | Italic, small, indented |
| Other Income | `other_income` | Normal |
| OPEX | `expenses` | Normal |
| **Net Profit** | `net_profit` | Bold, highlighted row |
| *Net Margin %* | `net_margin_pct` | Italic, small, indented |
| Taxation | `taxation` | Normal |
| **Net Profit After Tax** | `npat` | Bold, highlighted row |

#### Trend Arrow Logic

Compares the selected FY value to the immediately preceding FY value:

| Condition | Display |
|-----------|---------|
| Change > +2% | Green up arrow with percentage (e.g., `+5.2%`) |
| Change < -2% | Red down arrow with percentage (e.g., `-3.1%`) |
| Change between -2% and +2% | Gray right arrow with percentage |
| Prior = 0, Current != 0 | Green `New` |
| Both zero | Gray en-dash |

For margin rows (gross margin %, net margin %), the trend shows absolute **percentage-point change** (e.g., `+1.5pp`, `-0.8pp`) instead of relative percentage change.

---

## 6. Balance Sheet Section

### 6.1 Balance Sheet Statement Table

A comparison table showing the balance sheet at the end of the selected fiscal year versus the prior year.

#### Column Structure

| Column | Description |
|--------|-------------|
| **Description** | Line item label |
| **Current** | Balance at end of selected FY (or latest available period) |
| **Prior** | Balance 12 months before the current period |
| **Change** | Current - Prior (absolute difference) |
| **%** | Percentage change: `((Current - Prior) / |Prior|) * 100` |

#### Line Items

The balance sheet follows the **net assets / financed by** format:

| Line Item | Type | Source | Notes |
|-----------|------|--------|-------|
| Fixed Assets | Detail | `pbalance` where `acc_type.AccType = 'FA'` | |
| Other Assets | Detail | `acc_type.AccType = 'OA'` | |
| Current Assets | Detail | `acc_type.AccType = 'CA'` | |
| Current Liabilities | Detail | `acc_type.AccType = 'CL'` | Displayed as positive (sign flipped from raw data) |
| **Net Current Assets** | Subtotal | Computed | Current Assets - Current Liabilities |
| **Total Assets** | Total | Computed | Fixed Assets + Other Assets + Net Current Assets |
| *Financed By:* | Header | -- | Section divider (no numeric values) |
| Capital | Detail | `acc_type.AccType = 'CP'` | |
| Retained Earnings | Detail | `acc_type.AccType = 'RE'` | Includes current year P&L (`current_year_pl`) |
| Long Term Liabilities | Detail | `acc_type.AccType = 'LL'` | |
| Other Liabilities | Detail | `acc_type.AccType = 'OL'` | |
| **Total Equity & Liabilities** | Grand Total | Computed | Capital + Retained Earnings + Long Term Liabilities + Other Liabilities |

#### Account Type Codes (Balance Sheet)

| Code | Description |
|------|-------------|
| `FA` | Fixed Assets |
| `OA` | Other Assets |
| `CA` | Current Assets |
| `CL` | Current Liabilities |
| `LL` | Long Term Liabilities |
| `OL` | Other Liabilities |
| `CP` | Capital |
| `RE` | Retained Earnings |

#### Balance Sheet Computation

For each account:
1. **Opening balance** from `obalance` table: `SUM(HomeDR) - SUM(HomeCR)` per AccNo.
2. **Movements** from `pbalance` table: `SUM(HomeDR) - SUM(HomeCR)` for periods from earliest to the target period.
3. **Signed balance** = opening + movements, then flipped for credit-positive account types (`bs_format.CreditAsPositive = 'T'`).
4. **Current year P&L** is computed separately from P&L account types (`acc_type.IsBSType = 'F'`) over the same period range, and added to Retained Earnings for display.

The **prior period** snapshot is taken at exactly **12 months before** the current period.

#### Formatting

- Monetary values: whole numbers with thousands separators. Zero values display as an en-dash.
- Negative values: red text.
- Percentage change: `+X.X%` or `-X.X%`, colored green for positive change, red for negative. If prior is zero, displays an en-dash.
- Alternating row shading on detail rows.

### 6.2 Balance Sheet Trend Chart

A multi-line chart showing three balance sheet metrics month by month within the fiscal year.

#### Chart Type
Line chart with dots.

#### Series

| Series | Line Color | Dot Color |
|--------|-----------|-----------|
| **Total Assets** | `#2E75B6` (blue) | Same |
| **Total Liabilities** | `#C00000` (dark red) | Same |
| **Equity** | `#548235` (olive green) | Same |

- X-axis: abbreviated month names (e.g., "Mar", "Apr").
- Y-axis: compact format (e.g., "500K", "1M").
- Tooltip: shows compact RM values.
- Line width: 2px, dot radius: 4px.
- Chart height: 320px.

#### Data Points

Each month provides a full balance sheet snapshot (`total_assets`, `total_liabilities`, `equity`) computed by running the BS snapshot calculation for that period.

---

## 7. API Contracts

### 7.1 Filter Endpoints

#### `GET /api/pnl/filters/fiscal-years`

Returns all fiscal years that have data.

**Parameters:** None.

**Response:** Array of objects:
```
[
  {
    "FiscalYearName": "Fiscal Year 2025",
    "FromDate": "2024-03-01",
    "ToDate": "2025-02-28",
    "IsActive": "T"
  },
  ...
]
```
Sorted by `FromDate` descending.

**Data source:** `fiscal_year` table, filtered to only include FYs where `pbalance` has non-zero entries within the FY period range.

---

#### `GET /api/pnl/filters/projects`

Returns all projects/cost centers.

**Parameters:** None.

**Response:** Array of objects:
```
[
  {
    "ProjNo": "P001",
    "Description": "Main Operations",
    "IsActive": "T"
  },
  ...
]
```
Sorted by `Description`.

**Data source:** `project` table.

---

### 7.2 P&L Endpoints

#### `GET /api/pnl/v3/kpis`

Returns YTD KPI summary values for the selected fiscal year.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fy` | string | Yes | Fiscal year key, e.g. `"FY2025"` |
| `projects` | string | No | Comma-separated project codes |

**Response:**
```
{
  "net_sales": 12345678,
  "gross_profit": 2345678,
  "gross_margin_pct": 19.0,
  "other_income": 50000,
  "expenses": 1800000,
  "net_profit": 595678,
  "net_margin_pct": 4.8,
  "expense_ratio": 14.6,
  "prev_net_sales": 0,
  "prev_gross_profit": 0,
  "prev_gross_margin_pct": 0,
  "prev_net_profit": 0,
  "prev_net_margin_pct": 0,
  "prev_expense_ratio": 0,
  "sparkline": []
}
```

**Computation:** Derives YTD totals from the P&L statement data. For each account type group:
- `SL` (Sales) + `SA` (Sales Adjustments) = `net_sales`
- `CO` = `cogs`; `gross_profit` = net_sales - cogs
- `OI` = `other_income`; `EP` = `expenses`
- `net_profit` = gross_profit + other_income - expenses

**Data source:** `pbalance` joined with `gl_mast`, `acc_type`, `pl_format`. Filtered to P&L accounts (`acc_type.IsBSType = 'F'`), periods within the FY range. Sign convention determined by `pl_format.CreditAsPositive`.

---

#### `GET /api/pnl/v3/monthly`

Returns month-by-month P&L breakdown for chart rendering.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fy` | string | Yes | Fiscal year key |
| `projects` | string | No | Comma-separated project codes |
| `range` | string | No | `"fy"` (default), `"last12"`, or `"ytd"` |

**Response:**
```
{
  "data": [
    {
      "period": 24291,
      "label": "Mar 2024",
      "net_sales": 1234567,
      "cogs": 987654,
      "gross_profit": 246913,
      "other_income": 5000,
      "expenses": 150000,
      "net_profit": 101913
    },
    ...
  ],
  "avg_net_profit": 95000
}
```

**Data source:** Same P&L raw query as KPIs, but grouped by `pbalance.PeriodNo`. Each period is aggregated independently.

---

#### `GET /api/pnl/v3/statement`

Returns the full P&L income statement with expandable account type groups.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fy` | string | Yes | Fiscal year key |
| `projects` | string | No | Comma-separated project codes |

**Response:**
```
{
  "current_period_label": "Oct 2025",
  "prev_period_label": "Sep 2025",
  "months": [
    { "period": 24291, "label": "Mar 2024" },
    ...
  ],
  "groups": [
    {
      "acc_type": "SL",
      "acc_type_name": "SALES",
      "seq": 1,
      "accounts": [
        {
          "accno": "400-001",
          "description": "FRUIT SALES",
          "current_month": 500000,
          "prev_month": 480000,
          "ytd": 5500000,
          "prior_ytd": 5200000,
          "monthly": [500000, 480000, ...]
        },
        ...
      ],
      "subtotal": {
        "current_month": 1000000,
        "prev_month": 960000,
        "ytd": 11000000,
        "prior_ytd": 10400000,
        "monthly": [1000000, 960000, ...]
      }
    },
    ...
  ],
  "computed": {
    "net_sales": { "current_month": ..., "prev_month": ..., "ytd": ..., "prior_ytd": ..., "monthly": [...] },
    "gross_profit": { ... },
    "net_profit": { ... },
    "net_profit_after_tax": { ... },
    "gpm": { "monthly": [...], "ytd": 19.0, "prior_ytd": 18.5 },
    "npm": { "monthly": [...], "ytd": 4.8, "prior_ytd": 4.2 }
  }
}
```

**Account type group ordering** is determined by `pl_format.Seq`.

**Prior YTD computation:** The same query is run for the prior fiscal year (FY year - 1) over the equivalent period range, then totals are attached as `prior_ytd` on each account and group subtotal.

**Data source:** `pbalance` joined with `gl_mast` (for `AccNo` to `AccType` mapping), `acc_type` (for `IsBSType` filter and description), `pl_format` (for `CreditAsPositive` sign convention and `Seq` ordering). Grouped first by `AccType`, then by individual `AccNo`.

---

#### `GET /api/pnl/v3/yoy`

Returns year-over-year line-item comparison (current FY vs prior FY).

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fy` | string | Yes | Fiscal year key |

**Response:** Array of objects:
```
[
  {
    "line_item": "Net Sales",
    "acc_type": "SL",
    "current_fy": 12000000,
    "prior_fy": 11500000,
    "change": 500000,
    "growth_pct": 4.3
  },
  ...
]
```

---

#### `GET /api/pnl/v3/multi-year`

Returns aggregated P&L totals for **all fiscal years** with data. Used by the Multi-Year Comparison section.

**Parameters:** None.

**Response:** Array of objects, sorted ascending by fiscal year:
```
[
  {
    "fy": "FY2022",
    "fyNumber": 2022,
    "isPartial": false,
    "net_sales": 10000000,
    "cogs": 8000000,
    "gross_profit": 2000000,
    "gross_margin_pct": 20.0,
    "other_income": 50000,
    "expenses": 1500000,
    "net_profit": 550000,
    "net_margin_pct": 5.5,
    "taxation": 100000,
    "npat": 450000
  },
  ...
]
```

**`isPartial` flag:** `true` when the latest period with data is earlier than the FY end period (Feb of the FY year). This indicates the fiscal year is still in progress.

**Computation per FY:**
- Queries `pbalance` joined with `gl_mast`, `acc_type`, `pl_format` for P&L account types (`acc_type.IsBSType = 'F'`).
- Period range: FY start (Mar of year-1) to `MIN(latest period with data, FY end)`.
- Groups by `AccType`, applies sign convention via `pl_format.CreditAsPositive`.
- `net_sales` = `SL` + `SA`; `gross_profit` = net_sales - `CO`; `net_profit` = gross_profit + `OI` - `EP`; `npat` = net_profit - `TX`.

**Data source:** `pbalance`, `gl_mast`, `acc_type`, `pl_format`, `fiscal_year`.

---

### 7.3 Balance Sheet Endpoints

#### `GET /api/pnl/v3/bs-snapshot`

Returns balance sheet snapshots for the current and prior periods (12 months apart).

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fy` | string | Yes | Fiscal year key |

**Response:**
```
{
  "current": {
    "period_to": 24302,
    "period_label": "Feb 2025",
    "items": [
      { "AccType": "FA", "acc_type_name": "Fixed Assets", "balance": 500000 },
      { "AccType": "OA", "acc_type_name": "Other Assets", "balance": 50000 },
      { "AccType": "CA", "acc_type_name": "Current Assets", "balance": 3000000 },
      { "AccType": "CL", "acc_type_name": "Current Liabilities", "balance": 2000000 },
      { "AccType": "LL", "acc_type_name": "Long Term Liabilities", "balance": 200000 },
      { "AccType": "OL", "acc_type_name": "Other Liabilities", "balance": 10000 },
      { "AccType": "CP", "acc_type_name": "Capital", "balance": 100000 },
      { "AccType": "RE", "acc_type_name": "Retained Earnings", "balance": 800000 }
    ],
    "total_assets": 1550000,
    "total_liabilities": 2210000,
    "equity": 900000,
    "current_assets": 3000000,
    "current_liabilities": 2000000,
    "net_current_assets": 1000000,
    "current_year_pl": 450000
  },
  "prior": { ... }
}
```

**Period determination:**
- Current: `MIN(latest period with data in pbalance, FY end period)`.
- Prior: current period - 12 (i.e., same month one year earlier).

**Balance computation per account:**
1. Opening balance: `obalance` table -- `SUM(HomeDR) - SUM(HomeCR)` per `AccNo`.
2. Period movements: `pbalance` table -- `SUM(HomeDR) - SUM(HomeCR)` for all periods from earliest to target.
3. Sign adjustment: if `bs_format.CreditAsPositive = 'T'`, the balance is negated.
4. Aggregated by `AccType` code.

**Derived totals:**
- `net_current_assets` = CA - CL
- `total_assets` = FA + OA + net_current_assets
- `total_liabilities` = CL + LL + OL
- `equity` = CP + RE
- `current_year_pl` = net profit after tax from P&L accounts over the same period range (added to Retained Earnings in the display layer)

**Data source:** `obalance`, `pbalance`, `gl_mast`, `acc_type`, `bs_format`.

---

#### `GET /api/pnl/v3/bs-trend`

Returns monthly balance sheet snapshots for the selected fiscal year.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fy` | string | Yes | Fiscal year key |
| `range` | string | No | `"fy"` (default), `"last12"`, or `"ytd"` |

**Response:** Array of objects:
```
[
  {
    "period": 24291,
    "label": "Mar 2024",
    "total_assets": 1500000,
    "total_liabilities": 2100000,
    "equity": 850000
  },
  ...
]
```

Each entry is a full BS snapshot computed for that period. The range of periods depends on the `range` parameter:
- `fy` / `ytd`: FY start to latest period with data (capped at FY end).
- `last12`: latest period minus 11 to latest period.

**Data source:** Same as BS snapshot, computed iteratively for each period in the range.

---

### 7.4 Legacy Balance Sheet Endpoints

These endpoints exist but are not used by the current V3 dashboard. They accept raw period numbers instead of fiscal year keys.

#### `GET /api/pnl/bs/snapshot`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period_to` | integer | `24302` | Period number |
| `project` | string | -- | Optional project filter |

#### `GET /api/pnl/bs/kpis`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period_to` | integer | `24302` | Period number |

Returns: `total_assets`, `total_liabilities`, `current_ratio`, `working_capital`, `debt_to_equity`, `equity_ratio`.

#### `GET /api/pnl/bs/trend`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `periods` | integer | `12` | Number of months to look back |

---

## 8. Database Tables Referenced

| Table | Role |
|-------|------|
| `pbalance` | Period balances (monthly DR/CR by account and period). Core data source for both P&L and BS. |
| `obalance` | Opening balances (DR/CR by account). Used for BS snapshot computation. |
| `gl_mast` | General ledger master -- maps `AccNo` to `AccType`. |
| `acc_type` | Account type definitions. `IsBSType = 'T'` for balance sheet, `'F'` for P&L. |
| `pl_format` | P&L formatting rules: `CreditAsPositive` flag, display `Seq` ordering. |
| `bs_format` | Balance sheet formatting rules: `CreditAsPositive` flag. |
| `fiscal_year` | Fiscal year definitions: `FiscalYearName`, `FromDate`, `ToDate`, `IsActive`. |
| `project` | Project/cost center list: `ProjNo`, `Description`, `IsActive`. |

### Key Column References

- `pbalance.PeriodNo` -- encoded as `year * 12 + month`
- `pbalance.HomeDR`, `pbalance.HomeCR` -- home currency debit and credit amounts
- `pbalance.AccNo` -- links to `gl_mast.AccNo`
- `pbalance.ProjNo` -- links to `project.ProjNo`
- `gl_mast.AccType` -- links to `acc_type.AccType`, `pl_format.AccType`, `bs_format.AccType`
- `acc_type.IsBSType` -- `'T'` for balance sheet accounts, `'F'` for profit & loss accounts
- `pl_format.CreditAsPositive` / `bs_format.CreditAsPositive` -- `'T'` means balance = CR - DR; `'F'` means balance = DR - CR
- `pl_format.Seq` -- display ordering for P&L account type groups
