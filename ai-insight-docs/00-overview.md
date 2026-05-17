# 00 — Overview & Spine

> **Classification:** Spine
> **Enables:** A correct mental model of the whole engine, the build order, and the global configuration surface.
> **Read after:** Nothing. This is the entry point.

---

## 1. Purpose

This document set specifies the **AI Insight engine** in enough detail that a developer can rebuild it from scratch in a separate application, **with no access to the original source code**.

The engine turns a structured data domain into LLM-written narrative analysis: it generates, on a single administrator-triggered batch, a written insight for every *section* and *component* of a set of dashboard pages, persists those insights, and serves them read-only to end users.

This overview gives you the model, the map, the template every other document follows, and the one place where all configuration lives. Read it fully before any other document.

**Definition of Done for the whole set:** a developer who reads only documents `00..N`, with no source access, can build layer `N` and pass its verification checkpoint.

## 2. Prerequisites

None for this document. The reader is assumed to be a competent full-stack developer. The reference stack is Next.js (App Router) + React + TypeScript + PostgreSQL + an OpenRouter-compatible LLM gateway. Where an instruction depends on a specific stack choice it is flagged `[VERSION-SENSITIVE]` so a reader on a different stack version or framework can adapt it.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the engine as an idea.*

The engine is a **batch-generated, persisted, read-only analysis layer** over a structured data domain.

**Core entities (vocabulary used by every document):**

| Term | Meaning |
|---|---|
| **Page** | A top-level grouping of related analysis (a dashboard screen). |
| **Section** | An analysable unit within a page. The section is the unit of generation and the unit of storage. |
| **Component** | A sub-unit of a section (a KPI, chart, table, or breakdown). A section's insight is assembled from its components' analyses plus a summary pass. |
| **Scope** | The time/data window a section is analysed over: a date *range*, a point-in-time *snapshot*, or a *fiscal* period. |
| **Insight** | The persisted output for a section: a structured summary plus per-component narrative. |
| **Batch run** | One administrator-triggered pass that (re)generates every active section and records its own lifecycle. |
| **Threshold token** | A named placeholder (e.g. `{{component.token}}`) embedded in prompts and metadata, resolved at render time from a configuration table — so the numbers a model is told to apply are editable without touching prompt prose. |
| **Domain Pack** | The domain-specific catalog: which pages/sections/components exist, what data each consumes, the prompt text, and the threshold defaults. The engine is generic; the Domain Pack makes it about *something*. |

**The engine's contract:**

- **Input:** a Domain Pack (catalog of pages → sections → components, per-component data fetchers, prompt templates, threshold registry) and a trigger.
- **Output:** for every active section, a persisted insight record (section summary + per-component analyses + cost/timing/scope metadata), plus one batch-run record describing the pass.
- **Invariants:**
  1. End users never trigger generation. They only read persisted insights.
  2. Generation is the **section**'s job; a section is regenerated atomically (old insight replaced, not merged).
  3. At most one batch run is in the *running* state at a time.
  4. Numbers the model emits are validated against values the engine actually fetched — the model narrates, it does not invent figures.
  5. Prompt prose is fixed; only threshold tokens vary. Editing a threshold must not require editing a prompt.

**Boundary with adjacent systems:** the engine **owns** its own datastore (the insight + batch tables). It **consumes**, read-only, a separate source-of-truth datastore it does not own and whose schema it must treat as an external contract.

## 4. The Engine / Domain Pack / Spine split

This is the central organising principle of the documentation and the codebase.

- **Engine** — domain-neutral machinery: storage, the model provider, batch orchestration, the read API, the frontend shell, the admin surface. Reusable for any domain. *Docs 01, 03, 05, 06, 07, 08.*
- **Domain Pack** — everything finance-specific: the catalog of pages/sections/components, the data each consumes, the prompt text, and the threshold registry/defaults. A different domain (e.g. HR) is a different Domain Pack on the same Engine. *Docs 02, 04, 04a.*
- **Spine** — the connective tissue: this overview, the end-to-end walkthrough, and the guide for adding a new Domain Pack. *Docs 00, 09, 10.*

Engine and Spine documents must never hardcode finance concepts. Domain Pack documents are finance-specific by design and serve as the worked example for doc 10 ("adding a domain pack").

## 5. System architecture

### 5.1 Layer model (stack-neutral)

```
                 ┌────────────────────────────────────────────┐
   Admin  ─trigger─▶│  08 Admin surface                          │
                 └───────────────┬────────────────────────────┘
                                 ▼
                 ┌────────────────────────────────────────────┐
                 │  05 Batch orchestration                     │
                 │   • one run at a time, lifecycle recorded   │
                 │   • iterates active sections                │
                 └───────────────┬────────────────────────────┘
                                 ▼  per section
        ┌──────────────────────────────────────────────────────┐
        │  04 Insight generation (Domain Pack prompts)           │
        │   • fetch component data  ──uses──▶ 02 catalog/thresh.  │
        │   • per-component model call ──uses──▶ 03 model provider │
        │   • numeric guard, then summary pass                    │
        └───────────────┬──────────────────────────────────────┘
                         ▼
        ┌──────────────────────────────┐     ┌──────────────────┐
        │  01 Storage (engine-owned DB) │◀────│ source-of-truth   │
        │   section + component + batch │ read│ data store (NOT    │
        └───────────────┬──────────────┘ only │ owned — contract)  │
                         ▼                     └──────────────────┘
        ┌──────────────────────────────┐
        │  06 Read API (read-only)      │
        └───────────────┬──────────────┘
                         ▼
        ┌──────────────────────────────┐
        │  07 Frontend (panel / dialog) │  end users: read only
        └──────────────────────────────┘
```

### 5.2 End-to-end flow (one batch)

1. An administrator triggers a batch from the admin surface (**08**).
2. Orchestration (**05**) refuses if a run is already in progress, otherwise opens a batch-run record and iterates the active sections.
3. For each section, generation (**04**) resolves the section's scope, fetches each component's data, calls the model provider (**03**) per component, validates emitted numbers against fetched data, then runs a summary pass over the component results.
4. The section's insight is written to the engine datastore (**01**), atomically replacing any prior insight for that page+section.
5. Batch progress (counts, cost, tokens, current section, per-section errors) is updated throughout; the run is closed with a terminal status.
6. End users load a dashboard page; the read API (**06**) returns the persisted section/component insights; the frontend (**07**) renders them. No generation occurs on the read path.

### 5.3 Reference stack mapping

| Layer | Reference stack realisation |
|---|---|
| Engine datastore | Local PostgreSQL via connection pool (`DATABASE_URL`). Tables: `ai_insight_section`, `ai_insight_component`, `ai_insight_batch_run` (+ a deprecated `ai_insight_lock`). |
| Source-of-truth data | Two read surfaces: most Finance `pc_*`, budget, and app-setting projections are read from the local PostgreSQL pool (`DATABASE_URL`); drill-down/source queries use a separate fail-soft pool (`RDS_DATABASE_URL`). Schema is **not owned** by the engine. See doc 01 for the physical-placement nuance. |
| Model provider | OpenRouter SDK (`@openrouter/sdk`) with a per-slot model fallback chain and a mock-LLM interception for tests. |
| Batch / API / Admin | Next.js App Router route handlers. `[VERSION-SENSITIVE]` — on Pages Router these become API routes; the batch trigger is fire-and-forget within the server process. |
| Frontend | React components reading the API via hooks; insights are markdown rendered to HTML. |
| Configuration | Environment variables (see §8) + a runtime threshold table (Domain Pack). |

## 6. The documentation map (locked)

Build order is the numeric order. Each document's verification checkpoint must pass before the next is started.

| # | Document | Class | Enables (what you can build after it) | Depends on |
|---|---|---|---|---|
| 00 | Overview & Spine | Spine | The model, build order, config surface | — |
| 01 | Storage | Engine | The engine-owned datastore + the read contract on source data | 00 |
| 02 | Domain catalog & thresholds | Domain Pack | The page/section/component catalog + threshold registry, token dictionary, renderer | 00, 01 |
| 03 | Model provider | Engine | A model-call boundary with fallback + mock interception | 00 |
| 04 | Insight generation & prompts | Domain Pack | Per-section generation: data fetch, prompt assembly, token rendering, numeric guard, summary pass | 00–03 |
| 04a | Prompt Catalog | Domain Pack | The verbatim system prompts + one entry per section/component (template, rendered example, output shape) | 00, 02, 04 |
| 05 | Batch orchestration | Engine | One-at-a-time batch runner with lifecycle + progress | 00, 01, 04 |
| 06 | API | Engine | Read endpoints for section/component insight | 00, 01 |
| 07 | Frontend | Engine | Read-only panel + component dialog | 00, 06 |
| 08 | Admin | Engine | Batch trigger/status surface + threshold config UI | 00, 05, 02 |
| 09 | End-to-end walkthrough | Spine | A full verified run, trigger → rendered insight | 00–08 |
| 10 | Adding a domain pack | Spine | A second domain on the same Engine, using Finance as the worked example | 00–09 |
| 11 | Validation & tuning | Spine | Quality-acceptance gate, rubric, iteration procedure, three canonical tuning patterns | 00, 02, 04, 04a, 05, 08, 09 |
| 12 | Finance domain config (Budget Setting + Variance KPI) | Domain Pack | Operator-edited budget table + KPI badge surface that feeds AI Insight's `financial_variance` section | 00, 01, 02, 04, 04a, 08 |

**Dependency chain (critical path):** `00 → 01 → 02 → 03 → 04 → 05`, with `06 → 07` and `08` joining once `05`/`02` exist; `09` verifies the whole; `10` generalises it. `04a` (Prompt Catalog) is a reference companion to `04`: it hangs off `04` (assembly mechanism) and `02` (token values) and is read alongside `04`, not a separate critical-path step.

`11` (Validation & tuning) and `12` (Finance domain config) are off-critical-path docs read **after** the engine is built. `11` is a quality contract — the rubric and iteration procedure used to decide whether a section is shippable; consult it once `09` runs end-to-end. `12` is a Domain Pack settings surface — the Budget Setting CRUD and Variance KPI badge feature that exists in this sandbox but is **not yet in production**; consult it when porting that feature.

## 7. The per-document template

Every layer document `01`–`10` follows the same eight-part structure (skeleton in `_TEMPLATE.md`). `04a` is the one exception: it is a reference *companion* to `04`, not a layer of its own, so it uses a catalog structure (master index + a fixed-schema entry per section/component) rather than the eight-part template.

1. **Purpose** — the layer's single responsibility and what you can build after reading it.
2. **Prerequisites** — exact prior docs and contracts required first.
3. **Concept & Contract** — *stack-neutral and domain-neutral*: inputs, outputs, invariants, boundary. Re-implementable on another stack from this section alone.
4. **Data contracts** — every shape crossing the boundary; owned vs consumed.
5. **Behavior & flow** — concrete, stack-true runtime behavior; stack/version assumptions flagged `[VERSION-SENSITIVE]`.
6. **Rules & edge cases** — every guard, failure mode, concurrency/idempotency/auth/timeout rule, with trigger → required behavior → why.
7. **Reference Implementation** — file paths + exported symbols as traceability, with key code shapes inline so the doc stands alone.
8. **Verification checkpoint** — a runnable acceptance check; passing it with no source access is the layer's Definition of Done.

**Style rules (binding on every document):**

- §3 is the concept spine — no framework or finance terms. Everything from §5 on is stack-true build instruction.
- Flag every stack/version-sensitive instruction with `[VERSION-SENSITIVE]` and state the exact assumption.
- **No process metadata.** No "Build N", "Session N", dates, author notes, audit sections, or rewrite history anywhere in a finished document. The reader is a production team rebuilding the feature; they need spec, not project history.
- A document must stand alone. Source file paths are evidence for the spec above them, never a replacement for it.

## 8. Configuration / ENV matrix (single source of truth)

Every environment variable the engine reads, with default and owning layer. Each owning layer's document repeats the rows it owns; this table is authoritative. Names verified against source.

| Variable | Default | Owner | Purpose |
|---|---|---|---|
| `DATABASE_URL` | — (required) | 01 | Connection string for the local Postgres pool. Holds engine-owned tables and, in the Finance reference, the local `pc_*`/budget/app-setting projections. Pool max 20. |
| `RDS_DATABASE_URL` | — (required for drill-down tools) | 01 | Connection string for the read-only drill-down/source-query pool. Pool max 5; queries fall back to empty on failure. |
| `OPENROUTER_API_KEY` | `''` | 03 | Auth token for the OpenRouter gateway. Empty ⇒ live calls fail; use the mock toggle for offline work. |
| `AI_INSIGHT_OPENROUTER_TIMEOUT_MS` | `45000` | 03 | Per-request HTTP timeout for model calls. |
| `AI_INSIGHT_OPENROUTER_COMPONENT_MODEL` | `deepseek/deepseek-v4-flash` | 03 | Primary model for per-component analyses. |
| `AI_INSIGHT_OPENROUTER_SUMMARY_MODEL` | `deepseek/deepseek-v4-pro` | 03 | Primary model for the section summary pass. |
| `AI_INSIGHT_OPENROUTER_COMPONENT_FALLBACK_MODEL` | `deepseek/deepseek-v4-pro` | 03 | Fallback model when the component model/provider chain fails. |
| `AI_INSIGHT_OPENROUTER_SUMMARY_FALLBACK_MODELS` | `z-ai/glm-5.1` | 03 | Comma-separated ordered fallback models for the summary pass. |
| `AI_INSIGHT_MOCK_LLM` | unset | 03 | When set, intercepts before any network call and returns deterministic mock output. A "bad" value drives the parser-fallback path for tests. |
| `AI_INSIGHT_LOG_PROMPTS` | `false` | 03 | When `true`, logs full prompts. **Captures source financial data — must not default on in production.** Behavior/redaction specced in doc 03. |
| `AI_INSIGHT_DEBUG_FILE` | unset | 04 | When enabled, writes a per-session debug log of the generation pipeline. |
| `AI_INSIGHT_BATCH_DELAY_MS` | `5000` | 05 | Delay inserted between sections within a batch (rate/cost smoothing). |
| `AI_INSIGHT_BATCH_STALE_MIN` | `40` | 05 | Minutes after which a still-`running` batch is treated as stale and reclaimed. |
| `AI_INSIGHT_THRESHOLDS_USE_DEFAULTS` | unset | 02 | When set, the threshold renderer uses hardcoded defaults instead of the DB table (dev/test). |
| `AI_INSIGHT_THRESHOLD_TEST_OVERRIDES` | unset | 02 | JSON map of threshold overrides for tests. |
| `NODE_ENV` | — | 02 | Standard env flag; `test` alters threshold-resolution behavior. |

## 9. The data-domain contract (stack-neutral)

The engine assumes a **writable engine store** plus **read-only source data contracts** and must never conflate ownership:

- **Engine-owned store (writable):** holds the engine's own tables. The engine has full schema authority over these tables. Specified completely in doc 01.
- **Source-of-truth projections (read-only, not owned):** the domain's operational/financial data the engine reads to build insights. In the Finance reference, many of these projections are physically co-located in the local Postgres database (`pc_*`, budget, app settings), but they are still logically external to AI Insight: the engine reads them and does not own their schema.
- **Drill-down/source port (read-only, fail-soft):** optional deeper queries via `RDS_DATABASE_URL`. Failures degrade to an empty result instead of crashing the insight pipeline.

This separation is what lets the same Engine power a different domain: swap the Domain Pack and point the read contract at a different source.

## 10. Glossary

Defined inline in §3 (Page, Section, Component, Scope, Insight, Batch run, Threshold token, Domain Pack). Every other document uses these terms exactly as defined here; if a document needs a new term it defines it in its own §3 and does not redefine these.
