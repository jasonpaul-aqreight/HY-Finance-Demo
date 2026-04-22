# AI Insight Engine — Finance Configuration

> Finance-specific configuration for the AI Insight Engine. This document is self-contained: a junior developer can read it top-to-bottom and understand the full Finance AI Insight implementation. Shared platform patterns live in [doc 10 (10-ai-insight-base.md)](10-ai-insight-base.md) and are referenced as "See doc 10, §X" where needed — you do not need to read doc 10 unless you want deeper platform-level context.

---

## 1. Overview

The Finance configuration plugs into the base AI Insight Engine (doc 10) to provide automated analysis across seven dashboard modules:

| # | Module | Page | Sections | Components |
|---|--------|------|----------|------------|
| 1 | Payment | payment | 2 | 11 |
| 2 | Sales | sales | 2 | 6 |
| 3 | Customer Margin | customer-margin | 2 | 10 |
| 4 | Supplier Performance | supplier-performance | 2 | 11 |
| 5 | Returns | return | 2 | 9 |
| 6 | Expenses | expenses | 2 | 9 |
| 7 | Financial Statements | financial | 4 | 10 |

**Totals:** 16 sections, 66 components across 7 modules.

**How it works (simplified):**

1. User clicks "Analyze" on a section header.
2. The orchestrator fetches pre-computed data from PostgreSQL (and optionally from remote RDS for "full" tool-policy sections).
3. Phase 1: Each component is analyzed in parallel by a fast model (Haiku) using the component prompt + data.
4. Phase 2: A summary model (Sonnet) reads all component results and produces 1-6 structured insight cards (good + bad findings).
5. Results are stored in PostgreSQL and displayed in the UI.

See doc 10, §2 for the full architecture diagram and §4 for the analysis lifecycle.

---

## 2. Analysis Persona

The global system prompt is sent as the `system` parameter on every component-level LLM call. It is the same for all 66 components. Component-specific prompts (documented in section 5) are prepended to the `user` message, not the system message. This keeps the system prompt cacheable across all calls.

### Full Global System Prompt

> You are a senior financial analyst at Hoi-Yong (Malaysian fruit distribution). You explain dashboard metrics to a senior director.
>
> Rules:
> - Be direct, concise, no jargon. State facts, not recommendations.
> - Use RM with thousands separators (e.g., RM 5,841,378).
> - Bullet points for observations. Markdown tables for comparisons.
> - Compare at least 3 data points for trends.
> - If data is insufficient, say so.
> - Keep analysis under 150 words.
> - Do NOT re-derive totals. Use values as given.
> - Every number you cite MUST appear in the data block. Display rounding OK (e.g., RM 2,286,847 → RM 2.29M). Never back-solve or invent values.
> - Match your language to the Scope line in the data (period vs snapshot vs fiscal).

### Prompt Rules (extracted)

| Rule | Detail |
|------|--------|
| Currency | Malaysian Ringgit (RM) with thousands separators |
| Language | Direct, concise, no jargon |
| Format | Bullet points for observations, markdown tables for comparisons |
| Component word limit | Max 150 words |
| Summary detail word limit | 220–320 words |
| Verbatim-copy rule | Every number must match a value from the data block (display rounding OK) |
| Scope discipline | Match language to the Scope line in the data (period vs snapshot vs fiscal) |

---

## 3. Scope Assignments

Each section uses one of three scope types. The scope controls what language the AI uses when describing numbers and how date filtering works. See doc 10, §13 for scope type definitions.

| Scope | Sections |
|-------|----------|
| `period` | payment_collection_trend, sales_trend, sales_breakdown, customer_margin_overview, customer_margin_breakdown, supplier_margin_overview, supplier_margin_breakdown, return_trend, expense_overview, expense_breakdown |
| `snapshot` | payment_outstanding, return_unsettled |
| `fiscal_period` | financial_overview, financial_pnl, financial_balance_sheet, financial_variance |

**What each scope means:**

- **period** — Numbers describe activity within a user-selected date range (e.g. "Nov 2024 – Oct 2025"). Language: "in the period", "during the range".
- **snapshot** — Numbers describe current state at a point in time. Ignores the date-range selector. Language: "as of [date]", "currently".
- **fiscal_period** — Numbers describe a fiscal year window (full FY, YTD, or last 12 months). Language: "for FY2025", "year-to-date".

---

## 4. Dual-Model Strategy (Finance)

Finance uses the shared dual-model strategy from the base platform. See doc 10, §3 for full details.

| Phase | Model | Purpose | Finance notes |
|-------|-------|---------|---------------|
| Phase 1 — Component analysis | Haiku (claude-3-5-haiku-latest) | Fast, parallel analysis of each component | 66 components across 16 sections. Haiku keeps cost low. |
| Phase 2 — Summary synthesis | Sonnet (claude-sonnet-4-20250514) | Synthesis of all component results into insight cards | Has tool access for root-cause investigation. Max 2 tool calls per summary. |

---

## 5. Section & Component Catalog

This section documents all 16 sections and their 66 components. For each section you will find:
1. A metadata table (section key, page, scope, tool policy, data sources, component count)
2. A component table (key, name, type, what it measures, thresholds)
3. The exact component prompt from `prompts.ts` for each component, shown in a blockquote

---

### 5.1 Payment Collection Trend

| | |
|---|---|
| **Section Key** | `payment_collection_trend` |
| **Page** | payment |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_ar_monthly |
| **Components** | 5 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| avg_collection_days | Avg Collection Days | kpi | Average days to collect payment after invoicing | ≤30 Good, ≤60 Warning, >60 Critical |
| collection_rate | Collection Rate | kpi | Percentage of invoiced amount collected as cash | ≥80% Good, ≥50% Warning, <50% Critical |
| avg_monthly_collection | Avg Monthly Collection | kpi | Average cash collected per month | No fixed threshold |
| collection_days_trend | Avg Collection Days Trend | chart | Monthly collection days over time | Rising = bad, Falling = good, >60 spike = critical |
| invoiced_vs_collected | Invoiced vs Collected | chart | Monthly cash received vs new credit sales | Bars below line = accumulating AR, above = clearing |

**Component Prompt — `avg_collection_days`:**

> You are analyzing the "Avg Collection Days" KPI.
>
> What it measures: The average number of days it takes to collect payment after invoicing.
>
> Formula: For each month: (AR Outstanding at month-end / Monthly Credit Sales) x Days in that month. The KPI shows the average across all valid months in the selected period. Months with zero credit sales are excluded.
>
> Performance thresholds:
> - ≤30 days = Good (green) — efficient collection
> - ≤60 days = Warning (yellow) — acceptable but monitor
> - >60 days = Critical (red) — cash flow risk
>
> Provide a concise analysis of this metric. If you need more data to understand why collection days are high or low, use the available tools to query the data.

**Component Prompt — `collection_rate`:**

> You are analyzing the "Collection Rate" KPI.
>
> What it measures: The percentage of invoiced amount that was actually collected as cash payment in the selected period.
>
> Formula: (Total Collected / Total Invoiced) x 100
> - Collected = sum of all payment amounts (non-cancelled)
> - Invoiced = sum of all invoice totals (non-cancelled)
> - Excludes non-cash offsets (contra entries)
>
> Performance thresholds:
> - ≥80% = Good (green) — healthy cash conversion
> - ≥50% = Warning (yellow) — growing receivables
> - <50% = Critical (red) — serious collection problem
>
> Provide a concise analysis of this metric.

**Component Prompt — `avg_monthly_collection`:**

> You are analyzing the "Avg Monthly Collection" KPI.
>
> What it measures: The average cash collected per month across the selected date range.
>
> Formula: Total Collected / Number of Months in Range
>
> There is no fixed threshold for this metric. Evaluate it relative to the invoiced amounts and historical trend. Rising collections with stable invoicing is positive. Falling collections signals concern.
>
> Provide a concise analysis of this metric.

**Component Prompt — `collection_days_trend`:**

> You are analyzing the "Avg Collection Days Trend" line chart.
>
> What it shows: Monthly collection days plotted over time with a dashed reference line at the period average.
>
> How to read it:
> - Rising trend = collection is slowing down (bad)
> - Falling trend = collection is improving (good)
> - Spikes above 60 days = critical months
> - Consistency around or below 30 days = excellent
>
> Look for: seasonal patterns, sudden spikes, sustained direction changes over 3+ months.
>
> Provide a concise analysis of the trend pattern.

**Component Prompt — `invoiced_vs_collected`:**

> You are analyzing the "Invoiced vs Collected" combo chart.
>
> What it shows:
> - Blue bars = monthly total collected (cash received)
> - Red line = monthly total invoiced (new credit sales)
> - Dashed reference = average monthly collection
>
> How to read it:
> - When bars consistently fall below the red line, the business is accumulating unpaid receivables — a cash flow warning.
> - When bars exceed the red line, old receivables are being cleared.
> - The gap between bars and line indicates collection efficiency.
>
> Look for: widening/narrowing gaps, months where collection dropped sharply, seasonal collection patterns.
>
> **Sub-period averaging is BANNED in this component.** The data block contains pre-computed H1/H2 averages, H1/H2 ranges, and an H1→H2 direction line. You may quote those verbatim. You may NOT:
> - Define your own sub-period (e.g. "Jul-Oct", "Q3-Q4", "last 4 months", "second half") and average its gaps yourself.
> - Cite a range ("RM -X to RM -Y") that excludes any month inside the stated sub-period.
> - Narrate a "narrowing", "widening", "tightening", or "improving" trend that is contradicted by any month inside the sub-period.
> - Do mental arithmetic on the monthly gap values.
>
> Describe trends month-by-month, or use the pre-computed H1/H2 lines. Anything else is a fabrication.
>
> Provide a concise analysis of the invoiced vs collected relationship.

---

### 5.2 Outstanding Payment

| | |
|---|---|
| **Section Key** | `payment_outstanding` |
| **Page** | payment |
| **Scope** | snapshot |
| **Tool Policy** | full |
| **Data Sources** | pc_ar_customer_snapshot, pc_ar_aging_history |
| **Components** | 6 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| total_outstanding | Total Outstanding | kpi | Total unpaid invoices across all customers | Snapshot, evaluate in context |
| overdue_amount | Overdue Amount | kpi | Portion past due date | <20% acceptable, >40% critical |
| credit_limit_breaches | Credit Limit Breaches | kpi | Customers exceeding credit limit | 0 = Good, >0 = Concern |
| aging_analysis | Aging Analysis | chart | Outstanding grouped by aging buckets (6 buckets) | Most in "Not Yet Due" = healthy |
| credit_usage_distribution | Credit Usage Distribution | chart | Customer distribution by credit usage | Most within limit = healthy |
| customer_credit_health | Customer Credit Health | table | Per-customer credit health with risk scoring (11 columns) | Low ≥75, Moderate 31–74, High ≤30 |

**Component Prompt — `total_outstanding`:**

> You are analyzing the "Total Outstanding" KPI.
>
> What it measures: The total amount currently owed by all customers — sum of all unpaid invoices from the beginning of time to now.
>
> This is a snapshot metric — it reflects the current state regardless of date range selection.
>
> There is no fixed threshold. Evaluate in context of total invoicing volume and trend direction. A growing outstanding balance alongside flat or declining sales is a red flag.
>
> Provide a concise analysis of this metric.

**Component Prompt — `overdue_amount`:**

> You are analyzing the "Overdue Amount" KPI.
>
> What it measures: The portion of total outstanding that is past its due date. Shown with the percentage of total and count of affected customers.
>
> An invoice is "overdue" when the current date exceeds its due date.
>
> Evaluate:
> - Overdue as % of total outstanding: <20% is acceptable, >40% is critical
> - Number of overdue customers vs total active customers
> - Whether the overdue amount is concentrated in a few large customers or spread across many
>
> Provide a concise analysis of this metric.

**Component Prompt — `credit_limit_breaches`:**

> You are analyzing the "Credit Limit Breaches" KPI.
>
> What it measures: Count of active customers whose total outstanding exceeds their assigned credit limit. Only customers with a credit limit > 0 are evaluated.
>
> Performance thresholds:
> - 0 breaches = Good (green)
> - >0 breaches = Concern (red)
>
> If breaches exist, use tools to investigate which customers are in breach and by how much. A few large breaches is more concerning than many small ones.
>
> Provide a concise analysis of this metric.

**Component Prompt — `aging_analysis`:**

> You are analyzing the "Aging Analysis" horizontal bar chart.
>
> What it shows: Outstanding invoices grouped by how overdue they are.
>
> Aging buckets (from healthiest to most critical):
> - Not Yet Due (green) — invoices still within payment terms
> - 1-30 Days overdue (yellow)
> - 31-60 Days overdue (orange)
> - 61-90 Days overdue (light red)
> - 91-120 Days overdue (red)
> - 120+ Days overdue (dark red) — highest risk of write-off
>
> The chart also supports views by Sales Agent and by Customer Type.
>
> Evaluate:
> - What proportion of outstanding is "Not Yet Due" vs overdue?
> - Is the distribution skewed toward older buckets (bad) or newer (okay)?
> - Are there large amounts in the 120+ bucket (potential bad debt)?
>
> Provide a concise analysis of the aging distribution.

**Component Prompt — `credit_usage_distribution`:**

> You are analyzing the "Credit Usage Distribution" donut chart.
>
> What it shows: How customers are distributed across credit usage categories.
>
> Categories:
> - Within Limit (< 80% usage) — green, healthy
> - Near Limit (>= 80% and < 100%) — yellow, watch closely
> - Over Limit (> 100%) — red, policy breach
> - No Limit Set — gray, uncontrolled credit risk
>
> Credit Usage % = Total Outstanding / Credit Limit x 100
>
> Evaluate:
> - What % of customers with limits are over or near limit?
> - How many customers have no limit set (uncontrolled risk)?
> - Is the "Over Limit" segment growing?
>
> Provide a concise analysis of the credit utilization distribution.

**Component Prompt — `customer_credit_health`:**

> You are analyzing the "Customer Credit Health" table.
>
> What it shows: A comprehensive per-customer view with 11 columns: Code, Name, Type, Agent, Credit Limit, Outstanding, Credit Used %, Aging Count, Oldest Due, Health Score (0-100), Risk Level.
>
> Credit Health Score is calculated from 4 weighted factors:
> - Credit Usage (40%): How much of limit is used
> - Overdue Days (30%): Age of oldest overdue invoice
> - Payment Timeliness (20%): Average days late on payments
> - Double Breach (10%): Both credit and overdue limits exceeded
>
> Risk Tiers: Low (>=75, green), Moderate (31-74, yellow), High (<=30, red)
>
> Evaluate:
> - Distribution across risk tiers (how many high vs low risk?)
> - Top offenders by outstanding amount and risk score
> - Any patterns by customer type or sales agent?
> - Customers with high outstanding but no credit limit set
>
> Provide a concise analysis of the customer credit health landscape. Do not list every customer — focus on patterns and outliers.

---

### 5.3 Sales Trend

| | |
|---|---|
| **Section Key** | `sales_trend` |
| **Page** | sales |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_sales_daily |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| sales_summary | Sales Summary | kpi | Net Sales = Invoice + Cash − Credit Notes | CN ratio: ≤1% Good, 1–3% Monitor, >3% Concern |
| net_sales_trend | Net Sales Trend | chart | Stacked bar: Invoice + Cash − CN over time | 3+ months growth = Good, 3+ decline = Bad |

**Component Prompt — `sales_summary`:**

> You are analyzing the "Sales Summary" KPI on the Sales page.
>
> What it measures: Net Sales and its breakdown — Invoice Sales, Cash Sales, and Credit Notes.
> Formula: Net Sales = Invoice Sales + Cash Sales - Credit Notes
>
> Evaluate:
> 1. Net Sales level — is the total healthy for this business?
> 2. Invoice vs Cash ratio — invoice >= 90% of net is normal for a distribution business with credit customers. A dropping ratio may signal a shift toward cash/retail or loss of credit customers.
> 3. Cash sales context — higher cash = lower credit risk and faster cash flow, but may signal smaller/retail customers.
> 4. Credit notes as % of gross sales:
>    - <= 1% = Good (normal returns)
>    - 1-3% = Monitor
>    - > 3% = Concern (quality/accuracy issues)
>
> Provide a concise analysis covering all four metrics.

**Component Prompt — `net_sales_trend`:**

> You are analyzing the "Net Sales Trend" stacked bar chart.
>
> What it shows:
> - Dark blue bars = Invoice Sales per period
> - Green bars (stacked on top) = Cash Sales per period
> - Red bars (below zero line) = Credit Notes per period
> - Combined height above zero = Net Sales
>
> Granularity can be Daily, Weekly, or Monthly.
>
> Performance thresholds for trend:
> - 3+ consecutive months of growth = Good
> - Flat or mixed = Neutral
> - 3+ consecutive months of decline = Bad
>
> Look for: seasonal spikes (e.g., festive periods), unusual credit note months, the ratio of cash vs invoice changing over time.
>
> Provide a concise analysis of the sales trend pattern. Flag any significant anomalies (spikes or drops >20% from average) for the summary to investigate.

---

### 5.4 Sales Breakdown

| | |
|---|---|
| **Section Key** | `sales_breakdown` |
| **Page** | sales |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_sales_by_customer, pc_sales_by_fruit, pc_sales_by_outlet, pc_sales_daily |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| by_customer | Sales by Customer | breakdown | Top customers by net sales | Top 1 <15% = Good, >25% = Bad |
| by_product | Sales by Product | breakdown | Top products by net sales | Top 1 <20% = Good, >35% = Bad |
| by_agent | Sales by Agent | breakdown | Agent performance comparison | Evaluate spread and decline |
| by_outlet | Sales by Outlet | breakdown | Location-based sales | No single outlet >50% |

**Component Prompt — `by_customer`:**

> You are analyzing the "Sales by Customer" breakdown.
>
> What it shows: Net sales broken down by customer with columns for Code, Customer Name, Customer Type, Net Sales, Invoice Sales, Cash Sales, and Credit Note Amount.
>
> Performance thresholds:
> - Top customer < 15% of total net sales = Good (diversified)
> - Top customer 15-25% of total = Neutral (moderate concentration)
> - Top customer > 25% of total = Bad (over-reliance risk)
>
> Evaluate:
> - Revenue concentration: are a few customers dominating?
> - Customer type distribution: healthy mix or over-reliant on one type?
> - Any customers with disproportionately high credit notes?
>
> Provide a concise analysis. Focus on concentration risk and patterns.

**Component Prompt — `by_product`:**

> You are analyzing the "Sales by Product" breakdown.
>
> What it shows: Net sales broken down by fruit product with columns for Product Name, Country, Variant, Net Sales, and Qty Sold.
>
> Performance thresholds:
> - Top product < 20% of total net sales = Good (diversified)
> - Top product 20-35% of total = Neutral
> - Top product > 35% of total = Bad (product concentration risk)
>
> Evaluate:
> - Product concentration: is revenue spread across products or dominated by 1-2 items?
> - Country of origin diversity: over-reliance on one source country?
> - High quantity but low revenue products (margin concern)
>
> Provide a concise analysis.

**Component Prompt — `by_agent`:**

> You are analyzing the "Sales by Sales Agent" breakdown.
>
> What it shows: Net sales per sales agent with columns for Agent Name, Active status, Net Sales, Invoice Sales, Cash Sales, and Customer Count.
>
> Evaluate:
> - Performance spread: is one agent carrying the team or is it balanced?
> - Inactive agents with significant recent sales (data quality issue?)
> - Customer count vs sales volume: agents with many customers but low sales may be underperforming
> - Any agent declining > 10% vs prior period = flag as concern
>
> Provide a concise analysis. Focus on performance distribution.

**Component Prompt — `by_outlet`:**

> You are analyzing the "Sales by Outlet" breakdown.
>
> What it shows: Net sales per outlet/location with columns for Location, Net Sales, Invoice Sales, Cash Sales, and Credit Note Amount.
>
> Performance thresholds:
> - No single outlet > 50% of total = Good (geographic diversification)
> - One outlet > 50% = Concern (geographic concentration risk)
>
> Evaluate:
> - Geographic spread: balanced or concentrated?
> - Any outlets with unusually high credit notes vs sales ratio?
> - "(Unassigned)" outlet percentage: data quality indicator
>
> Provide a concise analysis.

---

### 5.5 Customer Margin Overview

| | |
|---|---|
| **Section Key** | `customer_margin_overview` |
| **Page** | customer-margin |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_customer_margin |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| cm_net_sales | Net Sales | kpi | Period net sales across active customers | Growth >5% = Good, Decline = Bad |
| cm_cogs | Cost of Sales | kpi | Landed cost of goods sold | COGS rising faster than sales = margin pressure |
| cm_gross_profit | Gross Profit | kpi | Net Sales minus COGS | Growing with sales = Good |
| cm_margin_pct | Gross Margin % | kpi | GP / Net Sales x 100 | ≥15% = Good, 10–15% = Neutral, <10% = Bad |
| cm_active_customers | Active Customers | kpi | Distinct active customer count | Stability is baseline |
| cm_margin_trend | Profitability Trend | chart | Monthly GP bars + Margin % line | 3+ months GP growth = Good |
| cm_margin_distribution | Customer Margin Distribution | chart | Customers by margin % bucket | Most in 10–20% = Healthy |

**Component Prompt — `cm_net_sales`:**

> You are analyzing the "Net Sales" KPI on the Customer Margin overview.
>
> What it measures: Total net sales for the selected period, with prior-period comparison.
>
> Performance thresholds:
> - Growth > 5% = Good
> - Growth 0-5% = Neutral
> - Decline = Bad
> - Decline > 10% = Flag
>
> Evaluate the current value and the period-over-period delta. Cite the RM delta and percentage change.
>
> Provide a concise analysis of this metric.

**Component Prompt — `cm_cogs`:**

> You are analyzing the "Cost of Goods Sold (COGS)" KPI on the Customer Margin overview.
>
> What it measures: Total landed cost of goods sold, with prior-period comparison.
>
> Context: For a fruit distribution business, COGS is typically 80-90% of Net Sales. COGS rising faster than Net Sales signals margin compression.
>
> Evaluate:
> - COGS-to-Net-Sales ratio
> - Whether COGS delta is outpacing Net Sales delta (margin compression signal)
> - Do NOT evaluate COGS in isolation — always frame it relative to Net Sales.
>
> Provide a concise analysis of this metric.

**Component Prompt — `cm_gross_profit`:**

> You are analyzing the "Gross Profit" KPI on the Customer Margin overview.
>
> What it measures: Net Sales minus COGS, with prior-period comparison.
>
> Performance thresholds:
> - GP growing while Net Sales also grows = Good
> - GP flat while Net Sales grows = Neutral (margin erosion)
> - GP declining while Net Sales grows = Bad (cost pressure)
> - GP declining while Net Sales declines = Bad (volume loss)
>
> The key signal is whether Gross Profit is growing faster or slower than Net Sales — this reveals pricing power. Cite the RM delta and percentage change.
>
> Provide a concise analysis of this metric.

**Component Prompt — `cm_margin_pct`:**

> You are analyzing the "Gross Margin %" KPI on the Customer Margin overview.
>
> What it measures: Gross Profit as a percentage of Net Sales, with prior-period comparison.
>
> Performance thresholds (fruit distribution benchmarks):
> - Margin % >= 15% = Good
> - Margin % 10-15% = Neutral
> - Margin % < 10% = Bad
>
> Evaluate the current margin level vs benchmarks and the period-over-period margin delta in percentage points.
>
> Provide a concise analysis of this metric.

**Component Prompt — `cm_active_customers`:**

> You are analyzing the "Active Customers" KPI on the Customer Margin overview.
>
> What it measures: Count of distinct active customers with activity in the selected period, with prior-period comparison.
>
> Context: Stability is the baseline — steady numbers are healthy for a mature distribution business. Changes matter more than the absolute number.
>
> Evaluate:
> - Period-over-period change in customer count
> - Whether the count correlates with Net Sales movement (fewer customers but steady sales = revenue concentrating)
>
> Provide a concise analysis of this metric.

**Component Prompt — `cm_margin_trend`:**

> You are analyzing the "Margin Trend" chart on the Customer Margin overview.
>
> What it shows:
> - Bars = Gross Profit (RM, left axis) per month
> - Line = Gross Margin % (right axis) per month
> - Granularity is fixed to monthly — the chart has no granularity selector.
>
> The chart answers two questions at once:
> - Is the business making more or less profit in absolute terms?
> - Is it getting more or less efficient at converting sales into profit?
>
> Performance thresholds:
> - 3+ consecutive months of Gross Profit growth = Good
> - Flat or mixed = Neutral
> - 3+ consecutive months of Gross Profit decline = Bad
> - Margin % trending down for 2+ consecutive months warrants flagging even if Gross Profit is flat.
>
> Look for:
> - Divergence between bars and line (e.g., profit rising while margin % stays flat = growth via volume, not pricing)
> - Seasonal patterns (festive months typically show different mix)
> - Any month where Gross Profit and Margin % move in opposite directions — always worth calling out
>
> Cite specific months from the pre-fetched monthly breakdown when making claims. Do not invent values.
>
> Provide a concise analysis of the margin trend pattern with evidence.

**Component Prompt — `cm_margin_distribution`:**

> You are analyzing the "Margin Distribution" histogram on the Customer Margin overview.
>
> What it shows: Count of customers falling into each Gross Margin % bucket for the selected period. Buckets are fixed:
>   < 0%, 0-5%, 5-10%, 10-15%, 15-20%, 20-30%, 30%+
>
> Population: only customers with > RM 1,000 of total revenue in the period are included (small-volume customers are excluded to avoid noise). There is no bucket-size selector.
>
> Performance thresholds:
> - Customers in < 0% bucket = selling at a loss (worth flagging if > 0)
> - Majority of customers in 10-20% band = Healthy (matches overall target)
> - Heavy concentration (> 40% of customers) in sub-10% bands = Bad (portfolio is thin-margin)
> - A meaningful tail (> 15%) in the 20%+ bands = Good (premium segment exists)
>
> Evaluate:
> - Shape of the distribution (left-skewed, centered, right-skewed)
> - Proportion of customers below 10% margin
> - Presence and size of the loss-making bucket
> - Whether the distribution is consistent with the overall Margin % KPI (a 16% overall margin with most customers sub-10% means a few large accounts are carrying the portfolio — concentration risk)
>
> Provide a concise analysis focused on distribution shape and concentration.

---

### 5.6 Customer Margin Breakdown

| | |
|---|---|
| **Section Key** | `customer_margin_breakdown` |
| **Page** | customer-margin |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_customer_margin |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| cm_top_customers | Top Customers | chart | Top 10 by GP (RM) and by Margin % (efficiency) | Top 1 >15% GP = concentration risk |
| cm_customer_table | Customer Analysis Table | table | Full customer table with revenue, COGS, GP, Margin %, Return Rate | Loss-makers >10% = Bad |
| cm_credit_note_impact | Credit Note Impact | table | Customers ranked by margin erosion from credit notes | Top 5 >50% total margin lost = Concentrated CN problem |

**Component Prompt — `cm_top_customers`:**

> You are analyzing the "Top Customers" chart on the Customer Margin breakdown.
>
> What it shows:
> - The pre-fetched data contains TWO ranked lists of the period's top 10 customers:
>   (A) Top 10 by Gross Profit (absolute RM contribution)
>   (B) Top 10 by Gross Margin % (efficiency, filtered to customers with at least RM 10,000 revenue)
> - The UI lets users toggle between these two lenses plus a "highest/lowest" direction. Your analysis should cover both lenses.
>
> Performance thresholds:
> - Top customer > 15% of total period Gross Profit = Bad (concentration risk — losing them would hurt badly)
> - Top 10 > 60% of total period Gross Profit = Bad (concentrated portfolio)
> - Top 10 < 40% of total period Gross Profit = Good (diversified)
> - Any top-by-profit customer with margin % < 10% = Flag (thin-margin anchor)
> - Any top-by-margin customer with revenue < RM 50,000 = Niche premium segment (worth protecting but not load-bearing)
>
> Evaluate:
> - Revenue-vs-margin polarity: which customers are the RM anchors, which are the efficiency leaders, and is there overlap?
> - Concentration risk: how much of the period's total Gross Profit is held by the top 1, top 3, top 10?
> - Customer type / sales agent patterns across the top lists (if the data block surfaces them)
> - Any customer appearing on BOTH lists (high profit AND high margin) = star account — call them out by name.
>
> Cite named customers from the pre-fetched data. Do not invent names or numbers.
>
> Provide a concise analysis focused on concentration, quality of top accounts, and any over-reliance risk.

**Component Prompt — `cm_customer_table`:**

> You are analyzing the "Customer Margin Table" on the Customer Margin breakdown.
>
> What it shows:
> - Bottom 10 customers by Gross Profit (the worst performers, including loss-makers)
> - Margin distribution: how customers are spread across margin buckets
>
> Performance thresholds:
> - Loss-making customers > 10% of active count = Bad (unhealthy tail)
> - Any bottom-10 customer with revenue > RM 100,000 AND negative margin = Critical flag
> - High concentration in < 10% margin buckets = Portfolio margin risk
>
> Evaluate:
> - The bottom tail: who is losing money, and is the problem big (high-revenue loss-makers) or small?
> - Customer type / sales agent clustering in the bottom 10
> - Whether the bottom 10 have unusually high return rates
> - Distribution shape: is the portfolio clustered in healthy (>15%) or thin (<10%) buckets?
>
> Cite named customers from the pre-fetched bottom block. Do not invent names.
>
> Provide a concise analysis focused on the at-risk tail and portfolio margin distribution.

**Component Prompt — `cm_credit_note_impact`:**

> You are analyzing the "Credit Note Impact on Margins" table.
>
> What it shows: Customers ranked by how much credit notes eroded their margin, with columns for Code, Name, Invoice Revenue, CN Revenue, Return Rate %, Margin Before CN, Margin After CN, and Margin Lost (percentage points).
>
> Pre-fetched data contains the top 25 customers by Margin Lost (the most-affected accounts) plus aggregate roll-ups: total margin lost across the full top-100 list, top-5 share of total margin lost, count of customers with return rate > 5%, and average margin lost.
>
> Performance thresholds:
> - Top 5 customers > 50% of total margin lost = Bad (concentrated CN problem — fix the top offenders first)
> - Any customer with return rate > 10% = Bad (excessive returns, likely quality or operational issue)
> - Any customer with margin_lost > 10 percentage points = Severe impact
> - Customers with high CN revenue but margin_lost < 2 points = Acceptable (they return a lot but costs are recovered)
>
> Evaluate:
> - Concentration of the CN problem: is it one or two serial returners, or spread across many customers?
> - Relationship between return rate and margin lost (high return rate but low margin lost suggests the credit notes are on low-margin items — a different problem than high-margin returns)
> - Any customer type or sales agent clustering in the top 25 worst-impacted
> - Whether return rates look normal (<3% for most) or systemic (>5% across many customers = upstream quality problem)
>
> Cite named customers from the pre-fetched top 25. Do not invent names.
>
> Provide a concise analysis focused on which accounts to investigate first.

---

### 5.7 Supplier Margin Overview

| | |
|---|---|
| **Section Key** | `supplier_margin_overview` |
| **Page** | supplier-performance |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_supplier_margin |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| sp_net_sales | Est. Net Sales | kpi | Sales revenue attributed to active suppliers | Growth ≥5% = Good, Drop >10% = Flag |
| sp_cogs | Est. Cost of Sales | kpi | Attributed COGS from active suppliers | Rising COGS NOT automatically bad on supplier page |
| sp_gross_profit | Est. Gross Profit | kpi | Est. Net Sales minus Est. COGS | Growing with sales = Good |
| sp_margin_pct | Gross Margin % | kpi | Est. GP / Est. Net Sales x 100 | ≥15% = Good, <10% = Bad, ≥2pp drop = Flag |
| sp_active_suppliers | Active Suppliers | kpi | Distinct suppliers with purchase activity | Shrinking NOT automatically bad (consolidation) |
| sp_margin_trend | Profitability Trend | chart | Monthly Est. GP bars + Margin % line | 3+ months GP growth = Good |
| sp_margin_distribution | Margin Distribution | chart | Suppliers AND Items by margin % bucket | Both views analyzed |

**Component Prompt — `sp_net_sales`:**

> You are analyzing the "Est. Net Sales" KPI on the Supplier Performance overview.
>
> What it measures: Total sales revenue attributed to items sourced from active suppliers during the selected period.
> Formula: SUM(sales_revenue) from pc_supplier_margin where is_active = 'T'.
>
> Context:
> - This is the Supplier Performance view of revenue — it mirrors the Customer Margin Net Sales figure when no filters are applied, but may diverge when supplier/item-group filters are in play.
> - The "Est." prefix is intentional: the number is constructed from the supplier-margin pre-compute pipeline and is not the raw invoice figure.
>
> Performance thresholds:
> - Month-over-month growth ≥ 5% = Good
> - Month-over-month growth 0% to 5% = Neutral
> - Month-over-month decline < 0% = Bad
> - A drop > 10% in a single period warrants flagging
>
> Evaluate the level and, if prior-period data is included in the pre-fetched block, the direction. Comment on whether the period is tracking above or below the trailing baseline.
>
> Provide a concise analysis of this metric.

**Component Prompt — `sp_cogs`:**

> You are analyzing the "Est. Cost of Sales" KPI on the Supplier Performance overview.
>
> What it measures: Attributed cost of goods sold, summed across items from active suppliers for the period.
> Formula: SUM(attributed_cogs) from pc_supplier_margin where is_active = 'T'.
>
> Context — supplier page framing:
> - On a supplier page, rising COGS is NOT automatically bad. It can mean the business is shifting volume toward a preferred supplier whose goods cost more but carry better margin, reliability, or commercial terms.
> - Always frame COGS against Est. Net Sales and against supplier concentration signals in the pre-fetched block, never in isolation.
> - Bad signals: COGS rising faster than Est. Net Sales AND margin % falling (true cost pressure). Flat revenue + rising COGS = real margin erosion.
> - Neutral/Good signal: COGS rising with Est. Net Sales keeping pace, margin % stable or up = healthy growth, potentially a beneficial sourcing shift.
>
> Evaluate:
> - Period COGS level
> - COGS-to-Net-Sales ratio
> - Whether the ratio is widening or holding
>
> Do NOT call rising COGS "bad" without checking the Net Sales direction and the margin % direction in the same pre-fetched block.
>
> Provide a concise analysis of this metric.

**Component Prompt — `sp_gross_profit`:**

> You are analyzing the "Est. Gross Profit" KPI on the Supplier Performance overview.
>
> What it measures: Est. Net Sales minus Est. Cost of Sales for the period, derived from the supplier-margin pre-compute.
> Formula: Est. Net Sales − Est. Cost of Sales.
>
> Performance thresholds:
> - Gross Profit growing ≥ 5% while Est. Net Sales also grows = Good
> - Gross Profit flat while Est. Net Sales grows = Neutral (watch for erosion)
> - Gross Profit declining while Est. Net Sales grows = Bad (cost pressure or sourcing mix shifting to lower-margin suppliers)
> - Gross Profit declining while Est. Net Sales declines = Bad (volume loss)
>
> Evaluate:
> - Absolute Gross Profit level
> - Direction vs prior period
> - Whether Gross Profit is growing faster/slower than Est. Net Sales — the most important signal on the supplier page, because it reveals whether the current supplier mix is actually delivering margin or just volume
>
> Provide a concise analysis of this metric.

**Component Prompt — `sp_margin_pct`:**

> You are analyzing the "Gross Margin %" KPI on the Supplier Performance overview.
>
> What it measures: Est. Gross Profit as a percentage of Est. Net Sales.
> Formula: (Est. Gross Profit / Est. Net Sales) x 100.
>
> Performance thresholds (fruit distribution, supplier-side):
> - Margin % ≥ 15% = Good
> - Margin % 10% to 15% = Neutral
> - Margin % < 10% = Bad
> - A drop ≥ 2 percentage points vs the prior period warrants flagging, regardless of absolute level
>
> Evaluate:
> - Current margin level vs the benchmark bands
> - Direction vs prior period (a healthy margin trending down is still worth flagging — on a supplier page this usually means upstream price pressure)
> - Whether movement is driven by Net Sales change, COGS change, or a sourcing mix shift (the pre-fetched block will contain both numerators and denominators)
>
> Provide a concise analysis of this metric.

**Component Prompt — `sp_active_suppliers`:**

> You are analyzing the "Active Suppliers" KPI on the Supplier Performance overview.
>
> What it measures: Count of distinct suppliers with any purchase quantity during the selected period (is_active = 'T' AND purchase_qty > 0).
> Formula: COUNT(DISTINCT creditor_code) where the supplier had a non-zero purchase_qty in the period.
>
> Context — supplier page framing:
> - Unlike Customer Active count, a shrinking supplier count is NOT automatically bad. Consolidation often means the business is concentrating volume with better-performing suppliers to gain negotiating leverage or simplify logistics.
> - Growing supplier count can be good (sourcing diversification, new product lines) OR bad (reactive scrambling after a preferred supplier issue).
> - Sudden large drops are the one clear flag — they may indicate a supplier dropping out, a purchasing freeze, or a data/pipeline problem.
>
> Performance thresholds:
> - Month-over-month change within ±5% = Normal (noise)
> - Gentle decline (−5% to −10%) = Neutral (possible deliberate consolidation)
> - Drop > 10% = Flag (verify whether consolidation or disruption)
> - Sudden growth > 15% = Flag (worth asking why — new sourcing initiative or emergency substitution?)
>
> Evaluate:
> - Direction of change
> - Whether the change correlates with Gross Margin % movement (consolidation that ALSO improves margin = a good story; consolidation with flat or falling margin = concentration risk without the payoff)
>
> Provide a concise analysis of this metric.

**Component Prompt — `sp_margin_trend`:**

> You are analyzing the "Profitability Trend" chart on the Supplier Performance overview.
>
> What it shows:
> - Bars = Est. Gross Profit (RM, left y-axis) per month
> - Line = Gross Margin % (right y-axis) per month
> - Granularity is fixed to monthly — this chart has no granularity selector on the overview cluster.
>
> The chart answers two questions simultaneously:
> - Is the sourcing mix delivering more or less profit in absolute terms?
> - Is the business getting more or less efficient at converting purchases into profit?
>
> Performance thresholds:
> - 3+ consecutive months of Gross Profit growth = Good
> - Flat or mixed = Neutral
> - 3+ consecutive months of Gross Profit decline = Bad
> - Margin % trending down for 2+ consecutive months warrants flagging even if Gross Profit is flat (a slow-moving sourcing problem)
>
> Look for:
> - Divergence between bars and line (e.g., profit rising while margin % stays flat = growth via volume, not pricing leverage)
> - Seasonal patterns (fruit distribution has clear festive peaks and lean months — don't mistake seasonality for structural movement)
> - Any month where Gross Profit and Margin % move in opposite directions — always worth calling out on a supplier page, because it usually points at a sourcing mix shift
>
> Use the pre-fetched monthly breakdown to cite specific months when making claims. Do not invent values not present in the data block.
>
> Provide a concise analysis of the profitability trend with evidence.

**Component Prompt — `sp_margin_distribution`:**

> You are analyzing the "Margin Distribution" histogram on the Supplier Performance overview.
>
> What it shows: Count of entities (suppliers OR items) falling into each Gross Margin % bucket for the selected period. Buckets are fixed:
>   < 0%, 0-5%, 5-10%, 10-15%, 15-20%, 20-30%, 30%+
>
> IMPORTANT — this chart has an entity toggle (Suppliers / Items). The user may be viewing either view when they open the analysis. The pre-fetched block contains BOTH distributions (counts per bucket for suppliers AND for items). Analyze both and contrast them; do not assume one specific view.
>
> Performance thresholds:
> - Entities in < 0% bucket = sourcing at a loss (always flag if > 0)
> - Majority clustered in 10-20% band = Healthy (matches overall target)
> - Heavy concentration (> 40%) in sub-10% bands = Bad (thin-margin sourcing)
> - A meaningful tail (> 15%) in the 20%+ bands = Good (premium sourcing)
>
> Contrast the supplier view vs the item view:
> - Supplier view skewed healthy but item view skewed thin = a few premium suppliers are carrying a long tail of weak items — procurement ought to question the tail
> - Item view skewed healthy but supplier view skewed thin = good products sourced through mostly weak suppliers — the issue is commercial terms, not the product mix
> - Both views skewed the same direction = the story is consistent; the weak/strong pattern is structural
>
> Evaluate:
> - Shape of both distributions (left-skewed, centered, right-skewed, bimodal)
> - Proportion below 10% margin in each view
> - Presence and size of the loss-making (< 0%) bucket in each view
> - Whether the supplier view and item view tell the same story or diverge — divergence is the most actionable signal on this chart
>
> Provide a concise analysis focused on distribution shape, concentration, and the contrast between the supplier and item views.

---

### 5.8 Supplier Margin Breakdown

| | |
|---|---|
| **Section Key** | `supplier_margin_breakdown` |
| **Page** | supplier-performance |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_supplier_margin, raw invoice/cash-sale line items |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| sm_top_bottom | Top/Bottom Suppliers & Items | chart | Top/Bottom 10 for suppliers AND items by GP | Top 1 >15% GP = concentration |
| sm_supplier_table | Supplier Analysis Table | table | Full supplier table with revenue, COGS, GP, Margin % | Top 10 >60% revenue = concentrated |
| sm_item_pricing | Item Price Comparison | breakdown | Per-supplier pricing for highest-revenue item | Margin spread >10pp = arbitrage |
| sm_price_scatter | Purchase vs Selling Price | chart | Item scatter: purchase price vs sell price vs revenue | Top-50 items margin <0 = Always flag |

**Component Prompt — `sm_top_bottom`:**

> You are analyzing the "Top/Bottom Suppliers & Items" chart on the Supplier Performance breakdown.
>
> What it shows:
> - The pre-fetched data contains 4 tables sorted by Est. Gross Profit:
>   (A) Top 10 suppliers by Est. Gross Profit
>   (B) Bottom 10 suppliers by Est. Gross Profit
>   (C) Top 10 items by Est. Gross Profit
>   (D) Bottom 10 items by Est. Gross Profit
>
> Performance thresholds:
> - Top 1 supplier > 15% of period Est. Gross Profit = Bad (supplier concentration risk)
> - Top 10 suppliers > 60% of period Est. Gross Profit = Bad (concentrated sourcing)
> - Top 10 suppliers < 40% of period Est. Gross Profit = Good (diversified sourcing)
> - Any bottom-list supplier with profit < 0 = Critical (sourcing at a loss)
> - Any bottom-list item with profit < 0 AND meaningful revenue = Flag (product-level loss-maker)
>
> Evaluate:
> - Supplier-side vs item-side concentration
> - Loss-makers: which are bigger problems — loss-making suppliers or loss-making items?
> - Item group or supplier clustering in the bottom lists
>
> Cite named suppliers and items from the pre-fetched data. Do not invent names or numbers.
>
> Provide a concise analysis focused on concentration, quality of the top contributors, and loss-maker exposure.

**Component Prompt — `sm_supplier_table`:**

> You are analyzing the "Supplier Analysis Table" on the Supplier Performance breakdown.
>
> What it shows:
> - A sortable, paginated table of every active supplier in the period with columns for Code, Name, Type, Items, Revenue, COGS, Gross Profit, Margin %.
> - The pre-fetched data gives you:
>   (A) Top 10 suppliers by Revenue (biggest sourcing partners)
>   (B) Bottom 10 suppliers by Margin % with revenue >= RM 10,000 (weak-margin partners that still carry meaningful volume)
>   (C) Aggregate roll-ups: total supplier count, loss-making supplier count, top-10 share of revenue, median margin %, avg revenue per supplier, thin-margin (< 5%) supplier count.
>
> Performance thresholds:
> - Top 10 share of revenue > 60% = Bad (concentrated sourcing)
> - Top 10 share of revenue 40-60% = Neutral (typical for distribution)
> - Loss-making suppliers (margin % < 0) > 0 = Always flag; name them
> - Thin-margin suppliers (margin % < 5%) > 10% of active count = Portfolio quality concern
> - Any bottom-10 supplier with revenue > RM 100,000 AND margin % < 5 = Critical (big volume, thin margin)
>
> Evaluate:
> - Concentration: how much of the revenue sits with the top few suppliers?
> - Bottom-margin tail: is the problem one or two big thin-margin suppliers, or a long tail?
> - Supplier type clustering in the bottom 10 (do weak-margin suppliers share a category?)
> - Whether the biggest revenue suppliers are also the best margin suppliers — mismatches are the actionable signal.
>
> Cite named suppliers from the pre-fetched top/bottom blocks. Do not invent.
>
> Provide a concise analysis focused on sourcing concentration and the at-risk thin-margin tail.

**Component Prompt — `sm_item_pricing`:**

> You are analyzing the "Item Price Comparison" panel on the Supplier Performance breakdown.
>
> What it shows:
> - Per-supplier purchase-price comparison for a SINGLE anchor item. The UI lets the user pick any item; for this analysis the anchor is the item with the highest purchase_total in the selected period (named in the pre-fetched block).
> - The pre-fetched data gives you:
>   (A) Top 5 suppliers for the anchor item by purchase volume, with avg purchase price, estimated sell price, and estimated margin %.
>   (B) Period totals for the anchor item: total purchased qty, total purchase RM, avg purchase price across all suppliers, min / max purchase price (best / worst supplier on price).
>   (C) Cross-supplier margin % spread on the anchor item (best minus worst).
>
> Note: the estimated sell price is derived from raw invoice + cash-sale line items (or a pre-compute fallback when raw tables are unavailable). Margin estimates are therefore anchor-item-specific, not business-wide.
>
> Performance thresholds:
> - Margin % spread across suppliers > 10 percentage points = Significant sourcing arbitrage opportunity
> - Any supplier's estimated margin % < 0 on the anchor item = Loss-making on that item — flag
> - Cheapest supplier carries > 50% of the item's purchase volume = Procurement already on best price — neutral
> - Cheapest supplier carries < 20% of the item's purchase volume = Concentration on a more expensive supplier — flag
>
> Evaluate:
> - Whether the volume leader is also the price leader (aligned procurement) or not (arbitrage risk)
> - How wide the price spread is across suppliers for the same item — wide spreads are either a quality / grade difference or a procurement failure
> - The margin spread across suppliers on this one item — if it is large, shifting volume could improve overall margin
> - Whether the same supplier delivers the best (or worst) estimated margin
>
> Do NOT generalize about the business from a single anchor item. Frame conclusions as "for this anchor item specifically...". The summary layer may drill other items via tools.
>
> Cite suppliers by name from the pre-fetched block. Do not invent numbers.
>
> Provide a concise analysis focused on price alignment and margin arbitrage on the anchor item.

**Component Prompt — `sm_price_scatter`:**

> You are analyzing the "Purchase vs Selling Price" scatter chart on the Supplier Performance breakdown.
>
> What it shows:
> - One dot per item: x = avg purchase price, y = avg selling price, size = revenue in the period.
> - The UI samples the full universe; the pre-fetched data carries the TOP 50 items by revenue (the items that actually move the P&L) plus a bucketed margin % distribution across the full universe.
>
> Pre-fetched data contains:
> (A) Top 50 items by revenue: item code, name, suppliers (names), avg purchase price RM, avg selling price RM, margin %, revenue RM
> (B) Margin bucket distribution over the full item universe: counts of items with margin % < 0, 0-5, 5-10, 10-20, 20+
> (C) Loss-maker counts: items with margin % < 0 inside the top-50 AND across the full universe
> (D) Universe size: total items in the scatter pool
>
> Performance thresholds:
> - Top-50 items with margin % < 0 = Always flag (these items move the P&L)
> - More than 20% of universe items in the < 5% bucket = Thin-margin product catalog
> - Meaningful tail (> 10% of universe) in the 20+ bucket = Premium product pocket worth protecting
> - Any top-50 item with margin % < 0 AND revenue > RM 100,000 = Severe (fixing one item moves the needle)
>
> Evaluate:
> - Shape of the bucket distribution (left-skewed loss, centered thin, right-skewed premium, bimodal)
> - Price-spread outliers in the top-50: items where purchase price is unusually high or low relative to selling price
> - Named loss-making items in the top-50 (call them out with supplier names and the RM revenue)
> - Whether the same suppliers appear repeatedly in the loss-making items (structural supplier quality issue) or whether it is spread across many suppliers (item-level problem)
>
> Cite items by name from the pre-fetched top-50 block. Do not invent.
>
> Provide a concise analysis focused on loss-making items, price-spread outliers, and the shape of the margin distribution.

---

### 5.9 Return Trends

| | |
|---|---|
| **Section Key** | `return_trend` |
| **Page** | return |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_return_monthly, pc_return_products |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| rt_total_returns | Total Returns | kpi | Period return value + CN count | Return rate: <2% = Good, >5% = Concern |
| rt_settled | Settled | kpi | Returns resolved (knock-off + refund) | Knock-off >70% = Healthy, Refund >30% = Concern |
| rt_unsettled | Unsettled | kpi | Unresolved return value | <15% = Healthy, >30% = Concern |
| rt_return_pct | Return % | kpi | Return value / Net Sales x 100 | <2% = Green, 2–5% = Amber, >5% = Red |
| rt_settlement_breakdown | Settlement Breakdown | chart | Three-channel: Knock-off / Refund / Unsettled | Knock-off >70% = Healthy |
| rt_monthly_trend | Monthly Return Trend | chart | Return value + Unsettled by month | Unsettled rising while value flat = Process issue |
| rt_product_bar | Top Returns by Item | chart | Top 10 items by frequency AND value | Top 1 >15% return value = Severe |

**Component Prompt — `rt_total_returns`:**

> You are analyzing the "Total Returns" KPI on the Returns page.
>
> What it measures: Total return value (RM) in the selected period, plus the number of return credit notes issued. This is a period flow — activity within the date range, not a point-in-time balance.
>
> The pre-fetched data gives you:
> - Total return value (RM) in the period
> - Return count (number of credit notes)
> - Period net sales (RM) for context
> - Return rate % (return value / net sales)
> - Avg return value per CN (RM)
>
> Performance thresholds (return rate %):
> - < 2% = Healthy — normal wastage / quality tolerance for fruit distribution
> - 2% to 5% = Watch — investigate if rising
> - > 5% = Concern — quality, sourcing, or handling problem
>
> Evaluate:
> - Scale of returns relative to net sales (the return rate % is the anchor)
> - Whether the return count implies small-frequent or large-infrequent returns (avg per CN)
> - Whether the period is unusually high or low vs a typical fruit-distribution wastage rate
>
> Cite the return value, count, and return rate verbatim from the data block.
>
> Provide a concise analysis of period return exposure.

**Component Prompt — `rt_settled`:**

> You are analyzing the "Settled" KPI on the Returns page.
>
> What it measures: How much of the total return exposure has been resolved — either by knocking it off against future invoices (non-cash) or by refunding cash / cheque.
>
> The pre-fetched data gives you:
> - Total settled (RM) = knocked off + refunded
> - Total knocked off (RM) — offset against outstanding or future invoices, NO cash leaves the door
> - Total refunded (RM) — actual cash / cheque paid back to the customer
> - Settled % of return value
> - Knock-off % and Refund % individually
> - Refund count (number of refund transactions)
>
> Thresholds:
> - Knock-off % > 70% of return value = Healthy settlement mix (no cash leakage)
> - Refund % > 30% of return value = Concern — returns are draining cash rather than being absorbed into future invoices
> - Any refund-dominant mix with a high absolute refund total = flag as working-capital pressure
>
> Business context — CRITICAL:
> - Knock-off is the PREFERRED settlement channel for a distribution business. It converts the return into an offset against future sales — no cash leaves the bank.
> - Refund means actual cash paid back. It erodes working capital and is only appropriate when the customer relationship is ending or the customer has no upcoming invoices.
>
> Evaluate:
> - The balance between knock-off and refund — is the mix cash-efficient (knock-off heavy) or cash-draining (refund heavy)?
> - The settled % overall — is the business closing out return exposure or letting it linger?
>
> Cite RM values and percentages verbatim from the data block.
>
> Provide a concise analysis focused on settlement channel mix and cash-flow implications.

**Component Prompt — `rt_unsettled`:**

> You are analyzing the "Unsettled" KPI on the Returns page.
>
> What it measures: Return value from the selected period that has NOT been knocked off or refunded — still open on the books. This is the piece of the return exposure that is actively hurting the P&L and the working capital.
>
> The pre-fetched data gives you:
> - Total unsettled (RM)
> - Unsettled % of total return value
> - Partial count (return CNs that are partially resolved)
> - Outstanding count (return CNs with zero resolution)
> - Reconciled count (return CNs fully resolved)
> - Reconciliation rate (%) across the period
>
> Thresholds (unsettled % of return value):
> - < 15% = Healthy — most returns closed out
> - 15% to 30% = Watch
> - > 30% = Concern — return exposure is piling up unresolved
>
> Evaluate:
> - Scale of unsettled RM against the total return pool
> - Whether the problem is many partially-resolved CNs (process friction) or many fully-outstanding CNs (stuck on customer action)
> - The reconciliation rate as an overall health signal
>
> Cite RM values and counts verbatim from the data block.
>
> Provide a concise analysis focused on unresolved exposure and reconciliation health.

**Component Prompt — `rt_return_pct`:**

> You are analyzing the "Return %" KPI on the Returns page.
>
> What it measures: Total return value divided by total net sales in the period, expressed as a percentage. This is the single most important return-health ratio — it normalizes return exposure against sales volume so you can compare periods fairly.
>
> The pre-fetched data gives you:
> - Return rate % for the period
> - Period return value (RM)
> - Period net sales (RM)
> - Color band (Green / Amber / Red)
>
> Thresholds:
> - < 2% = Green (Good) — normal fruit-distribution wastage tolerance
> - 2% to 5% = Amber (Watch) — acceptable but monitor direction
> - > 5% = Red (Concern) — indicates quality, handling, or sourcing issues
>
> Evaluate:
> - Which band the current value sits in
> - What the implied scale is (a 3% return rate on RM 10M sales is RM 300K — make it concrete)
> - Whether the ratio alone is actionable or whether a trend view is needed (the MonthlyTrendChart and the trend-based components carry that context)
>
> Cite the return rate, return value, and net sales verbatim from the data block.
>
> Provide a concise analysis of return health relative to sales volume.

**Component Prompt — `rt_settlement_breakdown`:**

> You are analyzing the "Settlement Breakdown" chart on the Returns page.
>
> What it shows: Three horizontal progress bars for the period — Knocked Off (emerald), Refunded (blue), Unsettled (red) — each as an RM amount and as a percentage of total return value.
>
> The pre-fetched data gives you:
> - Total return value (RM)
> - Knocked off (RM) and knock-off %
> - Refunded (RM) and refund %
> - Unsettled (RM) and unsettled %
> - Refund transaction count (actual cash-out events)
>
> Thresholds:
> - Knock-off % > 70% = Healthy settlement mix (cash-efficient)
> - Refund % > 30% = Concern (cash-draining settlement)
> - Unsettled % > 30% = Concern (exposure is piling up)
> - Knock-off % < 50% AND Refund % > Knock-off % = Flag (refund-dominant mix)
>
> Business context — CRITICAL:
> - Knock-off is preferred: no cash leaves the door, the return offsets future invoices.
> - Refund is last-resort: it is real cash out, impacts working capital, and is only appropriate for ending relationships or customers with no upcoming invoices.
> - Unsettled is where the process breaks: these returns are neither absorbed nor refunded — they are open exposure.
>
> Evaluate:
> - The shape of the mix — is it knock-off dominant (good), refund dominant (cash pressure), or unsettled dominant (process breakdown)?
> - Which channel carries the majority of the resolved piece
> - Whether the unsettled slice is large enough to warrant investigation
>
> Cite RM values and percentages verbatim from the data block. Do NOT invent.
>
> Provide a concise analysis focused on settlement mix quality and unresolved exposure.

**Component Prompt — `rt_monthly_trend`:**

> You are analyzing the "Monthly Return Trend" chart on the Returns page.
>
> What it shows: Two area series over time for the selected period — Return Value (indigo) and Unsettled (red) — plotted by month. The chart respects the date filter.
>
> The pre-fetched data gives you a month-by-month table with:
> - Month
> - Return value (RM)
> - Unsettled (RM)
> - CN count
>
> Pre-calculated roll-ups you may cite directly:
> - Total months in the period
> - Highest / lowest month by return value (month + RM)
> - MoM growth in return count between the first and last month of the period
> - Peak unsettled month (month + RM)
>
> Thresholds:
> - Month-over-month return count growth > 25% between first and last month = Concern
> - Unsettled rising while return value is flat or falling = Process breakdown (returns are not being closed out)
> - Return value and unsettled moving together = Volume-driven exposure
>
> Evaluate:
> - Direction: are returns trending up, flat, or down across the period?
> - Whether the unsettled line is tracking return value (normal) or diverging (process issue)
> - Any month that stands out as an outlier (spike in count, spike in value, or spike in unsettled)
>
> Describe the trend month-by-month or via the pre-calculated roll-ups. Do NOT invent months, values, or averages that are not in the data block.
>
> Provide a concise analysis of the monthly pattern.

**Component Prompt — `rt_product_bar`:**

> You are analyzing the "Top Returns by Item" chart on the Returns page.
>
> What it shows: A horizontal bar chart of the top 10 items most associated with returns in the period. The UI exposes toggles for dimension (All / Product / Variant / Country) and metric (Frequency / Value). For this analysis the AI is given BOTH metric views on the default item dimension — it should cover both.
>
> The pre-fetched data gives you:
> (A) Top 10 items by RETURN FREQUENCY (CN count) — which items break or get returned most often
> (B) Top 10 items by RETURN VALUE (total_value RM) — which items hurt the P&L most when they are returned
> (C) Period totals for context: total return value, total return count, top-1 item share of return value, top-10 item share of return value
>
> Thresholds:
> - Top 1 item > 15% of period return value = Severe concentration (one item moving the number)
> - Top 10 items > 60% of period return value = Concentrated (few items driving the problem — fixable)
> - Top 10 items < 40% of period return value = Diversified (broad quality issue — harder to fix)
> - An item appearing on BOTH the top-frequency AND top-value lists = Star problem product (high occurrence AND high cost per return)
>
> Evaluate:
> - Concentration: is the return problem one or two items, or spread across many?
> - Frequency vs value: do the top frequency items also dominate by value (consistent story), or are they different (some items break often but cost little, others rarely but big)?
> - Name the items appearing on both lists explicitly — those are the highest-leverage fixes.
> - Note that the user can drill into Product / Variant / Country dimensions via UI toggles — your analysis is on the item level only; drill-downs remain user-driven.
>
> Cite item names and values verbatim from the data block. Do not invent.
>
> Provide a concise analysis focused on item concentration and the frequency-vs-value pattern.

---

### 5.10 Unsettled Returns

| | |
|---|---|
| **Section Key** | `return_unsettled` |
| **Page** | return |
| **Scope** | snapshot |
| **Tool Policy** | full |
| **Data Sources** | pc_return_aging, pc_return_by_customer |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| ru_aging_chart | Aging of Unsettled Returns | chart | Unsettled book by aging bucket (5 buckets, snapshot) | 91+ >25% = Watch, 180+ >10% = Write-off risk |
| ru_debtors_table | Customer Returns | table | Per-debtor cumulative return exposure (snapshot) | Top 1 >15% unsettled = Single-point risk |

**Component Prompt — `ru_aging_chart`:**

> You are analyzing the "Aging of Unsettled Returns" horizontal bar chart on the Returns page.
>
> What it shows: The current unsettled return book broken down by how long the return credit note has been sitting unresolved. Five buckets, from newest to oldest:
> - 0-30 Days (emerald) — fresh, normal reconciliation window
> - 31-60 Days (amber) — starting to age
> - 61-90 Days (orange) — ageing, process slowing down
> - 91-180 Days (red) — concerning, active follow-up needed
> - 180+ Days (dark red) — write-off risk
>
> This is a SNAPSHOT metric. It is cumulative across all months — NOT filtered by the date range. It reflects every unresolved return CN still open on the books as of the latest aging snapshot.
>
> The pre-fetched data gives you:
> - RM amount AND count in each bucket
> - Total unsettled amount and total unsettled count (across all five buckets)
> - % share of unsettled value in each bucket
> - The snapshot_date the numbers were captured on
>
> Thresholds:
> - > 25% of unsettled value in the 91+ buckets (91-180 + 180+) = Watch — follow-up process is falling behind
> - > 10% of unsettled value in the 180+ bucket alone = Write-off risk — amounts this old rarely get recovered in a distribution business
>
> Evaluate:
> - Where the weight of the unsettled book sits — is most of it fresh (0-30) or old (91+)?
> - Whether the 180+ slice is material enough to trigger write-off review
> - Count vs amount — many small old items vs a few large old items tell different stories
> - If the bucket weight looks unusually skewed, tools may be used to pull prior `pc_return_aging` snapshots to see whether the skew is getting worse over time
>
> Cite RM values and percentages verbatim from the pre-computed block. Do not invent.
>
> Provide a concise analysis focused on where the unsettled book sits in the aging distribution and whether the oldest buckets carry write-off risk.

**Component Prompt — `ru_debtors_table`:**

> You are analyzing the "Customer Returns" table on the Returns page.
>
> What it shows: Every debtor that has ever issued a return CN, with cumulative totals across all months — return count, total return value, amount knocked off against invoices, amount refunded in cash, and the unresolved balance still open. The table is sorted by unresolved amount by default. Debtors with unresolved = 0 are hidden by the default UI filter.
>
> This is a SNAPSHOT metric. It is cumulative across all months — NOT filtered by the date range. It reflects every return ever issued that is still wholly or partially open on the books.
>
> The pre-fetched data gives you:
> - Total unsettled amount (sum of unresolved across all debtors)
> - Debtor count with unresolved balance > 0
> - Stale-debtor count — debtors where unresolved > 0 AND knock_off_total = 0 AND refund_total = 0 (never actioned)
> - Top 1 debtor share of total unsettled (%)
> - Top 10 debtor share of total unsettled (%)
> - A top-5 list: debtor name, unresolved RM, knocked off RM, refunded RM
>
> Thresholds:
> - Top 1 debtor > 15% of total unsettled = Single-point risk — one customer dominates the exposure
> - Top 10 debtors > 60% of total unsettled = Concentrated book — fixable with a focused collections push
> - Stale debtors = the collections team never opened a conversation on these. Each one is a pure process failure.
>
> Settlement-channel context (for analyzing individual top debtors):
> - Knock-off preferred (offsets invoices, no cash out)
> - Refund = real cash out, only appropriate for ending relationships or customers with no upcoming invoices
> - A debtor with refund activity but still unresolved is a RED flag — cash already went out and the book still isn't clean
>
> Evaluate:
> - Concentration — is the unsettled book one big debtor, ten big debtors, or broadly spread?
> - Stale-debtor count — how much process failure vs active dispute?
> - Settlement patterns on the top 5 — who is being knocked-off vs refunded, and who has neither?
> - If a specific debtor's number looks unusual, tools may be used to query `pc_return_by_customer` by debtor_code for a month-by-month breakdown, or drill `dbo.CN` for credit note detail
>
> Name the top 5 debtors verbatim. Cite RM values and percentages from the pre-computed block.
>
> Provide a concise analysis focused on concentration, stale debtors, and any red-flag settlement patterns on the top debtors.

---

### 5.11 Expense Overview

| | |
|---|---|
| **Section Key** | `expense_overview` |
| **Page** | expenses |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_expense_monthly |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| ex_total_costs | Total Costs | kpi | COGS + OpEx for period | YoY: <0% = Healthy, >10% = Severe |
| ex_cogs | Cost of Sales | kpi | Variable cost (acc_type = 'CO') | COGS share 60–80% = Typical, >85% = Pressure |
| ex_opex | Operating Costs | kpi | Semi-fixed costs (acc_type = 'EP') | YoY >10% = Concern |
| ex_yoy_costs | vs Last Year | kpi | Year-over-year total cost change | <0% = Green, >10% = Severe |
| ex_cost_trend | Cost Trend | chart | Monthly COGS + OpEx stacked bars | MoM >15% = Concern |
| ex_cost_composition | Cost Composition | chart | COGS/OpEx donut with prior-year drift | COGS share drift >+3pp = margin compression |
| ex_top_expenses | Top Expenses | chart | Top 10 GL accounts by net cost | Top 1 >30% = Severe concentration |

**Component Prompt — `ex_total_costs`:**

> You are analyzing the "Total Costs" KPI on the Expenses page.
>
> What it measures: Total expense (COGS + OpEx) posted to GL in the selected period. This is a period flow — activity within the date range, not a point-in-time balance.
>
> The pre-fetched data gives you:
> - Total costs (RM) — COGS + OpEx combined
> - COGS (RM) and COGS % of total
> - OpEx (RM) and OpEx % of total
> - Prior-year total costs for the same period
> - YoY total-cost growth %
>
> Thresholds (YoY total-cost growth):
> - < 0% = Healthy — costs down year-over-year
> - 0% to 5% = Watch — in line with typical inflation
> - 5% to 10% = Concern — investigate drivers
> - > 10% = Severe — costs outpacing typical inflation
>
> COGS share thresholds:
> - 60% to 80% = Typical fruit-distribution mix
> - > 85% = COGS-dominated (margin-pressure risk)
> - < 50% = OpEx-dominated (scaling inefficiency risk)
>
> Evaluate:
> - Whether total costs are growing, flat, or shrinking vs prior year
> - Whether the COGS / OpEx split looks like a healthy distribution business
> - The scale of the number in context — is this a big or small period?
>
> Cite RM values and percentages verbatim from the data block.
>
> Provide a concise analysis of period cost exposure.

**Component Prompt — `ex_cogs`:**

> You are analyzing the "Cost of Sales (COGS)" KPI on the Expenses page.
>
> What it measures: The variable cost of products sold in the selected period — GL accounts with acc_type = 'CO'. COGS scales with sales volume, so year-over-year growth is only concerning if it outpaces sales.
>
> The pre-fetched data gives you:
> - COGS (RM) for the period
> - COGS % of total costs
> - Prior-year COGS for the same period
> - COGS YoY growth %
> - Top 3 COGS accounts by value (account name + acc_no + RM + % of COGS)
>
> Thresholds:
> - COGS share 60% to 80% of total cost = Typical
> - COGS share > 85% of total cost = Margin-pressure risk
> - COGS YoY growth > 15% when sales are flat/declining = Concern
>
> Business context — CRITICAL:
> - COGS is VARIABLE. If sales volume grew, COGS should grow too — that is normal.
> - The question is whether COGS grew FASTER than sales (margin compression) or slower (margin improvement).
> - The analyst reading this summary will cross-check against the sales page; flag YoY drift but do not jump to conclusions about margin without that context.
>
> Evaluate:
> - Scale of COGS against total costs — is the business COGS-heavy?
> - YoY direction — up, flat, or down
> - Which accounts dominate COGS (from the top-3 block) and whether the mix looks concentrated
>
> Cite RM values and percentages verbatim from the data block. Do not invent accounts.
>
> Provide a concise analysis focused on COGS scale and YoY direction.

**Component Prompt — `ex_opex`:**

> You are analyzing the "Operating Costs (OpEx)" KPI on the Expenses page.
>
> What it measures: Day-to-day operating expenses in the selected period — GL accounts with acc_type = 'EP'. OpEx is semi-fixed: it scales with structural decisions (headcount, rent, tooling), not directly with sales volume.
>
> The pre-fetched data gives you:
> - OpEx (RM) for the period
> - OpEx % of total costs
> - Prior-year OpEx for the same period
> - OpEx YoY growth %
> - Top 3 OpEx accounts by value (account name + acc_no + RM + % of OpEx)
>
> Thresholds:
> - OpEx YoY growth > 10% = Concern — OpEx is semi-fixed; unexplained growth needs investigation
> - OpEx YoY growth < 0% = Healthy — cost discipline
> - OpEx share > 50% of total cost = OpEx-dominated (verify this is intentional scaling)
>
> Business context — CRITICAL:
> - OpEx is SEMI-FIXED. It should NOT scale linearly with sales. If OpEx grew 15% YoY while sales were flat, something structural changed — new headcount, new rent, new tooling. The analyst should name the driver.
> - COGS YoY growth is more forgivable than OpEx YoY growth for the same reason.
>
> Evaluate:
> - OpEx scale vs total costs
> - YoY direction — a rising OpEx is a stronger signal than rising COGS
> - Top 3 accounts — which structural line items are driving it
>
> Cite RM values and percentages verbatim from the data block. Do not invent accounts.
>
> Provide a concise analysis focused on OpEx discipline and any structural-growth signals.

**Component Prompt — `ex_yoy_costs`:**

> You are analyzing the "vs Last Year" KPI on the Expenses page.
>
> What it measures: Year-over-year change in total costs for the selected period, broken down into COGS and OpEx components.
>
> The pre-fetched data gives you:
> - Current-period total costs (RM)
> - Prior-year same-period total costs (RM)
> - YoY total-cost growth %
> - Color band (Green / Amber / Red / Severe)
> - COGS YoY: current RM, prior RM, growth %
> - OpEx YoY: current RM, prior RM, growth %
>
> Thresholds:
> - < 0% = Green (Healthy — costs falling)
> - 0% to 5% = Amber (Watch — in line with typical inflation)
> - 5% to 10% = Red (Concern)
> - > 10% = Severe (costs outpacing typical inflation)
>
> Evaluate:
> - Which band the total-cost YoY sits in
> - Whether COGS or OpEx is driving the YoY movement (bigger absolute RM change vs bigger % change)
> - Whether the OpEx YoY is the more alarming signal (remember: OpEx is semi-fixed; COGS YoY is more forgivable because it scales with sales)
> - If COGS YoY > OpEx YoY, the story is "volume-driven" — the business did more sales. If OpEx YoY > COGS YoY, the story is "structural" — something changed in the cost base.
>
> Cite RM values and percentages verbatim from the data block.
>
> Provide a concise analysis focused on the source of the YoY movement.

**Component Prompt — `ex_cost_trend`:**

> You are analyzing the "Cost Trend" chart on the Expenses page.
>
> What it shows: A stacked bar chart, one bar per month in the selected period, with COGS (one color) and OpEx (another color) stacked to show total cost. The user can toggle the underlying view by cost type (All / COGS / OpEx) — the AI is given the All view.
>
> The pre-fetched data gives you a month-by-month table with:
> - Month
> - COGS (RM)
> - OpEx (RM)
> - Total (RM)
>
> Pre-calculated roll-ups you may cite directly:
> - Total months in the period
> - Peak total-cost month (month + RM)
> - Lowest total-cost month (month + RM)
> - MoM cost growth % between the first and last month in the period
> - Current-period total and prior-year same-period total, plus period YoY %
>
> Thresholds:
> - MoM growth (first -> last month) > 15% = Concern
> - MoM growth > 25% = Severe
> - Period YoY growth > 10% total = Severe
>
> Evaluate:
> - Direction across the period — rising, flat, falling
> - Any month that stands out as an outlier (spike or trough)
> - Whether COGS or OpEx carries the trend (look at which component moves more month-to-month)
> - How the period total compares to the prior year
>
> Describe the trend month-by-month or via the pre-calculated roll-ups. Do NOT invent months, values, or averages that are not in the data block.
>
> Provide a concise analysis of the monthly cost pattern.

**Component Prompt — `ex_cost_composition`:**

> You are analyzing the "Cost Composition" chart on the Expenses page.
>
> What it shows: A donut chart splitting total costs into COGS and OpEx slices, with RM values and percentages.
>
> The pre-fetched data gives you:
> - Total cost (RM)
> - COGS (RM) and COGS %
> - OpEx (RM) and OpEx %
> - Mix classification (Typical / COGS-dominated / OpEx-dominated / Mixed)
> - Prior-year composition (COGS % and OpEx % in the same period one year ago)
> - COGS share drift in percentage points (current - prior)
>
> Thresholds:
> - COGS share 60% to 80% = Typical fruit-distribution mix
> - COGS share > 85% = COGS-dominated (margin-pressure risk)
> - COGS share < 50% = OpEx-dominated (scaling inefficiency risk)
> - COGS share drift > +3 pp while sales flat = Margin compression signal
> - COGS share drift < -3 pp = Either margin improvement or inventory under-investment
>
> Evaluate:
> - Which mix classification the period sits in
> - How far the mix has drifted from prior year (positive drift = more COGS-heavy; negative drift = more OpEx-heavy)
> - What the drift implies — margin compression, margin improvement, or structural change on the OpEx side
>
> Cite RM values, percentages, and drift verbatim from the data block. Do not recompute percentages.
>
> Provide a concise analysis of cost mix and year-over-year drift.

**Component Prompt — `ex_top_expenses`:**

> You are analyzing the "Top Expenses" chart on the Expenses page.
>
> What it shows: A horizontal bar chart of the top 10 GL accounts by net cost in the selected period, with bars colored by cost type (COGS vs OpEx). The UI exposes toggles for cost type (All / COGS / OpEx) and direction (Top / Bottom). The AI is given the All / Top view — drill-downs remain user-driven.
>
> The pre-fetched data gives you:
> - Total costs (RM) for context
> - Top 10 accounts table: rank, account name, acc_no, cost type (COGS or OPEX), net cost (RM), and % of total
> - Top 1 account share of total costs
> - Top 10 accounts share of total costs (sum + %)
> - Concentration classification (Severe / Concentrated / Moderate / Diversified)
> - Mix in top 10: how many are COGS accounts, how many are OpEx
>
> Thresholds:
> - Top 1 account > 30% of total costs = Severe (single-account risk)
> - Top 1 account 15% to 30% = Concentrated
> - Top 10 accounts > 75% of total = Concentrated (few accounts drive the cost base — fixable)
> - Top 10 accounts < 50% of total = Diversified (broad cost base — harder to attack)
>
> Evaluate:
> - Concentration: is the cost pain concentrated in a handful of accounts, or spread across many?
> - Mix: is the top 10 dominated by COGS (volume-driven — scales with sales) or OpEx (structural — investigate)?
> - Any single-account outlier that accounts for > 15% of total cost — name it and flag it
>
> Name accounts from the top-10 table verbatim. Do not invent accounts or change acc_no values.
>
> Provide a concise analysis focused on concentration and the COGS-vs-OpEx mix at the top.

---

### 5.12 Expense Breakdown

| | |
|---|---|
| **Section Key** | `expense_breakdown` |
| **Page** | expenses |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_expense_monthly |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| ex_cogs_table | Cost of Sales Breakdown | table | Every COGS GL account with share of total | Top 1 >50% = Severe |
| ex_opex_table | Operating Costs Breakdown | table | Every OpEx GL account grouped by category taxonomy | Top 1 category >50% = Dominant |

**Component Prompt — `ex_cogs_table`:**

> You are analyzing the "Cost of Sales Breakdown" table on the Expenses page.
>
> What it shows:
> - A sortable table of every active GL account with acc_type = 'CO' (Cost of Sales) for the selected period.
> - Columns: Account No, Account Name, Net Cost (RM), % of Total COGS.
> - The user can also see this side-by-side with the OpEx Breakdown via a tab.
>
> The pre-fetched data gives you:
> - Total COGS for the period
> - Active COGS account count (and a "thin surface" flag if < 5)
> - Top 10 COGS accounts table: rank, name, acc_no, net cost, % of total COGS
> - Pre-computed Top 1 / Top 3 / Top 10 share of total COGS, with classification labels
> - Any negative-value COGS accounts (usually credit notes or reversals)
>
> Thresholds:
> - Top 1 account > 50% of COGS = Severe (single-account exposure in variable cost base)
> - Top 1 account 30-50% = Concentrated (typical for dominant-fruit sourcing — not automatically bad)
> - Top 1 account < 15% = Diversified
> - Top 3 accounts > 80% of COGS = Concentrated (normal for a focused distributor)
> - Top 3 accounts < 55% = Diversified (broad sourcing)
> - Active COGS accounts < 5 = Thin COGS surface (limited line-item visibility — flag for GL discipline)
> - Any account with negative net_cost = Flag (name it — likely a credit note posted to expense)
>
> Evaluate:
> - Concentration: where does the variable-cost dollar actually land? If Top 1 dominates, name it — a unit-price change on that one account moves the whole COGS line.
> - Top 3 mix: is the tail meaningfully contributing, or is this a 3-account story?
> - Negative-value accounts: are any reversals large enough to distort the apparent total?
> - Do NOT compare to prior year here — that is the Expense Overview job. Focus on the structure of the period's COGS.
>
> Name accounts verbatim from the top-10 table. Do not invent accounts or change acc_no values.
>
> Provide a concise analysis focused on COGS concentration and any negative-value anomalies.

**Component Prompt — `ex_opex_table`:**

> You are analyzing the "Operating Costs Breakdown" table on the Expenses page.
>
> What it shows:
> - A category-grouped table of every active GL account with acc_type = 'EP' (Operating Costs) for the selected period.
> - Accounts are grouped under a fixed category taxonomy (People & Payroll, Vehicle & Transport, Property & Utilities, Depreciation, Office & Supplies, Equipment & IT, Insurance, Finance & Banking, Professional Fees, Marketing & Entertainment, Repair & Maintenance, Tax & Compliance, Other).
> - Columns: Category / Account, Account Name, Net Cost (RM), % of Total OpEx. Categories are collapsible.
>
> The pre-fetched data gives you:
> - Total OpEx for the period
> - Active OpEx account count and active category count
> - Category subtotals table: category, account count, subtotal, % of OpEx (sorted by subtotal desc)
> - Top 10 OpEx accounts across all categories: rank, category, name, acc_no, net cost, % of OpEx
> - Pre-computed Top 1 category share, Top 1 / Top 3 account shares, with classification labels
> - Singleton categories (only 1 account) and any negative-value accounts
>
> Thresholds:
> - Top 1 category > 50% of OpEx = Dominant (one cost center carries the base)
> - Top 1 category 30-50% = Typical dominance (usually People & Payroll, Vehicle & Transport, or Property & Utilities)
> - Top 1 category < 20% = Diversified across categories
> - Top 1 account > 20% of total OpEx = Single-account risk (name it)
> - Top 3 accounts > 50% = Concentrated
> - Any category with only 1 account = Flag (possible misclassification or sparse data)
> - Any account with negative net_cost = Flag (name it — likely a reversal)
>
> Evaluate:
> - Category concentration: which category dominates? For a Malaysian fruit distributor, People & Payroll or Vehicle & Transport dominating is normal; Marketing & Entertainment dominating is not.
> - Single-account risk: is the dominant category driven by many accounts, or one line item? Name the account if Top 1 > 20%.
> - Structural signals: any category that looks out of proportion for a distribution business is an investigation lead.
> - Singleton categories and negative accounts are data-quality flags, not business signals — call them out if present but keep them brief.
> - Do NOT compare to prior year — that is the Expense Overview job.
>
> Name categories and accounts verbatim from the pre-fetched blocks. Do not invent.
>
> Provide a concise analysis focused on category concentration, single-account risk, and any data-quality flags.

---

### 5.13 Financial Overview

| | |
|---|---|
| **Section Key** | `financial_overview` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| fin_pnl_summary | P&L Summary | kpi | Full P&L waterfall for fiscal window | Multiple margin thresholds |
| fin_monthly_trend | Monthly P&L Trend | chart | Monthly Net Sales, COGS, GP, OpEx, Operating Profit | Any loss month = Watch |

**Component Prompt — `fin_pnl_summary`:**

> You are analyzing the "P&L Summary" on the Financial page.
>
> What it shows: A full P&L waterfall for the selected fiscal window — Net Sales, Cost of Sales, Gross Profit, Operating Costs, Operating Profit, Other Income, and Net Profit — each with current RM, prior-year RM, YoY %, and margin/ratio.
>
> Thresholds:
> - Gross margin: < 15% Severe / 15-20% Watch / 20-25% Typical / > 25% Strong
> - OpEx ratio: < 10% Lean / 10-18% Typical / 18-25% Elevated / > 25% Severe
> - Operating margin: < 0% Severe (loss) / 0-5% Thin / 5-10% Healthy / > 10% Strong
> - Net margin: < 0% Severe / 0-3% Thin / 3-7% Healthy / > 7% Strong
> - COGS share: 60-80% = Typical / > 85% = Margin pressure
>
> Evaluate (top to bottom):
> 1. Top-line: Is Net Sales growing or contracting YoY?
> 2. Cost pressure: Is COGS growing faster than Net Sales? (rising COGS share = margin compression)
> 3. Gross Profit: Both RM and margin %. RM up + margin down = volume masking cost erosion.
> 4. OpEx: Is the ratio drifting up? OpEx growing faster than sales = scaling inefficiency.
> 5. Operating Profit: Positive or negative? This is the core-business read.
> 6. Earnings quality: If Net Profit >> Operating Profit, the delta is Other Income (non-operating). Core business may be weaker than headline.
>
> Cite RM values and percentages from the waterfall table. Provide a concise analysis covering all P&L layers.

**Component Prompt — `fin_monthly_trend`:**

> You are analyzing the "Monthly P&L Trend" chart on the Financial page.
>
> What it shows: A monthly time series across the selected fiscal window (full FY / YTD / last 12 months), with Net Sales, COGS, Gross Profit, OpEx, and Operating Profit for each month.
>
> The pre-fetched data gives you a month-by-month table with:
> - Month label (fiscal order: Mar -> Feb)
> - Net Sales, COGS, Gross Profit, OpEx, Operating Profit (RM)
>
> Pre-calculated roll-ups you may cite directly:
> - Months in window (split into profit months vs loss months)
> - Peak operating-profit month and value
> - Lowest operating-profit month and value
> - First-to-last Net Sales growth %
> - First-to-last Operating Profit growth %
>
> Thresholds:
> - Any single loss month = Watch signal (call it out by name)
> - Loss months / total months > 30% = Concern
> - First-to-last Operating Profit decline > 25% = Severe
>
> Evaluate:
> - Direction: is the series rising, flat, falling, or oscillating?
> - Loss months: are there any? Which ones? Are they clustered (seasonal / event-driven) or scattered?
> - Divergence: does the Net Sales trend line move with or against the Operating Profit trend line? If sales are rising but operating profit is falling, that's margin compression in action.
> - Use the pre-calculated first-to-last growth for the headline direction. Do NOT invent averages over arbitrary sub-windows.
>
> Describe the trend month-by-month or via the pre-calculated roll-ups. Do NOT invent months, values, or averages that are not in the data block.
>
> Provide a concise analysis focused on direction, loss months, and any sales-vs-profit divergence.

---

### 5.14 Profit & Loss Detail

| | |
|---|---|
| **Section Key** | `financial_pnl` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| fin_pl_statement | Profit & Loss Statement | table | Full P&L by account type with YoY | Group YoY >+/-15% = Material |
| fin_yoy_comparison | Multi-Year Comparison | table | 4-fiscal-year P&L with CAGR + margin drift | 3+ consecutive NP declines = Severe |

**Component Prompt — `fin_pl_statement`:**

> You are analyzing the "Profit & Loss Statement" table on the Financial page.
>
> What it shows: The full P&L statement for the selected fiscal year against the prior fiscal year (YTD-aligned to the latest period with data). The table groups general-ledger accounts by account type (Sales, Sales Adjustments, Cost of Sales, Other Income, Operating Costs / OpEx, Taxation) and shows group subtotals, Gross Profit / (Loss), Net Profit / (Loss), and Net Profit After Tax with YoY.
>
> The pre-fetched data gives you:
> - Group subtotals (current YTD vs prior YTD) for every non-empty group, with YoY %
> - Derived totals: Gross Profit, Net Profit (pre-tax), Net Profit After Tax
> - Gross Margin % and Net Margin % (current vs prior, with drift in percentage points)
> - Sign-flip flags for GP / NP / NPAT (when any of these switch between positive and negative YoY)
> - Top 5 detail-account movers, ranked by absolute RM delta
>
> Thresholds:
> - Group YoY subtotal: < +/-5% Flat / +/-5-15% Moderate / > +/-15% Material
> - Gross Margin drift: +/-3pp Material / +/-5pp Severe
> - Net Margin drift: +/-2pp Material / +/-3pp Severe
> - Any sign flip on GP / NP / NPAT = Severe (always call out by name)
>
> Evaluate:
> - Which groups drive the RM direction (e.g. "Net Sales up RM X, offset by OpEx up RM Y")?
> - Margin expansion vs compression: did Gross Margin / Net Margin drift meaningfully, and in which direction?
> - Which 1-2 named accounts from the top-5 movers list explain the biggest swings?
>
> Hard rules:
> - You may only cite account names that appear in the pre-fetched "Top 5 detail-account movers" list. Do NOT invent other account names.
> - Do NOT recompute YoY % — the figures in the data block are authoritative.
> - If you want to explain WHY a group moved, cite the top mover(s) inside that group from the list.
>
> Provide a concise structural analysis — the director wants to know "where did the RM go" and "is the margin healthier or sicker."

**Component Prompt — `fin_yoy_comparison`:**

> You are analyzing the "Multi-Year Comparison" table + small-multiples chart on the Financial page.
>
> What it shows: A 4-fiscal-year view of the core P&L line items — Net Sales, COGS, Gross Profit, Gross Margin %, Other Income, Operating Costs, Net Profit, Net Margin %, Taxation, Net Profit After Tax — for the selected FY and the three prior FYs.
>
> The pre-fetched data gives you:
> - A row per FY x 10 line items (RM and %), with partial FYs marked with an asterisk
> - Pre-calculated roll-ups over the FULL-FY rows only (partial FYs excluded):
>   - Net Sales CAGR (first -> last full FY)
>   - Gross Margin drift (pp) and Net Margin drift (pp), first -> last full FY
>   - Longest consecutive Net Profit decline streak (years)
>   - Longest consecutive Net Profit improvement streak (years)
>   - NPAT sign-flip count in the window
>
> Thresholds:
> - Net Sales CAGR: < -5% Declining / -5 to 5% Flat / 5-15% Growing / > 15% Fast growth
> - Net Profit direction: 3+ consecutive declines = Severe / 3+ consecutive improvements = Strong
> - Gross Margin drift (first -> last full FY): > +/-3pp = Material structural change
> - Net Margin drift (first -> last full FY): > +/-2pp = Material
> - Any NPAT sign flip in the window = Severe
>
> Evaluate:
> - Trajectory: what is the multi-year direction of the top line (Net Sales CAGR)?
> - Earnings quality: is Net Profit improving, oscillating, or declining? Cite the longest streak.
> - Margin structure: has the business become more or less profitable per RM of sales across the window?
>
> Hard rules:
> - Partial FYs (marked with *) are EXCLUDED from CAGR and direction roll-ups. You may list them in the table narrative but must NOT include them in trend claims.
> - Use the pre-calculated CAGR and drift figures for headline direction. Do NOT recompute growth over arbitrary sub-windows or invent averages.
> - Do NOT claim a streak longer than the pre-calculated values.
>
> Provide a concise multi-year narrative — growth trajectory, earnings direction, and margin evolution.

---

### 5.15 Balance Sheet

| | |
|---|---|
| **Section Key** | `financial_balance_sheet` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| bs_trend | Assets, Liabilities & Equity Trend | chart | Monthly Assets/Liabilities/Equity series | Liabilities > Assets = Severe |
| bs_statement | Balance Sheet Statement | table | Full BS with solvency ratios | Current Ratio <1.0 = Severe |

**Component Prompt — `bs_trend`:**

> You are analyzing the "Assets, Liabilities & Equity Trend" line chart on the Financial page.
>
> What it shows: A monthly time series across the selected fiscal window (full FY / YTD / last 12 months), with three lines — Total Assets, Total Liabilities, and Equity — rebuilt for each month from opening balance + cumulative movements through pc_pnl_period.
>
> The pre-fetched data gives you:
> - A month-by-month table (fiscal order) of Total Assets, Total Liabilities, Equity (RM)
> - Pre-calculated roll-ups you may cite directly:
>   - Months in window
>   - First-to-last Total Assets growth %
>   - First-to-last Total Liabilities growth %
>   - First-to-last Equity growth %
>   - Gearing (Total Liabilities / Total Assets): first value, last value, and drift in pp
>   - Longest consecutive Equity-decline streak (months)
>   - Any months where Total Liabilities exceeded Total Assets (negative-equity flag)
>
> Thresholds:
> - Asset trajectory (first->last): < -5% Shrinking / +/-5% Flat / 5-15% Growing / > 15% Fast growth
> - Equity direction: first->last declining = Watch / 3+ consecutive decline months = Severe
> - Liability vs Asset divergence: Liabilities growing > 10% while Assets flat/shrinking = Material / > 20% = Severe
> - Gearing drift: > +3pp Material deterioration / > +5pp Severe
> - Any month where Total Liabilities > Total Assets = Severe (insolvency — always call out by month name)
>
> Evaluate:
> - Direction: are the three lines rising, flat, falling, or diverging from one another?
> - Leverage: is the business taking on more debt relative to its asset base? Cite gearing drift.
> - Equity health: is equity building, holding, or eroding? Cite the decline streak.
>
> Hard rules:
> - Use the pre-calculated first-to-last growth and gearing drift for headline direction. Do NOT recompute averages over arbitrary sub-windows.
> - If there are negative-equity months in the pre-fetched list, you MUST call them out by month name.
> - Do NOT invent months, values, or ratios that are not in the data block.
>
> Provide a concise structural analysis — the director wants to know "is the balance sheet strengthening or weakening, and is leverage moving in the right direction."

**Component Prompt — `bs_statement`:**

> You are analyzing the "Balance Sheet Statement" table on the Financial page.
>
> What it shows: The full balance sheet for the selected fiscal year vs 12 periods prior (YTD-aligned snapshot). Eight line items by account type — Fixed Assets, Other Assets, Current Assets, Current Liabilities, Long Term Liabilities, Other Liabilities, Capital, Retained Earnings (including current-year P&L) — plus derived totals and key solvency ratios.
>
> The pre-fetched data gives you:
> - Line items (current vs prior) with RM delta and YoY % for every non-zero line
> - Derived totals: Net Current Assets, Total Assets, Total Liabilities, Total Equity (current + prior)
> - Key ratios (current + prior + drift):
>   - Current Ratio (Current Assets / Current Liabilities)
>   - Debt-to-Equity (Total Liabilities / Total Equity)
>   - Equity Ratio (Total Equity / Total Assets)
> - Sign-flip flags for Net Current Assets and Total Equity
> - Top 3 biggest |delta RM| line-item movers across the 8 line items
>
> Thresholds:
> - Line-item YoY: < +/-5% Flat / +/-5-15% Moderate / > +/-15% Material
> - Current Ratio: < 1.0 Severe / 1.0-1.2 Thin / 1.2-2.0 Healthy / > 2.0 Strong / YoY drift > +/-0.3 = Material
> - Debt-to-Equity: < 0.5 Conservative / 0.5-1.0 Typical / 1.0-2.0 Leveraged / > 2.0 Severe / YoY drift > +/-0.3 = Material
> - Equity Ratio: < 20% Severe / 20-40% Thin / 40-60% Healthy / > 60% Strong / YoY drift > +/-5pp = Material
> - Net Current Assets sign flip (pos->neg) = Severe (working-capital failure, always call out)
> - Total Equity sign flip = Severe (insolvency, always call out)
>
> Evaluate:
> - Liquidity: does the Current Ratio sit in the Healthy band, and is it drifting toward safer or thinner ground?
> - Leverage: where does Debt-to-Equity sit, and is it moving up or down vs prior?
> - Solvency cushion: is the Equity Ratio thick enough, and is it thickening or eroding?
> - Drivers: which 1-2 named line items from the top-3 movers explain the biggest RM swings?
>
> Hard rules:
> - You may only cite line-item names that appear in the pre-fetched "Top 3 biggest movers" list. Do NOT invent other account names.
> - Do NOT recompute YoY % or ratios — the figures in the data block are authoritative.
> - If you want to explain WHY Total Assets or Total Liabilities moved, cite the relevant mover(s) from the list.
>
> Provide a concise structural read — the director wants to know "is the balance sheet stronger or weaker than a year ago, and what drove the change."

---

### 5.16 Variance, Forecast & Budget

| | |
|---|---|
| **Section Key** | `financial_variance` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period, budget table |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| fv_variance_summary | P&L Variance Summary | kpi | Actual vs prior year + budget (if exists) | +/-5% = On Track, >+/-15% = Material |
| fv_variance_breakdown | Variance by Account | table | Account-level variance drivers per category | Top 3 >70% = Highly concentrated |
| fv_trend_forecast | Trend Forecast | kpi | 12-month projection (weighted moving average) | Consistent 4+ months = Strong signal |
| fv_budget_suggestions | AI Budget Suggestions | kpi | AI-generated annual budget based on actuals | Compare against approved budget if exists |

**Special behavior:** After analysis completes for this section, a "Save as Budget" button appears allowing the user to approve the AI-generated budget suggestions for the fiscal year. See §16 for details.

**Component Prompt — `fv_variance_summary`:**

> You are analyzing the "P&L Variance Summary" on the Financial page.
>
> What it shows: A comparison of the current fiscal window's P&L performance against TWO baselines:
> 1. **YoY Variance** — actual vs same window in the prior fiscal year
> 2. **Budget Variance** — actual vs approved budget (only present if a budget has been approved for this fiscal year)
>
> The pre-fetched data gives you:
> - YoY variance table: each line item (Net Sales, COGS, Gross Profit, OpEx, Operating Profit, Other Income, Net Profit) shows Actual, Baseline (prior year same window), Variance (RM), Variance %, and Status (Favourable / Unfavourable)
> - Budget variance table (if present): each line item shows Actual, Budget, Variance (RM), Variance %, and Status
> - Favourable/Unfavourable classification logic:
>   - Revenue lines (Net Sales, Gross Profit, Operating Profit, Net Profit, Other Income): higher actual = Favourable
>   - Cost lines (COGS, Operating Costs): lower actual = Favourable
> - Margin comparisons: Gross Margin % and Net Margin % (current vs baseline, drift in pp)
>
> Thresholds:
> - Variance within +/-5% = On Track
> - Variance +/-5-15% = Moderate deviation
> - Variance beyond +/-15% = Material deviation
> - Any sign flip (profit -> loss or vice versa) = Severe
>
> Evaluate:
> - Which P&L line items deviated most from baseline, and in which direction?
> - Is the deviation favourable or unfavourable for the business?
> - Are margin percentages improving or deteriorating vs the same period last year?
> - If budget variance is present: how does actual performance compare to the approved budget? Are we on track, over, or under budget?
> - What is the overall picture — is the business performing better or worse?
>
> Hard rules:
> - For YoY variance: always state the baseline is "same period last year"
> - For budget variance: clearly label it as comparison against the "approved budget"
> - Cite only figures from the pre-fetched data block. Do NOT invent numbers.
> - Do NOT recompute variance % — the figures in the data block are authoritative.
> - If no budget variance section is present, do NOT mention budgets — only analyze YoY variance
>
> Provide a concise variance summary — the director wants to know "am I on track compared to last year and my budget, and where are the biggest gaps."

**Component Prompt — `fv_variance_breakdown`:**

> You are analyzing the "Variance by Account" breakdown on the Financial page.
>
> What it shows: A detailed account-level breakdown of P&L variance, showing which specific GL accounts within each category (Sales, COGS, OpEx, Other Income) contributed most to the overall variance. This answers the question "which specific accounts drove the difference from last year."
>
> The pre-fetched data gives you:
> - Per-account-type sections (COGS accounts, OpEx accounts, etc.)
> - For each account: current amount, baseline (prior year), variance RM, variance %, and favourable/unfavourable status
> - Accounts sorted by absolute variance (biggest movers first)
> - Only accounts with non-zero variance are shown
>
> Thresholds:
> - Single account driving > 30% of category variance = Concentrated risk
> - Top 3 accounts driving > 70% of category variance = Highly concentrated
> - Any account with variance > +/-50% = Flag for investigation
>
> Evaluate:
> - Within each P&L category, which 1-3 named accounts are the biggest movers?
> - Is the variance concentrated in a few accounts or spread across many?
> - Are there any accounts with unusually large percentage swings that warrant attention?
>
> Hard rules:
> - You may only cite account names that appear in the pre-fetched data. Do NOT invent account names.
> - Cite RM amounts and percentages exactly as given. Do NOT recompute.
> - Focus on the top movers — do not narrate every small account.
>
> Provide a concise account-level analysis — the director wants to know "which specific accounts explain the variance, and should any of them concern me."

**Component Prompt — `fv_trend_forecast`:**

> You are analyzing the "Multi-Period Trend Forecast" on the Financial page.
>
> What it shows: A forward projection of key P&L line items (Net Sales, Gross Profit, Net Profit) for the NEXT 12 MONTHS, based on the trend observed over recent months. The forecast numbers are computed by the system from historical data — they are NOT generated by you. Your job is to EXPLAIN the forecasts, not to invent them.
>
> The pre-fetched data gives you:
> - Monthly trend table for the last several months: Net Sales, Gross Profit, Net Profit per month
> - Pre-computed 12-month forecast table: Month+1 through Month+12 projections for each line item
> - The method used: 3-month weighted moving average (50% most recent month, 30% prior, 20% earliest)
> - Trend direction + signal strength: rising/falling/flat, Strong/Weak
> - Confidence band: Narrowing (consistent trend) or Widening (volatile trend)
> - Per-metric detail: weighted average change, last actual, key forecast milestones (Month+1, +3, +6, +12)
>
> Thresholds:
> - Trend direction consistent for 4+ months = Strong signal
> - Trend direction mixed or oscillating = Weak signal (state this)
> - Forecast projects a sign flip (profit -> loss) = Severe warning
> - Month+4 onwards carry increasing uncertainty — state this explicitly
> - Month+7 to Month+12 are long-range estimates — caution the reader about reliability
>
> Evaluate:
> - For each line item, describe the recent trend direction in plain language
> - Highlight key forecast milestones: Month+1 (near-term), Month+3 (quarter), Month+6 (half-year), Month+12 (full-year)
> - Flag if the trend is strong (consistent direction) or weak (mixed signals)
> - Explicitly note that longer-range forecasts are less reliable
> - If any forecast month projects a loss or a sign flip, call it out explicitly
>
> Hard rules:
> - The forecast numbers are PRE-COMPUTED in the data block. Do NOT invent your own projections.
> - Always include the disclaimer: these are AI estimates based on historical trends, not formal financial projections
> - Do NOT claim precision — use "approximately" or "around" when stating forecast values
> - Summarise the 12-month trajectory — do NOT list all 12 months individually, focus on key milestones (Month+1, +3, +6, +12)
>
> Provide a concise forecast explanation — the director wants to know "based on recent trends, what should I expect over the next 12 months, and how confident should I be as we look further out."

**Component Prompt — `fv_budget_suggestions`:**

> You are analyzing "AI Budget Suggestions" on the Financial page.
>
> What it shows: AI-generated budget suggestions for the next fiscal period, derived from historical P&L data. The system computes monthly averages from current-period actuals and annualises them to produce suggested annual budgets for each P&L category.
>
> The pre-fetched data gives you:
> - Headline P&L budget suggestions: Net Sales, Cost of Sales, Gross Profit, Operating Costs, Net Profit — each with current-period actual, prior-period actual, YoY growth %, suggested monthly and annual budget
> - Category-level budget suggestions: per account type (Sales, COGS, OpEx, Other Income) with the same columns plus trend direction and signal strength
> - Trend direction: rising / falling / flat for each category, with strong/weak signal based on month-over-month consistency
> - If an approved budget exists: a comparison table showing approved vs suggested amounts with differences
>
> Evaluate:
> - Which categories show strong, consistent trends that make the budget suggestion more reliable?
> - Which categories have weak or volatile trends where the suggestion should be treated with caution?
> - Are there categories where YoY growth is significantly positive or negative — and should the budget account for that trajectory?
> - What is the overall picture — is the business growing, contracting, or stable?
> - Highlight any categories where the suggested budget differs materially from the prior year
> - If an approved budget exists, flag any material differences between the approved budget and the latest suggestions — this indicates the budget may need updating
>
> Hard rules:
> - The budget suggestions are PRE-COMPUTED in the data block. Do NOT invent your own numbers.
> - If no approved budget exists: frame suggestions as "starting points for budget discussions" and note that no budget has been approved yet
> - If an approved budget exists: compare suggestions against the approved budget and highlight discrepancies
> - Cite only figures from the pre-fetched data block. Do NOT recompute.
>
> Provide a concise budget overview — the director wants to know "based on our recent performance, what should we budget for next year, and where are the biggest uncertainties."

---

## 6. Deterministic Summary Questions

Each section has fixed questions the AI must answer during summary synthesis. This makes the summary output predictable — same data always answers the same questions. See doc 10, §16 for the shared pattern.

| Section | Summary Questions |
|---------|-------------------|
| payment_collection_trend | 1. Is avg collection days improving or worsening vs last month? 2. Is collection rate above or below 80%? 3. Which month had the worst collection? |
| payment_outstanding | 1. How much total is outstanding? 2. What % is in the >60 days bucket? 3. Which customers have the highest outstanding? |
| sales_trend | 1. Is net sales up or down vs last month and vs same month last year? 2. What's the month-over-month growth rate? |
| sales_breakdown | 1. Does the top customer exceed 25% of total sales? 2. Which product category drives the most revenue? 3. Is credit note ratio below 1%? |
| customer_margin_overview | 1. Is overall gross margin above 15%? 2. Is margin trending up or down over the last 3 months? 3. How many customers have negative margin? |
| customer_margin_breakdown | 1. Who are the top 3 customers by gross profit? 2. Who are the bottom 3 by margin %? 3. Any customer with margin below 5%? |
| supplier_margin_overview | 1. Is supplier margin above 10%? 2. Is margin trending up or down? 3. How many suppliers have negative margin? |
| supplier_margin_breakdown | 1. Which supplier gives the best margin? 2. Which items have the biggest gap between purchase and selling price? 3. Any supplier with margin below 5%? |
| return_trend | 1. Is return rate above 5%? 2. Is the return trend increasing or decreasing? 3. Which items have the most returns? |
| return_unsettled | 1. How much total unsettled returns? 2. What % is older than 60 days? 3. Which customers have the most unsettled returns? |
| expense_overview | 1. Is total cost up or down vs same period last year? 2. Which cost category grew the most? 3. What are the top 3 expenses? |
| expense_breakdown | 1. What's the COGS to revenue ratio? 2. Which OpEx line item is the largest? 3. Any expense category with >10% YoY increase? |
| financial_overview | 1. Is net profit positive or negative? 2. Is profit margin improving or declining? |
| financial_pnl | 1. Which revenue line changed the most vs last year? 2. Which expense line changed the most? 3. Is gross profit margin stable? |
| financial_balance_sheet | 1. Are total assets growing? 2. Is current ratio above 1.5 (can pay short-term debts)? 3. Is debt increasing or decreasing? |
| financial_variance | 1. Which accounts missed budget by more than 15%? 2. Is the total variance favorable or unfavorable? 3. What's the biggest single variance item? |

---

## 7. Tool Policy

The tool policy controls whether the LLM can make database queries during analysis. See doc 10, §7 for the shared tool-use system.

### Three Tiers

| Tier | What the LLM Can Do | When Used |
|------|---------------------|-----------|
| `none` | No tool access. LLM receives only the pre-fetched data block. | Not used in Finance (all sections have at least aggregate_only). |
| `aggregate_only` | Can query local PostgreSQL `pc_*` tables only. No RDS access. | "Overview" sections and all Financial sections. Data is already pre-aggregated, so tools are rarely needed. |
| `full` | Can query both local `pc_*` tables AND remote RDS `dbo.*` tables. | "Breakdown" sections and snapshot sections. Used for root-cause investigation (e.g. "which customers drove this spike?"). |

### Per-Section Assignments

| Section Key | Policy | Accessible Tables | Rationale |
|-------------|--------|-------------------|-----------|
| payment_collection_trend | aggregate_only | pc_ar_monthly | Trend data is pre-aggregated monthly. No drill-down needed. |
| payment_outstanding | full | All local pc_* + all RDS dbo.* | Snapshot section needs customer-level drill-down for credit health investigation. |
| sales_trend | aggregate_only | pc_sales_daily | Daily sales are pre-aggregated. Trend analysis needs no raw transactions. |
| sales_breakdown | full | All local pc_* + all RDS dbo.* | Breakdown needs customer/product/agent drill-down from raw invoices. |
| customer_margin_overview | aggregate_only | pc_customer_margin | Overview KPIs and trend from pre-computed margin data. |
| customer_margin_breakdown | full | All local pc_* + all RDS dbo.* | Per-customer margin analysis may need raw transaction drill-down. |
| supplier_margin_overview | aggregate_only | pc_supplier_margin | Overview KPIs and trend from pre-computed supplier data. |
| supplier_margin_breakdown | full | All local pc_* + all RDS dbo.* | Per-supplier/item pricing analysis needs raw invoice line items. |
| return_trend | aggregate_only | pc_return_monthly, pc_return_products | Return trends are pre-aggregated monthly + by product. |
| return_unsettled | full | All local pc_* + all RDS dbo.* | Snapshot needs debtor-level drill-down and credit note detail. |
| expense_overview | aggregate_only | pc_expense_monthly | Expense data is pre-aggregated by GL account and month. |
| expense_breakdown | full | All local pc_* + all RDS dbo.* | GL account breakdown may need transaction-level detail. |
| financial_overview | aggregate_only | pc_pnl_period | P&L waterfall from pre-computed period data. |
| financial_pnl | aggregate_only | pc_pnl_period | P&L statement from pre-computed period data. |
| financial_balance_sheet | aggregate_only | pc_pnl_period | Balance sheet from pre-computed period data. |
| financial_variance | aggregate_only | pc_pnl_period | Variance analysis from pre-computed period data. |

**Pattern:** "Overview" sections use `aggregate_only`. "Breakdown" and snapshot sections use `full`. All Financial sections use `aggregate_only` because pc_pnl_period contains all needed data.

---

## 8. Data Source Tables

### 8.1 Local PostgreSQL (pre-computed, `pc_*`)

These tables live in the local PostgreSQL database (DATABASE_URL). They are pre-computed by sync jobs and contain aggregated data ready for analysis.

| Table | Module | Key Columns |
|-------|--------|-------------|
| pc_sales_daily | Sales | doc_date, invoice_total, cash_total, cn_total, net_revenue, doc_count |
| pc_sales_by_customer | Sales | doc_date, debtor_code, company_name, debtor_type, sales_agent, invoice_sales, cash_sales, credit_notes, total_sales |
| pc_sales_by_outlet | Sales | doc_date, dimension, dimension_key, dimension_label, invoice_sales, cash_sales, credit_notes, total_sales, customer_count |
| pc_sales_by_fruit | Sales | doc_date, fruit_name, fruit_country, fruit_variant, invoice_sales, cash_sales, credit_notes, total_sales, total_qty |
| pc_ar_monthly | Payment | month, invoiced, collected, cn_applied, refunded, total_outstanding, total_billed, customer_count |
| pc_ar_customer_snapshot | Payment | debtor_code, company_name, debtor_type, sales_agent, credit_limit, total_outstanding, overdue_amount, credit_score, risk_tier |
| pc_ar_aging_history | Payment | snapshot_date, bucket, dimension, dimension_key, invoice_count, total_outstanding |
| pc_customer_margin | Customer Margin | month, debtor_code, company_name, iv_revenue, dn_revenue, cn_revenue, iv_cost, dn_cost, cn_cost |
| pc_supplier_margin | Supplier Perf. | month, creditor_code, creditor_name, item_code, item_group, sales_revenue, attributed_cogs, purchase_qty, purchase_value |
| pc_return_monthly | Returns | month, cn_count, cn_total, knock_off_total, refund_total, unresolved_total |
| pc_return_products | Returns | month, item_code, item_description, fruit_name, cn_count, total_qty, total_amount |
| pc_return_aging | Returns | snapshot_date, bucket, count, amount |
| pc_return_by_customer | Returns | month, debtor_code, company_name, cn_count, cn_total, knock_off_total, refund_total, unresolved |
| pc_expense_monthly | Expenses | month, acc_no, account_name, acc_type, net_amount |
| pc_pnl_period | Financial | period_no, acc_type, acc_no, account_name, parent_acc_no, home_dr, home_cr, proj_no |
| budget | Financial | fiscal_year, line_item, annual_budget, monthly_budget, updated_at |

### 8.2 Remote SQL Server (RDS, transaction detail)

These tables live on the remote SQL Server (RDS). They contain raw transaction-level data. Only accessible by sections with `full` tool policy.

| Table | Module | Key Columns | Required Filter |
|-------|--------|-------------|----------------|
| dbo.IV | Invoices | DocNo, DocDate, DebtorCode, LocalNetTotal, SalesAgent | Cancelled = 'F' |
| dbo.CS | Cash Sales | DocNo, DocDate, DebtorCode, LocalNetTotal, SalesAgent | Cancelled = 'F' |
| dbo.CN | Credit Notes | DocNo, DocDate, DebtorCode, LocalNetTotal, CNType | Cancelled = 'F' |
| dbo.ARInvoice | AR Invoices | DocNo, DocDate, DueDate, DebtorCode, Outstanding | Cancelled = 'F' |
| dbo.ARPayment | AR Payments | DocNo, DocDate, DebtorCode, LocalPaymentAmt | Cancelled = 'F' |
| dbo.ARPaymentKnockOff | Payment KO | DocKey, KnockOffDocKey, KnockOffAmt, KnockOffDate | — |

**Aggregate-only tables (9):** pc_sales_daily, pc_ar_monthly, pc_ar_aging_history, pc_customer_margin, pc_supplier_margin, pc_return_monthly, pc_return_products, pc_expense_monthly, pc_pnl_period

---

## 9. Thresholds

Finance uses hardcoded thresholds (not configurable). Each threshold is documented inline in the component prompts above (§5). This section provides a quick-reference summary organized by section.

### Payment

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Collection Days | ≤30 | ≤60 | >60 |
| Collection Rate | ≥80% | ≥50% | <50% |
| Overdue % of Outstanding | <20% | 20-40% | >40% |
| Credit Limit Breaches | 0 | — | >0 |
| Credit Health Score | ≥75 (Low risk) | 31-74 (Moderate) | ≤30 (High risk) |

### Sales

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| CN Ratio | ≤1% | 1-3% | >3% |
| Top Customer Concentration | <15% | 15-25% | >25% |
| Top Product Concentration | <20% | 20-35% | >35% |
| Single Outlet Concentration | <50% | — | >50% |

### Customer Margin

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Gross Margin % | ≥15% | 10-15% | <10% |
| Net Sales Growth | >5% | 0-5% | Decline |
| Top Customer GP Share | <40% (top 10) | 40-60% | >60% |
| Loss-Making Customers | 0 | <10% of active | >10% of active |

### Supplier Performance

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Gross Margin % | ≥15% | 10-15% | <10% |
| Margin % Drop | — | — | ≥2pp vs prior |
| Active Supplier Change | ±5% | -5% to -10% | >10% drop |
| Top Supplier GP Share | <40% (top 10) | 40-60% | >60% |

### Returns

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Return Rate | <2% | 2-5% | >5% |
| Unsettled % | <15% | 15-30% | >30% |
| Knock-off % | >70% | 50-70% | <50% |
| Refund % | <30% | — | >30% |
| Aging 91+ Days | <25% | — | >25% |
| Aging 180+ Days | <10% | — | >10% |

### Expenses

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| YoY Total Cost | <0% | 0-5% | >10% |
| COGS Share | 60-80% | — | >85% |
| OpEx YoY | <0% | 0-10% | >10% |
| COGS Share Drift | — | — | >+3pp |
| Top 1 Account | <15% | 15-30% | >30% |

### Financial

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Gross Margin | >25% | 15-25% | <15% |
| Operating Margin | >10% | 0-10% | <0% (loss) |
| Net Margin | >7% | 0-7% | <0% (loss) |
| Current Ratio | >2.0 | 1.0-2.0 | <1.0 |
| Debt-to-Equity | <0.5 | 0.5-1.0 | >2.0 |
| Variance | ±5% | ±5-15% | >±15% |

See doc 10, §19 for the shared threshold strategy.

---

## 10. Column Whitelisting (Data Protection)

Finance uses column whitelisting to control what data the LLM's tools can access. See doc 10, §15 for the shared pattern.

### Local PostgreSQL Whitelist

Each `pc_*` table has a declared list of allowed columns in `tools.ts` (`LOCAL_WHITELIST`). Only these columns can be queried by the LLM.

**Intentionally exposed:** Customer/company names (`company_name`), debtor/creditor codes, sales agent names, invoice numbers — needed for actionable insights.

**Blocked by omission:** Customer emails, phone numbers, contact persons, bank account details — never in any whitelist.

### Remote RDS Whitelist

Each `dbo.*` table has a declared list in `tools.ts` (`RDS_WHITELIST`). Transaction-level columns like `DocNo`, `DocDate`, `DebtorCode`, `LocalNetTotal` are allowed. No personal contact details.

### Runtime Enforcement

`validateColumns()` in `tools.ts` rejects any tool call requesting columns not in the whitelist. This is enforced at query execution time, not prompt-level.

---

## 11. RBAC Scoping (Role-Based Access Control)

| Role | Can Trigger Analysis | Can View Insights |
|------|---------------------|-------------------|
| Superadmin | Yes | Yes |
| Finance | Yes | Yes |
| Director | Yes | Yes |
| Other roles | No | View cached insights only |

**Current implementation:** Client-side only. The "Analyze" button is hidden for non-authorized roles via `useRole()` context.

**Required:** Add server-side role validation on `/api/ai-insight/analyze` and `/api/ai-insight/cancel` routes. Reject requests from unauthorized roles with 403.

See doc 10, §18 for the shared RBAC pattern.

---

## 12. Summary System Prompt

The summary system prompt is used in Phase 2 when Sonnet synthesizes all component results into insight cards. This is the full text from `prompts.ts`:

> You are a senior financial analyst producing a summary for a section of the Hoi-Yong Finance dashboard. You are speaking to a senior director who may only read this summary and skip individual component details.
>
> Below are the RAW DATA BLOCKS for each component in this section. Review them all and produce a summary.
>
> ===============================================================================
> GROUND TRUTH RULE (highest priority -- violating this destroys the entire insight)
> ===============================================================================
>
> The raw data blocks in the user prompt are the ONLY source of truth for numbers.
> Every RM amount, every percentage, every day count, every customer/product/agent
> name, and every month label you write MUST be traceable to:
>   (a) a specific line in one of the raw data blocks above, OR
>   (b) a result returned by a tool call you actually make.
>
> Before you write any number into a card title, metric, summary, bullet, or table
> cell, locate its source. If you cannot point to the exact line it came from,
> OMIT the number entirely. Do NOT:
> - Invent plausible-looking figures to fill a table.
> - Back-solve arithmetic (e.g. "if the gap is RM X and collected is Y, then
>   invoiced must be Y+X") -- the individual operands must themselves come from
>   the data, not from your arithmetic.
> - Paraphrase a number into a slightly different one.
> - Pick a subset of months that supports a narrative while ignoring the rest.
>
> **Sub-period citation rule (hard constraint -- violating this is how past
> runs fabricated the "Jul-Oct averaged RM -771K" bug):**
> - If you want to cite a sub-period AVERAGE (e.g. "H2 averaged RM -X/month",
>   "first half averaged Y", "Jul-Oct averaged Z"), you MUST copy it verbatim
>   from a "Pre-calculated half-period averages" line in the raw data block.
>   You may NOT define your own sub-period (e.g. "Jul-Oct", "Q3-Q4",
>   "second half of the year") and average it yourself. Mental arithmetic on
>   monthly values is forbidden.
> - If you want to cite a sub-period RANGE ("gaps ranged from RM -A to RM -B"),
>   the range must include EVERY month in the named sub-period and the stated
>   min/max must be the actual extremes of that set. You may NOT omit a month
>   that breaks your narrative. Prefer the pre-computed H1/H2 range lines.
> - If you want to narrate a TREND ("narrowing", "widening", "improving",
>   "tightening gaps"), only use the pre-computed "H1->H2 direction" line when
>   available. Never claim a direction that is contradicted by an individual
>   month inside the sub-period.
> - If the raw data does not give you a pre-computed figure for the sub-period
>   you want to cite, drop the claim. Describe month-by-month direction
>   instead, or cite the full-period average.
>
> A +/-RM 1 rounding on totals is acceptable. Any name mismatch is not.
>
> ===============================================================================
> Root-cause investigation:
> ===============================================================================
>
> You have access to database query tools. Use them to investigate root causes for NEGATIVE findings:
> - If a component flags a spike, anomaly, or concern and the raw data block does not already name the drivers, use a tool to find out WHY -- identify which customers, products, or months drove it.
> - Maximum 2 tool calls -- focus on the 1-2 most impactful negatives.
> - For POSITIVE findings, cite supporting evidence directly from the raw data blocks.
> - The director needs actionable "why" -- not just "what happened."
>
> Available tables and columns for tool queries:
>
> LOCAL (PostgreSQL -- pre-aggregated, query first):
> - pc_sales_daily: doc_date, invoice_total, cash_total, cn_total, net_revenue, doc_count
> - pc_sales_by_customer: doc_date, debtor_code, company_name, debtor_type, sales_agent, invoice_sales, cash_sales, credit_notes, total_sales, doc_count
> - pc_sales_by_outlet: doc_date, dimension, dimension_key, dimension_label, is_active, invoice_sales, cash_sales, credit_notes, total_sales, doc_count, customer_count
> - pc_sales_by_fruit: doc_date, fruit_name, fruit_country, fruit_variant, invoice_sales, cash_sales, credit_notes, total_sales, total_qty, doc_count
> - pc_ar_monthly: month, invoiced, collected, cn_applied, refunded, total_outstanding, total_billed, customer_count
> - pc_ar_customer_snapshot: debtor_code, company_name, debtor_type, sales_agent, display_term, credit_limit, total_outstanding, overdue_amount, utilization_pct, credit_score, risk_tier, is_active, invoice_count, avg_payment_days, max_overdue_days
> - pc_ar_aging_history: snapshot_date, bucket, dimension, dimension_key, invoice_count, total_outstanding
> - pc_customer_margin: month, debtor_code, company_name, debtor_type, sales_agent, is_active, iv_revenue, dn_revenue, cn_revenue, iv_cost, dn_cost, cn_cost, iv_count, cn_count
> - pc_supplier_margin: month, creditor_code, creditor_name, item_code, item_group, is_active, sales_revenue, attributed_cogs, purchase_qty, purchase_value
>
> REMOTE (SQL Server -- raw transactions, use for detail drill-down):
> - dbo.IV (Invoices): DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, SalesLocation, Cancelled
> - dbo.CS (Cash Sales): DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, SalesLocation, Cancelled
> - dbo.CN (Credit Notes): DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, CNType, Cancelled
> - dbo.ARInvoice: DocNo, DocDate, DueDate, DebtorCode, LocalNetTotal, Outstanding, DisplayTerm, Cancelled
> - dbo.ARPayment: DocNo, DocDate, DebtorCode, LocalPaymentAmt, Description, Cancelled
>
> IMPORTANT column name reminders:
> - Sales daily table uses: invoice_total (not invoice_sales), cash_total (not cash_sales), cn_total (not credit_notes), net_revenue (not net_sales)
> - Remote tables require: Cancelled = 'F' filter for non-cancelled records
> - Row limit: 100 rows per query
>
> Tool usage rules:
> - You have a maximum of 2 tool calls. Use them wisely -- do NOT waste them on data already available in the component analyses above.
> - DO NOT query pc_ar_monthly for the same date range as the current analysis -- that data is already in the component analyses. You MAY query pc_ar_monthly for months OUTSIDE the current range (e.g. 2021-2023 baseline) to give the director multi-year historical context for a snapshot metric.
> - Prefer using tools for: (a) customer-level breakdown (pc_ar_customer_snapshot), (b) credit note or return detail (dbo.CN), or (c) multi-year historical anchoring (pc_ar_monthly outside current range).
> - If you want to investigate something, USE the tool -- do not describe what you would query. Make the actual tool call.
> - After you receive tool results, incorporate the findings into your insights.
> - Whether or not you use tools, your FINAL response MUST use the ===INSIGHT=== delimiter format below. Never output reasoning text or "let me check..." as your final response.
>
> Output format -- use this EXACT delimiter structure (no JSON, no code blocks):
>
> ===INSIGHT===
> sentiment: good
> title: Short punchy headline (max 50 chars)
> metric: Key number e.g. 84.3%, 43 days, RM 2.1M (max 25 chars)
> summary: One short plain-text sentence -- the card preview (max 80 chars, no markdown)
> ---DETAIL---
> Full markdown analysis here (see detail rules below)
> ===END===
>
> Repeat ===INSIGHT=== ... ===END=== for each insight. Maximum 3 good + 3 bad insights. Rank by business impact -- most important first.
>
> Title rules:
> - Maximum 50 characters. Be punchy and direct like a newspaper headline.
> - Examples: "Tuesday Sales Peak", "Strong Collection Recovery", "Credit Note Spike"
> - Do NOT write full sentences as titles. No verbs like "is", "has", "shows".
>
> Metric rules:
> - Show the actual key number -- e.g. "84.3%", "43 days", "RM 2.1M", "35%".
> - If no single number fits, use the metric area label -- e.g. "Collection Days", "Aging", "By Customer".
>
> Summary rules:
> - The summary is a PUNCHY one-liner shown on the collapsed insight card (before the director clicks for detail).
> - HARD LIMIT: 80 characters. Aim for 50-70. If it doesn't fit, cut words -- don't truncate mid-sentence.
> - Plain text only -- NO markdown, NO bold, NO bullets, NO sub-headers, NO "**" or "##".
> - Write it like a news ticker headline: subject + what's happening + why it matters. Drop filler words ("Despite", "Notably", "The overall", etc.).
> - Lead with business meaning, not the metric name or scope. Scope belongs in the detail, not the summary.
> - Do NOT repeat the title verbatim. Title = headline; summary = the "so what" in one line.
> - Examples:
>   - GOOD: "Collection solid at 84.7%, well above 80% target."
>   - GOOD: "29 High Risk customers hold 58% of outstanding debt."
>   - GOOD: "SEASONS AGRO breaches limit at 1,172% utilization."
>   - BAD: "Despite the nominal pressures detailed above, Hoi-Yong's overall Collection Rate of 74..." (too long, starts with filler)
>   - BAD: "Current Status (as of 2026-04-05): Every single ringgit ..." (markdown-ish prefix, too long)
>
> Detail rules:
> - The detail is the FULL ANALYST REPORT. A director who reads only this should understand the complete situation AND who to call about it.
> - Structure is bullet-first with bold colon-suffixed sub-headers and a blank line between blocks for vertical rhythm. No walls of prose.
> - Aim for 220-320 words per detail. Tight, scannable.
>
> Use this structural template. Every section below is MANDATORY -- do not omit:
>
> **Current Status** (include scope reference -- "as of [date]" for snapshot, "over [period]" for period metrics):
> - 1-2 bullets stating the headline number and its business meaning.
>
> **Key Observations**:
> - 2-4 bullets naming non-obvious patterns (seasonal spikes, month-of-the-year comparisons, trend direction over 3+ data points).
> - Each bullet stands alone. Use specific numbers / RM amounts / dates.
>
> **Supporting Evidence / Root Cause** -- MANDATORY, never omit:
> - For POSITIVE insights, rename this sub-header to "Supporting Evidence" and cite positive drivers: the best months, the strongest customers / products / categories, the improving trend lines, the specific numbers that justify the positive framing.
> - For NEGATIVE insights, rename this sub-header to "Root Cause" and name the specific customers / products / months / agents that drove the finding with RM amounts and share of total.
> - This section MUST include a Markdown table with at least 3 rows of the top contributors whenever the underlying component data contains a top-N list (e.g. top customers by outstanding, top breachers, worst months by gap, best months by collection). Example columns: Name | RM Amount | % of Total | Extra context. Do not skip the table -- it is the director's evidence list. Every cell in the table must be a verbatim copy from the data block (see Verbatim-copy rule in the global system prompt).
> - If the data genuinely has no discrete contributors (e.g. a single KPI with no breakdown in any component), use 3-5 bullets of specific numbers instead of a table and state explicitly which component the evidence came from.
>
> **Implication**:
> - 1-2 bullets stating the bottom-line business consequence and what it means operationally for the director.
>
> Formatting discipline:
> - Always blank line between a sub-header and its content, and between a bullet block and the next sub-header.
> - Bullets no longer than 2 sentences.
> - Bold labels inside bullets end with a colon + space (example: "- **SEASONS AGRO**: RM 351,476 on a RM 30,000 limit (1,172%).").
>
> Content discipline:
> - Include specific numbers, percentages, RM amounts, and period references as evidence.
> - When the component data contains a top-N ranked list, you MUST name the top 3-5 entries by name in either the table or bullets. Never hide behind aggregates when named contributors are available.
> - Cross-reference multiple components when relevant -- synthesize, don't isolate.
> - Do not repeat what individual analyses said verbatim -- synthesize across them.
>
> Terminology rules:
> - Use ONLY the exact metric names shown on the dashboard (e.g. "Avg Collection Days", "Collection Rate", "Net Sales").
> - Do NOT introduce financial jargon or acronyms not on the dashboard (e.g. do NOT say "DSO", "AR turnover", "DPO"). The audience is non-financial executives.
>
> Quality rules:
> - Do not produce a good insight and a bad insight that contradict each other. If the same metric has both positive and negative aspects, pick the dominant signal or merge into one nuanced insight.
> - If two individual component analyses cover overlapping ground, synthesize them into a single insight rather than listing separately.
> - If everything is good, you may have 0 bad insights (and vice versa).
> - Do not repeat what individual analyses said verbatim -- synthesize across them into a coherent narrative.

---

## 13. Storage DDL

Finance-specific database tables. Run against the local PostgreSQL (DATABASE_URL).

**File:** `apps/dashboard/sql/ai-insight-schema.sql`

```sql
-- 1. Global lock (singleton row)
CREATE TABLE IF NOT EXISTS ai_insight_lock (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  locked_by     TEXT,
  locked_at     TIMESTAMP WITH TIME ZONE,
  section_key   TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO ai_insight_lock (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Section-level insight (high-level summary)
CREATE TABLE IF NOT EXISTS ai_insight_section (
  id               SERIAL PRIMARY KEY,
  page             TEXT NOT NULL,
  section_key      TEXT NOT NULL,
  summary_json     JSONB NOT NULL,
  analysis_time_s  NUMERIC(6,1),
  token_count      INTEGER,
  cost_usd         NUMERIC(8,4),
  date_range_start DATE,
  date_range_end   DATE,
  fiscal_year      TEXT,          -- e.g. "FY2025" — populated for fiscal_period scope sections
  fiscal_range     TEXT,          -- 'fy' | 'last12' | 'ytd'
  generated_by     TEXT NOT NULL,
  generated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (page, section_key)
);

-- Idempotent migration for existing databases predating fiscal_period scope.
ALTER TABLE ai_insight_section ADD COLUMN IF NOT EXISTS fiscal_year  TEXT;
ALTER TABLE ai_insight_section ADD COLUMN IF NOT EXISTS fiscal_range TEXT;

-- 3. Component-level insight (individual analyses)
CREATE TABLE IF NOT EXISTS ai_insight_component (
  id              SERIAL PRIMARY KEY,
  section_id      INTEGER NOT NULL REFERENCES ai_insight_section(id) ON DELETE CASCADE,
  component_key   TEXT NOT NULL,
  component_type  TEXT NOT NULL,
  analysis_md     TEXT NOT NULL,
  token_count     INTEGER,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (section_id, component_key)
);
```

See doc 10, §8 for the shared storage schema pattern.

---

## 14. API Routes

All routes are under `apps/dashboard/src/app/api/ai-insight/`.

| Method | Path | Purpose | Request / Response |
|--------|------|---------|-------------------|
| POST | `/api/ai-insight/analyze` | Start analysis (SSE stream) | Body: `{ page, section_key, date_range, fiscal_period, user_name }`. Returns SSE events: `progress`, `component`, `summary`, `complete`, `error`. |
| GET | `/api/ai-insight/status` | Check lock status | Returns `{ locked, locked_by, locked_at, section_key }` |
| GET | `/api/ai-insight/section/:section_key` | Get cached section result | Returns `{ summary_json, generated_at, ... }` or 404 |
| GET | `/api/ai-insight/component/:section_key/:component_key` | Get cached component result | Returns `{ analysis_md, component_type, ... }` or 404 |
| POST | `/api/ai-insight/cancel` | Cancel running analysis | Returns `{ cancelled: true }` or error |

### Budget API Endpoints (Finance-specific)

| Method | Path | Purpose | Request / Response |
|--------|------|---------|-------------------|
| POST | `/api/budget/save` | Upsert AI-generated budget lines for a fiscal year | `{ fiscalYear }` -> computes headline P&L lines, upserts to `budget` table |
| GET | `/api/budget/:fiscalYear` | Retrieve saved budget for a fiscal year | -> `BudgetRow[]` (empty array if none) |

See doc 10, §9 for the shared API endpoint pattern.

---

## 15. File Structure

### AI Insight Module

```
apps/dashboard/src/lib/ai-insight/
  types.ts            — TypeScript types: SectionKey, ComponentInfo, AnalysisResult, etc.
  client.ts           — Browser-side SSE client for streaming analysis results
  prompts.ts          — All prompts: GLOBAL_SYSTEM, COMPONENT_PROMPTS (66), SUMMARY_SYSTEM,
                        SECTION_COMPONENTS mapping, SECTION_PAGE, SECTION_NAMES
  data-fetcher.ts     — Fetches pre-computed data from PostgreSQL for each component
  orchestrator.ts     — Phase 1 (parallel component analysis) + Phase 2 (summary synthesis)
  numeric-guard.ts    — Post-analysis validation: checks numbers in output match source data
  storage.ts          — Read/write ai_insight_section and ai_insight_component tables
  lock.ts             — Global lock management (acquire, release, check)
  tools.ts            — LLM tool definitions, column whitelists, validateColumns()
  tool-policy.ts      — Section -> tool policy mapping (aggregate_only | full | none)
  debug-logger.ts     — Structured debug logging for analysis runs
  component-info.ts   — Component metadata lookup (name, type, section)
```

### API Routes

```
apps/dashboard/src/app/api/ai-insight/
  analyze/route.ts              — POST handler: validate, lock, orchestrate, stream, store
  section/[section_key]/route.ts — GET handler: return cached section result
  cancel/route.ts               — POST handler: cancel running analysis
  status/route.ts               — GET handler: return lock status
```

### SQL

```
apps/dashboard/sql/
  ai-insight-schema.sql   — CREATE TABLE statements for lock, section, component tables
```

---

## 16. Budget Approval Flow

Applies only to the `financial_variance` section.

After analysis completes:

1. A blue banner appears below the insight panel: "Save the AI-generated budget suggestions as the approved budget for {fiscalYear}?"
2. User clicks "Approve as Budget" -> POST `/api/budget/save` with `{ fiscalYear }`.
3. Button states: idle -> saving -> saved -> error (retry).
4. Only visible when: section is `financial_variance`, analysis is complete, and the panel is expanded.

### Budget API Endpoints

| Method | Path | Purpose | Request / Response |
|--------|------|---------|-------------------|
| POST | `/api/budget/save` | Upsert AI-generated budget lines for a fiscal year | `{ fiscalYear }` -> computes headline P&L lines, upserts to `budget` table |
| GET | `/api/budget/:fiscalYear` | Retrieve saved budget for a fiscal year | -> `BudgetRow[]` (empty array if none) |

---

## 17. Implementation Sequence

Build order for a developer implementing the Finance AI Insight module:

| Step | What | Depends On |
|------|------|------------|
| 1 | Run `ai-insight-schema.sql` to create storage tables | Database access |
| 2 | Implement `types.ts` — define all TypeScript types | Nothing |
| 3 | Implement `prompts.ts` — all 66 component prompts, global system prompt, summary prompt | types.ts |
| 4 | Implement `tool-policy.ts` — section-to-policy mapping | types.ts |
| 5 | Implement `tools.ts` — tool definitions, column whitelists, validateColumns() | types.ts |
| 6 | Implement `lock.ts` — global lock acquire/release/check | Storage tables |
| 7 | Implement `storage.ts` — read/write section and component results | Storage tables |
| 8 | Implement `data-fetcher.ts` — fetch pre-computed data for each component | pc_* tables, types.ts |
| 9 | Implement `numeric-guard.ts` — post-analysis number validation | Nothing |
| 10 | Implement `orchestrator.ts` — Phase 1 + Phase 2 orchestration | All above |
| 11 | Implement `client.ts` — browser SSE client | Nothing |
| 12 | Implement API routes (analyze, status, section, cancel) | orchestrator.ts, lock.ts, storage.ts |
| 13 | Implement budget API routes (/api/budget/save, /api/budget/:fiscalYear) | storage tables, budget table |
| 14 | Wire up UI components (InsightSectionHeader, AiInsightPanel) | client.ts, API routes |
| 15 | Add budget approval button to financial_variance section UI | Budget API, UI components |

---

## 18. Verification Plan

### Per-Section Smoke Test

For each of the 16 sections:
1. Click "Analyze" on the section header.
2. Verify SSE stream shows progress events for each component.
3. Verify all components complete (check count matches the catalog above).
4. Verify summary produces 1-6 insight cards (good + bad).
5. Verify cached results load on page refresh (GET section endpoint).
6. Verify component detail dialog shows markdown analysis.

### Threshold Verification

For each threshold in §9:
1. Provide data that triggers each threshold band (good, warning, critical).
2. Verify the component analysis mentions the correct threshold language.

### Tool Policy Verification

1. For `aggregate_only` sections: verify tool calls only access local `pc_*` tables.
2. For `full` sections: verify tool calls can access both local and RDS tables.
3. Verify `validateColumns()` rejects queries with non-whitelisted columns.

### Budget Flow Verification

1. Run analysis on `financial_variance` section.
2. Verify "Save as Budget" button appears after analysis completes.
3. Click "Approve as Budget" and verify POST `/api/budget/save` succeeds.
4. Re-run analysis and verify the budget comparison appears in `fv_budget_suggestions`.

### RBAC Verification

1. Log in as Superadmin/Finance/Director: verify "Analyze" button is visible.
2. Log in as other role: verify "Analyze" button is hidden.
3. Attempt direct POST to `/api/ai-insight/analyze` as unauthorized role: verify 403 response.

---

## 19. In-App User Guide

An end-user manual page is available at `/manual/general/ai-insight` explaining how to use the AI Insight feature. Includes 5 annotated screenshots covering: collapsed panel, analysis results, insight detail dialog, component icon, and component dialog.
