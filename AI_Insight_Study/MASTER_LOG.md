# AI Insight Optimization — Master Log

> **This file is the single source of truth.** Read this first in every session.
> Updated after each iteration completes. Never delete rows — keep failed/reverted attempts as history.

**Pilot section:** `financial_variance` (active for Iter 6+); `payment_outstanding` was used for Iter 5 only as a pure-cost A/B test. Caching change retained codebase-wide.
**Runs per iteration:** 2 (baseline AND iteration runs)
**Eval set (current pilot):** `eval_set/financial_variance/snapshot_state.md` + `expected_values.json`
**Eval set (former pilot, retained):** `eval_set/snapshot_state.md` + `expected_values.json` (payment_outstanding)
**Quality rubric:** `eval_set/quality_rubric.md` (max 10) — shared across pilots
**Procedure:** `HOW_TO_RUN_ITERATION.md`

---

## Current State

**Active pilot:** `financial_variance` (Financial page).
**Provider architecture:** OpenRouter-only AI Insight provider migration implemented locally on 2026-05-11, pending commit. Direct Claude SDK usage has been removed from AI Insight. Claude is allowed only through OpenRouter model slugs.
**Open decision:** No direct Claude SDK fallback remains in scope for the Finance demo. Remaining decisions are section rollout quality/tool-schema cleanup and whether to adjust OpenRouter model/provider ladders after more section evidence.
**`payment_outstanding` end-state (post-Iter-5):** $0.11525 / 10/10 / 0 hallucinations. Caching change kept. Iter 8 tested here for arithmetic stress test → regressed to 7.5/10 (Haiku fabricates derived sums).
**`financial_variance` end-state (post-Iter-5 codebase, post-Iter-8 measured):** Iter 8 measured cost = $0.0410, quality 9/10, 0 hallucinations on Haiku — held strict bar. Pre-Iter-8 baseline (post-cache) ≈ $0.135. Original Iter 0 baseline (pre-cache): $0.1494 / 9/10. Details: `01_baseline_financial_variance.md`, `03_iteration_08_haiku_summary.md`.

---

## Iteration Results Table

### `payment_outstanding` (former pilot — frozen 2026-05-07 at quality ceiling)

| #   | Iteration | Status | Cost ($/click) | Δ Cost | Quality | Hallucinations | Date | Notes |
|-----|-----------|--------|----------------|--------|---------|----------------|------|-------|
| 0   | Baseline (post-RDS migration, post-prompt-trim) | ✅ done | $0.141 | — | 9/10 | 2 | 2026-04-28 | See `01_baseline.md` |
| 1   | Fix numeric guard whitelist | ✅ done | $0.134 | −$0.007 (−5%) | 10/10 | 0 | 2026-04-28 | See `03_iteration_01_fix_guard.md`. Guard now passes (was always failing). Real hallucinations still caught. |
| 2   | Add column-schema hint to tool description (re-scoped from system prompt per user) | ❌ reverted | $0.169 | +$0.035 (+26%) | 10/10 | 0 | 2026-05-07 | See `03_iteration_02_schema_hint.md`. Eliminated `Columns not allowed` errors but +700-token bloat caused cost regression. Quality unchanged. |
| 5   | Enable prompt caching (system prompts; tools cached implicitly via prefix) | ✅ done | $0.11525 | −$0.01875 (−14.0%) | 10/10 | 0 | 2026-05-07 | See `03_iteration_05_caching.md`. Median of $0.1188 + $0.1117. Beat spec target (~−5%) by ~3× because tools array (multi-thousand tokens) is cached implicitly with the system marker. Haiku component calls did NOT cache (~200-token system prompt below Haiku's minimum cacheable size) — all savings on Sonnet. |
| 9   | ~~Tool reduction (set policy to 'none')~~ | ❌ removed | — | — | — | — | 2026-05-07 | Removed — tools essential for drill-down evidence. |

### `financial_variance` (current pilot — baseline captured 2026-05-07)

| #   | Iteration | Status | Cost ($/click) | Δ Cost | Quality | Hallucinations | Date | Notes |
|-----|-----------|--------|----------------|--------|---------|----------------|------|-------|
| 0   | Baseline (financial_variance, post-Iter-1 codebase) | ✅ done | $0.1494 | — | 9/10 | ~2 (mild ratios) | 2026-05-07 | See `01_baseline_financial_variance.md`. Guard passes 0 unmatched, but 3 of 4 tool calls fail with "Columns not allowed" — wasted ~$0.057/run on retries. |
| 4   | Pre-compute subtotals + strengthen no-arithmetic rule | ⏸ deferred | — | — | — | — | 2026-05-07 | Spec: 02_analysis.md §Iter 4. Component prompts already include the no-arith rule; only mild ratio infractions slip through. Saving < $0.005, quality 9→10 ceiling — low ROI on this section. |
| 5   | Enable prompt caching | ⏸ tested on payment_outstanding | — | — | — | — | 2026-05-07 | Iteration moved to payment_outstanding section above for pure cost test. See that row + `03_iteration_05_caching.md`. |
| 6   | Combine 4 Haiku component calls → 1 | ⏸ skipped | — | — | — | — | 2026-05-07 | Spec: 02_analysis.md §Iter 6. Skipped — Haiku component cost is ~$0.015/run (10% slice); est. saving ~$0.008 (~5%) too small to confidently distinguish from run-to-run noise. Iter 8 (Sonnet→Haiku for summary) attacks the 90% slice with 10× more headroom. Revisit only if Iter 8 lands and we still need cost cuts. |
| 7   | Pre-fetch monthly P&L by category | ❌ reverted | $0.1546 | +$0.0052 (+3.5%) | 10/10 | 0 | 2026-05-07 | See `03_iteration_07_pre_fetch.md`. Spec assumption ("pre-fetch → fewer tool calls") was wrong: Sonnet still queries even when data is in block. Quality genuinely improved (9→10) with timing insights, but cost increased. User chose strict cost discipline — reverted. **Lesson:** pre-fetching is a quality lever, not a cost lever, until paired with explicit no-query instruction or `MAX_TOOL_CALLS` cap (Iter 3). |
| 8   | Switch summary model Sonnet → Haiku | ⏸ deferred (decision pending Iter 8.1; code reverted in working tree) | $0.0410 | −$0.094 (−69.6%) | 9/10 | 0 | 2026-05-07 | See `03_iteration_08_haiku_summary.md`. Cost target hit cleanly on financial_variance. Tested on **both** pilots: payment_outstanding regressed 10/10→7.5/10 (Haiku fabricates derived sums; guard misses arithmetic hallucinations); financial_variance held 9/10→9/10 with 0 hallucinations (pre-computed variance data plays to Haiku's strengths). User chose to defer keep/revert until Iter 8.1 (OpenRouter study) outcome. **Code change in `client.ts:17` has been reverted** to Sonnet default; working tree clean. If 8.1 succeeds, Haiku will be re-applied as the SDK fallback. |
| 8.1 | OpenRouter-only provider migration (`deepseek/deepseek-v4-flash` components/router, `z-ai/glm-5.1` summary/editor, Claude only through OpenRouter fallback slugs) | ✅ implemented locally, pending commit | $0.0156 S02 stress / $0.0167 S05 smoke | Lower than prior Sonnet baseline in these spot checks | Smoke/stress pass | 0 material observed | 2026-05-11 | Supersedes the older "OpenRouter primary + Claude SDK fallback" design. Direct `@anthropic-ai/sdk` usage removed from AI Insight. Provider fallback is handled through OpenRouter `provider.order` first; model fallback is code-level second and only for technical failures. Validation logs: `apps/dashboard/logs/ai-debug-payment_outstanding-2026-05-11T08-47-32.log`, `apps/dashboard/logs/ai-debug-customer_margin_overview-2026-05-11T08-43-40.log`. |
| 3   | Drop MAX_TOOL_CALLS_PER_SUMMARY from 4 → 2 ⭐ LAST | ⏳ pending | — | — | — | — | — | Spec: 02_analysis.md §Iter 3 |

**Status legend:** ✅ done · ❌ reverted · ⏸ skipped · ⏳ pending · 🔄 in progress

---

## Cumulative Trajectory

### `payment_outstanding` (former pilot — re-used briefly for Iter 5 caching A/B)

```
Iter:    0       1       2 (reverted)   5
Cost:  $0.141  $0.134  $0.169✗         $0.115
Qual:   9/10   10/10   10/10           10/10
```

### `financial_variance` (current pilot)

```
Iter:    0           7 (reverted)   5 (codebase)*  6 (skipped)   8 (deferred)  8.1          4           3 (last)
Cost:  $0.1494     $0.1546✗        ~$0.135 est    —             $0.0410⏸     $___          $___        $___
Qual:   9/10       10/10           9/10 expected  —             9/10⏸        __/10         __/10       __/10
```

\* Iter 5 (caching) was tested on `payment_outstanding`, not measured directly here, but the codebase change is live for `financial_variance` too. Expected effective baseline ≈ $0.135 (−10% from $0.149) when next click on financial_variance fires. Confirmed by Iter 8 baseline measurement.

(Iter 7 reverted — cost +3.5% even though quality went 9→10. Iter 5 (caching) kept — −14% on payment_outstanding A/B. Iter 6 SKIPPED 2026-05-07 (Haiku slice too small to give clean signal). Iter 8 (Sonnet→Haiku) tested on both pilots 2026-05-07: financial_variance held quality at -70% cost; payment_outstanding regressed (Haiku can't synthesize derived sums). Decision deferred pending **Iter 8.1 — OpenRouter primary + Claude SDK fallback** as alternative path to Haiku-class cost without arithmetic regression.)

**Final target (revised 2026-05-07 for new pilot):** ~$0.05–$0.06/click on `financial_variance` (60% reduction from $0.149 baseline), quality ≥9/10. Ambition is more conservative than payment_outstanding's old target because (a) the section starts cleaner — guard already passing, hallucinations only mild — and (b) Sonnet → Haiku swap (Iter 8, biggest lever) carries higher quality risk on a financial-variance analysis than on AR analysis.

---

## Lessons Learned (append after each iteration)

> One bullet per iteration with the key takeaway. Used by the master to re-order if needed.

- (Iter 0 / baseline) Component prompt trim (commit 6facecf) saved 18% cost with no quality loss. But raising tool cap 2→4 (commit 7a11d31) added cost without quality benefit.
- (Iter 1) Guard fixes work, but only delivered −5% cost (target was −36%) because the retry turn still fires once per run on real Sonnet arithmetic hallucinations (`RM 9.56M`, `RM 5,488,024`). The big retry-elimination win waits for Iter 4. Bigger surprise: hallucinations went 2 → 0 and quality 9 → 10 because the guard is now trustworthy enough that Sonnet's retry actually cleans up its own output. Three discovery loops needed — Sonnet's output drifts run-to-run, exposing latent guard bugs (comma separators, em-dash lookahead, days tolerance) one at a time.
- (Iter 2 / REVERTED) Schema hint eliminated `Columns not allowed` errors (0/run vs 2/run baseline) but the +700-token tool description bloat outweighed the savings: cost +26% ($0.134 → $0.169), quality unchanged at 10/10. **Architectural lesson:** Sonnet learns the schema cheaply via runtime rejection errors (~$0.005 per missed column). Front-loading the schema upfront costs ~$0.030 in extra input tokens — JIT learning beats upfront documentation when the menu is large. Also exposed a pre-existing data bug: `pc_ar_aging_history.dimension_key` is in the whitelist but doesn't exist in the table — file separately. Cost driver this iteration revealed (extra tool calls inflating input tokens) is exactly what Iter 3 attacks directly.

- (Pilot switch / 2026-05-07) **Switched pilot from `payment_outstanding` → `financial_variance`.** Reason: payment_outstanding hit a 10/10 quality ceiling after Iter 1, leaving no measurable headroom. financial_variance baseline ($0.1494, 9/10) shows real headroom — the dominant cost driver is **3-of-4 wasted tool calls per run** ("Columns not allowed" failures + 1 successful call returning 2021 data instead of FY2025). That's ~$0.057/run wasted overhead. The same failure mode payment_outstanding had at baseline, only worse here because financial_variance uses `aggregate_only` policy (more restrictive). Iter 7 (pre-fetch what tools want) is now the highest-leverage next iteration — eliminates the failure at root.

- (Iter 7 / REVERTED) **Spec assumption broken: pre-fetching does NOT cause Sonnet to skip tool calls.** Pre-fetched the monthly P&L lines + monthly OpEx by category. Sonnet *did* use the new data productively (now writes timing-specific insights: "Feb 2025 was the peak month at RM 2,177,107 — 24.1% of FY total", "depreciation booked entirely in Feb 2025 as bulk annual posting", "payroll consistent monthly escalation from RM 283K to RM 575K"). Quality 9→10. **But Sonnet still made the same 4 tool calls per run** — it doesn't treat "data is in the block" as "don't query for the same thing". Result: cost +3.5% (input bloat from new data, no offsetting tool-call reduction). User chose strict cost discipline — reverted. **Architectural takeaway:** pre-fetching is a *quality* lever, not a *cost* lever, until paired with explicit no-query instruction in summary prompt OR `MAX_TOOL_CALLS_PER_SUMMARY` cap (Iter 3). Reattempt as a pair, not in isolation.

- (Iter 5 / KEPT) **Anthropic prompt caching delivered −14.0% cost (−$0.0188/click) on `payment_outstanding` — ~3× the spec's projected −5%.** Quality unchanged (10/10, 0 hallucinations) — confirmed caching is purely a billing-layer optimization. **Two surprises:** (1) The bigger-than-expected savings came from the tools array, not the system prompt. Tools sit before system in Anthropic's prompt prefix, so a single `cache_control` marker on the system block implicitly caches tools too — and the tools blob (multi-thousand tokens of whitelist + schemas) is much fatter than the system prompt. Spec underestimated this. (2) Haiku component calls did NOT cache — `created=0, read=0` on every Haiku turn — because the ~200-token Haiku system prompt is below Haiku 4.5's minimum cacheable prefix size. All Iter 5 savings came from Sonnet caching alone. **Architectural lesson:** position-based caching means the cheapest cache win is on the largest static prefix block — for tool-using flows, that's the tools array (cached implicitly via system marker). When evaluating future caching opportunities, count tokens by prompt-prefix layer, not by which named field the marker lives on. Also: Haiku's higher minimum cache size means small system prompts won't cache there — pre-validate prompt size before adding markers.

- (Iter 8 / DEFERRED) **Sonnet → Haiku for summary delivered the projected ~70% cost cut on both pilots (−74.9% on payment_outstanding, −69.6% on financial_variance) — but quality split sharply by data shape.** financial_variance held 9/10 with 0 hallucinations (improvement over baseline's ~2 mild ratios) — Haiku is excellent at *synthesizing commentary* over pre-computed variance numbers. payment_outstanding regressed to 7.5/10 with 1.5 hallucinations median — Haiku fabricated derived sums (e.g., wrote `RM 1,413,171.53` for a top-10 total whose actual sum is `RM 1,513,171.53`; wrote `RM 4,375,655.2 / 38.6%` for a 2nd-to-5th subtotal whose actual is `RM 3,375,655.2 / 29.7%`). **Three architectural takeaways:** (1) The numeric guard's "must appear in raw data" check is **defeated by approximate-arithmetic hallucinations** — a wrong sum that looks plausible passes. The guard catches missing-from-data, not wrong-arithmetic. (2) **Model-quality-per-dollar depends on whether the prompt requires *synthesis* (Haiku ✓) or *computation* (Haiku ✗).** Sonnet's premium pays for chained quantitative reasoning; if the data fetcher pre-computes those values, Sonnet's premium is wasted. If it doesn't, Haiku is unsafe. (3) Haiku's higher minimum cacheable prefix size **also affects the summary call**, not just components — `cache_read=0` on every summary turn even though Iter 5's marker is in place. The Iter 5 caching savings on the summary path are partly lost when the model swaps to Haiku, so the realised cost reduction is below the headline 3.75× pricing differential. **Decision deferred to Iter 8.1 (OpenRouter study)** rather than ship a per-section model selector — user opted to first see whether a Sonnet-arithmetic alternative (candidate: `z-ai/glm-5.1` via OpenRouter; ~7% more expensive than Haiku per token but ~3× cheaper than Sonnet, reasoning-capable) collapses the dilemma. Iter 8.1 is therefore framed as a *quality + diversification* play, not a cost play.

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

- **2026-05-07** **Iter 5 pilot revert (one-iteration only): `financial_variance` → `payment_outstanding`.** Driver: caching is a cost-only feature — same input bytes go to the model, so quality cannot regress from this change. Running on `payment_outstanding` (already at 10/10 ceiling) gives us a cleaner pure-cost signal: any cost delta is purely the cache effect, no quality scoring noise. Bonus: `payment_outstanding` has 6 components vs `financial_variance`'s 4 → more Haiku calls within one click → more cache hits to measure. Will return to `financial_variance` for Iter 6+ where quality risk re-enters (combine components, model swap).

- **2026-05-07** **Iter 6 SKIPPED.** Cost analysis: Haiku component slice is ~$0.015/run (10% of total). Combining 4→1 Haiku calls saves at most ~$0.008/run (~5% of baseline) — too close to run-to-run noise to confidently call keep/revert (cf. Iter 7's borderline +3.5% revert). Iter 8 (Sonnet→Haiku for summary) attacks the 90% slice with 10× more headroom and gives a cleaner signal. **New iteration order: 8 → 4 → 3.** Revisit Iter 6 only if Iter 8 lands and we still need cost cuts; at that point the Haiku slice will be even smaller, making it even less worth doing. Architectural note: Iter 6 would still simplify the codebase (fewer calls, less rate-limit pressure) — that's a refactor, not a study iteration.

- **2026-05-07** **Iter 8 DEFERRED — Iter 8.1 inserted before keep/revert decision.** Iter 8 was tested on both pilots with strict (no-regression) quality bars per user direction. Result split: financial_variance passed strict (9→9, 0 hallucinations, −69.6% cost); payment_outstanding failed strict (10→7.5, 1.5 hallucinations median, −74.9% cost). Three resolution paths were on the table — (1) revert globally, (2) keep globally accepting the regression on the closed pilot, (3) per-section model selector. User chose a fourth option: **defer the keep/revert call and run Iter 8.1 first — replace the Anthropic SDK as the primary model layer with OpenRouter (candidate model `z-ai/glm-5.1`, confirmed by user via https://openrouter.ai/z-ai/glm-5.1) and keep Anthropic SDK as a fallback only.** Rationale: a Sonnet-arithmetic alternative at ~30% of Sonnet's price could collapse the synthesis-vs-computation dilemma exposed by Iter 8 and obviate the need for a per-section selector. Note: pricing investigation revealed GLM 5.1 is *not* cheaper than Haiku (~7% more on FV-shaped workloads), so 8.1 is now framed as a quality + diversification play rather than a cost play. **Iter 8 code change in `client.ts:17` has been reverted** to Sonnet baseline (working tree clean) per user direction so 8.1 starts from the pre-Iter-8 codebase; if 8.1 succeeds, Haiku will be re-applied as the SDK fallback model. New iteration order: **8.1 → 8 (decided by 8.1) → 4 → 3.** Iter 8.1 to be run in a fresh worker session; spec at `02_analysis.md §Iter 8.1`.
- **2026-05-11** **Iter 8.1 direction superseded by OpenRouter-only provider migration.** User approved removing the direct Claude SDK fallback entirely. Finance AI Insight now uses OpenRouter as the only model gateway: component/router primary `deepseek/deepseek-v4-flash`, summary/editor primary `z-ai/glm-5.1`, Claude only through OpenRouter fallback model slugs. Provider fallback happens first through approved OpenRouter provider order; model fallback happens second in code and only on technical errors. S05 smoke and S02 stress passed numeric guard with no material hallucination observed; headed Playwright verified the panel shows OpenRouter provider/model metadata.

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

### Superseded resume prompt — Iter 8.1 (historical)

This prompt is kept as history only. Do not use it for future work because the approved 2026-05-11 direction removed direct Claude SDK fallback and made OpenRouter the only AI Insight model gateway. Use `AI_Insight_Study/OPENROUTER_ONLY_PLAN.md` for the current provider plan.

> ```
> Resume AI Insight optimization. Read AI_Insight_Study/MASTER_LOG.md, HOW_TO_RUN_ITERATION.md,
> and AI_Insight_Study/02_analysis.md §Iteration 8.1.
> 
> Next iteration: Iter 8.1 — OpenRouter primary + Claude SDK fallback.
> 
> LOCKED CONFIG (do not re-discuss; act on these):
>   Model:        z-ai/glm-5.1
>   Provider:     Z.ai (pinned — not OpenRouter aggregate)
>                 https://openrouter.ai/z-ai/glm-5.1/providers
>   Pricing:      $1.40 input / $4.40 output / $0.26 cache-read per M tokens (Z.ai)
>   Context:      202,752 tokens, max output 131,072
>   Reasoning:    OFF for component-insight calls, ON for AI-Panel summary call
>   Slot policy:  GLM 5.1 for BOTH component and summary
>   Credential:   process.env.OPENROUTER_API_KEY
>                 (set in the dashboard app env, e.g. apps/dashboard/.env.local)
> 
> Cost projection: ~$0.13/click with reasoning ON for summary — near Sonnet baseline ($0.135),
> ~3x Iter-8 Haiku ($0.041). Iter 8.1 is a QUALITY + DIVERSIFICATION play, not a cost play.
> 
> HARD PREREQUISITE — pre-flight gate before any orchestrator integration:
>   Send a one-off OpenRouter request to z-ai/glm-5.1 (Z.ai-pinned) with a tools array and a
>   prompt that should trigger a tool call. Confirm the response contains a tool_calls block.
>   If unsupported -> abort Iter 8.1, do not edit orchestrator code.
> 
> Required Step-1 items before any code edit:
>   1. Pre-flight tool-calling probe outcome (PASS/FAIL). HARD GATE.
>   2. Verify Next.js dashboard process actually sees process.env.OPENROUTER_API_KEY.
>      Put the key in apps/dashboard/.env.local or another dashboard app env file outside version control.
>   3. Confirm OpenRouter's current `provider:` routing field syntax (the API has had a few
>      iterations — wrong field silently falls through to the cheapest provider, invalidating
>      the cost numbers).
>   4. Confirm cost ceiling: ~$0.13/click is acceptable as a quality+diversification trade.
>   5. Reasoning-tokens billing path: confirm OpenRouter sums reasoning tokens into
>      usage.completion_tokens; if separate, update client.ts pricing math.
>   6. Fallback trigger granularity (recommend: 5xx + rate-limit + timeout only).
> 
> Decision rule (post-runs):
>   - Tools unsupported at probe          -> ABORT 8.1, no code edits.
>   - Quality >= baseline on BOTH pilots
>     AND payment_outstanding hallucinations = 0
>     AND cost <= ~$0.135/click           -> ADOPT OpenRouter primary; re-apply Iter 8 (Haiku)
>                                           in client.ts:17 as the SDK fallback default.
>   - Quality >= baseline only on FV      -> 8.1 fails. Decide Iter 8 separately.
>   - Quality < baseline on either pilot
>     OR cost > ~$0.135/click             -> 8.1 fails. Revert Iter 8 (component=Haiku,
>                                           summary=Sonnet via Claude SDK).
> 
> Iter 8 (Sonnet->Haiku) has been reverted in apps/dashboard/src/lib/ai-insight/client.ts:17 —
> working tree is clean. The 8.1 study starts from the pre-Iter-8 baseline (Sonnet for summary,
> Haiku for components).
> 
> Process: same 14-step procedure in HOW_TO_RUN_ITERATION.md. Steps 1-3 (discuss, plan, get
> approval) happen before any code edit. Pilots: payment_outstanding (2 runs) +
> financial_variance (2 runs).
> 
> Decision rule (after running both pilots):
>   - Quality ≥ baseline on both pilots AND cost ≤ Iter-8 Haiku cost
>     → Adopt OpenRouter primary; keep Iter 8 (Haiku is the fallback).
>   - Otherwise → revert Iter 8 (component=Haiku, summary=Sonnet via Anthropic SDK).
> 
> Process: same 14-step procedure in HOW_TO_RUN_ITERATION.md. Steps 1-3 (discuss, plan, get approval)
> happen before any code edit. Pilots to run: payment_outstanding (2 runs) + financial_variance (2 runs).
> ```
