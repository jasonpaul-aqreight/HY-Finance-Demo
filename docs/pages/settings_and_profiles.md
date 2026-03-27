# Settings & Profile Modals

Cross-cutting features used across multiple dashboard pages. The **Payment Settings** page configures credit scoring parameters. The **Customer Profile Modal** and **Supplier Profile Modal** provide drill-down views when a user clicks a row in any dashboard table.

---

## 1. Payment Settings Page

### 1.1 Purpose

The Payment Settings page allows administrators to tune the credit scoring algorithm that evaluates customer payment risk. Every customer's credit score and risk tier on the Payment dashboard (and inside Customer Profile modals) is computed using these configurable weights and thresholds.

- **URL path**: `/payment/settings`
- **Access**: A back-arrow link in the page header returns the user to `/payment` (the Payment dashboard).

### 1.2 Settings Form

The form is divided into two cards: **Credit Score Weights** and **Risk Level Thresholds**. A sticky bottom bar shows a **Save** button, a **Reset to Defaults** button, and inline success/error feedback messages.

Validation rule: the Save button is disabled until the five credit score weights sum to exactly 100.

### 1.3 Credit Score Weight Configuration

Five factors contribute to the composite credit score (0-100). Their weights must sum to **100%**.

| # | Field Name | Key | Default | Input Type | Range | Description |
|---|-----------|-----|---------|------------|-------|-------------|
| 1 | Credit Utilization | `utilization` | **35%** | Number input (suffix %) | 0-100 | Outstanding balance as a percentage of credit limit. Lower utilization produces a higher sub-score. |
| 2 | Overdue Days | `overdueDays` | **25%** | Number input (suffix %) | 0-100 | Age (in days) of the oldest overdue invoice. Fewer overdue days produces a higher sub-score. |
| 3 | Payment Consistency | `paymentConsistency` | **15%** | Number input (suffix %) | 0-100 | Ratio of months with at least one payment to months with at least one invoice (last 12 months). More consistent payment produces a higher sub-score. |
| 4 | Payment Timeliness | `timeliness` | **15%** | Number input (suffix %) | 0-100 | Average days late across paid invoices (last 12 months). Paying on time or early produces a higher sub-score. |
| 5 | Overdue Limit Breach | `breach` | **10%** | Number input (suffix %) | 0-100 | Whether the customer's total outstanding exceeds their credit limit or overdue limit. No breach = 100; breach = 0. |

A live counter displays "Sum: N/100" beneath the weight fields. It turns red when the sum is not 100 and green when it is.

#### Sub-Score Computation Details

Each factor is first converted to a 0-100 sub-score before the weighted average is computed.

**Credit Utilization sub-score** (based on `ar_invoice.Outstanding / debtor.CreditLimit * 100`):

| Utilization % | Sub-Score Range |
|--------------|-----------------|
| No credit limit set | Neutral score (default 0) |
| 0-50% | 90-100 |
| 51-80% | 60-89 |
| 81-100% | 30-59 |
| >100% (over-limit) | 0-29 |

**Overdue Days sub-score** (based on oldest overdue invoice's days past due):

| Oldest Overdue Days | Sub-Score |
|--------------------|-----------|
| 0 (nothing overdue) | 100 |
| 1-30 | 80 |
| 31-60 | 60 |
| 61-90 | 40 |
| 91-120 | 20 |
| >120 | 0 |

**Payment Consistency sub-score** (ratio of months-with-payment to months-with-invoices, last 12 months):

| Ratio | Sub-Score |
|-------|-----------|
| No data | Neutral score (default 0) |
| >= 0.9 | 100 |
| 0.7 - 0.89 | 75 |
| 0.5 - 0.69 | 50 |
| < 0.5 | 25 |

**Payment Timeliness sub-score** (average days late across paid invoices, last 12 months):

| Avg Days Late | Sub-Score |
|--------------|-----------|
| No data | Neutral score (default 0) |
| <= 0 (early/on-time) | 100 |
| 1-7 | 80 |
| 8-14 | 60 |
| 15-30 | 40 |
| 31-60 | 20 |
| >60 | 0 |

**Overdue Limit Breach sub-score**:

| Condition | Sub-Score |
|-----------|-----------|
| Outstanding <= overdue limit (or no limit) | 100 |
| Outstanding > overdue limit | 0 |

The final credit score is:

```
score = round(
    (utilization_weight / 100) * utilization_sub_score +
    (overdueDays_weight / 100) * overdue_sub_score +
    (paymentConsistency_weight / 100) * consistency_sub_score +
    (timeliness_weight / 100) * timeliness_sub_score +
    (breach_weight / 100) * breach_sub_score
)
```

### 1.4 Risk Tier Thresholds

Three numeric thresholds partition the 0-100 credit score into three risk tiers:

| Field Label | Key | Default | Input Type | Range | Tier Assignment Rule |
|------------|-----|---------|------------|-------|----------------------|
| Low Risk (score >=) | `low` | **85** | Number input | 1-100 | Score >= this value => **Low** risk |
| Moderate (score >=) | `moderate` | **65** | Number input | 1-100 | Score >= this value (but < Low) => **Moderate** risk |
| High Risk (score <) | `high` | **35** | Number input | 0-100 | Score < Moderate threshold => **High** risk |

Resulting tier mapping with defaults:

| Score Range | Risk Tier | Visual Indicator |
|------------|-----------|-----------------|
| 85-100 | Low | Green badge |
| 65-84 | Moderate | Yellow badge |
| 0-64 | High | Red badge |

Validation: thresholds must be in descending order (Low > Moderate > High).

### 1.5 Persistence

- Settings are stored in a JSON file at `data/settings.json` (project root, outside the application directory).
- The file contains two versioned sections: `v1` (legacy) and `v2` (current).
- On **read**: if the file does not exist or is malformed, all defaults are returned. If only some fields are present, missing fields are filled with defaults. A migration path handles old flat-format files by wrapping them under `v1`.
- On **write**: server-side validation ensures weights sum to 100 and thresholds are in descending order. On success the file is overwritten. An in-memory cache is cleared on each write so the next read picks up fresh data.
- The **Reset to Defaults** button restores the form to factory defaults locally; the user must still click **Save** to persist.

---

## 2. Customer Profile Modal

### 2.1 Purpose

A full-screen dialog that provides a 360-degree view of a single customer: payment health, return history, and sales performance. It opens when a user **clicks a row** in any customer-facing dashboard table.

**Pages that trigger it** (via row click):

| Dashboard Page | Table | Default Tab | Extra Data Passed |
|---------------|-------|-------------|-------------------|
| Payment (`/payment`) | Customer Table | `payment` | -- |
| Return (`/return`) | Top Debtors Table | `returns` | -- |
| Sales (`/sales`) | Group-By Table (when dimension = customer) | `sold-items` | Start date, end date |
| Customer Margin (`/customer-margin`) | Customer Margin Table | `sold-items` | Start date, end date |

**Input parameters** (passed when opening):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| debtorCode | string | Yes | The customer's account code (debtor.DebtorCode) |
| companyName | string | Yes | Display name for the modal header |
| defaultTab | string | No | Which tab to show first: `payment`, `returns`, or `sold-items`. Default: `payment` |
| initialStartDate | string | No | Pre-fill date range for the Sold Items tab (YYYY-MM-DD) |
| initialEndDate | string | No | Pre-fill date range for the Sold Items tab (YYYY-MM-DD) |

### 2.2 Modal Header

The header section (non-scrolling) displays:

| Element | Source | Details |
|---------|--------|---------|
| Company Name | Passed as parameter | Large bold heading |
| Active/Inactive Badge | debtor.IsActive | Green "Active" or red "Inactive" pill |
| Entity Label | Static | "Customer" |
| Customer Code | Passed as parameter | Monospaced display of debtorCode |
| Debtor Type | debtor.DebtorType | e.g. "WHOLESALE", "RETAIL" |
| Sales Agent | debtor.SalesAgent | Agent assigned to the customer |

### 2.3 Summary KPI Panels

Below the header, three side-by-side panels summarize cross-domain metrics. Data is fetched from separate API endpoints when the modal opens.

#### Payment Panel (blue header)

| KPI | Source | Formatting |
|-----|--------|------------|
| Credit Limit | debtor.CreditLimit | RM currency; "None" if 0 |
| Outstanding | SUM of ar_invoice.Outstanding (where Outstanding > 0, Cancelled = 'F') | RM currency, orange text |
| Credit Utilization | Outstanding / CreditLimit * 100 | Percentage with color-coded progress bar (green <= 80%, amber 80-100%, red >100%) |
| Aging Count | Count of invoices past due date | Integer; red if > 0. Shows "(Oldest: N days)" suffix when overdue invoices exist |
| Credit Score | Computed via the 5-factor algorithm using current settings | "N / 100" format |
| Risk Tier | Derived from credit score via risk thresholds | Color-coded badge (Low/Moderate/High) |
| Payment Term | debtor.DisplayTerm | e.g. "Net 30" |
| Avg Payment Period | Average days between invoice date and payment date (last 12 months) | "N days" in blue; "(Last 12 Months)" suffix |

#### Returns Panel (amber header)

| KPI | Source | Formatting |
|-----|--------|------------|
| Return Count | COUNT of arcn records where CNType = 'RETURN', Cancelled = 'F' | Integer with "total" label |
| Unresolved | SUM(arcn.LocalNetTotal - arcn.KnockOffAmt - arcn.RefundAmt) | RM currency in red if > 0; green "Settled" if 0 |
| Return Trend | Monthly return counts for last 12 months | Line chart; green if trend is flat/declining, red if increasing |

#### Sales Performance Panel (green header)

| KPI | Source | Formatting |
|-----|--------|------------|
| Profit Margin | (Revenue - COGS) / Revenue * 100, from customer monthly data (last 12 months) | Percentage; green >= 20%, amber 10-19%, red < 10% |
| Period Revenue | SUM of monthly revenue (last 12 months) | RM currency in blue; "last 12m" suffix |
| Revenue Trend | Monthly revenue for last 12 months | Line chart in blue |

### 2.4 Payment Tab ("Pending Payment")

Displays a sortable table of all **outstanding invoices** for the customer.

**Data source**: ar_invoice table (WHERE Cancelled = 'F' AND Outstanding > 0 AND DebtorCode = ?), fetched via `/api/payment/customer-invoices`.

| Column | Field | Alignment | Formatting |
|--------|-------|-----------|------------|
| Invoice No. | ar_invoice.DocNo | Left | Monospaced |
| Invoice Date | ar_invoice.DocDate (MYT-adjusted) | Left | Date string |
| Due Date | ar_invoice.DueDate (MYT-adjusted) | Left | Date string |
| Total (RM) | ar_invoice.LocalNetTotal | Right | RM currency, 2 decimal places |
| Outstanding (RM) | ar_invoice.Outstanding | Right | RM currency, 2 decimal places |
| Days Overdue | Computed: today minus DueDate | Right | Red if > 0; green with "(not due)" suffix if <= 0 |

- **Default sort**: Days Overdue, descending (most overdue first).
- All columns are sortable by clicking the header.
- Empty state: "No outstanding invoices."

### 2.5 Return Tab ("Return Records")

Displays a sortable table of all credit notes of type RETURN for the customer.

**Data source**: arcn table (WHERE Cancelled = 'F' AND CNType = 'RETURN' AND DebtorCode = ?), fetched via `/api/return/credit-v2/customer-returns`.

| Column | Field | Alignment | Formatting |
|--------|-------|-----------|------------|
| Doc No | arcn.DocNo | Left | Monospaced |
| Date | arcn.DocDate (MYT-adjusted) | Left | Date string |
| Amount | arcn.LocalNetTotal | Right | RM currency |
| Knocked Off | arcn.KnockOffAmt | Right | RM currency; "--" if 0 |
| Refunded | arcn.RefundAmt | Right | RM currency in blue; "--" if 0 |
| Unresolved | LocalNetTotal - KnockOffAmt - RefundAmt | Right | Color-coded: green "Settled" if <= 0.01; amber if partially settled; red if no settlement at all |
| Reason | arcn.Description (or similar reason field) | Left | Truncated to 180px with tooltip for full text |

- **Default sort**: Date, descending (newest first).
- All columns are sortable.
- Empty state: "No return records."

### 2.6 Sold Items Tab

Displays a sortable table of all items sold to the customer in a configurable date range, with margin analysis.

**Data source**: Invoice/cash sale line items joined with stock items, fetched via a customer-products endpoint. Uses iv (invoices), cs (cash sales), cn (credit notes) detail lines joined to stock_item for item metadata.

| Column | Field | Alignment | Formatting |
|--------|-------|-----------|------------|
| Item Code | stock_item.ItemCode | Left | Monospaced, muted color |
| Description | stock_item.Description | Left | Truncated to 200px |
| Group | stock_item.ItemGroup | Left | "--" if empty |
| Qty Sold | SUM of line item quantities | Right | Locale-formatted integer |
| Revenue | SUM of line item selling totals | Right | RM currency |
| Cost | SUM of line item cost totals | Right | RM currency |
| Margin % | (Revenue - Cost) / Revenue * 100 | Right | Percentage with color coding |

- **Date range picker** at the top: start date and end date fields with preset shortcuts. Defaults to the dates passed when opening the modal, or `2025-01-01` to `2025-12-31` if none provided.
- **Default sort**: Revenue, descending.
- All columns are sortable.
- Empty state: "No sold items on record."

---

## 3. Supplier Profile Modal

### 3.1 Purpose

A full-screen dialog providing a detailed view of a single supplier: what items they supply, purchase price trends, and margin impact. Opens when a user **clicks a row** in the Supplier Margin dashboard table.

**Pages that trigger it**:

| Dashboard Page | Table | Extra Data Passed |
|---------------|-------|-------------------|
| Supplier Margin (`/supplier-margin`) | Supplier Table | Start date, end date, supplier metrics (attributed revenue, COGS, profit, margin %, items supplied) |

**Input parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| creditorCode | string | Yes | The supplier's account code (creditor.AccNo) |
| companyName | string | Yes | Display name for the modal header |
| initialStartDate | string | No | Pre-fill date range (YYYY-MM-DD) |
| initialEndDate | string | No | Pre-fill date range (YYYY-MM-DD) |
| supplierMetrics | object | No | Pre-computed period metrics passed from the parent table row (see below) |

The `supplierMetrics` object:

| Field | Type | Description |
|-------|------|-------------|
| attributed_revenue | number | Total revenue from items this supplier provides |
| attributed_cogs | number | Total purchase cost for items from this supplier |
| attributed_profit | number | Revenue minus COGS |
| margin_pct | number or null | Profit margin percentage |
| items_supplied | number | Count of distinct items purchased from this supplier |

### 3.2 Modal Header

| Element | Source | Details |
|---------|--------|---------|
| Company Name | Passed as parameter | Large bold heading |
| Active/Inactive Badge | creditor.IsActive | Green "Active" or red "Inactive" pill |
| Entity Label | Static | "Supplier" |
| Supplier Code | Passed as parameter | Monospaced display of creditorCode |

**Header KPI Cards** (period-independent, below the supplier info):

| KPI | Source | Details |
|-----|--------|---------|
| Items Supplied | supplierMetrics.items_supplied | Count of distinct item codes |
| Single Supplier Items | Computed server-side: items purchased from this supplier that have NO other supplier in the period | Count; displayed with a warning icon in amber. Highlights supply chain concentration risk. |

### 3.3 Purchase Items Tab

The sole tab in the supplier modal. Contains a date range picker, period-dependent KPI summary cards, a search bar, and a detailed items table.

#### Period KPI Cards

| KPI | Source | Formatting |
|-----|--------|------------|
| Revenue | supplierMetrics.attributed_revenue | RM currency |
| Total Spend | supplierMetrics.attributed_cogs | RM currency |
| Gross Profit | supplierMetrics.attributed_profit | RM currency |
| Margin | supplierMetrics.margin_pct | Percentage with color coding |

#### Items Table

**Data source**: Purchase invoice detail lines (pi + pidtl tables) joined with sales data, fetched via a supplier-items endpoint. Price trends fetched separately from a supplier-item-trends endpoint.

| Column | Field | Alignment | Formatting |
|--------|-------|-----------|------------|
| (Warning icon) | -- | Center | Amber warning triangle if item is a single-supplier item |
| Item Code | pidtl.ItemCode | Left | Monospaced |
| Description | stock_item.Description | Left | Truncated to 200px |
| Qty Purchased | SUM(pidtl.Qty) | Right | Locale-formatted number |
| Avg Purchase | SUM(pidtl.LocalSubTotal) / SUM(pidtl.Qty) | Right | RM currency, 2 decimal places, monospaced |
| Price Trend | Monthly average purchase prices over period | Left | Sparkline chart; green if price is stable/declining, red if increasing |
| Revenue | Revenue from selling this item | Right | RM currency, 2 decimal places, monospaced |
| Purchase Cost | COGS for this item | Right | RM currency, 2 decimal places, monospaced |
| Margin % | (Revenue - COGS) / Revenue * 100 | Right | Percentage with color coding |

- **Search bar**: Filters items by item code or description (case-insensitive substring match). Shows "N of M" count when active.
- **Date range picker**: Start and end date fields with preset shortcuts. Defaults to the dates passed when opening, or `2025-01-01` to `2025-12-31`.
- **Default sort**: Revenue, descending.
- All columns (except warning icon and price trend) are sortable.
- Single-supplier items are highlighted with a light amber background row.
- Empty state: "No purchase records." (or "No items match your search." when searching).

---

## 4. API Contracts

### 4.1 Payment Settings

**GET** `/api/payment/settings`

| Aspect | Detail |
|--------|--------|
| Parameters | None |
| Purpose | Retrieve all settings (V1 and V2) |
| Response | JSON object with V1 fields at root level plus a `v2` key containing V2 settings |

Response shape:
```
{
  // V1 fields (root level, legacy)
  creditScoreWeights: { timeliness, utilization, cnFrequency, aging },
  riskThresholds: { low, moderate, elevated },
  dsoBenchmark: number,
  lookbackMonths: number,
  neutralScore: number,

  // V2 fields (nested)
  v2: {
    creditScoreWeights: { utilization, overdueDays, paymentConsistency, timeliness, breach },
    riskThresholds: { low, moderate, high }
  }
}
```

**POST** `/api/payment/settings`

| Aspect | Detail |
|--------|--------|
| Content-Type | `application/json` |
| Purpose | Save settings |
| Body (V2) | `{ v2: { creditScoreWeights: {...}, riskThresholds: {...} } }` |
| Body (V1, legacy) | `{ creditScoreWeights: {...}, riskThresholds: {...}, dsoBenchmark, lookbackMonths, neutralScore }` |
| Success Response | `{ ok: true }` |
| Error Response | `{ error: "message" }` with status 400 |

Validation errors returned:
- "Credit score weights must sum to 100 (got N)"
- "Risk thresholds must be in descending order (Low > Moderate > High)"

---

### 4.2 Customer Profile

**GET** `/api/payment/customer-profile`

| Aspect | Detail |
|--------|--------|
| Parameters | `debtor_code` (required, query string) |
| Purpose | Return debtor master data plus computed credit health metrics for a single customer |

Response shape:
```
{
  display_term: string,          // e.g. "Net 30"
  is_active: boolean,
  debtor_type: string,           // e.g. "WHOLESALE"
  sales_agent: string,
  avg_payment_days: number|null, // average days to pay (last 12 months)
  credit_limit: number,
  total_outstanding: number,
  utilization_pct: number|null,  // outstanding / credit_limit * 100
  aging_count: number,           // count of overdue invoices
  oldest_due: string|null,       // earliest due date (YYYY-MM-DD)
  max_overdue_days: number,      // days since oldest overdue invoice's due date
  credit_score: number,          // 0-100 composite score
  risk_tier: string              // "Low" | "Moderate" | "High"
}
```

Data sources: debtor table (master data), ar_invoice table (outstanding invoices, aging), ar_payment detail (payment timeliness). Credit score is computed server-side using the saved V2 settings.

---

### 4.3 Customer Invoices

**GET** `/api/payment/customer-invoices`

| Aspect | Detail |
|--------|--------|
| Parameters | `debtor_code` (required, query string) |
| Purpose | Return all outstanding invoices for a customer (used by the Payment tab) |

Response shape (array):
```
[
  {
    doc_no: string,
    doc_date: string,         // YYYY-MM-DD (MYT)
    due_date: string,         // YYYY-MM-DD (MYT)
    local_net_total: number,  // invoice total in RM
    outstanding: number,      // remaining unpaid amount
    days_overdue: number      // positive = overdue, negative = not yet due
  },
  ...
]
```

Data source: ar_invoice (WHERE Cancelled = 'F' AND Outstanding > 0 AND DebtorCode = ?).

---

### 4.4 Customer Return Summary

**GET** `/api/return/credit-v2/customer-return-summary`

| Aspect | Detail |
|--------|--------|
| Parameters | `debtor_code` (required, query string) |
| Purpose | Aggregate return metrics for the profile modal's Returns panel |

Response shape:
```
{
  return_count: number,   // total credit notes of type RETURN
  unresolved: number      // RM value of unresolved returns (net_total - knocked_off - refunded)
}
```

Data source: arcn (WHERE Cancelled = 'F' AND CNType = 'RETURN' AND DebtorCode = ?).

---

### 4.5 Customer Return Trend

**GET** `/api/return/credit-v2/customer-return-trend`

| Aspect | Detail |
|--------|--------|
| Parameters | `debtor_code` (required, query string) |
| Purpose | Monthly return counts for the last 12 months (used for the trend chart in the Returns panel) |

Response shape (array of 12 entries, oldest first):
```
[
  {
    month: string,    // "YYYY-MM"
    count: number,    // number of return credit notes that month
    value: number     // total RM value of returns that month
  },
  ...
]
```

Data source: arcn (WHERE Cancelled = 'F' AND CNType = 'RETURN' AND DebtorCode = ?), grouped by month with zero-fill for months with no returns.

---

### 4.6 Customer Sales Summary

**GET** `/api/sales/customer-sales-summary`

| Aspect | Detail |
|--------|--------|
| Parameters | `debtor_code` (required), `start_date` (optional, default "2024-01-01"), `end_date` (optional, default "2025-12-31") -- all query string |
| Purpose | Sales breakdown and monthly trend for a customer in a date range |

Response shape:
```
{
  summary: {
    total_sales: number,      // net sales (invoices + cash sales - credit notes)
    invoice_sales: number,    // SUM of iv.NetTotal
    cash_sales: number,       // SUM of cs.NetTotal
    credit_notes: number,     // SUM of cn.NetTotal
    doc_count: number         // total document count
  },
  trend: [
    {
      month: string,            // "YYYY-MM"
      total_sales: number,
      invoice_sales: number,
      cash_sales: number,
      credit_notes: number
    },
    ...
  ]
}
```

Data sources: iv (invoices), cs (cash sales), cn (credit notes) -- all WHERE Cancelled = 'F' AND DebtorCode = ?, date-filtered.

---

### 4.7 Supplier Profile Summary

**GET** `/api/supplier-margin/margin/supplier-profile-summary`

| Aspect | Detail |
|--------|--------|
| Parameters | `creditor_code` (required), `start_date` (optional), `end_date` (optional) -- all query string. Dates default to the application's standard date range. |
| Purpose | Supplier active status and single-supplier item analysis |

Response shape:
```
{
  is_active: boolean,
  single_supplier_count: number,      // items only sourced from this supplier
  single_supplier_items: string[]     // array of ItemCode values
}
```

Data sources: creditor table (IsActive), pi + pidtl tables (purchase invoices and their detail lines). The endpoint identifies items purchased from this supplier, then checks which of those items have no other supplier in the same period.

---

### 4.8 Supplier Item Price Trends

**GET** `/api/supplier-margin/margin/supplier-item-trends`

| Aspect | Detail |
|--------|--------|
| Parameters | `creditor_code` (required), `start_date` (optional), `end_date` (optional) -- all query string. Dates default to the application's standard date range. |
| Purpose | Monthly average purchase prices per item for sparkline charts in the Purchase Items table |

Response shape:
```
{
  data: [
    {
      item_code: string,
      prices: number[]    // monthly average prices, oldest month first
    },
    ...
  ]
}
```

Data source: pi + pidtl (WHERE pi.Cancelled = 'F' AND pi.CreditorCode = ?). Average price per item per month = SUM(pidtl.LocalSubTotal) / SUM(pidtl.Qty).

---

## 5. Cross-Page Integration

### 5.1 Modal Usage Matrix

| Dashboard Page | URL | Modal Used | Trigger | Default Tab | Data Passed to Modal |
|---------------|-----|-----------|---------|-------------|---------------------|
| Payment | `/payment` | Customer Profile | Click row in Customer Table | `payment` | debtorCode, companyName |
| Return | `/return` | Customer Profile | Click row in Top Debtors Table | `returns` | debtorCode, companyName |
| Sales | `/sales` | Customer Profile | Click row in Group-By Table (customer dimension only) | `sold-items` | debtorCode, companyName, startDate, endDate |
| Customer Margin | `/customer-margin` | Customer Profile | Click row in Customer Margin Table | `sold-items` | debtorCode, companyName, startDate, endDate |
| Supplier Margin | `/supplier-margin` | Supplier Profile | Click row in Supplier Table | (single tab) | creditorCode, companyName, startDate, endDate, supplierMetrics |

### 5.2 Trigger Pattern

All modals follow the same interaction pattern:

1. **State variable**: The parent table maintains a selected-entity state (e.g. `selectedCustomer` or `profileSupplier`) that is `null` when no modal is open.
2. **Row click**: Clicking a table row sets the state to an object containing the entity's code and display name (plus optional date range and metrics).
3. **Modal renders**: The modal is conditionally rendered when the selected-entity state is non-null. It receives `open={true}` and the entity data as properties.
4. **Close**: The modal's `onClose` callback sets the state back to `null`, which unmounts the modal.
5. **Lazy data loading**: API calls inside the modal only fire when `open` is `true`, avoiding unnecessary network requests.

### 5.3 Settings Integration

The Payment Settings page is a standalone page, not a modal. It is linked from the Payment dashboard. Changes to credit score weights and risk thresholds take effect immediately for:

- The Customer Table on the Payment dashboard (credit scores are recomputed on each data fetch)
- The Customer Profile Modal's Payment panel (credit score and risk tier shown in the header)

No page reload is required after saving settings -- the next data fetch will use the updated values from the settings file.
