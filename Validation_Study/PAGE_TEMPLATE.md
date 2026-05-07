# Page <N> — <Page Name> Validation

> Copy this template to `page_<NN>_<section_key>.md` at session start. Fill every section before commit.

## Identity

| Field | Value |
|---|---|
| Page | _e.g., Sales_ |
| Page route | _e.g., `/sales`_ |
| section_key | _e.g., `sales_summary`_ |
| Section display title | _e.g., "Sales Summary"_ |
| Components feeding it | _e.g., `total_sales, top_customers, sales_trend, ...` (from `SECTION_COMPONENTS[section_key]`)_ |
| Tool policy | _e.g., `'aggregate_only'` / `'full'` / `'none'` (from `tool-policy.ts`)_ |
| Date range | _e.g., FY2025 / current month_ |
| DB snapshot date | _e.g., 2026-05-08_ |

## Eval set captured

Path: `Validation_Study/eval/page_<NN>_<section_key>/expected_values.json`

Key values the section should report:
- _bullet 1_
- _bullet 2_
- _bullet 3_

---

## Run Logs

| Run | File | Notes |
|---|---|---|
| Baseline 1 | `page_<NN>_<section>_baseline_run1.log` | |
| Baseline 2 | `page_<NN>_<section>_baseline_run2.log` | |
| After 1 | `page_<NN>_<section>_after_run1.log` | |
| After 2 | `page_<NN>_<section>_after_run2.log` | |

---

## Per-Run Metrics

| Metric | Baseline 1 | Baseline 2 | After 1 | After 2 |
|---|---|---|---|---|
| Total tokens | _ | _ | _ | _ |
| Cost (USD) | _ | _ | _ | _ |
| Cache created (tokens) | 0 | 0 | _ | _ |
| Cache read (tokens) | 0 | 0 | _ | _ |
| API calls | _ | _ | _ | _ |
| Tool calls | _ | _ | _ | _ |
| Failed tool calls | _ | _ | _ | _ |
| Guard attempts | _ | _ | _ | _ |
| Guard unmatched | _ | _ | _ | _ |
| Latency (s) | _ | _ | _ | _ |

## Medians

| Metric | Baseline median | After median | Δ |
|---|---|---|---|
| Cost | _$_ | _$_ | _% |
| Quality | _/10 | _/10 | _ |
| Hallucinations | _ | _ | _ |

---

## Quality Score per Run

| Sub-score | B1 | B2 | A1 | A2 |
|---|---|---|---|---|
| Numeric Accuracy (0–3) | _ | _ | _ | _ |
| Relevance (0–3) | _ | _ | _ | _ |
| Actionability (0–2) | _ | _ | _ | _ |
| Clarity (0–2) | _ | _ | _ | _ |
| **TOTAL (max 10)** | _ | _ | _ | _ |
| Hallucinations | _ | _ | _ | _ |

---

## Sample Output

### Baseline (run 1)
```
<paste a representative chunk of the section's final output here>
```

### After (run 1)
```
<paste the same section, after caching ON / guard tweaks applied>
```

---

## Code Changes (this session)

If guard tweaks were applied, list each one:

| File | Change | Reason |
|---|---|---|
| _e.g., `numeric-guard.ts`_ | _e.g., add regex `\d+\.\d+\s*kg` to whitelist_ | _e.g., section reports weight in kg, baseline rejected `12.5 kg` as unmatched_ |

If no code changes, write "None — caching toggle alone."

---

## Verdict

| Field | Value |
|---|---|
| **Verdict** | ⏳ ✅ CONFIRM / ❌ NEEDS TUNING / ⚠️ INVESTIGATE |
| Cost B → A | _$_ → _$_ (Δ%) |
| Quality B → A | _/10_ → _/10_ |
| Hallucinations B → A | _ → _ |

**Rationale:** _2-3 sentences explaining why this verdict. Did caching deliver the expected % cut? Did the guard catch real hallucinations? Did anything surprise you?_

---

## Lessons Learned

> 1–3 bullets. What's worth carrying to the next page session, or filing to the original AI_Insight_Study lessons table?

- _bullet 1_
- _bullet 2_

---

## Other Improvement Ideas Spotted

> Anything NOT in this study's scope but worth filing. Don't fix here — file in MASTER_LOG "Open Ideas" or as a separate issue.

- _e.g., Tool X returns redundant column Y — could trim to save 200 tokens/run_
- _e.g., Component Z produces same insight every run — candidate for static text_
