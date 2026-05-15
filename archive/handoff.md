# AI Insight Improvement Handoff

Date: 2026-05-10
Project: `/Users/aqreight/Documents/Projects/Hoi-Yong_Finance`

## User Goal For Next Session

Continue the discussion on whether the AI Insight improvements verified on `payment_outstanding` have been rolled out to the entire dashboard.

The user believes `payment_outstanding` is now good enough and does not want more optimization work on that section for now.

## Important Process Rule

For any new AI Insight optimization implementation:

1. Discuss first.
2. Write a concise change plan.
3. Get explicit approval before code edits.
4. Ask before committing.

The current task is discovery/discussion first, not implementation.

## Current Verified Runtime State

Verified from code, study docs, runtime logs, and live DB prompt rows.

### Live Architecture

- Component insight calls use Haiku:
  - `AI_MODEL = claude-haiku-4-5-20251001`
  - no tools
  - one call per component
- Summary insight calls use Sonnet:
  - `SUMMARY_MODEL = claude-sonnet-4-6`
  - tools enabled depending on section tool policy
  - numeric guard runs after summary generation
- Runtime prompts are DB-backed through `ai_insight_prompts`.
  - Defaults in `prompts-defaults.ts` are fallback/seed text, not always the live prompt.
- Summary reads raw fetcher data, not Haiku component narration.

Key files:

- `apps/dashboard/src/lib/ai-insight/client.ts`
- `apps/dashboard/src/lib/ai-insight/orchestrator.ts`
- `apps/dashboard/src/lib/ai-insight/prompts.ts`
- `apps/dashboard/src/lib/ai-insight/prompt-loader.ts`
- `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`
- `apps/dashboard/src/lib/ai-insight/numeric-guard.ts`
- `apps/dashboard/src/lib/ai-insight/tool-policy.ts`
- `apps/dashboard/src/lib/ai-insight/tools.ts`

## Confirmed Improvements On `payment_outstanding`

### 1. Numeric Guard Is Live

Code:

- `orchestrator.ts`
  - aggregates `allowed` values from component fetchers
  - extracts tool-result numbers
  - runs `runNumericGuard`
  - retries once with `formatGuardError`
- `numeric-guard.ts`
  - handles RM, percent, days, counts
  - supports comma-separated days/counts
  - supports tool-result bare-number extraction
  - has rounding tolerance for RM, percent, days

Effect from study:

- Baseline: about 2 hallucinations, quality 9/10.
- After guard fix: 0 hallucinations, quality 10/10.

### 2. Prompt Caching Is Live

Code:

- `orchestrator.ts`
  - `CACHE_MARKER = { cache_control: { type: 'ephemeral' } }`
  - component system prompt uses system block array with cache marker
  - summary system prompt uses system block array with cache marker

Actual measured behavior:

- Haiku component calls did not benefit because the global system prompt is too small for Haiku caching threshold.
- Sonnet summary calls benefited because the tools prefix is implicitly cached with the system marker.

Effect from study:

- `payment_outstanding` cost improved from `$0.134` to `$0.11525`.
- Quality stayed 10/10.
- Hallucinations stayed 0.

### 3. Pre-Calculated Runtime Raw Data Exists

The `payment_outstanding` component fetchers pre-calculate and inject raw data used by the Summary Insight prompt.

Examples:

- Total outstanding value.
- Top 5 outstanding contributors and share of total.
- Overdue total, overdue percent, overdue customer count.
- Top overdue customers and max overdue days.
- Aging bucket amount, share, invoice count.
- Credit limit breach count.
- Top 10 breach customers with credit limit, outstanding, utilization.
- Credit usage distribution counts.
- Customer credit health risk tier distribution and outstanding shares.
- Top 5 by outstanding, max overdue days, and utilization.
- Score configuration weights and thresholds.

Important distinction:

- This pre-calculated raw data exists at runtime.
- But the specific study iteration "Iteration 4: pre-compute subtotals + strengthen no-arithmetic rule" was not completed as a kept iteration for `payment_outstanding`.

## `payment_outstanding` End State

From `AI_Insight_Study/MASTER_LOG.md`:

- Baseline: `$0.141/click`, quality `9/10`, about `2` hallucinations.
- Iteration 1 guard fix: `$0.134/click`, quality `10/10`, `0` hallucinations.
- Iteration 5 prompt caching: `$0.11525/click`, quality `10/10`, `0` hallucinations.

User conclusion this session:

- This is enough improvement.
- Result is already good.
- Do not continue optimizing `payment_outstanding` unless explicitly asked.

## Not Live / Not Kept

- Column schema hint:
  - tested in Iteration 2
  - reverted because cost increased
- Summary model Sonnet to Haiku:
  - tested in Iteration 8
  - reverted/deferred because `payment_outstanding` quality dropped to 7.5/10
- OpenRouter / GLM:
  - pending study item, not implemented
- Tool cap 4 to 2:
  - pending
- Combine component calls:
  - skipped
- Tool removal:
  - removed from roadmap for `payment_outstanding`; tools are considered important for drill-down evidence

## Question For Next Session

Investigate whether the kept improvements are dashboard-wide or section-specific:

1. Numeric guard:
   - Is it applied to every section summary?
   - Do all fetchers provide meaningful `allowed` values?
   - Are there sections where guard coverage is weak because fetchers return incomplete allowed whitelists?

2. Prompt caching:
   - Is it applied globally to all component and summary calls?
   - Which sections actually benefit?
   - Which models/prompts are too small to cache?

3. Pre-calculated raw data:
   - Which sections/components already include pre-calculated totals, shares, ratios, growth, subtotals, or averages?
   - Which sections still force the model to do arithmetic?
   - Which sections have fetchers with raw rows but no safe pre-computed summary values?

4. Tool policy:
   - Which sections use `full`, `aggregate_only`, or `none`?
   - Which sections still waste tool calls due to schema mismatch or missing prefetch data?

5. Prompt rollout:
   - Since prompts are DB-backed, check live `ai_insight_prompts`, not just `prompts-defaults.ts`.
   - Verify whether current prompt improvements are truly present in the live DB rows.

## Suggested First Commands Next Session

```bash
git status --short
sed -n '1,120p' AI_Insight_Study/MASTER_LOG.md
sed -n '1,220p' apps/dashboard/src/lib/ai-insight/orchestrator.ts
sed -n '1,260p' apps/dashboard/src/lib/ai-insight/numeric-guard.ts
sed -n '1,140p' apps/dashboard/src/lib/ai-insight/tool-policy.ts
rg -n "allowed:|const allowed|pre-calculated|Pre-calculated|do NOT recompute|Do NOT|share|pct|total|subtotal|average|growth" apps/dashboard/src/lib/ai-insight/data-fetcher.ts
```

If DB prompt verification is needed:

```bash
set -a
source .env
set +a
psql "$DATABASE_URL" -Atc "SELECT prompt_key, category, length(prompt_text), updated_by FROM ai_insight_prompts ORDER BY category, sort_order, prompt_key;"
```

## Current Git Note

At the time of this handoff, the worktree already had unrelated pending modifications before this investigation. Do not revert them.

Observed dirty files included AI Insight config/admin UI and AI Insight prompt/fetcher files. Check `git status --short` before any work.
