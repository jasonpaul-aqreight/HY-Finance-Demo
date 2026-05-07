# Baseline — financial_variance (Pilot Switch)

> Captured 2026-05-07 as a fresh baseline after switching pilot section from `payment_outstanding` to `financial_variance`. Reason: payment_outstanding hit a quality ceiling (10/10 after Iter 1) leaving no measurable headroom for subsequent iterations. financial_variance was selected because (a) the stale Apr 19 log showed it as the most expensive non-pilot section, (b) variance analysis is arithmetic-heavy (good Iter 4 proving ground), and (c) it was the most strategic section (a finance dashboard's variance view is high-stakes).

## Section Profile

| Property | Value |
|---|---|
| Section key | `financial_variance` |
| Page | `/financial` (4th "Get Insight" — "Variance, Forecast & Budget") |
| Scope | `fiscal_period` (FY2025 / fy) |
| Tool policy | `aggregate_only` (only `query_local_table` on aggregate `pc_*` tables) |
| Components | 4 (Haiku): `fv_variance_summary`, `fv_variance_breakdown`, `fv_trend_forecast`, `fv_budget_suggestions` |
| Summary model | `claude-sonnet-4-6` |
| Numeric guard | Active (post-Iter-1 fix) |

## Run Metrics

| | Run 1 | Run 2 | Median |
|---|---|---|---|
| Cost (USD) | $0.1500 | $0.1488 | **$0.1494** |
| Total tokens | 41,306 | 39,608 | 40,457 |
| Latency | 74s | 68s | 71s |
| Components | 4 | 4 | 4 |
| Component cost | ~$0.015 | ~$0.016 | ~$0.015 |
| Summary cost | ~$0.135 | ~$0.133 | ~$0.134 |
| Sonnet turns | 3 (tool, tool, end) | 3 (tool, tool, end) | 3 |
| Tool calls (summary) | 4 (3 failed, 1 returned wrong-period data) | 4 (≥2 failed) | 4 |
| Numeric Guard | Pass Attempt 1, 0 unmatched | Pass Attempt 1, 0 unmatched | ✅ |
| Insights produced | 6 (3 bad + 3 good) | 6 (3 bad + 3 good) | 6 |

## Quality Score (vs `eval_set/quality_rubric.md`)

| Sub-score | Run 1 | Run 2 | Median |
|---|---|---|---|
| Numeric Accuracy (0–3) | 2 | 2 | **2** |
| Relevance (0–3) | 3 | 3 | **3** |
| Actionability (0–2) | 2 | 2 | **2** |
| Clarity (0–2) | 2 | 2 | **2** |
| **TOTAL (max 10)** | **9** | **9** | **9** |
| Hallucinations | 1 (mild ratio) | 3 (mild ratios) | ~2 |

### Hallucinations Detected (Mild — Computed Ratios)

The numeric guard says "0 unmatched" on both runs, but manual inspection found **computed-ratio violations** that slip past the guard. The guard checks RM/pct/days/count tokens against an allowed list; ratio expressions like `2.6×` and percentages computed from given numbers are not caught.

| Run | Hallucination | Source | Severity |
|---|---|---|---|
| 1 | "costs outpaced revenue by **2.7×**" | 5.3% / 2.0% computed ratio | Low |
| 2 | "costs grew **2.6×** faster than revenue" | 5.3% / 2.0% computed ratio | Low |
| 2 | "cash sales now represent just **9.2%** of gross sales" | 7,730,590 / 84,153,027 = 9.2% computed | Low |
| 2 | "down from ~**11.5%** prior year" | 9,458,964 / 82,236,513 = 11.5% computed (hedged with ~) | Low |

These are **technically violations** of the prompt rule "Cite RM amounts and percentages exactly as given. Do NOT recompute" — but the math is correct, the values are derived from numbers that ARE in the data block, and the language is hedged. A senior director reading these would not be misled.

## Cost Driver Analysis

The Sonnet summary phase consumes **~$0.134 of the $0.149 total (90%)**. Within the summary phase, the cost breaks down as:

| Turn | Purpose | Cost (Run 1) | Notes |
|---|---|---|---|
| TURN 1 | First Sonnet response — 2 tool calls | $0.028 | Both calls **failed** ("Columns not allowed") |
| TURN 2 | Sonnet retry — 2 more tool calls | $0.029 | 1 succeeded but returned **2021 data** (wrong period); 1 failed |
| TURN 3 | Sonnet writes final ===INSIGHT=== response | ~$0.078 | The actual analysis |
| **Tool-retry overhead** | TURN 1 + TURN 2 | **~$0.057 wasted** | **Zero value added to final output** |

### Tool Call Failure Pattern (Same as payment_outstanding baseline)

Sonnet repeatedly invents friendly column names that don't exist on `pc_*` aggregate tables:

```
pc_pnl_period          → tries: period_label, net_sales, gross_profit, ... (rejected)
                          actual: period_no, acc_type, acc_no, account_name, home_dr, home_cr
pc_expense_monthly     → tries: expense_month, category, total_amount   (rejected)
                          actual: month, acc_no, account_name, acc_type, net_amount
pc_supplier_margin     → tries: supplier_name, total_purchases, margin_pct (rejected)
                          actual: month, creditor_code, creditor_name, item_code, ...
```

Even when Sonnet retries with corrected column names, it asks for `month ASC LIMIT 100` and gets data from **2021** (way outside FY2025) — useless for the FY2025 analysis.

## Headroom Map (For Iteration Selection)

Given baseline = $0.149 cost / 9/10 quality:

| Iteration | Estimated Saving | Confidence | Risk | Notes |
|---|---|---|---|---|
| **4** Pre-compute subtotals + tighten no-arith | < $0.005 | Med | Low | Already partly done in component prompts. Could push 9→10 by killing computed ratios. |
| **5** Prompt caching | $0.005–0.010 | Med | Low | System prompts differ per component; cache hit window narrow. |
| **6** Combine 4 Haiku components → 1 call | $0.005–0.010 | Med | Med | API call overhead saved; per-component fidelity risk. |
| **7** Pre-fetch monthly P&L by category | **$0.020–0.057** | **High** | Low–Med | **Biggest single lever for this section.** Eliminates the 3 failed + 1 useless tool calls. Pre-fetch monthly Operating Costs and COGS breakdowns into the data block. |
| **8** Sonnet → Haiku for summary | $0.080–0.100 | High | High | Quality regression risk; would need careful eval. |

## Eval Set

- `eval_set/financial_variance/expected_values.json` — pre-computed values from data block (Run 1 fixture)
- `eval_set/financial_variance/snapshot_state.md` — DB snapshot at baseline run time
- `eval_set/quality_rubric.md` — reused as-is

Logs:
- `baseline_financial_variance_run1_full_log.log` — Run 1 (2026-05-07T14-07-42)
- `baseline_financial_variance_run2_full_log.log` — Run 2 (2026-05-07T14-09-57)

## Verdict

**Baseline accepted.** Cost = $0.1494 / quality = 9/10 / hallucinations ≈ 2 mild computed ratios per run.

**Recommended next iteration: Iter 7 (pre-fetch tool data)** — the wasted-tool-call signature is the dominant cost driver here, and pre-fetching monthly Operating Costs / COGS breakdown is a low-risk surgical fix that should save $0.020–$0.057 per run with no quality risk. Iter 4 (no-arithmetic) addresses real but mild infractions and would not move the cost needle on this section.
