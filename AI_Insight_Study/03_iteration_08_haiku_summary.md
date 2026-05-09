# Iteration 8: Switch Summary Model Sonnet → Haiku (Tested on both pilots)

> **Hypothesis:** Replacing `claude-sonnet-4-6` with `claude-haiku-4-5-20251001` for the summary agent will cut summary cost by ~75% (Haiku is 3.75× cheaper) without dropping below the 8/10 quality floor on either pilot.
> **Active baselines before this iteration:**
> - `payment_outstanding`: $0.11525/click, 10/10, 0 hallucinations (Iter 5 baseline)
> - `financial_variance`: ~$0.135/click (post-cache estimated), 9/10, ~2 mild ratio hallucinations (Iter 0 + Iter 5 cache)
> **Date:** 2026-05-07
> **Worker session:** Mary (bmad-agent-analyst)
> **Status:** ⏸ DECISION DEFERRED — pending Iter 8.1 (OpenRouter study) outcome

---

## Discussion with User (Step 1)

- Confirmed single-line code change in `client.ts:17` (default for `SUMMARY_MODEL`); reversible via `git checkout`.
- User chose **strict** quality bar (no regression vs each pilot's baseline).
- 2 runs per pilot (4 runs total).
- User chose to test **both** pilot sections to compare behaviour: `payment_outstanding` (closed pilot, 10/10 ceiling) and `financial_variance` (active pilot).
- Risks flagged before implementation:
  1. Tool-call SQL formulation (Haiku may fail differently against the whitelist)
  2. Variance/ratio reasoning (chained quantitative reasoning is harder for Haiku)
  3. Cache hit rate on summary turns (Iter 5 found Haiku won't cache <small> system prompts)
  4. Format adherence (`===INSIGHT===` parsing)

---

## Approved Change Plan (Step 2-3)

**Goal:** Cut summary-agent cost by switching `SUMMARY_MODEL` from Sonnet 4.6 → Haiku 4.5, on both pilot sections, while holding each section's baseline quality.

**Files changed:**
- `apps/dashboard/src/lib/ai-insight/client.ts:17` — default for `SUMMARY_MODEL` from `'claude-sonnet-4-6'` → `'claude-haiku-4-5-20251001'`. Single line.

**Out of scope:** Tool whitelist, tool policy, `MAX_TOOL_CALLS_PER_SUMMARY`, all prompts, Iter 1 guard, Iter 5 `cache_control` marker, component model.

**Risk assessment:** see Discussion section.

**Success criteria (strict, no regression vs each pilot's baseline):**
- `payment_outstanding`: cost < $0.11525, quality = 10/10, hallucinations = 0
- `financial_variance`: cost < ~$0.135, quality ≥ 9/10, hallucinations ≤ 2 mild

**Rollback approach:** `git checkout apps/dashboard/src/lib/ai-insight/client.ts`. No data migrations, no schema changes.

**User approval:** ✅ approved 2026-05-07 23:34 GMT+8

---

## What Was Implemented (Step 4)

**Diff summary:**
```
- export const SUMMARY_MODEL = process.env.AI_INSIGHT_SUMMARY_MODEL || 'claude-sonnet-4-6';
+ export const SUMMARY_MODEL = process.env.AI_INSIGHT_SUMMARY_MODEL || 'claude-haiku-4-5-20251001';
```

**Deviations from plan:** None.

---

## Pre-flight Verification

- [x] Dev server running on :3001
- [x] TypeScript clean (no errors)
- [x] DB snapshot matches eval set (227 rows, total RM 11,349,862.52)
- [x] `AI_INSIGHT_DEBUG_FILE=true`

---

## Run Results

### `payment_outstanding` (closed pilot, baseline $0.11525 / 10/10)

| Metric | Run 1 | Run 2 | Median | vs Baseline |
|--------|-------|-------|--------|-------------|
| Total tokens | 19,137 | 19,269 | 19,203 | — |
| Estimated cost | $0.0286 | $0.0292 | **$0.0289** | **−74.9%** |
| Tool calls made | 0 | 0 | 0 | — (Haiku synthesized purely from data blocks) |
| Failed tool calls | 0 | 0 | 0 | — |
| Guard attempts | 2 | 2 | 2 | same |
| Guard final state | Passed=false, Unmatched=4 | Passed=false, Unmatched=3 | — | regression (baseline: Passed=true) |
| Cache hits | 0 | 0 | 0 | regression — Haiku didn't cache (system prompt + tools below Haiku threshold? to verify) |

### `financial_variance` (active pilot, baseline ~$0.135 / 9/10)

| Metric | Run 1 | Run 2 | Median | vs Baseline |
|--------|-------|-------|--------|-------------|
| Total tokens | 28,982 | 21,717 | 25,350 | — |
| Estimated cost | $0.0500 | $0.0320 | **$0.0410** | **−69.6%** |
| Tool calls attempted | 1 | 1 | 1 | down from baseline (4) |
| Failed tool calls | 1 (Columns not allowed: line_item, current_ytd, prior_ytd) | 1 (Columns not allowed: line_item, current_period, prior_period, variance_rm) | 1 | same failure pattern, fewer attempts |
| Guard attempts | 2 | 1 | — | improved (Run 2 cleared on attempt 1) |
| Guard final state | **Passed=true, Unmatched=0** | **Passed=true, Unmatched=0** | — | **improvement** (baseline had 2 mild ratio hallucinations) |

---

## Quality Score

### `payment_outstanding`

| Sub-score | Run 1 | Run 2 | Median |
|-----------|-------|-------|--------|
| Numeric Accuracy (0-3) | 2 | 1 | 1.5 |
| Relevance (0-3) | 3 | 3 | 3 |
| Actionability (0-2) | 2 | 2 | 2 |
| Clarity (0-2) | 1 (no markdown tables despite prompt rule) | 1 | 1 |
| **TOTAL (0-10)** | **8** | **7** | **7.5** |

**Hallucinations:**
- Run 1: 1 — "Top 10 breachers hold RM 1,413,171.53" (actual sum: RM 1,513,171.53; off by RM 100,000)
- Run 2: 2 — "Second-to-fifth customers... account for another RM 4,375,655.2 (38.6% combined)" (actual: RM 3,375,655.2 / 29.7%; off by RM 1M and ~9pp)

### `financial_variance`

| Sub-score | Run 1 | Run 2 | Median |
|-----------|-------|-------|--------|
| Numeric Accuracy (0-3) | 3 (all spot-checks correct, guard clean) | 3 | 3 |
| Relevance (0-3) | 3 | 3 | 3 |
| Actionability (0-2) | 2 | 2 | 2 |
| Clarity (0-2) | 1 (no markdown tables in details) | 1 | 1 |
| **TOTAL (0-10)** | **9** | **9** | **9** |

**Hallucinations:**
- Run 1: 0 (guard passed clean, all derived sums spot-check correct)
- Run 2: 0

---

## Discrepancies / Hallucinations

| Type | payment_outstanding | financial_variance |
|------|---------------------|--------------------|
| Wrong arithmetic on derived sums | 3 across 2 runs (RM 1.4M, RM 4.4M, 38.6%) | 0 |
| Tool-result data not whitelisted | 0 | 0 |
| Display rounding mismatch | 0 | 0 |
| Internal logical inconsistency | Run 2: top 1 (18.6%) + 2nd-5th (claimed 38.6%) ≠ top 5 (48.4%) | 0 |
| Markdown table omitted (prompt rule violation) | both runs (-1 clarity) | both runs (-1 clarity) |

---

## What I Observed

- **Haiku does not call tools on payment_outstanding.** Both runs synthesized purely from raw data blocks (0 tool calls). On financial_variance, it tried 1 tool call per run but failed on column whitelist — same failure pattern as Sonnet baseline, just fewer attempts.
- **Cache hit was 0 on every Haiku summary turn.** This is consistent with the Iter 5 finding that Haiku has a higher minimum-cacheable-prefix size. The Iter 5 caching savings (which assumed Sonnet's lower threshold) are partly lost when summary moves to Haiku — so the realised cost reduction (−70%/-75%) is slightly less than the headline 3.75× pricing differential would suggest.
- **The diverging quality outcome is the headline finding.** payment_outstanding requires Haiku to *compute* derived sums (top-N totals, percentages) — Haiku produces plausible-looking but wrong numbers. financial_variance has those values **pre-computed in the data blocks** (variance amounts, percentage changes, top-N attribution) — Haiku just synthesizes commentary, which it does well.
- **Guard catches "missing-from-data" but not "wrong-arithmetic".** RM 1,413,171.53 (wrong) and RM 1,513,171.53 (right) both pass guard tolerance because Haiku's wrong sum still vaguely matches numbers in the table. The numeric guard's design assumption (numbers in output should appear verbatim or via tool results) is being defeated by approximate-arithmetic hallucinations.
- **Haiku self-corrected on financial_variance Run 1.** After tool call failed, it wrote: *"I'll regenerate the summary, removing the unsupported numeric reference."* — clean recovery.
- **Cost win is real on both pilots** — −69.6% to −74.9% — Sonnet → Haiku is the biggest single lever proven in this study.

---

## Verdict

**Decision:** ⏸ **DEFERRED** — pending Iter 8.1 (OpenRouter study) outcome.

**Reason:**

The result split by pilot:
- `payment_outstanding` **fails** strict bar (10/10 → 7.5/10, 1.5 hallucinations) — Haiku fabricates derived sums that the guard cannot catch.
- `financial_variance` **passes** strict bar (9/10 → 9/10, 0 hallucinations) — pre-computed variance data plays to Haiku's synthesis strength.

Three paths were on the table:
1. Revert globally — lose −70% on the active pilot (financial_variance)
2. Keep globally — accept a regression on the inactive pilot (payment_outstanding)
3. Per-section model selector — match model to data shape (synthesis-only → Haiku, derived-arithmetic → Sonnet)

User chose to defer the decision and explore a fourth option first: **Iter 8.1 — replace the model layer with OpenRouter primary + Claude SDK fallback.** If OpenRouter delivers good quality at the right cost, both component and summary calls move there with Claude Haiku as fallback only. If not, we revert Iter 8 (back to component=Haiku, summary=Sonnet).

**Cost:** $0.11525 → $0.0289 on payment_outstanding (−74.9%); ~$0.135 → $0.0410 on financial_variance (−69.6%) — but verdict deferred.
**Quality:** 10/10 → 7.5/10 on payment_outstanding (regression); 9/10 → 9/10 on financial_variance (no regression, fewer hallucinations).

---

## Next Iteration

**Iter 8.1: OpenRouter primary + Claude SDK fallback** — see `02_analysis.md §Iteration 8.1`. Iter 8 keep/revert decision is contingent on 8.1 outcome.

After 8.1 resolves: remaining pending iterations are Iter 4 (pre-compute subtotals; deferred) and Iter 3 (drop tool cap, scheduled last).

---

## Files

- Logs: `iter8_payment_run1_log.log`, `iter8_payment_run2_log.log`, `iter8_fv_run1_log.log`, `iter8_fv_run2_log.log`
- Code change: **reverted to Sonnet baseline** in `apps/dashboard/src/lib/ai-insight/client.ts:17` (working tree clean) at user's direction. Iter 8.1 will start from a clean pre-Iter-8 baseline. If Iter 8.1 fails, no further revert is needed; if Iter 8.1 succeeds, Claude Haiku will be re-applied as the SDK fallback model.
