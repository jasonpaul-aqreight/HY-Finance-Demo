# Validation Study — Master Log

> **Single source of truth.** Read first in every session. Update at the end of every session.
> Never delete rows — keep failed/incomplete attempts as history.

**Study purpose:** Prove Iter 1 (numeric guard whitelist tuning) + Iter 5 (Anthropic prompt caching) generalize beyond the original pilots (`payment_outstanding`, `financial_variance`).

**Procedure:** [HOW_TO_RUN_PAGE.md](HOW_TO_RUN_PAGE.md)
**Result template:** [PAGE_TEMPLATE.md](PAGE_TEMPLATE.md)
**Toggle env var:** `AI_INSIGHT_VALIDATION_BASELINE=1` in `apps/dashboard/.env.local` disables caching for baseline runs.
**Runs per page:** 2 baseline + 2 after = 4 runs.
**Quality rubric:** `AI_Insight_Study/eval_set/quality_rubric.md` (max 10) — re-used.

---

## Pages in Scope

| Order | Page route | URL slug | Section to test | Status |
|---|---|---|---|---|
| 1 | Sales | `/sales` | `sales_trend` (2 components: `sales_summary`, `net_sales_trend`) | 🔄 in progress (paused — API credits exhausted before AFTER #2) |
| 2 | Returns | `/return` | First AI Insight section on the page (identified at session start) | ⏳ pending |
| 3 | Financials | `/financial` | First AI Insight section on the page (identified at session start) | ⏳ pending |
| 4 | Supplier Performance | `/supplier-performance` | First AI Insight section on the page (identified at session start) | ⏳ pending |

**Status legend:** ⏳ pending · 🔄 in progress · ✅ confirm · ❌ needs tuning · ⚠️ investigate

---

## Results Table

> Append one row per page session after the 4 runs are complete and quality is scored.

| # | Page | section_key | Baseline cost | After cost | Δ cost | Baseline quality | After quality | Halluc (B → A) | Verdict | Date | Result file |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Sales | `sales_trend` | $0.0737–$0.1166 (n=2) | $0.1047 (n=1) | _TBD (n insufficient)_ | preliminary 9–10/10 | preliminary 9–10/10 | 0/1 → 3 (all caught by guard) | 🔄 INCOMPLETE | 2026-05-08 | `page_01_sales_trend.md` |
| 2 | Returns | _TBD_ | _$_ | _$_ | _%_ | _/10_ | _/10_ | _ → _ | ⏳ | _YYYY-MM-DD_ | `page_02_return.md` |
| 3 | Financials | _TBD_ | _$_ | _$_ | _%_ | _/10_ | _/10_ | _ → _ | ⏳ | _YYYY-MM-DD_ | `page_03_financial.md` |
| 4 | Supplier Performance | _TBD_ | _$_ | _$_ | _%_ | _/10_ | _/10_ | _ → _ | ⏳ | _YYYY-MM-DD_ | `page_04_supplier_performance.md` |

---

## Cumulative Roll-up (filled after all 4 pages complete)

```
Pages with CONFIRM verdict        : _ / 4
Pages with NEEDS TUNING verdict   : _ / 4
Pages with INVESTIGATE verdict    : _ / 4

Median cost reduction across pages: __%
Median quality change             : +_/10
Total hallucinations B → A        : _ → _
```

**Final conclusion:** _(filled after page 4 — does the evidence support generalizing Iter 1 + Iter 5 to the entire dashboard?)_

---

## Code Changes by Section

> Track section-specific guard whitelist additions made during sessions.

| Section | File | Change | Reason | Commit |
|---|---|---|---|---|
| _(none yet)_ | | | | |

---

## Lessons Learned (append after each page session)

> One bullet per page with the key takeaway. Patterns across pages are gold.

- **Page 1 / `sales_trend` (PRELIMINARY — pending AFTER #2):** Numbers cited in all 3 captured runs match `expected_values.json` to the cent; existing whitelist handled the section without tweaks. Cache *writes* are happening (`created=2804`) but no *reads* observed in a single AFTER pass — Iter 5's saving may be muted on small (2-component) sections vs. the multi-turn `payment_outstanding` pilot. Guard correctly catches Haiku fabrications without tuning.

---

## Decisions / Course Corrections (append as they happen)

- **2026-05-08** Study created. Iter 8.1 (OpenRouter primary) paused to first prove Iter 1 + Iter 5 generalize. Decision rule for each page: CONFIRM / NEEDS TUNING / INVESTIGATE.
- **2026-05-08** Page 1 (`sales_trend`) session paused at AFTER #2 — Anthropic API credit balance exhausted partway through the run. 3 of 4 runs captured (B1, B2, A1). Verdict deferred until balance is replenished and AFTER #2 is re-attempted. Resume instructions in `page_01_sales_trend.md`. Per-page session lesson: budget ~$0.40 per section session (4 runs × ~$0.10 average) before starting.

---

## How to Resume

> Tell the next worker session:
>
> ```
> Resume Validation Study. Read Validation_Study/MASTER_LOG.md and HOW_TO_RUN_PAGE.md.
>
> Process for this page session:
> 1. Identify the first AI Insight section on the assigned page
> 2. Discuss with me (the spec, the section, what you've read in code, open questions)
> 3. Write a change plan (if any guard tweaks are anticipated) and get my approval
> 4. Run BASELINE × 2 with AI_INSIGHT_VALIDATION_BASELINE=1
> 5. Run AFTER × 2 with the var unset (caching ON, plus any approved guard tweaks)
> 6. Score quality, decide verdict, fill page_NN_<section>.md
> 7. Update MASTER_LOG, confirm with me before committing
>
> Do not skip ahead. Steps 1-3 happen before any code edit.
> ```
