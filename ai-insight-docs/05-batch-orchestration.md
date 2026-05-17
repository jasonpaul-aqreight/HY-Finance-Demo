# 05 — Batch Orchestration

> **Classification:** Engine
> **Enables:** A one-at-a-time batch runner with full lifecycle and progress tracking.
> **Read after:** 00, 01, 04

---

## 1. Purpose

This layer is the **conductor**. Given one trigger it processes the whole catalog of active sections exactly once: it opens a run, walks the catalog in order, resolves each section's scope, asks generation (doc 04) to produce that section's insight, persists it (doc 01), records progress after every section, and closes the run with a terminal status. It owns *how a pass is driven* — ordering, scope resolution, the single-run guarantee, inter-section pacing, per-section error isolation, and the fire-and-forget invocation model. It owns no prompts, no model calls, and no SQL of its own: generation and storage are called, not reimplemented. After this document you can build a batch runner that turns one administrator trigger into a complete, observable, idempotent regeneration of every section.

## 2. Prerequisites

- **Doc 00** — the vocabulary (Section, Scope, Insight, Batch run) in §3; the Engine/Domain-Pack split in §4 (this layer is Engine — it must not hardcode any domain's section list); the `05` ENV rows in §8.
- **Doc 01** — the batch-run ledger and its store functions (`createBatchRun`, `updateBatchProgress`, `finishBatchRun`, `getLatestBatchRun`, `markStaleRunningBatches`, `isBatchRunStale`, `BatchAlreadyRunningError`), the normalised `BatchRun`/`BatchSectionError` shapes, and `upsertSectionInsight`. The DB partial unique index on `(status) WHERE status='running'` and stale-run reclamation are **defined and owned there**; this layer only invokes them.
- **Doc 04** — `runSectionAnalysis(sectionKey, dateRange, abortController, onProgress, fiscalPeriod=null)` and its return shape `{ components, summary, totalTokens, totalCost }`. This layer treats generation as an atomic per-section call.
- **Doc 02** (Domain Pack) — the **ordered section-scope catalog**: which sections this pass walks, each one's page and scope kind. The Engine consumes this list; it does not define it.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the orchestrator as an idea.*

The layer is a **single-flight, ordered, fault-isolating job conductor over a list of work units**.

**Inputs**

- A *trigger* carrying a caller identity.
- An **ordered catalog of section scopes** (supplied by the Domain Pack). Each entry is a `SectionScope`:

  ```
  SectionScope = {
    sectionKey: string
    page:       string
    kind:       'range' | 'snapshot' | 'fiscal'
    resolve():  Promise<{ dateRange: DateRange | null, fiscalPeriod: FiscalPeriod | null }>
  }
  ```

  `resolve()` turns the section's *scope kind* into a concrete window at run time (the source data's latest extent), so a run always analyses the freshest period without the caller naming dates.

**Outputs / guarantees**

- One *batch-run record* per trigger, moving `running → success | partial | error`, carrying accumulated cost, tokens, per-section counts, the current section, and a list of per-section errors.
- For every catalog entry that succeeds, exactly one persisted section insight (atomic replace, via storage).
- A pass is **idempotent at the section grain**: re-running replaces each section wholesale; nothing is appended.

**Invariants (must never be violated)**

1. **At most one run is active at a time**, enforced by *two* independent guards: an in-process flag (fast path) and the datastore's single-active-run constraint (cross-process truth, doc 01).
2. **One bad section never aborts the pass.** A section that throws is recorded and skipped; the run continues and ends `partial`.
3. **The run is always closed.** Every terminal path (all-ok, some-failed, fatal) writes a terminal status; the in-process flag is always cleared.
4. **Progress is observable throughout**, not only at the end — a poller can see the run advance.
5. **The conductor invents nothing.** Scope comes from the catalog, the analysis from generation, persistence from storage.

**Boundary with adjacent layers**

- *Upstream:* the admin trigger (doc 08) calls this layer fire-and-forget.
- *Down:* it calls generation (doc 04) per section and storage (doc 01) for persistence and the run ledger.
- *Sideways:* the ordered scope catalog is a **Domain Pack** input (doc 02); the Engine iterates it without knowing the domain.

A reader can re-implement this layer on any runtime with a background task and a transactional store from this section alone.

## 4. Data contracts

### 4.1 Owned — in-memory run accumulators

Held for the duration of one `runInsightBatch` call and flushed into the ledger after every section:

| Field | Type | Meaning |
|---|---|---|
| `totalCostUsd` | number | Running sum of every section's model cost. |
| `totalTokens` | number | Running sum of every section's model tokens. |
| `sectionsCompleted` | number | Sections **processed** — incremented for success *and* failure. |
| `sectionsFailed` | number | Subset of the above that threw. |
| `sectionErrors` | `BatchSectionError[]` | One `{ sectionKey, message }` per failed section. |

`sectionsCompleted` counts every processed section, including failures; it is a *throughput* counter, not a *success* counter (success = `sectionsCompleted − sectionsFailed`).

### 4.2 Owned — the section-scope contract & scope-kind mechanisms

The `SectionScope` contract of §3 plus three scope-kind resolution mechanisms, all domain-neutral:

| Kind | `resolve()` produces | Mechanism |
|---|---|---|
| `range` | `{ dateRange: {start,end}, fiscalPeriod: null }` | Query the domain for its min/max date bounds; if no max ⇒ **throw** (`No max date available for <label>`); else **month-aligned trailing twelve months**: `end = endOfMonth(maxDate)`, `start = startOfMonth(end − 11 months)`, both formatted `YYYY-MM-DD`. |
| `snapshot` | `{ dateRange: null, fiscalPeriod: null }` | Point-in-time; no window is computed — the fetcher interprets "as of now". |
| `fiscal` | `{ dateRange: null, fiscalPeriod: {fiscalYear:'FY####', range:'fy'} }` | Pick the domain's fiscal year (reference rule: the second listed year if more than one, else the first), extract a 4-digit year; if none ⇒ **throw**. |

`DateRange = {start,end}` (`YYYY-MM-DD`) and `FiscalPeriod = {fiscalYear,range}` are the scope types owned by doc 04 (`types`); this layer only passes them through to generation and storage.

### 4.3 Consumed

| Contract | Owner | Use here |
|---|---|---|
| `createBatchRun`, `updateBatchProgress`, `finishBatchRun`, `getLatestBatchRun`, `markStaleRunningBatches`, `isBatchRunStale`, `BatchAlreadyRunningError`, `BatchRun`, `BatchSectionError` | 01 | The run ledger lifecycle and the cross-process single-run guard. |
| `upsertSectionInsight({ page, sectionKey, summaryJson, analysisTimeS, tokenCount, costUsd, dateRange, fiscalPeriod, generatedBy, components })` | 01 | Atomic persistence of each finished section. |
| `runSectionAnalysis(...) → { components, summary, totalTokens, totalCost }` | 04 | The per-section generation pipeline. |
| Ordered `SectionScope[]` catalog | 02 (Domain Pack) | The list this layer walks; its length is the run's `sections_total`. |

This layer owns **no persisted schema** — it reuses doc 01's tables entirely.

## 5. Behavior & flow

> Stack-true. `[VERSION-SENSITIVE]` flags mark assumptions a different stack must adapt.

### 5.1 `runInsightBatch(triggeredBy = 'admin') → Promise<BatchRun>`

1. **In-process guard.** If the module-level `isBatchInProcess` flag is set ⇒ throw `BatchAlreadyRunningError` immediately (no DB hit). Otherwise set it true.
2. Initialise the §4.1 accumulators; `batchId = null`.
3. **Open the run.** `createBatchRun(triggeredBy, catalog.length)` (doc 01). This first reclaims stale runs and then inserts a `running` row guarded by the partial unique index; a cross-process collision surfaces here as `BatchAlreadyRunningError`. Record `batchId`.
4. **For each `scope` in the ordered catalog, with `index`:**
   a. `updateBatchProgress(batchId, { currentSection: scope.sectionKey, sectionsCompleted, sectionsFailed, totalCostUsd, totalTokens, sectionErrors })` — emit a *pre-section* progress snapshot.
   b. `startedAt = now()`.
   c. **try:** `{ dateRange, fiscalPeriod } = await scope.resolve()`; create a fresh `AbortController`; `result = await runSectionAnalysis(scope.sectionKey, dateRange, abortController, () => {}, fiscalPeriod)` (doc 04 — the progress callback is a **no-op** in batch mode; progress is polled from the ledger, not streamed). Accumulate `totalCostUsd += result.totalCost`, `totalTokens += result.totalTokens`. `upsertSectionInsight({ page: scope.page, sectionKey: scope.sectionKey, summaryJson: result.summary, analysisTimeS: round1((now()−startedAt)/1000), tokenCount: result.totalTokens, costUsd: result.totalCost, dateRange, fiscalPeriod, generatedBy: triggeredBy, components: result.components })` (doc 01).
   d. **catch (err):** `sectionsFailed++`; push `{ sectionKey: scope.sectionKey, message: err.message ?? String(err) }` to `sectionErrors`. *(The pass continues.)*
   e. **finally:** `sectionsCompleted++` (always — success or failure); emit a *post-section* progress snapshot with the updated counters.
   f. **Inter-section delay.** If this is not the last entry: `delay = AI_INSIGHT_BATCH_DELAY_MS` (default 5000; non-finite/negative ⇒ 5000); if `delay > 0` sleep that long before the next section.
5. **Close (normal).** `finishBatchRun(batchId, { status: sectionsFailed > 0 ? 'partial' : 'success', totalCostUsd, totalTokens, sectionsCompleted, sectionsFailed, sectionErrors })`; return its normalised `BatchRun`.
6. **Close (fatal).** If anything in steps 3–5 throws (e.g. `createBatchRun` collision, or an unexpected error): if `batchId` was assigned, `finishBatchRun(batchId, { status:'error', errorMessage: err.message, …accumulators })`; then **rethrow**.
7. **Always:** clear `isBatchInProcess`.

### 5.2 The fire-and-forget invocation model

The trigger surface (doc 08) does **not** await `runInsightBatch`. It calls it, attaches a `.catch` that logs, and returns an HTTP response immediately while the run proceeds in the background.

`[VERSION-SENSITIVE]` — this assumes a **single long-lived server process** that keeps executing after the response is flushed (Node, Next.js App Router route handler in a persistent server). On a serverless/Pages-Router deployment a request that returns ends compute; there the trigger must hand the run to a durable worker, queue, or scheduled task instead of an in-process promise, and the in-process flag (§5.1 step 1) is no longer a valid guard on its own — the datastore constraint (doc 01) becomes the sole authority.

### 5.3 `isInsightBatchInProcess() → boolean`

Reads the module-level flag. Used by the trigger surface (doc 08) for the cheap pre-check before it consults the ledger.

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Second run requested in the **same process** while one runs | `isInsightBatchInProcess()` true ⇒ throw `BatchAlreadyRunningError` before any DB work | Cheap fast-path; avoids a needless ledger round-trip. |
| 2 | Second run requested in **another process** | `createBatchRun` hits the partial unique index (`23505`) ⇒ `BatchAlreadyRunningError` (doc 01) | The flag is per-process; the datastore is the cross-process source of truth (invariant 1). |
| 3 | A previous run's process died with its row still `running` | `createBatchRun` reclaims runs older than the stale window first (doc 01 §5.5) | A dead run must not block all future runs via the unique index forever. |
| 4 | One section's `resolve()` or `runSectionAnalysis` throws | Capture `{sectionKey,message}`, `sectionsFailed++`, **continue** to the next section | Invariant 2 — one bad section degrades the pass, never aborts it. |
| 5 | At least one section failed | Terminal status = `partial` (not `error`); successful sections are still persisted | A partial result is more useful than discarding the whole pass. |
| 6 | `createBatchRun` itself fails, or an unexpected throw escapes the loop | If a run row exists, finish it `error` with the message; rethrow to the caller's `.catch` | Invariant 3 — never leave a `running` row dangling. |
| 7 | Run finishes by any path | `isBatchInProcess` cleared in `finally` | Invariant 3 — a stuck flag would wedge the process even after the DB row is terminal. |
| 8 | Progress visibility | Emit a snapshot **before and after** every section (current section, counts, cost, tokens, errors) | Invariant 4 — the admin poller (doc 08) must see live advancement. |
| 9 | Inter-section delay | Applied only *between* sections, never after the last; skipped when the configured delay ≤ 0 | Rate/cost smoothing without padding total runtime needlessly. |
| 10 | `runSectionAnalysis` progress callback | Pass a no-op | Batch mode reports via the polled ledger, not a stream; doc 04's signature still requires the argument. |
| 11 | `AbortController` per section | Created and passed to satisfy doc 04's signature and enable future cancellation; this layer does not itself abort on a timer | Generation enforces its own cost/runtime ceilings (doc 04); the conductor stays simple. |
| 12 | `triggeredBy` | Defaults to `'admin'`; written to each section's `generated_by` and the run's `triggered_by` | Provenance for both the insight and the run. |

### 6.1 Configuration owned by this layer

Authoritative copy of the `05` rows of `00` §8:

| Variable | Default | Purpose |
|---|---|---|
| `AI_INSIGHT_BATCH_DELAY_MS` | `5000` | Delay inserted **between** sections (not after the last). Non-finite or negative ⇒ treated as `5000`; `0` disables the pause. |
| `AI_INSIGHT_BATCH_STALE_MIN` | `40` | Minutes after which a still-`running` row is stale and reclaimable. Read by doc 01's reclamation/predicate; this layer relies on that reclamation running before every `createBatchRun`. Non-positive/non-finite ⇒ `40`. |

## 7. Reference Implementation

Source paths are traceability evidence for the spec above — not a substitute for it.

| Path | Symbol | Responsibility |
|---|---|---|
| `lib/ai-insight/batch-runner.ts` | `runInsightBatch(triggeredBy)` | The §5.1 conductor: open → ordered loop → per-section generate+persist → progress → terminal close. |
| | `isInsightBatchInProcess()` | The in-process guard read (§5.3). |
| | `getBatchDelayMs()` | Resolves `AI_INSIGHT_BATCH_DELAY_MS` with the §6.1 fallback. |
| | module-level `isBatchInProcess` | The fast-path single-run flag (invariant 1). |
| `lib/ai-insight/batch-scope.ts` | `BatchSectionScope`, `monthAlignedTrailingTwelveMonths`, the range/snapshot/fiscal resolvers | The §4.2 contract and scope-kind mechanisms (Engine-generic). |
| | `BATCH_SECTIONS` | The **Domain Pack** instance of the ordered catalog (finance: 16 sections). Cataloged in doc 02 §catalog; an Engine rebuild substitutes its own list here. |
| `lib/ai-insight/batch-store.ts` | (doc 01) `createBatchRun`, `updateBatchProgress`, `finishBatchRun`, `markStaleRunningBatches` … | Run-ledger lifecycle + cross-process guard — **consumed**, owned by doc 01. |
| `lib/ai-insight/orchestrator.ts` | (doc 04) `runSectionAnalysis` | The per-section pipeline — **consumed**, owned by doc 04. |
| `lib/ai-insight/storage.ts` | (doc 01) `upsertSectionInsight` | Atomic section persistence — **consumed**, owned by doc 01. |

**Conductor shape (key skeleton):**

```ts
let isBatchInProcess = false;

async function runInsightBatch(triggeredBy = 'admin'): Promise<BatchRun> {
  if (isBatchInProcess) throw new BatchAlreadyRunningError();
  isBatchInProcess = true;
  let batchId = null, totalCostUsd = 0, totalTokens = 0,
      sectionsCompleted = 0, sectionsFailed = 0; const sectionErrors = [];
  try {
    const batch = await createBatchRun(triggeredBy, CATALOG.length);
    batchId = batch.id;
    for (const [i, scope] of CATALOG.entries()) {
      await updateBatchProgress(batch.id, { currentSection: scope.sectionKey,
        sectionsCompleted, sectionsFailed, totalCostUsd, totalTokens, sectionErrors });
      const startedAt = Date.now();
      try {
        const { dateRange, fiscalPeriod } = await scope.resolve();
        const result = await runSectionAnalysis(
          scope.sectionKey, dateRange, new AbortController(), () => {}, fiscalPeriod);
        totalCostUsd += result.totalCost; totalTokens += result.totalTokens;
        await upsertSectionInsight({ page: scope.page, sectionKey: scope.sectionKey,
          summaryJson: result.summary,
          analysisTimeS: +(((Date.now() - startedAt) / 1000).toFixed(1)),
          tokenCount: result.totalTokens, costUsd: result.totalCost,
          dateRange, fiscalPeriod, generatedBy: triggeredBy,
          components: result.components });
      } catch (err) {
        sectionsFailed++;
        sectionErrors.push({ sectionKey: scope.sectionKey,
          message: err instanceof Error ? err.message : String(err) });
      } finally {
        sectionsCompleted++;
        await updateBatchProgress(batch.id, { currentSection: scope.sectionKey,
          sectionsCompleted, sectionsFailed, totalCostUsd, totalTokens, sectionErrors });
      }
      if (i < CATALOG.length - 1 && getBatchDelayMs() > 0) await sleep(getBatchDelayMs());
    }
    return finishBatchRun(batch.id, {
      status: sectionsFailed > 0 ? 'partial' : 'success',
      totalCostUsd, totalTokens, sectionsCompleted, sectionsFailed, sectionErrors });
  } catch (err) {
    if (batchId !== null) await finishBatchRun(batchId, { status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      totalCostUsd, totalTokens, sectionsCompleted, sectionsFailed, sectionErrors });
    throw err;
  } finally { isBatchInProcess = false; }
}
```

## 8. Verification checkpoint

**Setup (no source access):** implement the conductor per §3–§6. Use the doc 03 mock switch (`AI_INSIGHT_MOCK_LLM`) so generation runs offline. Provide a **two-entry** test scope catalog: one `range` scope whose `resolve()` returns a fixed `{start,end}`, and one scope whose `resolve()` *throws*.

**Action & expected observable result:**

1. **Happy + isolated failure.** Call `runInsightBatch('tester')`. Expect: one ledger row goes `running → partial`; `sections_total = 2`; `sections_completed = 2`; `sections_failed = 1`; `section_errors` has one `{sectionKey,message}` for the throwing scope; exactly one `ai_insight_section` row exists for the successful scope (and none for the failing one); `total_cost_usd`/`total_tokens` are the success section's totals.
2. **All-success status.** Replace the throwing scope with a valid one; rerun. Terminal status is `success`; both section rows present; re-running again **replaces** them (no duplicates — idempotent at section grain).
3. **Single-run guard (in-process).** While a run is in progress, call `runInsightBatch` again ⇒ `BatchAlreadyRunningError`, no second ledger row.
4. **Single-run guard (datastore).** Insert a `running` row directly, then call `runInsightBatch` in a fresh process state ⇒ `BatchAlreadyRunningError` from the unique-index path; no partial row created.
5. **Stale reclaim.** Set `AI_INSIGHT_BATCH_STALE_MIN=0`, leave a `running` row with an old `started_at`, trigger a run ⇒ the old row is force-failed (`error`, "Run interrupted…") and the new run proceeds.
6. **Pacing.** Set `AI_INSIGHT_BATCH_DELAY_MS=200` and time a 2-section run: total wall time ≥ ~200 ms more than the no-delay baseline; set it to `0` and the pause disappears.
7. **Progress observability.** Poll the latest run during execution: `current_section` and the counters advance between sections, not only at the end.

**Definition of Done:** a developer who has read only `00`, `01`, `04`, and this document, with no access to this repo's source, can build the conductor and pass all seven checks.
