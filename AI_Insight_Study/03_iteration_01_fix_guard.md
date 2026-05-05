# Iteration 01: Fix Numeric Guard Whitelist

> **Hypothesis:** Fixing tool-result whitelist + pct/days tolerances will let the guard pass on attempt 1, eliminating the wasted retry turn (~$0.051/run).
> **Active baseline before this iteration:** $0.141/click, Quality 9/10
> **Date:** 2026-04-28
> **Worker session:** Iter 1 — main + 2 scope extensions

---

## Discussion with User (Step 1)

- Walked through how the guard works (extract-from-text → match-against-whitelist → reject-and-retry).
- User asked whether removing the guard entirely would be simpler. Recommended against: guard catches real Sonnet arithmetic hallucinations (`RM 9,471,033`, `172%`) — removal trades cost for trust risk in front of senior executives. Decided to fix in place.
- Three discovery cycles during implementation:
  1. **Initial plan** (approved): permissive tool-result whitelisting + pct rounding tolerance.
  2. **Option A extension** (approved after Run 1+2 showed cost flat): extend `extractNumbers` to handle comma thousand-separators in `days`/`count` regexes.
  3. **Option 2 extension** (approved after Run 1+2 showed near-pass): remove em-dash from RM negative lookahead + relax `days` tolerance to ±1.

---

## Approved Change Plan (Step 2-3)

**Goal:** Make the guard pass attempt 1 (or 2 cleanly) so the wasted retry turn stops firing for legitimate citations, while still catching real arithmetic hallucinations.

**Files changed:**
- `apps/dashboard/src/lib/ai-insight/numeric-guard.ts` — added `extractToolResultNumbers()`; loosened pct + days tolerances; fixed comma handling in days/count regexes; fixed RM negative-lookahead em-dash false-trigger.
- `apps/dashboard/src/lib/ai-insight/orchestrator.ts` — replaced tool-result whitelisting to use the new permissive extractor under all 4 units.

**Out of scope:**
- Sonnet arithmetic hallucinations (`RM 9.56M`, computed sums) — Iter 4.
- Failed schema-error tool calls — Iter 2.
- Tool cap reduction — Iter 3.
- "120 days" bucket-name leak — left alone (low impact, dropped naturally).

**Risk assessment:** Low. We loosened guard rules; worst case is letting a real hallucination through. Verified by inspecting attempt-1 unmatched logs: real hallucinations (computed sums, `RM 9.56M`, `RM 5,488,024`) are still caught.

**Success criteria:**
- Cost: ≤ $0.135 (saving ≥ $0.005)
- Quality: ≥ 8/10
- Hallucinations: ≤ 2

**Rollback approach:** `git checkout apps/dashboard/src/lib/ai-insight/numeric-guard.ts apps/dashboard/src/lib/ai-insight/orchestrator.ts`.

**User approval:** ✅ approved 2026-04-28 (initial), then approved scope extension Option A, then Option 2.

---

## What Was Implemented (Step 4)

**Diff summary:**
1. **`extractToolResultNumbers(text)` added to numeric-guard.ts** — permissive bare-number extractor for tool-result text. Captures values like `1873`, `162.49`, `666.40`, `1300000.00` that the labeled-format extractor misses. Each value is whitelisted under all 4 units (RM/pct/days/count) since tool results are ground truth.
2. **Pct tolerance loosened** — added ±1.0 absolute and ±1% relative tolerance for `pct`, mirroring the RM display-rounding logic. Allows `594%` to match whitelisted `594.5%`.
3. **Days tolerance loosened** — added ±1.0 absolute tolerance. Allows `666 days` to match whitelisted `666.4`.
4. **Days/count regexes handle commas** — `(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)\s*days?\b`. Allows `1,873 days` to extract as 1873 (not 873).
5. **RM negative lookahead tightened** — changed `[-–—]` (any dash) to `-` (hyphen only). Em/en dashes are sentence punctuation, not range markers. Prevents `RM 6,587,823 — 58.0%` from being truncated to `RM 6,587`.

**Deviations from plan:**
- Initial plan covered fixes 1-2 only. Cost was flat after 2 runs because Sonnet wrote different numbers exposing the comma-separator bug. Asked user → approved Option A (fix 4). Cost still flat because of em-dash truncation + tight days tolerance. Asked user → approved Option 2 (fixes 3 + 5). Final result met success criteria.

---

## Pre-flight Verification

- [x] Dev server running on :3001
- [x] DB snapshot matches eval set (227 rows, total RM 11,349,862.52, snapshot 2026-04-23)
- [x] `npx tsc --noEmit` clean

---

## Run Results (2 runs, post-Option-2)

| Metric | Run 1 | Run 2 | Median | vs Baseline |
|--------|-------|-------|--------|-------------|
| Total tokens | 32,400 | 32,659 | 32,530 | −4% |
| Estimated cost | $0.1371 | $0.1301 | **$0.1336** | **−5% (-$0.007)** |
| Latency (s) | 83 | 76 | 80 | −7% |
| API calls (Haiku + Sonnet turns) | 6 + 4 = 10 | 6 + 4 = 10 | 10 | similar |
| Tool calls made | 4 | 4 | 4 | same |
| Failed tool calls (column errors) | 2 | 2 | 2 | same |
| Guard attempts | 2 | 2 | 2 | same |
| Guard unmatched (attempt 1) | 2 | 1 | 1.5 | **−92%** |
| Guard unmatched (final) | **0 ✅** | **0 ✅** | **0** | **PASSING** |
| Cache hits | 0 | 0 | 0 | same |

### Cost Breakdown (Run 1, Option 2)

| Stage | Tokens (in→out) | Cost |
|-------|-----------------|------|
| 6 Haiku component calls (total) | 4,531 → 1,764 | $0.0107 |
| Sonnet Turn 1 (tool calls, 2 failed) | ~4,500 → ~310 | $0.018 |
| Sonnet Turn 2 (tool retry, succeeded) | ~5,000 → ~310 | $0.020 |
| Sonnet Turn 3 (insights generation) | 7,902 → 1,676 | $0.049 |
| Sonnet Turn 4 (guard retry → PASS) | ~10,000 → ~1,000 | $0.040 |
| **TOTAL** | 32,400 | **$0.137** |

---

## Quality Score (Both Runs)

| Sub-score | Run 1 | Run 2 | Median |
|-----------|-------|-------|--------|
| Numeric Accuracy (0-3) | 3 | 3 | 3 |
| Relevance (0-3) | 3 | 3 | 3 |
| Actionability (0-2) | 2 | 2 | 2 |
| Clarity (0-2) | 2 | 2 | 2 |
| **TOTAL (0-10)** | **10** | **10** | **10/10** |

**Hallucinations (numbers in user-visible output not from data):**
- Run 1: **0** — all numbers verified against component data + tool results.
- Run 2: **0** — all numbers verified.

(Note: attempt-1 drafts contained 1-2 computed-sum hallucinations each, but the guard correctly rejected them and Sonnet removed them in attempt 2.)

---

## Sample Output (Run 2)

```
===INSIGHT===
sentiment: bad
title: 100% of Receivables Overdue — All 120+ Days
metric: RM 11,349,863
summary: Every ringgit owed is overdue by 120+ days across all 227 customers.
[detail with verified agent breakdown, 1,873 days oldest delinquency, etc.]

===INSIGHT===
sentiment: bad
title: High-Risk Tier Holds 58% of Outstanding
metric: RM 6,587,823
[detail with verified utilization pcts, max overdue days]

===INSIGHT===
sentiment: bad
title: 21 Customers Breaching Credit Limits
metric: 21 customers
[detail with verified credit limits and utilization]
```

All values cross-checked against `expected_values.json` and tool-result tables. No hallucinations.

---

## Discrepancies / Guard Failures (Attempt 1, Run 1)

| Type | Count | Examples |
|------|-------|----------|
| Tool-result data not whitelisted | 0 | (was 10 in baseline) |
| Sonnet computed sums (true hallucination) | 2 | `RM 5,488,024`, `RM 2.22M` |
| Display rounding mismatch | 0 | (was 6 in baseline) |
| Wrong values | 0 | (was 2 in baseline) |
| Other | 0 | (was 5 in baseline) |

Run 2 attempt 1: 1 unmatched (`RM 9.56M` — Sonnet rounded sum). Both runs' real hallucinations were caught by the guard and removed in attempt 2.

---

## What I Observed

- The guard is now **trustworthy enough to ship** — every flagged value in attempt 1 was a real arithmetic hallucination, not a false positive. Pre-Iter-1, ~70% of flags were noise (format mismatches), making the guard effectively a "rubber stamp that always fails."
- The cost win is modest ($0.007/run) because the retry turn still fires once per run for the 1-2 real hallucinations Sonnet keeps producing. **The big win waits for Iter 4** (pre-compute subtotals + strengthen no-arithmetic rule), which should drive attempt-1 unmatched to 0 and remove the retry entirely.
- The quality jump from 9→10 is the surprise win. With the guard catching computed sums and Sonnet retrying cleanly, the final output has zero hallucinations vs ~2 in baseline.
- Three discovery loops were needed because Sonnet's output drifts run-to-run — different customers cited, different number formats — exposing different latent guard bugs each time.
- All 3 fixed bugs are **section-agnostic**, so this iteration also benefits the upcoming HR sections (per spec) and existing Finance sections.

---

## Verdict

**Decision:** ✅ KEEP

**Reason:** Cost decreased $0.141 → $0.134 (−5%), quality improved 9 → 10/10, hallucinations went 2 → 0, and the guard now actually passes (vs always-failing in baseline). Below the spec target ($0.090) because the retry still fires once per run on real Sonnet hallucinations — but those are Iter 4's job, not Iter 1's. The guard is now trustworthy and ready for HR rollout.

**Cost:** $0.141 → $0.134 (Δ −5%)
**Quality:** 9/10 → 10/10
**Hallucinations:** ~2 → 0

---

## Next Iteration

According to MASTER_LOG, next pending iteration is: **Iteration 2: Add column-schema hint to summary system prompt**

Reason to re-order: No. Iter 2 directly attacks the 2 failed tool calls per run ($0.018 wasted Turn 1) — should be the next biggest single win.

---

## Files

- Logs: `AI_Insight_Study/iter1_run1_log.log`, `iter1_run2_log.log`
- Code change:
  - `apps/dashboard/src/lib/ai-insight/numeric-guard.ts`
  - `apps/dashboard/src/lib/ai-insight/orchestrator.ts`
