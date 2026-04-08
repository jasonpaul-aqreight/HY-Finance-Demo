# AI Insight Engine — Requirements Specification

> Scope: Sales Report & Payment Collection pages only.
> Status: Draft — pending stakeholder approval.

---

## 1. Purpose

Embed an AI-powered analyst inside the Hoi-Yong Finance dashboard that interprets what the user sees on-screen, surfaces good/bad insights, and lets directors understand business health in plain language — without leaving the dashboard.

### What It Does

- Analyzes every KPI, chart, and table on a page section
- Produces per-component insights (viewable via an icon on each component)
- Synthesizes a high-level summary with good/bad labels (viewable in a collapsible panel)
- Optionally digs deeper into raw data if the pre-calculated values are insufficient

### What It Does NOT Do

- Prescribe specific actions ("you should stop selling to X" or "fire agent Y")
- Predict future values
- Modify data or trigger business processes

Note: The AI *may* identify potential root causes (e.g., "high credit notes may indicate product quality or order accuracy issues"). This is analytical reasoning, not a business recommendation. The distinction: "credit notes are high, possibly due to quality issues" (analysis) vs "you should change your supplier" (recommendation).

---

## 2. Page & Section Inventory

### 2.1 Payment Collection (2 sections)

#### Section 1: Payment Collection Trend (date-filtered)

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 1 | Avg Collection Days | KPI | `pc_ar_monthly` | N days (green ≤30 / yellow ≤60 / red >60) |
| 2 | Collection Rate | KPI | `pc_ar_monthly` | N.N% (green ≥80% / yellow ≥50% / red <50%) |
| 3 | Avg Monthly Collection | KPI | `pc_ar_monthly` | RM N (blue, static) |
| 4 | Avg Collection Days Trend | Line Chart | `pc_ar_monthly` | Monthly line + avg reference |
| 5 | Invoiced vs Collected | Combo Chart | `pc_ar_monthly` | Blue bars (collected) + red line (invoiced) |

**AI calls:** 5 parallel component analyses + 1 summary = **6 total**

#### Section 2: Outstanding Payment (snapshot — no date filter)

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 6 | Total Outstanding | KPI | `pc_ar_customer_snapshot` | RM N (orange, static) |
| 7 | Overdue Amount | KPI | `pc_ar_customer_snapshot` | RM N, N% of total, N customers (red) |
| 8 | Credit Limit Breaches | KPI | `pc_ar_customer_snapshot` | N customers (green=0, red>0) |
| 9 | Aging Analysis | Horizontal Bar | `pc_ar_aging_history` | 6 aging buckets, 3 view modes |
| 10 | Credit Usage Distribution | Donut Chart | `pc_ar_customer_snapshot` | Within/Near/Over limit counts |
| 11 | Customer Credit Health | Table | `pc_ar_customer_snapshot` | 11 columns, sortable, paginated |

**AI calls:** 6 parallel component analyses + 1 summary = **7 total**

### 2.2 Sales Report (2 sections — NEW split)

The Sales page currently has no section headers. Two section headers will be added:

#### Section 3: Sales Trend (date-filtered)

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 12 | Net Sales | KPI | `pc_sales_daily` | RM N |
| 13 | Invoice Sales | KPI | `pc_sales_daily` | RM N |
| 14 | Cash Sales | KPI | `pc_sales_daily` | RM N |
| 15 | Credit Notes | KPI | `pc_sales_daily` | -RM N (red) |
| 16 | Net Sales Trend | Stacked Bar | `pc_sales_daily` | Invoice + Cash - CN by period |

**AI calls:** 5 parallel component analyses + 1 summary = **6 total**

#### Section 4: Sales Breakdown (date-filtered)

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 17 | By Customer | Chart + Table | `pc_sales_by_customer` | Top customers by net sales |
| 18 | By Product | Chart + Table | `pc_sales_by_fruit` | Top products by net sales |
| 19 | By Sales Agent | Chart + Table | `pc_sales_by_outlet` | Agent performance + customer count |
| 20 | By Outlet | Chart + Table | `pc_sales_by_outlet` | Location-based sales |

**AI calls:** 4 parallel component analyses + 1 summary = **5 total**

### Totals

| | Sections | Components | AI Calls per Full Run |
|-|----------|------------|----------------------|
| Payment | 2 | 11 | 13 |
| Sales | 2 | 9 | 11 |
| **Grand Total** | **4** | **20** | **24** |

---

## 3. AI Engine Configuration

| Setting | Value |
|---------|-------|
| SDK | `@anthropic-ai/sdk` (standard Anthropic SDK with tool use) |
| Model | Latest Haiku (`claude-haiku-4-5-20251001`) |
| Max runtime per section | 5 minutes |
| Max cost per section | $0.50 USD |
| Estimated cost per section | ~$0.02–0.10 (well within limit) |
| Output format | Markdown (supports tables, bold, bullets) |
| Tool use | Yes — custom tool definitions for read-only data exploration |
| Agentic pattern | Multi-step reasoning loop: send → tool_use → execute → tool_result → repeat until done |

> **Why `@anthropic-ai/sdk` and not `@anthropic-ai/claude-agent-sdk`?**
> The agent SDK spawns Claude Code CLI subprocesses — designed for code-level tasks (file reads, bash commands). The AI Insight Engine needs custom database query tools with strict guardrails (column whitelists, PII exclusion, row limits). The standard SDK with tool use gives full control over tool definitions, execution, and enforcement while still supporting agentic multi-step reasoning. This also provides a unified foundation for future features (chatbot, ML forecasting) that all share the same API pattern.

---

## 4. UI Specification

### 4.1 Section Header (Collapsible AI Panel Container)

Each section has a header bar that doubles as the AI Insight Panel toggle.

```
┌─────────────────────────────────────────────────────────┐
│  Section Title                              Get Insight ▼│
└─────────────────────────────────────────────────────────┘
```

- **"Get Insight"** button in the section header — click to expand/collapse the AI Panel below the header
- The arrow icon rotates when expanded (▼ → ▲)
- For pages that previously had no section headers (Sales), two new section headers are added: "Sales Trend" and "Sales Breakdown"

### 4.2 AI Insight Panel (Collapsed Inside Section Header Dropdown)

**State 1: Never generated**

```
┌─────────────────────────────────────────────────────────┐
│  Section Title                              Get Insight ▲│
├─────────────────────────────────────────────────────────┤
│                                                         │
│              No insights generated yet.                 │
│     Click "Analyze" to generate AI insights.            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Analysis Time: -    Token Used: -    Analysis Cost: -  │
│  Last Updated: -                      By whom: -        │
│                                              [Analyze]  │
└─────────────────────────────────────────────────────────┘
```

**State 2: Analyzing (in progress)**

```
┌─────────────────────────────────────────────────────────┐
│  Section Title                              Get Insight ▲│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Analyzing Avg Collection Days...                       │
│  Analyzing Collection Rate...                           │
│  ✓ Avg Monthly Collection — done                        │
│  Analyzing Invoiced vs Collected chart...               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Analysis Time: -    Token Used: -    Analysis Cost: -  │
│  Last Updated: -                      By whom: -        │
│                                               [Cancel]  │
└─────────────────────────────────────────────────────────┘
```

- Log lines appear in real-time as each component analysis starts/completes
- The "Analyze" button becomes a red "Cancel" button during analysis

**State 3: Results available**

```
┌─────────────────────────────────────────────────────────┐
│  Section Title                              Get Insight ▲│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ── High-Level Summary ──                               │
│  👍 Good: Collection rate at 84.7% — healthy...         │
│  👍 Good: Avg monthly collection steady at RM 5.8M...   │
│  👎 Bad: Avg collection days at 44 — above 30-day...    │
│  👎 Bad: Collection gap widening — invoiced exceeds...  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Analyzed: Nov 2024 – Oct 2025 (12 months)              │
│  Analysis Time: 12s   Tokens: 3,421   Cost: $0.03      │
│  Last Updated: 2026-04-08 14:32      By: Jason          │
│                                              [Analyze]  │
└─────────────────────────────────────────────────────────┘
```

- Each insight is one line, clickable
- Good insights: green text with 👍 prefix
- Bad insights: red text with 👎 prefix
- Maximum: **3 good + 3 bad** insights displayed
- Clicking an insight opens the **Insight Detail Dialog** (Section 4.4)
- "Analyzed" row shows the date range used (or "Snapshot — current state" for non-date-filtered sections like Outstanding Payment)

**State 4: Blocked by concurrent user**

```
┌─────────────────────────────────────────────────────────┐
│  Analysis is currently running by [User Name].          │
│  Please wait for it to complete.                        │
│                                              [Disabled] │
└─────────────────────────────────────────────────────────┘
```

- The Analyze button is disabled globally (see Section 7)

### 4.3 Individual Component Analyze Icon

Every KPI card, chart, and table has a small analyze icon (🔍📊) in its header area.

```
  Avg Collection Days 🔍
  44 days
```

- Clicking the icon opens the **Component Insight Dialog** (Section 4.5)
- The icon is always visible but the dialog content depends on whether analysis has been run
- Does **NOT** trigger a new API call — it shows stored results from the last section-level analysis

### 4.4 Insight Detail Dialog (Popup — From AI Panel Click)

Opened when clicking a good/bad insight line in the AI Panel.

```
┌─────────────────────────────────────────────────────┐
│                                                  ✕  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Avg collection days at 44 — above target     │  │  ← Red/green header
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Analysis explanation in markdown.                  │
│  Multiple paragraphs, bullet points, etc.           │
│                                                     │
│  **Evidence:**                                      │
│                                                     │
│  | Month   | Collection Days | Trend |              │
│  |---------|-----------------|-------|              │
│  | 2025-08 | 42              | ↓     |              │
│  | 2025-09 | 39              | ↓     |              │
│  | 2025-10 | 44              | ↑     |              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Header bar is color-coded: red for bad, green for good
- Body is rendered Markdown (supports tables, bold, bullets, code blocks)
- Close button (✕) in top-right corner

### 4.5 Component Insight Dialog (Popup — From Analyze Icon Click)

Opened when clicking the 🔍 icon on any KPI, chart, or table.

```
┌─────────────────────────────────────────────────────┐
│  About: Avg Collection Days                      ✕  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  **What it measures:**                              │
│  How many days on average it takes to collect       │
│  payment after invoicing.                           │
│                                                     │
│  **Formula:**                                       │
│  (AR Outstanding at month-end ÷ Monthly Credit      │
│  Sales) × Days in that month. KPI shows the average │
│  across all valid months.                           │
│                                                     │
│  **Indicator:**                                     │
│  ≤30 days = Good (green)                            │
│  ≤60 days = Warning (yellow)                        │
│  >60 days = Critical (red)                          │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  **Analysis:**                                      │
│  [AI-generated markdown analysis for this           │
│   specific component, from last Analyze run]        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Last Updated: 2026-04-08 14:32   By: Jason         │
└─────────────────────────────────────────────────────┘
```

- Top section: static content hardcoded from PRD (what it is, formula, good/bad indicator)
- Bottom section: AI-generated analysis from the last section-level "Analyze" run
- If analysis has never been run: bottom section shows "No analysis available. Run 'Analyze' from the section panel."
- Metadata footer shows the same last-updated info as the AI Panel

---

## 5. Analysis Flow

### 5.1 Trigger

User clicks the **"Analyze"** button on a section's AI Panel.

### 5.2 Execution Steps

```
Step 1: Acquire global lock (see Section 7)
        → If locked, show "blocked" message. Stop.

Step 2: Fetch current dashboard data for this section
        → Call the same API endpoints the dashboard uses
        → This becomes the "user prompt" data

Step 3: Run parallel component analyses (all at once)
        → For each component in the section:
           • Build system prompt (hardcoded from PRD)
           • Build user prompt (dynamic data from Step 2)
           • Call Claude Haiku with tool access
           • Stream progress logs to the panel
        → Run with concurrency pool (max 3-4 parallel calls)
        → Remaining calls queued until a slot opens

Step 4: Collect all component results

Step 5: Run summary analysis
        → System prompt: summarize instructions + thresholds
        → User prompt: all component results concatenated
        → Output: max 3 good + max 3 bad, each one-line + detail

Step 6: Store everything in DB (see Section 8)

Step 7: Release global lock

Step 8: Update UI with results
```

### 5.3 Cancellation

- User clicks "Cancel" during analysis
- All in-flight API calls are aborted via `AbortController` signals
- Each parallel call must share a single `AbortController` — when cancel is triggered, `controller.abort()` cancels all in-flight Claude SDK calls simultaneously
- Results are collected into a temporary buffer, **not** written to DB until all complete successfully
- On cancel or error: buffer is discarded — **nothing is saved to DB** (all-or-nothing transaction)
- Panel returns to previous state (last results, or "never generated")
- Global lock is released

### 5.4 Timeout

- If analysis exceeds 5 minutes, auto-cancel with message: "Analysis timed out. Please try again."
- Same behavior as manual cancellation — full discard, lock release

---

## 6. Prompt Templates

### 6.1 Global System Prompt (Prepended to All Calls)

```
You are a senior financial analyst reviewing a dashboard for a Malaysian
fruit distribution company (Hoi-Yong). You are explaining what you see
to a senior director.

Rules:
- Be direct and concise. No jargon.
- State facts, not recommendations.
- Use Malaysian Ringgit (RM) for all monetary values.
- Format numbers with thousands separators (e.g., RM 5,841,378).
- Use Markdown for formatting (tables, bold, bullets).
- When referencing trends, compare at least 3 data points.
- If the data is insufficient to draw a conclusion, say so.
- Do not fabricate numbers — only reference data you have been given or
  have retrieved via tools.
```

### 6.2 Payment Section 1: Component System Prompts

#### Avg Collection Days (KPI)

```
You are analyzing the "Avg Collection Days" KPI.

What it measures: The average number of days it takes to collect payment
after invoicing. Also known as Days Sales Outstanding (DSO).

Formula: For each month: (AR Outstanding at month-end ÷ Monthly Credit
Sales) × Days in that month. The KPI shows the average across all valid
months in the selected period. Months with zero credit sales are excluded.

Performance thresholds:
- ≤30 days = Good (green) — efficient collection
- ≤60 days = Warning (yellow) — acceptable but monitor
- >60 days = Critical (red) — cash flow risk

Provide a concise analysis of this metric. If you need more data to
understand why collection days are high or low, use the available tools
to query the data.
```

#### Collection Rate (KPI)

```
You are analyzing the "Collection Rate" KPI.

What it measures: The percentage of invoiced amount that was actually
collected as cash payment in the selected period.

Formula: (Total Collected ÷ Total Invoiced) × 100
- Collected = sum of all payment amounts (non-cancelled)
- Invoiced = sum of all invoice totals (non-cancelled)
- Excludes non-cash offsets (contra entries)

Performance thresholds:
- ≥80% = Good (green) — healthy cash conversion
- ≥50% = Warning (yellow) — growing receivables
- <50% = Critical (red) — serious collection problem

Provide a concise analysis of this metric.
```

#### Avg Monthly Collection (KPI)

```
You are analyzing the "Avg Monthly Collection" KPI.

What it measures: The average cash collected per month across the
selected date range.

Formula: Total Collected ÷ Number of Months in Range

There is no fixed threshold for this metric. Evaluate it relative to
the invoiced amounts and historical trend. Rising collections with
stable invoicing is positive. Falling collections signals concern.

Provide a concise analysis of this metric.
```

#### Avg Collection Days Trend (Chart)

```
You are analyzing the "Avg Collection Days Trend" line chart.

What it shows: Monthly collection days (DSO) plotted over time with a
dashed reference line at the period average.

How to read it:
- Rising trend = collection is slowing down (bad)
- Falling trend = collection is improving (good)
- Spikes above 60 days = critical months
- Consistency around or below 30 days = excellent

Look for: seasonal patterns, sudden spikes, sustained direction changes
over 3+ months.

Provide a concise analysis of the trend pattern.
```

#### Invoiced vs Collected (Chart)

```
You are analyzing the "Invoiced vs Collected" combo chart.

What it shows:
- Blue bars = monthly total collected (cash received)
- Red line = monthly total invoiced (new credit sales)
- Dashed reference = average monthly collection

How to read it:
- When bars consistently fall below the red line, the business is
  accumulating unpaid receivables — a cash flow warning.
- When bars exceed the red line, old receivables are being cleared.
- The gap between bars and line indicates collection efficiency.

Look for: widening/narrowing gaps, months where collection dropped
sharply, seasonal collection patterns.

Provide a concise analysis of the invoiced vs collected relationship.
```

### 6.3 Payment Section 2: Component System Prompts

#### Total Outstanding (KPI)

```
You are analyzing the "Total Outstanding" KPI.

What it measures: The total amount currently owed by all customers —
sum of all unpaid invoices from the beginning of time to now.

This is a snapshot metric — it reflects the current state regardless
of date range selection.

There is no fixed threshold. Evaluate in context of total invoicing
volume and trend direction. A growing outstanding balance alongside
flat or declining sales is a red flag.

Provide a concise analysis of this metric.
```

#### Overdue Amount (KPI)

```
You are analyzing the "Overdue Amount" KPI.

What it measures: The portion of total outstanding that is past its
due date. Shown with the percentage of total and count of affected
customers.

An invoice is "overdue" when the current date exceeds its due date.

Evaluate:
- Overdue as % of total outstanding: <20% is acceptable, >40% is critical
- Number of overdue customers vs total active customers
- Whether the overdue amount is concentrated in a few large customers
  or spread across many

Provide a concise analysis of this metric.
```

#### Credit Limit Breaches (KPI)

```
You are analyzing the "Credit Limit Breaches" KPI.

What it measures: Count of active customers whose total outstanding
exceeds their assigned credit limit. Only customers with a credit
limit > 0 are evaluated.

Performance thresholds:
- 0 breaches = Good (green)
- >0 breaches = Concern (red)

If breaches exist, use tools to investigate which customers are in
breach and by how much. A few large breaches is more concerning than
many small ones.

Provide a concise analysis of this metric.
```

#### Aging Analysis (Chart)

```
You are analyzing the "Aging Analysis" horizontal bar chart.

What it shows: Outstanding invoices grouped by how overdue they are.

Aging buckets (from healthiest to most critical):
- Not Yet Due (green) — invoices still within payment terms
- 1–30 Days overdue (yellow)
- 31–60 Days overdue (orange)
- 61–90 Days overdue (light red)
- 91–120 Days overdue (red)
- 120+ Days overdue (dark red) — highest risk of write-off

The chart also supports views by Sales Agent and by Customer Type.

Evaluate:
- What proportion of outstanding is "Not Yet Due" vs overdue?
- Is the distribution skewed toward older buckets (bad) or newer (okay)?
- Are there large amounts in the 120+ bucket (potential bad debt)?

Provide a concise analysis of the aging distribution.
```

#### Credit Usage Distribution (Chart)

```
You are analyzing the "Credit Usage Distribution" donut chart.

What it shows: How customers are distributed across credit usage
categories.

Categories:
- Within Limit (< 80% usage) — green, healthy
- Near Limit (≥ 80% and < 100%) — yellow, watch closely
- Over Limit (> 100%) — red, policy breach
- No Limit Set — gray, uncontrolled credit risk

Credit Usage % = Total Outstanding ÷ Credit Limit × 100

Evaluate:
- What % of customers with limits are over or near limit?
- How many customers have no limit set (uncontrolled risk)?
- Is the "Over Limit" segment growing?

Provide a concise analysis of the credit utilization distribution.
```

#### Customer Credit Health Table (Table)

```
You are analyzing the "Customer Credit Health" table.

What it shows: A comprehensive per-customer view with 11 columns:
Code, Name, Type, Agent, Credit Limit, Outstanding, Credit Used %,
Aging Count, Oldest Due, Health Score (0-100), Risk Level.

Credit Health Score is calculated from 4 weighted factors:
- Credit Usage (40%): How much of limit is used
- Overdue Days (30%): Age of oldest overdue invoice
- Payment Timeliness (20%): Average days late on payments
- Double Breach (10%): Both credit and overdue limits exceeded

Risk Tiers: Low (≥75, green), Moderate (31-74, yellow), High (≤30, red)

Evaluate:
- Distribution across risk tiers (how many high vs low risk?)
- Top offenders by outstanding amount and risk score
- Any patterns by customer type or sales agent?
- Customers with high outstanding but no credit limit set

Provide a concise analysis of the customer credit health landscape.
Do not list every customer — focus on patterns and outliers.
```

### 6.4 Sales Section 3 (Sales Trend): Component System Prompts

#### Net Sales (KPI)

```
You are analyzing the "Net Sales" KPI.

What it measures: Total net sales for the selected period.
Formula: Invoice Sales + Cash Sales − Credit Notes

Performance thresholds:
- Month-over-month growth ≥ 5% = Good
- Month-over-month growth 0% to 5% = Neutral
- Month-over-month decline < 0% = Bad

Provide a concise analysis of this metric. If trend data is available,
comment on the growth direction.
```

#### Invoice Sales (KPI)

```
You are analyzing the "Invoice Sales" KPI.

What it measures: Total sales billed on credit terms to customers.

Evaluate:
- Invoice sales as % of net sales: ≥90% is normal for a distribution
  business with established credit customers
- If invoice sales ratio is dropping, it may signal a shift toward
  cash/retail or loss of credit customers

Provide a concise analysis of this metric.
```

#### Cash Sales (KPI)

```
You are analyzing the "Cash Sales" KPI.

What it measures: Total sales from immediate-payment transactions
(includes POS and cash-on-delivery).

Cash sales are contextual — not inherently good or bad:
- Higher cash sales = lower credit risk, faster cash flow
- But may signal smaller/retail customers vs wholesale relationships

Evaluate the cash-to-total ratio and whether it's changing over time.

Provide a concise analysis of this metric.
```

#### Credit Notes (KPI)

```
You are analyzing the "Credit Notes" KPI.

What it measures: Total value of credit notes issued — represents
goods returns and pricing adjustments. Displayed as a negative (red).

Performance thresholds:
- Credit notes ≤ 1% of gross sales = Good (normal returns)
- Credit notes 1-3% of gross sales = Neutral (monitor)
- Credit notes > 3% of gross sales = Bad (quality/accuracy issues)

Gross sales = Invoice Sales + Cash Sales (before credit notes).

Provide a concise analysis. If credit notes are high, suggest
potential causes (product quality, order accuracy, customer disputes).
```

#### Net Sales Trend (Chart)

```
You are analyzing the "Net Sales Trend" stacked bar chart.

What it shows:
- Dark blue bars = Invoice Sales per period
- Green bars (stacked on top) = Cash Sales per period
- Red bars (below zero line) = Credit Notes per period
- Combined height above zero = Net Sales

Granularity can be Daily, Weekly, or Monthly.

Performance thresholds for trend:
- 3+ consecutive months of growth = Good
- Flat or mixed = Neutral
- 3+ consecutive months of decline = Bad

Look for: seasonal spikes (e.g., festive periods), unusual credit note
months, the ratio of cash vs invoice changing over time.

Provide a concise analysis of the sales trend pattern.
```

### 6.5 Sales Section 4 (Sales Breakdown): Component System Prompts

#### By Customer (Breakdown Dimension)

```
You are analyzing the "Sales by Customer" breakdown.

What it shows: Net sales broken down by customer with columns for
Code, Customer Name, Customer Type, Net Sales, Invoice Sales, Cash
Sales, and Credit Note Amount.

Performance thresholds:
- Top customer < 15% of total net sales = Good (diversified)
- Top customer 15-25% of total = Neutral (moderate concentration)
- Top customer > 25% of total = Bad (over-reliance risk)

Evaluate:
- Revenue concentration: are a few customers dominating?
- Customer type distribution: healthy mix or over-reliant on one type?
- Any customers with disproportionately high credit notes?

Provide a concise analysis. Focus on concentration risk and patterns.
```

#### By Product (Breakdown Dimension)

```
You are analyzing the "Sales by Product" breakdown.

What it shows: Net sales broken down by fruit product with columns for
Product Name, Country, Variant, Net Sales, and Qty Sold.

Performance thresholds:
- Top product < 20% of total net sales = Good (diversified)
- Top product 20-35% of total = Neutral
- Top product > 35% of total = Bad (product concentration risk)

Evaluate:
- Product concentration: is revenue spread across products or dominated
  by 1-2 items?
- Country of origin diversity: over-reliance on one source country?
- High quantity but low revenue products (margin concern)

Provide a concise analysis.
```

#### By Sales Agent (Breakdown Dimension)

```
You are analyzing the "Sales by Sales Agent" breakdown.

What it shows: Net sales per sales agent with columns for Agent Name,
Active status, Net Sales, Invoice Sales, Cash Sales, and Customer Count.

Evaluate:
- Performance spread: is one agent carrying the team or is it balanced?
- Inactive agents with significant recent sales (data quality issue?)
- Customer count vs sales volume: agents with many customers but low
  sales may be underperforming
- Any agent declining > 10% vs prior period = flag as concern

Provide a concise analysis. Focus on performance distribution.
```

#### By Outlet (Breakdown Dimension)

```
You are analyzing the "Sales by Outlet" breakdown.

What it shows: Net sales per outlet/location with columns for Location,
Net Sales, Invoice Sales, Cash Sales, and Credit Note Amount.

Performance thresholds:
- No single outlet > 50% of total = Good (geographic diversification)
- One outlet > 50% = Concern (geographic concentration risk)

Evaluate:
- Geographic spread: balanced or concentrated?
- Any outlets with unusually high credit notes vs sales ratio?
- "(Unassigned)" outlet percentage: data quality indicator

Provide a concise analysis.
```

### 6.6 Summary Prompt (Used in Step 5 — Same for All Sections)

```
You are a senior financial analyst producing a high-level summary for
a section of the Hoi-Yong Finance dashboard. You are speaking to a
senior director.

Below are the individual analyses for each component in this section.
Review them all and produce a summary.

Rules:
- Output exactly this JSON structure (no other text):

{
  "good": [
    {
      "title": "One-line insight (max 80 chars)",
      "detail": "Markdown explanation with evidence (tables, bullets, numbers)"
    }
  ],
  "bad": [
    {
      "title": "One-line insight (max 80 chars)",
      "detail": "Markdown explanation with evidence (tables, bullets, numbers)"
    }
  ]
}

- Maximum 3 good insights and 3 bad insights.
- Rank by business impact — most important first.
- Each title must be self-explanatory in one line.
- Each detail must include specific numbers as evidence.
- If everything is good, you may have 0 bad insights (and vice versa).
- Do not repeat what individual analyses said — synthesize across them.
- Use Markdown tables in the detail field where data comparison helps.
```

**Summary User Prompt Template (Dynamic — Fed from Step 3 Results):**

```
Section: {section_name}
Page: {page_name}
Date Range: {start_date} to {end_date} ({N} months)
Generated: {current_datetime}

---

Below are the completed analyses for each component in this section.
Synthesize them into a high-level summary.

### Component 1: {component_name_1} ({component_type})
{ai_analysis_output_1}

### Component 2: {component_name_2} ({component_type})
{ai_analysis_output_2}

### Component 3: {component_name_3} ({component_type})
{ai_analysis_output_3}

... (all components in the section)

---

Produce the JSON summary now.
```

**Example (Payment Collection Trend — 5 component results concatenated):**

```
Section: Payment Collection Trend
Page: Payment
Date Range: 2024-11-01 to 2025-10-31 (12 months)
Generated: 2026-04-08 14:32

---

Below are the completed analyses for each component in this section.
Synthesize them into a high-level summary.

### Component 1: Avg Collection Days (kpi)
Current value is 44 days, placing it in the yellow/warning zone.
While not critical, collection has slowed from 39 days in Sep to 44
days in Oct — a 12.8% increase in a single month...

### Component 2: Collection Rate (kpi)
Collection rate at 84.7% is in the green/healthy zone. The business
is converting invoices to cash at a strong rate...

### Component 3: Avg Monthly Collection (kpi)
Average monthly collection of RM 5,841,378 is stable. No significant
deviation from the 12-month trend...

### Component 4: Avg Collection Days Trend (chart)
The trend shows fluctuation between 35-48 days over 12 months with
no sustained improvement or deterioration...

### Component 5: Invoiced vs Collected (chart)
Collected (blue bars) have fallen below invoiced (red line) in 3 of
the last 4 months, indicating growing receivables accumulation...

---

Produce the JSON summary now.
```

### 6.7 User Prompt Template (Dynamic — Same Structure for All Components)

```
Section: {section_name}
Component: {component_name}
Component Type: {kpi|chart|table}
Date Range: {start_date} to {end_date} ({N} months)
Generated: {current_datetime}

Current Values:
{formatted_values}

---
Analyze this component. Be concise and direct.
```

The `{formatted_values}` block varies by component type:

**For KPIs:**
```
Value: 44 days
Color: Yellow (Warning)
Previous period value: 42 days
Change: +2 days (+4.8%)
```

**For Charts (time series):**
```
Data points:
| Month   | Value      |
|---------|------------|
| 2025-06 | 39 days    |
| 2025-07 | 41 days    |
| 2025-08 | 42 days    |
| 2025-09 | 39 days    |
| 2025-10 | 44 days    |
Average: 44 days
```

**For Tables:**
```
Summary:
- Total rows: 487 customers
- Risk distribution: Low 312 (64%), Moderate 142 (29%), High 33 (7%)
- Top 5 by outstanding:
  | Customer       | Outstanding   | Risk   | Score |
  |---------------|---------------|--------|-------|
  | ABC Trading   | RM 2,341,000  | High   | 18    |
  | XYZ Foods     | RM 1,892,000  | Moderate| 45   |
  ...
```

**For Breakdown Dimensions (Sales):**
```
Dimension: Customer
Total rows: 312 customers
Total net sales: RM 88,292,349

Top 10 by net sales:
| Rank | Name          | Type        | Net Sales      | % of Total |
|------|---------------|-------------|----------------|------------|
| 1    | ABC Trading   | Wholesaler  | RM 12,341,000  | 14.0%      |
| 2    | XYZ Foods     | Chain Store | RM 8,920,000   | 10.1%      |
...

By customer type:
| Type        | Count | Net Sales      | % of Total |
|-------------|-------|----------------|------------|
| Wholesaler  | 45    | RM 42,000,000  | 47.6%      |
| Chain Store | 23    | RM 28,000,000  | 31.7%      |
...
```

---

## 7. Concurrency Control

### Global Lock

- **Scope:** One user can run analysis globally at a time (across all sections, all pages)
- **Implementation:** Database row lock with user identity and timestamp
- **On acquire:** Set `locked_by = user_id, locked_at = NOW()`
- **On release:** Clear `locked_by, locked_at`
- **Stale lock timeout:** Auto-release if `locked_at` is older than 6 minutes (1 min beyond max runtime)
- **User experience:** Other users see "Analysis is currently running by [User Name]. Please wait." with the Analyze button disabled

### Lock Table Schema

```sql
CREATE TABLE ai_insight_lock (
  id            INTEGER PRIMARY KEY DEFAULT 1,  -- singleton row
  locked_by     TEXT,                            -- user ID or name
  locked_at     TIMESTAMP WITH TIME ZONE,
  section_key   TEXT,                            -- which section is running
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the singleton row
INSERT INTO ai_insight_lock (id) VALUES (1);
```

---

## 8. Storage Schema

### 8.1 Section-Level Insight (High-Level Summary)

```sql
CREATE TABLE ai_insight_section (
  id              SERIAL PRIMARY KEY,
  page            TEXT NOT NULL,           -- 'payment' | 'sales'
  section_key     TEXT NOT NULL,           -- 'payment_collection_trend' | 'payment_outstanding' | 'sales_trend' | 'sales_breakdown'
  summary_json    JSONB NOT NULL,          -- { good: [...], bad: [...] }
  analysis_time_s NUMERIC(6,1),            -- runtime in seconds
  token_count     INTEGER,                 -- total tokens used
  cost_usd        NUMERIC(8,4),            -- total cost in USD
  date_range_start DATE,                   -- date range at time of generation (nullable for snapshots)
  date_range_end   DATE,
  generated_by    TEXT NOT NULL,           -- user name
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (page, section_key)              -- only latest result kept
);
```

### 8.2 Component-Level Insight (Individual Analyses)

```sql
CREATE TABLE ai_insight_component (
  id              SERIAL PRIMARY KEY,
  section_id      INTEGER NOT NULL REFERENCES ai_insight_section(id) ON DELETE CASCADE,
  component_key   TEXT NOT NULL,           -- 'avg_collection_days' | 'collection_rate' | etc.
  component_type  TEXT NOT NULL,           -- 'kpi' | 'chart' | 'table' | 'breakdown'
  analysis_md     TEXT NOT NULL,           -- Markdown analysis output
  token_count     INTEGER,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (section_id, component_key)
);
```

### 8.3 Storage Behavior

- On each "Analyze" run, the previous record for that section is **replaced** (UPSERT on `page + section_key`)
- Component insights cascade-delete with the section record
- Cancellation or timeout: **nothing is written** (full discard)
- No history is kept — only the latest result per section
- **Date range is stored but not part of the unique key** — a new run always overwrites regardless of date range. The analyzed date range is surfaced in the UI metadata panel (see Section 4.2, State 3) so users can see what period the insight covers. This keeps storage simple (one result per section) while making scope visible.

### 8.4 Component Key Registry

| Section Key | Component Key | Type |
|-------------|--------------|------|
| `payment_collection_trend` | `avg_collection_days` | kpi |
| `payment_collection_trend` | `collection_rate` | kpi |
| `payment_collection_trend` | `avg_monthly_collection` | kpi |
| `payment_collection_trend` | `collection_days_trend` | chart |
| `payment_collection_trend` | `invoiced_vs_collected` | chart |
| `payment_outstanding` | `total_outstanding` | kpi |
| `payment_outstanding` | `overdue_amount` | kpi |
| `payment_outstanding` | `credit_limit_breaches` | kpi |
| `payment_outstanding` | `aging_analysis` | chart |
| `payment_outstanding` | `credit_usage_distribution` | chart |
| `payment_outstanding` | `customer_credit_health` | table |
| `sales_trend` | `net_sales` | kpi |
| `sales_trend` | `invoice_sales` | kpi |
| `sales_trend` | `cash_sales` | kpi |
| `sales_trend` | `credit_notes` | kpi |
| `sales_trend` | `net_sales_trend` | chart |
| `sales_breakdown` | `by_customer` | breakdown |
| `sales_breakdown` | `by_product` | breakdown |
| `sales_breakdown` | `by_agent` | breakdown |
| `sales_breakdown` | `by_outlet` | breakdown |

---

## 9. AI Tool Access (Data Exploration)

The AI agent has read-only tools to explore data when the user prompt values are insufficient.

### 9.1 Exploration Rules

1. **Always query `pc_*` tables first** — they are pre-aggregated and fast
2. **Only hit RDS if `pc_*` data is insufficient** for a meaningful insight
3. **Column whitelist enforced** — AI cannot SELECT columns not on the approved list
4. **100 row limit per query** — prevents runaway scans
5. **Read-only** — SELECT only, no INSERT/UPDATE/DELETE
6. **No JOINs across RDS tables** — prevents accidental PII assembly
7. **RDS queries must include** `Cancelled = 'F'` and date bounds
8. **Max 3 tool calls per component analysis** — prevents cost explosion

### 9.2 Tier 1: Local `pc_*` Tables

#### Sales Domain

| Table | Allowed Columns |
|-------|----------------|
| `pc_sales_daily` | `doc_date, invoice_total, cash_total, cn_total, net_revenue, doc_count` |
| `pc_sales_by_customer` | `doc_date, debtor_code, company_name, debtor_type, sales_agent, invoice_sales, cash_sales, credit_notes, total_sales, doc_count` |
| `pc_sales_by_outlet` | `doc_date, dimension, dimension_key, dimension_label, is_active, invoice_sales, cash_sales, credit_notes, total_sales, doc_count, customer_count` |
| `pc_sales_by_fruit` | `doc_date, fruit_name, fruit_country, fruit_variant, invoice_sales, cash_sales, credit_notes, total_sales, total_qty, doc_count` |

#### Payment Domain

| Table | Allowed Columns |
|-------|----------------|
| `pc_ar_monthly` | `month, invoiced, collected, cn_applied, refunded, total_outstanding, total_billed, customer_count` |
| `pc_ar_customer_snapshot` | `snapshot_date, debtor_code, company_name, debtor_type, sales_agent, display_term, credit_limit, total_outstanding, overdue_amount, utilization_pct, credit_score, risk_tier, is_active, invoice_count, avg_payment_days, max_overdue_days` |
| `pc_ar_aging_history` | `snapshot_date, bucket, dimension, dimension_key, invoice_count, total_outstanding` |

**Important — Snapshot Tables:**
- `pc_ar_customer_snapshot` stores daily snapshots (one row per customer per `snapshot_date`). All queries **must filter to the latest `snapshot_date`** (`WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_customer_snapshot)`) to avoid duplicate/inflated totals.
- `pc_ar_aging_history` also stores daily snapshots. Same rule: filter to the latest `snapshot_date`.
- Both tables should also exclude `company_name ILIKE 'CASH SALES%'` rows (internal walkup accounts, not real customers).

#### Blocked Columns (PII — Never Accessible)

| Table | Blocked Columns |
|-------|----------------|
| `pc_ar_customer_snapshot` | `attention, phone1, mobile, email_address` |
| `customer` (local lookup) | `Attention, Phone1, Mobile, EmailAddress` |
| `supplier` (local lookup) | `Attention, Phone1, Mobile, EmailAddress` |

### 9.3 Tier 2: Remote RDS Tables (Only When `pc_*` Insufficient)

#### Sales Domain (3 tables)

| RDS Table | Allowed Columns | Row Limit | Use Case |
|-----------|----------------|-----------|----------|
| `dbo.IV` | `DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, SalesLocation, Cancelled` | 100 | Invoice pattern drill-down |
| `dbo.CS` | `DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, SalesLocation, Cancelled` | 100 | Cash sales pattern analysis |
| `dbo.CN` | `DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, CNType, Cancelled` | 100 | Credit note spike investigation |

#### Payment Domain (3 tables)

| RDS Table | Allowed Columns | Row Limit | Use Case |
|-----------|----------------|-----------|----------|
| `dbo.ARInvoice` | `DocNo, DocDate, DueDate, DebtorCode, LocalNetTotal, Outstanding, DisplayTerm, Cancelled` | 100 | Overdue invoice investigation |
| `dbo.ARPayment` | `DocNo, DocDate, DebtorCode, LocalPaymentAmt, Description, Cancelled` | 100 | Payment timing analysis |
| `dbo.ARPaymentKnockOff` | `DocKey, KnockOffDocKey, KnockOffAmt, KnockOffDate` | 100 | Invoice settlement patterns |

#### Fully Blocked from AI Access

- All `*DTL` tables (line-item detail — too granular)
- `dbo.Debtor` / `dbo.Creditor` directly (use local lookup minus PII)
- All purchase/supplier tables (not relevant)
- All GL/P&L tables (not relevant)
- Any table not listed above

---

## 10. API Design

### 10.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ai-insight/analyze` | Start analysis for a section |
| `GET` | `/api/ai-insight/status` | Check lock status (polling) |
| `POST` | `/api/ai-insight/cancel` | Cancel in-progress analysis |
| `GET` | `/api/ai-insight/section/{section_key}` | Get stored section insight |
| `GET` | `/api/ai-insight/component/{section_key}/{component_key}` | Get stored component insight |

### 10.2 POST /api/ai-insight/analyze

**Request:**
```json
{
  "page": "payment",
  "section_key": "payment_collection_trend",
  "date_range": {
    "start": "2024-11-01",
    "end": "2025-10-31"
  },
  "user_name": "Jason"
}
```

**Response:** Server-Sent Events (SSE) stream for real-time progress:
```
event: progress
data: {"component": "avg_collection_days", "status": "analyzing"}

event: progress
data: {"component": "avg_collection_days", "status": "complete"}

event: progress
data: {"component": "summary", "status": "analyzing"}

event: complete
data: {"section_id": 42, "analysis_time_s": 12.3, "token_count": 3421, "cost_usd": 0.03}
```

### 10.3 GET /api/ai-insight/status

**Response:**
```json
{
  "locked": true,
  "locked_by": "Jason",
  "locked_at": "2026-04-08T14:32:00Z",
  "section_key": "payment_collection_trend"
}
```

---

## 11. User Roles & Permissions

| Role | Can View Insights | Can Run Analyze | Can Cancel |
|------|------------------|-----------------|------------|
| Finance | Yes | Yes | Yes (own runs only) |
| Director | Yes | Yes | Yes (own runs only) |

Both roles have identical permissions for the AI Insight Engine.

---

## 12. Error Handling

| Scenario | Behavior |
|----------|----------|
| API key invalid/missing | Show error in panel: "AI service unavailable. Contact admin." |
| Rate limit exceeded | Show error: "AI service busy. Please try again in a few minutes." |
| Network timeout (single component) | Retry once. If still fails, skip component and note in summary. |
| All components fail | Show error: "Analysis failed. Please try again." Discard, release lock. |
| Cost limit approached | Monitor token count. If projected cost > $0.50, abort remaining calls. |
| Runtime limit exceeded | Auto-cancel at 5 minutes (see Section 5.4) |

---

## 13. Implementation Notes

### Tech Stack Alignment

- **Frontend:** Next.js App Router + React — SSE via `EventSource` API
- **Backend:** Next.js API Routes — SSE response with `ReadableStream`
- **AI SDK:** `@anthropic-ai/sdk` with custom tool definitions (agentic tool-use loop)
- **Database:** PostgreSQL (existing) — 3 new tables (lock, section, component)
- **Styling:** Tailwind CSS (existing) — for panel, dialogs, and icons

### What Needs to Be Built

| Item | Type | Estimated Complexity |
|------|------|---------------------|
| AI Insight Panel component | Frontend | Medium |
| Insight Detail Dialog | Frontend | Low |
| Component Insight Dialog | Frontend | Low |
| Section header + collapsible panel | Frontend | Low |
| Analyze icon on all components | Frontend | Low (20 instances) |
| SSE streaming endpoint | Backend | Medium |
| Analysis orchestrator (parallel calls + summary) | Backend | High |
| Tool definitions for data exploration | Backend | Medium |
| DB schema (3 tables) | Database | Low |
| Concurrency lock manager | Backend | Low |
| Cancel/timeout handler | Backend | Medium |
| Prompt builder (system + user for 20 components) | Backend | Medium |

### Sales Page Section Headers

The Sales page currently has no section dividers. Two section headers must be added:

1. **"Sales Trend"** — wrapping the KPI cards and Net Sales Trend chart
2. **"Sales Breakdown"** — wrapping the GroupBy section (chart + table)

Both headers follow the same collapsible pattern as the Payment page sections, with the "Get Insight" dropdown toggle added.

---

## Appendix A: Section Key Reference

| Section Key | Page | Section Name | Date Filtered |
|-------------|------|-------------|---------------|
| `payment_collection_trend` | Payment | Payment Collection Trend | Yes |
| `payment_outstanding` | Payment | Outstanding Payment | No (snapshot) |
| `sales_trend` | Sales | Sales Trend | Yes |
| `sales_breakdown` | Sales | Sales Breakdown | Yes |

## Appendix B: Estimated Cost Model

| Section | Components | Est. Input Tokens | Est. Output Tokens | Est. Cost (Haiku) |
|---------|-----------|-------------------|--------------------|--------------------|
| Payment Collection Trend | 5 + summary | ~8,000 | ~3,000 | ~$0.01 |
| Payment Outstanding | 6 + summary | ~12,000 | ~4,000 | ~$0.02 |
| Sales Trend | 5 + summary | ~8,000 | ~3,000 | ~$0.01 |
| Sales Breakdown | 4 + summary | ~15,000 | ~5,000 | ~$0.02 |
| **Total (all 4 sections)** | **24 calls** | **~43,000** | **~15,000** | **~$0.06** |

With tool use (deeper exploration), costs may increase 2-3x but remain well under the $0.50/section cap.

**Note:** Costs are estimates based on Claude Haiku pricing. Actual costs depend on tool call depth and data volume. The `cost_usd` field in the metadata tracks actual spend per run.
