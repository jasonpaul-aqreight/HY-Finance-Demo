# Validation Study

> Per-page proof that Iter 1 (numeric guard whitelist tuning) and Iter 5 (Anthropic prompt caching) deliver real cost + quality wins beyond the original pilots.

The original AI Insight Optimization Study (`AI_Insight_Study/`) tested these improvements only on `payment_outstanding` and `financial_variance`. This study generalizes the evidence across 4 more pages.

## Status

**Started:** 2026-05-08
**Pages in scope:** Sales · Returns · Financials · Supplier Performance
**Runs per page:** 4 total (2 baseline + 2 after)
**Iter 8.1 (OpenRouter):** Paused — will resume after this study completes.

## How to use these docs

| File | Read when |
|---|---|
| [MASTER_LOG.md](MASTER_LOG.md) | Always — single source of truth, status of every page |
| [HOW_TO_RUN_PAGE.md](HOW_TO_RUN_PAGE.md) | Before starting a page session — the procedure |
| [PAGE_TEMPLATE.md](PAGE_TEMPLATE.md) | At session end — copy into `page_NN_<section>.md` |

## Per-page session workflow (one-line summary)

```
Identify section → discuss → plan → approve → run baseline ×2 (caching off)
→ run after ×2 (caching on, optional section-specific guard tweaks)
→ score → document → update master log → commit
```

## Key knob

```bash
# In apps/dashboard/.env.local
AI_INSIGHT_VALIDATION_BASELINE=1   # caching OFF — baseline mode
# (unset / =0)                     # caching ON  — after mode (production default)
```

Flipping the var requires a dev-server restart for Next.js to pick it up.

## Decision rule (per page)

| Outcome | Verdict |
|---|---|
| After cost ≤ baseline AND quality ≥ baseline AND hallucinations ≤ baseline | ✅ **CONFIRM** — improvements generalize on this page |
| Cost down but quality regressed | ❌ **NEEDS TUNING** — add section-specific whitelist patterns and re-run |
| Cost up | ⚠️ **INVESTIGATE** — caching shouldn't increase cost; surface the anomaly |
