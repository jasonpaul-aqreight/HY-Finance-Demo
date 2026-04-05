# Payment Collection

> Monitors customer payment health, receivables aging, cash collection efficiency, and credit risk scoring to assess and improve cash flow management.

---

## 1. Purpose & User Goals

The Payment Collection page is the central view for accounts receivable management. It answers:

- How much do customers owe us right now, and how much is overdue?
- How efficiently are we collecting payments over time (average collection days and collection rate)?
- Which customers are exceeding their credit limits?
- How risky is each customer based on their payment behavior?
- Is our collection performance improving or deteriorating month over month?

This is the "cash flow health check" page — it bridges the gap between revenue shown on the Sales Report and actual money received.

---

## 2. Page Layout

The page is organized into **two distinct sections** with a clear visual separator between them. This separation reflects a fundamental data distinction: period-based metrics (filtered by date range) vs. snapshot metrics (current state of all outstanding invoices).

### Top-to-Bottom Section Order

```
┌─────────────────────────────────────────────────┐
│  Date Range Filter                               │
│  [Start] [End]                                   │
├─────────────────────────────────────────────────┤
│  ── Section 1: Payment Collection Trend ──       │
│                                                  │
│  Period KPI Cards (3 cards)                      │
│  [Avg Collection Days] [Collection Rate]         │
│  [Avg Monthly Collection]                        │
├─────────────────────────────────────────────────┤
│  Avg Collection Days Trend (line chart)          │
├─────────────────────────────────────────────────┤
│  Invoiced vs Collected (bar + line combo chart)  │
├═════════════════════════════════════════════════┤
│  ── Section 2: Outstanding Payment (Snapshot) ── │
│                                                  │
│  Snapshot KPI Cards (3 cards)                    │
│  [Total Outstanding] [Overdue Amount]            │
│  [Credit Limit Breaches]                         │
├─────────────────────────────────────────────────┤
│  ┌──────────────────┬──────────────────────┐     │
│  │ Aging Analysis   │ Credit Usage         │     │
│  │ (horizontal bar) │ Distribution (donut) │     │
│  │ [All/Agent/Type] │                      │     │
│  └──────────────────┴──────────────────────┘     │
├─────────────────────────────────────────────────┤
│  Customer Credit Health Table                    │
│  (sortable, searchable, paginated, exportable)   │
└─────────────────────────────────────────────────┘
```

### Responsive Behavior

| Breakpoint | KPI Cards | Layout |
|------------|-----------|--------|
| Mobile (<640px) | 2 per row | Single column, stacked vertically |
| Tablet (640–1279px) | 3 per row | Single column, stacked vertically |
| Desktop (1280px+) | 3 per row | Charts in 2-column grid, table full width |

Maximum content width: 1600px, horizontally centered.

---

## 3. KPI Cards

Six cards total, split into two groups of three. All monetary values formatted as Malaysian Ringgit (RM).

### Period KPI Cards (Section 1 — Date-Filtered)

#### 3.1 Avg Collection Days

- **Label:** "Avg Collection Days"
- **Value:** Average of all monthly collection day values in the selected date range (also known as Days Sales Outstanding / DSO)
- **Formula:** For each month: (AR Outstanding at month-end ÷ Credit Sales for that month) × Days in that month. KPI shows the average across all valid months.
- **Subtitle:** "avg monthly collection days"
- **Format:** "{N} days"
- **Color coding:** Green if ≤30 days, yellow if ≤60 days, red if >60 days
- **Tooltip:** Shows the formula explanation
- **Null handling:** If credit sales = 0 for a month, that month is excluded from the average

#### 3.2 Collection Rate

- **Label:** "Collection Rate"
- **Value:** Percentage of invoiced amount collected in the selected period
- **Formula:** Total Collected ÷ Total Invoiced × 100
- **Subtitle:** "in selected period"
- **Format:** "{N.N}%"
- **Color coding:** Green if ≥80%, yellow if ≥50%, red if <50%
- **Note:** Excludes offsets between amounts owed and owing (non-cash offsets) — measures actual cash collection only

#### 3.3 Avg Monthly Collection

- **Label:** "Avg Monthly Collection"
- **Value:** Total collected in period divided by number of months in the selected range
- **Formula:** Total Collected ÷ Number of Months in Range
- **Subtitle:** "in selected period"
- **Format:** RM with thousands separator (e.g., "RM 6,381,543")
- **Color:** Blue (static, no conditional coloring)

### Snapshot KPI Cards (Section 2 — Current State)

#### 3.4 Total Outstanding

- **Label:** "Total Outstanding"
- **Value:** Sum of all unpaid invoices across all customers
- **Format:** RM with thousands separator
- **Color:** Orange (static)
- **Scope:** Always shows current accumulated position, regardless of date range selection

#### 3.5 Overdue Amount

- **Label:** "Overdue Amount"
- **Value:** Sum of outstanding amounts on invoices past their due date
- **Subtitle:** "{X}% of total · {N} customers" — where X = overdue amount ÷ total outstanding × 100, and N = count of distinct customers with overdue invoices
- **Format:** RM with thousands separator
- **Color:** Red (static)

#### 3.6 Credit Limit Breaches

- **Label:** "Credit Limit Breaches"
- **Value:** Count of active customers whose total outstanding exceeds their assigned credit limit (only customers with a credit limit > 0 are evaluated)
- **Subtitle:** "customers over limit"
- **Format:** Whole number
- **Color coding:** Green if 0, red if >0

---

## 4. Charts

### 4.1 Avg Collection Days Trend

A line chart showing how collection speed changes over time.

**Chart dimensions:** ~380px height, full responsive width.

**X-axis:** Month (formatted as "YYYY-MM").

**Y-axis:** Days (label: "Days").

**Line:** Monthly collection day values, colored dark blue (#2E5090).

**Reference line:** Dashed horizontal line at the average across all displayed months, labeled "Avg {N}d".

**Tooltip:** On hover, shows "Avg Collection Days: {N.N} days" for that month.

**Scope:** Period-filtered — responds to the date range selector.

**Calculation per month (DSO formula):**
1. AR Outstanding at month-end = cumulative invoiced amount minus cumulative payments, credit notes, and refunds (all non-cancelled, timezone-adjusted).
2. Monthly Credit Sales = invoice totals for that month only.
3. DSO = (AR Outstanding ÷ Monthly Credit Sales) × Days in that month.
4. If monthly credit sales = 0, DSO is null (no data point plotted).

### 4.2 Invoiced vs Collected

A composed chart combining bars and a line to compare collection against invoicing.

**Chart dimensions:** ~380px height, full responsive width.

**X-axis:** Month (formatted as "YYYY-MM").

**Y-axis:** Amount in RM. Large values abbreviated (e.g., "350K", "1.2M").

**Bars:** Monthly total collected, colored dark blue (#2E5090).

**Line:** Monthly total invoiced, colored red (#ef4444).

**Reference line:** Dashed horizontal line at the Avg Monthly Collection value (from KPI 3.3), labeled "Avg {RM amount}".

**Legend:** "Collected" (blue bars), "Invoiced" (red line).

**Tooltip:** On hover, shows both collected and invoiced amounts for that month.

**Scope:** Period-filtered.

**How to read:** When the blue bars (collected) consistently fall below the red line (invoiced), the business is accumulating unpaid receivables — a warning sign for cash flow.

### 4.3 Aging Analysis

A horizontal bar chart showing outstanding invoices broken down by how overdue they are.

**Chart dimensions:** Dynamic height based on content. Full responsive width.

**Scope:** Snapshot (not date-filtered) — always shows current state.

**Aging buckets** (displayed top to bottom):

| Bucket | Condition | Color |
|--------|-----------|-------|
| Not Yet Due | Invoice due date has not passed | Green |
| 1–30 Days | 1 to 30 days past due | Yellow |
| 31–60 Days | 31 to 60 days past due | Orange |
| 61–90 Days | 61 to 90 days past due | Light red |
| 91–120 Days | 91 to 120 days past due | Red |
| 120+ Days | More than 120 days past due | Dark red |

**Y-axis:** Bucket labels.

**X-axis:** Outstanding amount in RM (abbreviated with K/M notation).

**View modes** (toggle buttons in the card header):

| Mode | Label | Behavior |
|------|-------|----------|
| All | "All" | Simple horizontal bars, one per bucket, each colored by bucket severity. Invoice count label displayed to the right of each bar. |
| By Agent | "By Agent" | Stacked horizontal bars where each segment represents a different sales agent. Distinct color per agent. Legend shown below chart. |
| By Type | "By Type" | Stacked horizontal bars where each segment represents a customer type (e.g., Chain Store, Restaurant, Wholesaler). Distinct color per type. Legend shown below chart. |

**Tooltip:** Shows formatted RM amount per segment on hover.

### 4.4 Credit Usage Distribution

A donut (ring) chart showing how customers are distributed across credit usage categories.

**Scope:** Snapshot (not date-filtered).

**Categories:**

| Category | Condition | Color |
|----------|-----------|-------|
| Within Limit (< 80%) | Usage below 80% | Green |
| Near Limit (≥ 80%) | Usage between 80% and 100% | Yellow |
| Over Limit (> 100%) | Usage exceeds 100% | Red |
| No Limit Set | Customer has no credit limit assigned (null or 0) | Gray |

**Center label:** Total number of customers that have credit limits set (excludes "No Limit Set" category).

**Legend:** Displayed below the chart, showing each category with color swatch and customer count.

**Tooltip:** "{N} customers" per category on hover.

**Empty categories:** Categories with zero customers are hidden from both chart and legend.

**Credit usage calculation:** Total Outstanding ÷ Credit Limit × 100. Customers without a credit limit are categorized as "No Limit Set."

---

## 5. Tables

### 5.1 Customer Credit Health Table

The main data table providing a comprehensive view of every customer's credit health.

**Title:** "Customer Credit Health"

**Subtitle:** "Overdue calculated as of {today's date}"

**Scope:** Snapshot (not date-filtered) — preceded by a visual separator noting this distinction.

**Default sort:** Total Outstanding, descending.

**Header controls:**

| Control | Behavior |
|---------|----------|
| **Search** | Text input ("Search by customer code or name..."). Case-insensitive substring match. Resets to page 1 on change. Width: ~192px. |
| **Type Filter** | Dropdown allowing selection of customer type. Options: All Types, Consumer, Fruit Shop, Hospitality, Intermediary, Supermarket, Wet Market, Wholesaler. Default: "All Types". |
| **Risk Level Filter** | Dropdown allowing selection of risk tier. Options: All Risk Level, Low Risk, Moderate Risk, High Risk. Default: "All Risk Level". |
| **Score & Risk** | Button (admin-only) that opens the Settings dialog (see Section 7). |
| **Export Excel** | Button that exports the current filtered/sorted data as an .xlsx file with formatted columns. |

**Columns (11 total, all sortable):**

| Column | Description | Format | Notes |
|--------|-------------|--------|-------|
| Code | Customer account number | Monospace, small text | — |
| Name | Company name | Blue underlined link (clickable) | Opens Customer Profile modal. Max width ~200px, truncated if longer. |
| Type | Customer type classification | Pill/badge styling | e.g., "Chain Store", "Wholesaler" |
| Agent | Sales agent managing this account | Small text | — |
| Credit Limit | Maximum approved credit amount | RM currency; "--" if no limit set | — |
| Outstanding | Total amount currently owed | RM currency, bold | — |
| Credit Used | Outstanding ÷ Credit Limit × 100 | Progress bar + percentage label | Bar color: green (<80%), yellow (80–99%), red (≥100%). Shows "--" if no credit limit. |
| Aging Count | Number of overdue invoices | Whole number; red text if >0 | — |
| Oldest Due | Days since oldest overdue invoice | "{N}d" format; "--" if nothing overdue | Red bold text if overdue |
| Health Score | Credit health score | 0–100, monospace | See Section 7 for calculation |
| Risk Level | Risk tier classification | Color-coded pill | Green = "Low", Yellow = "Moderate", Red = "High" |

**Sorting behavior:**
- Click any column header to toggle sort direction.
- Text columns default to ascending on first click; numeric columns default to descending.
- Changing sort resets to page 1.

**Pagination:**
- Default page size: 25 rows.
- Selectable page sizes: 10, 25, 50, 100.
- Shows "{X} of {Y} customers" count.
- Previous/Next navigation buttons.

**Row interaction:**
- Only the customer **name** is clickable (styled as a blue underlined link). The row itself is not clickable.
- Clicking the name opens the Customer Profile modal, defaulting to the **Outstanding Invoices** tab (context-appropriate for the Payment page).

---

## 6. Filters & Controls

### 6.1 Date Range Filter

- **Location:** Top of Section 1.
- **Controls:**
  - **Start Date picker** — Selects a specific date (YYYY-MM-DD format).
  - **End Date picker** — Selects a specific date (YYYY-MM-DD format).
  - Both pickers are bounded by the earliest and latest invoice dates in the data.
- **Default range:** On first load, the system fetches the min/max invoice dates, then defaults to a 12-month window: start = first day of the month 11 months before the max date's month; end = last day of the max date's month.
- **Scope:** Affects only Section 1 components (Period KPI Cards, Avg Collection Days Trend chart, Invoiced vs Collected chart). Section 2 components are never affected by date range.
- **Key behavior:** The default range is calculated relative to the latest data date (not today's date), ensuring the page always shows data on first load even if the data sync hasn't run recently.

### 6.2 Aging Chart View Toggle

- **Location:** Header of the Aging Analysis chart card.
- **Options:** Three toggle buttons — "All", "By Agent", "By Type".
- **Default:** "All".
- **Effect:** Switches the aging chart between simple bars, agent-stacked bars, and type-stacked bars.

### 6.3 Table Filters

- **Search:** Real-time text filtering by customer code or name. Case-insensitive. Resets pagination to page 1.
- **Type dropdown:** Filters table to a single customer type. "All Types" clears the filter.
- **Risk Level dropdown:** Filters table to a single risk tier. "All Risk Level" clears the filter.
- All filters are combined with AND logic.

---

## 7. Credit Scoring System

Every customer receives a **credit health score** from 0 (worst) to 100 (best). The score assesses payment risk using four weighted factors. All weights and thresholds are configurable by administrators via the Settings dialog.

### 7.1 Four Scoring Factors

Each factor produces a component score from 0 to 100, which is then multiplied by its weight.

#### Factor 1: Credit Usage (default weight: 40%)

Measures how much of the customer's credit limit is currently in use.

- **Input:** Usage % = Total Outstanding ÷ Credit Limit × 100
- **If no credit limit is set:** Returns a neutral score of 50 (unknown risk)
- **Score:** max(0, round(100 − Usage %)). A customer at exactly their limit scores 0; a customer with no outstanding balance scores 100.

#### Factor 2: Overdue Days (default weight: 30%)

Measures the age of the customer's oldest overdue invoice.

| Oldest Overdue Invoice | Component Score |
|------------------------|-----------------|
| Nothing overdue (≤0 days) | 100 |
| 1–30 days late | 80 |
| 31–60 days late | 60 |
| 61–90 days late | 40 |
| 91–120 days late | 20 |
| Over 120 days late | 0 |

#### Factor 3: Payment Timeliness (default weight: 20%)

Measures the average lateness of payments across all recent paid invoices.

- **Input:** Average days late = mean of (payment date − invoice due date) across all payment-to-invoice matches in the lookback period (default: 12 months).
- **If no payment history exists:** Returns a neutral score of 50

| Average Days Late | Component Score |
|-------------------|-----------------|
| On time or early (≤0 days) | 100 |
| 1–7 days late | 80 |
| 8–14 days late | 60 |
| 15–30 days late | 40 |
| 31–60 days late | 20 |
| Over 60 days late | 0 |

#### Factor 4: Double Breach (default weight: 10%)

A binary penalty for customers who have breached **both** their credit limit and their overdue limit simultaneously.

| Status | Component Score |
|--------|-----------------|
| Not in double breach | 100 |
| Both limits breached | 0 |

### 7.2 Composite Score Calculation

```
Score = round(
    (Credit Usage Weight ÷ 100) × Credit Usage Score +
    (Overdue Days Weight ÷ 100) × Overdue Score +
    (Timeliness Weight ÷ 100) × Timeliness Score +
    (Double Breach Weight ÷ 100) × Double Breach Score
)
```

### 7.3 Risk Tiers

The composite score maps to a risk tier using configurable thresholds:

| Tier | Default Threshold | Color | Meaning |
|------|-------------------|-------|---------|
| Low Risk | Score ≥ 75 | Green | Reliable payer, low exposure. Continue extending credit. |
| Moderate Risk | Score between 31 and 74 | Yellow | Some concerns — monitor closely. |
| High Risk | Score ≤ 30 | Red | Significant problems — consider stopping credit sales. |

### 7.4 Settings Dialog (Admin Only)

Accessible via the "Score & Risk Settings" button in the table header. Only visible to admin-role users.

**Section 1: Credit Health Score Weights**

Four input fields, one per factor. Constraint: all four must sum to exactly 100%.

| Factor | Default Weight |
|--------|---------------|
| Credit Usage | 40% |
| Overdue Days | 30% |
| Payment Timeliness | 20% |
| Double Breach | 10% |

**Section 2: Risk Level Thresholds**

Two input fields defining the boundary between risk tiers:

| Threshold | Default | Description |
|-----------|---------|-------------|
| Low Risk | ≥ 75 | Scores at or above this value are "Low Risk" |
| High Risk | ≤ 30 | Scores at or below this value are "High Risk" |

Scores between the two thresholds are classified as "Moderate Risk."

**Visual Risk Threshold Bar:** A color-coded horizontal bar showing the three zones:
- Red zone: 0 to High threshold
- Yellow zone: High threshold to Low threshold
- Green zone: Low threshold to 100

**Expandable section:** "How Credit Health Score is calculated" — provides a plain-English explanation of all four factors and the formula, visible to administrators for transparency.

**Controls:**
- Save button — validates constraints (weights sum to 100, thresholds ordered correctly) and persists settings
- Cancel button — discards changes
- Reset to Defaults buttons — one per section (weights and thresholds each have their own reset button), restoring that section to factory defaults
- Success/error feedback messages with auto-dismiss

---

## 8. Cross-Page Navigation

### Customer Profile Modal

- **Trigger:** Clicking a customer name (blue underlined link) in the Customer Credit Health table.
- **Opens:** The Customer Profile modal (see doc 08 for full specification).
- **Default tab:** Outstanding Invoices — this is the context-appropriate tab when navigating from the Payment page (different pages open different default tabs).
- **Behavior:** The modal opens as a large overlay (90% viewport width and height). Closing it returns to the Payment page with all filters, sort state, and pagination preserved.

### No Other Navigation

The Payment page does not link to other dashboard pages. All drill-down happens through the Customer Profile modal.

---

## 9. Business Rules

### Accounts Receivable (AR)

AR is the total money owed by customers for goods delivered but not yet paid. It is the sum of all outstanding (unpaid) invoices.

### Avg Collection Days Formula (DSO)

```
Monthly Collection Days = (AR Outstanding at month-end ÷ Monthly Credit Sales) × Days in that month
```

- AR Outstanding = cumulative invoiced amount minus cumulative payments, credit notes, and refunds
- Credit Sales = invoice totals for that month (credit-term invoices only, not cash sales)
- If credit sales = 0 for a month, the value is undefined (excluded from averages)
- KPI Avg Collection Days = average of all valid monthly values in the date range

### Collection Rate Formula

```
Collection Rate = (Total Collected ÷ Total Invoiced) × 100
```

- Collected = sum of all payment amounts within the date range (non-cancelled)
- Invoiced = sum of all invoice totals within the date range (non-cancelled)
- Excludes offsets between amounts owed and owing (non-cash offsets)

### Avg Monthly Collection Formula

```
Avg Monthly Collection = Total Collected ÷ Number of Months in Range
```

### Credit Usage

```
Credit Usage % = Total Outstanding ÷ Credit Limit × 100
```

- Customers with no credit limit (null or 0) are categorized as "No Limit Set" and excluded from credit usage calculations
- A customer with outstanding of RM 120,000 and a limit of RM 100,000 has 120% usage (over limit)

### Overdue Calculation

An invoice is "overdue" when the current date exceeds its due date. The number of overdue days = current date − due date. The "oldest due" metric uses the maximum overdue days across all of a customer's outstanding invoices.

### Snapshot vs. Period Distinction

This is a critical design principle:

- **Period-based metrics** (Section 1): Avg Collection Days, Collection Rate, Avg Monthly Collection, Avg Collection Days Trend chart, Invoiced vs Collected chart. These respond to the date range filter.
- **Snapshot metrics** (Section 2): Total Outstanding, Overdue Amount, Credit Limit Breaches, Aging Analysis, Credit Usage, Customer Credit Health table. These always show the current accumulated position from the beginning of time to today. They are **never** filtered by the date range.

### Excluded Records

- All calculations exclude cancelled documents
- The generic "CASH SALES" account is excluded from outstanding and breach calculations. Named "CASH DEBTOR-xxx" accounts are included — they represent real businesses with credit terms.
- Only active customers are evaluated for credit limit breaches

### Timezone

All document dates are stored in UTC. Eight hours are added to convert to Malaysia Time (MYT, UTC+8) before any date grouping, filtering, or comparison.

### Currency

- All monetary values displayed in Malaysian Ringgit (RM)
- Format: "RM" prefix with thousands separators, no decimal places (e.g., "RM 11,369,300")
- Chart axis abbreviation: "K" for thousands, "M" for millions

---

## 10. Screenshot References

### Payment Trends — Collection Rate & Invoiced vs Collected

![Payment Trend](screenshots/payment/payment-trend.png)

### Customer Credit Health Table

![Customer Credit Health](screenshots/payment/customer-credit-health.png)

### Customer Outstanding Invoices — Aging & Summary

![Customer Outstanding](screenshots/payment/customer-outstanding.png)

### Customer Profile — Outstanding Invoices Log

![Customer Outstanding Log](screenshots/payment/customer-outstanding-log.png)

### Credit Health Score Settings Dialog

![Settings Dialog](screenshots/payment/settings-dialog.png)

### Settings Dialog — Admin Edit View

![Admin Settings](screenshots/payment/admin-can-edit-payment-setting.png)
