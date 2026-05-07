# Iteration 7 — Pre-fetch Monthly P&L Data (financial_variance)

## Spec

Pre-fetch the monthly data Sonnet's tool calls were reaching for, with the goal of eliminating wasted "Columns not allowed" failures and the redundant retry turn. Original Iter 7 spec rescoped from `payment_outstanding` to `financial_variance` (current pilot) — see `01_baseline_financial_variance.md`.

## Implementation

### Code changes

**1. `data-fetcher.ts` — `fv_trend_forecast`** (~line 3970)
Extended the monthly trend table from 3 columns to 5 columns by adding `Cost of Sales` and `Operating Costs`. Both fields were already computed in `FinMonthlyRow`; the change only exposes them in the markdown output and adds them to the `allowed` whitelist.

**2. `data-fetcher.ts` — `fv_variance_breakdown`** (~line 3877)
Added a new "Monthly Operating Costs by Category" sub-table at the end of the data block. Backed by a new helper `queryMonthlyOpExByCategory()` that aggregates `pc_pnl_period` rows by `(period_no, parent_acc_no→category)` for the FY2025 window. Top-5 categories chosen by absolute total. Also identifies the peak-OpEx month with its share of FY total — the cost-surge timing answer Sonnet was reaching for.

**3. `data-fetcher.ts` — new helper** (~line 2995)
`queryMonthlyOpExByCategory(periodFrom, periodTo)` — single SQL query against `pc_pnl_period` filtered to `acc_type = 'EP'`, grouped by `period_no` + `COALESCE(parent_acc_no, acc_no)`, then mapped to category names via `getExpenseCategory()` from `lib/shared/expense-categories.ts`.

**4. `prompts.ts`** — updated `fv_variance_breakdown` and `fv_trend_forecast` component descriptions to advertise the new pre-fetched data and explicitly tell the analyst "do NOT query pc_pnl_period or pc_expense_monthly — it's already here."

**Files changed:** 2 (`data-fetcher.ts`, `prompts.ts`). No DB migrations.

### Cosmetic bug introduced

`### Monthly Operating Costs by Category (top 5 categories, FY${period.fiscalYear})` — `period.fiscalYear` is already `"FY2025"`, so the header renders as `"FYFY2025"`. Cosmetic only — Sonnet ignored the malformed header. Will fix as a 1-character cleanup commit.

## Run Metrics

| | Run 1 | Run 2 | Median | Baseline (Iter 0) | Δ |
|---|---|---|---|---|---|
| Cost (USD) | $0.1556 | $0.1535 | **$0.1546** | $0.1494 | **+$0.0052 (+3.5%)** |
| Total tokens | 44,373 | 43,522 | 43,948 | 40,457 | +3,491 (+8.6%) |
| Latency | 57s | 56s | 57s | 71s | −14s (faster) |
| Components | 4 (Haiku) | 4 (Haiku) | 4 | 4 | unchanged |
| Component cost | ~$0.0169 | ~$0.0153 | ~$0.0161 | ~$0.0147 | +$0.0014 |
| Summary turns | 3 (tool, tool, end) | 3 (tool, tool, end) | 3 | 3 | unchanged |
| Tool calls | 4 (3 failed, 1 success/20 rows) | 4 (3 failed, 1 success/24 rows) | 4 | 4 (3 failed, 1 success/100 rows of 2021 data) | unchanged in count, but successful call now returns FY2025 data |
| Numeric Guard | Pass / 0 unmatched | Pass / 0 unmatched | ✅ | ✅ | unchanged |

## Quality Score

| Sub-score | Run 1 | Run 2 | Median | Baseline | Δ |
|---|---|---|---|---|---|
| Numeric Accuracy (0–3) | 3 | 3 | **3** | 2 | +1 |
| Relevance (0–3) | 3 | 3 | **3** | 3 | 0 |
| Actionability (0–2) | 2 | 2 | **2** | 2 | 0 |
| Clarity (0–2) | 2 | 2 | **2** | 2 | 0 |
| **TOTAL (max 10)** | **10** | **10** | **10** | 9 | **+1** |
| Hallucinations (mild ratios) | 0 | 0 | **0** | ~2 | −2 |

### Why quality went up

The new monthly data lets Sonnet make **timing-specific** insights it couldn't make before:

- *Run 1*: "Feb 2025 was the peak month at RM 2,177,107 — 24.1% of the full-year OpEx total."
- *Run 1*: "Depreciation of RM 1,504,927 was posted entirely in Feb 2025 (RM 0 all other months), confirmed as an annual bulk-posting pattern."
- *Run 1*: "People & Payroll: Jan 2025 spiked to RM 575,563 vs a typical ~RM 295K/month."
- *Run 2*: "Consistent monthly escalation from RM 283,372 (Mar 2024) to RM 575,563 (Jan 2025)."
- *Run 2*: "The lump-sum depreciation booking in Feb 2025 distorts the monthly run-rate and warrants review of the capitalisation schedule."

Baseline output couldn't produce these because the monthly category-level data simply wasn't in the prompt. The hallucinated ratios (`9.2%`, `2.6×`) of the baseline are also gone — Sonnet has more concrete pre-fetched values to cite, and the numeric accuracy bumps from 2/3 to 3/3.

## Why Cost Went Up

The hypothesis behind the spec was: **pre-fetch the data → Sonnet skips tool calls → cost drops.**

What actually happened: **pre-fetch the data → Sonnet uses the data AND still makes tool calls anyway → cost goes up.**

Mechanism:
1. The new monthly category breakdown adds ~500–1,000 tokens to Sonnet's input on every summary turn (TURN 1 input: 7,892 → 8,903; +13%).
2. Sonnet does not interpret "pre-fetched data is in the block" as "don't query". It still queries `pc_pnl_period`, `pc_expense_monthly`, and `pc_sales_daily` for "supporting evidence" even when the data is right there.
3. So we pay for: (a) the bigger input on every turn, (b) the same number of tool retries as before, (c) a slightly bigger TURN 3 final write that incorporates the richer data.
4. Net: +$0.0052/run, but better insights.

The spec's "tool calls drop because data is pre-fetched" assumption was wrong for Sonnet. Sonnet's behaviour is closer to: tool calls = "doing analysis", and pre-fetched data is just additional context to weave in.

## Stop-Criteria Decision

Strict reading of `HOW_TO_RUN_ITERATION.md` Step 9:

> **Stop criteria (revert if any are true):** ... **Cost INCREASED vs active baseline** → Iter 7 hits this. Revert.

> **Keep if:** Cost decreased OR **quality improved** (or both). ... Iter 7 hits this. Keep.

Criteria contradict on this case. **The literal cost gate triggers revert; the quality gate triggers keep.** This is a judgement call — escalating to user.

## Verdict — REVERTED (2026-05-07, user decision)

User chose **strict cost discipline**: revert fully despite the quality bump. Reasoning aligns with the literal stop criterion — cost increased vs active baseline, so the iteration is reverted regardless of secondary quality gains. Preserves a clean $0.1494 baseline for subsequent iterations to be measured against.

**Action:** `git checkout apps/dashboard/src/lib/ai-insight/data-fetcher.ts apps/dashboard/src/lib/ai-insight/prompts.ts` — reverts both files to pre-Iter-7 state. TypeScript still compiles clean.

## Lessons Learned (must inform future iterations)

1. **Pre-fetching alone doesn't reduce Sonnet's tool-call appetite.** Sonnet still makes the same 4 tool calls per run even when the data is in the block. It treats tool-calls as "doing analysis" — not as "fetching data I don't have." Future iterations targeting tool-call elimination should pair pre-fetching with EITHER (a) explicit instruction in the summary system prompt to skip queries when the data is already pre-fetched, OR (b) reducing `MAX_TOOL_CALLS_PER_SUMMARY` to ≤ 2 (which is Iter 3, scheduled last).

2. **Pre-fetching IS a quality lever**, even if it's not a cost lever. Sonnet *uses* the new data productively when it's there — the timing insights (peak OpEx month, depreciation bulk-posting, payroll escalation trajectory) are genuinely better for an executive audience. If/when we revisit pre-fetching after Iter 3 caps tool calls, this could become a quality-and-cost win simultaneously.

3. **The 5-column trend extension was technically free.** Adding `cogs` and `expenses` columns to `fv_trend_forecast` exposed already-computed `FinMonthlyRow` fields without extra DB queries — just more output tokens. If we re-attempt this later as a partial change, the trend extension is the lower-risk lever.

4. **Cosmetic bug found:** `FY${period.fiscalYear}` in the new heading rendered as `"FYFY2025"` since `fiscalYear` is already prefixed. Fix would have been `${period.fiscalYear}` (no extra `FY`). Reverted away regardless, but worth noting for the next attempt.

## Files

- `iter7_run1_full_log.log`
- `iter7_run2_full_log.log`
- Code reverted: `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`, `apps/dashboard/src/lib/ai-insight/prompts.ts` (no diff vs main)
