# 10 — Adding a Domain Pack

> **Classification:** Spine
> **Enables:** A second domain running on the same unmodified Engine, with Finance as the worked example.
> **Read after:** 00–09

---

## 1. Purpose

This document is the **generalisation guide**: it turns the Engine/Domain-Pack split that docs 01–09 describe into a step-by-step recipe for putting an entirely new domain (e.g. HR, Manufacturing, Operations) on the existing Engine without modifying any Engine layer.

It owns nothing the Engine doesn't already export. Every contract named here is defined in an earlier document; this doc states **which contracts a Domain Pack must satisfy, in what order to build them, and how to prove the pack is wired correctly** end-to-end. The Finance Domain Pack (docs 02, 04, 04a) is the reference worked example throughout.

After this document a developer can:

- decide what counts as a Domain Pack vs. an Engine change (and refuse the latter);
- assemble the complete set of symbols a new pack must export;
- bring up a minimal "Hello Pack" that the existing batch runner, read API, and frontend serve without code edits to the Engine itself;
- read the partial HR scaffold already present in the Finance codebase as a half-built pack and finish it the same way.

## 2. Prerequisites

The full set, in numeric order — this is the only doc whose prerequisite is the entire prior set:

- **Doc 00** — the Engine/Pack/Spine split (§4), the two-store data contract (§9), the locked doc map (§6), the vocabulary (§3).
- **Doc 01** — the engine-owned schema and storage functions (`upsertSectionInsight`, `getSectionInsight`, `getComponentInsight`, the run-ledger fns), the two-pool model, the fail-soft source port. **A new pack never extends or alters this schema.**
- **Doc 02** — the catalog + threshold mechanism (`SECTION_COMPONENTS`/`SECTION_PAGE`/`SECTION_NAMES`, `COMPONENT_INFO_SOURCE`, `THRESHOLD_REGISTRY`, `renderThresholdText`, `allowedThresholds`, `getThresholdGroups`, `saveThresholdValues`, the values table) — the Finance-pack instances of every catalog and threshold contract a new pack also fills.
- **Doc 03** — the model boundary (`callAiModel`, the two slots, mock interception). **Pack-agnostic; not customised per pack.**
- **Doc 04** — the per-section generation pipeline (`runSectionAnalysis`, `analyzeComponent`, `fetchComponentData` contract, numeric guard, tool policy, summary parser).
- **Doc 04a** — the prompt catalog format used to publish the verbatim bodies a pack ships.
- **Doc 05** — the batch conductor (`runInsightBatch`, `SectionScope` contract, the three scope-kind resolvers, single-active-run guard, fire-and-forget invocation model).
- **Doc 06** — the read API envelopes. **Pack-agnostic.**
- **Doc 07** — the frontend read shell (the four-state matrix, panel/dialog components). A new pack adds page wiring; it does not change the shell.
- **Doc 08** — the admin batch card and the threshold-config UI. **Pack-agnostic** — it iterates whatever pack is currently registered.
- **Doc 09** — the end-to-end walkthrough proves the Finance pack runs; a new pack must pass the same walkthrough in its own scope.

This is a **Spine** doc: §3 is stack-neutral and domain-neutral; §5 onward is the concrete recipe against the reference stack with finance as the worked example.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the Engine/Pack seam as a single seam, not as eleven small ones.*

A **Domain Pack** is the smallest set of declarative facts and pure functions the Engine needs in order to analyse a new subject matter. Everything that *is not* in the pack is in the Engine and stays unchanged across packs.

### 3.1 What the Engine guarantees (never re-supplied by a pack)

| The Engine owns | Where it is specified |
|---|---|
| The engine-owned datastore: section/component result tables, batch-run ledger, partial-unique-index single-run guard, fail-soft source port | 01 |
| The model boundary: provider call, slot model selection, fallback chain, mock interception, prompt-logging switch | 03 |
| The batch conductor: ordered single-flight pass, fire-and-forget invocation, in-process flag, stale-run reclamation, inter-section pacing, scope-kind resolvers (`range` / `snapshot` / `fiscal`) | 05 |
| The read API envelopes for section and component | 06 |
| The frontend shell: section panel, component dialog, four-state matrix, expand-on-load reset key, markdown renderer | 07 |
| The admin surface: batch trigger/status card, threshold-config dashboard (tree + editor + rendered preview) | 08 |
| The threshold *mechanism*: registry types, snapshot resolution, render algorithm, save/validate/classify, cache invalidation | 02 §3 (mechanism), generic |
| The generation *pipeline*: fan-out, summary agent loop, numeric guard, tool policy, summary parser, debug log | 04 §3 (mechanism), generic |

### 3.2 What a Domain Pack supplies (every pack, no exceptions)

A pack is fully described by **eight artefacts**. Together they let the Engine iterate the catalog, fetch data, build prompts, render tokens, run the batch, and serve insights — without ever knowing the domain.

1. **Page / section / component vocabulary.** The pack widens the Engine's `PageKey` / `SectionKey` type unions and adds entries to the catalog maps (`SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES`).
2. **Per-section scope kind.** For every section, a declaration of how its window resolves: a calendar `range`, a point-in-time `snapshot`, or a `fiscal` period.
3. **Per-component metadata.** A `ComponentInfo` entry per component (name, what it measures, formula, indicator bands, "about"), with numeric edges expressed as threshold tokens.
4. **Threshold registry + seed.** A `THRESHOLD_REGISTRY` block per tokenised component (groups → tokens, with `defaultValue`, `min`, `max`, monotonic direction) and a forward-only SQL seed inserting `(component_key, token, value)` rows whose `value` **equals** the registry default.
5. **Per-component data fetcher.** A function returning `{ prompt: string, allowed: AllowedValue[] }` for one component over one scope, reading the source-of-truth store via the engine pool (precomputed projections) or the read-only pool (drill-down). Fail-soft: never throws.
6. **Per-component prompt body.** A fixed prose template, optionally embedding `{{component_key.token}}` placeholders that the Engine's renderer substitutes at run time.
7. **Per-section tool policy.** One of `none | aggregate_only | full`, declaring what data tools the summary agent loop may use for that section.
8. **Ordered batch-scope catalog.** A list of `SectionScope` entries (sectionKey, page, kind, `resolve()`) — the *exact ordered set* the conductor walks. A section that is in the type system but **not** in this list is "scaffolded but inactive": it ships, but never runs.

That is the entire seam. Anything else a domain wants (a special chart type, a new validation rule, a different summary format) is an **Engine change**, not a pack change, and must be argued for on Engine grounds.

### 3.3 Invariants (apply to every pack)

1. **Engine schema is untouchable.** A pack adds rows; it never adds columns to `ai_insight_section` / `ai_insight_component` / `ai_insight_batch_run`, and never creates an `ai_insight_*` table of its own. Domain projection tables (e.g. `pc_*`) are pack-owned and live under the same engine-owned database, but they are *the pack's tables*, never the Engine's.
2. **Defaults equal seeds.** For every registry token, `defaultValue` and the seed-row value must be identical (doc 02 invariant 2). A pack that ships a divergence is broken.
3. **Catalog completeness.** Every component that appears in `SECTION_COMPONENTS` must have (a) a prompt body, (b) a data fetcher, (c) optionally — if it has numeric bands — a `THRESHOLD_REGISTRY` entry and matching `COMPONENT_INFO_SOURCE` metadata. Half-wired components are caught by the §8 verification.
4. **Threshold prose is fixed.** Editing a band edge edits the registry, never the prompt or metadata text (doc 02 invariant 1, re-stated for packs).
5. **Domain leakage is one-way.** Pack files import from the Engine; Engine files **never** import from a pack file. If you find an `import` from `data-fetcher.ts` or `prompts-defaults.ts` inside the orchestrator, batch runner, storage, model provider, or API route, that is an Engine regression — not a pack feature.
6. **Type-system scaffolding is not a pack.** Widening `SectionKey` and adding empty catalog entries makes a section *visible* to the Engine's exhaustive checks; the section becomes *active* only when (4)+(5)+(6)+(8) of §3.2 are filled and it is added to the ordered batch catalog.

### 3.4 Boundary with adjacent layers

- *Up:* the read API (06) and frontend (07) serve insights without knowing which pack produced them — they read by `(page, sectionKey)`, and the pack's choice of `page`/`sectionKey` strings flows through unchanged.
- *Down:* the pack reads its own source-of-truth store via the doc 01 ports. Multiple packs in the same app share the engine pool and (if used) the read-only pool — pool tuning is an Engine concern, not a pack one.
- *Sideways:* the admin threshold-config UI (08) **auto-discovers** a new pack's tokens because it iterates `THRESHOLD_REGISTRY`. A pack does not write new admin screens; it writes the registry rows the existing screen presents.

## 4. Data contracts

The artefacts of §3.2 expressed as concrete symbols and signatures. Each row's **owner** is the doc that defines the *contract*; the **pack supplies** column says what a new pack writes.

| # | Engine contract (owner) | Pack supplies |
|---|---|---|
| 1 | `PageKey`, `SectionKey` unions (01 §4 / shared types) | New string literals appended to both unions for each new page and section. |
| 1 | `SECTION_COMPONENTS: Record<SectionKey, { key, name, type }[]>` (02 §4.1) | One ordered entry per new section listing its components. |
| 1 | `SECTION_PAGE: Record<SectionKey, string>` (02 §4.1) | Human page label per new section (e.g. `'People'`, `'Production'`). |
| 1 | `SECTION_NAMES: Record<SectionKey, string>` (02 §4.1) | Human section label per new section. |
| 2 | `SECTION_SCOPE: Record<SectionKey, 'period'\|'snapshot'\|'fiscal_period'>` (04 §5.2 — fetcher dispatch) | Scope kind for each new section. **Note:** the fetcher's dispatch enum (`period`/`snapshot`/`fiscal_period`) is *related to but textually distinct from* the conductor's `kind` enum (`range`/`snapshot`/`fiscal`, doc 05 §4.2). A pack must set **both** consistently per section (`range`↔`period`, `fiscal`↔`fiscal_period`, `snapshot`↔`snapshot`). |
| 3 | `COMPONENT_INFO_SOURCE: Record<componentKey, ComponentInfo>` (02 §4.1) | One pre-substitution `{ name, whatItMeasures, formula?, indicator?, about? }` per component; numeric edges expressed as `{{component_key.token}}`. |
| 4 | `ThresholdComponentDefinition[]` → `THRESHOLD_REGISTRY` (02 §4.2) | One entry per tokenised component: ordered groups, each with `direction`, optional `enforceMonotonic`, and an ordered `tokens` list (`name`, `label`, `unit`, `valueType`, `defaultValue`, `min`, `max`). |
| 4 | `ai_insight_thresholds` rows (02 §4.3) | A forward-only SQL migration inserting `(component_key, token, value) ON CONFLICT DO NOTHING` for every registry token; values must equal `defaultValue` (invariant 3.3.2). |
| 5 | `fetchComponentData(componentKey, sectionKey, dateRange, fiscalPeriod?) → FetcherResult` (04 §4.2) | A dispatch entry for every new component, returning `{ prompt: <formatted-markdown>, allowed: AllowedValue[] }`; fail-soft (a missing fetcher returns an explanatory string + `allowed: []`, never throws). |
| 6 | `DEFAULT_COMPONENT_PROMPTS: Record<componentKey, string>` (04 §7, body catalogued in 04a) | One verbatim prose body per component, optionally embedding `{{component_key.token}}`. |
| 7 | `policyForSection(sectionKey) → 'none' \| 'aggregate_only' \| 'full'` (04 §5.5) | One entry per new section mapping it to the desired tool budget; `none` is safe and small for a first pack. |
| 8 | `BATCH_SECTIONS: SectionScope[]` (05 §4.2 / §7) | One ordered entry per **active** section: `{ sectionKey, page, kind, resolve }`. `resolve` returns the *current* window using the pack's own min/max-date query (for `range`) or fiscal-year query (for `fiscal`). |

> A pack may also need: **(a)** a frontend page route under the app's pages directory that mounts the Engine's section panel(s) for its `PageKey` (doc 07 §3); **(b)** a navigation entry if the app has a sidebar. These are application-shell glue, not pack data — keep them minimal and reuse the Engine's panel verbatim.

**Out of pack scope:** anything in §3.1, plus the Engine type `AllowedValueUnit` (extend the Engine if you need a new unit), `ComponentType` (`kpi | chart | table | breakdown` is exhaustive), the four scope columns on `ai_insight_section`, and the prompt structure / numeric guard / parser format. A pack that "needs" any of these is signalling an Engine bug or an unsupported domain — bring it back to the Engine.

## 5. Behavior & flow

> Concrete recipe against the reference stack (Next.js App Router + React + TypeScript + PostgreSQL + OpenRouter). Stack-version-sensitive steps are flagged `[VERSION-SENSITIVE]`.

The recipe is a **strict order** — each step has runnable verification before the next. Skipping ahead breaks one of §3.3's invariants in a way that is hard to debug later.

### Step 1 — Decide the catalog

Before any code, write down (in any document tool) the new pack's catalog as a table identical in shape to doc 02 §5.1:

```
Page (label) | Section key | Components (key · type) | Scope kind
```

Rules:

- `SectionKey` strings are *globally unique* across all packs (one flat union — doc 01 §4 owns the type). Prefix to avoid collision: `hr_attendance_leave`, `prod_oee_overview`. Finance, being the original pack, uses bare names — new packs should prefix.
- `componentKey` strings are also globally unique. Same prefix rule.
- `ComponentType` is `kpi | chart | table | breakdown` — exhaustive (doc 02 §4.1).
- For each section pick exactly one scope kind: `range` (a calendar window), `snapshot` (point-in-time), `fiscal` (a fiscal year/window). Mixed-mode sections are not supported by the Engine — split them.

**Verification:** the table is reviewed and signed off before any code is written. A change to it later is a code-mod across files (3.2 §1, §2, §5, §6, §8) and a re-seed migration.

### Step 2 — Stand up source-of-truth and (optionally) precomputed projections

The pack reads its own domain data. Two options against the reference stack:

- **Source-of-truth store (read-only).** A separate Postgres reached via the `RDS_DATABASE_URL` pool (doc 01 §5.1). The Engine treats it as not-owned; the pack can read it but does not write or own its schema. `[VERSION-SENSITIVE]` — the reference stack uses Node `pg`; any driver with a single-connection-checkout pool works.
- **Precomputed projection tables.** Pack-owned tables in the engine-owned database, prefixed (e.g. `hr_pc_*`, `prod_pc_*`) and refreshed by a separate ETL/cron job that the Engine does **not** drive. The pack's fetcher reads these via the engine pool; reads are fast, predictable, and tool-policy-compatible (doc 04 §5.5).

Finance uses **precomputed projection tables co-located in the engine-owned DB** for most fetchers and the `RDS_DATABASE_URL` pool only for the summary agent loop's drill-down tools (`query_rds_table`, doc 04 §5.5). A new pack should default to the same shape unless its data shape forbids it.

**Verification:** at least one `SELECT … LIMIT 1` returns a row through the chosen pool for every prospective fetcher's table.

### Step 3 — Widen the type system

In the file that defines the union types (`apps/dashboard/src/lib/ai-insight/types.ts`) append the new `PageKey` and `SectionKey` literals. **Do not remove** existing literals from another pack.

```ts
export type PageKey =
  | 'sales' | 'payment' | 'financial' | 'customer-margin'
  | 'supplier-performance' | 'return' | 'expenses'
  | 'hr'        // existing scaffold
  | 'people';   // ← new pack

export type SectionKey =
  | 'sales_trend' | /* … existing Finance keys … */
  | 'employee_demographics' | /* … existing HR scaffold keys … */
  | 'people_headcount_trend';   // ← new pack section
```

**Verification:** `tsc --noEmit` passes. Every `Record<SectionKey, …>` elsewhere now reports an "incomplete record" error — that is exactly the compiler enforcing §3.3.3 (catalog completeness). Those errors are the to-do list for the remaining steps.

### Step 4 — Fill the four catalog maps

In the catalog file (`apps/dashboard/src/lib/ai-insight/prompts.ts`):

```ts
SECTION_COMPONENTS['people_headcount_trend'] = [
  { key: 'people_headcount',          name: 'Headcount',          type: 'kpi' },
  { key: 'people_headcount_by_dept',  name: 'Headcount by department', type: 'breakdown' },
];
SECTION_PAGE ['people_headcount_trend'] = 'People';
SECTION_NAMES['people_headcount_trend'] = 'Headcount trend';
```

In the fetcher file (`apps/dashboard/src/lib/ai-insight/data-fetcher.ts`):

```ts
SECTION_SCOPE['people_headcount_trend'] = 'period';   // ↔ batch-scope 'range'
```

In the tool-policy file (`apps/dashboard/src/lib/ai-insight/tool-policy.ts`):

```ts
people_headcount_trend: 'none',   // first pack: keep summary loop tool-free
```

**Verification:** `tsc --noEmit` passes; the "incomplete record" errors for `SECTION_COMPONENTS`/`SECTION_PAGE`/`SECTION_NAMES`/`SECTION_SCOPE`/tool-policy are gone.

### Step 5 — Author component metadata (`COMPONENT_INFO_SOURCE`)

For every new `componentKey`, add a pre-substitution `ComponentInfo` to `COMPONENT_INFO_SOURCE` (file `apps/dashboard/src/lib/ai-insight/component-info.ts`). Express *only the numeric band edges* as `{{component_key.token}}`; the words "Good"/"Warning"/the comparison direction are fixed prose (doc 02 invariant 1, doc 02 §6.1).

```ts
people_headcount: {
  name: 'Headcount',
  whatItMeasures: 'Total active employees at the period end.',
  indicator:
    '≥{{people_headcount.healthy_count}} = Healthy\n' +
    '≥{{people_headcount.watch_count}} = Watch\n' +
    '<{{people_headcount.watch_count}} = Concern',
  about: 'Active headcount at month end. …',
}
```

**Verification:** `getRenderedComponentInfo('people_headcount')` returns the same shape with placeholders substituted (after step 6 lands the registry).

### Step 6 — Author the threshold registry and seed

In the registry file (`apps/dashboard/src/lib/ai-insight/threshold-config.ts`), add a component entry with one or more groups; each group is one ordered token list with a direction and (default `true`) monotonicity check (doc 02 §4.2):

```ts
component('people_headcount', [
  group('headcount_band', 'Headcount band', 'descending', [
    intToken('healthy_count', 'Healthy at or above', 'count', 100, 0, 100000),
    intToken('watch_count',   'Watch at or above',   'count', 80,  0, 100000),
  ]),
]),
```

Then add a forward-only SQL migration (next free `NNN_*.sql` filename) seeding the exact same values:

```sql
INSERT INTO ai_insight_thresholds (component_key, token, value, updated_at)
VALUES
  ('people_headcount', 'healthy_count', 100, NOW()),
  ('people_headcount', 'watch_count',    80, NOW())
ON CONFLICT (component_key, token) DO NOTHING;
```

**Verification:** Doc 02 §8 Check A on the new component (`listThresholdSeedRows()` ⟷ `ai_insight_thresholds` rows) — perfect 1:1. The render check (Check B) replaces the new tokens in metadata. The validation check (Check D) rejects a save that breaks the group's `descending` ordering.

### Step 7 — Author the per-component data fetchers

In the fetcher file (`apps/dashboard/src/lib/ai-insight/data-fetcher.ts`), add one branch per new component in the dispatch table the file uses, returning `FetcherResult = { prompt, allowed }`. The fetcher must:

- Read its data via the **engine pool** (precomputed projection table) or the **read-only pool** (drill-down) — never both in the same call; never via direct `fetch`/HTTP.
- Format `prompt` as a markdown block of `Current Values:` ready to be appended after the scope label. The Engine's `fetchComponentData` wrapper (doc 04 §5.2) prepends the scope label and then renders threshold tokens; the pack's fetcher therefore **may include `{{component_key.token}}`** inside the body if it wants the renderer to substitute them.
- Build `allowed: AllowedValue[]` for every number the prompt body cites: `{ label: <human>, value: <number>, unit: 'RM'|'pct'|'days'|'count'|'ratio', tolerance?: <number> }`. The Engine's `fetchComponentData` then unions `allowedThresholds(componentKey)` into this list automatically; the fetcher does not add threshold tokens itself.
- **Fail-soft.** Wrap every DB call in `try/catch`; on error return `{ prompt: 'No data for <componentKey> in this scope.', allowed: [] }`. Never throw.

```ts
async function fetchPeopleHeadcount(
  _sectionKey: SectionKey, dateRange: DateRange | null,
): Promise<FetcherResult> {
  if (!dateRange) return { prompt: 'No date range.', allowed: [] };
  try {
    const { rows } = await getPool().query(
      `SELECT month, headcount FROM people_pc_headcount
        WHERE month BETWEEN $1 AND $2 ORDER BY month`,
      [dateRange.start, dateRange.end],
    );
    const last = rows[rows.length - 1];
    return {
      prompt: `Current Values:\n- Latest headcount: ${last.headcount}\n` +
              rows.map(r => `  - ${r.month}: ${r.headcount}`).join('\n'),
      allowed: [{ label: 'Latest headcount', value: Number(last.headcount), unit: 'count' }],
    };
  } catch { return { prompt: 'No data for people_headcount in this scope.', allowed: [] }; }
}
```

**Verification:** call `fetchComponentData('people_headcount', 'people_headcount_trend', {start,end})` directly; expect a non-empty `prompt` ending after the threshold-rendered indicator text (because doc 04 §5.2 renders the prompt at the wrapper boundary) and a non-empty `allowed`.

### Step 8 — Author the per-component prompt bodies

In `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts` add one verbatim string per new `componentKey` to `DEFAULT_COMPONENT_PROMPTS`. Body shape mirrors the Finance entries catalogued in doc **04a**:

- One paragraph describing the role of the component.
- A short "Indicator" or "Band" line using `{{component_key.token}}` placeholders for every numeric edge.
- A closing "Output:" sentence stating what the component analysis should narrate (≤ ~150 words).

A component with no body throws (`getComponentPrompt`, doc 04 §5.2); shipping a section without bodies for every component breaks the section.

**Verification:** `getComponentPrompt('people_headcount')` returns the body with tokens substituted; `analyzeComponent` (doc 04 §5.2) produces a non-empty `analysis_md` against the mock model (doc 03).

### Step 9 — Register the ordered batch-scope catalog

In the batch-scope file (`apps/dashboard/src/lib/ai-insight/batch-scope.ts`):

1. Add a pack-specific `resolveRangeFromSql(...)` (or reuse `snapshotScope` / `fiscalScope`) that returns the pack's current min/max-date window. For `range`, query the pack's projection table:

   ```ts
   const peopleScope = () => resolveRangeFromSql(`
     SELECT MIN(month) || '-01' AS min_date,
            MAX(month) || '-01' AS max_date
       FROM people_pc_headcount
   `, 'people');
   ```

2. Append one `BATCH_SECTIONS` entry per **active** section, in the order the conductor should walk them:

   ```ts
   { sectionKey: 'people_headcount_trend', page: 'people',
     kind: 'range', resolve: peopleScope },
   ```

**`kind` ↔ `SECTION_SCOPE` mapping (must match):** `range`↔`'period'`, `snapshot`↔`'snapshot'`, `fiscal`↔`'fiscal_period'` (§4 row 2). A mismatch produces a fetcher that silently returns "No fetcher defined" while the conductor thinks it sent a valid scope.

A section that is type-system-registered (Step 3) but **not** added to `BATCH_SECTIONS` is the **scaffold** state: it ships in the type system, the threshold UI can configure its tokens, and the read API can serve its (non-existent) insights as 404 — but the batch runner never visits it. The five HR sections (`employee_demographics`, `attendance_leave`, `overtime_work_hours`, `payroll_compensation`, `performance_talent`) are in exactly this scaffold state today (steps 3–4 + tool policy done; steps 5–9 not done; not in `BATCH_SECTIONS`).

**Verification:** `runInsightBatch('tester')` walks one more section than before; the new section appears in the run ledger's `current_section` field during execution; on completion `getSectionInsight('<new_section_key>', '<new_page_label>')` returns a row.

### Step 10 — Frontend page wiring

For each new `PageKey`, add a route under the app's pages directory that mounts the existing Engine read panel (doc 07 §3, `InsightSectionHeader` + `AiInsightPanel`) once per section. Reuse the existing component dialog (doc 07) for per-component drill-in. The pack ships **no new** panel/dialog code; if it would, the §3.3.5 leakage rule is violated.

`[VERSION-SENSITIVE]` — App-Router page file `apps/dashboard/src/app/<page>/page.tsx`; on Pages Router this is a `pages/<page>.tsx` file with the same component tree. Auth/admin gating is the application shell's job, not the pack's.

**Verification:** navigate to `/people`, see the Engine's section header(s) and panel(s) render in the doc 07 four-state matrix; after a successful batch (Step 9 verification) the panel transitions out of `404` into `present` with the new section's insight.

### 5.1 The minimum-viable pack

The smallest correct pack is **one page, one section, one component, no thresholds, tool policy `none`** — six entries across six files plus one fetcher and one prompt body. That is the recommended shape for a "Hello Pack" used to satisfy the §8 verification before authoring real domain content.

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Pack wants to add a column to `ai_insight_section`/`_component`/`_batch_run` | **Refuse.** It is an Engine change — argue it on Engine grounds (would it benefit every pack?). | Invariant 3.3.1; otherwise schema diverges between deployments running different pack sets. |
| 2 | Pack wants a new `ComponentType` beyond `kpi/chart/table/breakdown` | **Refuse for the pack; consider an Engine extension.** Until then map to the closest existing type. | The frontend (07) keys layout off the four types; new types need shell support. |
| 3 | Pack wants a new `AllowedValueUnit` beyond `RM/pct/days/count/ratio` | Same as (2): Engine extension required (numeric guard tolerances are unit-keyed, doc 04 §5.5). | Without it the guard cannot match the new unit and will always flag the value. |
| 4 | Two packs accidentally collide on a `sectionKey` or `componentKey` | The later definition silently wins on `Record` writes — **catastrophic**. The pack lint rule must reject duplicate keys at PR time. | Type-system unions allow collision; runtime catalog maps don't detect it. |
| 5 | A registry token's `defaultValue` ≠ its seed-row value | Build/test failure (doc 02 invariant 2 / §6 rule 8). | "No override" must be identical to "fresh database". |
| 6 | A new section is registered (Step 3) but has no fetcher (Step 7) | `fetchComponentData` returns the explanatory empty-prompt fail-soft for each of its components; the batch records a degraded but non-empty insight. | Fail-soft is correct behavior — the pack ships visibly broken instead of crashing. The verification (§8) catches it. |
| 7 | A new section is registered but not added to `BATCH_SECTIONS` | The conductor never visits it; the read API returns 404 for its key; the threshold UI shows its tokens as configurable; the frontend panel renders the `404` state. | The intentional scaffold state. HR is the worked example. |
| 8 | A pack's fetcher throws | `fetchComponentData` swallows and returns the explanatory empty result (doc 04 §6 rule 5). | One bad component must not abort the section or the batch (doc 05 invariant 2). |
| 9 | A pack's prompt body cites a hardcoded number instead of a token | The numeric guard rejects it as unmatched on every run, lowering quality silently. | Doc 02 invariant 1 / §6.1 — only numeric edges are tokens; literal numbers must be either in the data block (and thus in `allowed`) or expressed through tokens. |
| 10 | A pack sets tool policy `aggregate_only` or `full` without aggregate tables in its projection | The summary agent's tool calls return rejection strings, attempts are wasted, no benefit. | Doc 04 §5.5 — `aggregate_only` is meaningful only when the policy gate's allow-list of `pc_*` aggregate tables actually contains the pack's tables (an Engine constant; extension needs an Engine change). For first packs choose `none`. |
| 11 | A pack tries to depend on another pack's tokens / fetchers | **Forbid.** Packs are peers — neither imports the other. Cross-cutting analysis is an Engine concern. | Prevents implicit pack-ordering and circular dependencies; keeps packs swappable. |
| 12 | A pack wants prompt-logging or debug-file logging behavior different from the Engine default | **Refuse.** `AI_INSIGHT_LOG_PROMPTS` (doc 03) and `AI_INSIGHT_DEBUG_FILE` (doc 04) are Engine-owned switches. | One global posture; both default off because both capture raw source data. |
| 13 | A pack's component has bands but no `THRESHOLD_REGISTRY` entry | The component metadata renders with `{{…}}` literally visible to users (renderer leaves unknown tokens verbatim — doc 02 §6 rule 1). | The renderer is fail-safe by design; visible `{{…}}` is the bug signal — fix by adding the registry entry. |
| 14 | `tsc --noEmit` passes but a `Record<SectionKey, …>` is missing the new key | TypeScript's `Record` is *not* a totality check — `Record<K, V>` is `{ [k in K]: V }` only when written exactly that way. If the catalog file uses a `Partial<Record<SectionKey, …>>` or an indexed type, the compiler may not catch a missing key. | Treat the compiler errors of Step 3 as *advisory*. The §8 verification is the binding check. |

### 6.1 Configuration owned by this layer

**None.** Adding a pack adds no ENV variables. A pack's data sources reuse the Engine's two pool URLs (`DATABASE_URL` for projections, `RDS_DATABASE_URL` for drill-down). A pack's seed migration is run by the same ops process as the Engine's `ai-insight-schema.sql`.

If a pack genuinely needs a new ENV (e.g. its source store is a third pool), it is an **Engine change**: a new pool, a new fail-soft port, and a new owned row in doc 00 §8. Document it and update doc 01.

## 7. Reference Implementation

### 7.1 Finance — the complete worked pack

The Finance Domain Pack is the finished reference. Mapping each §3.2 artefact to its source file:

| Artefact | Finance file (engine-anchored path) | Documented in |
|---|---|---|
| Page/section/component vocabulary | `apps/dashboard/src/lib/ai-insight/types.ts` (the unions); `apps/dashboard/src/lib/ai-insight/prompts.ts` (`SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES`) | 02 §4.1, §5.1, §7 |
| Per-section scope kind | `apps/dashboard/src/lib/ai-insight/data-fetcher.ts` (`SECTION_SCOPE`) | 04 §5.2 |
| Per-component metadata | `apps/dashboard/src/lib/ai-insight/component-info.ts` (`COMPONENT_INFO_SOURCE`) | 02 §4.1, §5.2, §7 |
| Threshold registry + seed | `apps/dashboard/src/lib/ai-insight/threshold-config.ts` (`THRESHOLD_REGISTRY`); `migrations/025_ai_insight_thresholds.sql` | 02 §4.2, §4.3, §7 |
| Per-component data fetchers | `apps/dashboard/src/lib/ai-insight/data-fetcher.ts` (component dispatch + per-page private fetchers; reads `pc_*` precomputed tables via the engine pool) | 04 §4.2, §7 |
| Per-component prompt bodies | `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts` (`DEFAULT_COMPONENT_PROMPTS`, 69 entries); verbatim catalogue in `ai-insight-docs/04a-prompt-catalog.md` | 04 §7, 04a |
| Per-section tool policy | `apps/dashboard/src/lib/ai-insight/tool-policy.ts` (`policyForSection` and the static table) | 04 §5.5 |
| Ordered batch-scope catalog | `apps/dashboard/src/lib/ai-insight/batch-scope.ts` (`BATCH_SECTIONS`, 16 entries) | 05 §4.2, §7 |
| Page routes & shell wiring | `apps/dashboard/src/app/<page>/page.tsx` (one per Finance `PageKey`); shell components in `apps/dashboard/src/components/ai-insight/` | 07 §3, §7 |

Two Finance details that are deliberately **not** what a new pack copies wholesale:

- **Pack-owned precomputed tables.** Finance uses `pc_*` projection tables in the engine-owned DB, refreshed by ETL outside the Engine. A new pack should also keep its projections in the engine-owned DB but prefix them (`hr_pc_*`, etc.) to keep ownership obvious. Engine docs (01) intentionally do not specify the projections — they are pack-owned data, not Engine schema.
- **Finance-specific safeties in `tools.ts`.** The `Cancelled = 'F'` filter injected server-side on RDS document tables (doc 04 §5.5) is Finance-domain logic baked into the Engine *tool implementation*. A new pack that uses tools beyond `none` must either restrict itself to tables the existing tool implementation knows, or argue an Engine extension that widens the tool allow-list and adds equivalent safeties for the new tables.

### 7.2 HR — the half-built scaffold seam

The Finance repo ships HR in **scaffold state** (§5 Step 3 + parts of Step 4 done; Steps 5–9 not done; no `BATCH_SECTIONS` entries). This is the literal "before" state any new pack starts from:

| §3.2 artefact | HR scaffold state | What is missing to activate |
|---|---|---|
| Vocabulary | Five `SectionKey`s in `types.ts`: `employee_demographics`, `attendance_leave`, `overtime_work_hours`, `payroll_compensation`, `performance_talent`; `PageKey` includes `'hr'`. | Components per section. |
| Catalog maps | `SECTION_COMPONENTS[<hr>] = []` (empty arrays); `SECTION_PAGE[<hr>] = 'hr'`; `SECTION_NAMES[<hr>] = '<human label>'`. | Component entries in `SECTION_COMPONENTS`. |
| Scope kind | `SECTION_SCOPE['employee_demographics'] = 'snapshot'`, the other four `= 'period'`. | Consistent with intended batch `kind` (snapshot/range) when added. |
| Tool policy | All five sections = `'none'`. | Stays `none` for the first version. |
| Metadata | **Not authored.** | `COMPONENT_INFO_SOURCE` entries per component. |
| Threshold registry + seed | **Not authored.** | `THRESHOLD_REGISTRY` block + seed migration per tokenised component. |
| Fetchers | **Not authored.** | One dispatch entry per `componentKey` reading the HR projection table(s). |
| Prompt bodies | **Not authored.** | One `DEFAULT_COMPONENT_PROMPTS` entry per `componentKey`. |
| `BATCH_SECTIONS` | **Not added.** | One entry per active HR section, with an HR `resolveRangeFromSql` (and `fiscalScope`/`snapshotScope` reuse where applicable). |

Activating HR is therefore the exact §5 recipe applied with `prefix = hr_*`, starting from the existing scaffold rather than from zero.

### 7.3 Where the Engine refuses to be modified

For traceability: the files a pack must **not** edit. If a PR touches any of these in service of a new pack, it is an Engine PR by definition and needs Engine review.

- `apps/dashboard/src/lib/postgres.ts` — pool model (doc 01).
- `apps/dashboard/src/lib/ai-insight/storage.ts` — result store (doc 01).
- `apps/dashboard/src/lib/ai-insight/batch-store.ts` — run ledger (doc 01).
- `apps/dashboard/src/lib/ai-insight/batch-runner.ts` — conductor (doc 05).
- `apps/dashboard/src/lib/ai-insight/orchestrator.ts` — generation pipeline (doc 04 mechanism).
- `apps/dashboard/src/lib/ai-insight/client.ts` — model provider (doc 03).
- `apps/dashboard/src/lib/ai-insight/numeric-guard.ts` — guard (doc 04 mechanism).
- `apps/dashboard/src/lib/ai-insight/prompt-loader.ts` — prompt assembly & rendering hook (doc 04 mechanism).
- `apps/dashboard/sql/ai-insight-schema.sql` and `migrations/025_ai_insight_thresholds.sql` — Engine-owned DDL (doc 01, 02). A pack writes its **own** new migration; it never edits these.
- The read API route handlers under `apps/dashboard/src/app/api/ai-insight/` (doc 06) and the admin routes (doc 08).
- The Engine read shell (`AiInsightPanel`, `InsightDetailDialog`, `ComponentInsightDialog`, `InsightSectionHeader`, doc 07).

`batch-scope.ts` and `tool-policy.ts` are **shared**: their *mechanism* (resolvers, the `validateToolForSection` policy gate) is Engine; the *registry* the file exports (`BATCH_SECTIONS`, the per-section policy table) is Domain Pack. A pack edits only the table rows, not the surrounding code.

## 8. Verification checkpoint

The pack is built correctly when *all* of the following pass with **no edits to any file in §7.3**.

**Setup (Hello Pack).** Build the minimum-viable pack of §5.1: one new page `'demo'`, one new section `'demo_overview'` with one `kpi` component `'demo_kpi'`, scope kind `range`, tool policy `none`, one threshold (`good_count = 10`, `count`, range 0–10000), one fetcher returning a deterministic constant, one short prompt body citing `{{demo_kpi.good_count}}`. Apply the engine schema (doc 01) and the pack's seed migration. Set `AI_INSIGHT_MOCK_LLM` for offline runs (doc 03).

**Check A — type and catalog completeness.** `tsc --noEmit` passes. `SECTION_COMPONENTS['demo_overview']` is non-empty; every `componentKey` in it has a `COMPONENT_INFO_SOURCE` entry, a `DEFAULT_COMPONENT_PROMPTS` entry, a fetcher (`fetchComponentData('demo_kpi','demo_overview', …)` returns non-empty `prompt`), and (because it has bands) a `THRESHOLD_REGISTRY` entry whose `defaultValue` equals its seed row in `ai_insight_thresholds`. (Doc 02 §8 Check A applied to the pack's tokens.)

**Check B — threshold render & validation.** `renderThresholdText('cap = {{demo_kpi.good_count}}', 'anything')` ⇒ `'cap = 10'`. Saving `{ good_count: -1 }` is rejected (min bound). Saving `{ good_count: 12 }` succeeds, the cache invalidates, and the next render shows `12`. (Doc 02 §8 Checks B–D applied to the pack.)

**Check C — single-section batch.** `runInsightBatch('tester')` opens a run row with `sections_total = <previous_total + 1>`; the new section appears once in `current_section` during execution; on completion the run is `success` (or `partial` if an unrelated existing section happened to fail); `getSectionInsight('demo_overview', 'demo')` returns one row with a non-empty `summary_json` and one child `ai_insight_component` row for `demo_kpi` whose `analysis_md` is non-empty. **No Engine file in §7.3 was edited.**

**Check D — read API & frontend.** `GET /api/ai-insight/section?page=demo&section=demo_overview` returns the section envelope (doc 06); `GET /api/ai-insight/component?page=demo&section=demo_overview&component=demo_kpi` returns the component envelope including `componentInfo` (doc 06). Navigating the new page route in a browser shows the doc 07 panel in its `present` state, with `demo_kpi`'s metadata containing the **rendered** band edge `12` (not `{{…}}`).

**Check E — admin auto-discovery.** Open the threshold-config page (doc 08). The new component appears in the prompt tree under its page label `'Demo'`; selecting it shows the `headcount_band`-style group editor with the current value `12`; saving from this UI re-invalidates the cache (next batch's render shows the new value).

**Check F — Engine non-regression.** Re-run the doc 09 end-to-end walkthrough against the existing Finance pack: the trigger succeeds, every Finance section persists an insight, the Finance frontend pages still render `present`. **A new pack must not break an existing pack.**

**Definition of Done:** a developer who has read only `00`–`10`, with no access to this repo's source, can stand up a new Domain Pack ("Hello Pack" or larger) using only the recipe in §5 and the contracts in §4, and pass Checks A–F. The Finance pack (docs 02 / 04 / 04a) is the worked reference; the HR scaffold (§7.2) is the half-built starting state.
