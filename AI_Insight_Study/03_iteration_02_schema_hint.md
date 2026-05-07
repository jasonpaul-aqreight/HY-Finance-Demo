# Iteration 02: Column-Schema Hint in Tool Description

> **Hypothesis:** Telling Sonnet the allowed columns per table inside the tool description (instead of letting it discover them via runtime rejection) will eliminate the 2 failed tool calls per click and save ~$0.018.
> **Active baseline before this iteration:** $0.134/click, Quality 10/10
> **Date:** 2026-05-07
> **Worker session:** Mary (bmad-agent-analyst)

---

## Discussion with User (Step 1)

- User pushed back on the original `02_analysis.md` plan that placed the column hint in `SUMMARY_SYSTEM` (the global summary prompt). Reason: the system prompt is sent for every section (sales, margin, expenses, etc.), so injecting `payment_outstanding`-specific column hints there pollutes other sections. Correct call.
- User redirected the fix to the **tool description itself** ("we expose SQL queries — the tool should constrain columns"). This matches how Anthropic tool schemas are intended to work: the tool tells the model what shape its inputs should take.
- User reaffirmed the prove-or-revert protocol: theoretical savings must be measured by 2× study; revert if metrics fail Step 9 stop criteria.

---

## Approved Change Plan (Step 2-3)

**Goal:** Eliminate `Columns not allowed for ...` rejection retries by enumerating each table's allowed columns inside the tool description, generated from the existing `LOCAL_WHITELIST` / `RDS_WHITELIST` constants.

**Files to change:**
- `apps/dashboard/src/lib/ai-insight/tools.ts` — extend `description` strings of `query_local_table` (line 40) and `query_rds_table` (line 77) to include a `Allowed tables and columns:` block templated from the existing whitelist constants.

**Out of scope:**
- `SUMMARY_SYSTEM` in prompts.ts (global, not the right place per user)
- `validateColumns` runtime guard (kept as defense-in-depth)
- Tool input schema (no enum changes)
- Data fetchers, orchestrator, numeric guard

**Risk assessment:**
- Description text adds ~700 tokens per Sonnet tool-using call. If Sonnet still requires multiple tool calls, the bloat could exceed retry savings.
- Aggregate-only sections append a `[POLICY: ...]` line on top of the new description (longer prompt for non-pilot sections).

**Success criteria:**
- Cost ≤ $0.134 (no regression)
- Quality ≥ 9/10
- Hallucinations ≤ 2
- `Columns not allowed` errors drop to ≤ 1 per run

**Rollback approach:** `git checkout apps/dashboard/src/lib/ai-insight/tools.ts`

**User approval:** ✅ approved 2026-05-07

---

## What Was Implemented (Step 4)

**Diff summary:** Two `description` strings in [tools.ts](../apps/dashboard/src/lib/ai-insight/tools.ts) extended to template the existing whitelist into a per-table column list:

```ts
description: `Query a pre-calculated local PostgreSQL table (pc_* tables)... Maximum ${ROW_LIMIT} rows returned.

Allowed tables and columns (use exact names — others are rejected):
${Object.entries(LOCAL_WHITELIST).map(([t, cols]) => `- ${t}: ${cols.join(', ')}`).join('\n')}`,
```

Same pattern for `query_rds_table` using `RDS_WHITELIST`. No code logic changed — only string content.

**Deviations from plan:** None.

---

## Pre-flight Verification

- [x] Dev server running on :3001 (started fresh)
- [x] DB snapshot matches eval set (snapshot_date=2026-04-23, 227 rows, RM 11,349,862.52)
- [x] AI_INSIGHT_DEBUG_FILE=true

---

## Run Results (2 runs)

| Metric | Run 1 | Run 2 | Median | vs Baseline (Iter 1) |
|--------|-------|-------|--------|----------------------|
| Total tokens | 43,312 | 40,097 | 41,705 | +9,305 (+29%) |
| Estimated cost | $0.1705 | $0.1678 | **$0.1692** | **+$0.0352 (+26%)** ❌ |
| Components analyzed | 6 | 6 | 6 | unchanged |
| Sonnet tool-use turns | 3 | 2 | 2.5 | +0.5 |
| `Columns not allowed` errors | 0 | 0 | **0** | **−2 (eliminated)** ✅ |
| SQL execution errors | 1 | 1 | 1 | +1 (data-layer; see Observations) |
| Numeric guard attempts | 2 (1 fail → 1 pass) | 2 (1 fail → 1 pass) | unchanged | unchanged |

---

## Quality Score (Both Runs)

| Sub-score | Run 1 | Run 2 | Median |
|-----------|-------|-------|--------|
| Numeric Accuracy (0-3) | 3 | 3 | 3 |
| Relevance (0-3) | 3 | 3 | 3 |
| Actionability (0-2) | 2 | 2 | 2 |
| Clarity (0-2) | 2 | 2 | 2 |
| **TOTAL (0-10)** | **10/10** | **10/10** | **10/10** |

**Hallucinations:**
- Run 1: 0 — all numbers traceable to raw data blocks or tool results
- Run 2: 0 — same; numbers like RM 3,721,296 (agent breakdown) and 1,873 days (PRIMA FRESH MART) confirmed in tool-call results

---

## Sample Output (Run 1, first insight)

```
sentiment: bad
title: 100% of Outstanding Overdue, All 120+ Days
metric: RM 11,349,862
summary: Every ringgit owed sits in the 120+ day bucket across all 227 customers.

Current Status: Total outstanding of RM 11,349,862 as of 2026-04-23 is 100% overdue,
with all 3,376 invoices in the 120+ aging bucket. All 227 active customers are overdue.

Key Observations:
- Outstanding has risen: RM 9,739,433 (Jul-25) → RM 10,977,617 (Oct-25) → RM 11,349,863 (snapshot)
- Top 3 customers — MY HERO HYPERMARKET (RM 2,112,369), MLF TRADING (RM 1,137,069),
  WONDERFRUITS (RM 1,079,871) — account for 38.1% of total outstanding.
- MY HERO HYPERMARKET carries the single largest exposure at 440 overdue days.
```

(Full output in [iter2_run1_log.log](iter2_run1_log.log) lines 1418-1503.)

---

## Discrepancies / Guard Failures

| Type | Count | Examples |
|------|-------|----------|
| Tool-result data not whitelisted | 0 | — |
| Sonnet computed sums | 0 | — |
| Display rounding mismatch | 0 | — |
| Wrong values (true hallucination) | 0 | — |
| Pre-existing data bug exposed | 1/run | `column "dimension_key" does not exist` — see Observations |

---

## What I Observed

- **The hint worked exactly as intended at the column level.** Both runs had zero `Columns not allowed` rejections (baseline had 2/run). Sonnet picked valid column names on the first attempt every time.
- **But the token cost dwarfed the retry savings.** ~700 tokens added to every Sonnet tool-using call, multiplied across 3-5 tool calls, blew up input tokens by ~9,000-11,000 per click. The avoided retry was only worth ~$0.005; the added input cost was ~$0.030+.
- **Sonnet appears to explore more aggressively when it sees a richer tool description.** Run 1 used 3 tool turns (vs baseline's 2), suggesting the explicit column menu invited it to pull more dimensions of the data. This compounds the bloat problem.
- **Pre-existing bug exposed:** `LOCAL_WHITELIST` includes `dimension_key` for `pc_ar_aging_history`, but the actual table doesn't have that column — caused a SQL execution error. This is *not* caused by Iter 2 (whitelist was already wrong); the schema hint just made Sonnet confidently use a stale column. **Action item for separate fix:** either drop `dimension_key` from the whitelist or add the column to the table.
- **Quality stayed at 10/10 with zero hallucinations** — the change does not damage output quality, only economics.
- **Architectural lesson:** Sonnet already learns the schema *for free* via the existing rejection-error mechanism (one extra tool call, ~$0.018). Front-loading that knowledge into the tool description costs ~$0.030. The "JIT learning" via error feedback is, surprisingly, **cheaper** than upfront documentation. This will inform Iter 3 (tool-cap reduction) and Iter 6 (component combine).

---

## Verdict

**Decision:** ❌ **REVERT**

**Reason:** Schema hint successfully eliminated `Columns not allowed` errors (0/run vs 2/run baseline) but the +700-token-per-call bloat triggered a +26% cost regression (~$0.169 vs $0.134 baseline). Quality unchanged at 10/10. Stop criterion "Cost INCREASED vs active baseline" hit.

**Cost:** $0.134 → $0.169 (Δ +26%) → revert restores $0.134
**Quality:** 10/10 → 10/10 (no change)

---

## Next Iteration

According to MASTER_LOG, next pending iteration is: **Iteration 3: Drop MAX_TOOL_CALLS_PER_SUMMARY from 4 → 2**

**Re-order suggestion: NO — Iter 3 stays next.** In fact, this iteration's findings *strengthen* the case for Iter 3:
- The cost driver we observed (extra tool calls inflating input tokens) is exactly what Iter 3 attacks directly.
- Iter 3 is a 1-line change with no token bloat — pure savings, no trade-off.
- If Iter 3 succeeds, future column-hint experiments could be re-evaluated cheaply (tighter scope, e.g., only the 3 tables this section uses).

---

## Files

- Logs: [iter2_run1_log.log](iter2_run1_log.log), [iter2_run2_log.log](iter2_run2_log.log)
- Code change: REVERTED via `git checkout apps/dashboard/src/lib/ai-insight/tools.ts`
