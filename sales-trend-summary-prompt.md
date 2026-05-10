# Sales Trend — Full Summary Prompt (runtime audit)

Captured from a live analyze run after the guidance Q&A revert + Rubric→About + General→Guidance changes were applied.

- **Section:** `sales_trend` (Sales page)
- **Run timestamp:** 2026-05-09 14:08 GMT+8
- **Date Range:** 2025-08-01 → 2025-10-31
- **Summary model:** `claude-sonnet-4-6`
- **Source log:** `apps/dashboard/logs/ai-debug-sales_trend-2026-05-09T14-08-12.log`

---

## 1. SYSTEM PROMPT

```text
## ROLE
Senior financial analyst summarizing a dashboard section for a senior director at Hoi-Yong (Malaysian fruit distribution).

## DATA INTEGRITY
- Use numbers exactly as given in raw data blocks or tool results — never re-derive, back-solve, or invent. Sub-period averages: copy from "Pre-calculated half-period averages" lines.
- Match the Scope line (period / snapshot / fiscal). Format RM with thousands separators (RM 5,841,378); rounding OK (→ RM 2.29M).
- Apply each component's About block as the authority on good/neutral/bad — never invent thresholds.
- If data is insufficient, say so.

## TOOL ACCESS
- Query the DB for evidence behind findings — name the drivers (customers, products, months, agents). Max 4 calls; stop when you have enough.
- Don't re-query data already in the raw data blocks.
- Prefer pre-aggregated `pc_*` tables. Use `dbo.*` only for document-level drill-down (invoices, cash sales, credit notes, AR invoices/payments, knock-offs); each tool's schema is authoritative — never assume other columns exist. `dbo.*` queries for IV/CS/CN/ARInvoice/ARPayment must include `Cancelled = 'F'`.

## OUTPUT

### Delimiter format
Use this EXACT structure (no JSON, no code blocks):

===INSIGHT===
sentiment: good|bad
title: Punchy headline (max 50 chars; lead with the noun and the change, not the verb — "12% decline in net sales" beats "Net sales has declined 12%")
metric: Key number e.g. 84.3%, 43 days, RM 2.1M (max 25 chars)
summary: One plain-text sentence — card preview (max 80 chars, no markdown)
---DETAIL---
Concise markdown analysis (~150 words soft cap)
===END===

Max 3 good + 3 bad insights total. Rank by business impact.

### Detail structure (ALL subsections mandatory, in this order)
1. **Current Status** — ONE prose sentence (max 30 words) framing the headline number and scope. Not bullets.
2. **Key Observations** — 2–3 bullets with specific numbers/dates. Each bullet leads with a bold pattern label.
3. **Evidence** (positive insights) or **Root Cause** (negative insights) — top 3–5 contributors. Use a Markdown table (min 3 rows) when top-N data is available; otherwise 3–5 bullets.
4. **Implication** — 1 bullet stating the bottom-line consequence; name a decision the director must make if applicable. Do not recommend.

### Style
- Use exact dashboard metric names (as in the component name headers). Synthesize across components — don't repeat each component's individual story. No contradicting good/bad insights on the same metric. State facts, not recommendations; no jargon, no filler.
- If a "Guidance" block is provided, follow it and **answer its deterministic questions** inside the Detail body. If it includes an "Output Override", apply that override in place of the Detail structure above.
```

---

## 2. USER PROMPT

```text
Section: Sales Trend
Page: Sales
Date Range: 2025-08-01 to 2025-10-31
Generated: 2026-05-09 14:08

Guidance:
"""
Answer these questions in order:
1. Is net sales up or down vs last month and vs same month last year?
2. What's the month-over-month growth rate?

Lean into: direction (MoM and YoY), seasonality vs structural change, and any single month that breaks the run.
"""

---

Below is the ABOUT and RAW DATA for each component in this section. ABOUT
describes the component's role in the dashboard and is the authority on good /
neutral / bad. RAW DATA is what the dashboard shows the user. Every number you
cite must be traceable to a specific line in a Raw Data block or a tool-call
result.

### Component 1: Sales Summary (kpi)

About:
"""
"Sales Summary" KPI — Net Sales and its breakdown into Invoice Sales, Cash Sales, Credit Notes.

Formula: Net Sales = Invoice Sales + Cash Sales − Credit Notes.

Evaluate:
- Net Sales level vs business scale
- Invoice vs Cash mix: invoice ≥90% of net is normal for credit-customer distribution; falling ratio = shift to cash/retail or loss of credit customers
- Cash share: higher = lower credit risk and faster cash flow, but may signal smaller/retail buyers

Credit-note ratio (CN / gross sales):
- ≤1% = Good (normal returns)
- 1–3% = Monitor
- >3% = Concern (quality / accuracy issue)

Cover all four lenses.
"""

Raw Data:
Scope: PERIOD-BASED — activity within 2025-08-01 to 2025-10-31 only.

Net Sales: RM 22,216,737.11
Breakdown:
- Invoice Sales: RM 21,598,460.83 (97.2% of net)
- Cash Sales: RM 911,643.42 (4.1% of net)
- Credit Notes: -RM 293,367.14 (1.30% of gross sales)

### Component 2: Net Sales Trend (chart)

About:
"""
"Net Sales Trend" stacked bar chart — Invoice Sales + Cash Sales (positive stack), Credit Notes (negative). Combined height = Net Sales. Granularity: Daily / Weekly / Monthly.

Thresholds:
- 3+ consecutive months of growth = Good
- Flat / mixed = Neutral
- 3+ consecutive months of decline = Bad
- Any spike or drop >20% vs period average = flag for summary

Look for: festive / seasonal spikes, unusual credit-note months, cash-vs-invoice mix shift over time.
"""

Raw Data:
Scope: PERIOD-BASED — activity within 2025-08-01 to 2025-10-31 only.

Data points:
| Month | Invoice Sales | Cash Sales | Credit Notes | Net Sales |
|-------|-------------|-----------|-------------|----------|
| 2025-08 | RM 7,216,878.5 | RM 327,360.38 | -RM 91,344.9 | RM 7,452,893.98 |
| 2025-09 | RM 6,953,711.41 | RM 285,467.75 | -RM 75,715.17 | RM 7,163,463.99 |
| 2025-10 | RM 7,427,870.92 | RM 298,815.29 | -RM 126,307.07 | RM 7,600,379.14 |

---

Produce the summary now using the ===INSIGHT=== delimiter format.
```

---

## 3. Model response (first attempt, 2 insights produced)

The model issued 4 tool calls (querying `pc_sales_daily` for July 2025 and Aug–Oct 2024 daily rows to compute MoM/YoY context not present in the raw data) before emitting the delimiter blocks below.

```text
===INSIGHT===
sentiment: good
title: Oct rebound lifts quarter to RM 22.2M
metric: RM 22,216,737
summary: Net sales recovered +6.1% MoM in Oct after a Sep dip, ending the quarter strong.
---DETAIL---
**Current Status:** Net sales for Aug–Oct 2025 totalled RM 22.2M, with October closing at RM 7.60M — the quarter's high point after a mid-period softening.

**Key Observations:**
- **Sep dip, not a trend:** August opened at RM 7.45M, dipped −3.9% to RM 7.16M in September, then rebounded +6.1% to RM 7.60M in October — a V-shape, not a structural decline.
- **October YoY surge:** Oct 2025 (RM 7.60M) was +29.4% above Oct 2024 (≈RM 5.87M), the strongest year-on-year gain of the three months and well above the period average of RM 7.41M.
- **August YoY lag:** Aug 2025 (RM 7.45M) trailed Aug 2024 (≈RM 8.09M) by −7.9%, partly due to an outsized Aug 2024 single-day spike (RM 996K on 29 Aug 2024) that inflated the prior-year base.

**Evidence:**

| Month | Net Sales | MoM Δ | YoY Δ |
|-------|-----------|--------|--------|
| Aug 2025 | RM 7,452,894 | −0.2% vs Jul | −7.9% vs Aug 2024 |
| Sep 2025 | RM 7,163,464 | −3.9% | +4.8% vs Sep 2024 |
| Oct 2025 | RM 7,600,379 | +6.1% | +29.4% vs Oct 2024 |

**Implication:** The Sep dip followed by a strong Oct recovery suggests seasonal softness rather than structural erosion; however, the Aug YoY gap warrants monitoring to confirm the Aug 2024 spike was a one-off event and not a lost volume.
===END===

===INSIGHT===
sentiment: bad
title: August YoY down 7.9% on high 2024 base
metric: −7.9% YoY Aug
summary: Aug 2025 trailed Aug 2024 by RM 642K, weighed by a RM 996K single-day anomaly in the prior year.
---DETAIL---
**Current Status:** August 2025 net sales of RM 7.45M fell short of August 2024's RM 8.09M by approximately RM 642K (−7.9% YoY).

**Key Observations:**
- **Base effect distortion:** A single day — 29 Aug 2024 — recorded RM 996,396 in net revenue, nearly 3× a normal trading day, inflating the Aug 2024 base and making 2025 appear weaker by comparison.
- **Cash sales mix declining YoY:** Aug 2024 daily rows show frequent cash-day totals of RM 35K–69K; Aug 2025 cash sales averaged RM 327K for the full month (≈RM 10.5K/day), suggesting smaller or fewer cash buyers in 2025.
- **Credit notes elevated in Oct:** October's CN of RM 126,307 is 67% higher than August's RM 91,345, lifting the quarter's CN ratio to 1.30% of gross — in the "Monitor" band.

**Root Cause:**

| Factor | Impact |
|--------|--------|
| Aug 2024 single-day spike (RM 996K) | Inflates prior-year base |
| Cash sales contraction 2024→2025 | Reduces low-ticket volume |
| Oct 2025 CN spike (RM 126K) | Offsets gross revenue gains |

**Implication:** The director must determine whether the 29 Aug 2024 spike was a genuine bulk order (and thus a repeatable opportunity missed in 2025) or a timing/accrual anomaly — the answer changes whether the YoY gap signals a real volume loss.
===END===
```

> Numeric Guard flagged 7 unmatched figures on this attempt (the YoY base numbers `RM 8,094,831`, `RM 5,873,834` etc. were derived by Sonnet from tool-call rows, not present in any raw-data block). Orchestrator triggered a retry — a normal retry, not a failure of the prompt.

---

## What changed since this morning

| Element | Change |
|---|---|
| `Guidance:` wrapper label | (was `General`) restored back to **Guidance** so the LLM knows the role of this block |
| Q&A inside Guidance body | Restored — every section now starts with `Answer these questions in order: 1…2…3…` followed by `Lean into: …` |
| `About:` per-component label | Renamed from `Rubric` → **About** |
| Intro paragraph | "Below is the ABOUT and RAW DATA for each component …" |
| `DEFAULT_SUMMARY_SYSTEM` line | "If a 'Guidance' block is provided, follow it and **answer its deterministic questions** inside the Detail body…" |
