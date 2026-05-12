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

## Revised Rollout Decision - 2026-05-11

The rollout target is now **trusted executive insight**, not perfect AI output.

The core product problem is not insight usefulness. Current insights are generally useful. The remaining rollout work is to make the output accurate enough that users can trust the insight without turning the project into an endless hallucination chase.

### Acceptance Gate

A section can be accepted when all of these are true:

- Final Summary Insight has `3/3` numeric accuracy.
- Final output has no material hallucination.
- Overall quality is `>= 8/10`; target `>= 9/10` for Finance sections.
- Numeric guard passes within 2 attempts.
- Tool use is `<= 2` calls unless the evaluation shows a clearly useful drill-down reason.
- Failed tool calls are `0`, or the failure is immaterial and documented.
- Any remaining issue is minor and does not change the business interpretation.

### Material vs Minor Issues

Material hallucinations must be fixed before a section is accepted:

- Wrong RM, percent, days, count, or rank that changes the conclusion.
- Wrong trend direction, sequence, or comparison.
- Wrong customer, supplier, product, outlet, agent, or period attribution.
- Unsupported cause stated as fact.
- Any claim that could reasonably change an executive decision.

Minor issues can be accepted and documented:

- Soft, qualified language such as "may indicate" or "likely" when the core insight remains true.
- Small wording or clarity imperfections.
- One guard retry if the final output is clean.
- Relevance gaps that do not affect the main good/bad insight.

### New Section Rollout Pattern

For each section, roll out the following in order:

1. Keep the global numeric guard, retry flow, and prompt caching.
2. Audit fetchers for the section.
3. Add only necessary precomputed values: totals, ranks, ratios, subtotals, averages, growth, trend flags, or concentration labels.
4. Add every cited value to the section/component allowed-value whitelist.
5. Add short raw-data labels that prevent scope mixing, such as period, snapshot, active population, top-N, or full universe.
6. Keep Summary Insight tools available by default, but reduce the global summary tool cap from 4 to 2.
7. Fix tool schema fit where a section still needs tools.
8. Run one Playwright evaluation.
9. Accept, document minor residuals, or mark `Needs fix` only for material issues.

### Tool Policy Direction

Providing better raw data should reduce the need for tools, but precomputed data alone does not reliably stop the model from calling tools. The study already showed that the model may still call tools even when the data is present.

Therefore:

- Do not use `tool_policy = none` as the default rollout pattern.
- Default to keeping tools available and setting `MAX_TOOL_CALLS_PER_SUMMARY = 2`.
- Use `tool_policy = none` only when explicitly approved for a specific section.
- Treat tool calls as escalation for drill-down evidence, not the primary analysis path.
- If the model wastes tool calls after the cap is reduced to 2, improve raw data labels and tool schema fit before removing tools entirely.

### S01/S03/S04 Rebase Decision

Do not blindly revert all S01, S03, and S04 work.

Use a surgical rebase:

- Keep data-fetcher improvements that add accurate precomputed values and whitelist coverage.
- Revert or replace only changes that violate the new rollout direction.
- Specifically revisit `tool_policy = none` on S01 and S03.
- Treat S04 as implemented-but-not-accepted until its latest run is formally scored and added to this tracker.
- Avoid destructive git rollback because current working tree contains unrelated admin/config changes.

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

## Rollout Direction Corrections

- Section guidance rows should remain empty by default. Do not add section guidance for a rollout section unless the user explicitly approves it.
- Summary Insight should retain tool access. Do not treat `tool_policy = none` as the rollout pattern.
- To reduce bad tool calls, improve raw fetcher data, allowed-value coverage, and tool schema fit. Do not remove tools just to cut cost.
- S01 and S03 tool-policy revisit was completed on 2026-05-11: both now use `aggregate_only` and passed headed eval under the revised gate.

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
| S01 | `payment_collection_trend` | Payment | Done | Surgical rebase accepted; aggregate-only tools restored; failed calls immaterial |
| S02 | `payment_outstanding` | Payment | Done | Revalidated under revised gate; S02 rollups/guard false positives fixed |
| S03 | `sales_trend` | Sales | Done | Surgical rebase accepted; aggregate-only tools restored; failed calls immaterial |
| S04 | `sales_breakdown` | Sales | Done | Headed eval accepted; 2 valid no-row tool calls; no material hallucination |
| S05 | `customer_margin_overview` | Customer Margin | Done | OpenRouter headed eval accepted; fallback not used; 2 failed tool calls immaterial |
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
| S01 | `payment_collection_trend` | 2026-05-11 | Surgical rebase headed Playwright run | $0.0911 | 9/10 | 3/3 | 2/3 | 2/2 | 2/2 | 0 | Pass, attempt 2, unmatched 0 | 2 | 2 | Done | `apps/dashboard/logs/ai-debug-payment_collection_trend-2026-05-11T01-28-46.log` | `MAX_TOOL_CALLS_PER_SUMMARY=2` and tool policy restored to `aggregate_only`. Final output was numerically clean. Two aggregate-tool calls failed on invalid columns and the first summary attempt cited unsupported `8.4 days` / `2.6 days`, but the guard retry corrected the final output. Failed calls were immaterial to business meaning. |
| S02 | `payment_outstanding` | 2026-05-07 | Historical study Iteration 5 median | $0.11525 | 10/10 | 3/3 | 3/3 | 2/2 | 2/2 | 0 | Pass | See study logs | See study logs | Done | `AI_Insight_Study/03_iteration_05_caching.md` | Caching kept, numeric guard verified, zero hallucinations |
| S02 | `payment_outstanding` | 2026-05-11 | Revised-gate server run plus Playwright UI check | $0.1054 | 9/10 | 3/3 | 3/3 | 2/2 | 2/2 | 0 material | Pass, attempt 2, unmatched 0 | 2 | 1 | Done | `apps/dashboard/logs/ai-debug-payment_outstanding-2026-05-11T02-19-16.log` | Added S02 precomputed concentration, aging, risk-tier, credit-limit, and no-limit diagnostics. Fixed guard parsing for comma percentages such as `1,172%` and accepted supported lower-bound thresholds. Final output was numerically clean; one invalid tool call was immaterial and final retry passed. Added aging bucket day thresholds after the run to avoid future retry on `120 days` wording. |
| S03 | `sales_trend` | 2026-05-10 | Pre-fix Playwright run | $0.1347 | 7/10 | 2/3 | 1/3 | 2/2 | 2/2 | 1 | Pass, attempt 2, unmatched 0 | 4 | 2 | Needs fix | `apps/dashboard/logs/ai-debug-sales_trend-2026-05-10T12-32-07.log` | Summary used 4 tool calls despite raw data, with 2 schema failures. Final output falsely claimed an uninterrupted four-month May-to-September sales slide even though July rose from June. |
| S03 | `sales_trend` | 2026-05-10 | Post-fix headed Playwright run | $0.0446 | 9/10 | 3/3 | 2/3 | 2/2 | 2/2 | 0 | Pass, attempt 1, unmatched 0 | 0 | 0 | Done | `apps/dashboard/logs/ai-debug-sales_trend-2026-05-10T15-13-26.log` | Tool policy set to none after raw data gained precomputed YoY, MoM, rank, CN-ratio, half-period, and streak diagnostics. Cost down 66.9% vs failed run; minor relevance deduction for light causal language around seasonal cash sales/returns. |
| S03 | `sales_trend` | 2026-05-11 | Surgical rebase headed Playwright run | $0.0984 | 9/10 | 3/3 | 2/3 | 2/2 | 2/2 | 0 | Pass, attempt 2, unmatched 0 | 2 | 2 | Done | `apps/dashboard/logs/ai-debug-sales_trend-2026-05-11T01-30-00.log` | `MAX_TOOL_CALLS_PER_SUMMARY=2` and tool policy restored to `aggregate_only`. Final output was numerically clean and avoided the old false decline. Two aggregate-tool calls failed on invalid columns and first attempt hallucinated `RM 4,269,427.34`, but guard retry corrected the final output. Failed calls were immaterial to business meaning. |
| S04 | `sales_breakdown` | 2026-05-11 | First accepted headed Playwright run | $0.1178 | 9/10 | 3/3 | 2/3 | 2/2 | 2/2 | 0 | Pass, attempt 1, unmatched 0 | 2 | 0 | Done | `apps/dashboard/logs/ai-debug-sales_breakdown-2026-05-11T01-31-07.log` | Accepted as implemented. Final output surfaced material drivers: Caelen decline, CR-SL concentration, SRI TERNAK MART CN ratio, product/customer diversification, and Vincent growth. Tool calls were valid but returned no rows. Minor residuals: correct but derived arithmetic (`RM 2,637K`, `RM 15.9M`, `~RM 5.8M`) and some qualified causal wording; none changed business meaning. |
| S05 | `customer_margin_overview` | 2026-05-11 | OpenRouter headed Playwright run | $0.0162 | 9/10 | 3/3 | 2/3 | 2/2 | 2/2 | 0 material | Pass, attempt 2, unmatched 0 | 2 | 2 | Done | `apps/dashboard/logs/ai-debug-customer_margin_overview-2026-05-11T04-13-38.log` | Provider path verified: component model `deepseek/deepseek-v4-flash-20260423` via Parasail; summary model `z-ai/glm-5.1-20260406` via DeepInfra; Claude fallback not used. Final output was numerically clean and correctly surfaced the -186.39% margin collapse plus 13.61% net-sales growth. Two aggregate tool calls failed on invalid derived columns, but final output relied on raw S05 blocks and the failures were immaterial. No fresh Claude S05 baseline was captured in this one-run Phase 2 evaluation. |
| S05 | `customer_margin_overview` | 2026-05-11 | OpenRouter-only smoke plus headed metadata check | $0.0167 | Smoke pass | Not fully scored | Not fully scored | Not fully scored | Not fully scored | 0 material observed | Pass, attempt 2, unmatched 0 | 2 | 2 | Done | `apps/dashboard/logs/ai-debug-customer_margin_overview-2026-05-11T08-43-40.log` | Validated the OpenRouter-only provider migration after direct Claude SDK removal. Components used `deepseek/deepseek-v4-flash-20260423`; summary used `z-ai/glm-5.1-20260406`; model fallback not used; cost source was OpenRouter `usage.cost`. Separate headed Playwright check confirmed the panel displays Provider `OpenRouter` and Model `z-ai/glm-5.1`. |
| S02 | `payment_outstanding` | 2026-05-11 | OpenRouter-only stress plus headed metadata check | $0.0156 | Stress pass | 3/3 spot check | 3/3 spot check | Not fully scored | Not fully scored | 0 material observed | Pass, attempt 1, unmatched 0 | 2 | 2 | Done | `apps/dashboard/logs/ai-debug-payment_outstanding-2026-05-11T08-47-32.log` | Validated the OpenRouter-only provider migration on the arithmetic-risk section. Components used `deepseek/deepseek-v4-flash-20260423`; summary used `z-ai/glm-5.1-20260406`; model fallback not used; cost source was OpenRouter `usage.cost`. Two invalid-column tool calls were immaterial because final output relied on raw S02 blocks and passed numeric guard on the first final attempt. |

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
- Surgical rebase on 2026-05-11 restored `aggregate_only` tool access and capped summary tools at 2. Headed eval passed the revised acceptance gate. The two failed aggregate-tool calls were immaterial because the final output was clean after numeric-guard retry.

### S02 - `payment_outstanding`

Status: Done.

Historical state:

- S02 passed the earlier Iteration 5 caching study, but that was not the same as the revised rollout gate.
- The section already had useful insight quality; the gap was data/guard trust work under the new standard.

Fix implemented:

- Added precomputed S02 raw-data diagnostics and whitelist coverage for:
  - total outstanding top 3/top 5 concentration
  - overdue top 3/top 5 concentration and not-overdue amount
  - credit-limit breach share, shown breach outstanding, top 5 breach concentration
  - aging not-yet-due, overdue combined, 120+ bucket amount/share/count
  - credit-usage category shares
  - High + Moderate risk outstanding/share and top 3/top 5 customer concentration
- Added summary prompt wording that states the summary run has at most 2 tool calls and should use raw data first.
- Fixed numeric guard false positives:
  - comma percentages such as `1,172%` are now parsed as `1172%`, not a stray `172%`
  - supported lower-bound threshold wording such as "exceed 1,000 days" is allowed only when a whitelisted same-unit source value is beyond that threshold
  - S02 aging bucket day thresholds (`30`, `60`, `90`, `120`) were whitelisted so normal bucket wording does not force a retry

Accepted evaluation:

- Date: 2026-05-11
- Log: `apps/dashboard/logs/ai-debug-payment_outstanding-2026-05-11T02-19-16.log`
- Cost: `$0.1054`
- Tokens: `24,288`
- Numeric guard: passed on attempt 2 with 0 unmatched
- Tool calls: 2 total, 1 failed schema call; failure was immaterial
- Quality score: `9/10`
- Hallucinations: 0 material

Residual note:

- Final output is materially trustworthy: the three findings are the right executive risks — 100% 120+ overdue, 97% High/Moderate-risk exposure, and 21 credit-limit breaches.
- First summary attempt still retried on `120 days` bucket wording; the aging threshold whitelist was added after the accepted run to prevent that avoidable retry.

OpenRouter-only provider stress check:

- Date: 2026-05-11
- Log: `apps/dashboard/logs/ai-debug-payment_outstanding-2026-05-11T08-47-32.log`
- Cost: `$0.0156`
- Tokens: `16,157`
- Numeric guard: passed on attempt 1 with 0 unmatched
- Provider path: OpenRouter only; components used `deepseek/deepseek-v4-flash-20260423`; summary used `z-ai/glm-5.1-20260406`
- Model fallback: not used
- Cost source: OpenRouter `usage.cost`
- Headed Playwright metadata check passed for provider/model display

Residual note:

- The summary attempted 2 invalid-column tool calls. This remains a tool-schema cleanup issue, but it was immaterial in this run because the final output relied on raw S02 blocks and passed numeric guard on the first final attempt.

### S03 - `sales_trend`

Status: Done.

Initial evaluation run:

- Date: 2026-05-10
- Log: `apps/dashboard/logs/ai-debug-sales_trend-2026-05-10T12-32-07.log`
- Cost: `$0.1347`
- Tokens: `28,709`
- Numeric guard: passed on attempt 2 with 0 unmatched
- Tool calls: 4 total, 2 failed
- Quality score: `7/10`

Issues found:

- Summary called tools even though `pc_sales_daily` raw data already had the needed section evidence.
- First two tool calls used invalid columns:
  - `pc_sales_daily`: `year_month`, `total_net_sales`, `total_invoice_sales`, `total_cash_sales`, `total_credit_notes`
  - `pc_return_monthly`: `year_month`, `total_return_amount`, `return_count`
- Final output claimed a four-month uninterrupted May-to-September decline, but July rose from June.
- Component narratives could still back-solve companion values or misclassify the `1.13%` CN ratio without explicit status labels.

Fix implemented:

- Kept the Sales Trend KPI split so all four KPI AnalyzeIcons have matching component fetchers.
- Added precomputed Sales Trend diagnostics to raw data:
  - period/prior-year net sales and YoY %
  - monthly MoM %, YoY %, CN ratio, net-sales rank, CN rank
  - peak/trough months
  - longest growth/decline streaks
  - first-half vs last-half averages and lift
  - May-to-September change plus explicit note that July rose from June
- Added companion values/status labels to KPI raw blocks:
  - non-invoice net effect
  - non-cash net sales
  - credit notes share of net
  - CN status = Monitor
- Set `sales_trend` tool policy to `none`.

Post-fix headed evaluation:

- Date: 2026-05-10
- Log: `apps/dashboard/logs/ai-debug-sales_trend-2026-05-10T15-13-26.log`
- Cost: `$0.0446`
- Tokens: `11,312`
- Runtime: `41.8s` from headed Playwright UI run
- Numeric guard: passed on attempt 1 with 0 unmatched
- Tool calls: 0 total, 0 failed
- Quality score: `9/10`
- Hallucinations: 0

Residual note:

- Final output is numerically clean and avoids the false four-month decline. Relevance scored `2/3` because it still uses light causal language around seasonal cash sales/returns that is plausible but not proven by product/customer drill-down evidence.
- Surgical rebase on 2026-05-11 restored `aggregate_only` tool access and capped summary tools at 2. Headed eval passed the revised acceptance gate. The two failed aggregate-tool calls were immaterial because the final output was clean after numeric-guard retry.

### S04 - `sales_breakdown`

Status: Done.

Implementation state:

- S04 fetcher improvements were kept from the prior implementation pass.
- `sales_breakdown` tool policy stayed `full`.
- Section was treated as implemented-but-not-accepted until the 2026-05-11 headed evaluation.

Accepted evaluation:

- Date: 2026-05-11
- Log: `apps/dashboard/logs/ai-debug-sales_breakdown-2026-05-11T01-31-07.log`
- Cost: `$0.1178`
- Tokens: `29,989`
- Numeric guard: passed on attempt 1 with 0 unmatched
- Tool calls: 2 total, 0 failed; both valid calls returned no rows
- Quality score: `9/10`
- Hallucinations: 0 material

Residual note:

- Final output used correct but derived arithmetic (`RM 2,637K`, `RM 15.9M`, `~RM 5.8M`) and some qualified causal language.
- Under the revised gate, these are minor because they do not change the business interpretation: agent decline, outlet concentration, CN-risk customers, product/customer diversification, and Vincent growth are all supported by raw data.

### S05 - `customer_margin_overview`

Status: Done.

Accepted evaluation:

- Date: 2026-05-11
- Log: `apps/dashboard/logs/ai-debug-customer_margin_overview-2026-05-11T04-13-38.log`
- Provider path: OpenRouter primary; components used `deepseek/deepseek-v4-flash-20260423` via Parasail; summary used `z-ai/glm-5.1-20260406` via DeepInfra
- Claude fallback: not used; provider metadata stored with `fallbackUsed=false`
- Cost: `$0.0162`
- Tokens: `18,688`
- Numeric guard: passed on attempt 2 with 0 unmatched
- Tool calls: 2 total, 2 failed invalid-column aggregate calls; failures were immaterial to final output
- Quality score: `9/10`
- Hallucinations: 0 material

Residual note:

- Final output was numerically clean for all RM, percentage, and count citations: margin `-186.39%`, COGS `RM 232,676,122.44`, net sales `RM 81,245,243.49`, customer counts, and margin-distribution shares all trace to raw S05 blocks.
- Relevance scored `2/3` because the final output includes a generic account-level implication without naming customers and an approximate `3-6x` ratio. These are minor because the core interpretation is still supported: COGS spikes drove a severe margin collapse while top-line demand and customer count grew.
- No Phase 3 S05 tuning is recommended from this run. The useful follow-up is tool-schema cleanup later, not S05 fetcher or prompt tuning.

OpenRouter-only provider smoke check:

- Date: 2026-05-11
- Log: `apps/dashboard/logs/ai-debug-customer_margin_overview-2026-05-11T08-43-40.log`
- Cost: `$0.0167`
- Tokens: `18,912`
- Numeric guard: passed on attempt 2 with 0 unmatched
- Provider path: OpenRouter only; components used `deepseek/deepseek-v4-flash-20260423`; summary used `z-ai/glm-5.1-20260406`
- Model fallback: not used
- Cost source: OpenRouter `usage.cost`
- Headed Playwright metadata check passed for provider/model display
