# AI Insight Optimization — Session Tracker (Historical)

> ⚠️ **SUPERSEDED by `MASTER_LOG.md` as of 2026-04-28.**
> This file is kept as a historical record of Sessions 1 and 1.5 (setup + baseline).
> All future iteration tracking happens in `MASTER_LOG.md`.
> Worker sessions follow `HOW_TO_RUN_ITERATION.md`.

---

## Session 1: Setup + Baseline (2026-04-18)

- [x] Create AI_Insight_Study folder + session tracker
- [x] Save tech lead tips
- [x] Enhance debug-logger.ts (timing, cache, guard, model, cost per call)
- [x] Create eval set (snapshot_state, expected_values, quality_rubric)
- [x] Run baseline (3 runs) with debug logging
- [x] Write 01_baseline.md
- [x] Write 02_analysis.md

**Status:** DONE — Baseline cost $0.173/click, quality 9/10

---

## Session 1.5: Re-baseline after RDS migration + code refactor (2026-04-28)

- [x] Re-run baseline 3x with restored RDS
- [x] Re-extract metrics, tool calls, guard discrepancies
- [x] Update 01_baseline.md with new traces (full transparency)
- [x] Update 02_analysis.md improvement plan (re-ordered, tool reduction LAST)
- [x] Copy new logs to AI_Insight_Study/

**Status:** DONE

**Updated baseline (3 runs, median):**
- Cost: **$0.141/click** (was $0.173 — code trim saved 18%)
- Quality: **9/10** (unchanged)
- Hallucinations: ~2/run (computed sums, "172%" misread)
- Tokens: 33,812 | API calls: 11 | Latency: 86s
- Tool cap raised to 4; 2 of 4 tool calls fail with column-name errors
- Numeric guard always fails (23→18 unmatched)

---

## Iteration Sequence (REVISED — Tool Reduction LAST)

| # | Iteration | Risk | Cost target | Quality target |
|---|-----------|------|-------------|----------------|
| 1 | Fix numeric guard whitelist | Low | $0.090 | 9/10 |
| 2 | Add column-schema hint to summary system prompt | Low | $0.072 | 9/10 |
| 3 | Drop tool cap from 4 → 2 | Low | $0.052 | 9/10 |
| 4 | Pre-compute subtotals + strengthen no-arithmetic rule | Low | $0.050 | 10/10 |
| 5 | Enable prompt caching | Low | $0.043 | 10/10 |
| 6 | Combine 6 Haiku component calls → 1 (tech lead tip #5) | Medium | $0.035 | 10/10 |
| 7 | Pre-fetch agent/type aging breakdown + avg_payment_days | Low | $0.032 | 10/10 |
| 8 | Switch summary model Sonnet → Haiku | Medium-High | $0.012 | ≥8/10 |
| 9 | **Tool reduction (set policy to 'none')** ⭐ LAST | Medium | $0.010 | ≥8/10 |

**Final target:** $0.010/click (−93% vs $0.141 baseline)

---

## Session 2: Iterations 1-3 (Lowest-Risk Fixes)

- [ ] Iteration 1: Fix numeric guard whitelist
- [ ] Iteration 2: Add column-schema hint to summary system prompt
- [ ] Iteration 3: Drop MAX_TOOL_CALLS_PER_SUMMARY from 4 → 2

**Expected:** $0.141 → $0.052 (-63%)

**Status:** NOT STARTED

---

## Session 3: Iterations 4-6 (Quality + Caching + Combined Components)

- [ ] Iteration 4: Pre-compute subtotals + strengthen no-arithmetic rule
- [ ] Iteration 5: Enable prompt caching
- [ ] Iteration 6: Combine 6 Haiku component calls → 1

**Expected:** $0.052 → $0.035 (-75% from baseline)

**Status:** NOT STARTED

---

## Session 4: Iterations 7-9 (Pre-fetch + Model Swap + Tool Removal)

- [ ] Iteration 7: Pre-fetch agent/type breakdown + avg_payment_days
- [ ] Iteration 8: Switch summary to Haiku
- [ ] Iteration 9: Set tool policy to 'none' ⭐ LAST
- [ ] Write summary_playbook.md for team reuse

**Expected:** $0.035 → $0.010 (-93% from baseline)

**Status:** NOT STARTED

---

## How to Resume

When starting a new session, tell Claude:
> "Resume AI Insight optimization study. Check AI_Insight_Study/SESSION_TRACKER.md for progress."
