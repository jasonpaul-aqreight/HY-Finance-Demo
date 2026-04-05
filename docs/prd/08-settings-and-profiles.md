# Settings & Profile Modals

Cross-cutting features that span the entire dashboard. The **Credit Health Score Settings** dialog configures the scoring algorithm. The **Customer Profile Modal** and **Supplier Profile Modal** provide deep-dive views triggered from entity name links across all pages.

---

## 1. Credit Health Score Settings

### 1.1 Purpose & User Goals

The settings dialog allows administrators to tune the credit scoring algorithm that evaluates customer payment risk. Every customer's credit score and risk tier — displayed on the Payment Collection page and inside customer profile modals — is computed using these configurable weights and thresholds.

**Key questions this feature answers:**
- How should we weight different risk factors when evaluating customer health?
- Where should the cutoff points be between Low, Moderate, and High risk?
- How does the scoring algorithm actually work? (built-in explanation)

### 1.2 How to Access

The settings dialog is opened from the **Payment Collection page** via a button in the customer table header:

- **Trigger:** "Score & Risk" button (gear icon, outline style, small size) in the customer table's card header area
- **Format:** Modal dialog (not a separate page)
- **Close:** X button in the dialog header

### 1.3 Dialog Layout

The dialog is divided into four sections, top to bottom:

#### Section 1: Header
- Title: **"Credit Health Score Settings"**
- Subtitle explaining score ranges (0-100)
- Close button (X icon, top-right)
- **Non-admin warning:** If the user is not an administrator, a yellow banner appears: read-only view with all inputs disabled. Save and Reset buttons are hidden.

#### Section 2: Credit Score Weights Card

Four numeric input fields (each 0-100%, suffix "%"):

| Factor | Default Weight | What It Measures |
|--------|---------------|-----------------|
| Credit Usage | **40%** | Outstanding balance as a percentage of credit limit. Lower utilization = higher sub-score. |
| Overdue Days | **30%** | Age (in days) of the oldest overdue invoice. Fewer overdue days = higher sub-score. |
| Payment Timeliness | **20%** | Average days late across paid invoices. Paying on time = higher sub-score. |
| Double Breach | **10%** | Whether the customer has breached BOTH their credit limit AND overdue limit simultaneously. Binary penalty: no breach = 100, both breached = 0. |

**Live validation counter:** Displays "Total: N/100" below the weight fields. Turns **green** when weights sum to exactly 100, **red** otherwise.

**"Reset to Defaults" button** (admin only): Restores factory defaults in the form only — user must still save to persist.

#### Section 3: Risk Level Thresholds Card

Two numeric input fields defining the risk tier boundaries:

| Field | Default | Rule |
|-------|---------|------|
| Low Risk (score >=) | **75** | Scores at or above this value are classified as Low risk (green) |
| High Risk (score <=) | **30** | Scores at or below this value are classified as High risk (red) |

Scores between High and Low thresholds are classified as **Moderate** risk (yellow/amber).

**Validation:** Low threshold must be strictly greater than High threshold.

**Visual Risk Threshold Bar:** A horizontal bar showing three colored zones:
- **Red zone** (0 to High threshold): High risk
- **Yellow zone** (High threshold to Low threshold): Moderate risk
- **Green zone** (Low threshold to 100): Low risk

Label markers at each boundary. Legend below with plain-English explanations of each zone.

**"Reset to Defaults" button** (admin only): Same behavior as the weights reset.

#### Section 4: How It Works (Collapsible)

An expandable accordion section that explains the full scoring methodology. Contains:

**Credit Usage sub-score:**
- Formula: max(0, 100 - utilization%)
- Special case: No credit limit set → neutral score (50)

**Overdue Days sub-score** (step-ladder based on oldest overdue invoice):

| Days Overdue | Sub-Score |
|-------------|-----------|
| 0 (nothing overdue) | 100 |
| 1-30 days | 80 |
| 31-60 days | 60 |
| 61-90 days | 40 |
| 91-120 days | 20 |
| Over 120 days | 0 |

**Payment Timeliness sub-score** (based on average days late):

| Avg Days Late | Sub-Score |
|--------------|-----------|
| On time or early (≤ 0) | 100 |
| 1-7 days | 80 |
| 8-14 days | 60 |
| 15-30 days | 40 |
| 31-60 days | 20 |
| Over 60 days | 0 |
| No payment history | Neutral score (50) |

**Double Breach sub-score** (binary):

| Condition | Sub-Score |
|-----------|-----------|
| Neither limit breached, or only one breached | 100 |
| Both credit limit AND overdue limit breached | 0 |

**Final score formula:**
```
Score = round(
    (Credit Usage Weight / 100) × Credit Usage Sub-Score +
    (Overdue Days Weight / 100) × Overdue Sub-Score +
    (Timeliness Weight / 100) × Timeliness Sub-Score +
    (Double Breach Weight / 100) × Double Breach Sub-Score
)
```

**"Putting It All Together"** section with a worked example.

### 1.4 Footer (Admin Only)

- **Message area:** Shows success/error feedback with auto-dismiss animation for success messages
- **Cancel button** (outline style): Closes dialog without saving
- **Save button:** Disabled until weights sum to 100 AND thresholds are valid. Shows "Saving..." during submission.

### 1.5 Persistence & Effect

- Settings are stored in the database as a JSON object (key: `credit_score_v2`)
- On save: server-side validation re-checks weights sum to 100 and threshold ordering
- **Immediate effect:** Changes take effect on the next data fetch — no page reload required. All customer credit scores are dynamically recomputed using current settings (scores are not permanently stored)
- Client-side caching prevents excessive re-fetching but invalidates after a save

### 1.6 Business Rationale for Adjustable Weights

The defaults are a reasonable starting point, but every business is different:

- **"We care most about how late people are."** → Increase Overdue Days weight, decrease others
- **"We cannot tolerate customers who breach both limits."** → Increase Double Breach weight
- **"Cash flow predictability matters most."** → Increase Timeliness weight

The key insight: weights let the business tell the system what matters most when evaluating customer risk.

---

## 2. Customer Profile Modal

### 2.1 Purpose & User Goals

A near-full-screen modal that provides a 360-degree view of a single customer: identity, financial health, payment behavior, return history, and sales performance — all in one place.

**Key questions this feature answers:**
- Is this customer financially healthy or in trouble?
- How much do they owe and how overdue are they?
- What is their return behavior?
- What products are we selling them, and at what margin?
- Should we extend more credit or tighten terms?

### 2.2 Where It Appears & Default View

The modal is triggered by clicking a **customer name** (styled as a blue underlined link) in any customer-facing table. The entire row is NOT clickable — only the name.

| Calling Page | Table | Default View | Date Range Passed |
|-------------|-------|-------------|-------------------|
| Payment Collection | Customer Table | Outstanding Invoices | — |
| Credit Note / Return | Top Debtors Table | Returns | — |
| Sales Report | Group-By Table (customer dimension only) | Sales | Start date, end date |
| Customer Margin | Customer Margin Table | Sales | Start date, end date |

### 2.3 Modal Structure

- **Size:** 90% viewport width × 90% viewport height
- **Layout:** Fixed header (non-scrolling), scrollable body
- **Close:** X button in header

### 2.4 Header

Displays at the top of every view:

| Element | Details |
|---------|---------|
| Company Name | Large bold text |
| Customer Code | Smaller text below company name |
| Active/Inactive Status | Green pulsing dot + "ACTIVE" or red dot + "INACTIVE" |
| Entity Badge | "CUSTOMER" label in blue |
| Close Button | X icon, top-right |

### 2.5 Profile View (Default for most calling pages)

The Profile view is a rich dashboard-style layout with four major sections:

#### Section A: Customer Details + Navigation Logs (Two-Column Layout)

**Left side — Customer Details (3-column grid with dividers):**

| Column | Fields |
|--------|--------|
| General | Customer Type, Sales Agent, Customer Since (formatted date) |
| Contact | Contact Person, Phone, Mobile, Email |
| Financial | Credit Limit (formatted as RM), Payment Terms, Currency Code |

**Right side — Log Navigation Buttons:**

Three buttons that navigate to other views within the modal:

| Button | Badge | Behavior |
|--------|-------|----------|
| Outstanding Invoices | Count badge (red background) if invoices > 0 | Switches to Outstanding Invoices view |
| Return Records | Count badge (amber background) if returns > 0 | Switches to Returns view |
| Sales Transactions | No badge | Switches to Sales view |

Each button has a chevron-right icon indicating navigation.

#### Section B: Statistics Cards (4-Card Grid)

| Card | Visualization | Details |
|------|--------------|---------|
| **Health Score** | Semi-circular gauge (0-100 scale) | Color-coded: green (≥70), amber (40-69), red (<40). Risk tier chip below (Low/Moderate/High). Avg Collection Days displayed. |
| **Credit Usage** | Donut chart (Used vs Available) | Color-coded: green (<80%), amber (80-100%), red (>100%). Shows total outstanding and credit limit values. |
| **Outstanding Invoices** | Stacked bar chart by aging bucket | Buckets: Not Due (blue), 1-30d (green), 31-60d (yellow), 61-90d (orange), 91-120d (red), 120+d (purple). Shows overdue amount or "No Overdue". |
| **Returns** | Donut chart (Settled vs Unsettled) | Green for settled, red for unsettled. Unsettled count badge in center. |

#### Section C: Trend Charts (2-Column Grid with Shared Date Range Picker)

A date range section with presets controls all three trend charts below, arranged in a 2-column grid (third chart spans only the left column):

| Chart | Type | KPI Cards Above | Details |
|-------|------|----------------|---------|
| **Sales & Margin** | Bar + Line combo | Net Sales, Avg Gross Margin %, Cost of Sales | Dark blue bars (Net Sales, left axis), red line (Margin %, right axis). |
| **Payment** | Stacked Bar + Line combo | Collection, Rate %, Avg Collection Days | Light blue bars (Invoiced) + dark blue bars (Collected), green line (Collection Rate %). |
| **Returns** | Line chart | Total Returns value, Count | Amber line with dot markers. |

### 2.6 Outstanding Invoices View

Accessed via the log button in Profile view, or as the default view when opened from the Payment Collection page.

**Header:** Back arrow button (returns to Profile view), title "Outstanding Invoices", search field (filters by document number).

**Table columns (all sortable):**

| Column | Formatting |
|--------|-----------|
| Doc No | Left-aligned |
| Doc Date | Formatted date |
| Due Date | Formatted date |
| Total (RM) | Right-aligned, 2 decimal places |
| Outstanding (RM) | Right-aligned, red if overdue, black otherwise |
| Days Overdue | Right-aligned, red number if overdue, green with "(not due)" suffix if current |

- **Default sort:** Days Overdue, descending (most overdue first)
- **Footer:** "Showing X outstanding invoice(s)"
- **Empty state:** No outstanding invoices message

### 2.7 Return Records View

Accessed via the log button in Profile view.

**Header:** Back arrow, title "Return Records", search field (filters by document number).

**Table columns (all sortable):**

| Column | Formatting |
|--------|-----------|
| Doc No | Left-aligned |
| Date | Formatted date |
| Amount (RM) | Right-aligned |
| Knocked Off | Right-aligned, dashes if zero |
| Refunded | Right-aligned, blue text if > 0, dashes if zero |
| Unresolved | Right-aligned, 3-state coloring: green "Settled" if ≤ 0.01, amber if partially settled, red if fully unresolved |
| Reason | Left-aligned, truncated with hover tooltip for full text |

- **Default sort:** Date, descending (newest first)
- **Footer:** "Showing X return record(s)"

### 2.8 Sales Transactions View

Accessed via the log button in Profile view, or as the default view when opened from Sales/Customer Margin pages.

**Header:** Back arrow, title, date range section, search field (filters by item code), **Export to Excel** button.

**Table columns (all sortable):**

| Column | Formatting |
|--------|-----------|
| Item Code | Left-aligned, monospace, no wrap |
| Description | Left-aligned, truncated |
| Qty Sold | Right-aligned, locale-formatted number |
| Net Sales (RM) | Right-aligned |
| Cost (RM) | Right-aligned |
| Margin % | Right-aligned, bold, color-coded: green (≥20%), amber (10-19%), red (<10%) |

- **Default sort:** Net Sales, descending
- **Pagination:** Page size selector with "items" noun, total count from server
- **Date range:** Independent date range controls; inherits dates from calling page if provided
- **Export:** Excel (.xlsx) format, exports filtered/sorted data
- **Height management:** Table maintains consistent height during pagination to prevent layout shift

### 2.9 Data Loading

- Each section fetches data independently — partial loading is supported (one section can show data while another is still loading)
- Loading states per section (spinner/skeleton)
- Error states per section (error message component)
- Date ranges for trends vs. sales transactions are managed independently

---

## 3. Supplier Profile Modal

### 3.1 Purpose & User Goals

A near-full-screen modal providing a detailed view of a single supplier: contact details, performance metrics, purchase trends, supply chain risk assessment, and item-level price analysis.

**Key questions this feature answers:**
- How is this supplier performing on margin?
- Which items do we buy from them, and at what price trends?
- Are we dangerously dependent on this supplier for certain products?
- Is the purchase price for key items trending up or down?
- Who are our sole-source suppliers?

### 3.2 Where It Appears

Triggered by clicking a **supplier name** (blue underlined link) in the Supplier Performance page's comparison table. The entire row is NOT clickable — only the name.

| Calling Page | Table | Default View | Data Passed |
|-------------|-------|-------------|-------------|
| Supplier Performance | Supplier Comparison Table | Items | Start date, end date, supplier metrics (attributed net sales, cost of sales, gross profit, margin %, items supplied) |

### 3.3 Modal Structure

- **Size:** 90% viewport width × 90% viewport height
- **Layout:** Fixed position, centered with semi-transparent backdrop
- **Header:** Sticky with border, fixed height
- **Body:** Scrollable content area
- **Close:** X button in header

### 3.4 Header

| Element | Details |
|---------|---------|
| Company Name | Large bold text |
| Creditor Code | Smaller text |
| Active/Inactive Status | Green pulsing dot + "ACTIVE" or red dot + "INACTIVE" |
| Entity Badge | "SUPPLIER" label in indigo |
| Close Button | X icon, top-right |

### 3.5 Profile View

#### Section A: Supplier Details + Navigation (Two-Column Layout)

**Left side — Supplier Details (3-column grid with dividers):**

| Column | Fields |
|--------|--------|
| General | Supplier Type, Purchase Agent, Supplier Since (formatted date) |
| Contact | Contact Person, Phone, Mobile, Email |
| Terms | Payment Terms, Credit Limit (RM), Currency |

**Right side — Log Navigation:**
- **"Items Supplied" button** that switches to Items view

#### Section B: Performance Section

**Date Range Picker:** With presets for easy date selection. Independent from Items view date range.

**Two KPI Cards (2-column grid):**

| Card | Visualization | Details |
|------|--------------|---------|
| **Margin Performance** | Semi-circular gauge (0-50% scale) | Color-coded: green (≥20%), amber (10-19%), red (<10%). Shows margin percentage in center. |
| **Supply Dependency** | Stacked horizontal bar | Blue segment = multi-source items, amber segment = sole-supplier items. Shows counts below. Highlights count of items with no alternative supplier. |

**Two Trend Charts (2-column grid):**

| Chart | Type | KPI Cards Above | Details |
|-------|------|----------------|---------|
| **Purchase Cost & Margin** | Bar + Line combo | Accumulated Purchase Cost (RM), Avg Gross Margin (%), Est. Gross Profit (RM) | Bars for purchase cost (left axis), line for margin % (right axis). Monthly x-axis. |
| **Top 5 Items by Gross Profit** | Horizontal bar chart | Top Item name, Top Profit/Margin value, Top 5 total | Toggle between "Est. Gross Profit" and "Margin %" views. Sorted by selected metric. |

### 3.6 Items View

Accessed via the "Items Supplied" button in Profile view. This is also the **default view** when opened from the Supplier Performance page.

#### Header
- Back arrow button (returns to Profile view)
- Title: "Items Supplied"
- Search input (filters by item code or description)
- Info tooltip explaining "Est." prefix means estimated calculations based on attributed costing

#### Filter Row
- **Date Range Section** (independent from Profile view dates)
- **Sole Supplier Toggle:** Button with count badge showing how many items are sole-source. When active: amber highlight, "Sole Source Only" label. Info text explains "Sole source — no other supplier supplies these product variants. Dependency is assessed by product type, not individual SKU."
- **Searchable Dropdowns (right side):**
  - Product filter (dynamically populated from current items)
  - Variant filter (dynamically populated, interdependent with product selection)
  - Selecting product restricts available variants; clearing product clears variant

#### Items Table

| Column | Formatting |
|--------|-----------|
| (Warning icon) | Amber triangle icon if item is sole-source |
| Item Code | Left-aligned, monospace |
| Description | Left-aligned, truncated |
| Qty Purchased | Right-aligned, locale-formatted |
| Avg Purchase/Unit | Right-aligned, RM currency, 2 decimals |
| Price Trend | Sparkline (100×28px inline chart) — see below |
| Est. Net Sales | Right-aligned, RM currency |
| Est. Cost of Sales | Right-aligned, RM currency |
| Margin % | Right-aligned, color-coded: green (≥20%), amber (10-19%), red (<10%) |

- **Sole-source items:** Highlighted with light amber background row
- **Default sort:** Margin %, descending
- **All columns sortable** (except warning icon and price trend)
- **Footer:** "Showing X items..."

#### Price Trend Sparkline Interaction

The sparkline is a key feature for supplier negotiation:

1. **Default state:** Tiny 100×28px line chart inline in the table cell
   - **Green line:** Price stable or declining (good)
   - **Red line:** Price increasing (needs attention)
   - Requires minimum 2 data points to render

2. **Hover:** Expand icon appears over the sparkline

3. **Click → Popover:** Opens a detailed popover containing:
   - **Header:** Item description, price change percentage (green ▼ for decrease, red ▲ for increase), number of months tracked
   - **Expanded chart:** 120px height detailed monthly price chart
   - **Data table:** Monthly breakdown with columns: Month, Avg Price, Qty

This interaction allows users to spot price trends at a glance in the table, then drill into specifics for negotiation preparation.

### 3.7 Supply Chain Risk Assessment

The supplier profile surfaces supply chain risk through multiple signals:

1. **Supply Dependency Bar** in Performance section — visual ratio of sole-source vs multi-source items
2. **Sole Supplier Toggle** in Items view — filters to show only items with no alternative supplier
3. **Warning triangle icons** on individual sole-source items in the table
4. **Amber row highlighting** for sole-source items

**How sole-source is determined:** The system extracts the product + variant combination from each item's description, then checks if any other supplier provided that same combination during the selected period. If not, the item is flagged as sole-source.

---

## 4. Cross-Page Integration

### 4.1 Modal Usage Matrix

| Dashboard Page | Entity Type | Trigger Element | Default View | Date Range Passed |
|---------------|------------|----------------|-------------|-------------------|
| Payment Collection | Customer | Customer name (blue link) in Customer Table | Outstanding Invoices | — |
| Credit Note / Return | Customer | Customer name (blue link) in Top Debtors Table | Returns | — |
| Sales Report | Customer | Customer name (blue link) in Group-By Table (customer dimension only) | Sales | Start date, end date |
| Customer Margin | Customer | Customer name (blue link) in Customer Margin Table | Sales | Start date, end date |
| Supplier Performance | Supplier | Supplier name (blue link) in Supplier Comparison Table | Items | Start date, end date, supplier metrics |

### 4.2 Interaction Pattern

All modals follow the same pattern:

1. **Trigger:** User clicks an entity name (blue underlined link) in a table — NOT the entire row
2. **Open:** Modal appears at 90vw × 90vh with the appropriate default view
3. **Navigate:** User can switch between views within the modal using navigation buttons
4. **Close:** X button or close callback returns to the calling page
5. **Data loading:** Data fetches only fire when the modal is open, preventing unnecessary network requests

### 4.3 Settings Integration

The Credit Health Score Settings dialog is accessed exclusively from the Payment Collection page. Changes to scoring weights and risk thresholds take immediate effect for:

- Customer Table on the Payment Collection page (scores recomputed on each data fetch)
- Customer Profile Modal's health score gauge, risk tier badge, and score display
- No page reload required — the next data fetch uses updated settings

### 4.4 Date Range Inheritance

When a modal is opened from a page with an active date range filter:

- **Sales and Customer Margin pages:** Pass their current start/end dates to the modal. The Sales Transactions view and trend charts initialize with these dates.
- **Payment and Return pages:** Do not pass date ranges (these pages use snapshot data, not date-ranged data)
- **Supplier Performance page:** Passes its date range to both the Profile view trends and Items view table.

Within a modal, the Profile view and sub-views maintain **independent date ranges** — changing dates in one view does not affect the other.

---

## 5. Business Rules

### 5.1 Credit Score Computation

- Scores are **dynamically computed** per request using current settings — they are NOT permanently stored
- Raw inputs (utilization, overdue days, avg payment days) are stored in pre-computed snapshots
- When settings change, all scores update automatically on the next page load
- Neutral score (50) is used when data is unavailable (e.g., no credit limit, no payment history)

### 5.2 Customer Profile Data Sources

| Data Section | Source | Grain |
|-------------|--------|-------|
| Customer details | Customer master table | Static (updated by sync) |
| Credit health metrics | AR customer snapshot (pre-computed daily) | Latest snapshot date |
| Outstanding invoices | AR invoice table (live) | Per-invoice |
| Return records | Credit note table (live) | Per-document |
| Sales/margin data | Customer margin pre-computed table | Monthly |
| Collection trend | Payment collection pre-computed data | Monthly |

### 5.3 Supplier Profile Data Sources

| Data Section | Source | Grain |
|-------------|--------|-------|
| Supplier details | Supplier master table | Static (updated by sync) |
| Performance metrics | Supplier margin pre-computed table | Monthly aggregated |
| Items supplied | Supplier margin pre-computed table | Monthly per-item |
| Price trends | Supplier margin pre-computed table | Monthly per-item |
| Sole-source analysis | Cross-supplier item comparison (computed on request) | Period-based |

### 5.4 Formatting Conventions

| Type | Format |
|------|--------|
| Currency | RM with 2 decimal places (e.g., RM 1,234,567.89). Compact notation (K/M) for large values in charts. |
| Dates | DD MMM YYYY (e.g., 01 Jan 2024) in tables. MMM YY (e.g., Jan 24) on chart axes. |
| Percentages | 1 decimal place |
| Margin color coding | Green ≥ 20%, Amber 10-19%, Red < 10% |
| Risk tier colors | Low = green, Moderate = yellow/amber, High = red |

### 5.5 "Est." (Estimated) Label Convention

The supplier profile uses "Est." prefix on certain metrics (Gross Profit, Margin) because supplier costing uses an **attribution model** — costs are attributed based on purchase prices matched to sales items, not direct cost-of-goods-sold from the accounting system. This distinction is surfaced to users via:
- "Est." prefix on KPI card labels
- Info tooltip in the Items view header explaining the methodology

---

## 6. Drift from Previous Documentation

Major differences discovered between old documentation and current codebase:

| Area | Old Documentation | Actual Implementation |
|------|------------------|----------------------|
| **Settings access** | Separate page at `/payment/settings` with back-arrow | Dialog/modal triggered from "Score & Risk" button in customer table header |
| **Scoring model** | V1: 5 factors (Utilization 35%, Overdue 25%, Consistency 15%, Timeliness 15%, Breach 10%) | V2: 4 factors (Utilization 40%, Overdue 30%, Timeliness 20%, Double Breach 10%). Consistency removed entirely. |
| **Risk thresholds** | 4 tiers: Low ≥85, Moderate ≥65, Elevated ≥40, High <40 | 3 tiers: Low ≥75, Moderate (between), High ≤30 |
| **Double Breach** | Single-factor "Overdue Limit Breach" (just overdue limit) | "Double Breach" — BOTH credit limit AND overdue limit must be breached for penalty |
| **Settings storage** | JSON file at `data/settings.json` | Database table (`app_settings`, JSONB column) |
| **Customer profile layout** | 3 summary panels + 3 tabs (Payment/Returns/Sold Items) | 4-view architecture: Profile (with details + statistics + trends), Outstanding Invoices, Returns, Sales |
| **Customer profile trigger** | Click entire row | Click customer name (blue link) only |
| **Default tab from Payment** | "payment" tab | Outstanding Invoices view |
| **Customer profile views** | `payment`, `returns`, `sold-items` | `profile`, `outstanding`, `returns`, `sales` |
| **Customer statistics** | Listed as KPIs in panels | Dedicated visualization cards: Health Score Gauge, Credit Usage Donut, Outstanding Aging Bar, Returns Donut |
| **Customer trends** | Not documented | 3 trend charts (Sales & Margin, Payment, Returns) in 2-column grid with shared date range picker |
| **Supplier profile layout** | Header + single Purchase Items tab | Two-view architecture: Profile (details + performance) and Items (with filters) |
| **Supplier performance** | Not documented | Margin Gauge, Supply Dependency Bar, Purchase Trend chart, Top 5 Items chart |
| **Supplier items filters** | Search only | Sole Supplier Toggle + Product/Variant searchable dropdowns + search |
| **Sparkline interaction** | Static sparkline | Clickable sparkline → popover with expanded chart + monthly data table |
| **Role-based access** | Not documented | Admin vs non-admin access for settings (read-only for non-admin) |
| **How It Works section** | Not documented | Collapsible accordion with full scoring methodology explanation |
| **Sold Items tab** | Group column included | No Group column; has Qty Sold, Net Sales, Cost, Margin % |

---

## 7. Screenshot References

*Screenshots to be captured in Session 12.*

- [ ] Settings dialog — default state with all weights
- [ ] Settings dialog — risk threshold bar visualization
- [ ] Settings dialog — "How It Works" expanded
- [ ] Settings dialog — non-admin read-only view
- [ ] Customer profile — Profile view (full layout)
- [ ] Customer profile — Statistics cards detail
- [ ] Customer profile — Trend charts with date range
- [ ] Customer profile — Outstanding Invoices view
- [ ] Customer profile — Return Records view
- [ ] Customer profile — Sales Transactions view with export
- [ ] Supplier profile — Profile view (full layout)
- [ ] Supplier profile — Margin Gauge and Supply Dependency Bar
- [ ] Supplier profile — Items view with sole-supplier toggle active
- [ ] Supplier profile — Sparkline popover expanded
- [ ] Supplier profile — Product/Variant filter interaction
