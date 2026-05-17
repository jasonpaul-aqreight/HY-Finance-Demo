# 01 — Storage

> **Classification:** Engine
> **Enables:** The engine-owned datastore and the read contract on the source-of-truth data store.
> **Read after:** 00

---

## 1. Purpose

The storage layer is the engine's **only writable persistence** and the **single boundary** to the data it does not own. It does two things and nothing else:

1. It owns and protects the engine's result datastore: one durable insight per `(page, section)`, the per-component analyses bound to it, and a batch-run ledger that records every administrator-triggered pass.
2. It defines the **read contract** the engine places on the source-of-truth data store — what the engine is allowed to assume when reading domain data it does not own, and how a failed read must behave.

After this document you can build the complete engine datastore (schema, upsert/read functions, batch-run lifecycle) and know exactly what guarantees any source-of-truth store must satisfy for the layers above to work.

## 2. Prerequisites

- **Doc 00**, specifically: the vocabulary in §3 (Page, Section, Component, Scope, Insight, Batch run), the two-store separation in §9, and the ENV rows `DATABASE_URL` and `RDS_DATABASE_URL` in §8.

External dependencies this layer touches, by role:

- A **relational database** that supports transactions, a JSON/JSONB column type, and a *partial* unique index (a unique constraint over a filtered subset of rows).
- A **connection pool** abstraction with explicit single-connection checkout for multi-statement transactions.

No other document is required. Generation (doc 04) and orchestration (doc 05) are *callers* of this layer; their contracts are defined where they are built.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the storage layer as an idea.*

The layer is a **write-once-per-key, atomically-replaced result store with a single-active-job ledger**, plus a **read-only, fail-soft port** to an external data source.

**Inputs**

- A completed *section insight*: a section summary, an ordered set of per-component analyses, the *scope* the section was analysed over, and run metadata (who/what generated it, elapsed time, token count, cost).
- *Batch lifecycle events*: open a run, report progress, finish a run, reclaim an abandoned run.
- *Read requests*: fetch the current insight for a section, or for one component of a section.

**Outputs / guarantees**

- A section insight is durably stored under a key that is unique per `(page, section)`. Storing again for the same key **replaces** the prior insight wholesale.
- A section's component analyses exist only as children of that section and disappear with it.
- A batch-run ledger in which **at most one run is in the active state at any instant**, with that exclusivity enforced by the store itself.
- Reads return the **current** insight (latest wins) or nothing.

**Invariants (must never be violated)**

1. **One insight per `(page, section)`.** Regeneration replaces; it never merges or appends.
2. **Whole-section atomicity.** A section and all its components are written as one unit — a partially written section is never observable.
3. **No orphan components.** Removing a section removes its components.
4. **At most one active batch run.** Enforced by the datastore, not by application-level checks.
5. **The engine never writes to the source-of-truth store.** That store is read-only to the engine.
6. **A source read never crashes the pipeline.** Any single source read may fail; a failed read is substitutable by an *empty result* with no exception propagated upward.

**Boundary with adjacent layers**

- *Upstream:* generation (doc 04) produces a finished section and hands it here; orchestration (doc 05) drives the batch lifecycle calls.
- *Downstream:* the read API (doc 06) consumes only the two read functions.
- *Sideways:* the source-of-truth store is **not owned** — the engine documents *what it reads*, never *how that store is built*.

A reader can re-implement this layer on any transactional database from this section alone.

## 4. Data contracts

### 4.1 Owned — engine result datastore

Four tables. The engine has full schema authority over all of them.

**`ai_insight_section`** — one row per `(page, section)`; the unit of generation and storage.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | serial PK | no | Surrogate key; parent of components. |
| `page` | text | no | Page the section belongs to. |
| `section_key` | text | no | Section identifier. |
| `summary_json` | jsonb | no | The section summary payload (shape owned by doc 04; see 4.3). |
| `analysis_time_s` | numeric(6,1) | yes | Wall-clock seconds to generate the section. |
| `token_count` | integer | yes | Total model tokens for the section. |
| `cost_usd` | numeric(8,4) | yes | Total model cost for the section. |
| `date_range_start` | date | yes | Scope: inclusive start (calendar/range scope). |
| `date_range_end` | date | yes | Scope: inclusive end (calendar/range scope). |
| `fiscal_year` | text | yes | Scope: fiscal-year label, e.g. `FY2025` (fiscal scope). |
| `fiscal_range` | text | yes | Scope: fiscal window — `fy` \| `last12` \| `ytd` (fiscal scope). |
| `generated_by` | text | no | Identity/agent that produced this insight. |
| `generated_at` | timestamptz | no | Defaults to write time. |
| — | — | — | **`UNIQUE (page, section_key)`** — the key invariant. |

**`ai_insight_component`** — per-component analysis; child of a section.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | serial PK | no | Surrogate key. |
| `section_id` | integer FK → `ai_insight_section(id)` | no | **`ON DELETE CASCADE`** — components die with the section. |
| `component_key` | text | no | Component identifier within the section. |
| `component_type` | text | no | One of `kpi` \| `chart` \| `table` \| `breakdown`. |
| `analysis_md` | text | no | The component's narrative analysis (markdown). |
| `token_count` | integer | yes | Model tokens for this component. |
| `generated_at` | timestamptz | no | Defaults to write time. |
| — | — | — | **`UNIQUE (section_id, component_key)`** — one analysis per component per section. |

**`ai_insight_batch_run`** — the run ledger; one row per administrator-triggered pass.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | serial PK | no | Run identifier. |
| `status` | text | no | `idle` \| `running` \| `success` \| `partial` \| `error`. Default `idle`. |
| `started_at` | timestamptz | yes | When the run opened. |
| `finished_at` | timestamptz | yes | When the run reached a terminal status. |
| `total_runtime_s` | numeric(8,1) | yes | Elapsed seconds, computed at finish. |
| `total_cost_usd` | numeric(10,4) | yes | Accumulated model cost. |
| `total_tokens` | integer | yes | Accumulated model tokens. |
| `sections_total` | integer | no | Sections the run intends to process. Default 0. |
| `sections_completed` | integer | no | Sections finished OK. Default 0. |
| `sections_failed` | integer | no | Sections that errored. Default 0. |
| `current_section` | text | yes | Section in progress (null when idle/finished). |
| `section_errors` | jsonb | no | Array of `{ sectionKey, message }`. Default `[]`. |
| `error_message` | text | yes | Run-level fatal error, if any. |
| `triggered_by` | text | yes | Who triggered the run. |
| `created_at` | timestamptz | yes | Defaults to insert time; the read-ordering key. |
| — | — | — | **Partial unique index on `(status) WHERE status = 'running'`** — the single-active-run guarantee. |

**`ai_insight_lock`** — **deprecated.** A singleton-row table from the pre-batch design. It is retained only so that older local databases keep applying the idempotent schema cleanly. **No current code reads or writes it. Do not build new logic on it.**

### 4.2 Owned — in-memory run shape

The batch-run row is normalised before leaving this layer:

```
BatchRunStatus = 'idle' | 'running' | 'success' | 'partial' | 'error'
BatchSectionError = { sectionKey: string; message: string }

BatchRun = {
  id: number
  status: BatchRunStatus
  started_at:  string | null      // ISO-8601
  finished_at: string | null      // ISO-8601
  total_runtime_s: number | null
  total_cost_usd:  number | null
  total_tokens:    number | null
  sections_total: number
  sections_completed: number
  sections_failed: number
  current_section: string | null
  section_errors: BatchSectionError[]
  error_message: string | null
  triggered_by: string | null
  created_at: string | null       // ISO-8601
}
```

Numeric columns arrive from the driver as strings and are coerced to `number | null`; timestamps are coerced to ISO strings; `section_errors` is coerced to a typed array with malformed entries dropped (see §6).

### 4.3 Consumed — section insight input (owned by doc 04)

`upsertSectionInsight` accepts a finished section. Its payload types (`SummaryJson`, `ComponentResult`, `DateRange`, `FiscalPeriod`) are **defined and owned by generation (doc 04)**; this layer only persists them. The persisted mapping is:

| Input field | Persisted to |
|---|---|
| `summaryJson: SummaryJson` | `ai_insight_section.summary_json` (serialised JSON) |
| `dateRange: DateRange \| null` (`{start,end}` `YYYY-MM-DD`) | `date_range_start`, `date_range_end` |
| `fiscalPeriod: FiscalPeriod \| null` (`{fiscalYear,range}`) | `fiscal_year`, `fiscal_range` |
| `analysisTimeS`, `tokenCount`, `costUsd`, `generatedBy` | the matching scalar columns |
| `components: ComponentResult[]` | one `ai_insight_component` row each (`component_key`, `component_type`, `analysis_md`, `token_count`) |

### 4.4 Consumed — source-of-truth read contract (NOT owned)

The engine reads domain data to build insights. That data lives in a **separate store the engine does not own**. The engine documents only the contract, never the schema:

- **Access is read-only.** The engine issues no writes, DDL, or transactions against this store.
- **Every read is individually fail-soft.** Any single read may fail (connectivity, timeout, missing relation). A failed read MUST be observable to the caller as an *empty result set*, not an exception. The pipeline treats "empty" as "no data for this scope", never as a crash.
- **No schema ownership.** Concrete relations, columns, and queries are a **Domain Pack** concern (doc 04). This layer guarantees only the *port* and its failure semantics.

## 5. Behavior & flow

> Stack-true. `[VERSION-SENSITIVE]` flags mark assumptions a different stack must adapt.

### 5.1 Connection pools (two-pool model)

Two independent pooled connections, lazily created as singletons:

| Pool | Connection | Max | Idle timeout | Connect timeout | Role |
|---|---|---|---|---|---|
| Engine-owned | `DATABASE_URL` | 20 | 30 000 ms | 5 000 ms | All engine reads/writes **and** the precomputed domain projections the Domain Pack reads. |
| Read-only source | `RDS_DATABASE_URL` | 5 | 30 000 ms | 10 000 ms | On-demand drill-down detail against the source-of-truth store. |

A helper wraps the read-only pool so that **any failure returns an empty array** and logs once — it never throws into the caller. `[VERSION-SENSITIVE]` — the reference stack uses the Node `pg` `Pool`; a different driver/runtime must preserve (a) two isolated pools, (b) single-connection checkout for transactions, and (c) the fail-soft wrapper.

> **Reference nuance (not a contract change):** in this demo the precomputed domain projections are *co-located in the engine-owned database* and read through the engine pool; the separate read-only pool serves only deep drill-down invoked by the generation tool path (doc 04). The **contract** a production rebuild must honour is logical — engine-owned writable store + read-only fail-soft source port — not the physical placement.

### 5.2 Upsert a section insight (atomic replace)

`upsertSectionInsight(params) → sectionId` checks out **one** connection and runs:

1. `BEGIN`.
2. `DELETE FROM ai_insight_section WHERE page = $page AND section_key = $sectionKey` — removes the prior insight for the key; the FK cascade removes its component rows.
3. `INSERT INTO ai_insight_section (...) ... RETURNING id` — the new section row; capture `id`.
4. For each component, `INSERT INTO ai_insight_component (section_id, component_key, component_type, analysis_md, token_count) VALUES (...)` using the captured `id`.
5. `COMMIT`.
6. On **any** error: `ROLLBACK`, rethrow.
7. **Always** release the connection (success or failure).

Ordering guarantee: delete-then-insert inside one transaction means an observer either sees the *entire* prior insight or the *entire* new insight — never a mix, and never zero rows for a key that previously had one (a mid-transaction failure rolls back to the prior insight).

### 5.3 Read a section / component insight

- `getSectionInsight(sectionKey, page?)` → `SELECT ... FROM ai_insight_section WHERE section_key = $1 [AND page = $2] ORDER BY generated_at DESC LIMIT 1` → row or `null`. The `ORDER BY … LIMIT 1` is the *latest-wins* rule; it is load-bearing only when `page` is omitted and the same `section_key` exists under multiple pages.
- `getComponentInsight(sectionKey, componentKey)` → join `ai_insight_component` to its `ai_insight_section` on `section_id`, filtered by `section_key` + `component_key`; returns the component row enriched with the parent's scope + `generated_by`, or `null`.

Both reads use the engine pool directly (no transaction).

### 5.4 Batch-run lifecycle

- **Open** — `createBatchRun(triggeredBy, total)`:
  1. First reclaim abandoned runs (§5.5).
  2. `INSERT INTO ai_insight_batch_run (status, started_at, sections_total, …) VALUES ('running', NOW(), $total, …) RETURNING *`.
  3. If the driver reports a unique-violation (`SQLSTATE 23505`) — meaning the partial unique index already has a `running` row — translate it to a typed `BatchAlreadyRunningError`. Any other error rethrows.
  4. Return the normalised `BatchRun`.
- **Progress** — `updateBatchProgress(id, partial)`: builds a dynamic `UPDATE … SET` over only the supplied fields (`current_section`, `sections_completed`, `sections_failed`, `total_cost_usd`, `total_tokens`, `section_errors`); a no-op if nothing supplied.
- **Finish** — `finishBatchRun(id, params)`: `UPDATE … SET status = <terminal>, finished_at = NOW(), total_runtime_s = ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)),1), …, current_section = NULL WHERE id = $id RETURNING *`. Terminal status is one of `success | partial | error`.
- **Latest** — `getLatestBatchRun()`: `SELECT * … ORDER BY created_at DESC LIMIT 1` → normalised `BatchRun` or `null`.

### 5.5 Stale-run reclamation

`markStaleRunningBatches(staleMinutes?)`:

```
UPDATE ai_insight_batch_run
   SET status='error', finished_at=NOW(),
       total_runtime_s = ROUND(EXTRACT(EPOCH FROM (NOW()-started_at)),1),
       current_section=NULL,
       error_message='Run interrupted (process restart)'
 WHERE status='running' AND started_at IS NOT NULL
   AND started_at < NOW() - (staleMinutes * INTERVAL '1 minute')
```

`staleMinutes` defaults from `AI_INSIGHT_BATCH_STALE_MIN` (default **40**, ignored if non-positive/non-finite). `isBatchRunStale(run)` is the in-memory predicate form: `status === 'running'` and `started_at` older than the window. Reclamation runs **before** every `createBatchRun`, so a process that died mid-run cannot permanently block future runs via the partial unique index.

### 5.6 Scope persistence mapping

| Scope kind | `date_range_start/end` | `fiscal_year` | `fiscal_range` |
|---|---|---|---|
| range (calendar) | the `{start,end}` dates | null | null |
| snapshot (point-in-time) | null, null | null | null |
| fiscal | null, null | `FY####` | `fy`\|`last12`\|`ytd` |

The four scope columns are nullable precisely so a single section row can express any of the three kinds; the caller passes `dateRange` **or** `fiscalPeriod` **or** neither.

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Regenerating an existing `(page, section_key)` | DELETE the row then INSERT a fresh one — **never** `INSERT … ON CONFLICT`/merge | Invariant 1: regeneration replaces wholesale; merge would leave stale components from a prior shape. |
| 2 | A section is deleted | Component rows vanish via FK `ON DELETE CASCADE`; never delete component rows by hand | Invariant 3: no orphans; manual deletes risk partial cleanup. |
| 3 | Failure between DELETE and COMMIT | `ROLLBACK`; the prior insight remains intact and observable | Invariant 2: a half-written section must never be visible. |
| 4 | A second run opens while one is `running` | DB partial unique index raises `23505`; app maps it to `BatchAlreadyRunningError` | Invariant 4: exclusivity enforced by the store across processes, not by a TOCTOU app check. |
| 5 | A run row is `running` but its process died | The next `createBatchRun` first force-fails any `running` row older than the stale window | Otherwise the partial unique index would block all future runs forever. |
| 6 | Numeric columns arrive as driver strings | Coerce to `number`; non-finite → `null` | Callers (API/UI) must receive numbers, not `"12.30"`. |
| 7 | `section_errors` JSON contains malformed entries | Keep only objects with non-empty string `sectionKey` **and** `message`; drop the rest | A corrupt ledger entry must not break status reads. |
| 8 | Source-of-truth read fails (any cause) | Return an empty result; log once; do **not** throw | Invariant 6: a flaky source degrades the insight, it does not crash the batch. |
| 9 | Re-applying the schema to an existing DB | All DDL is idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS`) | Local databases at different ages must converge without manual migration. |
| 10 | `ai_insight_lock` present | Treat as deprecated dead weight; never read/write it | It only exists so old DBs keep applying the idempotent schema. |
| 11 | NOT NULL columns (`summary_json`, `generated_by`, component `analysis_md`, `component_type`) | The caller must always supply them; storage does not invent defaults | These are the minimum a renderable insight requires. |
| 12 | Authentication of writers/readers | **Out of scope for this layer** — it trusts its callers; auth is enforced at the API/admin layers (docs 06, 08) | Storage is an internal layer; gating it twice would split responsibility. |

## 7. Reference Implementation

Source paths are traceability evidence for the spec above — not a substitute for it.

**Schema — `apps/dashboard/sql/ai-insight-schema.sql`** (applied against `DATABASE_URL`; full authoritative DDL):

```sql
CREATE TABLE IF NOT EXISTS ai_insight_lock (        -- DEPRECATED, retained for idempotency only
  id INTEGER PRIMARY KEY DEFAULT 1, locked_by TEXT,
  locked_at TIMESTAMP WITH TIME ZONE, section_key TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO ai_insight_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_insight_section (
  id SERIAL PRIMARY KEY,
  page TEXT NOT NULL, section_key TEXT NOT NULL,
  summary_json JSONB NOT NULL,
  analysis_time_s NUMERIC(6,1), token_count INTEGER, cost_usd NUMERIC(8,4),
  date_range_start DATE, date_range_end DATE,
  fiscal_year TEXT, fiscal_range TEXT,             -- 'fy' | 'last12' | 'ytd'
  generated_by TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (page, section_key)
);
ALTER TABLE ai_insight_section ADD COLUMN IF NOT EXISTS fiscal_year  TEXT;
ALTER TABLE ai_insight_section ADD COLUMN IF NOT EXISTS fiscal_range TEXT;

CREATE TABLE IF NOT EXISTS ai_insight_component (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES ai_insight_section(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL, component_type TEXT NOT NULL,
  analysis_md TEXT NOT NULL, token_count INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (section_id, component_key)
);

CREATE TABLE IF NOT EXISTS ai_insight_batch_run (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',             -- idle|running|success|partial|error
  started_at TIMESTAMP WITH TIME ZONE, finished_at TIMESTAMP WITH TIME ZONE,
  total_runtime_s NUMERIC(8,1), total_cost_usd NUMERIC(10,4), total_tokens INTEGER,
  sections_total INTEGER NOT NULL DEFAULT 0,
  sections_completed INTEGER NOT NULL DEFAULT 0,
  sections_failed INTEGER NOT NULL DEFAULT 0,
  current_section TEXT,
  section_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT, triggered_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_insight_batch_run_one_running
  ON ai_insight_batch_run (status) WHERE status = 'running';
```

**Pools — `apps/dashboard/src/lib/postgres.ts`**

- `getPool()` → singleton engine pool (`DATABASE_URL`, max 20, idle 30 000, connect 5 000).
- `getRdsPool()` → singleton read-only source pool (`RDS_DATABASE_URL`, max 5, idle 30 000, connect 10 000).
- `queryRds<T>(sql, params=[]) → Promise<T[]>` → runs on the read-only pool; on any error logs and returns `[]` (the fail-soft port; consumed by the Domain Pack tool path in doc 04).

**Result store — `apps/dashboard/src/lib/ai-insight/storage.ts`**

- `upsertSectionInsight({ page, sectionKey, summaryJson, analysisTimeS, tokenCount, costUsd, dateRange, fiscalPeriod?, generatedBy, components }) → Promise<number>` — the atomic replace of §5.2.
- `getSectionInsight(sectionKey, page?) → Promise<row|null>` — latest-wins section read.
- `getComponentInsight(sectionKey, componentKey) → Promise<row|null>` — component joined to its section.

**Run ledger — `apps/dashboard/src/lib/ai-insight/batch-store.ts`**

- Types/errors: `BatchRunStatus`, `BatchSectionError`, `BatchRun`, `BatchAlreadyRunningError`.
- `getBatchStaleMinutes()`, `isBatchRunStale(run, staleMinutes?)`, `markStaleRunningBatches(staleMinutes?) → Promise<number>`.
- `createBatchRun(triggeredBy, total) → Promise<BatchRun>` (reclaim → insert → 23505→typed error).
- `updateBatchProgress(id, partial) → Promise<void>` (dynamic SET).
- `finishBatchRun(id, params) → Promise<BatchRun>` (terminal status + computed runtime).
- `getLatestBatchRun() → Promise<BatchRun|null>`.

**Consumed payload types — `apps/dashboard/src/lib/ai-insight/types.ts`** (owned by doc 04, persisted here): `SummaryJson`, `ComponentResult`, `DateRange` (`{start,end}` `YYYY-MM-DD`), `FiscalPeriod` (`{fiscalYear, range}`), `ComponentType`.

## 8. Verification checkpoint

**Setup.** Point `DATABASE_URL` at a fresh database and apply the schema:

```
psql "$DATABASE_URL" -f apps/dashboard/sql/ai-insight-schema.sql
```

Expected: tables `ai_insight_section`, `ai_insight_component`, `ai_insight_batch_run`, `ai_insight_lock` exist; a partial unique index on `ai_insight_batch_run(status) WHERE status='running'` exists; re-running the same command succeeds unchanged (idempotent).

**Check A — atomic replace + cascade.** Call `upsertSectionInsight` for `(page='p', sectionKey='s')` with 2 components, then call it again for the same key with a different `summary_json` and 2 different components.

- Expect exactly **one** `ai_insight_section` row for `('p','s')` carrying the second summary.
- Expect exactly **two** `ai_insight_component` rows, all from the second call; zero rows from the first (cascade-deleted).

**Check B — single active run.** Call `createBatchRun('tester', 5)`; while that row is `running`, call `createBatchRun('tester', 5)` again.

- Expect the first to return a `BatchRun` with `status='running'`.
- Expect the second to reject with `BatchAlreadyRunningError` (driver `23505` from the partial unique index).

**Check C — reads.** `getSectionInsight('s','p')` returns the section row; `getSectionInsight('s')` (no page) returns the same row (latest-wins). `getComponentInsight('s', <componentKey>)` returns the component joined with its parent's scope and `generated_by`.

**Check D — fail-soft source port.** Point `RDS_DATABASE_URL` at an unreachable host and call `queryRds('SELECT 1')`.

- Expect `[]` returned and a single logged error — **no thrown exception**.

**Definition of Done:** a developer who has read only docs `00`–`01`, with no access to this repository's source, can build the engine datastore, the two-pool model, and the source read port, and pass Checks A–D.
