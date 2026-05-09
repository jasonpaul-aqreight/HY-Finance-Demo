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

**Result (2026-05-07):** ⏸ Decision deferred — see `03_iteration_08_haiku_summary.md`. Cost target hit on both pilots (−74.9% on payment_outstanding, −69.6% on financial_variance). Quality split: payment_outstanding regressed 10/10 → 7.5/10 (Haiku fabricates derived sums the guard cannot catch); financial_variance held 9/10 → 9/10 with 0 hallucinations (pre-computed variance data plays to Haiku's synthesis strength). Final keep/revert decision contingent on Iter 8.1 outcome.

---

### Iteration 8.1: OpenRouter as Primary, Claude SDK as Fallback

**Status:** ⏳ Pending — to be run in a new worker session.

**What:** Refactor the AI Insight engine to call **OpenRouter** as the primary model provider for both **component insights (Haiku-class)** and **AI Panel summary (Sonnet-class)**. Keep the existing `@anthropic-ai/sdk` path as a hard fallback (network errors, rate limits, OpenRouter-side outages, or model-unavailable conditions).

The exact OpenRouter model under evaluation is **`z-ai/glm-5.1`** (GLM-5.1 from Z.ai / Zhipu AI; released 2026-04-07). This is the candidate for *both* slots (component + summary). User-provided link: https://openrouter.ai/z-ai/glm-5.1.

**Model + provider + reasoning policy (locked 2026-05-08 by user):**
- Model slug: `z-ai/glm-5.1`
- **Provider pinned:** **Z.ai** (NOT the OpenRouter aggregate route — user supplied https://openrouter.ai/z-ai/glm-5.1/providers screenshot)
- Z.ai input price: **$1.40 / 1M tokens**
- Z.ai output price: **$4.40 / 1M tokens**
- Z.ai cache read price: **$0.26 / 1M tokens** (cache write/storage cost not surfaced on the providers page — verify at session start)
- Context window: **202,752 tokens**, max output **131,072 tokens**
- Latency: ~4.66s, throughput ~26 tps (Z.ai-side, per OpenRouter dashboard)
- Reasoning-enabled model (exposes a `reasoning` parameter; reasoning tokens billed as output)
- **Reasoning policy (user direction):** OFF for component-insight calls; ON for AI-Panel summary call.
- Tool/function calling support **not explicitly confirmed** on the model page — must be verified at session start (see Open Questions)
- Credential env var: `OPEN_ROUTER_API` (currently in project-root `.env`; verify Next.js loads it or relocate to `apps/dashboard/.env.local`)

**Pricing reality check vs Iter 8 Haiku baseline (Z.ai-pinned pricing, with user's reasoning policy applied):**

| Model | Input $/M | Output $/M | Cache Read $/M |
|---|---|---|---|
| Claude Haiku 4.5 | 0.80 | 4.00 | 0.08 |
| **z-ai/glm-5.1 @ Z.ai** | **1.40** | **4.40** | **0.26** |
| Claude Sonnet 4.6 | 3.00 | 15.00 | 0.30 |

**Per-click cost estimate using user's reasoning policy:**

| Slot | Workload (rough) | Cost @ Z.ai pricing |
|---|---|---|
| 4 component calls (reasoning OFF) | ~12k input + ~4k output | ~$0.034 |
| 1 summary call (reasoning ON; chain-of-thought may 2–3× output) | ~22k input + ~15k output | ~$0.097 |
| **Total per click** | — | **~$0.13** |

**With summary reasoning ON, GLM 5.1 @ Z.ai lands near the Sonnet baseline (~$0.135) and well above Iter 8 Haiku (~$0.041).** Iter 8.1's case is therefore **quality + diversification, not cost.** The decision rule below is loosened accordingly: 8.1 is "kept" if it costs ≤ Sonnet baseline AND quality holds AND payment_outstanding's arithmetic is correct.

**Why:**
- **Iter 8 forced the question.** Sonnet→Haiku migration cuts cost by ~70% but breaks payment_outstanding because Haiku can't reliably do derived-sum arithmetic. We need a model that's Haiku-priced but can do that arithmetic — or we need a per-section selector. OpenRouter opens up a much larger model menu at competitive prices.
- **Quality, not cost, is the case for GLM 5.1.** Per the pricing table above, GLM 5.1 is slightly more expensive than Haiku on this workload. The bet is that GLM 5.1 (a reasoning-capable model) does derived-sum arithmetic correctly where Haiku fails, *and* does it cheaper than Sonnet — landing at "Sonnet-quality at ~30% of Sonnet price". If reasoning quality on payment_outstanding's derived-sum task is below Haiku, the candidate fails immediately.
- **Provider risk diversification:** Single-vendor dependency on Anthropic for production AI. A primary/fallback split improves availability and gives us a price-and-quality lever per section.
- **Architectural simplification:** if 8.1 wins, we ship one model for both component AND summary slots, replacing the current Haiku-vs-Sonnet split. No per-section selector needed.

**Implementation sketch (subject to refinement at Step 1 of next session):**
1. **Pre-flight tool-calling probe (BEFORE any production code edit):** issue a one-off OpenRouter request to `z-ai/glm-5.1` with our actual tools array and a trivial user message that should trigger a tool call. If the response includes a `tool_calls` block, we're green. If not, the candidate fails for the summary slot immediately and Iter 8.1 either shrinks to component-only or aborts. Don't write the orchestrator integration until this probe passes.
2. Introduce a thin provider abstraction: `callModel({ model, messages, tools, system, reasoning?, ... })` that:
   - Tries OpenRouter first (HTTPS to `https://openrouter.ai/api/v1/chat/completions`, OpenAI-style payload + tools schema)
   - On network error / 5xx / model-unavailable / rate-limit, falls back to `@anthropic-ai/sdk` (current code path) using `claude-haiku-4-5-20251001`
   - Returns a normalized response shape (`{ content, toolUse, usage, stop_reason }`) so the orchestrator doesn't care which provider answered.
3. Add `OPENROUTER_API_KEY` env var. Existing `ANTHROPIC_API_KEY` stays.
4. Pricing table in `client.ts` extended with `z-ai/glm-5.1` (`{ input: 1.05, output: 3.50 }`) for accurate cost estimation. Note reasoning tokens count as output for billing.
5. Logger (`debug-logger.ts`) records (a) which provider answered each turn, (b) reasoning tokens consumed (if any), (c) fallback events. Needed for the study's keep/revert call.
6. Tools-array translation: OpenRouter follows OpenAI-style tool schemas; Anthropic's `Anthropic.Tool` shape needs a small adapter. Verify both providers see the *same* whitelist + descriptions so the policy validator (`validateToolForSection`) keeps working.
7. Reasoning-mode policy: default `reasoning: { exclude: true }` (or whatever OpenRouter's "off" flag is) so reasoning tokens don't blow up the bill. If quality is poor with reasoning off, run a second comparison with reasoning on and document the cost delta.

**Decision rule (Z.ai-pinned pricing + user reasoning policy — after running on `payment_outstanding` and `financial_variance`):**

| OpenRouter outcome | Action |
|---|---|
| Tool calling **not supported** by `z-ai/glm-5.1` on OpenRouter (caught at pre-flight probe) | **Abort Iter 8.1 at the gate.** Pick a different OpenRouter model that supports tools, or re-open the per-section selector option for Iter 8. No code edits made. |
| Quality ≥ baseline on **both** pilots AND payment_outstanding hallucinations ≤ 0 AND cost ≤ Sonnet baseline (~$0.135/click) | **Adopt OpenRouter primary for both component + summary; Claude Haiku as SDK fallback.** Re-apply the Iter 8 swap in `client.ts:17` so the fallback default is Haiku, not Sonnet. |
| Quality ≥ baseline on **financial_variance only** (GLM 5.1 also fabricates derived sums on payment_outstanding) | **OpenRouter doesn't solve the synthesis-vs-computation dilemma. Iter 8.1 fails.** Decide Iter 8 separately: keep it for FV only (per-section selector), or revert globally. |
| Quality < baseline on **either pilot** OR cost > Sonnet baseline (~$0.135/click) | **Iter 8.1 fails. Revert Iter 8** (back to component=Haiku, summary=Sonnet via Claude SDK). Do not adopt OpenRouter. |

**Saving (estimated):** None on cost. With user's reasoning policy (ON for summary), GLM 5.1 @ Z.ai lands ~$0.13/click — same ballpark as Sonnet baseline ($0.135) and ~3× more than Iter 8 Haiku ($0.041). Iter 8.1 is a *quality + diversification* play, not a cost play. **If cost matters more than provider diversification, Iter 8 (Haiku-only) wins on FV and per-section selector wins overall — Iter 8.1 only justifies its added complexity if GLM 5.1's reasoning fixes the payment_outstanding arithmetic regression.**

**Risk:** Medium-High — multi-vendor surface area, tool-schema translation, fallback timeout/error semantics, latency profile differences.

**Effort:** 4–6h (provider abstraction + tool adapter + logger update + pricing table + 4 study runs across 2 pilots).

**Resolved before next session (do not re-discuss; act on these):**
- Model: `z-ai/glm-5.1` (confirmed by user 2026-05-08).
- Provider: **Z.ai** pinned (see https://openrouter.ai/z-ai/glm-5.1/providers). OpenRouter request must include `provider: { only: ["Z.ai"] }` (or equivalent per OpenRouter's current API spec) so requests don't fall through to a cheaper but unverified provider.
- Reasoning mode: **OFF for component-insight calls, ON for AI-Panel summary call.** Per-call toggle.
- Same model for both slots (no split).
- Credential env var: `OPEN_ROUTER_API`, currently in project-root `.env`.

**Open items to resolve at session start (Step 1):**
1. **Tool/function calling probe — HARD PREREQUISITE.** Send a one-off OpenRouter request to `z-ai/glm-5.1` with our actual tools array (or a minimal one) and a prompt that should trigger a tool call. Confirm `tool_calls` come back. **If unsupported, abort Iter 8.1 at the gate — do not write any orchestrator code.**
2. **Env-var loading.** `OPEN_ROUTER_API` lives in `/Users/aqreight/Documents/Projects/Hoi-Yong_Finance/.env`. Verify whether the dashboard Next.js dev server (started in `apps/dashboard/`) actually picks it up — Next.js auto-loads `.env.local`, `.env.development.local`, `.env.development`, `.env` from the **app root**, not the monorepo root. If `process.env.OPEN_ROUTER_API` is undefined in the dashboard process, copy/symlink the var to `apps/dashboard/.env.local`.
3. **Cost ceiling acceptance.** With reasoning ON for summary, projected cost ~$0.13/click — close to Sonnet baseline. Confirm user accepts this trade-off or instructs to abort. (Default: proceed; framed as quality+diversification per Decision Rule above.)
4. **Reasoning-tokens billing path.** Verify that OpenRouter passes through reasoning tokens via `usage.completion_tokens` so the existing `estimateCost` math doesn't undercount. If reasoning tokens come on a separate field (e.g. `reasoning_tokens`), update `client.ts` pricing logic to add them.
5. **Cache-write/storage cost.** Z.ai providers page surfaces cache *read* at $0.26/M but doesn't surface cache *write* cost. Check whether OpenRouter charges a write premium (Anthropic does, +25%); if so, factor into break-even math (caching only saves money after enough multi-turn reuse).
6. **Fallback trigger granularity:** fall back on (a) any error, (b) 5xx + rate-limit + timeout only, (c) configurable. Recommend (b) by default.
7. **Streaming:** current orchestrator is non-streaming; stay non-streaming for parity with Anthropic SDK path.
8. **`provider:` routing field name.** OpenRouter's API has had a few iterations of provider-pinning syntax (`provider: { order: [...] }`, `provider: { allow_fallbacks: false, order: [...] }`, etc.). Confirm the current spec at session start — the wrong field name silently falls back to the cheapest provider, which would invalidate the cost numbers.

**Active baseline this iteration must beat:**
- `payment_outstanding`: $0.11525, 10/10, 0 hallucinations (Iter 5)
- `financial_variance`: ~$0.135, 9/10, ~2 mild ratio hallucinations (Iter 5 effective)

**Out of scope this iteration:** Pricing optimization across multiple OpenRouter models (single-model A/B for now); per-section model selection (deferred to a possible Iter 8.2 if 8.1 doesn't resolve cleanly); migrating away from Anthropic SDK entirely (keep as fallback).

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
