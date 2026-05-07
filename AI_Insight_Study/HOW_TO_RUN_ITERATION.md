# How to Run an Iteration (Worker Session Procedure)

> Standard procedure for any session that implements ONE iteration. Follow exactly.
> If you're the master session, do NOT use this — coordinate worker sessions instead.

> **CRITICAL ORDER OF OPERATIONS:**
> 1. **Discuss** with the user (Step 1)
> 2. **Plan** the change (Step 2)
> 3. **Get approval** (Step 3)
> 4. **Implement** (Step 4)
> 5. **Then** run the study (Steps 5+)
>
> NEVER skip ahead to coding. The user is the final reviewer of every iteration's plan.

---

## Step 0: Orient (≤2 min)

1. Read `MASTER_LOG.md` → identify the next row marked `⏳ pending`
2. Read that iteration's spec in `02_analysis.md` (the `### Iteration N:` section)
3. Read `01_baseline.md` for context on the current behaviour
4. Confirm in `MASTER_LOG.md`:
   - **Active baseline** = current cost/quality you should beat
   - **Eval set unchanged** (`eval_set/snapshot_state.md` snapshot date matches DB)

If the eval set drifted (DB refreshed), re-capture expected values BEFORE proceeding.

---

## Step 1: Discuss with the User (BEFORE any code change)

Open the conversation with:
1. **What this iteration is** — the spec from `02_analysis.md` in your own words
2. **Why we're doing it** — the root cause from baseline + expected impact
3. **What you understand about the current code** — read the relevant files in `apps/dashboard/src/lib/ai-insight/` and summarize what you'll be touching
4. **Open questions for the user** — anything unclear, any judgement calls, any alternatives worth considering

Example opening:
> "Iteration 1 is fixing the numeric guard whitelist. Baseline shows the guard always fails (23→18 unmatched, $0.051 wasted on retry). I've read `numeric-guard.ts` and the failures look like X. Before I plan the fix, two questions: [Q1], [Q2]."

DO NOT propose a code change yet. Just align on the problem and approach.

---

## Step 2: Write the Change Plan

After discussion, write a concise plan and share it with the user. Plan must include:

- **Goal** (one sentence)
- **Files to change** (paths + what specifically changes in each)
- **What stays the same** (out of scope — be explicit)
- **Risk assessment** (what could go wrong, what we'll watch for)
- **Success criteria** (cost target + quality target)
- **Rollback approach** (how to revert cleanly if it fails)

Keep it to ~15 lines. This is not a design doc — it's a contract with the user.

---

## Step 3: Get Approval

Ask the user explicitly:
> "Plan above. Approve to proceed with implementation?"

Wait for explicit YES (or course-correction). If they push back, revise the plan and re-ask.

DO NOT proceed to Step 4 without explicit approval.

If the user wants to change the iteration's scope or skip it entirely, update MASTER_LOG.md with the new decision and stop the session.

---

## Step 4: Implement the Change

- ONE focused code change. No drive-by fixes. No refactors.
- Stay strictly inside the approved plan from Step 2.
- If during implementation you discover the plan is wrong (e.g., the file/function isn't what you thought), STOP. Go back to Step 1, re-discuss with the user, and revise the plan before continuing.
- If you find an unrelated bug, note it in MASTER_LOG "Lessons Learned" but do not fix it now.

---

## Step 5: Pre-flight Checks (Before Running the Study)

```bash
# Dev server up?
lsof -i :3001 | head

# DB snapshot still matches eval?
PGPASSWORD=hoiyong_dev_2026 psql -h localhost -p 5433 -U hoiyong -d hoiyong -t -c "
SELECT MAX(snapshot_date) AS d,
       COUNT(*) FILTER (WHERE total_outstanding > 0 AND company_name NOT ILIKE 'CASH SALES%') AS rows,
       ROUND(SUM(total_outstanding) FILTER (WHERE total_outstanding > 0 AND company_name NOT ILIKE 'CASH SALES%')::numeric, 2) AS total
FROM pc_ar_customer_snapshot
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_customer_snapshot);"
# Expected: rows=227, total=11349862.52
```

If dev server is down: start it with `cd apps/dashboard && PORT=3001 npm run dev` (run_in_background).

If TypeScript compile errors after your change, fix them before running the study (`npx tsc --noEmit --project apps/dashboard/tsconfig.json`).

---

## Step 6: Run 2× and Capture Logs

For each of the 2 runs:

```bash
# 1. Clear cached insight (forces fresh analysis)
PGPASSWORD=hoiyong_dev_2026 psql -h localhost -p 5433 -U hoiyong -d hoiyong -c "
DELETE FROM ai_insight_component WHERE section_id IN (SELECT id FROM ai_insight_section WHERE section_key = 'payment_outstanding');
DELETE FROM ai_insight_section WHERE section_key = 'payment_outstanding';"
```

Then via Playwright:
1. Navigate to `http://localhost:3001/payment`
2. Wait for "Outstanding Payment" text visible
3. Click the Outstanding Payment "Get Insight" button (second `Get Insight` on page)
4. Wait for "Analyze" text visible
5. Click "Analyze"
6. Poll until log file contains `SESSION COMPLETE`:
   ```bash
   RUN_LOG=""
   until [ -n "$RUN_LOG" ] && grep -q "SESSION COMPLETE" "$RUN_LOG" 2>/dev/null; do
     sleep 5
     RUN_LOG=$(ls -t /Users/aqreight/Documents/Projects/Hoi-Yong_Finance/apps/dashboard/logs/ai-debug-payment_outstanding-*.log | head -1)
   done
   echo "DONE: $RUN_LOG"
   ```

Use Bash `run_in_background: true` for the wait so you don't burn context.

After both runs, copy logs to study folder:
```bash
cp <newest 2 logs> /Users/aqreight/Documents/Projects/Hoi-Yong_Finance/AI_Insight_Study/iter<N>_run1_log.log
cp ... iter<N>_run2_log.log
```

---

## Step 7: Extract Metrics

For each run, extract from the log:
```bash
grep -E "Components analyzed|Total tokens|Estimated cost|Finished at|Tokens     :|Cost       :|stop_reason|Passed|Unmatched|TOOL_USE id" iter<N>_run<X>_log.log
```

Record per run:
- **Total tokens** (input + output)
- **Estimated cost (USD)**
- **Latency** (compute from "Started at" first component → final "Finished at")
- **API calls** (count of `TURN N — Claude Response` lines + 6 components)
- **Tool calls** (count of `TOOL_USE id=` lines)
- **Failed tool calls** (tool results containing "Columns not allowed" or "Error executing query")
- **Guard attempts + unmatched count** (from `NUMERIC GUARD — Attempt N`)
- **Cache hits** (`cache: created/read` per turn)

---

## Step 8: Score Quality

For EACH run, score against `eval_set/quality_rubric.md`:

| Sub-score | Range | Check |
|-----------|-------|-------|
| Numeric Accuracy | 0-3 | Cross-check every number in output against `eval_set/expected_values.json`. Count hallucinations (numbers not in any data source). |
| Relevance | 0-3 | Insights address the most important findings? Sentiment correctly assigned? |
| Actionability | 0-2 | Names specific customers/agents/amounts? |
| Clarity | 0-2 | Follows template structure? Scannable? Tables included? |

**Total = sum of sub-scores (max 10).** Take the median across both runs.

Hallucinations = numbers in the final user-facing output (after guard) that don't appear in raw data blocks OR tool results.

---

## Step 9: Decide — Keep, Revert, or Skip

**Stop criteria (revert if any are true):**
- Quality score < 7/10
- Hallucination count > 2
- Numeric accuracy sub-score < 2/3
- Cost INCREASED vs active baseline
- Iteration savings < $0.005 (mark "no value, skip")

**Keep if:**
- Cost decreased OR quality improved (or both)
- Hallucinations ≤ 2
- Quality score ≥ 7/10

---

## Step 10: Document the Iteration

Copy `ITERATION_TEMPLATE.md` to `03_iteration_<NN>_<short_name>.md` (e.g., `03_iteration_01_fix_guard.md`).

Fill in every section. The doc should let any teammate understand:
- What changed (with file paths)
- The before/after metrics (per run + median)
- The quality score breakdown
- Sample output
- Verdict + rationale

---

## Step 11: Update MASTER_LOG

Append the result row in MASTER_LOG.md:
- Update the iteration's row with: status, cost, Δcost vs baseline, quality, hallucinations, date, notes
- If kept: update **Active baseline** and **Cost per click** at top of MASTER_LOG
- Append one bullet to **Lessons Learned**
- If reverted/reordered: append to **Decisions / Course Corrections**
- Update the **Cumulative Trajectory** ASCII chart

---

## Step 12: Confirm With User Before Committing

Before any git commit, share with the user:
1. The metrics summary (cost before → after, quality before → after, hallucinations)
2. The verdict (keep/revert)
3. The proposed commit message

Ask: "Approve commit?"

If user wants tweaks (e.g., adjust commit message, hold off on commit), follow their direction.

---

## Step 13: Commit (or Revert)

If KEPT:
```bash
git add apps/dashboard/src/lib/ai-insight/<changed files> AI_Insight_Study/
git commit -m "study(iter-N): <change> — cost \$X→\$Y, quality A/10→B/10"
```

If REVERTED:
```bash
git checkout apps/dashboard/src/lib/ai-insight/<changed files>
git add AI_Insight_Study/
git commit -m "study(iter-N): REVERTED <change> — see 03_iteration_NN.md for why"
```

---

## Step 14: End Session

Final message to user:
```
Iteration <N> complete. Result: <KEPT|REVERTED>
Cost: $X → $Y
Quality: A/10 → B/10
Details: AI_Insight_Study/03_iteration_NN_<name>.md
Master log updated. Next pending: Iteration <N+1>.
```

---

## Common Failure Modes

- **Dev server picks up old code:** Next.js hot reload usually works, but if metrics look unchanged, restart the server.
- **Cache survives DELETE:** Confirm `DELETE 6` (components) + `DELETE 1` (section) before each run.
- **Log file doesn't exist:** Check `AI_INSIGHT_DEBUG_FILE=true` in `.env.local`.
- **Run takes >5 minutes:** Server timeout is 5 min — analysis aborted. Check dev log for errors.
- **Eval data changed:** If DB pipeline refreshed, expected values may have shifted. Re-run baseline before continuing.
