# Phase 1 — Baseline (RE-CAPTURED): payment_outstanding

> Captured: 2026-04-28 | Snapshot: 2026-04-23 | 3 fresh runs after RDS migration
> Full logs: `baseline_run1_full_log.log`, `baseline_run2_full_log.log`, `baseline_run3_full_log.log`

> ⚠️ **CHANGED SINCE FIRST CAPTURE (2026-04-18):** The codebase was refactored between sessions:
> - Commit `6facecf` — trimmed GLOBAL_SYSTEM, moved component prompt to user message
> - Commit `7a11d31` — simplified summary prompt, raised tool cap from 2 → 4, cut detail to 150 words
> - RDS server migrated from `main` to `main-restored`. Snapshot date moved 2026-04-05 → 2026-04-23. Row count, total RM, and breach count UNCHANGED.

---

## Architecture (What Happens When You Click "Analyze")

```
Click "Analyze" → ~11 API calls total
│
├─ Step 1: 6 × Haiku calls (parallel, max 2 at a time, NO tools)
│   System prompt (~200 tok, trimmed) + USER prompt with component instructions + data
│   Each outputs: ~150-word narrative
│
└─ Step 2: 1 × Sonnet summary (WITH tools, up to 4 tool calls)
    ├─ Turn 1: Sonnet reads raw data → requests 2 tool calls (BOTH FAIL with column errors)
    ├─ Turn 2: Sonnet retries with corrected column names → 2 more tool calls (SUCCESS)
    ├─ Turn 3: Sonnet writes 3 insights (===INSIGHT===)
    ├─ Numeric Guard: FAILS (23 unmatched) → retry
    └─ Turn 4: Sonnet rewrites → guard FAILS again (18 unmatched) → proceeds
```

---

## Step 1: Component Analyses (6 × Haiku) — Run 1

### NEW Trimmed GLOBAL_SYSTEM (~200 tokens, sent 6 times)

```
You are a senior financial analyst at Hoi-Yong (Malaysian fruit distribution). 
You explain dashboard metrics to a senior director.

Rules:
- Be direct, concise, no jargon. State facts, not recommendations.
- Use RM with thousands separators (e.g., RM 5,841,378).
- Bullet points for observations. Markdown tables for comparisons.
- Compare at least 3 data points for trends.
- If data is insufficient, say so.
- Keep analysis under 150 words.
- Do NOT re-derive totals. Use values as given.
- Every number you cite MUST appear in the data block. Display rounding OK 
  (e.g., RM 2,286,847 → RM 2.29M). Never back-solve or invent values.
- Match your language to the Scope line in the data (period vs snapshot vs fiscal).
```

> **Old prompt was ~800 tokens with verbose scope discipline + verbatim-copy + self-verification sections. Now ~200 tokens.**

### Component USER prompts now contain the per-component instructions + data

Example (Total Outstanding):
```
You are analyzing the "Total Outstanding" KPI.

What it measures: The total amount currently owed by all customers...
This is a snapshot metric...
There is no fixed threshold...
Provide a concise analysis of this metric.

Section: Outstanding Payment
Component: Total Outstanding (kpi)
Scope: Snapshot — current state

Current Values:
Scope: SNAPSHOT — current state as of 2026-04-23.

Value: RM 11,349,862.52

Top 5 contributors (48.4% of total):
| Rank | Customer                      | Outstanding    | % of Total |
|------|-------------------------------|----------------|------------|
| 1    | MY HERO HYPERMARKET SDN BHD   | RM 2,112,369.4 | 18.6%      |
| 2    | MLF TRADING SDN BHD           | RM 1,137,069   | 10.0%      |
| 3    | WONDERFRUITS & VEGETABLES...  | RM 1,079,871.1 | 9.5%       |
| 4    | LO SIEW LIN SDN BHD           | RM 807,239.1   | 7.1%       |
| 5    | SEASONS AGRO SDN BHD          | RM 351,476     | 3.1%       |
```

### Component Run 1 Results

| Component | Input | Output | Cost | Time |
|-----------|-------|--------|------|------|
| total_outstanding | 590 | 233 | $0.0014 | 0.5s |
| overdue_amount | 673 | 275 | $0.0016 | 3.5s |
| credit_limit_breaches | 863 | 233 | $0.0016 | 5.9s |
| aging_analysis | 541 | 190 | $0.0012 | 1.2s |
| credit_usage_distribution | 497 | 232 | $0.0013 | 2.8s |
| customer_credit_health | 1,367 | 446 | $0.0029 | 2.4s |
| **TOTAL COMPONENTS** | **4,531** | **1,609** | **$0.0100** | **~12s** |

> **Was 9,962 input tokens / $0.015 in old baseline. Now 4,531 / $0.010 — 55% input reduction from prompt trimming.**

---

## Step 2: Sonnet Summary — Run 1

### NEW Trimmed Summary System Prompt (~600 tokens, was ~1,700)

Key rules:
- Max 4 tool calls (was 2 — INCREASED)
- Output max 150 words per detail (was 220-320)
- "Use tools for both positive and negative findings" (was: only negatives)

### Sonnet Conversation — 4 Turns Total

#### TURN 1 — Initial request + 2 tool calls

**Tokens:** input=4,488 | output=312 | **cost=$0.018** | stop_reason=`tool_use`

Sonnet reasoning: *"I'll investigate aging trends and high-risk customer details to find root causes."*

**Tool Call #1A** — `query_local_table`:
```json
{
  "table": "pc_ar_aging_history",
  "columns": ["snapshot_date", "bucket", "amount", "invoice_count"],
  "order_by": "snapshot_date DESC",
  "limit": 20
}
```
**Result:** ❌ `Columns not allowed for pc_ar_aging_history: amount. Allowed: snapshot_date, bucket, dimension, dimension_key, invoice_count, total_outstanding`

**Tool Call #1B** — `query_local_table`:
```json
{
  "table": "pc_ar_customer_snapshot",
  "columns": ["customer_name", "outstanding_amount", "overdue_amount",
              "overdue_days", "credit_limit", "utilization_pct"],
  "where_clause": "risk_tier = 'High'",
  "order_by": "outstanding_amount DESC",
  "limit": 10
}
```
**Result:** ❌ `Columns not allowed for pc_ar_customer_snapshot: customer_name, outstanding_amount, overdue_days. Allowed: debtor_code, company_name, debtor_type, sales_agent, display_term, credit_limit, total_outstanding, overdue_amount, utilization_pct, credit_score, risk_tier, is_active, invoice_count, avg_payment_days, max_overdue_days`

> **PROBLEM:** Sonnet doesn't know the schema. The system prompt lists table names but not column names. Both tool calls FAIL.

#### TURN 2 — Sonnet retries with corrected columns (4 tool calls used now)

**Tokens:** input=5,002 | output=315 | **cost=$0.020** | stop_reason=`tool_use`

**Tool Call #2A** — Corrected `pc_ar_aging_history`:
```json
{
  "table": "pc_ar_aging_history",
  "columns": ["snapshot_date", "bucket", "dimension", "invoice_count", "total_outstanding"],
  "order_by": "snapshot_date DESC", "limit": 20
}
```
**Result:** ✅ 20 rows of agent + customer-type breakdown:
```
| snapshot_date | bucket | dimension          | invoice_count | total_outstanding |
| 2026-04-23    | 120+   | agent:Yuki         | 969           | 2774067.69        |
| 2026-04-23    | 120+   | agent:Vincent      | 945           | 3059752.80        |
| 2026-04-23    | 120+   | agent:Caelen       | 378           | 3721296.25        |
| 2026-04-23    | 120+   | agent:Hao          | 88            | 1122915.54        |
| 2026-04-23    | 120+   | agent:Huat         | 549           | 454259.96         |
| ... (15 more rows) ...
| 2026-04-23    | 120+   | type:Supermarket   | 1138          | 5201897.62        |
| 2026-04-23    | 120+   | type:Wholesaler    | 791           | 4269135.02        |
```

**Tool Call #2B** — Corrected `pc_ar_customer_snapshot`:
```json
{
  "table": "pc_ar_customer_snapshot",
  "columns": ["company_name", "credit_limit", "total_outstanding", "overdue_amount",
              "utilization_pct", "credit_score", "risk_tier", "max_overdue_days", "avg_payment_days"],
  "where_clause": "risk_tier = 'High'", "order_by": "total_outstanding DESC", "limit": 10
}
```
**Result:** ✅ 10 rows of High risk customers with avg_payment_days, max_overdue_days, utilization_pct:
```
| company_name             | credit_limit | total_outstanding | utilization_pct | credit_score | max_overdue_days | avg_payment_days |
| MY HERO HYPERMARKET      | 1300000.00   | 2112369.40        | 162.49          | 20.00        | 440              | 20.66            |
| MLF TRADING              | 600000.00    | 1137069.00        | 189.51          | 18.00        | 203              | 54.13            |
| LO SIEW LIN              | 1000000.00   | 807239.10         | 80.72           | 21.00        | 237              | 85.86            |
| T & T FRESH              | 100000.00    | 246369.06         | 246.37          | 4.00         | 193              | 46.13            |
| SECRET RECIPE MFG        | 100000.00    | 238380.00         | 238.38          | 8.00         | 202              | 53.08            |
| ... (5 more rows) ...
```

> **PROBLEM:** Tool call #2B duplicates much of the `customer_credit_health` component data (top 5 by outstanding is already in raw data). Only NEW columns: `avg_payment_days`, `utilization_pct`.

#### TURN 3 — Sonnet generates 3 insights

**Tokens:** input=5,360 | output=1,634 | **cost=$0.041** | stop_reason=`end_turn`

Insights produced:
1. **"Entire AR Book Aged 120+ Days"** — RM 11,349,862. Cites agent breakdown (Caelen RM 3,721,296.25 / 378 invoices, Vincent RM 3,059,752.80 / 945 invoices, Yuki RM 2,774,067.69 / 969 invoices) and customer-type split (Supermarket RM 5,201,897.62, Wholesaler RM 4,269,135.02). All from tool result.
2. **"29 High-Risk Customers Hold 58% of AR"** — RM 6,587,823. Cites avg_payment_days (20.7, 85.9), utilization (162.49%, 189.51%) — all from tool result.
3. **"21 Customers Breaching Credit Limits"** — Cites 1,172%, 594%, 264%, 251%, 246% utilization — all from raw data Component 3.

#### NUMERIC GUARD — Attempt 1: ❌ FAILED (23 unmatched)

```
"120 days"           ← Sonnet referencing the bucket name "120+ days"
"376 invoices"       ← typo (Sonnet wrote 376 vs raw data 3,376)
"RM 3,721,296"       ← from tool result (Caelen agent total)
"RM 3,059,753"       ← from tool result (Vincent agent total)
"RM 2,774,068"       ← from tool result (Yuki agent total)
"RM 9,471,033"       ← Sonnet COMPUTED (Caelen+Vincent+Yuki sum)
"190%"               ← rounded utilization 189.51%
"193 days"           ← from tool result (T&T FRESH max_overdue_days)
"246%"               ← from tool result (T&T utilization)
"202 days"           ← from tool result (SECRET RECIPE max_overdue_days)
"RM 9.56M"           ← Sonnet COMPUTED rounded sum
"RM 6,587"           ← truncated/parser error from "RM 6,587,823"
"20.7 days"          ← from tool result (MY HERO avg_payment_days, rounded)
"85.9 days"          ← from tool result (LO SIEW LIN avg_payment_days, rounded)
"172%"               ← WRONG (MY HERO is 162.49% — Sonnet misread)
"196%"               ← from raw data Component 3 (PHOENIX utilization)
"172%" (×2 more)     ← repeated wrong value
"594%"               ← from raw data (CS 88 FRUITS) — guard fails to match
"251%"               ← from raw data (ST ROSYAM)
"246%"               ← from raw data (T&T FRESH)
```

**Three categories of failures:**
- **Tool result citations** (10 numbers): valid data but guard whitelist regex doesn't match these formats
- **Sonnet computed values** (3 numbers): RM 9,471,033, RM 9.56M — actual hallucinations
- **Display rounding** (5 numbers): 190%, 20.7 days, 85.9 days — should be allowed but guard doesn't recognize rounding from tool data

#### TURN 4 — Guard retry (Sonnet rewrites)

**Tokens:** input=8,910 | output=1,651 | **cost=$0.051** | stop_reason=`end_turn`

Sonnet rewrote the 3 insights but kept many tool-result citations. Examples of revised insights:

**Insight #1 (rewritten):** "Entire AR Book Aged 120+ Days"
> *"By agent, Caelen carries RM 3,721,296.25 (378 invoices), Vincent carries RM 3,059,752.80 (945 invoices), and Yuki carries RM 2,774,067.69 (969 invoices)."*

**Insight #2 (rewritten):** "29 High-Risk Customers Hold 58% of AR"
> *"MY HERO carries a utilization of 162.49% against a RM 1,300,000 credit limit; MLF TRADING sits at 189.51% against a RM 600,000 limit."*

#### NUMERIC GUARD — Attempt 2: ❌ FAILED (18 unmatched)

```
"376 invoices" (×2)             ← still wrong
"RM 3,721,296.25"                ← Caelen total from tool result
"378 invoices"                   ← Caelen invoice count from tool result
"RM 3,059,752.80"                ← Vincent total
"945 invoices"                   ← Vincent count
"RM 2,774,067.69"                ← Yuki total
"969 invoices"                   ← Yuki count
"RM 5,201,897.62"                ← Supermarket type total
"RM 1,300,000"                   ← MY HERO credit limit (tool result)
"RM 600,000"                     ← MLF TRADING credit limit (tool result)
"172%" (×3)                      ← still wrong
"594%" (×2)                      ← from raw data, guard can't match
"251%"                           ← from raw data
"246%"                           ← from raw data
```

After 2 failed attempts, system saves the output and shows it to user.

---

## Final Output (User-Visible) — Run 1

3 negative insights, 0 positive:

### Insight 1: "Entire AR Book Aged 120+ Days" (bad)
- Metric: RM 11,349,862
- Summary: "All 3,376 invoices sit in the 120+ day bucket — zero current receivables."
- Detail: Names top 3 customers + agent breakdown (Caelen, Vincent, Yuki) + Supermarket vs Wholesaler split.

### Insight 2: "29 High-Risk Customers Hold 58% of AR" (bad)
- Metric: RM 6,587,822.96
- Summary: "Just 8% of customers account for over half of total outstanding balance."
- Detail: Top 5 high-risk customers with credit scores + utilization %.

### Insight 3: "21 Customers Breaching Credit Limits" (bad)
- Metric: 21 customers
- Summary: "Breaches reach up to 1,172% utilization, signalling enforcement breakdown."
- Detail: Top 5 breachers with credit limit, outstanding, utilization, risk tier.

---

## Metrics Summary — All 3 Runs

### Per-Run Totals

| Metric | Run 1 | Run 2 | Run 3 | Median |
|--------|-------|-------|-------|--------|
| Total tokens | 33,812 | 33,288 | 34,758 | **33,812** |
| Estimated cost | $0.140 | $0.141 | $0.149 | **$0.141** |
| End-to-end latency | 86s | 71s | 95s | **86s** |
| API calls (Haiku + Sonnet) | 6 + 5 = 11 | 6 + 5 = 11 | 6 + 5 = 11 | **11** |
| Sonnet tool calls (raised cap to 4) | 4 | 4 | 4 | **4** |
| Failed tool calls (column errors) | 2 | 2 | 2 | **2** |
| Guard attempts | 2 | 2 | 2 | **2** |
| Guard passed | No | No | No | **No** |
| Guard unmatched (attempt 1) | 23 | 16 | 29 | **23** |
| Guard unmatched (attempt 2) | 18 | 16 | 23 | **18** |
| Cache hit rate | 0% | 0% | 0% | **0%** |

### Sonnet Summary Cost Breakdown (Run 1)

| Turn | Purpose | In→Out tokens | Cost |
|------|---------|---------------|------|
| 1 | Initial + 2 tool calls (BOTH FAILED — column errors) | 4,488 → 312 | $0.018 |
| 2 | Retry tool calls with correct columns (succeeded) | 5,002 → 315 | $0.020 |
| 3 | Generate insights | 5,360 → 1,634 | $0.041 |
| 4 | Guard retry (rewrite) | 8,910 → 1,651 | $0.051 |
| **TOTAL Sonnet** | | **23,760 → 3,912** | **$0.130** |

### Cost Breakdown (Run 1)

```
Total: $0.140 per click
├── Components (6× Haiku):  $0.010  ██ (7.1%)
└── Summary (Sonnet):       $0.130  ████████████████████████████████████ (92.9%)
    ├── Turn 1 (failed tools):       $0.018  ███   ← WASTED on schema errors
    ├── Turn 2 (retry tools):        $0.020  ████
    ├── Turn 3 (generate insight):   $0.041  ████████
    └── Turn 4 (guard retry):        $0.051  ██████████  ← WASTED, guard still fails
```

---

## Comparison: Old Baseline (2026-04-18) vs New Baseline (2026-04-28)

| Metric | OLD ($0.173/click) | NEW ($0.141/click) | Change |
|--------|--------|--------|--------|
| Total tokens | 43,749 | 33,812 | **−23%** |
| Cost per click | $0.173 | $0.141 | **−18%** |
| Component input tokens | 9,962 | 4,531 | **−55%** (prompt trim) |
| Component output tokens | 1,670 | 1,609 | similar |
| Sonnet API calls | 4 (1 tool turn + 1 generate + 2 guard retries) | 5 (2 tool turns + 1 generate + 1 guard retry) | +1 (raised tool cap) |
| Tool calls made | 2 | 4 (2 failed) | +2 |
| Guard always fails | Yes (27 → 14) | Yes (23 → 18) | unchanged |
| Latency | 113s | 86s | −24% |

> **What helped:** Trimmed component prompts saved ~5,400 tokens.
> **What hurt:** Raised tool cap to 4 added 1 Sonnet turn ($0.020) due to schema errors.
> **What didn't change:** Guard still always fails. Sonnet still hallucinates computed sums. No prompt caching.

---

## Discrepancy Analysis (Run 1, Guard Attempt 1 — 23 unmatched)

| Type | Count | Example | Real Issue |
|------|-------|---------|------------|
| Tool-result data not whitelisted | 10 | `RM 3,721,296` (Caelen total), `20.7 days` (avg_payment_days) | Whitelist regex doesn't catch tool-result formatting |
| Sonnet COMPUTED sums (hallucination) | 2 | `RM 9,471,033` (sum of 3 agents), `RM 9.56M` (rounded) | Sonnet did arithmetic — forbidden by ground-truth rule |
| Display rounding from raw data | 6 | `594%`, `251%`, `246%` | Whitelist has these but format mismatch |
| Wrong values (clear hallucination) | 2 | `172%` (MY HERO is 162.49%, not 172%), `376 invoices` (should be 3,376) | Misread or miscopied |
| Bucket label confusion | 1 | `120 days` | Sonnet wrote "120 days" referring to bucket "120+" |
| Parser truncation | 2 | `RM 6,587` (from "RM 6,587,823") | Guard's regex only captured first comma group |

---

## Quality Score — Run 1

| Sub-score | Score | Notes |
|-----------|-------|-------|
| Numeric Accuracy | 2/3 | "172%" is wrong (should be 162.49%). 18 numbers still flagged after 2 guard retries. Tool-result citations (Caelen agent total etc.) ARE accurate but unauditable. |
| Relevance | 3/3 | All 3 insights address most important findings. Correctly all "bad". |
| Actionability | 2/2 | Names specific customers, agents (Caelen, Vincent, Yuki), and amounts. Director knows who to call. |
| Clarity | 2/2 | Well-structured. Detail under 150-word limit. Tables included. |
| **TOTAL** | **9/10** | |

---

## Key Findings for Improvement (Updated)

1. **Schema-error tool calls cost $0.018 every run.** Sonnet doesn't know column names — uses `customer_name`, `outstanding_amount`, `overdue_days` instead of `company_name`, `total_outstanding`, `max_overdue_days`. Need to add column reference inside the system prompt OR pre-validate tool inputs.

2. **Raising tool cap from 2→4 hurt cost.** Now Sonnet uses all 4 tool calls. The extra 2 tool calls (Turn 2) added ~$0.020 per run with no quality gain — the new data (agent breakdown, avg_payment_days) is what causes guard failures.

3. **Guard never passes (still).** 23→18 unmatched. The retry costs $0.051 and doesn't help — Sonnet keeps citing tool-result values that aren't pre-whitelisted.

4. **Sonnet still does forbidden arithmetic** ("RM 9,471,033" = sum of 3 agent totals; "RM 9.56M" = rounded version).

5. **Tool calls duplicate raw data** — Tool #2B (high-risk customers) overlaps with `customer_credit_health` component data. Only `avg_payment_days` is genuinely new.

6. **Component prompt trim was a clear win** (−55% input tokens, no quality loss).

---

## Updated Improvement Priorities

| # | Action | Expected Saving | Risk |
|---|--------|----------------|------|
| 1 | **Drop tool cap back to 2 (or 0)** — extra calls just hallucinate more | $0.020 per run | Low |
| 2 | **Pre-fetch agent + customer-type aging breakdown** into Aging Analysis component data — eliminate the one valuable tool call | $0.040 per run | Low |
| 3 | **Add `avg_payment_days` to customer_credit_health component data** — eliminates tool call #2B reason to exist | $0.020 per run | Low |
| 4 | **Set tool policy to 'none' once data is pre-fetched** | Eliminates Turns 1+2 ($0.038) | Medium — verify quality |
| 5 | **Fix numeric guard whitelist** (handle rounding, tool-result formats) — stops always-fail retry | $0.051 per run | Low |
| 6 | **Enable prompt caching** on summary system prompt (~600 tok × 5 turns = 3,000 cacheable tokens) | ~$0.005 | Low |
| 7 | **Switch summary to Haiku** once tools are removed and task is simplified | ~$0.080 (−80% summary cost) | High — verify quality |

**Projected after all improvements:** $0.141 → ~$0.025 per click (**−82%**)
