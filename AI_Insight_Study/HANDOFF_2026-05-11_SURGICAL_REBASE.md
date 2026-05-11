# AI Insight Rollout Handoff - Surgical Rebase

Date: 2026-05-11
Owner context: PM discussion with Aqreight
Status: Planning complete, implementation not started

## User Decision

Aqreight wants to stop chasing perfect hallucination-free output and instead roll out AI Insight with a practical trust standard.

The product target is:

- useful executive insight
- accurate enough to trust
- no material hallucinations
- accept minor issues that do not change the business meaning

The next implementation should use the revised rollout standard already added to `AI_Insight_Study/ROLLOUT_TRACKER.md`.

## Key Product Decision

Do not blindly revert S01, S03, and S04.

Use a surgical rebase:

- Keep fetcher improvements that add explicit raw data, precomputed totals, ratios, ranks, trend flags, and whitelist coverage.
- Revert or replace only changes that violate the new rollout direction.
- Specifically revisit S01/S03 `tool_policy = none`.
- Treat S04 as implemented-but-not-accepted until formally scored and recorded.

## Correct Rollout Pattern Going Forward

For each Finance section:

1. Keep global numeric guard, retry flow, and prompt caching.
2. Audit section fetchers.
3. Add only necessary precomputed values: totals, ranks, ratios, subtotals, averages, growth, trend flags, concentration labels.
4. Add those values to the allowed-value whitelist.
5. Add scope/population labels so the model does not mix period, snapshot, top-N, active population, or full universe values.
6. Keep Summary Insight tools available by default.
7. Reduce summary tool cap from 4 to 2.
8. Fix tool schema fit where tools are still needed.
9. Run one Playwright evaluation.
10. Accept if there are no material hallucinations, even if minor issues remain.

## Acceptance Gate

A section can be accepted when:

- Final Summary Insight has 3/3 numeric accuracy.
- Final output has no material hallucination.
- Overall quality is >= 8/10; target >= 9/10 for Finance.
- Numeric guard passes within 2 attempts.
- Tool use is <= 2 calls unless clearly justified by useful drill-down.
- Failed tool calls are 0, or immaterial and documented.
- Remaining issues do not change the business interpretation.

Material hallucinations that must be fixed:

- Wrong RM, percent, days, count, or rank that changes the conclusion.
- Wrong trend direction, sequence, or comparison.
- Wrong customer, supplier, product, outlet, agent, or period attribution.
- Unsupported cause stated as fact.
- Any claim that could reasonably change an executive decision.

Minor issues that can be accepted:

- Soft, qualified language like "may indicate" or "likely" when the core insight remains true.
- Small wording or clarity issues.
- One numeric-guard retry if final output is clean.
- Relevance gaps that do not affect the main good/bad insight.

## Current Code/Tracker State

Important: current working tree is dirty with unrelated admin/config changes. Avoid destructive git revert.

Known relevant state before implementation:

- `AI_Insight_Study/ROLLOUT_TRACKER.md` was updated with the revised rollout decision and acceptance gate.
- `apps/dashboard/src/lib/ai-insight/orchestrator.ts`
  - current `MAX_TOOL_CALLS_PER_SUMMARY = 4`
  - next change should set this to `2`
- `apps/dashboard/src/lib/ai-insight/tool-policy.ts`
  - current `payment_collection_trend: 'none'`
  - current `sales_trend: 'none'`
  - current `sales_breakdown: 'full'`
  - next change should set S01/S03 back to tool-enabled policy, recommended `aggregate_only`
- `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`
  - contains useful S01/S03/S04 fetcher improvements
  - do not revert wholesale

Latest S04 evidence:

- Logs exist:
  - `apps/dashboard/logs/ai-debug-sales_breakdown-2026-05-10T15-37-33.log`
  - `apps/dashboard/logs/ai-debug-sales_breakdown-2026-05-10T15-41-43.log`
- Latest S04 run still had summary tool calls and numeric guard passed on attempt 2.
- S04 is still `Pending` in tracker, so it is not formally accepted.

## Exact Next Implementation Plan

After user approval in the new session:

1. Change `MAX_TOOL_CALLS_PER_SUMMARY` from 4 to 2 in `apps/dashboard/src/lib/ai-insight/orchestrator.ts`.
2. Change S01 `payment_collection_trend` from `none` to `aggregate_only` in `apps/dashboard/src/lib/ai-insight/tool-policy.ts`.
3. Change S03 `sales_trend` from `none` to `aggregate_only` in `apps/dashboard/src/lib/ai-insight/tool-policy.ts`.
4. Keep S01/S03/S04 data-fetcher improvements.
5. Run one evaluation each for:
   - S01 `payment_collection_trend`
   - S03 `sales_trend`
   - S04 `sales_breakdown`
6. Score using the new material/minor hallucination standard.
7. Update `AI_Insight_Study/ROLLOUT_TRACKER.md`.
8. Ask Aqreight before committing.

## Prompt For New Session

Use this prompt:

```text
[$bmad-agent-dev]
Resume AI Insight Improvement Rollout surgical rebase.

Read:
- AGENTS.md
- AI_Insight_Study/ROLLOUT_TRACKER.md
- AI_Insight_Study/HANDOFF_2026-05-11_SURGICAL_REBASE.md
- AI_Insight_Study/MASTER_LOG.md
- AI_Insight_Study/02_analysis.md

Context:
We decided the target is trusted executive insight, not perfect hallucination elimination. Accept minor issues if they do not change business meaning. Fix only material hallucinations.

Implement only the approved surgical rebase:
1. Set `MAX_TOOL_CALLS_PER_SUMMARY` from 4 to 2.
2. Set S01 `payment_collection_trend` tool policy from `none` to `aggregate_only`.
3. Set S03 `sales_trend` tool policy from `none` to `aggregate_only`.
4. Do not blindly revert S01/S03/S04 fetcher improvements.
5. Treat S04 `sales_breakdown` as implemented-but-not-accepted until evaluated.

Then run one evaluation each for S01, S03, and S04, score using the revised acceptance gate in ROLLOUT_TRACKER.md, update the tracker, and ask before committing.

Important:
- Current working tree may be dirty with unrelated admin/config changes. Do not use destructive revert.
- Do not work in `/Users/aqreight/Documents/Projects/Hoi-Yong_HR`.
- Follow discuss -> plan -> approval -> implement -> eval -> update tracker -> ask before commit.
```
