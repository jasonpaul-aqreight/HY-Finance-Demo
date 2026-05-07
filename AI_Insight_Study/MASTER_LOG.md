# AI Insight Optimization — Master Log

> **This file is the single source of truth.** Read this first in every session.
> Updated after each iteration completes. Never delete rows — keep failed/reverted attempts as history.

**Pilot section:** `financial_variance` (switched 2026-05-07 from `payment_outstanding`)
**Runs per iteration:** 2 (baseline AND iteration runs)
**Eval set (current pilot):** `eval_set/financial_variance/snapshot_state.md` + `expected_values.json`
**Eval set (former pilot, retained):** `eval_set/snapshot_state.md` + `expected_values.json` (payment_outstanding)
**Quality rubric:** `eval_set/quality_rubric.md` (max 10) — shared across pilots
**Procedure:** `HOW_TO_RUN_ITERATION.md`

---

## Current State

**Active pilot:** `financial_variance` (Financial page)
**Baseline (financial_variance, fresh 2026-05-07):** $0.1494 / 9/10 quality / ~2 mild hallucinations per run (computed ratios). Details: `01_baseline_financial_variance.md`.
**Former pilot (`payment_outstanding`) end-state:** $0.134 / 10/10 / 0 hallucinations after Iter 1. Frozen — no further iterations planned on this section since it hit a quality ceiling.

---

## Iteration Results Table

### `payment_outstanding` (former pilot — frozen 2026-05-07 at quality ceiling)

| #   | Iteration | Status | Cost ($/click) | Δ Cost | Quality | Hallucinations | Date | Notes |
|-----|-----------|--------|----------------|--------|---------|----------------|------|-------|
| 0   | Baseline (post-RDS migration, post-prompt-trim) | ✅ done | $0.141 | — | 9/10 | 2 | 2026-04-28 | See `01_baseline.md` |
| 1   | Fix numeric guard whitelist | ✅ done | $0.134 | −$0.007 (−5%) | 10/10 | 0 | 2026-04-28 | See `03_iteration_01_fix_guard.md`. Guard now passes (was always failing). Real hallucinations still caught. |
| 2   | Add column-schema hint to tool description (re-scoped from system prompt per user) | ❌ reverted | $0.169 | +$0.035 (+26%) | 10/10 | 0 | 2026-05-07 | See `03_iteration_02_schema_hint.md`. Eliminated `Columns not allowed` errors but +700-token bloat caused cost regression. Quality unchanged. |
| 9   | ~~Tool reduction (set policy to 'none')~~ | ❌ removed | — | — | — | — | 2026-05-07 | Removed — tools essential for drill-down evidence. |

### `financial_variance` (current pilot — baseline captured 2026-05-07)

| #   | Iteration | Status | Cost ($/click) | Δ Cost | Quality | Hallucinations | Date | Notes |
|-----|-----------|--------|----------------|--------|---------|----------------|------|-------|
| 0   | Baseline (financial_variance, post-Iter-1 codebase) | ✅ done | $0.1494 | — | 9/10 | ~2 (mild ratios) | 2026-05-07 | See `01_baseline_financial_variance.md`. Guard passes 0 unmatched, but 3 of 4 tool calls fail with "Columns not allowed" — wasted ~$0.057/run on retries. |
| 4   | Pre-compute subtotals + strengthen no-arithmetic rule | ⏸ deferred | — | — | — | — | 2026-05-07 | Spec: 02_analysis.md §Iter 4. Component prompts already include the no-arith rule; only mild ratio infractions slip through. Saving < $0.005, quality 9→10 ceiling — low ROI on this section. |
| 5   | Enable prompt caching | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 5 |
| 6   | Combine 4 Haiku component calls → 1 | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 6 (rescoped 6→4 components for this section) |
| 7   | Pre-fetch monthly P&L by category | ❌ reverted | $0.1546 | +$0.0052 (+3.5%) | 10/10 | 0 | 2026-05-07 | See `03_iteration_07_pre_fetch.md`. Spec assumption ("pre-fetch → fewer tool calls") was wrong: Sonnet still queries even when data is in block. Quality genuinely improved (9→10) with timing insights, but cost increased. User chose strict cost discipline — reverted. **Lesson:** pre-fetching is a quality lever, not a cost lever, until paired with explicit no-query instruction or `MAX_TOOL_CALLS` cap (Iter 3). |
| 8   | Switch summary model Sonnet → Haiku | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 8 |
| 3   | Drop MAX_TOOL_CALLS_PER_SUMMARY from 4 → 2 ⭐ LAST | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 3 |

**Status legend:** ✅ done · ❌ reverted · ⏸ skipped · ⏳ pending · 🔄 in progress

---

## Cumulative Trajectory

### `payment_outstanding` (former pilot — frozen)

```
Iter:    0       1       2 (reverted)
Cost:  $0.141  $0.134  $0.169✗
Qual:   9/10   10/10   10/10
```

### `financial_variance` (current pilot)

```
Iter:    0           7 (reverted)   5           6           4           8           3 (last)
Cost:  $0.1494     $0.1546✗        $___        $___        $___        $___        $___
Qual:   9/10       10/10           __/10       __/10       __/10       __/10       __/10
```

(Iter 7 reverted — cost +3.5% even though quality went 9→10. Pre-fetching alone doesn't reduce Sonnet's tool-call appetite; needs to be paired with explicit no-query instruction or `MAX_TOOL_CALLS` cap (Iter 3). Active baseline remains $0.1494, 9/10. Order for next iteration tentative — Iter 5 (caching) is the safest small win; Iter 6 (combine 4→1 Haiku) and Iter 8 (Sonnet→Haiku) are bigger but riskier.)

**Final target (revised 2026-05-07 for new pilot):** ~$0.05–$0.06/click on `financial_variance` (60% reduction from $0.149 baseline), quality ≥9/10. Ambition is more conservative than payment_outstanding's old target because (a) the section starts cleaner — guard already passing, hallucinations only mild — and (b) Sonnet → Haiku swap (Iter 8, biggest lever) carries higher quality risk on a financial-variance analysis than on AR analysis.

---

## Lessons Learned (append after each iteration)

> One bullet per iteration with the key takeaway. Used by the master to re-order if needed.

- (Iter 0 / baseline) Component prompt trim (commit 6facecf) saved 18% cost with no quality loss. But raising tool cap 2→4 (commit 7a11d31) added cost without quality benefit.
- (Iter 1) Guard fixes work, but only delivered −5% cost (target was −36%) because the retry turn still fires once per run on real Sonnet arithmetic hallucinations (`RM 9.56M`, `RM 5,488,024`). The big retry-elimination win waits for Iter 4. Bigger surprise: hallucinations went 2 → 0 and quality 9 → 10 because the guard is now trustworthy enough that Sonnet's retry actually cleans up its own output. Three discovery loops needed — Sonnet's output drifts run-to-run, exposing latent guard bugs (comma separators, em-dash lookahead, days tolerance) one at a time.
- (Iter 2 / REVERTED) Schema hint eliminated `Columns not allowed` errors (0/run vs 2/run baseline) but the +700-token tool description bloat outweighed the savings: cost +26% ($0.134 → $0.169), quality unchanged at 10/10. **Architectural lesson:** Sonnet learns the schema cheaply via runtime rejection errors (~$0.005 per missed column). Front-loading the schema upfront costs ~$0.030 in extra input tokens — JIT learning beats upfront documentation when the menu is large. Also exposed a pre-existing data bug: `pc_ar_aging_history.dimension_key` is in the whitelist but doesn't exist in the table — file separately. Cost driver this iteration revealed (extra tool calls inflating input tokens) is exactly what Iter 3 attacks directly.

- (Pilot switch / 2026-05-07) **Switched pilot from `payment_outstanding` → `financial_variance`.** Reason: payment_outstanding hit a 10/10 quality ceiling after Iter 1, leaving no measurable headroom. financial_variance baseline ($0.1494, 9/10) shows real headroom — the dominant cost driver is **3-of-4 wasted tool calls per run** ("Columns not allowed" failures + 1 successful call returning 2021 data instead of FY2025). That's ~$0.057/run wasted overhead. The same failure mode payment_outstanding had at baseline, only worse here because financial_variance uses `aggregate_only` policy (more restrictive). Iter 7 (pre-fetch what tools want) is now the highest-leverage next iteration — eliminates the failure at root.

- (Iter 7 / REVERTED) **Spec assumption broken: pre-fetching does NOT cause Sonnet to skip tool calls.** Pre-fetched the monthly P&L lines + monthly OpEx by category. Sonnet *did* use the new data productively (now writes timing-specific insights: "Feb 2025 was the peak month at RM 2,177,107 — 24.1% of FY total", "depreciation booked entirely in Feb 2025 as bulk annual posting", "payroll consistent monthly escalation from RM 283K to RM 575K"). Quality 9→10. **But Sonnet still made the same 4 tool calls per run** — it doesn't treat "data is in the block" as "don't query for the same thing". Result: cost +3.5% (input bloat from new data, no offsetting tool-call reduction). User chose strict cost discipline — reverted. **Architectural takeaway:** pre-fetching is a *quality* lever, not a *cost* lever, until paired with explicit no-query instruction in summary prompt OR `MAX_TOOL_CALLS_PER_SUMMARY` cap (Iter 3). Reattempt as a pair, not in isolation.

---

## Decisions / Course Corrections (append as they happen)

> Document any reordering, skipped iterations, or strategy changes here.

- **2026-04-28** Re-ordered: tool reduction moved to LAST iteration (was originally Iter 1) — build confidence with low-risk fixes first. Per user request.
- **2026-05-07** Iter 2 re-scoped before implementation: original spec placed column hint in `SUMMARY_SYSTEM` (global summary prompt). User redirected to tool description in `tools.ts` since that's where column constraints belong. Tested → reverted (cost regression). Active baseline remains Iter 1 ($0.134, 10/10).
- **2026-05-07** Pre-existing bug exposed by Iter 2: `pc_ar_aging_history.dimension_key` is in `LOCAL_WHITELIST` but the actual table column doesn't exist. Caused 1 SQL execution error per run in both Iter 2 runs. Action: drop from whitelist OR add column to table. **Not fixed in this study** (out of scope); track separately.
- **2026-05-07** Iter 9 REMOVED. Original plan was to disable tools entirely; user pushed back: tools are essential for the LLM to drill into specific customers/agents/months and surface concrete evidence in insights. Iter 2 logs proved this — Sonnet's tool calls produced the agent breakdown (Caelen RM 3.7M, Vincent RM 3.0M) and "Ghost Debts" insight (PRIMA FRESH MART 1,873 days overdue). Removing tools would regress insight quality for ~$0.002 savings — not worth it.
- **2026-05-07** Iter 3 RE-ORDERED to LAST. With Iter 9 removed, capping tool calls at 2 (instead of 4) becomes the safe tool-reduction step — keeps drill-down capability, removes wasted exploratory calls. Final sequence: 4 → 5 → 6 → 7 → 8 → 3.
- **2026-05-07** Final target revised: ~$0.012/click (was $0.010 with Iter 9). Trade $0.002 for keeping tools enabled.
- **2026-05-07** Bug fix (separate from study): removed `dimension_key` from `pc_ar_aging_history` whitelist in `tools.ts`. The actual table has no `dimension_key` column (verified via `\d pc_ar_aging_history`). The whitelist falsely advertised it, causing 1 SQL error per run when Sonnet used it. Fix: drop from whitelist (cleaner than altering the table since the dimension structure here is just `dimension` text alone, no key/value split).

- **2026-05-07** **Pilot section switch: `payment_outstanding` → `financial_variance`.** Driver: payment_outstanding at 10/10 quality ceiling, no headroom for the remaining iterations to demonstrate impact. New pilot baseline captured (`01_baseline_financial_variance.md`): $0.1494, 9/10, ~2 mild ratio hallucinations/run, 3-of-4 tool calls failing. Eval set built at `eval_set/financial_variance/`. Old eval set retained for reference at `eval_set/`.

- **2026-05-07** **Iteration order revised for new pilot.** Recommended next: **Iter 7 (pre-fetch monthly P&L by category)** — the failed-tool-call signature is the dominant cost driver on financial_variance ($0.057/run wasted), and pre-fetching is a low-risk surgical fix. Iter 4 deferred (no-arithmetic rule already in component prompts; mild infractions don't move cost needle).

---

## How to Resume

> Tell the next worker session:
>
> ```
> Resume AI Insight optimization. Read AI_Insight_Study/MASTER_LOG.md and HOW_TO_RUN_ITERATION.md.
> 
> Process for this iteration:
> 1. Discuss the iteration with me first (the spec, what you've read in the code, open questions)
> 2. Write a change plan and get my approval
> 3. ONLY THEN implement the code change
> 4. Run the 2× study, score quality, and decide keep/revert
> 5. Confirm with me before committing
> 
> Do not skip ahead. Steps 1-3 happen before any code edit.
> ```
