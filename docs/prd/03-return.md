# Returns

> Monitors all credit notes issued for product returns, tracks settlement status (knockoff, refunded, or unsettled), analyzes return patterns by product and customer, and highlights aging of unsettled balances.

---

## 1. Purpose & User Goals

The Returns page is the central view for tracking goods returned by customers and the financial impact of those returns. It answers:

- How much has been returned in total, and what percentage of sales does that represent?
- How much of the returned value has been settled (offset against invoices or refunded) versus still unsettled?
- Which products generate the most returns — by frequency or by cost?
- How are returns trending month over month, and is the unsettled backlog growing or shrinking?
- Which customers have the largest unsettled return balances?
- How old are the unsettled returns — are they recent or long-overdue?

This is the "return health" page — it helps management understand whether returns are under control, settlement processes are keeping up, and whether specific products or customers require attention.

---

## 2. Page Layout

The page is organized into **two distinct sections** with clear section headers. This separation reflects a fundamental data distinction: period metrics (filtered by date range) vs. accumulated snapshot metrics (current state regardless of when the return was created).

### Top-to-Bottom Section Order

```
┌─────────────────────────────────────────────────┐
│  Date Range Filter                               │
│  [Start] [End]  [3M] [6M] [12M] [YTD]           │
├─────────────────────────────────────────────────┤
│  ── Section 1: Return Trends (Date-Filtered) ──  │
│                                                  │
│  KPI Cards (4 cards)                             │
│  [Total Returns] [Return Rate] [Avg Return]      │
│  [Unsettled Returns]                             │
├─────────────────────────────────────────────────┤
│  ┌──────────────────┬──────────────────────┐     │
│  │ Settlement       │ Monthly Return       │     │
│  │ Breakdown        │ Trend                │     │
│  │ (3 progress bars)│ (area chart)         │     │
│  └──────────────────┴──────────────────────┘     │
├─────────────────────────────────────────────────┤
│  Top 10 Product Returns (horizontal bar chart)   │
│  [Dimension toggle] [Metric toggle]              │
├═════════════════════════════════════════════════┤
│  ── Section 2: Unsettled Returns (Snapshot) ──   │
│                                                  │
│  Aging of Unsettled Returns (horizontal bar)     │
├─────────────────────────────────────────────────┤
│  Customer Returns Table                          │
│  (sortable, searchable, filterable, exportable)  │
└─────────────────────────────────────────────────┘
```

### Responsive Behavior

| Breakpoint | KPI Cards | Layout |
|------------|-----------|--------|
| Mobile (<640px) | 1 per row | Single column, stacked vertically |
| Desktop (1280px+) | 4 per row | Settlement + Trend side by side; table full width |

Maximum content width: 1600px, horizontally centered.

---

## 3. Filters

### 3.1 Date Range Filter

Controls all metrics in Section 1 (Return Trends). Does **not** affect Section 2 (Unsettled Returns).

| Control | Details |
|---------|---------|
| **Start Date** | Month-year picker |
| **End Date** | Month-year picker |
| **Range Summary** | Text showing "MMM YYYY -- MMM YYYY (N months)" |
| **Default Range** | 12 months ending at the latest month with data |
| **Bounds** | Earliest and latest credit note dates from the database constrain the pickers |

**Preset Buttons:**

| Button | Behavior |
|--------|----------|
| 3M | Last 3 months from the latest available data |
| 6M | Last 6 months from the latest available data |
| 12M | Last 12 months from the latest available data |
| YTD | January 1 of the end year to the latest available data |

Presets calculate relative to the latest data date, not today's date.

### 3.2 Customer Table Filters (Section 2)

The Customer Returns Table has its own independent filters:

| Control | Details |
|---------|---------|
| **Status Filter** | Dropdown with three options: "Unsettled" (default), "Settled", "All Returned" |
| **Search** | Text input filtering by customer code or company name (case-insensitive) |

Both filters reset pagination to page 1 when changed.

---

## 4. KPI Cards

Four cards displayed in a responsive grid. All monetary values formatted as Malaysian Ringgit (RM).

### 4.1 Total Returns

- **Label:** "Total Returns"
- **Value:** Sum of all return credit note amounts in the date range
- **Format:** RM with thousands separator (e.g., "RM 1,130,242")
- **Subtitle:** "{N} return credit notes" — count of credit notes in the period

### 4.2 Settled

- **Label:** "Settled"
- **Value:** Sum of knockoff amounts + refunded amounts in the date range
- **Formula:** Knockoff + Refunded
- **Format:** RM with thousands separator
- **Value Color:** Green (positive — indicates settled)
- **Subtitle:** "Knockoff + Refunded = {N}% of total"
- **Percentage formula:** (Knockoff + Refunded) / Total Return Value x 100

### 4.3 Unsettled

- **Label:** "Unsettled"
- **Value:** Total return value minus settled amount in the date range
- **Formula:** Total Return Value -- Knockoff -- Refunded
- **Format:** RM with thousands separator
- **Value Color:** Red if amount > 0; green if zero (fully settled)
- **Subtitle:** "{N}% of total -- {X} partial + {Y} unsettled"
- **Help Tooltip:** Hoverable info icon reveals:
  - Formula: "Unsettled = NetTotal -- KnockOffAmt -- RefundAmt"
  - Color legend:
    - Green dot = 0 (Settled)
    - Amber dot = > 0 and < Total (Partial)
    - Red dot = equals Total (Unsettled)

**Settlement classification logic:**

| Status | Condition |
|--------|-----------|
| Settled | Knockoff + Refunded >= Return Amount |
| Partial | Knockoff + Refunded > 0 AND < Return Amount |
| Unsettled | Knockoff + Refunded = 0 |

### 4.4 Return %

- **Label:** "Return %"
- **Value:** Return value as a percentage of total sales in the same period
- **Formula:** Total Return Value / Total Sales x 100
- **Format:** "{N.N}%"
- **Value Color:** Green if <= 2%, amber if > 2% and <= 5%, red if > 5%
- **Subtitle:** "return value ÷ total sales"

**Interpretation guide:**
- Green (at or below 2%) — healthy range for a fresh produce distributor
- Amber (2% to 5%) — warrants investigation
- Red (above 5%) — serious issue requiring attention

---

## 5. Charts

### 5.1 Settlement Breakdown

| Property | Value |
|----------|-------|
| **Title** | Settlement Breakdown |
| **Type** | Three horizontal progress bars (stacked vertically) |
| **Location** | Left side of chart row (~35% width) |
| **Filtered by date range?** | Yes |

Three bars showing where the return money went:

| Bar | Label | Color | Data |
|-----|-------|-------|------|
| 1 | Knockoff (Offset Against Invoices) | Green | Amount + percentage of total return value |
| 2 | Refunded (cash/cheque) | Blue | Amount + percentage of total return value |
| 3 | Unsettled | Red | Amount + percentage of total return value |

Each bar displays: label on the left, "RM {amount} ({pct}%)" on the right, filled proportionally to the percentage. Bars are capped at 100% width.

### 5.2 Monthly Return Trend

| Property | Value |
|----------|-------|
| **Title** | Monthly Return Trend |
| **Type** | Stacked area chart with two series |
| **Location** | Right side of chart row (~65% width) |
| **Height** | 300px |
| **Filtered by date range?** | Yes |
| **X-axis** | Month (formatted as MM/YY, e.g., "01/25", "12/24") |
| **Y-axis** | Amount in RM |

**Series:**

| Series | Legend Label | Color | Fill Opacity |
|--------|-------------|-------|-------------|
| 1 | Return Value | Indigo | 15% |
| 2 | Unsettled | Red | 15% |

**Tooltip** on hover shows both Return Value and Unsettled amount for the month.

**Key interpretation:** The gap between the indigo (total) and red (unsettled) areas shows how much gets settled each month. A growing red area relative to indigo signals settlement is falling behind.

### 5.3 Top 10 Product Returns

| Property | Value |
|----------|-------|
| **Title** | "Top 10 Returns by {dimension}" (dynamic title) |
| **Type** | Horizontal bar chart |
| **Filtered by date range?** | Yes |

#### Dimension Toggle

Four toggle buttons to choose the grouping dimension:

| Button | Label | Groups by | Y-axis Width |
|--------|-------|-----------|-------------|
| 1 | All | Individual product (description) | Wide (340px) |
| 2 | Fruit | Fruit type (e.g., "Apple", "Grape") | Narrow (160px) |
| 3 | Variant | Fruit + variety (e.g., "Apple -- Fuji") | Wide (340px) |
| 4 | Country | Country of origin | Narrow (160px) |

#### Metric Toggle

Two toggle buttons to choose what the bar length represents:

| Button | Label | Bar Color |
|--------|-------|-----------|
| 1 | Frequency | Indigo — number of distinct credit notes |
| 2 | Value (RM) | Red — total return value amount |

Results are limited to the top 10 ranked by the chosen metric, descending. Chart height is dynamic based on the number of results (minimum 250px).

**Exclusions from product charts:**
- Basket/container items (item codes starting with "ZZ-ZZ-ZBKT")
- Pallet/packaging items (item codes starting with "ZZ-ZZ-ZZPL")
- Non-product items (item codes starting with "ZZ-ZZ-", "XX-ZZ-", or "RE-") — excluded only for Fruit, Variant, and Country dimensions

**Tooltip** on hover shows:
- Product/group name
- CN Count (number of credit notes)
- Total Value (RM)
- Total Quantity
- Goods Returned Quantity (physical returns)
- Credit Only Quantity (credit adjustment, no physical return)

### 5.4 Aging of Unsettled Returns

| Property | Value |
|----------|-------|
| **Title** | Aging of Unsettled Returns |
| **Type** | Horizontal bar chart |
| **Location** | Section 2 (Unsettled Returns) |
| **Filtered by date range?** | **No** — shows current point-in-time snapshot of all unsettled returns |
| **Y-axis** | Age bucket (category), 80px label width |
| **X-axis** | Amount in RM |

**Age buckets** (based on days since credit note date vs. today):

| Bucket | Color | Day Range |
|--------|-------|-----------|
| 0–30 Days | Green (#10B981) | 0 to 30 |
| 31–60 Days | Amber (#F59E0B) | 31 to 60 |
| 61–90 Days | Orange (#F97316) | 61 to 90 |
| 91–180 Days | Red (#EF4444) | 91 to 180 |
| 180+ Days | Dark Red (#991B1B) | Over 180 |

All five buckets are always displayed, even if count and amount are zero. Only records with an unsettled balance (return amount minus all settlements > RM 0.01) are included.

**Tooltip** on hover: bucket name, amount in RM, and count of credit notes.

**Key interpretation:** A healthy distribution concentrates unsettled value in the 0–30 Days bucket (recently created, still being processed). Heavy concentration in 180+ Days signals a backlog of forgotten or disputed returns.

---

## 6. Tables

### 6.1 Customer Returns Table

| Property | Value |
|----------|-------|
| **Title** | Customer Returns |
| **Subtitle** | "{N} customers" when showing all; "{N} customers of {M} total" when a status filter is active |
| **Location** | Section 2 (Unsettled Returns) |
| **Filtered by date range?** | **No** — shows all-time return data |
| **Default filter** | Status = "Unsettled" (shows only customers with unsettled returns) |
| **Default sort** | Unsettled amount, descending |
| **Pagination** | Selectable page sizes: 25, 50, 100 |
| **Export** | Excel (.xlsx) button — exports all sorted data (not just current page) |
| **Search** | Text input filtering by customer code or company name |

**Columns (7 columns, all sortable):**

| # | Header | Alignment | Format / Behavior |
|---|--------|-----------|-------------------|
| 1 | Code | Left | Customer account code (monospace, small text) |
| 2 | Customer | Left | Company name as **blue underlined link** (clickable). Truncated with hover tooltip for full name. Falls back to customer code if name not available. |
| 3 | Returns | Right | Integer count of return credit notes |
| 4 | Total Value | Right | RM currency amount |
| 5 | Knockoff | Right | RM currency amount |
| 6 | Refunded | Right | RM currency in blue text if > 0; em-dash "--" if zero |
| 7 | Unsettled | Right | Three-state display (see below) |

**Unsettled column three-state display:**

| Condition | Display |
|-----------|---------|
| Unsettled amount <= RM 0.01 | Green text: "Settled" |
| Unsettled > RM 0.01 AND customer has any knockoff or refund | Amber text: RM amount (partial settlement) |
| Unsettled > RM 0.01 AND customer has zero knockoff and zero refund | Red text: RM amount (fully unsettled) |

**Status filter behavior:**

| Filter Option | Shows |
|---------------|-------|
| Unsettled (default) | Customers where unsettled amount > RM 0.01 |
| Settled | Customers where unsettled amount <= RM 0.01 |
| All Returned | All customers with any return history |

**Sorting:** Click any column header to sort; click again to reverse direction. Text columns (Code, Customer) default to ascending on first click; numeric columns default to descending.

**Empty state:** "No unsettled returns" message when no data matches the current filters.

---

## 7. Cross-Page Navigation

### 7.1 Customer Profile Modal (from Customer Returns Table)

Clicking a **customer name** (the blue underlined link — not the row) in the Customer Returns Table opens the Customer Profile Modal for that customer.

**Default view:** The modal opens to the **Return Records** sub-view (not the profile overview), because the user's intent is to investigate that customer's returns.

**Return Records sub-view features:**
- Table of individual credit notes with columns: Doc No, Date, Amount, Knockoff, Refunded, Unsettled, Reason
- Search by document number
- All columns sortable
- Three-state unsettled cell rendering (Settled in green / Partial in amber / Unsettled in red)
- No pagination (all records displayed)

The modal is the shared Customer Profile Modal described in the Business Domain document (Section 4.2), which also provides access to outstanding invoices, sales transactions, trend charts, and customer statistics.

---

## 8. Business Rules

### 8.1 What Counts as a "Return"

Only credit notes with type = RETURN are included on this page. Non-return credit notes (discounts, adjustments, allowances) are excluded. All cancelled documents are excluded.

### 8.2 Settlement Formula

```
Unsettled Amount = Return Credit Note Total -- Knockoff Amount -- Refunded Amount
```

- **Knockoff (Offset Against Invoices):** The return amount is deducted from the customer's next invoice. This is the most common resolution method (~92% of returns).
- **Refund:** The customer receives cash or a cheque. This is rare (~0.3%).
- **Unsettled:** The credit note is still open — the customer is owed money but it hasn't been processed yet.

### 8.3 Return Rate Thresholds

| Return % | Severity | Meaning |
|----------|----------|---------|
| <= 2% | Green (healthy) | Normal for fresh produce distribution |
| > 2% to 5% | Amber (caution) | Investigate root cause |
| > 5% | Red (critical) | Serious quality, supply chain, or process issue |

### 8.4 Goods Return Classification

Each line item on a credit note is classified as one of:

| Type | Description |
|------|-------------|
| Goods Returned | Physical goods were returned by the customer |
| Credit Only | Customer keeps the goods but receives a price reduction or credit |

This distinction is visible in the Product Returns chart tooltip.

### 8.5 Cash/Walk-In Account Exclusion

The generic "CASH SALES" account (300-C016) is excluded from return analysis, as it represents anonymous walk-in transactions with no identifiable customer relationship. Named "CASH DEBTOR-xxx" accounts are included — they represent real businesses with repeat transactions and meaningful return patterns.

### 8.6 Product Exclusions in Charts

The product returns chart excludes non-product items:
- Basket/container items (code prefix "ZZ-ZZ-ZBKT")
- Pallet/packaging items (code prefix "ZZ-ZZ-ZZPL")
- For Fruit, Variant, and Country dimensions: all non-product codes (prefixes "ZZ-ZZ-", "XX-ZZ-", "RE-") are excluded to show only actual product returns

### 8.7 Date and Currency Conventions

- All dates are stored in UTC and converted to Malaysia Time (UTC+8) before any date grouping or display
- All amounts are in MYR (Malaysian Ringgit), displayed as "RM" with thousands separator
- Months are formatted as YYYY-MM internally, displayed as M/YY on chart axes

### 8.8 Section Data Scope

| Section | Data Scope | Why |
|---------|------------|-----|
| Return Trends (Section 1) | Filtered by selected date range | Shows period performance — "how are we doing this year?" |
| Unsettled Returns (Section 2) | All-time accumulated data | An unsettled credit note from 3 years ago is still a current problem |

The aging chart uses a **daily snapshot** — it reflects the current state of all unsettled returns as of the latest data sync, not a historical calculation.

---

## 9. Screenshot References

### Default View — KPI Cards, Settlement Breakdown, Trend & Product Returns

![Return Default View](screenshots/return/default-view.png)

### Customer Returns Table (Unsettled Filter)

![Unresolved Table](screenshots/return/unresolved-table.png)

### Customer Profile Modal — Return Records View

![Customer Profile](screenshots/return/customer-profile.png)

