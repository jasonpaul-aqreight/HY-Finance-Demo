# Cost Tracking Dashboard

> **URL path:** `/expenses`

---

## 1. Purpose & User Goals

The Cost Tracking dashboard monitors Hoi-Yong Finance's major cost categories. It answers:

- **How much are we spending overall?** Total costs split into COGS and OPEX.
- **What is the cost trend over time?** Monthly, weekly, or daily stacked bar chart showing cost categories.
- **What is the cost composition?** Donut chart breaking down spending by category.
- **Which GL accounts cost the most (or least)?** Top/Bottom 10 expenses ranked by net cost.
- **What are the individual COGS and OPEX line items?** Detailed breakdown tables by GL account.

The page banner reads: *"Monitors major cost categories such as Cost of Goods Sold (COGS), operating expenses (OPEX), payroll costs, electricity, packing materials, and identifies the top 10 expenses."*

---

## 2. Page Layout

The page is divided into two sections separated by visual dividers:

### Section 1 -- Cost Analysis

| Row | Content | Width |
|-----|---------|-------|
| 1 | **Filter Bar** -- date range picker with presets | Full width |
| 2 | **KPI Cards** -- 4 cards in a row | Full width (2 cols on mobile, 4 on desktop) |
| 3 | **Cost Type Toggle** -- segmented button: All / COGS / OPEX | Left-aligned |
| 4 | **Cost Trend Chart** (left, 70%) + **Cost Composition Chart** (right, 30%) | Side-by-side on large screens; stacked on small |
| 5 | **Top 10 Expenses Chart** | Full width |

### Section 2 -- Expenses Breakdown

| Row | Content | Width |
|-----|---------|-------|
| 6 | **COGS Breakdown Table** | Full width |
| 7 | **OPEX Breakdown Table** | Full width |

---

## 3. Filters

### 3.1 Date Range

Two month-year pickers (start and end) constrained by the data bounds retrieved from the `date-bounds` endpoint. The selected range is displayed as a summary string, e.g. "Mar 2025 -- Feb 2026 (12 months)".

**Quick presets:** 3M, 6M, 12M, YTD. Each preset anchors the end date to the last month with available data and counts backwards.

**Default range:** 12 months ending at the latest month in the dataset (inclusive).

### 3.2 URL Parameters

All filter state is persisted in the URL query string:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start` | `YYYY-MM-DD` | 12 months before max date | Period start (first of month) |
| `end` | `YYYY-MM-DD` | Last day of max-date month | Period end (last of month) |
| `type` | `all` / `cogs` / `opex` | `all` | Cost type toggle |
| `g` | `daily` / `weekly` / `monthly` | `monthly` | Granularity for trend chart |
| `cat` | string (multi-value) | *(none)* | Category filter (reserved) |

### 3.3 Cost Type Toggle

A segmented button group with three options that affects the trend chart and composition chart (but not KPI cards or breakdown tables):

| Option | Trend Chart Grouping | Composition Chart Grouping |
|--------|---------------------|---------------------------|
| **All** | Two stacked series: "COGS" and "OPEX" | Two slices: COGS vs OPEX |
| **COGS** | One series per COGS GL account name (e.g. "Purchases", "Freight Charges") | One slice per COGS GL account name |
| **OPEX** | One series per OPEX sub-category (Payroll, Fuel, etc.) | One slice per OPEX sub-category |

### 3.4 Granularity Toggle

Located inside the Cost Trend Chart header. Options: **Daily**, **Weekly**, **Monthly** (default).

- Daily: groups by `DATE` (formatted "Aug 1")
- Weekly: groups by ISO week (formatted "W01", "W02", ...)
- Monthly: groups by `YYYY-MM` (formatted "Jan 25", "Feb 25", ...)

---

## 4. KPI Cards

Four cards displayed in a single row. KPI cards always show the full date range and are **not** affected by the cost type toggle.

### 4.1 Total Costs

- **Label:** "TOTAL COSTS"
- **Value:** `RM {total_costs}` -- formatted in MYR with no decimals
- **Subtext:** "COGS {cogs_pct_of_total}% . OPEX {opex_pct_of_total}%"
- **Computation:** SUM of (gldtl.HomeDR - gldtl.HomeCR) for all rows joined to glmast where glmast.AccType IN ('CO', 'EP'), filtered by date range
- **Percentage:** cogs_pct_of_total = (cogs / total_costs) * 100; opex_pct_of_total = (opex / total_costs) * 100

### 4.2 COGS

- **Label:** "COGS"
- **Value:** `RM {cogs}` -- formatted in MYR with no decimals
- **Subtext:** "Cost of Goods Sold"
- **Computation:** SUM of (gldtl.HomeDR - gldtl.HomeCR) WHERE glmast.AccType = 'CO'

### 4.3 OPEX

- **Label:** "OPEX"
- **Value:** `RM {opex}` -- formatted in MYR with no decimals
- **Subtext:** "Operating Expenses"
- **Computation:** SUM of (gldtl.HomeDR - gldtl.HomeCR) WHERE glmast.AccType = 'EP'

### 4.4 YoY Change

- **Label:** "YOY CHANGE"
- **Value:** `{sign}{yoy_pct}%` (e.g. "+12.3%" or "-5.1%")
- **Subtext:** "vs same period last year"
- **Color logic:** Positive (cost increase) = red; negative (cost decrease) = green. This is inverted from revenue because rising costs are unfavorable.
- **Computation:** ((current.total_costs - previous.total_costs) / |previous.total_costs|) * 100. The previous period is the same date range shifted back by exactly one calendar year. If previous total is zero, displays "--".

---

## 5. Charts

### 5.1 Cost Trend Chart

- **Title:** "Cost Trend"
- **Subtitle:** "Stacked by cost category"
- **Chart type:** Stacked bar chart
- **X-axis:** Time period (daily, weekly, or monthly depending on granularity toggle)
- **Y-axis:** Net cost in MYR, abbreviated (e.g. "500K", "1.2M")
- **Series:** Determined dynamically by the cost type toggle (see Section 3.3 above). Categories are ordered by total value descending.
- **Colors:**
  - All mode: COGS = blue (#3B82F6), OPEX = orange (#F97316)
  - OPEX mode: Payroll = #F97316, Electricity & Water = #EAB308, Packaging Materials = #22C55E, Fuel = #EF4444, Rental = #A855F7, Repair & Maintenance = #06B6D4, Vehicle & Equipment Upkeep = #EC4899, Depreciation = #78716C, Insurance = #0EA5E9, Finance Costs = #F43F5E, Other OPEX = #6B7280
  - COGS mode: cycles through a 17-color high-contrast palette
- **Tooltip:** Shows the period label, each category with its formatted MYR value (only categories with value > 0), and a "Total" row summing all categories.
- **Data source:** gldtl JOIN glmast; net_cost = SUM(gldtl.HomeDR) - SUM(gldtl.HomeCR), grouped by period and category, where DATE(gldtl.TransDate, '+8 hours') is within the selected range.

### 5.2 Cost Composition Chart (Donut)

- **Title:** "Cost Composition"
- **Subtitle:** "Total: RM {total}" (sum of all positive slices)
- **Chart type:** Donut (pie with inner radius)
- **Slices:** One per category (filtered to net_cost > 0 only). Category grouping matches the cost type toggle.
- **Labels:** Percentage on each slice (e.g. "72.3%")
- **Colors:** Same color mapping as the trend chart.
- **Tooltip:** Category name and formatted MYR value.
- **Data source:** Same as trend chart but without time grouping -- aggregated across the full date range.

### 5.3 Top 10 Expenses Chart

- **Title:** "Top 10 Expenses" or "Bottom 10 Expenses" (changes with direction toggle)
- **Subtitle:** "{Highest|Lowest} GL accounts by net cost" with a color legend (blue = COGS, orange = OPEX)
- **Chart type:** Horizontal bar chart
- **Y-axis:** Numbered account names (e.g. "1. Purchases", "2. Staff Salary")
- **X-axis:** Net cost in MYR, abbreviated
- **Bar height:** Dynamic, minimum 400px, scales at 45px per entry
- **Bar colors:** Each bar is colored by its cost type -- blue (#3B82F6) for COGS accounts, orange (#F97316) for OPEX accounts. When filtered to a single cost type, all bars use that type's color.
- **Tooltip:** Account name, account number, cost type label, formatted MYR value, and percentage of displayed total.

**Local toggles** (independent of the global cost type toggle):

| Toggle | Options | Default |
|--------|---------|---------|
| Cost type | All / COGS / OPEX | All |
| Direction | Top / Bottom | Top |

- Top = ORDER BY net_cost DESC LIMIT 10
- Bottom = ORDER BY net_cost ASC LIMIT 10
- Only accounts with positive net cost (HAVING net_cost > 0) are included.

**Data source:** gldtl JOIN glmast; grouped by glmast.AccNo, glmast.Description, glmast.AccType. Returns glmast.AccNo as acc_no, glmast.Description as account_name, glmast.AccType as acc_type, derived cost_type ('COGS' when AccType='CO', else 'OPEX'), and net_cost.

---

## 6. Tables

### 6.1 COGS Breakdown Table

- **Title:** "COGS Breakdown"
- **Export:** "Export CSV" button generating `cogs-breakdown.csv`
- **Not affected by** the cost type toggle -- always shows COGS accounts only.
- **Sortable columns:** Click any sortable header to toggle ascending/descending. Default sort: net_cost descending.

| Column | Description | Sort | Alignment |
|--------|-------------|------|-----------|
| Account No | glmast.AccNo (monospace) | Yes | Left |
| Account Name | glmast.Description | Yes | Left |
| Net Cost (RM) | SUM(gldtl.HomeDR) - SUM(gldtl.HomeCR), formatted to 2 decimal places. Negative values shown in red with a minus sign. | Yes | Right |
| % of COGS | (row net_cost / total COGS) * 100, to 1 decimal place | No | Right |

- **Footer row:** "TOTAL COGS" with the sum of all rows and "100.0%".
- **Empty state:** "No COGS data for selected period"
- **Filter:** Only rows WHERE glmast.AccType = 'CO' AND net_cost <> 0 (zero-value accounts excluded).
- **Zebra striping:** Alternating row backgrounds.

**CSV export columns:** Account No, Account Name, Net Cost (RM) (2 decimals), % of COGS (2 decimals).

### 6.2 OPEX Breakdown Table

- **Title:** "OPEX Breakdown"
- **Export:** "Export CSV" button generating `opex-breakdown.csv`
- **Not affected by** the cost type toggle -- always shows OPEX accounts only.
- **Grouped by OPEX sub-category** with collapsible sections (all collapsed by default).

**Category header row** (clickable to expand/collapse):

| Column | Description | Alignment |
|--------|-------------|-----------|
| Category name | e.g. "Payroll", with expand/collapse arrow | Left (spans 2 cols) |
| Subtotal (RM) | Sum of all accounts in this category, formatted to 2 decimals | Right |
| % of OPEX | (category subtotal / total OPEX) * 100, to 1 decimal | Right |

**Account detail rows** (visible when category is expanded):

| Column | Description | Alignment |
|--------|-------------|-----------|
| Account No | glmast.AccNo (monospace, indented) | Left |
| Account Name | glmast.Description | Left |
| Net Cost (RM) | Formatted to 2 decimal places | Right |
| % of OPEX | (row net_cost / total OPEX) * 100, to 1 decimal | Right |

- **Footer row:** "TOTAL OPEX" with sum and "100.0%".
- **Empty state:** "No OPEX data for selected period"
- **Filter:** Only rows WHERE glmast.AccType = 'EP' AND net_cost <> 0.

**Category ordering** (fixed display order):

1. Payroll
2. Electricity & Water
3. Packaging Materials
4. Fuel
5. Rental
6. Repair & Maintenance
7. Vehicle & Equipment Upkeep
8. Depreciation
9. Insurance
10. Finance Costs
11. Other OPEX

**OPEX category mapping** (by glmast.AccNo pattern):

| Category | GL Account Patterns |
|----------|-------------------|
| Payroll | 900-S001, 900-S101 to 900-S113, 900-W001/W101/W102, 900-D102 to 900-D121, 900-S801 to 900-S803 |
| Electricity & Water | 900-E001 |
| Packaging Materials | 900-P005 |
| Fuel | 900-D001, 900-P002, 900-P1xx (prefix match) |
| Rental | 900-R200 to 900-R243 |
| Repair & Maintenance | 900-R300 to 900-R304 |
| Vehicle & Equipment Upkeep | 900-U001, 900-U100 to 900-U120, 900-U200 to 900-U207 |
| Depreciation | 900-D003 |
| Insurance | 900-F002, 900-F004, 900-I001, 900-I003, 900-I004 |
| Finance Costs | 900-T003, 900-H001, 900-L001, 900-B001, 900-B002, 900-B003 |
| Other OPEX | All remaining 900-xxxx accounts |

**CSV export columns:** Category, Account No, Account Name, Net Cost (RM) (2 decimals), % of OPEX (2 decimals).

---

## 7. API Contracts

All endpoints accept dates as `YYYY-MM-DD` strings. All monetary values are in MYR. All date filtering applies a +8 hour UTC-to-MYT offset before comparison.

### 7.1 GET `/api/expenses/cost/date-bounds`

Returns the earliest and latest transaction dates in the GL detail table.

**Parameters:** None

**Response:**
```json
{
  "min_date": "2023-03-01",
  "max_date": "2026-02-28"
}
```

| Field | Type | Description |
|-------|------|-------------|
| min_date | string | Earliest DATE(gldtl.TransDate, '+8 hours') |
| max_date | string | Latest DATE(gldtl.TransDate, '+8 hours') |

---

### 7.2 GET `/api/expenses/cost/fiscal-years`

Returns all fiscal year definitions, ordered newest first.

**Parameters:** None

**Response:**
```json
{
  "data": [
    { "FiscalYearName": "FY2025", "FromDate": "2025-03-01", "ToDate": "2026-02-28" }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data[].FiscalYearName | string | Display name from fiscal_year.FiscalYearName |
| data[].FromDate | string | Start date from fiscal_year.FromDate |
| data[].ToDate | string | End date from fiscal_year.ToDate |

---

### 7.3 GET `/api/expenses/cost/kpis`

Returns KPI summary for the selected period with year-over-year comparison.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| start_date | No | `2025-03-01` | Period start |
| end_date | No | `2026-02-28` | Period end |

**Response:**
```json
{
  "current": {
    "total_costs": 5000000,
    "cogs": 3500000,
    "opex": 1500000
  },
  "calculated": {
    "cogs_pct_of_total": 70.0,
    "opex_pct_of_total": 30.0
  },
  "yoy_pct": 12.3
}
```

| Field | Type | Description |
|-------|------|-------------|
| current.total_costs | number | SUM(gldtl.HomeDR - gldtl.HomeCR) for AccType IN ('CO','EP') |
| current.cogs | number | Same sum filtered to AccType = 'CO' |
| current.opex | number | Same sum filtered to AccType = 'EP' |
| calculated.cogs_pct_of_total | number | (cogs / total_costs) * 100 |
| calculated.opex_pct_of_total | number | (opex / total_costs) * 100 |
| yoy_pct | number or null | Year-over-year percentage change in total_costs. Null if previous period total is zero. |

---

### 7.4 GET `/api/expenses/cost/trend`

Returns cost data grouped by time period and category, for the stacked bar chart.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| start_date | No | `2025-03-01` | Period start |
| end_date | No | `2026-02-28` | Period end |
| cost_type | No | `all` | `all`, `cogs`, or `opex` |
| granularity | No | `monthly` | `daily`, `weekly`, or `monthly` |

**Response:**
```json
{
  "granularity": "monthly",
  "data": [
    { "month": "2025-03", "category": "COGS", "net_cost": 350000 },
    { "month": "2025-03", "category": "OPEX", "net_cost": 120000 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| granularity | string | Echo of the requested granularity |
| data[].month | string | Period label: `YYYY-MM-DD` (daily), `YYYY-Www` (weekly), or `YYYY-MM` (monthly) |
| data[].category | string | Category name. Varies by cost_type (see Section 3.3). |
| data[].net_cost | number | SUM(gldtl.HomeDR) - SUM(gldtl.HomeCR) for that period+category |

**Grouping behavior by cost_type:**

- `all`: category is "COGS" or "OPEX" (by glmast.AccType)
- `cogs`: category is glmast.Description (individual COGS GL account names)
- `opex`: category is the OPEX sub-category (Payroll, Fuel, etc.)

---

### 7.5 GET `/api/expenses/cost/composition`

Returns cost totals grouped by category for the donut chart.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| start_date | No | `2025-03-01` | Period start |
| end_date | No | `2026-02-28` | Period end |
| cost_type | No | `all` | `all`, `cogs`, or `opex` |

**Response:**
```json
{
  "data": [
    { "category": "COGS", "net_cost": 3500000 },
    { "category": "OPEX", "net_cost": 1500000 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data[].category | string | Category name (same grouping rules as trend endpoint) |
| data[].net_cost | number | Total net cost for the full date range. Ordered by net_cost descending. |

---

### 7.6 GET `/api/expenses/cost/top-expenses`

Returns the top (or bottom) 10 GL accounts by net cost.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| start_date | No | `2025-03-01` | Period start |
| end_date | No | `2026-02-28` | Period end |
| cost_type | No | `all` | `all`, `cogs`, or `opex` |
| order | No | `desc` | `desc` for top 10, `asc` for bottom 10 |

**Response:**
```json
{
  "data": [
    {
      "acc_no": "600-0000",
      "account_name": "Purchases",
      "acc_type": "CO",
      "cost_type": "COGS",
      "net_cost": 2500000
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data[].acc_no | string | glmast.AccNo |
| data[].account_name | string | glmast.Description |
| data[].acc_type | string | glmast.AccType ('CO' or 'EP') |
| data[].cost_type | string | Derived: "COGS" when acc_type='CO', else "OPEX" |
| data[].net_cost | number | SUM(gldtl.HomeDR) - SUM(gldtl.HomeCR). Only accounts with net_cost > 0 are included. |

---

### 7.7 GET `/api/expenses/cost/cogs-breakdown`

Returns all COGS GL accounts with their net cost for the selected period.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| start_date | No | `2025-03-01` | Period start |
| end_date | No | `2026-02-28` | Period end |

**Response:**
```json
{
  "data": [
    { "acc_no": "600-0000", "account_name": "Purchases", "net_cost": 2500000 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data[].acc_no | string | glmast.AccNo |
| data[].account_name | string | glmast.Description |
| data[].net_cost | number | Net cost. Only non-zero rows included (HAVING <> 0). Negative values are possible for contra accounts. Ordered by net_cost descending. |

---

### 7.8 GET `/api/expenses/cost/opex-breakdown`

Returns all OPEX GL accounts grouped by sub-category with their net cost.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| start_date | No | `2025-03-01` | Period start |
| end_date | No | `2026-02-28` | Period end |

**Response:**
```json
{
  "data": [
    { "category": "Payroll", "acc_no": "900-S001", "account_name": "Staff Salary", "net_cost": 480000 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| data[].category | string | OPEX sub-category (see mapping in Section 6.2) |
| data[].acc_no | string | glmast.AccNo |
| data[].account_name | string | glmast.Description |
| data[].net_cost | number | Net cost. Only non-zero rows. Ordered by category then net_cost descending. |

---

## 8. Data Sources

All queries join two tables:

| Table | Key Column | Role |
|-------|-----------|------|
| **gldtl** (GL Detail) | gldtl.AccNo | Transaction-level debits and credits. Key fields: TransDate, HomeDR, HomeCR, AccNo. |
| **glmast** (GL Master) | glmast.AccNo | Chart of accounts. Key fields: AccNo, Description, AccType. |
| **fiscal_year** | -- | Fiscal year definitions. Fields: FiscalYearName, FromDate, ToDate. |

**Join:** gldtl.AccNo = glmast.AccNo

**Account type codes:**

| AccType | Meaning | Dashboard Label |
|---------|---------|----------------|
| `CO` | Cost of Goods Sold | COGS |
| `EP` | Expenses (Operating) | OPEX |

**Net cost formula:** SUM(gldtl.HomeDR) - SUM(gldtl.HomeCR)

**Timezone handling:** All date comparisons apply `+8 hours` to gldtl.TransDate before extracting the date, converting UTC storage to Malaysia Time (MYT, UTC+8).

**Currency:** All values use gldtl.HomeDR / gldtl.HomeCR (home currency columns), which are in MYR.
