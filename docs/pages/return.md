# Credit Note / Return / Refund Dashboard

> **URL path:** `/return`
>
> **Page title:** Credit Note / Return / Refund
>
> **Description:** Monitors all credit notes, product returns, and refunds to ensure accurate financial reconciliation.

---

## 1. Purpose & User Goals

This page gives finance staff a single view of every credit note with `CNType = 'RETURN'` issued against customers. It answers:

- **How much** has been returned in total and what share of sales does that represent?
- **How much** of the returned value has been reconciled (knocked off against invoices or refunded in cash/cheque) versus still outstanding?
- **Which customers** generate the most returns and which still have unresolved balances?
- **Which products** are returned most often or carry the highest return cost?
- **How are returns trending** month-over-month, and is the unresolved backlog growing or shrinking?
- **How old** are the unresolved returns (aging analysis)?

---

## 2. Page Layout

The page is a **single scrollable view** (no tabs). Sections appear in top-to-bottom order:

| Order | Section | Filtered by date range? |
|-------|---------|------------------------|
| 1 | Date Range Filter | n/a (the filter itself) |
| 2 | KPI Cards (5 cards in a row) | Yes |
| 3 | Settlement Breakdown (left, ~35% width) + Aging of Unresolved Returns (right, ~65% width) | Settlement: Yes / Aging: **No** (all-time) |
| 4 | Product Returns Bar Chart | Yes |
| 5 | Monthly Return Trend (area chart) | Yes |
| 6 | Visual separator with note: _"All return records -- not filtered by date range above"_ | n/a |
| 7 | Customer Returns Table | **No** (shows all-time data) |

Maximum content width is 1600 px, centered horizontally with padding.

---

## 3. Filters

### 3.1 Date Range

| Control | Details |
|---------|---------|
| **Start Date** | Date picker. URL query parameter: `start`. |
| **End Date** | Date picker. URL query parameter: `end`. |
| **Default range** | 12 months inclusive ending at the last month that has data. Computed as: start = first day of month 11 months before the max data date; end = last day of the month containing the max data date. |
| **Bounds** | The earliest and latest credit note dates in the database are fetched to constrain the pickers. |

Filter values are persisted in the browser URL as `?start=YYYY-MM-DD&end=YYYY-MM-DD`. Changing either date immediately re-fetches all date-filtered sections.

**Important:** The Customer Returns table and the Aging chart are **not** affected by the date range filter. This is called out with a visual separator line.

---

## 4. KPI Cards

Five cards displayed in a single row (stacks to one column on small screens).

### 4.1 Total Returns

| Property | Value |
|----------|-------|
| **Label** | TOTAL RETURNS |
| **Primary value** | Sum of `arcn.LocalNetTotal` for all return credit notes in the date range, formatted as MYR currency. |
| **Subtitle** | `"{count} return credit notes"` where count is the number of matching records. |
| **Data source** | `arcn` table, filtered: `(Cancelled = 'F' OR Cancelled IS NULL) AND CNType = 'RETURN'`, date-filtered on `arcn.DocDate` (+8h UTC offset) within start/end range. |

### 4.2 Reconciled

| Property | Value |
|----------|-------|
| **Label** | RECONCILED |
| **Primary value** | Sum of `arcn.KnockOffAmt` + sum of `arcn.RefundAmt` across the date range, formatted as MYR. |
| **Value colour** | Green. |
| **Subtitle** | `"Knocked Off + Refunded = {pct}% of total"` where `pct = (knocked_off + refunded) / total_return_value * 100`. |

### 4.3 Unresolved

| Property | Value |
|----------|-------|
| **Label** | UNRESOLVED |
| **Primary value** | Sum of (`arcn.LocalNetTotal - KnockOffAmt - RefundAmt`) across the date range, formatted as MYR. |
| **Value colour** | Red if amount > 0; green if zero. |
| **Subtitle** | `"{pct}% of total -- {partial} partial + {outstanding} outstanding"` |
| **Info tooltip** | Hoverable icon reveals the reconciliation formula and a colour legend: |
| | **Formula:** `Unresolved = NetTotal - KnockOffAmt - RefundAmt` |
| | Green dot = 0 (Settled) |
| | Amber dot = > 0 and < Total (Partial) |
| | Red dot = equals Total (Outstanding) |

**Classification logic:**

| Status | Condition |
|--------|-----------|
| Settled (reconciled) | `KnockOffAmt + RefundAmt >= LocalNetTotal` |
| Partial | `KnockOffAmt + RefundAmt > 0` AND `< LocalNetTotal` |
| Outstanding | `KnockOffAmt + RefundAmt = 0` |

### 4.4 Return %

| Property | Value |
|----------|-------|
| **Label** | RETURN % |
| **Primary value** | `return_rate_pct` formatted as `"{value}%"`. |
| **Calculation** | `total_return_value / total_sales * 100` where `total_sales` = sum of `ar_invoice.LocalNetTotal` (non-cancelled) in the same date range. |
| **Value colour** | Green if <= 2%, amber if > 2% and <= 5%, red if > 5%. |
| **Subtitle** | `"return value / total sales"` |

### 4.5 Return Records

| Property | Value |
|----------|-------|
| **Label** | RETURN RECORDS |
| **Primary value** | Count of return credit notes in the date range. |
| **Subtitle** | `"total return credit notes in period"` |

---

## 5. Charts

### 5.1 Settlement Breakdown

| Property | Value |
|----------|-------|
| **Title** | Settlement Breakdown |
| **Type** | Three horizontal progress bars (stacked vertically). |
| **Filtered by date range?** | Yes |

Each bar shows:

| Bar | Label | Colour | Value |
|-----|-------|--------|-------|
| 1 | Knocked Off (against invoices) | Green | `arcn.KnockOffAmt` summed, with percentage of total return value |
| 2 | Refunded (cash/cheque) | Blue | `arcn.RefundAmt` summed, with percentage |
| 3 | Unresolved | Red | `LocalNetTotal - KnockOffAmt - RefundAmt` summed, with percentage |

Each bar displays: label on the left, `"RM {amount} ({pct}%)"` on the right, filled proportionally to the percentage. Bars are capped at 100% width.

### 5.2 Aging of Unresolved Returns

| Property | Value |
|----------|-------|
| **Title** | Aging of Unresolved Returns |
| **Type** | Horizontal bar chart (bars extend to the right). |
| **Filtered by date range?** | **No** -- shows all-time unresolved records. |
| **Y-axis** | Age bucket (category). |
| **X-axis** | Amount in MYR. |

**Age buckets** (based on days since `arcn.DocDate` +8h vs today):

| Bucket | Colour | Day range |
|--------|--------|-----------|
| 0-30 days | Green (#10B981) | 0 to 30 |
| 31-60 days | Amber (#F59E0B) | 31 to 60 |
| 61-90 days | Orange (#F97316) | 61 to 90 |
| 91-180 days | Red (#EF4444) | 91 to 180 |
| 180+ days | Dark red (#991B1B) | > 180 |

**Inclusion rule:** Only records where `LocalNetTotal - KnockOffAmt - RefundAmt > 0.01` (i.e., still has an unresolved balance). All five buckets are always displayed, even if count and amount are zero.

**Tooltip** on hover: shows bucket name, amount in MYR, and count of credit notes.

### 5.3 Product Returns Bar Chart

| Property | Value |
|----------|-------|
| **Title** | `"Top 10 Returns by {dimension}"` (dynamic based on selected dimension). |
| **Type** | Horizontal bar chart. |
| **Filtered by date range?** | Yes |

#### Dimension Toggle

Four toggle buttons to choose the grouping dimension:

| Key | Label | Groups by |
|-----|-------|-----------|
| `item` | All | `cndtl.ItemCode` + `cndtl.Description` (individual product SKU) |
| `fruit` | Fruit | `item.FruitName` (fruit type, e.g., "Apple", "Orange"). Excludes item codes starting with `ZZ-ZZ-` or `XX-ZZ-`. Falls back to "OTHERS" if null. |
| `variant` | Variant | `item.FruitName -- item.FruitVariant` (e.g., "Apple -- Fuji"). Same exclusion rules as Fruit. |
| `country` | Country | `item.FruitCountry` (country of origin). Falls back to "(Unknown)" if null. |

#### Metric Toggle

Two toggle buttons to choose what the bar length represents:

| Key | Label | Bar data key | Bar colour |
|-----|-------|-------------|------------|
| `frequency` | Frequency | `cn_count` (distinct credit note count) | Indigo (#6366F1) |
| `value` | Value (RM) | `total_value` (sum of `cndtl.LocalSubTotal`) | Red (#dc2626) |

Results are limited to the top 10 ranked by the chosen metric, descending.

Items with code starting with `ZZ-ZZ-ZBKT` are always excluded (basket/container items).

**Tooltip** on hover shows the full product name plus: CN Count, Total Value (RM), Total Qty, Goods Returned qty, Credit Only qty.

**Data source tables:** `cndtl` (credit note detail lines) joined to `cn` (credit note header, filtered by `CNType = 'RETURN'` and not cancelled), left-joined to `item` for fruit/variant/country metadata.

**Goods return classification per detail line:**
- `cndtl.GoodsReturn = 'T'` -- goods were physically returned.
- `cndtl.GoodsReturn = 'F'` or null -- credit-only (no physical return).

### 5.4 Monthly Return Trend

| Property | Value |
|----------|-------|
| **Title** | Monthly Return Trend |
| **Subtitle** | `"Return value vs unresolved amount over time"` |
| **Type** | Stacked area chart with two series. |
| **Filtered by date range?** | Yes |
| **X-axis** | Month formatted as `MM/YY` (derived from `strftime('%Y-%m', arcn.DocDate, '+8 hours')`). |
| **Y-axis** | Amount in MYR. |

**Series:**

| Data key | Legend label | Stroke colour | Fill colour (15% opacity) |
|----------|-------------|---------------|---------------------------|
| `return_value` | Return Value | Indigo (#6366F1) | Indigo |
| `unresolved` | Unresolved | Red (#EF4444) | Red |

**Tooltip** on hover shows: `"Month: {YYYY-MM}"`, Return Value in MYR, Unresolved in MYR.

---

## 6. Tables

### 6.1 Customer Returns Table

| Property | Value |
|----------|-------|
| **Title** | Customer Returns |
| **Subtitle** | `"{count} customers -- Click a row to view profile"` |
| **Filtered by date range?** | **No** -- displays all-time return data for every customer. |
| **Pagination** | 20 rows per page. Prev/Next buttons. Shows `"Showing X-Y of Z"` and `"Page N of M"`. |
| **Default sort** | `total_return_value` descending. |

**Columns:**

| # | Header | Data field | Alignment | Format / behaviour |
|---|--------|------------|-----------|-------------------|
| 1 | Customer | `debtor.CompanyName` (falls back to `arcn.DebtorCode`) | Left | Truncated at 220 px with full name in hover tooltip. |
| 2 | Returns | `return_count` | Right | Integer count. |
| 3 | Total Value | `total_return_value` | Right | MYR currency. |
| 4 | Knocked Off | `total_knocked_off` | Right | MYR currency. |
| 5 | Refunded | `total_refunded` | Right | MYR currency in blue if > 0; em-dash `"--"` if zero. |
| 6 | Unresolved | `unresolved` | Right | 3-state display (see below). |

**Unresolved column 3-state display:**

| Condition | Display |
|-----------|---------|
| `unresolved <= 0.01` | Green text: `"Settled"` |
| `unresolved > 0.01` and customer has any knock-off or refund amount | Amber text: MYR amount (partial settlement) |
| `unresolved > 0.01` and customer has zero knock-off and zero refund | Red text: MYR amount (fully outstanding) |

**Sorting:** All six columns are sortable. Click a column header to sort; click again to reverse direction. Text columns default to ascending on first click; numeric columns default to descending.

**Row click interaction:** Clicking any row opens a **Customer Profile Modal** for that customer, pre-set to the "returns" tab. The modal receives the customer's `debtor_code` and `company_name`.

---

## 7. API Contracts

All endpoints are under the base path `/api/return/credit-v2/`. All dates use the format `YYYY-MM-DD`. All monetary values are in MYR. Times are stored as UTC in the database; a +8 hour offset is applied before any date grouping or filtering to convert to Malaysia Time (MYT).

The core filter applied to all return queries is: `arcn.Cancelled = 'F' (or NULL) AND arcn.CNType = 'RETURN'`.

---

### 7.1 GET `/api/return/credit-v2/date-bounds`

Returns the earliest and latest credit note dates available in the database. Used to set date-picker bounds and compute the default 12-month range.

**Query parameters:** None.

**Response:**

```json
{
  "min_date": "2022-01-05",
  "max_date": "2025-11-30"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `min_date` | string | Earliest `arcn.DocDate` (+8h) among all return credit notes. |
| `max_date` | string | Latest `arcn.DocDate` (+8h) among all return credit notes. |

---

### 7.2 GET `/api/return/credit-v2/overview`

Returns aggregate KPI metrics for the selected date range.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `start_date` | No | 12 months before max date | Start of range (inclusive). |
| `end_date` | No | End of max-date month | End of range (inclusive). |

**Response:**

```json
{
  "total_return_value": 125000.50,
  "return_count": 342,
  "total_knocked_off": 80000.00,
  "total_refunded": 15000.00,
  "total_unresolved": 30000.50,
  "reconciled_count": 250,
  "partial_count": 42,
  "outstanding_count": 50,
  "reconciliation_rate": 73.1,
  "total_sales": 2500000.00,
  "return_rate_pct": 5.0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_return_value` | number | Sum of `arcn.LocalNetTotal` for return credit notes in the range. |
| `return_count` | number | Count of return credit notes in the range. |
| `total_knocked_off` | number | Sum of `arcn.KnockOffAmt` (amount offset against invoices). |
| `total_refunded` | number | Sum of `arcn.RefundAmt` (cash/cheque refunds). |
| `total_unresolved` | number | `total_return_value - total_knocked_off - total_refunded`. |
| `reconciled_count` | number | Count where `KnockOffAmt + RefundAmt >= LocalNetTotal`. |
| `partial_count` | number | Count where settlement is between 0 and total (exclusive). |
| `outstanding_count` | number | Count where `KnockOffAmt + RefundAmt = 0`. |
| `reconciliation_rate` | number | `reconciled_count / return_count * 100`. |
| `total_sales` | number | Sum of `ar_invoice.LocalNetTotal` (non-cancelled) in the same date range. |
| `return_rate_pct` | number | `total_return_value / total_sales * 100`. |

---

### 7.3 GET `/api/return/credit-v2/aging`

Returns unresolved return amounts grouped into age buckets. **Not date-filtered** -- covers all-time unresolved records.

**Query parameters:** None.

**Response:**

```json
[
  { "bucket": "0-30 days", "count": 12, "amount": 5400.00 },
  { "bucket": "31-60 days", "count": 8, "amount": 3200.00 },
  { "bucket": "61-90 days", "count": 5, "amount": 2100.00 },
  { "bucket": "91-180 days", "count": 3, "amount": 1800.00 },
  { "bucket": "180+ days", "count": 15, "amount": 12000.00 }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `bucket` | string | One of: `"0-30 days"`, `"31-60 days"`, `"61-90 days"`, `"91-180 days"`, `"180+ days"`. |
| `count` | number | Number of unresolved credit notes in this age bucket. |
| `amount` | number | Sum of unresolved amounts (`LocalNetTotal - KnockOffAmt - RefundAmt`) in this bucket. |

Only records with unresolved amount > 0.01 are included.

---

### 7.4 GET `/api/return/credit-v2/trend`

Returns monthly aggregates for the trend chart.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `start_date` | No | 12 months before max date | Start of range. |
| `end_date` | No | End of max-date month | End of range. |

**Response:**

```json
[
  { "period": "2025-01", "return_value": 12000.00, "unresolved": 3400.00, "count": 28 },
  { "period": "2025-02", "return_value": 9800.00, "unresolved": 2100.00, "count": 22 }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Year-month in `YYYY-MM` format. |
| `return_value` | number | Sum of `arcn.LocalNetTotal` for that month. |
| `unresolved` | number | Sum of unresolved amounts for that month. |
| `count` | number | Number of return credit notes for that month. |

---

### 7.5 GET `/api/return/credit-v2/refunds`

Returns the settlement breakdown summary and a list of recent refund log entries.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `start_date` | No | 12 months before max date | Start of range. |
| `end_date` | No | End of max-date month | End of range. |
| `limit` | No | `20` | Maximum number of recent refund log entries to return. |

**Response:**

```json
{
  "summary": {
    "total_refunded": 15000.00,
    "refund_count": 45,
    "total_knocked_off": 80000.00,
    "total_return_value": 125000.50,
    "total_unresolved": 30000.50,
    "knock_off_pct": 64.0,
    "refund_pct": 12.0,
    "unresolved_pct": 24.0
  },
  "recent": [
    {
      "doc_no": "RF-00123",
      "doc_date": "2025-11-15",
      "debtor_code": "300-C001",
      "company_name": "ABC Fruits Sdn Bhd",
      "payment_amt": 500.00,
      "payment_method": "CHEQUE",
      "payment_by": "MAYBANK"
    }
  ]
}
```

**Summary fields:**

| Field | Type | Description |
|-------|------|-------------|
| `total_refunded` | number | Sum of `arcn.RefundAmt` in the range. |
| `refund_count` | number | Count of records in `ar_refund` (non-cancelled) in the range. |
| `total_knocked_off` | number | Sum of `arcn.KnockOffAmt` in the range. |
| `total_return_value` | number | Sum of `arcn.LocalNetTotal` in the range. |
| `total_unresolved` | number | Computed: `total_return_value - total_knocked_off - total_refunded`. |
| `knock_off_pct` | number | `total_knocked_off / total_return_value * 100`. |
| `refund_pct` | number | `total_refunded / total_return_value * 100`. |
| `unresolved_pct` | number | `total_unresolved / total_return_value * 100`. |

**Recent refund log fields:**

| Field | Type | Description |
|-------|------|-------------|
| `doc_no` | string | Refund document number from `ar_refund.DocNo`. |
| `doc_date` | string | Refund date from `ar_refund.DocDate` (+8h), `YYYY-MM-DD`. |
| `debtor_code` | string | Customer code from `ar_refund.DebtorCode`. |
| `company_name` | string | Customer name from `debtor.CompanyName`, falls back to debtor code. |
| `payment_amt` | number | Refund amount from `ar_refund.LocalPaymentAmt`. |
| `payment_method` | string or null | From `ar_refund_dtl.PaymentMethod` (first detail line). |
| `payment_by` | string or null | From `ar_refund_dtl.PaymentBy` (first detail line, e.g., bank name). |

---

### 7.6 GET `/api/return/credit-v2/products`

Returns the top 10 returned products grouped by a chosen dimension and ranked by a chosen metric.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `start_date` | No | 12 months before max date | Start of range. |
| `end_date` | No | End of max-date month | End of range. |
| `dimension` | No | `item` | One of: `item`, `fruit`, `variant`, `country`. |
| `metric` | No | `frequency` | One of: `frequency`, `value`. Determines sort order. |

**Response:**

```json
[
  {
    "name": "APPLE FUJI EXTRA FANCY 100-113 (BOX)",
    "cn_count": 45,
    "total_qty": 120,
    "total_value": 8500.00,
    "goods_returned_qty": 80,
    "credit_only_qty": 40
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display label; varies by dimension (item description, fruit name, fruit + variant, or country). |
| `cn_count` | number | Count of distinct credit notes containing this product/group. |
| `total_qty` | number | Sum of `cndtl.Qty` across all matching detail lines. |
| `total_value` | number | Sum of `cndtl.LocalSubTotal` across all matching detail lines. |
| `goods_returned_qty` | number | Sum of qty where `cndtl.GoodsReturn = 'T'` (physical goods returned). |
| `credit_only_qty` | number | Sum of qty where `cndtl.GoodsReturn = 'F'` or null (credit adjustment only). |

---

### 7.7 GET `/api/return/credit-v2/top-debtors`

Returns per-customer return aggregates. Behaviour depends on whether date parameters are provided.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `start_date` | No | (see below) | Start of range. |
| `end_date` | No | (see below) | End of range. |

- **If neither `start_date` nor `end_date` is provided:** returns **all-time** data (no date filter). This is the mode used by the main dashboard table.
- **If either is provided:** missing values fall back to the 12-month default.

**Response:**

```json
[
  {
    "debtor_code": "300-C001",
    "company_name": "ABC Fruits Sdn Bhd",
    "return_count": 28,
    "total_return_value": 15000.00,
    "total_knocked_off": 10000.00,
    "total_refunded": 2000.00,
    "unresolved": 3000.00,
    "outstanding_count": 5
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `debtor_code` | string | Customer account code from `arcn.DebtorCode`. |
| `company_name` | string | From `debtor.CompanyName`; falls back to debtor code if not found. |
| `return_count` | number | Count of return credit notes for this customer. |
| `total_return_value` | number | Sum of `arcn.LocalNetTotal`. |
| `total_knocked_off` | number | Sum of `arcn.KnockOffAmt`. |
| `total_refunded` | number | Sum of `arcn.RefundAmt`. |
| `unresolved` | number | `total_return_value - total_knocked_off - total_refunded`. |
| `outstanding_count` | number | Count of credit notes with zero settlement. |

Results are ordered by `total_return_value` descending.

---

### 7.8 GET `/api/return/credit-v2/customer-returns`

Returns individual credit note records for a specific customer.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `debtor_code` | **Yes** | -- | Customer account code. Returns 400 if missing. |
| `start_date` | No | (see below) | Start of range. |
| `end_date` | No | (see below) | End of range. |

- **If neither `start_date` nor `end_date` is provided:** returns **all-time** records for the customer.
- **If either is provided:** missing values fall back to the 12-month default.

**Response:**

```json
[
  {
    "doc_key": 12345,
    "doc_no": "CN-00456",
    "doc_date": "2025-10-20",
    "net_total": 1200.00,
    "knocked_off": 800.00,
    "refunded": 0.00,
    "unresolved": 400.00,
    "reason": "Damaged goods",
    "our_invoice_no": "IV-00789"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `doc_key` | number | Internal document key from `arcn.DocKey`. |
| `doc_no` | string | Credit note number from `arcn.DocNo`. |
| `doc_date` | string | Credit note date (+8h), `YYYY-MM-DD`. |
| `net_total` | number | `arcn.LocalNetTotal`. |
| `knocked_off` | number | `arcn.KnockOffAmt` (0 if null). |
| `refunded` | number | `arcn.RefundAmt` (0 if null). |
| `unresolved` | number | `net_total - knocked_off - refunded`. |
| `reason` | string | Return reason from `arcn.Reason`, falling back to `cn.Reason`, then empty string. |
| `our_invoice_no` | string | Related invoice number from `arcn.OurInvoiceNo`, or empty string. |

Results are ordered by `arcn.DocDate` descending (newest first).

---

### 7.9 GET `/api/return/credit-v2/customer-return-summary`

Returns aggregate return metrics for a single customer (used by the Customer Profile Modal).

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `debtor_code` | **Yes** | -- | Customer account code. Returns 400 if missing. |

**Response:**

```json
{
  "return_count": 28,
  "unresolved": 3000.00
}
```

| Field | Type | Description |
|-------|------|-------------|
| `return_count` | number | Total number of return credit notes for this customer (all time). |
| `unresolved` | number | Total unresolved amount (floored at 0). |

---

### 7.10 GET `/api/return/credit-v2/customer-return-trend`

Returns a 12-month return trend for a single customer (used by the Customer Profile Modal sparkline).

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `debtor_code` | **Yes** | -- | Customer account code. Returns 400 if missing. |

**Response:**

```json
[
  { "month": "2025-01", "count": 3, "value": 1500.00 },
  { "month": "2025-02", "count": 0, "value": 0.00 }
]
```

Always returns exactly 12 entries (one per month for the last 12 months from today). Months with no activity have `count: 0` and `value: 0`.

| Field | Type | Description |
|-------|------|-------------|
| `month` | string | Year-month in `YYYY-MM` format. |
| `count` | number | Number of return credit notes issued that month. |
| `value` | number | Sum of `arcn.LocalNetTotal` for that month. |

---

## Appendix: Database Tables Referenced

| Table | Alias | Role |
|-------|-------|------|
| `arcn` | `a` | AR Credit Note header -- the primary table for return records. Key columns: `DocKey`, `DocNo`, `DocDate`, `DebtorCode`, `LocalNetTotal`, `KnockOffAmt`, `RefundAmt`, `CNType`, `Cancelled`. |
| `cn` | `cn` | Credit Note source document. Linked via `arcn.SourceKey = cn.DocKey` when `arcn.SourceType = 'CN'`. Provides fallback `Reason`. |
| `cndtl` | `dtl` | Credit Note detail lines. Key columns: `DocKey`, `ItemCode`, `Description`, `Qty`, `LocalSubTotal`, `GoodsReturn`. |
| `debtor` | `d` | Customer master. Joined on `DebtorCode` to get `CompanyName`. |
| `item` | `i` | Item/product master (from sales schema). Provides `FruitName`, `FruitVariant`, `FruitCountry` for product dimension grouping. |
| `ar_invoice` | -- | Invoice header. Used only to compute `total_sales` for the Return % KPI. |
| `ar_refund` | `r` | Refund header. Used for refund count and the recent refund log. Key columns: `DocKey`, `DocNo`, `DocDate`, `DebtorCode`, `LocalPaymentAmt`, `Cancelled`. |
| `ar_refund_dtl` | `rd` | Refund detail. Provides `PaymentMethod` and `PaymentBy` for the refund log. |
