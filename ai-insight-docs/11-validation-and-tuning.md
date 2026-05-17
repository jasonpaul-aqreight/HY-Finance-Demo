# 11 — Validation & Tuning

> **Classification:** Spine
> **Enables:** A repeatable procedure for proving a section's insight quality, deciding whether to ship it, and fixing it when it fails.
> **Read after:** 00, 02, 04, 04a, 05, 08, 09

---

## 1. Purpose

This document specifies the **quality contract** for AI Insight sections and the **iteration procedure** that proves a section meets it.

The engine's hard guardrails (numeric guard, tool blocklist, cost cap — docs 04, 05) guarantee *the system won't break or lie about numbers it cited*. They do **not** guarantee the insight is **relevant, actionable, or scannable**. Those are quality properties measured by humans against a rubric and tuned by changing fetchers or prompts.

A prod rebuild that passes the per-layer verification checkpoints in docs 01–10 has a working engine. This document tells the dev when a *section* is acceptable to expose to executives — and what to do when the answer is "not yet". After this doc you can score a section's insight output, decide whether it ships, identify which class of fix the failure needs, and document the iteration so the next person doesn't repeat your work.

## 2. Prerequisites

- **Doc 00** — vocabulary; the Engine/Domain Pack/Spine split (this is Spine: section quality is a contract, not a runtime layer).
- **Doc 02** — the catalog of sections you're validating, and the threshold registry whose tokens may be the lever you tune.
- **Doc 04 §5.5** — the numeric guard (the lower bound on hallucination tolerance — `guard.passed = false` means you have work to do *before* scoring).
- **Doc 04 §5.7** — the debug log (`AI_INSIGHT_DEBUG_FILE`) is the primary evidence artifact for every iteration.
- **Doc 04a** — the prompt catalog: when scoring "did the output reflect the prompt's stated rules?", 04a is the spec.
- **Doc 05** + **Doc 08 §5.2** — the admin batch trigger is how a production environment produces the runs you score. There is no per-section manual trigger in the production model.
- **Doc 09** — the end-to-end walkthrough; a section result you can score lives at the end of that flow.

This document has no ENV variables of its own. It consumes `AI_INSIGHT_DEBUG_FILE` (doc 04) when you need raw prompt/debug artifacts. Cache metrics, when present, are read from the model provider's usage metadata; the current OpenRouter-only reference does not expose a validation-specific cache-disable switch.

## 3. Concept & Contract

> *Stack-neutral. The stress-test idea, the rubric, and the acceptance gate are domain-agnostic. The worked examples below are finance.*

Quality validation is the activity of **stress-testing a section's narrative output against ground-truth data**, scoring it against a fixed rubric, and either shipping the section or fixing it. There are only two questions:

1. **Did the narrative cite the right numbers?** — Numeric truthfulness. The numeric guard catches the worst class (hallucinated numbers), but not *"cited a true number that was the wrong one for this question"*.
2. **Did the narrative say something useful?** — Relevance, actionability, clarity. Human judgements against a per-section "what should an analyst conclude here?" fixture.

**Inputs to validation:**

- A *section result* (the persisted JSON the batch run produced) and the *debug log* the same run wrote.
- A per-section *expected-values fixture* — a JSON object listing the key numbers that *should* appear in the narrative, with tolerances.
- A *quality rubric* — four sub-scores summing to 10, with sharp pass/fail thresholds.

**Outputs of validation:**

- A scored evaluation row in the rollout tracker.
- A *decision*: production-ready, acceptable (ship with caveats), or fail (fix and re-score).
- If fail: a *tuning class* (one of three canonical patterns, §5.4) and a planned fix.

**Invariants (binding on every iteration):**

1. **Two runs, median score.** Single runs are unreliable signal; the same prompt against the same data should produce stable output, and a one-shot score can be lucky or unlucky. Score the median of two consecutive runs of the same section.
2. **Numeric accuracy is binary at the section level.** Any hallucinated number fails the section regardless of other sub-scores. The other axes are continuous; this one is a gate.
3. **A failing section is not "tuned by re-prompting".** It is tuned by one of three structural fixes (§5.4): widening the fetcher's allow-list with the missing number, splitting or relabelling a scope-mixing component, or tightening the tool policy. "Try different wording" is not a tuning pattern.
4. **Every iteration is documented before the next starts.** The next person should know what you tried and what you learned; an undocumented iteration is wasted work.

**Boundary.** This doc is the *contract* — the rubric, the gate, the fixture shape, the tuning vocabulary. The *operator manual* for running iterations (Playwright scripts, debug-log greps, log file paths) lives in `AI_Insight_Study/HOW_TO_RUN_ITERATION.md` and is referenced here as supporting infrastructure, not specified line-by-line.

## 4. Data contracts

### 4.1 Owned — eval-set fixture (`expected_values.json`)

Per-section JSON file under `AI_Insight_Study/eval_set/<section_key>/expected_values.json` (the first-seeded section may live directly under `eval_set/`). Free-form-but-conventional: keys are component keys; values are the numbers (or top-N arrays) the narrative is expected to surface.

```json
{
  "<component_key>": {
    "value_rm":     <number>,
    "value_pct":    <number>,
    "value_days":   <number>,
    "count":        <integer>,
    "top_5":        [{ "name": "<entity>", "value": <number> }, …],
    "buckets":      [{ "bucket": "<label>", "amount_rm": <number>, "count": <integer> }, …]
  }
}
```

Worked excerpt from `eval_set/expected_values.json` for `payment_outstanding`:

```json
{
  "total_outstanding":     { "value_rm": 11349862.52, "top_5": [/* … */] },
  "overdue_amount":        { "value_rm": 11349862.52, "overdue_pct": 100.0, "overdue_customers": 227 },
  "credit_limit_breaches": { "count": 21 },
  "aging_analysis":        { "buckets": [{ "bucket": "120+", "invoices": 3376, "amount_rm": 11349862.52 }] },
  "credit_usage_distribution": { "within_limit": 300, "near_limit": 10, "over_limit": 21, "no_limit": 34 },
  "risk_tier":             { "high": { "count": 29, "outstanding_rm": 6587822.96 } }
}
```

The fixture is **not consumed by code**; it is the human scorer's reference. The same shape can drive automated cross-checks (out of scope for the current rebuild but a reasonable extension).

A companion `snapshot_state.md` per section records the snapshot date and DB state the fixture targets — refresh both together when the underlying data ages.

### 4.2 Owned — quality rubric (four axes, total /10)

| Axis | Range | Pass criteria |
|---|---|---|
| **Numeric Accuracy** (NA) | 0–3 | 3 = every cited RM, %, days, count matches `expected_values.json` within tolerance (RM ±1, pct ±0.1, days ±0.1, count exact). 0 = any hallucinated number. |
| **Relevance** (Rel) | 0–3 | 3 = addresses the most important finding for the section; positive/negative sentiment is correct. |
| **Actionability** (Act) | 0–2 | 2 = names specific customers / amounts / root causes; an executive could brief their team from this. |
| **Clarity** (Clar) | 0–2 | 2 = scannable; subtitled detail; no jargon; consistent with the detail template. |

### 4.3 Owned — acceptance gate

A section result with median-of-two-runs scores is classified as one of:

| Result | Required | Meaning |
|---|---|---|
| **Production-ready** | Total ≥ 8/10 **and** NA = 3 **and** hallucinations = 0 **and** guard passed within 2 attempts **and** tool calls ≤ 2 (unless drill-down documented useful) **and** failed tool calls = 0 (or documented immaterial). | Ship. |
| **Acceptable** | Total ≥ 7/10 **and** hallucinations = 0 (the operational rules above still hold). | Ship with a note in the rollout tracker; track for revisit. |
| **Fail** | Total < 7/10 **or** any hallucinated number. | Do not ship. Identify tuning class (§5.4), implement fix, re-score. |

**Material hallucination examples (force fail regardless of total):** wrong RM/pct/days/count, wrong rank, wrong trend direction, wrong entity attribution, unsupported cause stated as fact, anything that could change an executive decision.

**Minor issues allowed on the *Acceptable* tier:** qualified language ("may indicate", "likely"), small wording imperfections, one guard retry that ends clean, relevance gaps that don't affect the headline insight.

### 4.4 Owned — per-section verification record

A short markdown file (or rollout-tracker row) capturing the section's current state:

```
Section: <section_key>
Page: <page>
Components: <list with type>
Scope: <range | snapshot | fiscal>
Tool policy: <none | aggregate_only | full>

Questions answered
  - <main business question 1>
  - …

Pre-computed values (provided by fetcher)
  - <exact list with units>

Numerical guardrails (allowed-values whitelist composition)
  - RM values:    <labels>
  - pct values:   <labels>
  - days values:  <labels>
  - count values: <labels>

Expected-values fixture
  - File: AI_Insight_Study/eval_set/<section>/expected_values.json

Rollout status (as of <date>)
  - Decision: <Production-ready | Acceptable | Fail>
  - Latest cost/click, total score, hallucinations, guard attempts, tool calls

Known tuning lessons
  - <bullet from prior iterations if applicable>
```

### 4.5 Consumed — debug log (doc 04 §5.7)

`logs/ai-debug-<section_key>-<timestamp>.log` written when `AI_INSIGHT_DEBUG_FILE=true`. Each iteration captures two such files (one per run). Fields used by the scorer:

- Per-component start time, tokens, cost.
- Per-turn system + user prompt verbatim.
- Model response text + `stop_reason`.
- Tool call inputs and (≤3000-char) tool results.
- Each numeric-guard attempt and any unmatched values.
- Final session summary: total tokens, total cost, provider path.

## 5. Behavior & flow

### 5.1 Iteration procedure (12 steps)

One iteration is one structural change followed by re-scoring. Sequence:

1. **Orient (≤2 min).** Read the rollout tracker entry, the latest iteration log, and the eval-set fixture. Confirm the fixture matches the current snapshot/date range; if it has drifted, refresh it before scoring (rule 6.3 #1).
2. **State the hypothesis.** One sentence: *"The section fails on [axis] because [structural cause]; the fix is [tuning class] applied to [component/policy]."* If you can't complete this sentence, you don't have enough evidence — re-read the debug log first.
3. **Plan.** ~15 lines: goal, files to change, what stays the same, risk, success criteria (cost target + quality target), rollback approach.
4. **Implement.** One focused change. No drive-by fixes; if you noticed something else, write it down for the next iteration.
5. **Pre-flight.** Dev server up; DB snapshot matches eval fixture; type-check passes.
6. **Run 2× and capture logs.** Trigger the admin batch (doc 08 §5.2). When the target section completes, copy `logs/ai-debug-<section>-<ts>.log` out and rename to `iter<N>_run1_log.log` / `iter<N>_run2_log.log`. Two back-to-back runs keep the snapshot stable.
7. **Extract metrics.** From each log: total tokens, total cost, latency, summary turn count, tool-call count, failed tool calls, guard attempts, and provider-reported cache-created/cache-read tokens if present.
8. **Score quality** against §4.2 for each run, then take the median.
9. **Decide** against §4.3.
10. **Document.** A new iteration file (template in §7) — every section: hypothesis, change, before/after metrics, scores, decision, lessons learned.
11. **Update rollout tracker** with status (Production-ready / Acceptable / Fail / Pending), Δcost vs baseline, score, hallucination count.
12. **Commit.** Format: `study(iter-N): <change> — cost $X→$Y, quality A/10→B/10`.

### 5.2 Scoring against the rubric

For each run, populate the per-axis score with these calibrations:

- **NA (0–3).** Count cited numbers in the narrative; cross-reference each to `expected_values.json` within tolerance. One hallucinated number ⇒ 0. All match ⇒ 3. A close-but-rounded number within tolerance (e.g. cited RM 1,055,577 vs expected 1,055,500 — within ±1 RM) ⇒ 3.
- **Rel (0–3).** Compare the *headline insights* (each card's `title` / `metric` / `summary`) to the eval fixture's "Questions answered" list. 3 = answers the most important question. 2 = answers a real question but misses the headline. 1 = surface-level / generic. 0 = irrelevant / wrong sentiment.
- **Act (0–2).** 2 = names specific entities (customer names, accounts, amounts, root causes). 1 = generic guidance ("monitor closely"). 0 = no action implied.
- **Clar (0–2).** 2 = follows the section's detail template (subtitled paragraphs, scannable, no unexplained jargon). 1 = readable but uneven. 0 = wall of text or template violations.

Take the median of two runs (for one section: if the two totals differ, take the higher — both are valid samples). If the totals differ by **more than 2 points**, run a third — high variance signals an unstable prompt or fetcher and is itself a defect (rule 6.3 #3).

### 5.3 Acceptance gate decision (two non-obvious calls)

Apply §4.3 directly to the median score. Two cases that catch reviewers out:

- **NA = 3 but Rel = 0** → Fail. The narrative may be numerically clean but pointing at the wrong story; that is a *worse* outcome than imperfect numbers on the right story, because it suggests the prompt's framing or the fetcher's emphasis is off. Numeric truth on the wrong question is not shippable.
- **`numericGuard.passed = false` after 2 attempts** → Fail regardless of other axes. The section persisted a flagged result and that flag must be cleared by a fetcher fix (Pattern 1, §5.4), not by re-rolling. **One** guard retry that ends clean is acceptable — the system self-corrected.

### 5.4 Three canonical tuning patterns

When a section fails, the fix falls into exactly one of three structural classes. Reach for these *in order* — they are listed by "smallest blast radius first".

#### Pattern 1 — Numeric guard failure → expand the fetcher

**Symptom.** `numericGuard.unmatched` lists a number the narrative cited (or scoring records `NA < 3`).

**Why structural.** The model was forced to back-solve a value (or invent one) because the fetcher didn't pre-compute it. The numeric guard caught the symptom; the cause is the missing value in `allowed[]`.

**Fix.** Move the calculation into the fetcher. Add the result to `allowed[]` with a labelled entry (e.g. `{ label: 'H1 avg neg gap', value: -1055577, unit: 'RM' }`). Update the fetcher's data block to include the value verbatim so the narrative can cite it without arithmetic.

**Anti-pattern.** *Don't* expand the safe-integer set. *Don't* loosen the tolerance. The model should narrate what the fetcher hands it; widen the contract, not the rubber stamp.

**Worked example.** `payment_collection_trend` originally let the model derive a monthly average gap; the model produced a near-right but unverifiable number. Fix: pre-computed `RM -1,055,577/month` average gap with explicit rank labels (S01 rollout).

#### Pattern 2 — Scope-mixing hallucination → split or relabel the component

**Symptom.** The narrative attributes a "period total" trait to a "snapshot top-5" entity (or vice versa); mixes "active customer universe" with "all customers ever"; reports an MoM rank as a YoY rank.

**Why structural.** A single fetcher data block carried numbers from two populations under similar-looking labels; the model conflated them.

**Fix.** Either (a) split the fetcher into two components with distinct keys, or (b) keep one component but add explicit scope labels to *every* number — `(period)`, `(snapshot)`, `(active universe only)`, `(top 5 by margin)`, `(MoM)`, `(YoY)`. Make the scope unambiguous at every cite point.

**Anti-pattern.** *Don't* edit the prompt body to say "the numbers below are period totals". Inline scope labels are the canonical solution; prose preambles get skipped by the model under load.

**Worked example.** `sales_trend` originally mixed MoM and YoY ranks; fix added explicit MoM/YoY labels on every ranked entry plus peak/trough markers (S03 rollout).

#### Pattern 3 — Tool schema errors → tighten the policy or the whitelist

**Symptom.** The debug log shows the model calling `query_local_table` with a column that doesn't exist for that table, or `query_rds_table` from a section whose tool policy should not include it. Result: a string error returned to the model (doc 04 §5.5) and (often) a recovered-but-thin final summary.

**Why structural.** Either the section's tool policy is too permissive (the model is reaching for data it shouldn't need), or the column whitelist is broader than the fetcher's pre-computed evidence justifies.

**Fix** — one of three knobs, least disruptive first:

1. **Tighten the section's tool policy** to `aggregate_only` (or `none` if the section never needs drill-down).
2. **Shorten the table's column whitelist** so the model can't try the bad column. (Coordinated change with doc 04 §5.5.)
3. **Add the failing column to the whitelist** *only* if the column genuinely exists and the section needs it.

**Anti-pattern.** *Don't* accept "the analysis was fine anyway" as a fix. A failed tool call is a sign the data layer is the wrong shape for the question; ignoring it accumulates debt that surfaces as low Rel scores later.

**Worked example.** `payment_collection_trend` initially had `full` policy; the model called a non-aggregate table, got an error, recovered. Fix: section dropped to `aggregate_only` with `MAX_TOOL_CALLS_PER_SUMMARY = 2`; immaterial failures documented (S01 rollout).

### 5.5 Caching note for cost iteration

When iterating on the **cost** of a section (not its quality), compare like-for-like runs: same provider/model configuration, same section scope, same tool policy, and the same cache posture as far as the gateway exposes it. In the current OpenRouter-only reference there is no `AI_INSIGHT_VALIDATION_BASELINE` / `cacheSystem` switch in code. Use the debug log's `cache: created=..., read=...` fields and provider metadata as evidence; do not assume a local ENV can force an uncached OpenRouter baseline.

## 6. Rules & edge cases

### 6.1 Fetcher style rules (binding on every fetcher author)

The single biggest predictor of section quality is the fetcher's data block. Five conventions, all observable from a code review:

| # | Rule | Why |
|---|---|---|
| 1 | **Single source of truth per dimension.** If a section has a chart and a KPI for the same number, one fetcher provides the canonical value; the other cites it explicitly. | Prevents the model from picking between two slightly-different formattings of the same datum. |
| 2 | **Explicit scope labels on every number.** Use `(period)`, `(snapshot)`, `(active universe only)`, `(top 5)`, `(YoY)`, `(MoM)` etc. Inline next to the value, not as a header. | The model under load drops headers; inline labels survive. |
| 3 | **Pre-compute totals, ranks, deltas, ratios, half-period averages, streaks, peak/trough labels.** Anything the model might back-solve. | The summary slot is told it has at most 2 tool calls and should not back-solve. If you don't pre-compute it, you get hallucination or a wasted tool call. |
| 4 | **Every cited number must be in `allowed[]` with the right unit.** No exceptions — even "obvious" derived values. | The numeric guard is the safety net; bypassing it requires `formatGuardError` retries which cost tokens and erode quality. |
| 5 | **Plain text and short markdown only.** No fenced code blocks unless quoting JSON/SQL. | The summary user prompt is already structured; nested code blocks confuse the parser. |

### 6.2 Pre-compute by risk type

A different framing of rule 6.1 #3 — what to pre-compute is determined by what the model is *at risk of getting wrong*:

| Risk class | Required pre-compute |
|---|---|
| **Sub-period trend claims** (e.g. "January was the worst month") | Half-period averages, first-to-last changes, longest streaks, peak/trough rows with named labels. |
| **Concentration claims** (e.g. "top customer is 40% of revenue") | Top-1, top-3, top-5, top-10 totals and shares as labelled `allowed[]` entries. |
| **Rank claims** (e.g. "slowest payer") | Explicit slowest/fastest/highest/lowest ordered labels — not just the underlying values. |
| **Margin claims** (e.g. "margin compressed 2pp") | Margin %, margin drift in pp, GP/NP sign flips, top movers. |
| **Snapshot claims** (e.g. "as of today") | Latest snapshot date and snapshot population labels (`active universe only`, `with credit limit`, etc.). |
| **Budget claims** (e.g. "over budget") | Approved budget table *only when one exists*; otherwise the fetcher must explicitly state "no approved budget" so the prompt's conditional rules trigger correctly (see [04a `fv_budget_suggestions`](04a-prompt-catalog.md)). |

### 6.3 Other edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Eval fixture drifted (snapshot date moved past it) | Refresh the fixture before scoring; do not score against a stale fixture | A stale fixture produces both false positives and false negatives — invalidates the iteration. |
| 2 | Single-run scoring | Do not use as evidence; only median-of-two | Variance is real; single-run scores mislead direction decisions (invariant 1). |
| 3 | Two-run variance > 2 points | Run a third; if still high, flag prompt/fetcher instability and *fix that first* | A wobbly section is worse than a low-scoring stable one — execs lose trust in the consistency. |
| 4 | "Fixed by re-prompting" | Reject as fix; classify into one of §5.4's three patterns | Prompt wording does not fix structural problems; it masks them until the next data refresh (invariant 3). |
| 5 | Section flagged `numericGuard.passed = false` in storage | Treat as a hard fail regardless of scoring axes | The flag is a visible defect; clear via Pattern 1, not by re-rolling. |
| 6 | Acceptance gate met, but cost > $0.20/click | Document in rollout tracker; not a hard fail, but tracked debt | Cost discipline matters at scale; track and revisit. |
| 7 | Section newly added (no prior iteration) | Score Iter 0 baseline before any tuning; commit the baseline log | Without a baseline you cannot prove improvement. |
| 8 | Section guidance prompt empty | Default; do not add guidance unless an iteration proves it is needed | Empty guidance keeps the surface area small. |
| 9 | Section change overlaps a threshold-token edit | Re-score after the token edit; thresholds can shift the rubric's relevance assessment | The same narrative may score differently against different judgement boundaries. |
| 10 | Section is HR scaffold (no components) | Skip — there is nothing to score | HR sections are seams (doc 02), not analysable units yet. |

## 7. Reference Implementation

The validation infrastructure lives outside `apps/` because it is a process, not a product. Paths are evidence; the contract above is what binds.

| Path | Role |
|---|---|
| `AI_Insight_Study/HOW_TO_RUN_ITERATION.md` | Historical/pilot runbook (Playwright scripts, log paths, grep recipes). It is still useful for metric extraction patterns, but it hardcodes the old `payment_outstanding` / manual Analyze flow in places. For current production-shaped validation, use the admin batch trigger (doc 08 §5.2) or the rollout-tracker process and adapt section keys/log globs before running. |
| `AI_Insight_Study/eval_set/quality_rubric.md` | Master rubric (this doc §4.2 is a recap; the file is the source). |
| `AI_Insight_Study/eval_set/<section>/expected_values.json` | Per-section fixture (§4.1). |
| `AI_Insight_Study/eval_set/<section>/snapshot_state.md` | Records the snapshot date and DB state the fixture targets; refresh together with the fixture. |
| `AI_Insight_Study/ROLLOUT_TRACKER.md` | Current per-section rollout source for Finance sections. It records the revised acceptance gate, one-run Playwright rollout evaluations where approved, and the table columns: ID, Section Key, Date, Eval Source, Cost/Click, Quality, NA, Rel, Act, Clarity, Hallucinations, Guard, Tool Calls, Failed Calls, Result, Log Path, Notes. |
| `AI_Insight_Study/MASTER_LOG.md` | Cross-section iteration log; one entry per iteration with hypothesis, change, before/after metrics, decision. |
| `AI_Insight_Study/ITERATION_TEMPLATE.md` | The template each per-iteration file is copied from. |
| `AI_Insight_Study/03_iteration_<NN>_<short_name>.md` | Per-iteration file written from the template above. |
| `apps/dashboard/logs/ai-debug-<section>-<ts>.log` | The raw debug artifact every iteration captures (doc 04 §5.7). |

**Per-iteration file template** (copy `ITERATION_TEMPLATE.md`; fill every section):

```
# Iteration <NN> — <short_name>

## Hypothesis
One sentence: section fails on [axis] because [cause]; fix is [tuning class].

## Change
- Files touched: …
- What stayed the same: …

## Pre-flight
- Snapshot date: …
- Eval fixture: …
- Type-check: pass/fail

## Runs
- Run 1: log=iter<N>_run1_log.log; tokens=…; cost=$…; latency=…; tool_calls=…; guard_attempts=…
- Run 2: log=iter<N>_run2_log.log; …

## Scores (median)
- NA: X/3   Rel: X/3   Act: X/2   Clar: X/2   Total: X/10
- Hallucinations: X
- Decision: Production-ready | Acceptable | Fail

## Lessons
- …

## Next iteration (if fail)
- Hypothesis: …
```

## 8. Verification checkpoint

**Setup.** Pick one section already specified by docs 02–04 (recommended: `payment_collection_trend` — small, well-known reference). Confirm the engine is built per docs 01–08 and the section can be generated end-to-end (doc 09). Ensure `AI_INSIGHT_DEBUG_FILE=true` for the iteration runs.

**Action & expected result:**

1. **Baseline.** Trigger the batch (doc 08 §5.2). Capture the debug log. Score per §4.2 (single run, baseline only). Record the total, NA, hallucinations, guard attempts, tool calls.
2. **Decide.** Apply §4.3. If Production-ready: stop — the section is shippable. If Fail: identify the tuning class per §5.4 from the symptom in the debug log.
3. **One iteration.** Apply the fix; re-trigger the batch; score again with two runs (§5.2). The median score should improve on at least one axis without regressing another by more than 1 point. If it regresses overall, the fix was wrong — revert and re-classify.
4. **Document.** Write the iteration file per §7 template. Update the rollout-tracker row.
5. **Median check.** Confirm the two runs' totals differ by ≤ 2 points; if not, flag instability and apply Pattern 2 (scope-mixing) — usually the cause.

**Definition of Done:** a developer who has read docs 00–10 plus this one, with no access to this repository's source, can score any section the engine produces, decide whether to ship it, identify the tuning class for any failure, document the iteration, and commit it under the standard format.
