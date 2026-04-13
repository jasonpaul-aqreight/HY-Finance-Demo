# AI Insight Engine — Requirements Specification

> Scope: Sales Report & Payment Collection pages only.
> Status: Implemented — Payment sections verified & active-filter audit complete (2026-04-09). Sales sections pending.

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

### Totals (v1 — shipped)

| | Sections | Components | AI Calls per Full Run |
|-|----------|------------|----------------------|
| Payment | 2 | 11 | 13 |
| Sales | 2 | 9 | 11 |
| **Grand Total** | **4** | **20** | **24** |

### 2.3 v2 Roll-Out — All Dashboard Pages (added 2026-04-13)

Following the Phase 1+2 stability fixes (§12.9–12.11), the AI Insight Engine is approved for roll-out across **every analytical page** in the dashboard. The same architecture (pre-fetched data block → component narration → summary with section-aware tools + numeric guard) applies uniformly.

**Pages in scope:**

| Page | Route | Status | Candidate Sections (TBD per page-spec workshop) |
|------|-------|--------|--------------------------------------------------|
| Payment | `/payment` | **Shipped (v1)** | Payment Collection Trend, Outstanding Payment |
| Sales | `/sales` | **Shipped (v1)** | Sales Trend, Sales Breakdown |
| Customer Margin | `/customer-margin` | v2 — not yet specified | e.g. `customer_margin_overview`, `customer_margin_breakdown` |
| Supplier Performance | `/supplier-performance` | v2 — not yet specified | e.g. `supplier_margin_trend`, `supplier_concentration` |
| Returns | `/return` | v2 — not yet specified | e.g. `return_trend`, `return_breakdown` |
| Expenses | `/expenses` | v2 — not yet specified | e.g. `expense_trend`, `expense_breakdown` |
| Financial (P&L) | `/financial` | v2 — not yet specified | e.g. `pnl_overview`, `pnl_drivers` |

**Pages explicitly out of scope:** `/admin`, `/manual`, `/preview`, `/experiment-growth` (configuration / docs / experimental — not analytical).

**v2 acceptance bar:** every new section must satisfy the same checkpoint as v1:
- 0 CRITICAL fabrications across any cards
- Numeric guard reports `passed: true` on first or second generation
- Cost ≤ $0.15/section, latency ≤ 120s
- `npm run build` and `npm run lint` clean for the touched files

The exact section key, component list, and prompt template for each v2 page are produced via the **§14 Extending to a New Page** playbook below — one short workshop per page is the canonical entry point.

---

## 3. AI Engine Configuration

| Setting | Value |
|---------|-------|
| SDK | `@anthropic-ai/sdk` (standard Anthropic SDK with tool use) |
| Component model | Configurable via `AI_INSIGHT_MODEL` env var (default: `claude-haiku-4-5-20251001`) — used for narration-only component calls |
| Summary model | Configurable via `AI_INSIGHT_SUMMARY_MODEL` env var (default: `claude-sonnet-4-6`) — used for summary synthesis + tool calls |
| Prompt logging (terminal) | Configurable via `AI_INSIGHT_LOG_PROMPTS` env var (`true`/`false`, default: `false`) — prints all prompts to terminal |
| Debug file logging | Configurable via `AI_INSIGHT_DEBUG_FILE` env var (`true`/`false`, default: `false`) — saves full back-and-forth messages (prompts, responses, tool calls, tool results) to timestamped log files in `apps/dashboard/logs/`. Each analysis run creates one file. Independent of terminal logging. |
| Max runtime per section | 5 minutes |
| Max cost per section | $0.50 USD |
| Estimated cost per section | ~$0.06–0.10 (Haiku components + Sonnet summary; observed: $0.08 for 5-component section) |
| Output format | Delimiter-based `===INSIGHT===` blocks (component: Markdown; summary: structured with bold headers + tables) |
| Tool use | Yes — custom tool definitions for read-only data exploration |
| Agentic pattern | Components: single LLM call (narration only — powers per-KPI "View AI insight" dialogs). Summary: multi-step reasoning loop with tools for root-cause drill-down. Summary reads the raw fetcher data blocks directly, NOT the component narrations. |
| Max tool calls per component | 0 (components narrate pre-fetched data, no tools) |
| Max tool calls per summary | 2 (scoped drill-down for root causes) |
| Summary max tokens | 4096 (separate from component's 2048, needed for tool reasoning + formatted output) |
| Max concurrency | 2 parallel component analyses |

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
│  Analysis Time: -    Token Used: -    Est. Cost: -  │
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
│  Analysis Time: -    Token Used: -    Est. Cost: -  │
│  Last Updated: -                      By whom: -        │
│                                               [Cancel]  │
└─────────────────────────────────────────────────────────┘
```

- Log lines appear in real-time as each component analysis starts/completes
- The "Analyze" button becomes a red "Cancel" button during analysis

**State 3: Results available**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Section Title                                        Get Insight ▲│
├──────────────────────────────┬──────────────────────────────────────┤
│  POSITIVE                    │  NEGATIVE                           │
│                              │                                     │
│  ● Title Insight [Metric]    │  ● Title Insight [Metric]           │
│    Description preview...    │    Description preview...           │
│                              │                                     │
│  ● Title Insight [Metric]    │  ● Title Insight [Metric]           │
│    Description preview...    │    Description preview...           │
│                              │                                     │
├──────────────────────────────┴──────────────────────────────────────┤
│  Analyzed: Nov 2024 – Oct 2025 (12 months)                         │
│  Analysis Time: 68s   Tokens: 23,494   Est. Cost: $0.03           │
│  Last Updated: 2026-04-08 14:32      By: Jason          [Analyze] │
└─────────────────────────────────────────────────────────────────────┘
```

- **Two-column layout:** POSITIVE (left) and NEGATIVE (right), separated visually
- Each insight is a card with: green/red dot + **bold title** + **metric badge** (e.g., "84.3%", "43 days") + one-line description preview
- Clicking a card opens the **Insight Detail Dialog** (Section 4.4)
- Maximum: **3 positive + 3 negative** insights displayed
- Empty column shows "No positive highlights found." or "No concerns found."
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

Every KPI card, chart, and table has a single analyze icon (🔍) in its header area. There is no separate help/question-mark icon — the About explanation and AI analysis are combined in one dialog.

```
  Avg Collection Days 🔍
  44 days
```

- Clicking the icon opens the **Component Insight Dialog** (Section 4.5)
- The icon is always visible but the dialog content depends on whether analysis has been run
- Does **NOT** trigger a new API call — it shows stored results from the last section-level analysis
- The dialog replaces the need for a separate tooltip — it serves as both quick-reference manual and AI analysis viewer

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

- **Dialog size: 60vw max, auto-height up to 90vh** — narrower and content-fitted for readability
- **Header bar:** color-coded full-width banner — green (`bg-green-600`) for good, red (`bg-red-600`) for bad — with white text and sentiment emoji
- **Sticky header & footer:** header and footer remain fixed while content scrolls
- Body is rendered Markdown via `MarkdownRenderer` with typography optimised for senior directors:
  - **Underlined bold subtitles** (e.g., `**Overall Performance:**`) with large top spacing (`pt-6`) to create clear visual blocks
  - **Tight line spacing within blocks** (`my-0` on paragraphs, `leading-[1.7]`) — lines within a section are close together
  - **Markdown tables** with supporting data (at least 3 rows)
  - Specific numbers, RM amounts, percentages, and period comparisons
  - 300-500 words per insight — thorough but structured
- Close button (✕) in top-right corner

### 4.5 Component Insight Dialog (Popup — From Analyze Icon Click)

Opened when clicking the 🔍 icon on any KPI, chart, or table. This dialog combines the manual-style explanation (replacing the old `?` tooltip) with the AI analysis in one place.

```
┌─────────────────────────────────────────────────────┐
│  About: Avg Collection Days                      ✕  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Average Collection Days measures how many days,    │
│  on average, it takes to collect payment after      │
│  making a sale. It's a cash flow efficiency metric. │
│                                                     │
│  Collection Days = (Accounts Receivable / Total     │
│  Invoice Sales) × Number of Days                    │
│                                                     │
│  ≤30 days = Good · ≤60 days = Warning               │
│  >60 days = Critical                                │
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

- **Dialog size: 60vw max, auto-height up to 90vh** — narrower and content-fitted for readability. Short components (e.g., Cash Sales) get a compact dialog; long analyses scroll naturally.
- **Sticky header & footer:** Blue branded header (`bg-[#1F4E79]`) with component name stays fixed at top. Metadata footer with border-top stays fixed at bottom. Only the middle content scrolls.
- **About section (top):** Displayed in a bordered card (`bg-muted/30`) with a BookOpen icon and "About" label. Contains concise, manual-style plain-language explanation stored in `component-info.ts` as an `about` field. Written for end users (senior directors) — includes what the metric means, formula (where applicable), and thresholds. This replaces both the old `?` tooltip and the structured `whatItMeasures`/`formula`/`indicator` breakdown. The content mirrors what would otherwise be in the user manual, so the manual pages for these metrics can link here instead of duplicating the explanation.
- **AI Analysis section (bottom):** Labelled with a BrainCircuit icon and "AI Analysis" heading. AI-generated analysis from the last section-level "Analyze" run, rendered via `MarkdownRenderer` with the same typography rules as the Insight Detail Dialog (underlined subtitles, tight blocks, spaced sections).
- If analysis has never been run: bottom section shows "No analysis available. Run 'Analyze' from the section panel."
- Metadata footer shows the same last-updated info as the AI Panel
- **Implementation note:** The `about` field is separate from `whatItMeasures`/`formula`/`indicator` which are still used in AI system prompts. The About section is for human readers; the structured fields are for the AI prompt context.

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

Step 3: Run parallel component analyses (concurrency pool)
        → For each component in the section:
           • Build system prompt (hardcoded from PRD)
           • Build user prompt (dynamic data from Step 2)
           • Call Claude Haiku with tool access
           • Stream progress logs to the panel
        → Run with concurrency pool (max 2 parallel calls, configurable)
        → Remaining calls queued until a slot opens
        → Why 2: higher concurrency triggers Anthropic API rate limits,
          causing retries that make total time worse. Tested with 3-4
          during experiment — 2 was the most reliable.

Step 4: Collect all component results

Step 5: Run summary analysis (with scoped tool access)
        → System prompt: ground-truth rule (verbatim-copy from raw data
          blocks) + summary instructions + root-cause drill-down
        → User prompt: the RAW FETCHER DATA BLOCKS for every component
          in the section — NOT the Haiku narrations. The component
          narrations are retained separately to power the per-KPI
          "View AI insight" dialogs, but are NOT fed to the summary
          stage (see §12.8).
        → Tools: same tools as component analysis (query_local_table,
          query_rds_table) — max 2 tool calls total
        → The summary AI copies numbers verbatim from the raw blocks,
          then drills down via tools for customer/product attribution
          not already present in the raw data
        → Output: max 3 good + max 3 bad, each with evidence-backed
          root-cause analysis where applicable

Step 6: Store everything in DB (see Section 8)

Step 7: Release global lock

Step 8: Update UI with results
```

### 5.3 Cancellation

- User clicks "Cancel" during analysis
- **Client-side:** UI immediately resets to idle state (no waiting for server confirmation), the SSE stream reader is cancelled via `reader.cancel()`, and any previous stored results are reloaded
- **Server-side:** The cancel request includes `section_key` in the POST body, the matching `AbortController` is looked up and `controller.abort()` cancels all in-flight Claude SDK calls simultaneously
- Each parallel call shares a single `AbortController` per section
- Results are collected into a temporary buffer, **not** written to DB until all complete successfully
- On cancel or error: buffer is discarded — **nothing is saved to DB** (all-or-nothing transaction)
- Panel returns to previous state (last results, or "never generated")
- Global lock is released

### 5.4 Timeout

- If analysis exceeds 5 minutes, auto-cancel with message: "Analysis timed out. Please try again."
- Same behavior as manual cancellation — full discard, lock release

### 5.5 Known Limitation: Navigation During Analysis

- **Problem:** If the user navigates away from the page while analysis is running, the SSE stream disconnects but the server continues processing. The global lock remains held until the analysis completes on the server.
- **Effect:** When the user returns, clicking "Analyze" shows "Analysis is currently running by [User]. Please wait." The lock auto-releases when the server-side analysis finishes (typically 1-3 minutes).
- **Mitigation:** Users are warned in the User Manual to stay on the page during analysis. The stale lock timeout (6 minutes) acts as a safety net.
- **Future improvement:** Reconnect to in-progress analysis on page return (check lock status, poll for completion). Deferred — acceptable for current experiment scope.

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
- Structure your analysis using bullet points for observations and
  findings. Use Markdown tables for data comparisons.
- When referencing trends, compare at least 3 data points.
- If the data is insufficient to draw a conclusion, say so.
- Do not fabricate numbers — only reference data you have been given or
  have retrieved via tools.

Data source authority:
- The "Current Values" provided in the user message are the AUTHORITATIVE
  figures for headline metrics (totals, rates, averages). These come from
  the same pre-calculated tables that power the dashboard the director
  is viewing.
- Use tools ONLY for drill-down investigation — e.g., identifying which
  customers, products, or months explain a trend. NEVER use tools to
  re-derive or re-aggregate totals, rates, or averages that were already
  provided to you.
- If a tool query returns a total that differs from the provided values,
  ALWAYS use the provided values. The difference is due to aggregation
  methodology, not an error.

Self-verification (apply before writing your final analysis):
- Cross-check every number you cite against the data you were given or
  retrieved. If you state "Total X = RM Y", verify Y appears in your data.
- Verify arithmetic: if you cite a gap (A minus B), confirm A - B equals
  the gap you stated.
- Do not confuse different metrics — e.g., "cumulative collection gap"
  (total invoiced minus total collected) is not the same as "current
  outstanding balance" (receivables at period end).
- If you cannot verify a number, do not include it.
```

> **Why source authority and self-verification?** A verification audit (2026-04-09) found that the AI was using tool calls to re-derive totals from RDS tables, producing figures that conflicted with the pre-fetched `pc_*` data (e.g., RM 82M vs RM 77M invoiced from different sources). The AI also confused "cumulative collection gap" with "current outstanding balance" (arithmetic error). These two prompt rules eliminated all discrepancies — the AI now produces numbers that exactly match the dashboard KPIs.

### 6.2 Payment Section 1: Component System Prompts

#### Avg Collection Days (KPI)

```
You are analyzing the "Avg Collection Days" KPI.

What it measures: The average number of days it takes to collect payment
after invoicing.

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

What it shows: Monthly collection days plotted over time with a
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

Root-cause investigation:
If overdue amount is >30% of total outstanding, use tools to identify
the top overdue customers — query pc_ar_customer_snapshot for the
largest overdue_amount values. Report customer names and amounts.

Provide a concise analysis of this metric with evidence.
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

Root-cause investigation (IMPORTANT):
If credit notes spike in any month (>2x the period average), use tools
to find out WHY:
1. Query dbo.CN for that month (filter by DocDate and Cancelled='F')
   to identify which customers and what descriptions drove the spike.
2. Report the actual breakdown — customer names, RM amounts, CN types.
Do not guess "possible causes" — investigate and report facts.

Provide a concise analysis with evidence-backed root causes.
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

Root-cause investigation:
If any month shows a significant anomaly (spike or drop >20% from
average), use tools to investigate what drove it — e.g., query
pc_sales_daily for that month's breakdown, or dbo.IV/dbo.CN for
specific transaction patterns.

Provide a concise analysis of the sales trend pattern with evidence.
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

> **Architecture note:** The summary uses a delimiter-based output format (`===INSIGHT===` blocks) instead of JSON. This avoids the fragile problem of LLMs producing invalid JSON when embedding rich Markdown (tables with `|` pipes, bold with `**`, newlines) inside JSON string values. The orchestrator parses the delimiters reliably and falls back to JSON parsing for backward compatibility.

> **Root-cause drill-down (added 2026-04-09):** The summary now has tool access (max 2 calls) to investigate the "why" behind anomalies that component analyses identified but didn't explain. Directors need actionable root causes, not just descriptions of what happened. For example, "Credit Notes spiked in Feb" becomes "Feb CN spike was driven by 12 returns from MY HERO (RM 52K — Chinese oranges, quality returns)." The summary's data source authority rules match the component rules (Section 6.1) — tools are for drill-down only, not for re-deriving totals.

```
You are a senior financial analyst producing a summary for a section
of the Hoi-Yong Finance dashboard. You are speaking to a senior
director who may only read this summary and skip individual details.

Below are the individual analyses for each component in this section.
Review them all and produce a summary.

IMPORTANT — Root-cause drill-down:
- For each NEGATIVE insight, ask yourself: "Does the component analysis
  explain WHY this happened?" If the answer is no — use the available
  tools to investigate.
- Examples of drill-down questions:
  • Credit notes spiked in month X → query dbo.CN for that month to
    find which customers and products drove the spike
  • Collection days worsened → query pc_ar_monthly to find which months
    drove the increase, then dbo.ARInvoice for overdue patterns
  • A customer dominates revenue → query their credit note ratio and
    payment history to assess risk
- Maximum 2 tool calls total. Use them on the highest-impact negative
  insights only.
- When reporting drill-down findings, cite the specific data: customer
  names, product names, RM amounts, counts.

Data source authority (same rules as component analysis):
- The component analyses below contain the AUTHORITATIVE figures. Do
  not re-derive totals via tools.
- Use tools ONLY for investigating root causes — e.g., "which specific
  customers or products explain this anomaly?"
- If a tool returns a total that differs from the component analyses,
  use the component analysis figures.

Output format — use this EXACT delimiter structure (no JSON, no code
blocks):

===INSIGHT===
sentiment: good
title: Short punchy headline (max 50 chars)
metric: Key number e.g. 84.3%, 43 days, RM 2.1M (max 25 chars)
---DETAIL---
Full markdown analysis here (see detail rules below)
===END===

Repeat ===INSIGHT=== ... ===END=== for each insight.
Maximum 3 good + 3 bad insights.
Rank by business impact — most important first.

Title rules:
- Maximum 50 characters. Punchy like a newspaper headline.
- Examples: "Strong Collection Recovery", "Credit Note Spike"
- No full sentences. No verbs like "is", "has", "shows".

Metric rules:
- Show the actual key number — e.g. "84.3%", "43 days", "RM 2.1M".
- If no single number fits, use the dashboard metric label — e.g.
  "Collection Days", "Aging", "By Customer".

Detail rules:
- The detail is the FULL ANALYST REPORT (300-500 words).
- Structure using bold section headers:

**Overall Performance:** Summarize with actual numbers.

**Key Observations:**

| Metric | Value |
|--------|-------|
| Row 1  | Data  |
| Row 2  | Data  |

**Trend Analysis:** Direction with period comparisons.

**Root Cause** (for negative insights where tools were used):
What specifically drove the anomaly — name customers, products,
agents, or months with RM amounts. This is the "why" that the
director needs to take action.

**Business Context:** Why this matters for operations.

**Conclusion:** One sentence bottom-line assessment.

- ALWAYS include a Markdown table with at least 3 rows.
- Cross-reference multiple components when relevant.
- For negative insights with drill-down data, the Root Cause section
  should include a table showing the specific contributors (e.g.,
  top 3 customers by credit note amount, top products returned).

Terminology rules:
- Use ONLY exact metric names from the dashboard (e.g. "Avg Collection
  Days", "Collection Rate", "Net Sales").
- Do NOT introduce jargon or acronyms not on the dashboard
  (e.g. do NOT say "DSO", "AR turnover", "DPO").

Quality rules:
- Do not produce contradicting good and bad insights for the same
  metric. Pick the dominant signal or merge into one nuanced insight.
- If two component analyses overlap, synthesize into one insight.
- If everything is good, you may have 0 bad insights (and vice versa).
- Synthesize across components — do not repeat verbatim.
```

**Summary User Prompt Template (Dynamic — Fed from Step 3 Results):**

```
Section: {section_name}
Page: {page_name}
Date Range: {start_date} to {end_date} ({N} months)
Generated: {current_datetime}

---

Below are the completed analyses for each component in this section.
Synthesize them into a summary.

### Component 1: {component_name_1} ({component_type})
{ai_analysis_output_1}

### Component 2: {component_name_2} ({component_type})
{ai_analysis_output_2}

... (all components in the section)

---

Produce the summary now using the ===INSIGHT=== delimiter format.
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

> **Multi-dashboard ready:** The schema is designed to support AI Insight across multiple dashboards (Finance Sales, Finance Payment, HR, etc.) without schema changes. The `page` column in `ai_insight_section` acts as the namespace — adding a new dashboard (e.g., HR Leave Tracker) only requires inserting rows with a new `page` value (e.g., `'hr_leave'`). No migrations, no new tables. The `ai_insight_lock` singleton works globally across all dashboards, and `ai_insight_component` inherits the dashboard scope via its FK to `ai_insight_section`. The PM should account for this when planning HR AI Insight — the storage layer is already designed for it.

### 8.1 Section-Level Insight (High-Level Summary)

```sql
CREATE TABLE ai_insight_section (
  id              SERIAL PRIMARY KEY,
  page            TEXT NOT NULL,           -- 'payment' | 'sales' (future: 'hr_leave', 'hr_attendance', etc.)
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

### 9.1 Data-Fetcher Date Format Rule

The `pc_ar_monthly.month` column stores values in `YYYY-MM` format (e.g., `'2024-11'`). The date range from the frontend arrives as `YYYY-MM-DD` (e.g., `'2024-11-01'`).

**All data-fetcher queries on `pc_ar_monthly` must convert dates to `YYYY-MM` before use in `BETWEEN` clauses.** If the full `YYYY-MM-DD` format is used, string comparison silently excludes the first month of the range (e.g., `'2024-11' < '2024-11-01'` is true lexicographically), causing the AI to analyze fewer months than the dashboard displays.

This is implemented via a `toMonth(date)` helper in `data-fetcher.ts`. Sales fetchers query `doc_date` (a proper DATE column) and do not need conversion.

> **Audit finding (2026-04-09):** This bug caused the AI to report 84.3% collection rate (11 months) while the dashboard showed 84.7% (12 months). Fixed by converting all payment fetcher params to YYYY-MM format.

### 9.2 Exploration Rules (Tool Use)

1. **Always query `pc_*` tables first** — they are pre-aggregated and fast
2. **Only hit RDS if `pc_*` data is insufficient** for a meaningful insight
3. **Column whitelist enforced** — AI cannot SELECT columns not on the approved list
4. **100 row limit per query** — prevents runaway scans
5. **Read-only** — SELECT only, no INSERT/UPDATE/DELETE
6. **No JOINs across RDS tables** — prevents accidental PII assembly
7. **RDS queries must include** `Cancelled = 'F'` and date bounds
8. **Components have no tool access** — they narrate pre-fetched data only
9. **Max 2 tool calls per summary analysis** — focused root-cause drill-down

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

**Important — Active Customer Filtering (`pc_ar_customer_snapshot`):**

The `is_active` column distinguishes active (`'T'`) from inactive (`'F'`) customers. Inactive customers may still have outstanding balances or credit limit breaches from before they were deactivated. The dashboard and data-fetcher queries must align on which population they count:

| Query Purpose | Required Filter | Rationale |
|---------------|----------------|-----------|
| Credit Limit Breaches (KPI) | `AND is_active = 'T'` | Only active customer breaches are operationally relevant |
| Credit Usage Distribution (donut) | `AND (is_active = 'T' OR is_active IS NULL)` | Match the dashboard's donut chart population |
| Total Outstanding / Overdue Amount | No `is_active` filter needed | Dashboard KPIs also include inactive balances (they still owe money) |
| Customer Credit Health (table) | `AND (is_active = 'T' OR total_outstanding > 0)` | Show active + any inactive that still owe money |
| Ad-hoc tool queries (`query_local_table`) | AI should include `is_active = 'T'` when counting credit breaches or categorizing credit usage | The system prompt should guide the AI on when to apply this filter |

> **Audit finding (2026-04-09):** The data-fetcher `credit_limit_breaches` and `credit_usage_distribution` queries were missing `is_active` filters, causing the AI to report 23 credit breaches (including 2 inactive customers) while the dashboard showed 21, and 583 total portfolio vs the dashboard's 365 active customers. Fixed by adding the appropriate `is_active` filters to match dashboard behavior.

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

### 9.4 Tool Safety Rules (Server-Side Enforcement)

The following rules must be enforced **server-side in code**, not just in AI prompt instructions. LLMs can skip prompt instructions — server-side guards are the last line of defense.

#### Rule 1: Cancelled Record Filter (RDS Queries)

RDS tables with a `Cancelled` column (`dbo.IV`, `dbo.CS`, `dbo.CN`, `dbo.ARInvoice`, `dbo.ARPayment`) must have `Cancelled = 'F'` enforced server-side. If the AI's `where_clause` does not include this filter, the server must inject it automatically before executing the query. Without this, cancelled transactions inflate totals.

> **Why server-side?** The experiment relies on the tool description telling the AI to include `Cancelled = 'F'`. This works most of the time, but LLMs occasionally omit filters — especially under high context load (many tool results in memory). A single missed filter on `dbo.ARInvoice` could include cancelled invoices worth millions of RM.

#### Rule 2: SQL Injection Guard (where_clause / order_by)

The AI generates `where_clause` and `order_by` as raw SQL strings. While the AI is not a malicious user, crafted data in the database (e.g., a customer name containing SQL syntax) could be echoed into a tool call. Production must add a guard that rejects queries containing dangerous patterns: semicolons (`;`), `UNION`, `DROP`, `DELETE`, `INSERT`, `UPDATE`, `--` (comment), or subqueries (`SELECT` inside a WHERE clause).

#### Rule 3: Row Truncation Warning

When a tool query returns exactly the row limit (100 rows), the result message must include a truncation warning: `"100 row(s) returned (LIMIT reached — results may be incomplete. Do not sum these rows as a total.)"`. Without this, the AI may treat 100 rows as the complete dataset and derive incorrect totals.

#### Rule 4: Data Population Labels

Each data-fetcher must include a population label in its output header, describing which records are included. Examples:

- `"Population: active customers only (is_active = 'T')"`
- `"Population: all customers with outstanding balance > 0 (active + inactive)"`
- `"Population: active customers + NULL status"`

This prevents the AI from cross-referencing numbers between components that use different populations (e.g., 21 credit breaches from active-only vs total outstanding from all customers) and getting confused by the mismatch.

#### Rule 5: Customer Count Accuracy

Fetchers that report customer counts from daily pre-aggregated tables must use `COUNT(DISTINCT ...)` or a verified unique count — not `SUM(customer_count)` across daily rows, which inflates counts (the same customer appearing on multiple days gets counted multiple times). This applies to any fetcher that joins or aggregates daily `pc_*` tables.

### 9.5 Tool Verification Protocol

Every data-fetcher and tool query must have a companion **truth query** that independently verifies the fetcher's output. This protocol is the standard QA gate for tool accuracy — it must pass before any new page/section goes live.

#### Purpose

The AI Insight Engine's accuracy depends on the data-fetcher giving the AI correct numbers. If the fetcher has a bug (wrong filter, wrong aggregation, wrong date format), the AI will confidently report wrong numbers. The verification protocol catches these bugs before they reach users.

#### How It Works

For each component's data-fetcher:

```
┌──────────────────────────────────────────────────────────────────┐
│  VERIFICATION TEST                                               │
│                                                                  │
│  1. Run the data-fetcher function for this component             │
│     → Extract key metric values from its output                  │
│                                                                  │
│  2. Run the truth query (simple, direct SQL)                     │
│     → Same metric, computed independently with explicit filters  │
│                                                                  │
│  3. Compare: fetcher value vs truth value                        │
│     → PASS if they match (within RM 1 rounding tolerance)        │
│     → FAIL if they differ — the fetcher has a bug                │
└──────────────────────────────────────────────────────────────────┘
```

#### Truth Query Requirements

- **Independent:** Must not call the data-fetcher or reuse its SQL. Write the query from scratch based on what the metric *should* return.
- **Explicit:** All filters (date range, `is_active`, `snapshot_date`, `CASH SALES%` exclusion) must be written out explicitly — no reliance on defaults or helpers.
- **Simple:** One query, one metric. No complex joins or CTEs unless the metric genuinely requires them.
- **Documented:** Each truth query must include a comment explaining what it verifies and which dashboard value it should match.

#### Example: credit_limit_breaches

```sql
-- Truth query: Count of active customers whose outstanding exceeds credit limit
-- Should match: Credit Limit Breaches KPI card on Payment page
-- Data-fetcher: credit_limit_breaches in data-fetcher.ts
SELECT COUNT(*) AS breach_count
FROM pc_ar_customer_snapshot
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_customer_snapshot)
  AND is_active = 'T'
  AND credit_limit > 0
  AND total_outstanding > credit_limit
  AND company_name NOT ILIKE 'CASH SALES%';
-- Expected: must match the fetcher's reported breach count exactly
```

#### Verification Matrix (Per Section)

Each section must have a completed verification matrix before going live:

| Component | Key Metric | Fetcher Value | Truth Query Value | Dashboard Value | Status |
|-----------|-----------|---------------|-------------------|-----------------|--------|
| avg_collection_days | Days value | ___ | ___ | ___ | PASS/FAIL |
| collection_rate | Percentage | ___ | ___ | ___ | PASS/FAIL |
| credit_limit_breaches | Count | ___ | ___ | ___ | PASS/FAIL |
| ... | ... | ... | ... | ... | ... |

**Three-way match required:** The fetcher value, truth query value, and dashboard displayed value must all agree. If only two match, the third has a bug.

#### When to Run

| Trigger | Scope |
|---------|-------|
| New page/section added | All components in the new section |
| Data-fetcher query modified | The modified component + any component sharing the same table |
| `is_active` or population filter changed | All components in that section |
| Pre-computed table schema changed | All components using that table |
| Before production deployment | All sections (full matrix) |
| Adding AI Insight to a new dashboard (e.g., HR) | All new components — no exceptions |

#### Pass Criteria

- All key metrics match within RM 1 rounding tolerance
- Customer/invoice counts match exactly (no rounding tolerance)
- Percentage values match within 0.1%
- All components in the section must PASS — a single FAIL blocks deployment

> **Lesson learned (2026-04-09):** The `credit_limit_breaches` fetcher reported 23 breaches while the dashboard showed 21. Root cause: missing `is_active = 'T'` filter. A truth query would have caught this immediately — the three-way match (fetcher vs truth vs dashboard) would have shown the fetcher as the outlier.

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

> **Implementation note:** "Own runs only" means the cancel endpoint must verify that `locked_by` matches the requesting user before aborting. The experiment prototype skips this check (single-user environment). Production must enforce it — otherwise one user can silently kill another user's in-progress analysis.

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

- **Frontend:** Next.js App Router + React — SSE via `fetch()` + `ReadableStream` (not `EventSource`, which only supports GET; the analyze endpoint is POST)
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

## 14. Extending to a New Page (Playbook) — added 2026-04-13

This is the canonical recipe for adding AI Insight to a new dashboard page. Every step is mandatory; the order is load-bearing because each step builds on the previous.

### Step 0 — Page workshop (1 hour, with stakeholder)

Before touching code, agree on:

1. **Section breakdown.** A page becomes 1–3 *sections*. Each section is a coherent narrative unit (a single insight card group). Heuristic: if two component groups would tell unrelated stories, split them.
2. **Per-section scope:** date-filtered (`period`) or current-state (`snapshot`). Mixing the two in one section is forbidden.
3. **Per-section components:** the exact KPI / chart / table / breakdown items that go into the data block.
4. **Per-section tool policy:** which database drill-down does this section legitimately need?
   - Pure trend section → `none`
   - Aggregate-only roll-up → `aggregate_only`
   - Customer / product / agent drill-down section → `full`
5. **Date-range source.** Period sections must read the same date range the user picked on the dashboard.

### Step 1 — Register the section key

In `apps/dashboard/src/lib/ai-insight/types.ts`:

```ts
export type SectionKey =
  | 'payment_collection_trend'
  | 'payment_outstanding'
  | 'sales_trend'
  | 'sales_breakdown'
  | 'customer_margin_overview'   // NEW
  | 'customer_margin_breakdown'; // NEW
```

Section keys are the load-bearing identity for routing, locks, storage rows, prompts, tool policy, and scope. Naming convention: `<page>_<sub>` snake_case.

### Step 2 — Wire the section → component map

In `apps/dashboard/src/lib/ai-insight/prompts.ts`, extend `SECTION_COMPONENTS`, `SECTION_PAGE`, and `SECTION_NAMES`:

```ts
SECTION_COMPONENTS: {
  ...
  customer_margin_overview: [
    { key: 'cm_total_margin',     name: 'Total Margin',     type: 'kpi' },
    { key: 'cm_margin_pct',       name: 'Margin %',         type: 'kpi' },
    { key: 'cm_margin_trend',     name: 'Margin Trend',     type: 'chart' },
  ],
}
SECTION_PAGE.customer_margin_overview = 'Customer Margin';
SECTION_NAMES.customer_margin_overview = 'Customer Margin Overview';
```

### Step 3 — Author component prompts

For each new component key, add a focused narration prompt to `COMPONENT_PROMPTS` in `prompts.ts`. Follow the pattern of existing prompts: state what the metric measures, the formula, the threshold colors, and a single instruction to narrate the pre-fetched values. **No tool-use instructions in component prompts** — components do not have tools.

### Step 4 — Implement the data fetcher (the most important step)

In `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`, add an entry to the `fetchers` record for **each** new component key. Each fetcher must return a `FetcherResult`:

```ts
async cm_total_margin(dr) {
  // 1. Query the DB for the canonical values
  const { rows } = await pool.query(/* SQL using dr.start/dr.end */);

  // 2. Build the prompt string (the markdown the LLM will read)
  const prompt = `Value: RM ${total.toLocaleString('en-MY')}\n...`;

  // 3. Build the allowed whitelist — every numeric value visible in the
  //    prompt MUST appear in `allowed`, OR be a date / safe small integer.
  const allowed: AllowedValue[] = [
    rm('total margin', total),
    pct('margin pct', marginPct),
    cnt('customer count', customerCount),
    // ... one entry per pre-computed value rendered into the prompt
  ];

  return { prompt, allowed };
},
```

**Whitelist discipline:** if it's printed in the prompt and it isn't a date or year, it must be in `allowed`. The numeric guard will catch any oversight on the next live run — fix in this fetcher rather than tuning the guard.

### Step 5 — Set the section scope

In the same file, extend `SECTION_SCOPE`:

```ts
const SECTION_SCOPE: Record<SectionKey, ScopeType> = {
  ...
  customer_margin_overview: 'period',
  customer_margin_breakdown: 'period',
};
```

The scope label is auto-prepended to every fetcher output.

### Step 6 — Declare the tool policy

In `apps/dashboard/src/lib/ai-insight/tool-policy.ts`, extend `SECTION_POLICY`:

```ts
const SECTION_POLICY: Record<SectionKey, ToolPolicy> = {
  ...
  customer_margin_overview: 'aggregate_only',
  customer_margin_breakdown: 'full',
};
```

If your section needs a new aggregate table not yet listed in `AGGREGATE_LOCAL_TABLES`, add it there.

### Step 7 — Wire the UI panel

The dashboard component for the new page imports the existing `<AIInsightPanel sectionKey="..." />` (or whatever the v1 component is named) and drops it into the section header. No new React work is needed beyond the new instances.

### Step 8 — Validate via Appendix C playbook

Run the procedure in **Appendix C** for each new section in turn:
1. Reset DB (`DELETE FROM ai_insight_section`)
2. POST to `/api/ai-insight/analyze` with the new `section_key`
3. Check `summary_json.numericGuard.passed === true` via `/api/ai-insight/section/<key>`
4. Inspect the debug log under `apps/dashboard/logs/` for any `tool_use` blocks that violate the declared policy
5. Spot-check 5–10 numeric claims against the underlying SQL

If guard fails, the unmatched list is your TODO: each entry is either (a) a real fabrication (good — guard caught it; tighten the prompt or accept the retry), or (b) a legitimate value the fetcher forgot to whitelist (add one line to the fetcher's `allowed` array and rerun).

### Step 9 — Update spec & commit

- Add the new section's row to **§2.3 v2 Roll-Out** and **Appendix A**.
- Add an estimated cost row to **Appendix B**.
- Commit with `feat: add AI insight for <page> (<section_keys>)`.

### Files touched per new section (checklist)

```
apps/dashboard/src/lib/ai-insight/types.ts          (SectionKey)
apps/dashboard/src/lib/ai-insight/prompts.ts        (SECTION_COMPONENTS, SECTION_PAGE, SECTION_NAMES, COMPONENT_PROMPTS)
apps/dashboard/src/lib/ai-insight/data-fetcher.ts   (fetchers, SECTION_SCOPE)
apps/dashboard/src/lib/ai-insight/tool-policy.ts    (SECTION_POLICY)
apps/dashboard/src/components/<page>/...            (UI panel mount)
_bmad-output/planning-artifacts/ai-insight-engine-spec.md  (§2.3 + Appendix A/B)
```

No changes are required in `orchestrator.ts`, `tools.ts`, `numeric-guard.ts`, or any other shared infrastructure file. If you find yourself editing those, stop and ask why — the architecture should absorb new sections without core changes.

---

## 12. Implementation Patterns & Lessons (added 2026-04-10)

> These patterns were discovered during spike implementation and validated through accuracy testing. They are **mandatory** for production — skipping any of them reintroduces bugs that were already caught and fixed.

### 12.1 Dual-Model Architecture

Components use a fast, cheap model (Haiku) for narration. Summary uses a smarter model (Sonnet) for synthesis + tool use. **Do not use the same model for both.**

| Role | Model | Why |
|------|-------|-----|
| Component narration | Haiku | Single LLM call, no tools. Narrates pre-fetched data. Output powers the per-KPI "View AI insight" dialogs on the dashboard — NOT consumed by the summary stage (see §12.8). Haiku is sufficient and 4x cheaper for this narration-only role. |
| Summary analysis | Sonnet | Tool use + synthesis across 4-6 components. Reads the raw fetcher data blocks directly. Haiku failed at: (a) arithmetic on 12-row tables, (b) following `===INSIGHT===` format after tool calls, (c) distinguishing "collection gap" from "outstanding balance". |
| Summary analysis | Opus | **Overkill.** 5x more expensive than Sonnet for marginal quality gain. Reserve for future complex features (cross-section strategic analysis, chatbot). |

**Production config:** Set `AI_INSIGHT_MODEL` (components) and `AI_INSIGHT_SUMMARY_MODEL` (summary) independently. The pricing table in `client.ts` must include entries for both models.

### 12.2 Component Output Length Limit

Component prompts include: *"Keep your analysis under 150 words."* This was originally critical because component narrations were concatenated into the summary prompt. After §12.8, the summary no longer reads narrations — but the 150-word limit is still enforced because:
- Component narrations are shown verbatim in the per-KPI "View AI insight" dialog on the dashboard; long walls of text are unreadable in that UI context
- Long narrations cost more Haiku tokens with no upside
- Components should also NOT re-derive totals or sums — use the pre-fetched values as given

### 12.3 Pre-Calculated Totals in Data Fetchers

Data fetchers that pass monthly breakdowns **must also include pre-calculated totals** in the prompt output. Example: `invoiced_vs_collected` includes `Period totals: Total Invoiced: RM X, Total Collected: RM Y, Cumulative Gap: RM Z` above the monthly table.

**Why:** Haiku summed 12 monthly values incorrectly (said RM 87.16M when actual was RM 82.76M). Pre-calculating prevents the AI from doing arithmetic.

This applies to **all ratios and percentages**, not just sums. If a table has a value and a total, the data fetcher must pre-calculate the percentage — Haiku will hallucinate percentages when forced to mentally divide (e.g., it claimed 95% when the actual was 58% for risk tier outstanding share). Affected fetchers:
- `customer_credit_health`: `% of Outstanding` column added alongside `% of Customers`
- `by_agent`: `% of Total` column added for each agent's net sales share
- `by_customer`, `by_product`, `by_outlet`, `aging_analysis`: already had pre-calculated percentages

### 12.4 Tool Call Exhaustion Nudge

When the summary uses all `MAX_TOOL_CALLS_PER_SUMMARY` calls, the orchestrator injects a user message:

> *"You have used all available tool calls. Now produce your final summary using the ===INSIGHT=== delimiter format. Do not request more data — work with what you have."*

**Why:** Without this nudge, the model outputs reasoning text ("Let me now check...") instead of the required `===INSIGHT===` format, causing the parser to fall back to a generic "Summary generated" output.

### 12.5 Snapshot Table Deduplication

The `pc_ar_customer_snapshot` table contains multiple rows per customer (one per snapshot date). Tool queries against this table are **automatically deduplicated** by the tool executor:
- Filter to latest `snapshot_date`
- Apply `DISTINCT ON (debtor_code)`

**Why:** Without deduplication, a "top 10 customers" query returns 10 rows of the same 2 customers, making the summary's root-cause analysis useless.

### 12.6 Summary Tool Call Guidance

The summary prompt explicitly instructs:
- **DO NOT** query `pc_ar_monthly` for months inside the current date range — that data is already in the raw fetcher block for `invoiced_vs_collected`. You MAY query it for months OUTSIDE the range (e.g. multi-year historical anchoring).
- Use tools ONLY for data NOT in the raw blocks (e.g., `pc_ar_customer_snapshot` for customer drill-down, `dbo.CN` for credit note detail)
- The column whitelist is injected into the summary system prompt with actual table/column names

**Why:** Without this guidance, the summary wastes both tool calls re-querying monthly data already available in the raw blocks, then has no calls left for actual root-cause investigation.

### 12.7 Cost Estimation with Dual Models

The `estimateCost()` function accepts an optional `model` parameter. Summary cost is calculated using the summary model's pricing, not the component model's pricing. The pricing table in `client.ts` must be kept in sync with Anthropic's actual rates.

**Why:** Sonnet is ~4x more expensive per token than Haiku. Without model-aware cost estimation, the displayed "Est. Cost" would underreport by ~60%.

### 12.8 Summary Reads Raw Fetcher Data, Not Component Narrations (added 2026-04-13)

**Rule:** The summary stage receives the raw fetcher markdown blocks (the same formatted string each component originally saw) — NOT the Haiku component narrations.

**Why (the bug class this fixed):** Three consecutive validator runs on `payment_collection_trend` caught three different fabrications of the same kind:

| Run | Fabrication |
|-----|-------------|
| #1 | Invented 95% risk-concentration figure |
| #2 | "6–7 days slower than target" arithmetic + cherry-picked Jul–Oct window + "met every month" overclaim |
| #3 | Invented Jan/May invoiced + collected rows that back-solved to the known gap |

**Root cause:** The summary (Sonnet) previously received only the Haiku narration for each component (~150 words per component, a paraphrase of the data). When Sonnet needed to fill a table cell or cite a specific row-level number, it had no ground truth to copy from — so it back-solved or invented a plausible figure. Every patch (verbatim-copy rule, mandatory table rule, pre-computed arithmetic in fetcher) attacked a symptom while leaving the mechanism — *summary writing numbers it doesn't have* — in place.

**The fix:** The `ComponentResult` type carries a `raw_data_md` field populated from `fetchComponentData()` output. `buildSummaryUserPrompt` renders those raw blocks under a "RAW DATA BLOCKS (ground truth)" header. `SUMMARY_SYSTEM` carries a top-priority **GROUND TRUTH RULE** stating that every number must be traceable to a specific line in the raw blocks (or to a tool-call result); anything un-traceable must be omitted — never invented, never back-solved.

**What this implies architecturally:**
- Haiku narrations are still generated per component (for the per-KPI "View AI insight" dialogs), but they are a dead-end from the summary's perspective.
- The summary's input token count goes up modestly (raw blocks are slightly larger than narrations — ~200–500 tokens per component vs ~150 for a narration).
- No change to cost or latency in practice: validated on both `payment_collection_trend` ($0.08 / 62s) and `payment_outstanding` ($0.10 / 75s), identical to pre-fix baseline.

**Validation (2026-04-13):**
- `payment_collection_trend`: 3 cards, ~60 numeric claims fact-checked against raw data + tool results → 0 fabrications
- `payment_outstanding`: 3 cards, ~55 numeric claims → 0 fabrications
- The exact run #3 failure pattern ("Jan & May 31% / RM 3.98M") now traces verbatim to the pre-computed `Worst two months combined = 31.0% of the full-period negative gap` line in the fetcher block.

**A verifier pass (second Sonnet call that fact-checks the draft and strips failed claims) was prototyped and explicitly rejected** in favor of this fix alone. The verifier doubled cost and latency, introduced false-positive strips of true-but-tool-derived claims (e.g. avg payment days from `pc_ar_customer_snapshot`), and did not reliably catch semantic pairing errors. Part 1 alone achieved zero hard fabrications across ~115 claims — the verifier would be defense-in-depth against a problem that no longer exists.

**Commit:** `06e592e` on `feature/v2-finance-spike-s1-auth`.

---

### 12.9 Section-Aware Tool Policy (added 2026-04-13)

**Rule:** Each section declares an explicit *tool policy* that constrains what database queries the summary agent can issue. Policy is enforced both as a tool schema filter (Claude only sees allowed tools) and as a runtime gate in the orchestrator (defence-in-depth against schema bypass).

**Why (the bug class this fixed):** Run #2 on `payment_collection_trend` produced a fabricated customer drill-down: `MY HERO HYPERMARKET RM 617K` cited as a top contributor. The fabrication came from the LLM issuing an unsolicited `query_local_table` call against `pc_sales_by_customer` to invent a customer narrative — even though `payment_collection_trend` is a trend section that should never name individual customers. Prompt rules ("don't query unless needed") were stochastic and routinely violated.

**The fix:** A new module `apps/dashboard/src/lib/ai-insight/tool-policy.ts` exports:

```ts
export type ToolPolicy = 'none' | 'aggregate_only' | 'full';

policyForSection(sectionKey)        // → ToolPolicy
toolsForSection(sectionKey)         // → filtered Anthropic.Tool[]
validateToolForSection(sectionKey, toolName, input) // → error string | null
```

**Per-section policy table:**

| Section | Policy | Rationale |
|---|---|---|
| `payment_collection_trend` | `none` | Pure trend narration; no customer drill-down justified. |
| `payment_outstanding` | `full` | Snapshot of customer book — drill-down is the whole point. |
| `sales_trend` | `aggregate_only` | May query `pc_sales_daily` / `pc_ar_monthly` / `pc_ar_aging_history` but **not** by-customer/product/outlet tables. |
| `sales_breakdown` | `full` | Per-customer/product/agent breakdown is the section's purpose. |

**Architectural notes:**
- For policy `none`, the orchestrator omits the `tools` parameter entirely from the API call — Claude has no tool capability for that section, period.
- For `aggregate_only`, the `query_local_table` enum of allowed tables is replaced with the aggregate subset before being sent to Claude. A runtime guard in `runSummaryAgentLoop` rejects any tool call that slips past (returns the error as the tool result instead of executing).
- The aggregate set: `pc_sales_daily`, `pc_ar_monthly`, `pc_ar_aging_history`. Add new aggregate tables here as the model expands.

**Validation (2026-04-13):** A live run of `payment_collection_trend` on the post-fix branch produced **zero `tool_use` blocks** in the debug log. This eliminates the entire fabricated-customer class of bugs for trend sections.

**Commit:** Phase 1 of the AI Insight stability fix on `feature/v2-finance-spike-s1-auth`.

### 12.10 Numeric Guard + Fetcher Whitelist (added 2026-04-13)

**Rule:** Every numeric value in the summary's final response is mechanically checked against a per-section whitelist of "values the fetchers actually emitted." Unmatched numbers force a retry; the second failure ships the card with a `numericGuardFailed` flag.

**Why (the bug class this fixed):** Even with the ground-truth-rule and verbatim-copy prompt patches, validator runs continued to catch fabricated percentages, fabricated month rows, fabricated counts (e.g., "7 of 12 months", "44%"). Every previous fix was prompt-based — they nudged probability without removing possibility. Sonnet rolled fresh dice on every click. The validator kept finding new bugs in new places.

**The fix:** Move correctness into code.

**1. New types** (in `types.ts`):

```ts
export type AllowedValueUnit = 'RM' | 'pct' | 'days' | 'count';

export interface AllowedValue {
  label: string;          // human-readable description
  value: number;          // raw numeric value
  tolerance?: number;     // absolute tolerance (defaults applied by guard)
  unit?: AllowedValueUnit;
}

export interface FetcherResult {
  prompt: string;
  allowed: AllowedValue[];
}
```

**2. Fetcher interface upgrade** (in `data-fetcher.ts`): every fetcher now returns `FetcherResult`. Each pre-computed value the fetcher renders into the prompt string is also pushed onto its `allowed` array, with helpers `rm() / pct() / days() / cnt()`. `fetchComponentData()` aggregates the scope label into the prompt and returns `{ prompt, allowed }`.

**3. ComponentResult carries the whitelist:** `ComponentResult.allowed: AllowedValue[]` is set by `analyzeComponent()` and surfaces to the orchestrator after all components finish.

**4. Numeric guard module** (`apps/dashboard/src/lib/ai-insight/numeric-guard.ts`):
- `extractNumbers(text)` parses RM amounts (incl. K/M suffixes and ranges like "RM 7–8M"), percentages, day counts, and bare integer counts. Date-like patterns (`2025-04-12`, `Mar 2025`, year tokens) are pre-filtered.
- `runNumericGuard(text, allowed)` walks every extracted number and checks against `allowed`:
  - direct match within unit-specific tolerance (default ±RM 1, ±0.1pp, ±0.1d, ±0.5 count)
  - relative tolerance (±5%) for K/M-rounded RM displays
  - absolute-value match for RM (so `−RM 1,013,268.22` matches a whitelisted positive `cnAbs`)
  - derived-percentage helper accepts `round(a/b * 100, 1)` for any pair of allowed values
  - safe small integers (`0..12`, plus `30/60/80/90/100/120/365`) are auto-allowed

**5. Retry loop** (in `runSummaryAnalysis`):
- Attempt 1 → run agent loop → run guard.
- If `unmatched.length > 0`: append the failed assistant turn + a `formatGuardError(unmatched)` user message, run agent loop again.
- Attempt 2 → run guard again; if still failing, ship with `summary_json.numericGuard = { passed: false, attempts: 2, unmatched: [...] }` so the UI can flag the card.
- Maximum 2 attempts. No third pass.

**Edge cases handled:**
- Date-like numbers (`2024`, `2025-02`, `Mar 2025`) excluded from validation.
- Rounded RM forms (`RM 82.8M` vs raw `82,763,453`) — relative tolerance.
- RM ranges (`RM 7–8M per month`) — both endpoints emitted, both must independently match.
- Sign mismatches between displayed credit-note values (`−RM 1,013,268.22`) and unsigned `cnAbs` whitelist entries.
- Derived percentages (`84.7% = 70.1M / 82.8M`) — accepted without explicit whitelisting.

**Validation:**
- Smoke test on synthesised text: guard correctly flags `RM -771K`, `44%`, `RM 617K`, ignores `2024`, `2025`, `Feb`, accepts `RM -1,101,767` etc.
- Live runs (2026-04-13):
  - `payment_collection_trend`: passed on attempt 2 (attempt 1 cited "RM -3,981,963 combined" as a back-solved sum → guard rejected → attempt 2 used verbatim values).
  - `sales_breakdown`: passed on attempt 2.
  - `payment_outstanding` and `sales_trend`: initially failed — fixed in §12.11.

**Commit:** Phase 1 of the AI Insight stability fix on `feature/v2-finance-spike-s1-auth`.

### 12.11 Dynamic Tool-Result Whitelisting (added 2026-04-13)

**Rule:** Numbers that appear in a `tool_result` block during the summary agent loop are dynamically appended to the section's `allowed` list before the guard runs. The LLM is allowed to cite anything it queried live from the database.

**Why (the bug class this fixed):** Sections with `full` tool policy (`payment_outstanding`, `sales_breakdown`) produced fully-grounded outputs that nonetheless tripped the guard. The unmatched values (`172%`, `594%`, `832 days`, customer counts) were 100% legitimate — they came from `pc_ar_customer_snapshot` rows the LLM queried via `query_local_table`. The fetcher's static whitelist only knew about the top-5 customers it pre-computed; everything below the top 5 was off the list.

The naive fix would be to dump all 200+ customers into every fetcher's `allowed` array. That bloats memory, slows the matcher, and still misses non-customer dimensions (aging by agent, by debtor type, etc.).

**The fix:** Capture tool results live and feed them into the guard.

```ts
// inside runSummaryAgentLoop
toolResultTexts.push(result);  // alongside the existing logToolResult call

// inside runSummaryAnalysis, after each agent loop iteration
for (const trText of loopResult.toolResultTexts) {
  for (const f of extractNumbers(trText)) {
    allAllowed.push({ label: `tool result: ${f.raw}`, value: f.value, unit: f.unit });
  }
}
```

The same `extractNumbers` parser used by the guard is applied to the markdown table the tool returned. Every RM amount, percentage, day count, and count from the live query becomes a legal citation for the summary.

**Why this is safe:**
- Tool results are deterministic database queries against whitelisted columns (Section 9). They are by definition ground truth.
- The whitelist additions are scoped to the current section's analysis — they don't leak across sections.
- The guard still rejects anything the LLM invents *outside* of what it queried (back-solved arithmetic, fabricated subtotals).

**Sign-insensitive RM matching (companion patch):** `matchesAllowed()` now compares `Math.abs(found.value)` to `Math.abs(av.value)` for RM unit. This handles credit-note display (`−RM 1,013,268.22`) matching unsigned fetcher whitelist entries (`cnAbs = 1,013,268.22`) without forcing every fetcher to emit signed duplicates.

**Validation (2026-04-13):** With these patches, all four sections are expected to pass on the first or second attempt; final cross-section live validation is pending the next API top-up.

**Commit:** Phase 2 of the AI Insight stability fix on `feature/v2-finance-spike-s1-auth`.

---

## Appendix A: Section Key Reference

| Section Key | Page | Section Name | Date Filtered |
|-------------|------|-------------|---------------|
| `payment_collection_trend` | Payment | Payment Collection Trend | Yes |
| `payment_outstanding` | Payment | Outstanding Payment | No (snapshot) |
| `sales_trend` | Sales | Sales Trend | Yes |
| `sales_breakdown` | Sales | Sales Breakdown | Yes |

## Appendix B: Estimated Cost Model

| Section | Components | Est. Tokens | Est. Cost (Haiku+Sonnet) | Observed (2026-04-10, dual-model) |
|---------|-----------|-------------|--------------------------|-----------------------------------|
| Payment Collection Trend | 5 + summary | ~18,000 | ~$0.08 | 18,159 tokens, $0.08, 63.5s |
| Payment Outstanding | 6 + summary | ~20,000 | ~$0.09 | Not yet tested with dual-model |
| Sales Trend | 5 + summary | ~18,000 | ~$0.08 | Not yet tested with dual-model |
| Sales Breakdown | 4 + summary | ~16,000 | ~$0.07 | Not yet tested with dual-model |
| **Total (all 4 sections)** | **24 calls** | **~72,000** | **~$0.32** | Pending full test |

**Note (updated 2026-04-10):** Costs changed significantly with the dual-model architecture:
- **Components are cheaper:** No tool calls → single LLM call per component → fewer tokens than before
- **Summary is more expensive:** Sonnet ($3/$15 per 1M tokens) vs Haiku ($0.80/$4) → ~4x per-token premium on summary
- **Net effect:** Total tokens dropped ~50% (no component tool loops), but dollar cost roughly doubled due to Sonnet summary pricing
- The 150-word component limit further reduces tokens by keeping component outputs concise

**Cost estimation method:** The Anthropic API returns actual token counts (`usage.input_tokens`, `usage.output_tokens`) per request but does **not** return a dollar cost. The `cost_usd` displayed in the UI is calculated client-side by multiplying actual token counts against a hardcoded pricing table (per-model rates in `client.ts`). The `estimateCost()` function accepts a `model` parameter to calculate correctly for the dual-model setup. The UI label reads **"Est. Cost"** to reflect this. The pricing table must be updated when switching models or when Anthropic changes pricing — otherwise the displayed cost will drift from actual billing.

## Appendix C: AI Insight Accuracy Verification Procedure

> This procedure verifies that AI Insight values match dashboard values. Run after any change to the data-fetcher, prompts, orchestrator, or AI model configuration. This is the standard QA gate before production deployment.

### Prerequisites

1. Next.js dev server running with current environment variables
2. Database seeded with production-equivalent data
3. Role set to **Admin** (Viewer role cannot trigger analysis)
4. Lock table contains the singleton row (`id=1`) — required for lock acquisition

### Step 1: Reset AI Insight Data

Clear all previous analysis results to ensure a clean run:

```sql
DELETE FROM ai_insight_section;  -- cascades to ai_insight_component
-- Do NOT delete from ai_insight_lock; only reset it:
UPDATE ai_insight_lock SET locked_by = NULL, locked_at = NULL, section_key = NULL WHERE id = 1;
```

### Step 2: Run Analysis for Each Section

Trigger analysis for all 4 sections, one at a time (global lock prevents parallel runs):

| Order | Page | Section | Section Key |
|-------|------|---------|-------------|
| 1 | `/payment` | Payment Collection Trend | `payment_collection_trend` |
| 2 | `/payment` | Outstanding Payment | `payment_outstanding` |
| 3 | `/sales` | Sales Trend | `sales_trend` |
| 4 | `/sales` | Sales Breakdown | `sales_breakdown` |

For each section:
1. Navigate to the page
2. Open the "Get Insight" panel
3. Click "Analyze" and wait for all components to complete
4. Verify the "Last Updated" timestamp reflects the current run

### Step 3: Establish DB Ground Truth (Independent Baseline)

Before comparing against the dashboard UI, query the database directly to establish an independent ground truth. This catches bugs that would be invisible if you only compared AI output vs. dashboard (e.g., if the data-fetcher and dashboard query share the same filter bug).

Run the ground truth SQL for each section against the same database the AI Insight Engine uses (connection string from `DATABASE_URL`). The AI Insight values **MUST** match the DB ground truth, not just the dashboard.

**Ground Truth Queries (reference — adapt date range to match the section's selected window):**

```sql
-- payment_collection_trend (pc_ar_monthly) — replace dates with section's selected range
SELECT month,
       CASE WHEN invoiced > 0
         THEN ROUND((total_outstanding::numeric / invoiced) * 30, 1)
         ELSE NULL END AS dso,
       invoiced, collected, (collected - invoiced) AS gap
FROM pc_ar_monthly
WHERE month BETWEEN '<start_ym>' AND '<end_ym>'
ORDER BY month;

SELECT SUM(invoiced) AS total_invoiced,
       SUM(collected) AS total_collected,
       ROUND(SUM(collected)::numeric / NULLIF(SUM(invoiced), 0) * 100, 1) AS collection_rate_pct
FROM pc_ar_monthly WHERE month BETWEEN '<start_ym>' AND '<end_ym>';

-- payment_outstanding (snapshot tables)
SELECT SUM(total_outstanding) AS total, SUM(overdue_amount) AS overdue,
       COUNT(*) FILTER (WHERE overdue_amount > 0) AS overdue_customers,
       COUNT(*) AS total_customers
FROM pc_ar_customer_snapshot
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_customer_snapshot)
  AND total_outstanding > 0 AND company_name NOT ILIKE 'CASH SALES%';

SELECT bucket, SUM(invoice_count) AS invoices, SUM(total_outstanding) AS amount
FROM pc_ar_aging_history
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_aging_history)
  AND dimension = 'all' GROUP BY bucket;

SELECT risk_tier, COUNT(*), SUM(total_outstanding)
FROM pc_ar_customer_snapshot
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_customer_snapshot)
  AND (is_active = 'T' OR total_outstanding > 0)
  AND company_name NOT ILIKE 'CASH SALES%'
GROUP BY risk_tier;

-- sales_trend (pc_sales_daily)
SELECT SUM(invoice_total) AS invoice_sales, SUM(cash_total) AS cash_sales,
       SUM(cn_total) AS credit_notes, SUM(net_revenue) AS net_sales
FROM pc_sales_daily WHERE doc_date BETWEEN '<start>' AND '<end>';

-- sales_breakdown (pc_sales_by_customer / pc_sales_by_fruit / pc_sales_by_outlet)
SELECT company_name, SUM(total_sales) AS net_sales
FROM pc_sales_by_customer WHERE doc_date BETWEEN '<start>' AND '<end>'
GROUP BY company_name ORDER BY SUM(total_sales) DESC LIMIT 15;
```

Record the ground truth values in a working document. These are the authoritative numbers — every AI Insight claim must match these to pass.

### Step 4: Verify Summary Panel Values

For each section, compare the AI Insight summary panel (positive/negative cards) against **both** the DB ground truth (primary) and the dashboard KPIs (secondary):

**Payment Collection Trend — verify against:**
- Avg Collection Days (KPI card)
- Collection Rate (KPI card)
- Avg Monthly Collection (KPI card)
- Chart averages (Collection Days Trend, Invoiced vs Collected)

**Outstanding Payment — verify against:**
- Total Outstanding (KPI card)
- Overdue Amount and % (KPI card)
- Credit Limit Breaches count (KPI card)
- Aging Analysis chart (120+ Days bucket and invoice count)
- Credit Usage distribution (Over Limit count)

**Sales Trend — verify against:**
- Net Sales, Invoice Sales, Cash Sales, Credit Notes (all 4 KPI cards)
- Net Sales Trend chart (monthly bars)

**Sales Breakdown — verify against:**
- Sales Breakdown table (customer names and Total Sales values)
- Sales Chart (top 10 horizontal bar chart values)

### Step 5: Verify Summary Detail Dialogs

Click every insight card in the summary panel to open its detail dialog. For each dialog:

1. **Screenshot** the dialog content
2. **Extract** every number, customer name, percentage, and date reference the AI cites
3. **Verify** each extracted value against the DB ground truth from Step 3
4. **Confirm** the business narrative is logically consistent with the data (not just numerically correct)

### Step 6: Verify Component Detail Dialogs

For each of the 5–6 components in the section, click the `?` (View AI insight) icon next to the component title. For each component dialog:

1. **Screenshot** the dialog content
2. **Verify** the component's claimed values against the DB ground truth (NOT against the dashboard — the fetcher feeds both)
3. **Flag** any component that punts with "insufficient data" when the data IS available in the section
4. **Flag** any cross-component contradictions (e.g., one component says "concentration risk" while another says "risk is spread across all customers")

Alternatively, read component analyses directly from the DB to avoid UI navigation:

```sql
SELECT component_key, analysis_md
FROM ai_insight_component
WHERE section_id = (SELECT id FROM ai_insight_section
                    WHERE section_key = '<section_key>'
                    ORDER BY generated_at DESC LIMIT 1)
ORDER BY component_key;
```

### Step 7: Produce Structured Validation Report

For each section, produce a report with three clearly separated sections:

**1. MAKES SENSE (What checks out)**
- A table mapping every AI claim to the DB ground truth with a Match/No Match verdict
- All numbers, customer names, percentages, dates must be listed
- Qualitative observations (threshold classifications, trend direction, business context) must also be validated

**2. DISCREPANCIES**
- Any number, name, percentage, or date that does not match the DB ground truth — even by RM 1
- Any arithmetic error (e.g., "95% of debt" when DB shows 58%)
- Any contradiction between components or between summary and components
- Any unsupported claim (e.g., calling out specific customers as "the worst" when the DB shows others are worse)
- Severity tag: CRITICAL / MODERATE / MINOR

**3. INSIGHTFUL (Value assessment)**
- Summary-level quality score out of 10 with justification
- Component-level quality score out of 10 with justification
- What root-cause drill-down worked; what was missed
- Whether a director reading only the summary would learn the right things

### Pass Criteria — 100% Accuracy Required (RM 1 Rounding Tolerance)

**The accuracy MUST AND SHALL be 100%, subject only to RM 1 rounding tolerance on monetary values.**

- Every RM value cited by the AI must match the DB ground truth within ±RM 1 (accounts for rounding when the AI rounds to whole ringgit)
- Every percentage must match the DB to the stated precision (if AI shows "58%", DB must compute to 57.5–58.4%; if AI shows "58.0%", DB must be 57.95–58.04%)
- Every count (customers, invoices, breaches) must match exactly — no tolerance on counts
- Every customer name cited must exist in the DB with the values the AI claims for it
- Every overdue day count, credit limit, utilization percentage must match the `pc_ar_customer_snapshot` row exactly
- Any discrepancy beyond RM 1 rounding is a FAIL for that section
- Any cross-component contradiction is a FAIL
- Any arithmetic error in a component analysis (e.g., "95% of debt" when DB shows 58%) is a FAIL
- All 4 sections must PASS for the verification to be considered complete before production deployment

**Rationale:** Directors will trust the AI Insight output and take action on the numbers cited. A single incorrect customer name or wrong amount could lead to wrong recovery prioritization, wrong credit policy decisions, or wrong escalations. 100% accuracy (within RM 1 rounding) is the only acceptable standard for production.

### Known Considerations

- **Rate limiting:** Anthropic API rate limits may cause retries and longer analysis times. This does not affect accuracy.
- **Role requirement:** Only the Admin role can trigger analysis. Viewer role clicks are silently ignored.
- **Lock singleton:** The `ai_insight_lock` table must contain exactly one row with `id=1`. If this row is missing, lock acquisition fails silently (returns 409).
- **Snapshot sections:** Outstanding Payment is a point-in-time snapshot (no date filter). Values change if underlying data changes between verification runs.

### First Verified Run (Baseline — 2026-04-09)

| Section | Verdict | Key Findings |
|---------|---------|-------------|
| Payment Collection Trend | PASS | Collection Rate 84.7% exact match, Avg Collection Days 43.7d vs 44d (rounding), Monthly Collection RM 5,841,378 exact match |
| Outstanding Payment | PASS | Total Outstanding RM 11,349,862 vs RM 11,349,863 (RM 1 rounding), 3,376 invoices exact match, 21 credit breaches exact match, top 3 customer amounts exact match |
| Sales Trend | PASS | Invoice Sales RM 83,771,290 exact match, Cash Sales RM 5,534,326 exact match, Credit Notes RM 1,013,268 exact match |
| Sales Breakdown | PASS | MY HERO RM 21,518,626 exact match, CASH SALES RM 6,529,840 exact match, WONDERFRUITS RM 5,979,004 exact match |
