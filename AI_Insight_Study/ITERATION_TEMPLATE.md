# Iteration NN: <short title>

> **Hypothesis:** <one-sentence claim about expected effect>
> **Active baseline before this iteration:** $X.XXX/click, Quality Y/10
> **Date:** YYYY-MM-DD
> **Worker session:** <session id or note>

---

## Discussion with User (Step 1)

> Summarize the conversation. What questions did you ask? What did the user clarify? Any course corrections?

- 

---

## Approved Change Plan (Step 2-3)

**Goal:** <one sentence>

**Files to change:**
- `apps/dashboard/src/lib/ai-insight/<file>.ts` — <what specifically changes>

**Out of scope:**
- <what we deliberately left alone>

**Risk assessment:**
- 

**Success criteria:**
- Cost target: $X (vs $Y baseline)
- Quality target: Z/10

**Rollback approach:**
- 

**User approval:** ✅ approved YYYY-MM-DD HH:MM / ❌ revised after pushback / ⏸ postponed

---

## What Was Implemented (Step 4)

**Diff summary:**
```
<short description of the actual change, or commit hash if already committed>
```

**Deviations from plan (if any):**
- 

---

## Pre-flight Verification

- [x] Dev server running on :3001
- [x] DB snapshot matches eval set (227 rows, total RM 11,349,862.52)
- [x] AI_INSIGHT_DEBUG_FILE=true

---

## Run Results (2 runs)

| Metric | Run 1 | Run 2 | Median | vs Baseline |
|--------|-------|-------|--------|-------------|
| Total tokens | | | | |
| Estimated cost | | | | |
| Latency (s) | | | | |
| API calls (Haiku + Sonnet turns) | | | | |
| Tool calls made | | | | |
| Failed tool calls | | | | |
| Guard attempts | | | | |
| Guard unmatched (attempt 1) | | | | |
| Guard unmatched (final) | | | | |
| Cache hits | | | | |

### Cost Breakdown (Run 1)

| Stage | Tokens (in→out) | Cost |
|-------|-----------------|------|
| 6 Haiku component calls (total) | | |
| Sonnet Turn 1 | | |
| Sonnet Turn 2 | | |
| Sonnet Turn N | | |
| **TOTAL** | | |

---

## Quality Score (Both Runs)

| Sub-score | Run 1 | Run 2 | Median |
|-----------|-------|-------|--------|
| Numeric Accuracy (0-3) | | | |
| Relevance (0-3) | | | |
| Actionability (0-2) | | | |
| Clarity (0-2) | | | |
| **TOTAL (0-10)** | | | |

**Hallucinations (numbers in output not from data):**
- Run 1: <count> — examples: <list>
- Run 2: <count> — examples: <list>

---

## Sample Output (Run 1)

> Paste the 3 ===INSIGHT=== blocks the user actually sees. Mark any hallucinations inline with ⚠️.

---

## Discrepancies / Guard Failures (Run 1)

| Type | Count | Examples |
|------|-------|----------|
| Tool-result data not whitelisted | | |
| Sonnet computed sums | | |
| Display rounding mismatch | | |
| Wrong values (true hallucination) | | |
| Other | | |

---

## What I Observed

> Free-form notes — what surprised you, what you learned, what didn't change.

- 
- 

---

## Verdict

**Decision:** ✅ KEEP / ❌ REVERT / ⏸ SKIP

**Reason:** <one paragraph>

**Cost:** $<before> → $<after> (Δ <±X%>)
**Quality:** <before>/10 → <after>/10

---

## Next Iteration

According to MASTER_LOG, next pending iteration is: **Iteration <N+1>: <title>**

Any reason to re-order based on this iteration's findings? <yes/no + reason>

---

## Files

- Logs: `AI_Insight_Study/iter<NN>_run1_log.log`, `iter<NN>_run2_log.log`
- Code change: <git commit hash or branch>
