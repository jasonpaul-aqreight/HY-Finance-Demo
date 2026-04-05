# Expenses

> **Page Title:** "Expenses"
> **Page Description:** "Monitors major cost categories such as Cost of Sales (COGS), Operating Costs (OPEX), payroll costs, electricity, packing materials, and identifies the top 10 expenses."

---

## 1. Purpose & User Goals

The Expenses page answers: **"Where is all the money going?"**

It breaks down every ringgit Hoi-Yong spends into two buckets — Cost of Sales (COGS) (direct product costs, ~88% of total) and Operating Costs (OPEX) (operating overhead, ~12%) — then drills progressively deeper:

- **How much are we spending overall?** Total costs split into Cost of Sales vs Operating Costs with year-over-year comparison
- **How are costs trending?** Monthly stacked bar chart by cost category
- **What is the proportional split?** Donut chart showing cost composition
- **Which accounts cost the most (or least)?** Top/Bottom 10 GL accounts ranked by net cost
- **What are the individual line items?** Detailed Cost of Sales and Operating Costs breakdown tables by GL account

**Key insight this page enables:** Always compare cost growth (vs Last Year here) against revenue growth (vs Last Year on Sales page). Costs going up is not inherently bad — but costs growing *faster* than revenue means shrinking margins.

---

## 2. Page Layout

The page follows a single continuous scroll with components in this order:

| Row | Content | Width / Responsiveness |
|-----|---------|----------------------|
| 1 | **Page Banner** — title + description | Full width |
| 2 | **Date Range Filter** — start/end month pickers with presets | Full width |
| 3 | **KPI Cards** — 4 summary cards | 4 across on desktop, 2×2 on mobile |
| 4 | **Cost Type Toggle** — segmented button: All / Cost of Sales / Operating Costs | Left-aligned, full width container |
| 5 | **Cost Trend Chart** (left, 70%) + **Cost Composition Donut** (right, 30%) | Side-by-side on large screens; stacked on small. Enclosed in a single rounded card. |
| 6 | **Category Legend** — colored squares with category names | Full width, below the chart card |
| 7 | **Top 10 Expenses Chart** — horizontal bar chart with own local toggles | Full width |
| 8 | **Breakdown Tables** — tabbed: "Cost of Sales Breakdown" and "Operating Costs Breakdown" | Full width, height-locked container to prevent layout shift when switching tabs |

---

## 3. Filters & Controls

### 3.1 Date Range Filter

Two month-year pickers (start and end), constrained by the earliest and latest months with available data.

**Quick Presets:** 3M, 6M, 12M, YTD. Each preset anchors the end date to the latest month with data and counts backwards.

**Default range:** 12 months ending at the latest month in the dataset (inclusive).

### 3.2 Cost Type Toggle (Global)

A segmented button group with three options, positioned between the KPI cards and the chart section. This toggle affects the **Cost Trend Chart** and **Cost Composition Donut** (but NOT the KPI cards or breakdown tables).

| Option | Trend Chart Grouping | Composition Donut Grouping |
|--------|---------------------|---------------------------|
| **All** (default) | Two stacked series: "Cost of Sales" and "Operating Costs" | Two slices: Cost of Sales vs Operating Costs |
| **Cost of Sales** | One series per individual Cost of Sales account name (e.g., "Purchases", "Freight Charges") | One slice per Cost of Sales account |
| **Operating Costs** | One series per Operating Costs sub-category (e.g., "People & Payroll", "Property & Utilities") | One slice per Operating Costs sub-category |

### 3.3 No Granularity Toggle

The trend chart displays **monthly data only**. There is no daily/weekly toggle.

---

## 4. KPI Cards

Four cards in a single row. These always show the full date range totals and are **not** affected by the cost type toggle.

### Card 1: Total Costs

- **Label:** "TOTAL COSTS"
- **Value:** RM amount, no decimals (e.g., "RM 85,982,244")
- **Subtext:** "Cost of Sales {cogs%}% · Operating Costs {opex%}%"
- **Formula:** Sum of all Cost of Sales + Operating Costs net amounts within the selected date range
- **Percentage calculation:** Each type's share of total costs (e.g., "Cost of Sales 88.4% · Operating Costs 11.6%")

### Card 2: Cost of Sales (COGS)

- **Label:** "COST OF SALES (COGS)"
- **Value:** RM amount, no decimals
- **Subtext:** "Direct costs of products sold"
- **Formula:** Sum of net amounts for all Cost of Sales accounts

### Card 3: Operating Costs (OPEX)

- **Label:** "OPERATING COSTS (OPEX)"
- **Value:** RM amount, no decimals
- **Subtext:** "Day-to-day business costs"
- **Formula:** Sum of net amounts for all Operating Costs accounts

### Card 4: vs Last Year

- **Label:** "VS LAST YEAR"
- **Value:** Percentage with sign (e.g., "+0.8%" or "−5.1%")
- **Subtext:** "vs same period last year"
- **Formula:** ((Current Period Total Costs − Prior Period Total Costs) ÷ |Prior Period Total Costs|) × 100
- **Prior period:** Same date range shifted back exactly one calendar year
- **Color logic:** **Red** if positive (costs increasing = unfavorable), **Green** if negative (costs decreasing = favorable). This is inverted from the Sales page because rising costs are bad.
- **Edge case:** If prior period total is zero → display "—"

**Loading state:** 4 skeleton placeholder cards while data loads.

---

## 5. Charts

### 5.1 Cost Trend Chart

- **Position:** Left side of chart card (70% width on large screens)
- **Chart type:** Stacked bar chart
- **Height:** Fixed at 360px
- **X-axis:** Month labels formatted as abbreviated month + 2-digit year (e.g., "Jan 25", "Feb 25")
- **Y-axis:** Net cost in MYR, abbreviated with suffix (e.g., "500K", "1.2M", "2.5M")
- **Series:** Determined dynamically by the cost type toggle (see Section 3.2). Categories are ordered by total value descending.
- **Colors:**
  - **All mode:** Cost of Sales = blue, Operating Costs = orange
  - **Cost of Sales mode:** Cycles through a 17-color high-contrast palette (one color per individual Cost of Sales account)
  - **Operating Costs mode:** Each sub-category has a dedicated color (see Color Mapping in Section 8)
- **Tooltip:** On hover, shows the month label, each category with its RM value (only categories with value > 0), and a "Total" row summing all categories
- **Legend:** Categories are displayed as a shared legend below the chart card (not inside the chart itself), showing colored squares with category names. This legend updates dynamically when the cost type toggle changes.

### 5.2 Cost Composition Donut

- **Position:** Right side of chart card (30% width on large screens)
- **Chart type:** Donut (pie chart with hollow center)
- **Height:** Fixed at 350px
- **Slices:** One per category. Only categories with positive net cost are shown. Category grouping matches the cost type toggle.
- **Labels:** Percentage on each slice (e.g., "25.3%")
- **Colors:** Same color mapping as the trend chart
- **Tooltip:** Category name and RM-formatted value

### 5.3 Top 10 Expenses Chart

- **Position:** Full width, below the chart card
- **Chart type:** Horizontal bar chart
- **Height:** Dynamic — minimum 400px, scales at 45px per entry
- **Y-axis labels:** Numbered account names (e.g., "1. Purchases", "2. Staff Salary")
- **X-axis:** Net cost in MYR, abbreviated
- **Bar colors:** Each bar is colored by its cost type — blue for Cost of Sales accounts, orange for Operating Costs accounts. When filtered to a single cost type, all bars use that type's color.
- **Tooltip:** Account name, account number, cost type label, RM-formatted value, and percentage of total costs displayed

**Local toggles** (independent of the global cost type toggle, displayed in the chart header):

| Toggle | Options | Default |
|--------|---------|---------|
| Cost type | All / Cost of Sales / Operating Costs | All |
| Direction | Top / Bottom | Top |

- **Top:** 10 accounts with highest net cost
- **Bottom:** 10 accounts with lowest net cost
- Only accounts with positive net cost are included

---

## 6. Tables

The Cost of Sales and Operating Costs breakdown tables are presented in a **tabbed interface** with two tabs: "Cost of Sales Breakdown" and "Operating Costs Breakdown". The tab container uses **height locking** — when switching tabs, the container maintains its height to prevent page jumping.

Both tables are **not affected** by the global cost type toggle — they always show their respective data.

**No pagination** — these are hierarchical/financial tables. Use Excel export only.

### 6.1 Cost of Sales Breakdown Table

A flat table listing every Cost of Sales account.

| Column | Description | Sortable |
|--------|-------------|----------|
| Account No | GL account number | Yes |
| Account Name | GL account description | Yes |
| Net Cost (RM) | Net amount formatted in RM. Negative values shown in **red**. | Yes (default: descending) |
| % of Total | (row net cost ÷ total Cost of Sales) × 100, to 1 decimal place | No |

- **Default sort:** Net Cost descending
- **Footer row:** "TOTAL COST OF SALES" with sum of all rows and "100.0%"
- **Row styling:** Alternating row backgrounds for readability
- **Negative values:** Displayed in red — these represent contra accounts (discounts received, purchase returns) that reduce total Cost of Sales
- **Zero-value accounts:** Excluded (only non-zero accounts shown)
- **Empty state:** "No Cost of Sales data for selected period"
- **Export:** "Export Excel" button → downloads .xlsx file with columns: Account No, Account Name, Net Cost (RM), % of Total

**Interpreting percentages over 100%:** Gross Purchases will exceed 100% of net Cost of Sales because contra accounts (discounts, returns) are negative. The percentages are calculated against the net total, so the positive accounts sum to more than 100% while the negative accounts bring the grand total back to 100.0%.

### 6.2 Operating Costs Breakdown Table

A hierarchical table with **collapsible category groups**. All categories are **collapsed by default**.

**Category header rows** (clickable to collapse/expand):

| Column | Description |
|--------|-------------|
| Category name | Category label with expand/collapse indicator: ▼ (expanded) or ▶ (collapsed) |
| Net Cost (RM) | Subtotal for all accounts in this category |
| % of Total | (category subtotal ÷ total Operating Costs) × 100, to 1 decimal place |

**Account detail rows** (visible when category is expanded):

| Column | Description |
|--------|-------------|
| Account No | GL account number (indented under category) |
| Account Name | GL account description |
| Net Cost (RM) | Individual account net amount |
| % of Total | (row net cost ÷ total Operating Costs) × 100, to 1 decimal place |

- **Category row styling:** Bold text, slightly darker background
- **Account row styling:** Alternating backgrounds, indented
- **Footer row:** "TOTAL OPERATING COSTS" with sum of all rows and "100.0%"
- **Zero-value accounts:** Excluded
- **Empty state:** "No Operating Costs data for selected period"
- **Export:** "Export Excel" button → downloads .xlsx file with columns: Category, Account No, Account Name, Net Cost (RM), % of Total

---

## 7. Operating Costs Sub-Categories

Operating Costs accounts are organized into **13 sub-categories** based on their GL account number. Each account is mapped to exactly one category. Child accounts automatically inherit their parent account's category.

**Categories in display order:**

| # | Category | What It Covers |
|---|----------|---------------|
| 1 | People & Payroll | Staff salaries, EPF (pension), SOCSO (social security), bonuses, wages |
| 2 | Vehicle & Transport | Fuel, vehicle repairs, road tax, parking, delivery fleet costs |
| 3 | Property & Utilities | Warehouse/factory rent, electricity, water, property maintenance |
| 4 | Depreciation | Accounting wear-and-tear on trucks, cold rooms, forklifts, equipment |
| 5 | Office & Supplies | Stationery, packaging materials, postage, office consumables |
| 6 | Equipment & IT | Computer equipment, software, tools, small equipment purchases |
| 7 | Insurance | Vehicle insurance, fire insurance, workers' compensation insurance |
| 8 | Finance & Banking | Bank interest, loan interest, bank charges, credit facility costs |
| 9 | Professional Fees | Audit fees, legal fees, consulting, professional services |
| 10 | Marketing & Entertainment | Entertainment expenses, marketing costs, advertising, promotions |
| 11 | Repair & Maintenance | Building maintenance, equipment repairs |
| 12 | Tax & Compliance | Stamp duty, penalties, government-related compliance costs |
| 13 | Other | All Operating Costs accounts not mapped to the above categories |

**Note on category differences from legacy documentation:** Earlier versions used 11 categories with different names (e.g., "Payroll", "Fuel", "Rental", "Electricity & Water"). The current system uses 13 more granular categories. The account-to-category mapping is maintained centrally and uses parent-child account hierarchy so that child accounts automatically inherit their parent's category.

---

## 8. Business Rules

### 8.1 Cost of Sales vs Operating Costs Distinction

All GL accounts are classified by their account type code:

| Account Type | Dashboard Label | Description |
|-------------|----------------|-------------|
| Cost of Goods Sold | Cost of Sales (COGS) | Direct costs of products sold (purchases, freight, discounts received, purchase returns) |
| Operating Expenses | Operating Costs (OPEX) | Indirect business costs (salaries, rent, electricity, depreciation, etc.) |

### 8.2 Net Cost Formula

```
Net Cost = Total Debits − Total Credits
```

For expense accounts, debits represent costs incurred and credits represent reductions (e.g., discounts, reversals). A positive net cost means money spent; a negative net cost means money received back.

### 8.3 Year-over-Year Comparison

The "vs Last Year" KPI compares total costs in the selected date range against the **same date range shifted back exactly one calendar year**. This ensures seasonal comparability (e.g., comparing March–February of this year vs. March–February of last year).

### 8.4 Data Grain

All data is pre-aggregated at **monthly grain** per GL account. This means:
- The finest time resolution available is monthly
- The trend chart always shows monthly bars (no daily/weekly option)
- Date range filters operate on whole months

### 8.5 Currency and Formatting

| Element | Format |
|---------|--------|
| Currency values (KPI cards) | "RM" prefix, thousands separators, no decimals (e.g., "RM 1,234,567") |
| Currency values (breakdown tables) | "RM" prefix, thousands separators, 2 decimal places (e.g., "RM 1,234,567.00") |
| Y-axis abbreviation | Values ≥ 1,000,000 → "X.XM"; values ≥ 1,000 → "XXXK" |
| Percentages | 1 decimal place (e.g., "88.4%") |
| Negative values in tables | Displayed in red with minus sign |

### 8.6 Default Date Range

If data bounds are not yet loaded, the system falls back to a 12-month range ending at the latest available data month. Once bounds arrive from the database, the range initializes to: start = 12 months before latest data month, end = last day of latest data month.

---

## 9. Color Mapping

### Type-Level Colors (All Mode)

| Type | Color |
|------|-------|
| Cost of Sales | Blue |
| Operating Costs | Orange |

### Operating Costs Sub-Category Colors

Each of the 13 Operating Costs categories has a dedicated color used in the trend chart and composition donut when the cost type toggle is set to "Operating Costs":

| Category | Color |
|----------|-------|
| People & Payroll | Blue |
| Depreciation | Rose |
| Property & Utilities | Green |
| Vehicle & Transport | Amber |
| Office & Supplies | Violet |
| Finance & Banking | Cyan |
| Insurance | Pink |
| Other | Orange |
| Equipment & IT | Indigo |
| Professional Fees | Teal |
| Marketing & Entertainment | Red |
| Tax & Compliance | Yellow |
| Repair & Maintenance | Dark Green |

### Cost of Sales Account Colors

When the toggle is set to "Cost of Sales", individual accounts cycle through a 17-color high-contrast palette. The palette is designed to maximize visual distinction between adjacent accounts.

---

## 10. Cross-Page Navigation

The Expenses page is a **standalone page** with no outbound links to other pages or modals within its content. Navigation to other pages is via the sidebar only.

**No clickable entities:** Unlike other pages (Sales, Payment, Return), this page does not display customer or supplier names, so there are no entity links or profile modal triggers.

---

## 11. Screenshot References

*Screenshots to be captured in Session 12.*

---

## 12. Drift from Legacy Documentation

The following differences were discovered by reverse-engineering the live codebase (this spec reflects the **actual current implementation**):

| Area | Old Documentation | Actual Implementation |
|------|------------------|----------------------|
| Operating Costs categories | 11 categories (Payroll, Electricity & Water, Packaging Materials, Fuel, Rental, Repair & Maintenance, Vehicle & Equipment Upkeep, Depreciation, Insurance, Finance Costs, Other OPEX) | **13 categories** with restructured names (People & Payroll, Vehicle & Transport, Property & Utilities, Depreciation, Office & Supplies, Equipment & IT, Insurance, Finance & Banking, Professional Fees, Marketing & Entertainment, Repair & Maintenance, Tax & Compliance, Other) |
| Granularity toggle | Daily / Weekly / Monthly toggle in chart header | **Monthly only** — no granularity toggle in the UI |
| Export format | "Export CSV" button generating .csv files | **"Export Excel"** button generating .xlsx files |
| Operating Costs table default state | All categories collapsed by default | All categories **collapsed** by default (unchanged from legacy) |
| Breakdown table layout | Two separate table sections (Cost of Sales then Operating Costs) | **Tabbed interface** with height-locking to prevent layout shift |
| Table number alignment | Right-aligned for monetary values and percentages | **Left-aligned for text columns, right-aligned for numeric columns** (Net Cost, %) |
| URL parameter persistence | Filter state persisted in URL query string | **In-memory state only** — no URL persistence |
| Data source | Direct GL table joins (gldtl JOIN glmast) | **Pre-computed monthly table** (aggregated at sync time) |
| Category legend | Not documented | **Shared legend** below chart card, updates dynamically with cost type toggle |
| Category mapping method | Pattern matching on account number prefixes | **Centralized mapping** with parent-child account hierarchy (child accounts inherit parent's category) |
