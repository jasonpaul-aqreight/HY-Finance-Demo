# AI Insight Improvement Rollout Tracker

Date created: 2026-05-10
Scope: Finance dashboard AI Insight sections only

## Purpose

Track rollout of the kept AI Insight improvements across all Finance dashboard sections.

Kept global improvements already present:

- Numeric guard retry flow in `orchestrator.ts` and `numeric-guard.ts`
- Prompt caching markers in `orchestrator.ts`
- Summary prompt reads raw fetcher data, not component narration

Section-specific rollout still needs verification because data fetchers, allowed-value whitelists, tool policy, and arithmetic risk differ by section.

## Resume Instruction

For a future session, use this prompt:

`[$bmad-agent-dev] Resume AI Insight Improvement Rollout Section <ID>. Read AI_Insight_Study/ROLLOUT_TRACKER.md, handoff.md, AI_Insight_Study/MASTER_LOG.md, and AI_Insight_Study/02_analysis.md. Continue only the requested rollout section. Follow discuss -> plan -> approval -> implement -> one Playwright eval -> update tracker table -> ask before commit.`

Example:

`[$bmad-agent-dev] Resume AI Insight Improvement Rollout Section 5. Read AI_Insight_Study/ROLLOUT_TRACKER.md, handoff.md, AI_Insight_Study/MASTER_LOG.md, and AI_Insight_Study/02_analysis.md. Continue only S05 customer_margin_overview. Follow discuss -> plan -> approval -> implement -> one Playwright eval -> update tracker table -> ask before commit.`

## Process

1. Pick exactly one section ID.
2. Audit that section's component fetchers, allowed values, raw prompt data, and tool policy.
3. Discuss the section-specific problem and change approach.
4. Write a concise change plan.
5. Get explicit approval before implementation.
6. Implement only the approved section change.
7. Run one Playwright evaluation for that section.
8. Score using `AI_Insight_Study/eval_set/quality_rubric.md`.
9. Update the rollout checklist and evaluation table.
10. Ask before committing.

## Quality Issue Handling

If a section evaluation finds hallucinations, weak relevance, low actionability, unclear structure, failed tool calls, or any quality score below production-ready:

1. Do not mark the section done.
2. Set the checklist status to `Needs fix`.
3. Add the failed run to the Evaluation Table with concrete evidence.
4. Summarize the exact issues under that section's notes.
5. Propose a targeted fix plan before implementation.
6. Implement only after explicit approval.
7. Re-run one Playwright evaluation after the fix.
8. Add the new evaluation row and mark the section `Done` only if it passes.

## Rollout Checklist

| ID | Section Key | Page | Status | Notes |
|---|---|---|---|---|
| S01 | `payment_collection_trend` | Payment | Done | Post-fix eval passed; cost down and no hallucinations |
| S02 | `payment_outstanding` | Payment | Done | Verified in study, post Iteration 5 |
| S03 | `sales_trend` | Sales | Pending |  |
| S04 | `sales_breakdown` | Sales | Pending |  |
| S05 | `customer_margin_overview` | Customer Margin | Pending |  |
| S06 | `customer_margin_breakdown` | Customer Margin | Pending |  |
| S07 | `supplier_margin_overview` | Supplier Performance | Pending |  |
| S08 | `supplier_margin_breakdown` | Supplier Performance | Pending |  |
| S09 | `return_trend` | Returns | Pending |  |
| S10 | `return_unsettled` | Returns | Pending |  |
| S11 | `expense_overview` | Expenses | Pending |  |
| S12 | `expense_breakdown` | Expenses | Pending |  |
| S13 | `financial_overview` | Financial | Pending |  |
| S14 | `financial_pnl` | Financial | Pending |  |
| S15 | `financial_balance_sheet` | Financial | Pending |  |
| S16 | `financial_variance` | Financial | Pending | Pilot history exists; not yet marked rollout-complete |

## Out Of Scope

The following HR scaffold section keys are registered in code but not part of this Finance rollout because they have empty component arrays and no production analyze flow yet:

- `employee_demographics`
- `attendance_leave`
- `overtime_work_hours`
- `payroll_compensation`
- `performance_talent`

## Evaluation Table

Use one Playwright evaluation run per section unless the user requests more.

| ID | Section Key | Date | Eval Source | Cost/Click | Quality | Numeric Accuracy | Relevance | Actionability | Clarity | Hallucinations | Numeric Guard | Tool Calls | Failed Tool Calls | Result | Log / Evidence | Notes |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|---|
| S01 | `payment_collection_trend` | 2026-05-10 | One Playwright run | $0.0704 | 6/10 | 0/3 | 2/3 | 2/2 | 2/2 | 1 | Pass, attempt 1, unmatched 0 | 4 | 2 | Needs fix | `apps/dashboard/logs/ai-debug-payment_collection_trend-2026-05-10T14-40-09.log` | Final output included banned derived `RM -1,055,577 est.` full-period avg gap; also claimed Jan 2025 collection days were second-highest though 39.1 days was not. Tool calls first used invalid columns for `pc_ar_monthly` and `pc_ar_aging_history`, adding cost. |
| S01 | `payment_collection_trend` | 2026-05-10 | Post-fix Playwright run | $0.0625 | 9/10 | 3/3 | 2/3 | 2/2 | 2/2 | 0 | Pass, attempt 2, unmatched 0 | 0 | 0 | Done | `apps/dashboard/logs/ai-debug-payment_collection_trend-2026-05-10T14-50-10.log` | Cost reduced 11.2% vs failed run. Final output used pre-calculated average gap and rank checks correctly. Minor relevance deduction for unsupported causal phrase: "likely tied to the CNY/holiday payment cycle." |
| S02 | `payment_outstanding` | 2026-05-07 | Historical study Iteration 5 median | $0.11525 | 10/10 | 3/3 | 3/3 | 2/2 | 2/2 | 0 | Pass | See study logs | See study logs | Done | `AI_Insight_Study/03_iteration_05_caching.md` | Caching kept, numeric guard verified, zero hallucinations |

## Section Notes

### S01 - `payment_collection_trend`

Status: Done.

Evaluation run:

- Date: 2026-05-10
- Log: `apps/dashboard/logs/ai-debug-payment_collection_trend-2026-05-10T14-40-09.log`
- Cost: `$0.0704`
- Tokens: `17,088`
- Runtime: `54.9s`
- Numeric guard: passed on attempt 1 with 0 unmatched
- Tool calls: 4 total, 2 failed
- Quality score: `6/10`

Issues found:

- Summary output derived a full-period average gap (`RM -1,055,577 est.`) instead of copying a pre-calculated line. This violates the section prompt's no-arithmetic rule.
- Summary output described Jan 2025's `39.1 days` as second-highest collection days; this is incorrect against the raw monthly collection-days table.
- First tool turn requested invalid columns:
  - `pc_ar_monthly`: `ending_ar`, `total_invoiced`, `total_collected`, `collection_rate`
  - `pc_ar_aging_history`: `snapshot_month`, `current_ar`, `overdue_1_30`, `overdue_31_60`, `overdue_61_90`, `overdue_91_plus`, `total_ar`

Fix implemented:

- Added explicit collection-days slowest/fastest rank lines to the S01 fetchers.
- Added explicit full-period average gap per month to the `invoiced_vs_collected` raw block and allowed whitelist.
- Set `payment_collection_trend` tool policy to `none` because the section now has sufficient raw evidence and tool calls were wasting cost on schema errors.

Post-fix evaluation:

- Date: 2026-05-10
- Log: `apps/dashboard/logs/ai-debug-payment_collection_trend-2026-05-10T14-50-10.log`
- Cost: `$0.0625`
- Tokens: `11,998`
- Runtime: `53.1s`
- Numeric guard: passed on attempt 2 with 0 unmatched
- Tool calls: 0 total, 0 failed
- Quality score: `9/10`
- Hallucinations: 0

Residual note:

- First summary attempt still produced unsupported derived day-gap values and required one guard retry. Final output was clean.
- Final output included one unsupported causal phrase ("likely tied to the CNY/holiday payment cycle"), so relevance was scored `2/3` instead of `3/3`.
