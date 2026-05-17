# 08 — Admin

> **Classification:** Engine
> **Enables:** The batch trigger/status surface and the threshold configuration UI.
> **Read after:** 00, 05, 02

---

## 1. Purpose

This layer is the **operator's cockpit**. It is the only place a human starts a generation pass and the only place the runtime business numbers are edited. It contributes two surfaces: a *batch surface* (a card that triggers a run and shows its live and last-run status, backed by an admin-gated trigger route and an unauthenticated status route) and a *threshold-configuration surface* (a prompt browser plus an editor that writes the threshold registry the Domain Pack renders from). It owns the admin HTTP envelopes, the authorization gate, and the operator UI; it owns no orchestration, no prompts, and no threshold semantics — those are called. After this document you can build the admin surface that drives doc 05 and edits the doc 02 registry without re-implementing either.

## 2. Prerequisites

- **Doc 00** — vocabulary (Batch run, Threshold token); the Engine/Domain split in §4 (this layer is Engine — the cockpit is generic over whatever Domain Pack supplies); the ENV matrix in §8 (this layer owns no ENV rows).
- **Doc 05** — `runInsightBatch(triggeredBy)` and `isInsightBatchInProcess()`, and the **fire-and-forget invocation contract** (§5.2 there). The trigger route here is the caller that model describes.
- **Doc 01** (already required by doc 05) — `getLatestBatchRun()`, `isBatchRunStale()`, `markStaleRunningBatches()`, and the normalised `BatchRun` shape. The status route projects these; it does not own them. These are reached through the doc 05 prerequisite chain, not a new critical-path dependency (the map in `00` §6 lists this layer's direct deps as 00/05/02).
- **Doc 02** (Domain Pack) — the threshold registry and its services: `buildPromptConfigRows()` (the prompt catalog with thresholds enriched), `getThresholdGroups`, `getThresholdPresentation`, `saveThresholdValues`, `renderThresholdText`, `invalidateThresholdCache`. The editor here is a thin client over these; all validation *semantics* and persistence live in doc 02.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the admin surface as an idea.*

The layer is **two operator surfaces over already-specified machinery: a job console and a configuration editor.**

**Inputs**

- *Batch surface:* an authenticated operator action ("run now"); a periodic status poll (anyone).
- *Config surface:* a request to browse the prompt/threshold catalog; an authenticated operator action ("save these threshold values for this component").

**Outputs / guarantees**

- A trigger either starts exactly one background pass (delegating the single-run guarantee to docs 05/01) or is refused with a precise reason (not authorized / already running).
- A status read always returns a well-typed run state, auto-healing a crashed run on the way (delegating reclamation to doc 01).
- A threshold save is **validated before it is persisted**; an invalid set is rejected with field-level reasons and changes nothing; a valid set is persisted and the rendered prompt the operator sees immediately reflects the new numbers.

**Invariants (must never be violated)**

1. **Mutation is gated; observation is open.** Triggering a run and saving thresholds require the admin role; reading status and previewing prompts do not.
2. **The cockpit guarantees nothing the engine already guarantees.** Single-run exclusivity, stale reclamation, and atomic persistence are *delegated*, never re-implemented here.
3. **No save without validation.** The editor blocks an invalid draft client-side; the server re-validates and is the authority — a client bypass still cannot persist an invalid set.
4. **What you edit is what renders.** After a successful save the prompt preview shows the prompt with the new threshold numbers substituted (the registry cache is invalidated so reads are fresh).

**Boundary with adjacent layers**

- *Down:* doc 05 (run a batch), doc 01 (run-ledger reads), doc 02 (threshold catalog + save).
- *Up:* a human operator; no other layer consumes this one.

A reader can re-implement this surface on any UI + request/response stack from this section alone.

## 4. Data contracts

### 4.1 Owned — admin HTTP envelopes

**`POST` batch trigger** — admin only:

| Case | Status | Body |
|---|---|---|
| Started | 200 | `{ started: true, sections_total }` |
| Not admin | 403 | `{ error: 'Admin role required' }` |
| Already running | 409 | `{ error: 'Batch already running' }` |
| Unexpected | 500 | `{ error: <message> }` |

Request body (optional): `{ triggeredBy?: string }`. Resolution order for the run's identity: `body.triggeredBy` (trimmed, non-empty) → `x-user-name` header → `'admin'`.

**`GET` batch status** — unauthenticated; returns the normalised `BatchRun` (doc 01) or, when no run has ever existed, the idle fallback `{ status:'idle', sections_total, sections_completed:0, sections_failed:0, section_errors:[] }`.

**`GET` prompt-config** — returns `{ prompts: PromptConfigRow[], thresholdGroups: ThresholdGroupView[] }` (the full catalog; `thresholdGroups` is the flattened union across prompts). Threshold cache is invalidated before building so values are fresh; response is `no-store`.

**`GET` thresholds** — query `?componentKey=` (required; 400 if missing) → `{ componentKey, thresholdGroups, thresholdPresentation }`.

**`PUT` thresholds** — admin only:

| Case | Status | Body |
|---|---|---|
| Saved | 200 | `{ ok:true, componentKey, prompt, thresholdGroups, thresholdPresentation }` |
| Not admin | 403 | `{ error:'Admin role required' }` |
| Bad input | 400 | `{ error:'componentKey is required' }` / `{ error:'values must be an object keyed by token' }` |
| Invalid values | 400 | `{ error:'Invalid threshold values', details: string[] }` |

Request body: `{ componentKey: string, values: Record<token, number>, updatedBy?: string }`.

All admin routes are dynamic/uncached (`force-dynamic`, `Cache-Control: no-store`).

### 4.2 Owned — view contracts (API ↔ UI)

The batch surface consumes the `BatchRun` shape (doc 01) via a polling key constant. The config surface consumes `PromptConfigRow` (one per system/component prompt: `promptKey, promptText, renderedPromptText, category('system'|'component'), page, sectionKey, sectionName, componentType, displayName, sortOrder, thresholdGroups, thresholdPresentation`) and the threshold view types (`ThresholdGroupView` → `ThresholdTokenView[]`; `ThresholdComponentPresentationView` → `ThresholdBusinessRuleView[]` → settings/ranges/validationConstraints). These view types are the **boundary schema between doc 02's registry and this UI**; their semantics (units, value types, ranges, constraints) are owned by doc 02 — this layer only renders and edits them.

### 4.3 Consumed

| Contract | Owner |
|---|---|
| `runInsightBatch`, `isInsightBatchInProcess`, the catalog length (`sections_total`) | 05 |
| `getLatestBatchRun`, `isBatchRunStale`, `markStaleRunningBatches`, `BatchRun` | 01 |
| `buildPromptConfigRows`, `getThresholdGroups`, `getThresholdPresentation`, `saveThresholdValues`, `renderThresholdText`, `invalidateThresholdCache`, all `Threshold*View` types | 02 |

This layer owns no persisted schema and no ENV rows.

## 5. Behavior & flow

> Stack-true. `[VERSION-SENSITIVE]` flags mark assumptions a different stack must adapt.

### 5.1 The authorization gate

A request is treated as admin iff the header `x-user-role === 'admin'`. The trigger `POST` and the thresholds `PUT` enforce it (403 otherwise); status/config/threshold `GET`s do not.

`[VERSION-SENSITIVE]` — this is a **sandbox stand-in** for a real superadmin write role: the reference app sets the header from a client-side role provider, so it is spoofable. A production rebuild must replace the header check with genuine authentication/authorization at these two write routes; the *contract* (admin-only mutation, open observation) is what must survive, not the mechanism.

### 5.2 Batch trigger route (`POST`)

1. Reject non-admin ⇒ `403`.
2. Pre-check A: `isInsightBatchInProcess()` (doc 05, cheap in-process) true ⇒ `409`.
3. Pre-check B: `getLatestBatchRun()` (doc 01); if its status is `running` **and not stale** ⇒ `409`. (A stale `running` row does *not* block — doc 05/01 will reclaim it.)
4. Resolve `triggeredBy` (§4.1).
5. **Fire-and-forget:** call `runInsightBatch(triggeredBy)` *without awaiting*; attach a `.catch` that logs. Respond immediately `200 { started:true, sections_total }`. The run proceeds in the background per doc 05 §5.2.
6. Any thrown error in 1–5 ⇒ `500 { error }`.

The two pre-checks are an optimisation for a fast, friendly `409`; they are **not** the single-run guarantee — that is the datastore constraint inside `createBatchRun` (doc 01), which still holds under a race.

### 5.3 Batch status route (`GET`)

1. `latest = getLatestBatchRun()`.
2. If `latest` is `running` **and** stale ⇒ `markStaleRunningBatches()` then re-read `latest` (self-healing a crashed run on observation).
3. Respond `latest` or the idle fallback (§4.1).

### 5.4 Batch card (operator UI)

A card that polls the status route via a shared cache key (`'/api/admin/ai-insight/batch/status'`) on an interval of **2000 ms while running, 10000 ms otherwise**. Behavior:

- **Trigger button** — disabled when: not admin, a run is in progress, the request is in flight, or an optimistic *start-pending* window is open. On click it `POST`s the trigger with `x-user-role` + `{ triggeredBy: role }`, then revalidates the status key. Status→message mapping: `200`→"AI Insight batch started" + open a ≤4 s start-pending window (cleared early once status flips to `running`); `403`→"Admin role required"; `409`→"Batch already running"; other→the error text; network failure→a service-unreachable message.
- **Non-admin** — a warning banner; the button is disabled.
- **Running state** — progress bar = `sections_completed / sections_total`, current section, elapsed time, cost-so-far, tokens-so-far.
- **Last-run state** — terminal status badge, completion time, runtime, `completed/total + failed`, actual cost/tokens, a run-level `error_message` if any, and an itemised `section_errors` list.
- **Never-run state** — an explicit "no batch has been run yet" message.
- **Estimate** — a rough pre-run "~$cost, ~N min for K sections" line from local constants (display-only; not a contract).

### 5.5 Threshold-config dashboard (operator UI)

Hosted at an admin route reachable from the app's admin navigation. It `GET`s the prompt-config endpoint (SWR, no-store) and lays out:

- **Prompt tree (left).** Two roots: *System Prompt* (per-domain leaves, e.g. Component Analysis / Summary Analysis) and *User Prompt* → page → section → component leaves. A search box matches name, key, page, section, and threshold text. Default selection prioritises a prompt that has presentation metadata, then any with threshold groups, then a system prompt, then the first row.
- **Breadcrumb** of the selected prompt's path.
- **Configuration panel.** For a component prompt with client-ready presentation: render the business rules — each rule's editable threshold inputs inline in human-readable range sentences. Live client-side validation (§5.6). *Save* is enabled only when the draft is dirty, valid, the prompt is client-ready, and the user is admin; *Reset* reverts the draft. Read-only states: a system prompt ("AI instruction is read-only"); a component with no threshold groups ("no business threshold settings"); groups present but no presentation ("not client-ready yet"). Non-admin sees a banner and disabled inputs.
- **Prompt preview.** Shows the **rendered** prompt text (threshold tokens already substituted) for the selected prompt; empty-state when blank.

On a successful save the dashboard patches the selected prompt in place from the `PUT` response and shows a confirmation toast; because the config `GET` invalidates the threshold cache and the `PUT` returns a freshly built prompt, the preview reflects the new numbers without a full reload (invariant 4).

### 5.6 Save validation (client mirror of doc 02's authority)

Before enabling *Save* the editor validates the draft, and the server re-validates on `PUT` (doc 02 `saveThresholdValues` is the authority). Checks: numeric & finite; integer when the token's value type is integer; ≤ 100 when a percentage with a non-negative floor; within `[min, max]`; **monotonic ordering** within a group per its direction (ascending ⇒ each token greater than the next; descending ⇒ less than), unless the group opts out; plus any explicit cross-token `validationConstraints` from the presentation. Field-level errors annotate the offending inputs; a form-level message lists ordering/constraint failures. An invalid draft cannot be saved from the UI, and a hand-crafted invalid `PUT` is rejected `400 { error:'Invalid threshold values', details }` and persists nothing.

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Non-admin calls trigger or thresholds `PUT` | `403`; nothing happens | Invariant 1 — mutation is gated. |
| 2 | Non-admin reads status / config / thresholds `GET` | Served normally | Invariant 1 — observation is open. |
| 3 | Trigger while a run is genuinely in progress | `409 Batch already running` (in-process pre-check, then non-stale latest-run pre-check) | Friendly fast refusal; the hard guarantee is still doc 01's index. |
| 4 | Trigger while the latest `running` row is **stale** | Proceed — reclamation (doc 01, via doc 05) force-fails the dead row first | A crashed run must not permanently block the operator. |
| 5 | Status read finds a stale `running` row | Reclaim, then return the healed state | Observation self-heals; the card never shows a forever-"running". |
| 6 | No run has ever executed | Status returns the idle fallback shape | The card renders a stable "never run" state, not an error. |
| 7 | `componentKey` missing on thresholds `GET`/`PUT` | `400 componentKey is required` | A token write must target a component. |
| 8 | `values` not a plain object | `400 values must be an object keyed by token` | Defensive input typing before doc 02 sees it. |
| 9 | Submitted threshold values fail validation | `400 { error:'Invalid threshold values', details }`; registry unchanged | Invariant 3 — server is the validation authority. |
| 10 | Successful save | Cache invalidated; `PUT` returns rebuilt prompt + groups + presentation; UI patches in place + toast | Invariant 4 — edited numbers render immediately. |
| 11 | System prompt or threshold-less component selected | Editor shows the matching read-only state; no save path | These have no configurable numbers. |
| 12 | All admin routes | `force-dynamic` + `no-store` | Operator data must never be served stale from a cache. |
| 13 | Background run continues after the trigger response | Expected (doc 05 §5.2); the card observes it via polling | The trigger is fire-and-forget by contract. |

### 6.1 Configuration owned by this layer

None. The poll cadence (2 s/10 s), the start-pending window (≤4 s), and the cost/time estimate constants are UI tuning, not configuration — they carry no contract and read no environment.

## 7. Reference Implementation

Source paths are traceability evidence for the spec above — not a substitute for it.

| Path | Symbol | Responsibility |
|---|---|---|
| `app/api/admin/ai-insight/batch/trigger/route.ts` | `POST` | §5.2 — admin gate, two pre-checks, fire-and-forget `runInsightBatch`. |
| `app/api/admin/ai-insight/batch/status/route.ts` | `GET` | §5.3 — latest run, stale self-heal, idle fallback. |
| `app/api/admin/ai-insight-config/route.ts` | `GET` | §4.1 — `buildPromptConfigRows` + flattened groups; invalidates threshold cache. |
| `app/api/admin/ai-insight-thresholds/route.ts` | `GET`,`PUT` | §5.6 — read groups/presentation; admin-gated validated save (`saveThresholdValues`). |
| `hooks/ai-insight/useBatchStatus.ts` | `useBatchStatus`, `AI_INSIGHT_BATCH_STATUS_KEY` | §5.4 — the shared polling key + cadence. |
| `components/admin/sync/AiInsightBatchCard.tsx` | `AiInsightBatchCard` | §5.4 — the batch card states + trigger handler. |
| `app/admin/ai-insight-config/page.tsx` | `AiInsightConfigPage` | Hosts the dashboard behind the admin nav. |
| `components/admin/ai-insight-config/PromptConfigDashboard.tsx` | `PromptConfigDashboard` | §5.5 — data load, layout, selection, save patching + toast. |
| `…/PromptTree.tsx`, `…/BreadcrumbBar.tsx`, `…/PromptTextPanel.tsx`, `…/ConfigurationPanel.tsx` | — | Tree/search, path, rendered-prompt preview, the validated editor (§5.6). |
| `lib/ai-insight/prompt-config.ts` | (doc 02-adjacent) `buildPromptConfigRows` | The catalog builder — **consumed**; threshold semantics owned by doc 02. |

**Trigger route shape (key skeleton):**

```ts
export const dynamic = 'force-dynamic';
const isAdmin = (req) => req.headers.get('x-user-role') === 'admin';

export async function POST(req) {
  if (!isAdmin(req)) return json({ error: 'Admin role required' }, 403);
  if (isInsightBatchInProcess()) return json({ error: 'Batch already running' }, 409);
  const latest = await getLatestBatchRun();
  if (latest?.status === 'running' && !isBatchRunStale(latest))
    return json({ error: 'Batch already running' }, 409);
  const body = await req.json().catch(() => ({}));
  const triggeredBy = (body?.triggeredBy?.trim()) || req.headers.get('x-user-name') || 'admin';
  runInsightBatch(triggeredBy).catch((e) => console.error('AI Insight batch failed:', e));
  return json({ started: true, sections_total: CATALOG.length });
}
```

## 8. Verification checkpoint

**Setup (no source access):** implement the four routes and the two UI surfaces per §3–§6 over docs 05/01/02. Use the doc 03 mock so a triggered run completes offline. Have a Domain Pack with at least one component carrying configurable thresholds with a presentation and a min/max.

**Action & expected observable result:**

1. **Admin trigger.** As admin, `POST` trigger ⇒ `200 { started:true, sections_total }`; status route then shows `running`, then a terminal state; the card mirrors this (progress → last-run).
2. **Double trigger.** `POST` again while running ⇒ `409 Batch already running`; no second ledger row.
3. **Non-admin.** Without the admin header: trigger ⇒ `403`; status `GET` ⇒ served normally; the card disables the button and shows the banner.
4. **Stale heal.** Leave a `running` row with an old `started_at` and `AI_INSIGHT_BATCH_STALE_MIN=0`; `GET` status ⇒ the row is reclaimed (`error`) and the response is the healed state; a subsequent trigger proceeds.
5. **Config browse.** `GET` config ⇒ `prompts` includes system + component rows; the tree renders them; selecting a prompt shows its rendered preview.
6. **Invalid save blocked.** Edit a threshold out of `[min,max]` ⇒ inline error, Save disabled; a forced `PUT` with that value ⇒ `400 { error:'Invalid threshold values', details }`; reading the component again shows the *old* value (nothing persisted).
7. **Valid save renders.** Set a valid in-range value, Save ⇒ `200 { ok:true }`, toast shown, and the prompt preview now shows the new number substituted (no full reload). A non-admin `PUT` ⇒ `403`.

**Definition of Done:** a developer who has read only `00`, `05`, `02`, `01`, and this document, with no access to this repo's source, can build the admin surface and pass all seven checks.
