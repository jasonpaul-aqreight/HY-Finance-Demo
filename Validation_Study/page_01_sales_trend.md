# Page 1 — Sales Validation (PARTIAL — paused mid-session)

> **Session paused 2026-05-08 ~07:46 GMT+8** because the Anthropic API credit balance was exhausted partway through AFTER run #2.
> Steps 1–6 complete + AFTER run #1 captured. AFTER run #2 must be re-attempted in a follow-up session before a verdict is issued.

## Identity

| Field | Value |
|---|---|
| Page | Sales |
| Page route | `/sales` |
| section_key | `sales_trend` |
| Section display title | Sales Trend |
| Components feeding it | `sales_summary` (KPI), `net_sales_trend` (chart) |
| Tool policy | `aggregate_only` |
| Date range | 2024-11-01 → 2025-10-31 (page default — trailing 12 months from MAX(pc_sales_daily.doc_date)) |
| DB snapshot date | 2026-05-08 |

## Eval set captured

Path: [`Validation_Study/eval/page_01_sales_trend/expected_values.json`](eval/page_01_sales_trend/expected_values.json)

Key values the section should report:
- 12-mo Net Sales: **RM 88,292,348.56**
- Invoice / Cash / CN: 94.9% / 6.3% / 1.13% of gross
- Peak month: 2025-01 at RM 9,689,765.34 (CNY-driven)
- Trough month: 2025-02 at RM 6,047,767.47 (post-CNY)
- Highest CN month: 2025-02 (RM 135,662.48)

---

## Run Logs

| Run | File | Status |
|---|---|---|
| Baseline 1 | [`page_01_sales_trend_baseline_run1.log`](page_01_sales_trend_baseline_run1.log) | ✅ captured |
| Baseline 2 | [`page_01_sales_trend_baseline_run2.log`](page_01_sales_trend_baseline_run2.log) | ✅ captured |
| After 1 | [`page_01_sales_trend_after_run1.log`](page_01_sales_trend_after_run1.log) | ✅ captured |
| After 2 | — | ❌ aborted — Anthropic API credit balance exhausted |

---

## Per-Run Metrics (3 of 4 runs)

| Metric | Baseline 1 | Baseline 2 | After 1 | After 2 |
|---|---|---|---|---|
| Total tokens | 15,047 | 22,253 | 18,560 | — |
| Cost (USD) | $0.0737 | $0.1166 | $0.1047 | — |
| Cache created (tokens, observed in log) | 0 | 0 | 2,804 (×3 occurrences) | — |
| Cache read (tokens) | 0 | 0 | 0 | — |
| Guard attempts | 1 | 2 | 2 | — |
| Guard unmatched (attempt 1) | 0 | 1 (`RM 1.45M`) | 3 | — |
| Latency (rough, s) | ~50 | ~60 | ~75 | — |

**Cache observation (AFTER #1):** `cache_creation_input_tokens=2804` appeared 3 times, but `cache_read_input_tokens` stayed 0 across the run. Cache was being **written** but not yet **read** — likely because each component's system prompt is unique (no cross-component sharing) and the per-component multi-turn loops finished before any cached blocks could be re-read. The expected Iter 5 cost saving was not visible in this single AFTER run.

## Medians (cannot compute — N=1 on after side)

Pending AFTER #2 re-run.

---

## Quality Score per Run (preliminary — not finalized)

Logs read but full rubric scoring **deferred** until AFTER #2 lands. Initial impression:

- All 3 completed runs produced numerically accurate output. Spot-checked Net Sales (RM 88,292,348.56), Invoice share (94.9%), CN share (1.13%), Jan-2025 peak (RM 9,689,765.34) — all match `expected_values.json` to the cent.
- All 3 runs correctly identified the Jan-2025 spike as a one-off (cash-driven, CNY context) and the Feb-2025 CN max.
- Sentiment classification is reasonable (94.9% invoice share correctly read as "normal", not flagged as anomalous — passes the qualitative-judgement test).
- Baseline #2 produced one fabricated number "RM 1.45M" caught by guard → retry produced clean output. AFTER #1 had 3 unmatched on attempt 1 → retry produced clean output. **Guard is doing its job.**
- Initial total estimate per run looks ~9–10/10 across all three.

---

## Sample Output

### Baseline (run 1) — first insight

```
sentiment: good
title: RM 88.3M Net Sales Over 12 Months
metric: RM 88,292,349
summary: Full-year net sales hit RM 88.3M, averaging RM 7.36M per month across the period.

**Current Status:**
- Net sales for 2024-11-01 to 2025-10-31 totalled RM 88,292,348.56, driven primarily
  by invoice sales (RM 83,771,290.40 / 94.9% of net).
- Cash sales contributed RM 5,534,326.38 (6.3% of net).

**Key Observations:**
- January 2025 was the standout month at RM 9,689,765.34 — boosted by unusually
  high cash sales of RM 1,596,887.28 (vs. typical RM 285K–RM 442K in other months).
- May 2025 was the second-best month at RM 8,616,492.62...
```

### After (run 1) — first insight

```
sentiment: good
title: Full-Year Net Sales at RM 88.3M
metric: RM 88,292,349
summary: Annual net sales reached RM 88.3M with Invoice Sales driving 94.9% of revenue.

**Current Status:**
- Net Sales for 2024-11-01 to 2025-10-31 totalled RM 88,292,348.56, split across
  Invoice Sales (RM 83,771,290.40), Cash Sales (RM 5,534,326.38), and Credit Notes
  (-RM 1,013,268.22).
- Invoice Sales dominated at 94.9% of net, confirming a credit-term-led
  distribution model.
...
```

Outputs are very similar in structure and accuracy.

---

## Code Changes (this session)

**None — caching toggle alone.** No guard tweaks were applied. Baseline runs revealed only model fabrications (caught by guard + retry), not valid numbers being rejected — so Step 6 was correctly skipped.

---

## Verdict

| Field | Value |
|---|---|
| **Verdict** | ⏳ **INCOMPLETE — pending AFTER #2** |
| Cost B → A | $0.0737–$0.1166 (median ~$0.0951) → $0.1047 with N=1 (no After median yet) |
| Quality B → A | All 3 runs preliminarily ~9–10/10 |
| Hallucinations B → A | B1=0, B2=1, A1=3 (all caught by guard, all cleared on retry) |

**Preliminary read (do not lock in):** Cache writes are happening (`created=2804` in AFTER #1) but no reads observed in a single completion-pass — the per-component prompts may not share enough cacheable prefix for Iter 5's saving pattern to manifest on a 2-component section. Worth investigating in the follow-up session whether `sales_trend` simply doesn't see the same caching benefit as the multi-turn `payment_outstanding` pilot.

---

## Lessons Learned (preliminary)

- **Per-section LLM volume affects cache ROI.** `sales_trend` has only 2 components and each completes in a small number of turns — the cache window for re-reads is short. The Iter 5 saving observed on `payment_outstanding` (which has 6 components and longer multi-turn loops) may not generalize uniformly.
- **The guard correctly catches Haiku fabrications** like "RM 1.45M" without any whitelist tuning needed — the `sales_trend` number formats overlap fully with the existing whitelist (RM amounts, percentages). Iter 1's whitelist is general enough.
- **Operational lesson: the Anthropic API key needs a credit-balance pre-flight check** before starting a 4-run validation session. ~$0.30 spent before exhaustion = useful budgeting datapoint for future page sessions.

---

## Other Improvement Ideas Spotted (NOT in scope — file for later)

- The `sales_summary` data fetcher computes `gross_sales = invoice + cash` but the prompt asks the model to compute "credit notes as % of gross sales". The model has to reach for the formula every time. Adding `gross_sales` and `cn_share_of_gross` to the prompt block directly could shave reasoning tokens.
- Both runs surfaced "MY HERO HYPERMARKET" customer-level facts despite the section being scoped to *trend* (not breakdown). This is the model fetching `pc_sales_by_customer` via tool calls. Worth checking whether scoping the `sales_trend` policy more tightly (e.g., only `pc_sales_daily` allowed) would cut cost without hurting quality.

---

## Resume Instructions

For the follow-up session:
1. Confirm Anthropic credit balance is replenished
2. With `.env.local` toggle commented out (caching ON, AFTER mode), restart dev server
3. Clear cache: `DELETE FROM ai_insight_component WHERE section_id IN (SELECT id FROM ai_insight_section WHERE section_key = 'sales_trend'); DELETE FROM ai_insight_section WHERE section_key = 'sales_trend';`
4. Run AFTER #2 only (do not re-run baseline — already captured)
5. Resume from Step 8 (Extract Metrics) onwards
