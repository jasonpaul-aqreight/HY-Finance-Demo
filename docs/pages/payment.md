# Payment Collection Dashboard

## 1. Purpose & User Goals

The Payment Collection dashboard lives at `/payment` and serves as the central view for monitoring customer payment health, receivables aging, cash collection efficiency, and credit risk. Its banner reads:

> **Payment Collection** -- Tracks customer payment health, including payment aging, outstanding amounts, and credit scoring to assess risk and improve cash flow management.

Key user goals:

- **Monitor outstanding receivables** -- see total amounts owed and how much is overdue.
- **Track collection efficiency** -- compare invoiced amounts versus collected amounts over time, monitor DSO trends.
- **Assess credit risk** -- identify customers exceeding credit limits, review credit scores and risk tiers.
- **Investigate individual customers** -- drill into any customer row to open a Customer Profile Modal.

---

## 2. Page Layout

The page is organized top-to-bottom into five zones:

| Zone | Section Title | Contents |
|------|--------------|----------|
| 1 | *(banner)* | Page title "Payment Collection" and description |
| 2 | **Date Range** | Start date and end date pickers |
| 3 | **Overview** | 6 KPI cards in a single row |
| 4 | **Analysis** | Row 1: DSO Trend chart + Invoiced vs Collected chart (2 columns). Row 2: Aging Analysis chart + Credit Utilization Distribution chart (2 columns) |
| 5 | **Customer Credit Health** | Full-width sortable, searchable, paginated table. Preceded by a separator noting: "All outstanding invoices -- not filtered by date range above" |

The Aging Analysis chart, Credit Utilization chart, and Customer Credit Health table are **snapshot-based** (they reflect the current state of all outstanding invoices, independent of the date range). The KPI cards, DSO Trend chart, and Collection Trend chart are **period-based** (filtered by the selected date range).

---

## 3. Filters

### 3.1 Date Range Filter

A shared date-range picker appears at the top of the page.

| Control | Behavior |
|---------|----------|
| **Start Date** | Date picker (YYYY-MM-DD). Bounded by the earliest `ar_invoice.DocDate` in the database. |
| **End Date** | Date picker (YYYY-MM-DD). Bounded by the latest `ar_invoice.DocDate` in the database. |

**Default range**: On first load, the system fetches the min/max invoice dates, then defaults to a 12-month window: start = first day of the month 11 months before the max date's month; end = last day of the max date's month.

**Scope of filtering**: The date range affects KPIs (Collection Rate, DSO, Avg Monthly Collection), the DSO Trend chart, and the Invoiced vs Collected chart. The Aging Analysis, Credit Utilization, and Customer Table are **not** filtered by date range -- they always show the current snapshot.

---

## 4. KPI Cards

Six cards are displayed in a single responsive row (6 columns on large screens, 3 on medium, 2 on small).

### 4.1 Total Outstanding

| Property | Value |
|----------|-------|
| **Label** | "Total Outstanding" |
| **Color** | Orange |
| **Value** | Sum of `ar_invoice.Outstanding` for all non-cancelled invoices with `Outstanding > 0`. Formatted as RM with no decimals. |
| **Scope** | Snapshot (not date-filtered) |
| **Data source** | `ar_invoice.Outstanding` where `ar_invoice.Cancelled = 'F'` and `Outstanding > 0` |

### 4.2 Overdue Amount

| Property | Value |
|----------|-------|
| **Label** | "Overdue Amount" |
| **Color** | Red |
| **Value** | Sum of `ar_invoice.Outstanding` for non-cancelled invoices where `DueDate` (MYT-adjusted) is before the reference date. Formatted as RM. |
| **Subtitle** | "{X}% of total . {N} customers" -- where X = overdue amount / total outstanding * 100, and N = count of distinct `ar_invoice.DebtorCode` with overdue invoices. |
| **Scope** | Snapshot |
| **Data source** | `ar_invoice.Outstanding`, `ar_invoice.DueDate`, `ar_invoice.DebtorCode` |

### 4.3 Days Sales Outstanding (DSO)

| Property | Value |
|----------|-------|
| **Label** | "Days Sales Outstanding (DSO)" |
| **Color** | Green if <= 30 days, yellow if <= 60 days, red if > 60 days |
| **Value** | Average of the monthly DSO values computed by the DSO Trend calculation (see Section 5.1) over the selected date range. Displayed as "{N} days". |
| **Subtitle** | "avg monthly DSO" |
| **Scope** | Period-filtered |

### 4.4 Collection Rate

| Property | Value |
|----------|-------|
| **Label** | "Collection Rate" |
| **Color** | Green if >= 80%, yellow if >= 50%, red if < 50% |
| **Value** | Total collected / Total invoiced * 100, displayed as "{N}%". |
| **Subtitle** | "in selected period" |
| **Scope** | Period-filtered |
| **Calculation** | Collected = sum of `ar_payment.LocalPaymentAmt` within date range (non-cancelled). Invoiced = sum of `ar_invoice.LocalNetTotal` within date range (non-cancelled). All dates are MYT-adjusted (`DocDate + 8 hours`). |

### 4.5 Credit Limit Breaches

| Property | Value |
|----------|-------|
| **Label** | "Credit Limit Breaches" |
| **Color** | Red if > 0, green if 0 |
| **Value** | Count of customers whose total outstanding exceeds their credit limit. |
| **Subtitle** | "customers over limit" |
| **Scope** | Snapshot |
| **Calculation** | For each active debtor with `debtor.CreditLimit > 0`, sum their `ar_invoice.Outstanding` (non-cancelled, > 0). Count those where the sum exceeds `debtor.CreditLimit`. |

### 4.6 Avg Monthly Collection

| Property | Value |
|----------|-------|
| **Label** | "Avg Monthly Collection" |
| **Color** | Blue |
| **Value** | Total collected in period / number of months in the selected date range. Formatted as RM. |
| **Subtitle** | "in selected period" |
| **Scope** | Period-filtered |
| **Calculation** | months_in_range = max(1, round(days_in_range / 30.44)). Value = total collected / months_in_range. |

---

## 5. Charts

### 5.1 DSO Trend

| Property | Value |
|----------|-------|
| **Title** | "DSO Trend" |
| **Type** | Line chart |
| **X-axis** | Month (YYYY-MM) |
| **Y-axis** | Days (label: "Days") |
| **Line** | Monthly DSO values |
| **Reference line** | Dashed horizontal line at the average DSO across all displayed months, labeled "Avg {N}d" |
| **Scope** | Period-filtered |

**DSO calculation per month**:

1. For each month, compute cumulative AR outstanding at month-end:
   - Running total = cumulative `ar_invoice.LocalNetTotal` - cumulative `ar_payment.LocalPaymentAmt` - cumulative `ar_cn.LocalNetTotal` - cumulative `ar_refund.LocalPaymentAmt` (all non-cancelled, MYT-adjusted).
2. Monthly credit sales = `ar_invoice.LocalNetTotal` for that month.
3. DSO = (AR outstanding at month-end / monthly credit sales) * days in that month.
4. If monthly credit sales = 0, DSO is null (no data point).

### 5.2 Invoiced vs Collected

| Property | Value |
|----------|-------|
| **Title** | "Invoiced vs Collected" |
| **Type** | Composed chart (bars + line) |
| **X-axis** | Month (YYYY-MM) |
| **Y-axis** | Amount in RM (abbreviated: K for thousands, M for millions) |
| **Bars** | Monthly total collected (`ar_payment.LocalPaymentAmt`), colored navy blue |
| **Line** | Monthly total invoiced (`ar_invoice.LocalNetTotal`), colored red |
| **Reference line** | Dashed horizontal line at Avg Monthly Collection from KPIs, labeled "Avg {RM amount}" |
| **Legend** | "Collected" (bars), "Invoiced" (line) |
| **Scope** | Period-filtered |

**Calculation**: For each month in the range, aggregate `ar_payment.LocalPaymentAmt` (collected) and `ar_invoice.LocalNetTotal` (invoiced), both non-cancelled and MYT-adjusted. Months with no data show zero.

### 5.3 Aging Analysis

| Property | Value |
|----------|-------|
| **Title** | "Aging Analysis" |
| **Type** | Horizontal bar chart (with toggle for stacked view) |
| **Scope** | Snapshot (not date-filtered) |

**View modes** (toggle buttons in the card header):

| Mode | Label | Behavior |
|------|-------|----------|
| **All** | "All" | Simple horizontal bars, one per bucket, each bar colored by bucket severity |
| **By Agent** | "By Agent" | Stacked horizontal bars where each segment represents a sales agent (`debtor.SalesAgent`) |
| **By Type** | "By Type" | Stacked horizontal bars where each segment represents a customer type (`debtor.DebtorType`) |

**Aging buckets** (ordered top-to-bottom):

| Bucket | Condition | Color |
|--------|-----------|-------|
| Not Yet Due | `refDate - DueDate <= 0` days | Green |
| 1-30 Days | 1 to 30 days overdue | Yellow |
| 31-60 Days | 31 to 60 days overdue | Orange |
| 61-90 Days | 61 to 90 days overdue | Light red |
| 91-120 Days | 91 to 120 days overdue | Red |
| 120+ Days | > 120 days overdue | Dark red |

- **Y-axis**: Bucket labels
- **X-axis**: Outstanding amount (RM, abbreviated)
- **Tooltip**: Shows formatted RM amount per segment
- **Labels** (All mode only): Invoice count displayed to the right of each bar
- **Legend** (stacked modes only): Shows agent or type names

**Data source**: `ar_invoice.Outstanding`, `ar_invoice.DueDate` (MYT-adjusted), joined with `debtor` for SalesAgent/DebtorType. Only non-cancelled invoices with `Outstanding > 0`.

### 5.4 Credit Utilization Distribution

| Property | Value |
|----------|-------|
| **Title** | "Credit Utilization Distribution" |
| **Type** | Donut (pie) chart with center label |
| **Scope** | Snapshot (not date-filtered) |

**Categories**:

| Category | Condition | Color |
|----------|-----------|-------|
| Within Limit (< 80%) | Utilization < 80% | Green |
| Near Limit (>= 80%) | 80% <= utilization <= 100% | Yellow |
| Over Limit (> 100%) | Utilization > 100% | Red |
| No Limit Set | `debtor.CreditLimit` is NULL or 0 | Gray |

- **Metric shown**: `customer_count` per category (number of customers)
- **Center label**: Total number of customers that have credit limits set (excludes "No Limit Set")
- **Below chart**: Legend grid showing each category with its color swatch and customer count
- **Tooltip**: "{N} customers" per category

**Utilization calculation**: For each active debtor, utilization % = sum of `ar_invoice.Outstanding` (non-cancelled, > 0) / `debtor.CreditLimit` * 100. Customers with no credit limit or CreditLimit = 0 fall into "No Limit Set".

---

## 6. Tables

### 6.1 Customer Credit Health Table

| Property | Value |
|----------|-------|
| **Title** | "Customer Credit Health" |
| **Subtitle** | "Overdue calculated as of {today's date}" |
| **Scope** | Snapshot (not date-filtered) -- preceded by a separator noting this |
| **Page size** | 20 rows per page |
| **Default sort** | `total_outstanding` descending |

**Header controls**:

| Control | Behavior |
|---------|----------|
| **Search** | Text input ("Search customer..."). Filters by debtor code or company name (case-insensitive substring match). Resets to page 1 on change. |
| **Export CSV** | Button that downloads the current page's data as `customer-credit-health-v2.csv` |

**Columns** (all sortable by clicking the header):

| Column Header | Field | Alignment | Format / Notes |
|---------------|-------|-----------|----------------|
| Code | `debtor.DebtorCode` | Left | Monospace, small text |
| Name | `debtor.CompanyName` | Left | Truncated at 200px max width |
| Type | `debtor.DebtorType` | Left | Displayed as a pill/badge |
| Agent | `debtor.SalesAgent` | Left | Small text |
| Credit Limit | `debtor.CreditLimit` | Right | Formatted as RM; shows "--" if 0 |
| Outstanding | Sum of `ar_invoice.Outstanding` | Right | Formatted as RM, bold |
| Credit Util | Outstanding / CreditLimit * 100 | Right | Progress bar + percentage. Bar color: green (< 80%), yellow (>= 80%), red (> 100%). Shows "--" if no credit limit. |
| Aging Count | Count of overdue invoices | Right | Number; red text if > 0 |
| Oldest Due | Max overdue days | Left | Displayed as "{N}d" if > 0, else "--". Red bold text if overdue. |
| Score | Credit score (0-100) | Right | Numeric, bold |
| Risk | Risk tier | Left | Color-coded pill: green for "Low", yellow for "Moderate", red for "High" |

**Sorting behavior**: Clicking a column header toggles sort. Text columns default to ascending on first click; numeric columns default to descending. Sorting resets to page 1.

**Pagination**: Previous/Next buttons at the bottom. Shows "Showing X-Y of Z customers".

**Row click**: Opens the Customer Profile Modal for the clicked customer, pre-selecting the "payment" tab. The modal receives the customer's `debtor_code` and `company_name`.

---

## 7. Credit Scoring Algorithm

The dashboard uses a configurable **5-factor weighted credit score model** to assess each customer's credit risk. Scores range from 0 (worst) to 100 (best).

### 7.1 Five Factors

Each factor produces a component score from 0 to 100, which is then weighted according to configurable weights that must sum to 100.

#### Factor 1: Credit Utilization (default weight: 35%)

Measures how much of the customer's credit limit is being used.

- **Input**: `utilization_pct` = total outstanding / `debtor.CreditLimit` * 100
- **If no credit limit set**: Returns the neutral score (configurable, default 0)

| Utilization % | Component Score |
|--------------|----------------|
| <= 50% | 90 - 100 (linear interpolation: lower utilization = higher score) |
| 51% - 80% | 60 - 89 (linear) |
| 81% - 100% | 30 - 59 (linear) |
| > 100% | 0 - 29 (linearly decreasing, capped at 200% utilization giving 0) |

#### Factor 2: Overdue Days (default weight: 25%)

Measures the age of the oldest overdue invoice.

- **Input**: Days between the reference date and the earliest overdue `ar_invoice.DueDate` (MYT-adjusted) for outstanding invoices

| Oldest Overdue Days | Component Score |
|--------------------|----------------|
| 0 (nothing overdue) | 100 |
| 1 - 30 | 80 |
| 31 - 60 | 60 |
| 61 - 90 | 40 |
| 91 - 120 | 20 |
| > 120 | 0 |

#### Factor 3: Payment Consistency (default weight: 15%)

Measures how regularly the customer makes payments relative to months they were invoiced.

- **Input**: `ratio` = distinct months with payments / distinct months with invoices, over the last 12 months
- **Data source**: `ar_payment.DocDate` (months with payment) vs `ar_invoice.DocDate` (months with invoices), both MYT-adjusted, non-cancelled, within 12 months of the reference date
- **If no invoices in the lookback period**: Returns the neutral score

| Consistency Ratio | Component Score |
|-------------------|----------------|
| >= 0.9 | 100 |
| 0.7 - 0.89 | 75 |
| 0.5 - 0.69 | 50 |
| < 0.5 | 25 |

#### Factor 4: Timeliness (default weight: 15%)

Measures average lateness of payments.

- **Input**: Average of (`ar_payment.DocDate` - `ar_invoice.DueDate`) across all payment knock-offs in the last 12 months, using `ar_payment_knock_off` to link payments to invoices (where `KnockOffDocType = 'RI'`)
- **If no payment history**: Returns the neutral score

| Avg Days Late | Component Score |
|---------------|----------------|
| <= 0 (early/on-time) | 100 |
| 1 - 7 | 80 |
| 8 - 14 | 60 |
| 15 - 30 | 40 |
| 31 - 60 | 20 |
| > 60 | 0 |

#### Factor 5: Breach (default weight: 10%)

Binary check for whether the customer has exceeded their overdue/credit limit.

- **Logic**: If `debtor.OverdueLimit > 0`, breach = total outstanding > OverdueLimit. Otherwise, if the customer has a credit limit, breach = total outstanding > CreditLimit. If neither limit exists, no breach.
- **Component score**: 0 if breached, 100 if not breached.

### 7.2 Composite Score Calculation

```
score = round(
    (utilization_weight / 100) * utilization_component +
    (overdueDays_weight / 100) * overdue_component +
    (paymentConsistency_weight / 100) * consistency_component +
    (timeliness_weight / 100) * timeliness_component +
    (breach_weight / 100) * breach_component
)
```

### 7.3 Risk Tiers

The composite score maps to a risk tier using configurable thresholds:

| Tier | Default Threshold | Color |
|------|-------------------|-------|
| **Low** | Score >= 85 | Green |
| **Moderate** | Score >= 65 | Yellow |
| **High** | Score < 65 | Red |

*(Note: the defaults are Low >= 85, Moderate >= 65, High < 65. But these thresholds are stored as `low: 85`, `moderate: 65`, `high: 35` -- the "high" threshold value itself is not used as a boundary; any score below `moderate` is classified as High.)*

### 7.4 Configurable Settings

All scoring parameters are stored in a settings file and can be updated via the Settings API:

| Setting | Default | Constraint |
|---------|---------|------------|
| `creditScoreWeights.utilization` | 35 | All 5 weights must sum to 100 |
| `creditScoreWeights.overdueDays` | 25 | |
| `creditScoreWeights.paymentConsistency` | 15 | |
| `creditScoreWeights.timeliness` | 15 | |
| `creditScoreWeights.breach` | 10 | |
| `riskThresholds.low` | 85 | Must be > moderate |
| `riskThresholds.moderate` | 65 | Must be > high |
| `riskThresholds.high` | 35 | Must be > 0 |
| `neutralScore` | *(not set; falls back to 0)* | 0-100. Used when a factor has no data (e.g., no credit limit, no payment history). |

---

## 8. API Contracts

All endpoints return JSON. Dates in query parameters use `YYYY-MM-DD` format. Month parameters use `YYYY-MM` format.

### 8.1 GET `/api/payment/v2/date-bounds`

Returns the earliest and latest invoice dates in the database.

**Parameters**: None

**Response**:
```
{
  "min_date": "2022-01-15",
  "max_date": "2025-12-31"
}
```

**Data source**: `MIN(DATE(ar_invoice.DocDate, '+8 hours'))` and `MAX(DATE(ar_invoice.DocDate, '+8 hours'))` where `Cancelled = 'F'`.

---

### 8.2 GET `/api/payment/v2/kpis`

Returns the six KPI values.

**Parameters**:

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | Yes | Period start (YYYY-MM-DD) |
| `end_date` | Yes | Period end (YYYY-MM-DD) |

**Response**:
```
{
  "total_outstanding": 1234567.89,
  "overdue_customers": 42,
  "overdue_amount": 456789.01,
  "overdue_pct": 37.0,
  "dso": 45.2,
  "collection_rate": 85.3,
  "credit_limit_breaches": 5,
  "avg_monthly_collection": 234567.89
}
```

---

### 8.3 GET `/api/payment/aging`

Returns aging bucket totals (snapshot).

**Parameters** (all optional):

| Param | Description |
|-------|-------------|
| `debtor_type` | Filter by debtor type (repeatable) |
| `agent` | Filter by sales agent (repeatable) |
| `customer` | Filter by customer code |
| `term` | Filter by payment term (repeatable) |

**Response**: Array of objects:
```
[
  { "bucket": "Not Yet Due", "invoice_count": 120, "total_outstanding": 500000 },
  { "bucket": "1-30 Days", "invoice_count": 80, "total_outstanding": 300000 },
  ...
]
```

---

### 8.4 GET `/api/payment/aging-by-dimension`

Returns aging buckets grouped by a dimension (snapshot).

**Parameters**:

| Param | Required | Description |
|-------|----------|-------------|
| `group_by` | Yes | Either `"agent"` (group by `debtor.SalesAgent`) or `"type"` (group by `debtor.DebtorType`) |

**Response**: Array of objects:
```
[
  { "bucket": "Not Yet Due", "dimension": "Agent A", "invoice_count": 30, "total_outstanding": 150000 },
  ...
]
```

---

### 8.5 GET `/api/payment/collection-trend`

Returns monthly invoiced and collected amounts.

**Parameters**:

| Param | Required | Description |
|-------|----------|-------------|
| `start_month` | No | Start month (YYYY-MM). Defaults to 12 months before reference date. |
| `end_month` | No | End month (YYYY-MM). Defaults to reference date's month. |

**Response**: Array of objects:
```
[
  { "month": "2025-01", "total_collected": 250000, "payment_count": 45, "total_invoiced": 300000 },
  ...
]
```

---

### 8.6 GET `/api/payment/v2/dso-trend`

Returns monthly DSO values.

**Parameters**:

| Param | Required | Description |
|-------|----------|-------------|
| `start_date` | Yes | Period start (YYYY-MM-DD) |
| `end_date` | Yes | Period end (YYYY-MM-DD) |

**Response**: Array of objects:
```
[
  { "month": "2025-01", "dso": 42.5, "ar_outstanding": 1200000, "credit_sales": 850000 },
  ...
]
```

---

### 8.7 GET `/api/payment/v2/credit-utilization`

Returns credit utilization distribution (snapshot).

**Parameters**: None

**Response**: Array of objects:
```
[
  { "category": "Within Limit", "customer_count": 150, "total_outstanding": 800000 },
  { "category": "Near Limit", "customer_count": 25, "total_outstanding": 300000 },
  { "category": "Over Limit", "customer_count": 10, "total_outstanding": 200000 },
  { "category": "No Limit Set", "customer_count": 50, "total_outstanding": 100000 }
]
```

---

### 8.8 GET `/api/payment/v2/credit-health`

Returns the paginated Customer Credit Health table data (snapshot).

**Parameters**:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `sort` | No | `total_outstanding` | Column to sort by. Valid values: `debtor_code`, `company_name`, `debtor_type`, `sales_agent`, `credit_limit`, `total_outstanding`, `max_overdue_days`, `aging_count`, `utilization_pct`, `credit_score`, `risk_tier` |
| `order` | No | `desc` | Sort direction: `asc` or `desc` |
| `page` | No | `1` | Page number (1-based) |
| `page_size` | No | `20` | Rows per page |
| `search` | No | `""` | Search string (filters by debtor code or company name, case-insensitive) |

**Response**:
```
{
  "total": 706,
  "rows": [
    {
      "debtor_code": "300-A001",
      "company_name": "Example Sdn Bhd",
      "debtor_type": "Chain Store",
      "sales_agent": "Agent A",
      "credit_limit": 50000,
      "total_outstanding": 48000,
      "oldest_due": "2025-08-15",
      "max_overdue_days": 45,
      "aging_count": 3,
      "utilization_pct": 96.0,
      "credit_score": 52,
      "risk_tier": "High"
    },
    ...
  ]
}
```

---

### 8.9 GET `/api/payment/customer-invoices`

Returns outstanding invoices for a specific customer.

**Parameters**:

| Param | Required | Description |
|-------|----------|-------------|
| `debtor_code` | Yes | The customer's debtor code |

**Response**: Array of invoice objects (structure depends on V1 queries implementation).

---

### 8.10 GET `/api/payment/customer-profile`

Returns profile and credit health data for a single customer.

**Parameters**:

| Param | Required | Description |
|-------|----------|-------------|
| `debtor_code` | Yes | The customer's debtor code |

**Response**:
```
{
  "display_term": "30 Days",
  "is_active": true,
  "debtor_type": "Chain Store",
  "sales_agent": "Agent A",
  "avg_payment_days": 35,
  "credit_limit": 50000,
  "total_outstanding": 48000,
  "utilization_pct": 96.0,
  "aging_count": 3,
  "oldest_due": "2025-08-15",
  "max_overdue_days": 45,
  "credit_score": 52,
  "risk_tier": "High"
}
```

`avg_payment_days` is the average number of days between invoice date and payment date across paid invoices in the last 12 months (using `ar_payment_knock_off` to link `ar_payment` to `ar_invoice`).

---

### 8.11 GET/POST `/api/payment/settings`

**GET**: Returns both V1 and V2 settings. The V2 settings are nested under a `v2` key.

**POST**: Saves settings. If the request body contains a `v2` key, saves V2 settings. Otherwise saves V1 settings.

**Validation (V2)**:
- All 5 credit score weights must sum to exactly 100.
- Risk thresholds must be in descending order: low > moderate > high.

---

## 9. Data Tables Referenced

| Table | Key Columns Used |
|-------|-----------------|
| `ar_invoice` | `DocDate`, `DueDate`, `Outstanding`, `LocalNetTotal`, `DebtorCode`, `Cancelled`, `DocKey` |
| `ar_payment` | `DocDate`, `LocalPaymentAmt`, `DebtorCode`, `Cancelled`, `DocKey` |
| `ar_payment_knock_off` | `DocKey`, `KnockOffDocKey`, `KnockOffDocType` |
| `ar_cn` | `DocDate`, `LocalNetTotal`, `Cancelled` |
| `ar_refund` | `DocDate`, `LocalPaymentAmt`, `Cancelled` |
| `debtor` | `DebtorCode`, `CompanyName`, `DebtorType`, `SalesAgent`, `CreditLimit`, `OverdueLimit`, `IsActive`, `DisplayTerm` |

All `DocDate` and `DueDate` fields are stored in UTC and adjusted to MYT by adding 8 hours before any date grouping or comparison.
