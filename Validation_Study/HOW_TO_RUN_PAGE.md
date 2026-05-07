# How to Run a Page Validation Session

> Standard procedure for any session that validates ONE page. Follow exactly.
> One page per session. Fresh worker should be able to follow this end-to-end.

> **CRITICAL ORDER OF OPERATIONS:**
> 1. **Identify** section (Step 1)
> 2. **Discuss** with the user (Step 2)
> 3. **Plan** any guard tweaks (Step 3)
> 4. **Get approval** (Step 4)
> 5. **Run** baseline × 2 (Step 5)
> 6. **Implement** any approved guard tweaks (Step 6)
> 7. **Run** after × 2 (Step 7)
> 8. **Score, decide, document, update master log** (Steps 8–11)
>
> NEVER skip ahead to running the study. The user is the final reviewer of every plan.

---

## Step 0 — Orient (≤2 min)

1. Read `MASTER_LOG.md` → identify the next page row marked `⏳ pending`
2. Confirm dev server is up:
   ```bash
   lsof -i :3001 | head
   ```
   If not, start it:
   ```bash
   cd apps/dashboard && PORT=3001 npm run dev   # run_in_background
   ```
3. Confirm the toggle env var exists in `apps/dashboard/.env.local`:
   ```bash
   grep AI_INSIGHT_VALIDATION_BASELINE apps/dashboard/.env.local
   ```
4. Confirm working tree is clean (`git status`) so any guard tweaks made in Step 6 are isolated.

---

## Step 1 — Identify the section

1. Open the page in the browser: `http://localhost:3001/<page-slug>`
   - Sales → `/sales`
   - Returns → `/return`
   - Financials → `/financial`
   - Supplier Performance → `/supplier-performance`
2. Locate the **first** AI Insight section header (top-most on the page in normal scroll order)
3. Find the `section_key` in code:
   ```bash
   grep -rn "section_key\|sectionKey" apps/dashboard/src/lib/ai-insight/prompts.ts | head
   grep -rn "Get Insight" apps/dashboard/src/components | head
   ```
4. Record in your draft `page_NN_<section>.md`:
   - `section_key`
   - Display title
   - Page route
   - Which components feed it (`SECTION_COMPONENTS[section_key]`)

---

## Step 2 — Discuss with the user (BEFORE any code change)

Open the conversation with:
1. Which section was selected and why it's the "first"
2. A read of the section's data fetcher (`data-fetcher.ts`) + prompts (`prompts.ts`) — what tools it calls, what numbers it produces
3. Build / capture an expected-values eval set: query the DB directly for what the section *should* report, save under `Validation_Study/eval/page_NN_<section>/expected_values.json`
4. Open questions for the user — anything unclear, judgement calls, alternatives

DO NOT propose any code change yet. Just align on the section + the expected values.

---

## Step 3 — Write the Change Plan (if any guard tweaks are anticipated)

If the section uses different number formats than `payment_outstanding` / `financial_variance` (e.g., percentages rendered differently, currency symbols other than RM, days/units the existing whitelist doesn't cover), draft a plan:

- **What guard tweaks** you anticipate (file paths, regex patterns)
- **What stays the same**
- **Risk** (any chance the tweak breaks the existing pilots' guard?)
- **Success criteria** (`Unmatched=0` on after runs)
- **Rollback** (`git checkout numeric-guard.ts`)

Keep it ≤15 lines. If no tweaks anticipated, write "No code changes anticipated; baseline outcome will tell us if any are needed."

---

## Step 4 — Get Approval

Ask the user explicitly:
> "Plan above. Approve to proceed with baseline runs?"

Wait for explicit YES. If pushback, revise and re-ask.

---

## Step 5 — BASELINE Runs (caching OFF)

### 5a. Enable baseline mode

Edit `apps/dashboard/.env.local` — uncomment the toggle:
```bash
AI_INSIGHT_VALIDATION_BASELINE=1
```

### 5b. Restart dev server

Next.js does NOT hot-reload env vars. Kill the existing dev process and restart:
```bash
# Find PID
lsof -ti :3001 | xargs kill
# Restart in background
cd apps/dashboard && PORT=3001 npm run dev   # run_in_background
# Wait for "Ready" in stdout
```

### 5c. Verify caching is OFF

Make one quick test request and check log for `cache_read=0, cache_created=0` on every turn. If anything caches, the toggle didn't take — re-check Step 5a/b.

### 5d. Run baseline × 2

For each of the 2 baseline runs:

```bash
# 1. Clear cached insight for THIS section
PGPASSWORD=hoiyong_dev_2026 psql -h localhost -p 5433 -U hoiyong -d hoiyong -c "
DELETE FROM ai_insight_component WHERE section_id IN (SELECT id FROM ai_insight_section WHERE section_key = '<section_key>');
DELETE FROM ai_insight_section WHERE section_key = '<section_key>';"
```

Then via Playwright:
1. Navigate to `http://localhost:3001/<page-slug>`
2. Wait for the section title visible
3. Click the section's "Get Insight" button (the FIRST one on the page if multiple)
4. Wait for "Analyze" → click "Analyze"
5. Poll log file until `SESSION COMPLETE`:
   ```bash
   RUN_LOG=""
   until [ -n "$RUN_LOG" ] && grep -q "SESSION COMPLETE" "$RUN_LOG" 2>/dev/null; do
     sleep 5
     RUN_LOG=$(ls -t /Users/aqreight/Documents/Projects/Hoi-Yong_Finance/apps/dashboard/logs/ai-debug-<section_key>-*.log | head -1)
   done
   echo "DONE: $RUN_LOG"
   ```
   Use `run_in_background: true` so you don't burn context.

6. Copy log to study folder:
   ```bash
   cp <newest log> /Users/aqreight/Documents/Projects/Hoi-Yong_Finance/Validation_Study/page_NN_<section>_baseline_run<X>.log
   ```

---

## Step 6 — Apply Approved Guard Tweaks (if any)

Only if Step 3 plan was approved AND baseline runs revealed valid numbers being rejected by the guard.

Edit `apps/dashboard/src/lib/ai-insight/numeric-guard.ts` per the plan. Stay strictly inside scope — no drive-by fixes.

Type-check:
```bash
npx tsc --noEmit --project apps/dashboard/tsconfig.json
```

---

## Step 7 — AFTER Runs (caching ON)

### 7a. Disable baseline mode

Edit `apps/dashboard/.env.local` — comment out or remove:
```bash
# AI_INSIGHT_VALIDATION_BASELINE=1
```

### 7b. Restart dev server (same procedure as 5b)

### 7c. Verify caching is back ON

After one warm-up call, check log shows `cache_created=N` on first turn and `cache_read=N` on later turns.

### 7d. Run after × 2

Same procedure as Step 5d. Logs go to `..._after_run<X>.log`.

---

## Step 8 — Extract Metrics

For each of the 4 runs:

```bash
grep -E "Components analyzed|Total tokens|Estimated cost|Tokens|Cost|Cache|Passed|Unmatched|TOOL_USE id" <log>
```

Per-run record:
- **Total tokens** (input + output)
- **Estimated cost (USD)**
- **Cache** (created / read per turn)
- **Tool calls** (count of `TOOL_USE id=` lines)
- **Failed tool calls** ("Columns not allowed" / "Error executing query")
- **Guard attempts** + **Unmatched count** (from `NUMERIC GUARD — Attempt N`)
- **Latency** (compute from "Started at" first component → final "Finished at")

---

## Step 9 — Score Quality

For EACH run, score against `AI_Insight_Study/eval_set/quality_rubric.md`:

| Sub-score | Range | Check |
|---|---|---|
| Numeric Accuracy | 0–3 | Cross-check every number in output against expected_values.json. Count hallucinations |
| Relevance | 0–3 | Insights address the most important findings? Sentiment correctly assigned? |
| Actionability | 0–2 | Names specific entities/amounts? |
| Clarity | 0–2 | Follows template structure? Scannable? Tables included? |

**Total = sum (max 10).** Take the **median across the 2 runs of each side**.

Hallucinations = numbers in final output (after guard) that don't appear in raw data blocks OR tool results.

---

## Step 10 — Decide Verdict

Apply the per-page rule:

| Outcome | Verdict |
|---|---|
| After cost ≤ baseline AND quality ≥ baseline AND hallucinations ≤ baseline | ✅ **CONFIRM** |
| Cost down but quality regressed | ❌ **NEEDS TUNING** |
| Cost up | ⚠️ **INVESTIGATE** |

If **NEEDS TUNING** and you didn't already plan tweaks: stop, return to Step 3, plan section-specific guard additions, get approval, re-run after × 2, re-score.

---

## Step 11 — Document the Page

Copy `PAGE_TEMPLATE.md` to `page_NN_<section>.md`. Fill every section:
- Identity (section_key, page route, components)
- Per-run metrics (baseline ×2, after ×2) + medians
- Quality score breakdown per run
- Cost delta absolute + %
- Verdict + rationale
- **Lessons learned** (1–3 bullets — what surprised you, what's worth carrying forward)
- **Other improvement ideas spotted** (NOT in scope, but file them)

---

## Step 12 — Update MASTER_LOG

In `Validation_Study/MASTER_LOG.md`:
- Update the page's row in **Pages in Scope** with status
- Append a row in **Results Table** with all metrics + verdict
- If guard tweaks were added, append a row in **Code Changes by Section**
- Append one bullet to **Lessons Learned**

---

## Step 13 — Confirm With User Before Committing

Share with the user:
1. Metrics summary (cost B → A, quality B → A, hallucinations B → A)
2. Verdict (CONFIRM / NEEDS TUNING / INVESTIGATE)
3. Proposed commit message

Ask: "Approve commit?"

---

## Step 14 — Commit

```bash
git add apps/dashboard/src/lib/ai-insight/numeric-guard.ts Validation_Study/
git commit -m "validation(<page>): <section_key> — cost \$X→\$Y, quality A/10→B/10, verdict <CONFIRM|NEEDS TUNING|INVESTIGATE>"
```

If toggle was left enabled in `.env.local`, that file should NOT be staged (it's gitignored). Double-check `git status`.

---

## Step 15 — End Session

Final message to user:
```
Page <N> validation complete. Section: <section_key>. Verdict: <…>
Cost: $X → $Y  (Δ%)
Quality: A/10 → B/10
Hallucinations: M → N
Details: Validation_Study/page_NN_<section>.md
Master log updated. Next pending: <next page or "all pages complete">.
```

---

## Common Failure Modes

- **Toggle didn't take** — Next.js needs a fresh process. Killing the dev server and restarting is the only way; hot-reload won't pick up env-var changes.
- **Cache survives DELETE** — Confirm `DELETE N` (components) + `DELETE 1` (section) before each run.
- **Log file doesn't exist** — Check `AI_INSIGHT_DEBUG_FILE=true` in `.env.local`.
- **Run takes >5 min** — Server timeout is 5 min. Check dev log for errors.
- **Baseline cost similar to after** — Caching may not have been actually disabled. Re-verify Step 5c.
- **Unfamiliar number formats in baseline** — Section may produce currency / unit notation the existing guard wasn't tuned for. That's the whole point of this study; document it and plan tweaks in Step 3.
