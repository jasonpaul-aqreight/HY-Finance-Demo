# AI Insight Optimization — Master Log

> **This file is the single source of truth.** Read this first in every session.
> Updated after each iteration completes. Never delete rows — keep failed/reverted attempts as history.

**Pilot section:** `payment_outstanding`
**Runs per iteration:** 2 (reduced from 3 to limit token spend during study)
**Eval set:** `eval_set/snapshot_state.md` + `expected_values.json`
**Quality rubric:** `eval_set/quality_rubric.md` (max 10)
**Procedure:** `HOW_TO_RUN_ITERATION.md`

---

## Current State

**Active baseline (most recent passing iteration):** Iteration 1 (fix numeric guard whitelist)
**Cost per click:** $0.134
**Quality score:** 10/10
**Hallucinations per run:** 0

---

## Iteration Results Table

| #   | Iteration | Status | Cost ($/click) | Δ Cost | Quality | Hallucinations | Date | Notes |
|-----|-----------|--------|----------------|--------|---------|----------------|------|-------|
| 0   | Baseline (post-RDS migration, post-prompt-trim) | ✅ done | $0.141 | — | 9/10 | 2 | 2026-04-28 | See `01_baseline.md` |
| 1   | Fix numeric guard whitelist | ✅ done | $0.134 | −$0.007 (−5%) | 10/10 | 0 | 2026-04-28 | See `03_iteration_01_fix_guard.md`. Guard now passes (was always failing). Real hallucinations still caught. |
| 2   | Add column-schema hint to tool description (re-scoped from system prompt per user) | ❌ reverted | $0.169 | +$0.035 (+26%) | 10/10 | 0 | 2026-05-07 | See `03_iteration_02_schema_hint.md`. Eliminated `Columns not allowed` errors (0/run vs 2/run baseline) but +700-token tool description bloat triggered cost regression. Quality unchanged. |
| 3   | Drop MAX_TOOL_CALLS_PER_SUMMARY from 4 → 2 | ⏸ skipped | — | — | — | — | 2026-05-07 | Subsumed by Iter 9 (set tool policy to 'none' — tools off makes the cap moot). Per user decision 2026-05-07. |
| 4   | Pre-compute subtotals + strengthen no-arithmetic rule | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 4 |
| 5   | Enable prompt caching | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 5 |
| 6   | Combine 6 Haiku component calls → 1 (tech lead tip #5) | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 6 |
| 7   | Pre-fetch agent/type breakdown + avg_payment_days | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 7 |
| 8   | Switch summary model Sonnet → Haiku | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 8 |
| 9   | Tool reduction (set policy to 'none') ⭐ LAST | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 9 |

**Status legend:** ✅ done · ❌ reverted · ⏸ skipped · ⏳ pending · 🔄 in progress

---

## Cumulative Trajectory (Update after each iteration)

```
Iter:    0       1       2       3⏸     4       5       6       7       8       9
Cost:  $0.141  $0.134  $0.169✗ skip   $___    $___    $___    $___    $___    $___
Qual:   9/10   10/10   10/10   skip   __/10   __/10   __/10   __/10   __/10   __/10
```
(Iter 2 reverted — cost regressed +26%; baseline remains $0.134. Iter 3 skipped — subsumed by Iter 9.)

**Final target:** $0.010/click, quality ≥8/10

---

## Lessons Learned (append after each iteration)

> One bullet per iteration with the key takeaway. Used by the master to re-order if needed.

- (Iter 0 / baseline) Component prompt trim (commit 6facecf) saved 18% cost with no quality loss. But raising tool cap 2→4 (commit 7a11d31) added cost without quality benefit.
- (Iter 1) Guard fixes work, but only delivered −5% cost (target was −36%) because the retry turn still fires once per run on real Sonnet arithmetic hallucinations (`RM 9.56M`, `RM 5,488,024`). The big retry-elimination win waits for Iter 4. Bigger surprise: hallucinations went 2 → 0 and quality 9 → 10 because the guard is now trustworthy enough that Sonnet's retry actually cleans up its own output. Three discovery loops needed — Sonnet's output drifts run-to-run, exposing latent guard bugs (comma separators, em-dash lookahead, days tolerance) one at a time.
- (Iter 2 / REVERTED) Schema hint eliminated `Columns not allowed` errors (0/run vs 2/run baseline) but the +700-token tool description bloat outweighed the savings: cost +26% ($0.134 → $0.169), quality unchanged at 10/10. **Architectural lesson:** Sonnet learns the schema cheaply via runtime rejection errors (~$0.005 per missed column). Front-loading the schema upfront costs ~$0.030 in extra input tokens — JIT learning beats upfront documentation when the menu is large. Also exposed a pre-existing data bug: `pc_ar_aging_history.dimension_key` is in the whitelist but doesn't exist in the table — file separately. Cost driver this iteration revealed (extra tool calls inflating input tokens) is exactly what Iter 3 attacks directly.

---

## Decisions / Course Corrections (append as they happen)

> Document any reordering, skipped iterations, or strategy changes here.

- **2026-04-28** Re-ordered: tool reduction moved to LAST iteration (was originally Iter 1) — build confidence with low-risk fixes first. Per user request.
- **2026-05-07** Iter 2 re-scoped before implementation: original spec placed column hint in `SUMMARY_SYSTEM` (global summary prompt). User redirected to tool description in `tools.ts` since that's where column constraints belong. Tested → reverted (cost regression). Active baseline remains Iter 1 ($0.134, 10/10).
- **2026-05-07** Pre-existing bug exposed by Iter 2: `pc_ar_aging_history.dimension_key` is in `LOCAL_WHITELIST` but the actual table column doesn't exist. Caused 1 SQL execution error per run in both Iter 2 runs. Action: drop from whitelist OR add column to table. **Not fixed in this study** (out of scope); track separately.
- **2026-05-07** Iter 3 SKIPPED — subsumed by Iter 9. Iter 3 (cap tool calls at 2) is meaningless once Iter 9 (tools off entirely) ships. Doing both is redundant. New sequence: 4 → 5 → 6 → 7 → 8 → 9. Per user decision.

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
