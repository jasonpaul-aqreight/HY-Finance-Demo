# Phase 2 — Analysis & Improvement Plan (UPDATED 2026-04-28, v2)

> Re-ordered: tool reduction is now the LAST iteration. Build confidence with low-risk fixes first.

---

## Baseline Quality Score

| Run | Numeric Accuracy | Relevance | Actionability | Clarity | TOTAL | Hallucinations |
|-----|------------------|-----------|----------------|----------|-------|----------------|
| 1 | 2/3 | 3/3 | 2/2 | 2/2 | 9/10 | 2 |
| 2 | 2/3 | 3/3 | 2/2 | 2/2 | 9/10 | 1 |
| 3 | 1/3 | 3/3 | 2/2 | 2/2 | 8/10 | 2 |
| **Median** | **2/3** | **3/3** | **2/2** | **2/2** | **9/10** | **~2** |

**Recurring issues:**
- "172%" appears in all 3 runs (MY HERO real value is 162.49%) — misread/typo
- Sonnet computes sums then writes them as if from data (`RM 9,471,033`, `RM 9.56M`)
- Guard always rejects valid tool-result citations because of format mismatch

---

## Improvement Plan — Re-ordered (Low Risk → High Risk)

### Iteration 1: Fix Numeric Guard Whitelist

**What:** Investigate why guard rejects values that ARE in raw data (594%, 251%, 246%) and tool results (RM 3,721,296, 20.7 days). Likely: regex/format mismatch in `numeric-guard.ts`. Add tool-result values to the whitelist properly.

**Why first:** Guard always fails → costs $0.051/run on retry that doesn't help. Biggest single win. No architecture change.

**Saving:** $0.051 → cost: $0.090 | **Risk:** Low | **Effort:** ~2h debug + fix

---

### Iteration 2: Add Column-Schema Hint to Summary System Prompt

**What:** Add a one-line column reference per allowed table inside the summary system prompt.

**Why:** 2 of 4 tool calls fail every run with errors like `Columns not allowed: customer_name`. Sonnet wastes Turn 1 ($0.018) trying invalid columns.

**Saving:** $0.018 → cost: $0.072 | **Risk:** Low (adds ~150 tok to system prompt) | **Effort:** 30min

---

### Iteration 3: Drop Tool Cap from 4 → 2

**What:** In `orchestrator.ts`, change `MAX_TOOL_CALLS_PER_SUMMARY` back to 2.

**Why:** Cap was raised in commit `7a11d31`. Sonnet now uses all 4 — extra tool calls in Turn 2 add $0.020 with no quality benefit.

**Saving:** $0.020 → cost: $0.052 | **Risk:** Low | **Effort:** 1 line

---

### Iteration 4: Pre-compute Subtotals + Strengthen No-Arithmetic Rule

**What:** Add pre-calculated subtotals to data blocks (top-3 sum, top-5 sum, top-N share). Strengthen system prompt: "Do NOT add or subtract numbers. If you want a sum, copy the pre-calculated subtotal line — never compute your own."

**Why:** Sonnet computes hallucinations like `RM 9,471,033` = sum of 3 agent totals. Removing the temptation by pre-computing what it wants kills 2 hallucinations per run.

**Saving:** Marginal cost ($0.002) but **quality goes 9/10 → 10/10** | **Risk:** Low | **Effort:** 1h (data-fetcher.ts + prompts.ts)

---

### Iteration 5: Enable Prompt Caching

**What:** Add `cache_control: { type: "ephemeral" }` to system prompt blocks for both Haiku component calls and Sonnet summary.

**Why:** After Iter 1-4 the prompt structure is stable. Haiku GLOBAL_SYSTEM (~200 tok) sent 6×; Sonnet system (~600 tok) sent 2-3×.

**Saving:** ~$0.007 → cost: $0.043 | **Risk:** Low | **Effort:** 1h

---

### Iteration 6: Combine 6 Haiku Component Calls → 1 Call (Tech Lead Tip #5)

**What:** Single Haiku call with all 6 components' data. Structured JSON output keyed by component_key. Parse the JSON and distribute to each component's `analysis_md`.

**Why:** Reduces 6 API calls → 1. System prompt sent once. Less per-call overhead.

**Saving:** ~$0.008 → cost: $0.035 | **Risk:** Medium — must verify per-component quality holds | **Effort:** 3h (orchestrator.ts + prompts.ts)

---

### Iteration 7: Pre-fetch Agent/Type Breakdown + avg_payment_days

**What:** Expand `aging_analysis` data fetcher to include the by-agent and by-type breakdown. Expand `customer_credit_health` to include `avg_payment_days` and `utilization_pct` columns in top-5 tables.

**Why:** This is what Sonnet's tool calls actually retrieve. Pre-fetching it gives Sonnet the same data without needing tools — making Iteration 9 safe to ship.

**Saving:** ~$0.003 (Sonnet uses fewer tool calls naturally) → cost: $0.032 | **Risk:** Low | **Effort:** 2h (data-fetcher.ts SQL + prompt formatting)

---

### Iteration 8: Switch Summary Model from Sonnet → Haiku

**What:** Change `SUMMARY_MODEL` to `claude-haiku-4-5-20251001`.

**Why:** After Iter 1-7, the summary task is simplified: "synthesize pre-fetched data, follow ===INSIGHT=== format, no arithmetic, optional tools." This is Haiku-feasible.

**Saving:** ~$0.020 (Haiku is 3.75× cheaper than Sonnet) → cost: $0.012 | **Risk:** Medium-High — measure quality. If quality < 8/10, revert to Sonnet but keep all other gains.

---

### Iteration 9 (LAST): Reduce / Eliminate Tool Calls

**What:** Set `payment_outstanding` tool policy from `'full'` to `'none'`. Sonnet/Haiku must rely on pre-fetched data only.

**Why LAST:** Highest architectural risk. Removing tools eliminates the drill-down capability. Only safe AFTER Iter 7 has pre-fetched everything Sonnet would query AND quality has been verified at every prior step. If we did this first, we'd lose ability to attribute regressions.

**Saving:** ~$0.002 + cleaner audit trail → cost: $0.010 | **Risk:** Medium | **Effort:** 1 line + extensive quality test

---

## Projected Cost & Quality Trajectory

| Iter | Change | Cost | vs Baseline | Quality (target) |
|------|--------|------|-------------|------------------|
| **0 (now)** | Baseline | $0.141 | — | 9/10 |
| 1 | Fix guard | $0.090 | −36% | 9/10 |
| 2 | Schema hint | $0.072 | −49% | 9/10 |
| 3 | Tool cap → 2 | $0.052 | −63% | 9/10 |
| 4 | Pre-sum + no-arith | $0.050 | −65% | **10/10** |
| 5 | Prompt caching | $0.043 | −70% | 10/10 |
| 6 | Combine components | $0.035 | −75% | 10/10 (target) |
| 7 | Pre-fetch tool data | $0.032 | −77% | 10/10 |
| 8 | Haiku summary | $0.012 | −91% | ≥8/10 (target) |
| 9 | Tools off | $0.010 | **−93%** | ≥8/10 |

---

## Stop Criteria (Per Iteration)

- Quality score < 7/10 → revert
- Hallucination count > 2 → revert  
- Numeric accuracy < 2/3 → revert
- Iteration savings < $0.005 → mark "tested, no value" and skip

Each iteration = code change → 2 runs → quality score on each run → log in `03_iteration_NN_<name>.md` → keep/revert decision.

(Reduced from 3 → 2 runs per iteration to limit token spend during the study. If results between Run 1 and Run 2 diverge significantly, add a Run 3 for that iteration only.)

---

## Tech Lead Tips — Status

| Tip | Status |
|-----|--------|
| #1 Split prompts (system + user) | ✅ Done (commit 6facecf) |
| #2 Eliminate tooling | Iteration 9 (last) |
| #3 Reduce API calls | Iterations 3, 6, 8 |
| #4 JSON I/O format | Considered for Iter 6 (combined components) |
| #5 Combine 6 component calls → 1 | Iteration 6 |
