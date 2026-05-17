# 09 — End-to-End Walkthrough

> **Classification:** Spine
> **Enables:** A full, verified run from administrator trigger to rendered end-user insight.
> **Read after:** 00–08

---

## 1. Purpose

This document is the **integration acceptance for the whole engine**. Every prior document proves *its own* layer in isolation; this one proves they compose: a single administrator trigger flows through orchestration, generation, the model boundary, storage, the read API, and the frontend, producing a persisted insight an end user can see — with **zero live model calls** and **zero user-triggered generation**. It introduces no new contract and no new source. It threads the per-layer checkpoints (`01`–`08`) into one worked run on the reference stack and defines the single observable end state that means "the engine is correctly built end-to-end". After this document you can stand the whole system up offline and confirm it works as a system, not just as parts.

## 2. Prerequisites

- **Docs 00–08, each built and passing its own §8 checkpoint.** This walkthrough does not re-specify any layer; it assumes each is implemented to its own Definition of Done. If a step here fails, the failure localises to the owning layer's document.
- **Doc 00** — the end-to-end flow (§5.2), the Engine/Domain/Spine split (§4), and the configuration matrix (§8). This document is **Spine**: its §3 is domain-neutral; its §5 runs the **Finance Domain Pack** as the worked example exactly as doc 00 §4 intends (any Domain Pack substitutes with no change to the Engine steps).
- **Doc 03's mock model boundary.** The entire walkthrough runs through the mock (`AI_INSIGHT_MOCK_LLM` set), so it needs no gateway, no credential, and no network. This is the property that makes end-to-end acceptance reproducible.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the end-to-end guarantee as an idea.*

The engine's end-to-end contract is a **one-directional pipeline with a persisted seam in the middle**:

```
   operator trigger ─▶ orchestration ─▶ generation ─▶ model boundary
                                            │
                                            ▼
                                     persisted insight  ◀── the seam
                                            │
   end user  ◀── frontend ◀── read API ◀────┘   (no generation on this side)
```

**Inputs**

- One authenticated operator trigger.
- A built Domain Pack (catalog, fetchers, prompts, threshold registry) and the two datastores (engine-owned writable; source-of-truth read-only).

**Outputs / guarantees (the end-to-end invariants this run proves)**

1. **The seam holds.** Everything left of the persisted insight is write-side and happens once per trigger; everything right of it is read-only and happens on every page view. The two never cross (doc 00 invariants 1–2).
2. **Determinism offline.** With the mock boundary engaged, the same trigger yields the same persisted shape with no external dependency (doc 03).
3. **Fault isolation.** One section failing does not abort the batch nor corrupt another section; the run still reaches a terminal state and the healthy sections still render (docs 05/01).
4. **Single-run exclusivity end-to-end.** Concurrent triggers (e.g. an operator double-click) still produce exactly one run (docs 08→05→01).
5. **Self-healing observation.** A crashed run is reclaimed on the next observation and the operator surface never shows a permanent "running" (docs 08/01).
6. **What you configure is what renders.** A threshold edited in the admin surface changes the numbers a subsequent run's prompts carry and therefore the rendered narrative — without any prompt prose change (docs 08/02/04).

**Boundary**

This document owns **no** contract. It composes the contracts each layer owns and asserts only on observable, cross-layer outcomes.

## 4. Data contracts

None owned. Each step exercises a contract owned elsewhere; the table maps step → owning document so a failure is traceable without guesswork.

| Step exercises | Contract | Owner |
|---|---|---|
| Schema applied, atomic section replace, single-run index | engine tables, `upsert*`, `createBatchRun` | 01 |
| Threshold table seeded, tokens render to numbers | `THRESHOLD_REGISTRY`, `renderThresholdText`, values table | 02 |
| Every model call is offline & deterministic | `callAiModel` + mock interception | 03 |
| Per-section fetch→analyse→guard→summary | the generation pipeline, `SummaryJson` | 04 |
| One trigger → ordered sections → terminal status | `runInsightBatch`, batch-run lifecycle | 05 |
| Section/component reads over HTTP | the two read envelopes | 06 |
| Rendered panel/dialog four-state model | the read surfaces | 07 |
| Admin gate, fire-and-forget, status heal, threshold save | admin envelopes + operator UI | 08 |

## 5. Behavior & flow

> Stack-true. `[VERSION-SENSITIVE]` flags mark assumptions a different stack must adapt.

`[VERSION-SENSITIVE]` — the reference run is Next.js App Router + React + PostgreSQL with the OpenRouter mock. On another stack, substitute: route handlers → that stack's HTTP entrypoints; `psql -f` → that database's schema apply; the in-process fire-and-forget background call → that stack's equivalent. The **sequence and observable outcomes below are stack-invariant**; only the invocation mechanics change.

### 5.0 Environment (offline, deterministic)

Set, in the app environment:

| Variable | Value for this run | Effect |
|---|---|---|
| `DATABASE_URL` | a fresh empty database | engine-owned store (doc 01) |
| `RDS_DATABASE_URL` | any value (may be unreachable) | source store; fail-soft to empty (doc 01) |
| `OPENROUTER_API_KEY` | empty | forces reliance on the mock |
| `AI_INSIGHT_MOCK_LLM` | set to a normal value | every model call is offline & deterministic (doc 03) |
| `AI_INSIGHT_BATCH_DELAY_MS` | `0` | no inter-section pause, fastest run (doc 05) |
| `AI_INSIGHT_BATCH_STALE_MIN` | `40` (default; `0` only for the stale-heal sub-check) | stale threshold (doc 05) |
| `AI_INSIGHT_LOG_PROMPTS` | `false` | **must stay off — logging captures source data** (doc 03) |
| `AI_INSIGHT_THRESHOLDS_USE_DEFAULTS` | unset | thresholds resolve from the DB table (doc 02) |

### 5.1 Build the substrate (docs 01 → 02)

1. Apply the engine schema: `psql "$DATABASE_URL" -f apps/dashboard/sql/ai-insight-schema.sql`. Re-running is idempotent (doc 01 §8). Expect the four tables and the partial unique index on the running batch row.
2. Apply the threshold seed: `psql "$DATABASE_URL" -f migrations/025_ai_insight_thresholds.sql`. Expect one row per registry token, every value equal to its registry default (doc 02 Check A — *defaults == seeds*).

### 5.2 Trigger one batch as the operator (docs 08 → 05)

3. As **admin** (`x-user-role: admin`), `POST /api/admin/ai-insight/batch/trigger`. Expect an **immediate** `200 { started:true, sections_total }` — the response returns before generation finishes (fire-and-forget; doc 08 §5.2).
4. **Immediately `POST` the trigger again** (the operator double-click). Expect `409 Batch already running` and **no** second ledger row — single-run exclusivity composed across docs 08→05→01 (end-to-end invariant 4).

### 5.3 Generation runs offline (docs 05 → 04 → 03 → 01)

5. The background run iterates the active sections in catalog order (doc 05). For each section: resolve scope, fetch each component's data, call the model per component **through the mock** (doc 03 — no network), run the numeric guard, then the summary pass (doc 04), and **atomically replace** that section's stored insight (doc 01 — old component rows cascade-deleted, new ones written in one transaction).
6. Poll `GET /api/admin/ai-insight/batch/status` during the run. Expect `current_section` and the counters to **advance between sections, not only at the end** (doc 05 Check 7); the operator card mirrors this (doc 08 §5.4).
7. The run closes with a terminal status: `success` if every section produced an insight, `partial` if some sections failed but others succeeded, `error` if it could not proceed (doc 05). A failing section contributes a `section_errors` entry and does **not** prevent the others from persisting (end-to-end invariant 3).

### 5.4 Read back over the API (doc 06)

8. For a section that generated, `GET /api/ai-insight/section/{section_key}?page={page}` ⇒ `200 { exists:true, …, provider_metadata }` with `provider_metadata` lifted to the top level. For a section key that never generated ⇒ `404 { exists:false }`.
9. For a component under a generated section, `GET /api/ai-insight/component/{section_key}/{component_key}` ⇒ `200 { exists:true, componentInfo, analysis_md, … }`, with every `{{token}}` in `componentInfo` already substituted to a number. For a component whose section never ran ⇒ `200 { exists:false, componentInfo }` (note: **200, not 404** — doc 06 invariant 3).

### 5.5 Render to the end user (doc 07)

10. Open the dashboard page hosting that section. The panel is expanded by default and resolves to **present**: a scope line, a last-updated line, and the positive/negative cards (≤3 each). A card click opens the detail modal with the full markdown narrative (doc 07 §5.2–5.3).
11. Open a component's analysis via its per-component icon ⇒ the component dialog titled by `componentInfo.name`, rendering `analysis_md` (doc 07 §5.4). A component whose section never ran shows the *absent* copy, not an error (doc 07 rule 7).
12. Confirm the read-only seam: while doing 10–11 the only network calls are the doc 06 GETs (and the doc 08 status poll if mounted); **no generation occurs and engine row counts do not change** (end-to-end invariant 1).

### 5.6 Configuration round-trip (docs 08 → 02 → 04 → 07)

13. In the threshold-config dashboard (`/admin/ai-insight-config`), select a component prompt that carries a configurable threshold; the preview shows the **rendered** prompt with the current number substituted.
14. Edit the value out of range ⇒ inline error, *Save* disabled; a forced invalid `PUT` ⇒ `400 { error:'Invalid threshold values', details }` and **nothing persists** (doc 08 §5.6 / doc 02 validation).
15. Set a valid in-range value and *Save* ⇒ `200 { ok:true }`, toast, and the preview now shows the **new** number (cache invalidated; doc 08 invariant 4 / doc 02). Trigger another batch (steps 3–7) and re-read (step 9): the new number now appears in the freshly generated narrative — **prompt prose unchanged** (end-to-end invariant 6).

### 5.7 Resilience sub-checks (docs 05/01 observed end-to-end)

16. **Stale self-heal.** With a `running` row left behind and `AI_INSIGHT_BATCH_STALE_MIN=0`, `GET` status once ⇒ the dead row is reclaimed (`error`) and the response is the healed state; the operator card flips off "running" without intervention; a subsequent trigger proceeds (end-to-end invariant 5).
17. **Fail-soft source.** Point `RDS_DATABASE_URL` at an unreachable host and run again ⇒ source-backed components degrade to explanatory text, the section still generates and still renders — no crash anywhere in the chain (doc 01 fail-soft composed through doc 04).

## 6. Rules & edge cases

These are properties **only an end-to-end run can prove** — each composes per-layer rules already specified upstream.

| # | Trigger | Required behavior | Composes |
|---|---|---|---|
| 1 | Whole run with `AI_INSIGHT_MOCK_LLM` set | Completes with no network; same trigger ⇒ same persisted shape | doc 03 §8.1 + doc 04 §8.1 |
| 2 | One section's scope/fetch throws | Run reaches `partial`; that section absent; siblings persisted & rendered | doc 05 §8.1 + doc 01 Check A + doc 07 rule 1/7 |
| 3 | Operator double-click trigger | Exactly one ledger row; the second call `409` | doc 08 §5.2 + doc 05 §8.3 + doc 01 Check B |
| 4 | Crashed run left `running`, observed later | Reclaimed on observation; card never stuck "running" | doc 08 §5.3 + doc 01 reclaim |
| 5 | Threshold edited then re-run | New number in rendered narrative; prose unchanged | doc 08 §5.6 + doc 02 render + doc 04 assembly + doc 07 render |
| 6 | End user interacts with a generated page | Only reads; no write/generate; row counts stable | doc 00 inv. 1 + doc 06 inv. 1 + doc 07 inv. 1 |
| 7 | `RDS_DATABASE_URL` unreachable during a run | Affected components degrade to text; section still generates & renders | doc 01 fail-soft + doc 04 fail-soft fetch |
| 8 | `AI_INSIGHT_LOG_PROMPTS=true` in this run | **Do not** — it dumps source data to logs; keep `false` outside controlled debugging | doc 03 §8 config note |

### 6.1 Configuration owned by this layer

None. This document sets no defaults; it only chooses values (table in §5.0) for a reproducible run, all of them owned and defaulted by their layers per doc 00 §8.

## 7. Reference Implementation

This document adds no source. It is realised as the **ordered execution of the steps in §5** against the implementations the prior documents cite (doc 01 schema/storage, doc 02 thresholds, doc 03 mock boundary, doc 04 pipeline, doc 05 conductor, doc 06 routes, doc 07 surfaces, doc 08 admin). The artifacts this walkthrough **produces** are a populated engine datastore, one terminal batch-run record, and the following rendered captures on the reference stack (confirmation artifacts; the per-step assertions in §5/§8 are the normative description and the acceptance does not depend on these):

- `assets/07-section-panel.png` — §5.5 step 10: the section's insight rendered to an end user (present state).
- `assets/07-insight-detail-dialog.png` — §5.5 step 10: a card expanded to its full markdown narrative.
- `assets/07-component-dialog.png` — §5.5 step 11: one component's analysis rendered.
- `assets/08-batch-card.png` — §5.2 / §5.3: the operator batch card after a completed run (terminal status, counts, cost, tokens).
- `assets/08-threshold-config.png` — §5.6: the threshold-config dashboard with the rendered prompt preview (what-you-configure-is-what-renders).

To run it as a single offline pass: set the §5.0 environment, execute §5.1 (apply both SQL files), then §5.2–§5.5 (trigger, observe, read, render), then optionally §5.6–§5.7.

## 8. Verification checkpoint

**Setup (no source access):** docs 00–08 each built to their own §8 DoD. Apply the §5.0 environment. The Finance Domain Pack is the worked example; any Domain Pack is valid (the Engine steps are identical).

**Action & expected observable result (the master acceptance):**

1. **Substrate.** §5.1 — both SQL applies succeed and are idempotent; threshold values equal registry defaults.
2. **Single trigger, fire-and-forget.** §5.2 — first `POST` ⇒ immediate `200 {started:true}`; the concurrent second `POST` ⇒ `409`; exactly one new ledger row.
3. **Offline generation to terminal.** §5.3 — the run advances section by section with live counters, makes no network call, and ends `success` (all healthy) or `partial` (with an isolated `section_errors` entry and the other sections still persisted).
4. **API reflects storage.** §5.4 — generated section ⇒ `200 exists:true` with top-level `provider_metadata`; never-generated section ⇒ `404`; never-generated component ⇒ `200 exists:false` (not 404).
5. **Rendered to the user.** §5.5 — the panel shows the present state (scope + cards); a card opens the detail modal; the component dialog renders its analysis; the never-run component shows the *absent* copy, not an error; engine row counts are unchanged by all of this.
6. **Config round-trip.** §5.6 — an invalid threshold cannot be saved (UI blocked + server `400`, nothing persisted); a valid save updates the preview immediately, and a subsequent run's rendered narrative carries the new number with unchanged prompt prose.
7. **Resilience.** §5.7 — a stale `running` row is reclaimed on the next status observation (card un-sticks); an unreachable source store degrades affected components to text while the section still generates and renders.

**Definition of Done:** a developer who has read only docs `00`–`09`, with no access to this repository's source, can stand the system up entirely offline, execute §5 in order, and observe a generated insight rendered to an end user — with the seam (write-side once per trigger; read-side on every view) intact, single-run exclusivity held under concurrent triggers, fault isolation across sections, self-healing observation, and an edited threshold changing the rendered numbers without a prose change. Passing this is the engine's whole-system Definition of Done.
