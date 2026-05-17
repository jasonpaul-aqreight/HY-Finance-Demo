# 07 — Frontend

> **Classification:** Engine
> **Enables:** The read-only insight panel and per-component dialog.
> **Read after:** 00, 06

---

## 1. Purpose

This layer is the **end-user read surface**. It renders persisted insight and nothing else: it never triggers generation, never writes, and holds no business logic. It contributes two consumer surfaces — a *section panel* (a collapsible block on a dashboard screen showing a section's positive/negative highlights, each expandable to full narrative) and a *component dialog* (a modal showing one component's analysis) — plus the shared client machinery they need: a section-insight read hook, a markdown-to-HTML renderer, and a read-only batch-status poll hook whose operator UI belongs to doc 08. After this document you can build the entire user-facing read experience over the doc 06 API, with a precise state model for every loading/empty/present/error condition.

## 2. Prerequisites

- **Doc 00** — vocabulary (Page, Section, Component, Insight); invariant 1 (*end users never trigger generation; they only read*); the Engine/Domain split in §4 (this layer is **Engine** — the shell is generic over whatever Domain Pack supplies; the page/section/component identifiers it is mounted with, and any static component explainer fallback, are Domain Pack data it treats as opaque).
- **Doc 06** — the two read endpoints and their exact envelopes: section `GET` (`200 {exists:true, …, provider_metadata}` or `404 {exists:false}`) and component `GET` (always `200`, `{exists, componentInfo, …}`). This layer **consumes** them and adds only presentation. The asymmetry (missing section ⇒ 404; missing component analysis ⇒ 200 with `exists:false`) drives two different empty states here.
- **Doc 04 / 02** (Domain Pack, consumed as shapes only) — `SummaryJson` (`good[]`, `bad[]`) and `SummaryInsight` (`title`, `metric?`, `summary?`, `detail`); `ComponentInfo` (`name`, `whatItMeasures`, `formula?`, `indicator?`, `about?`). This layer reads these shapes but owns none of them and hardcodes none of their finance content.
- **External dependencies by role:** a component UI framework with local state + effects + a fetch primitive; a modal/dialog primitive; a GFM-capable markdown→sanitised-HTML renderer; a stale-while-revalidate polling hook for batch status. Version specifics are flagged inline.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the read surface as an idea.*

The layer is a **pure projection of stored insight into two view surfaces, driven entirely by read state**.

**Inputs**

- A *section view request*: a `(page, sectionKey)` pair the host screen mounts the panel with.
- A *component view request*: a `(sectionKey, componentKey)` pair, raised when the user opens a component's analysis.
- The two read responses from the API layer (doc 06).

**Outputs / guarantees**

- A faithful render of the persisted section insight: a scope/last-updated line, and two bounded lists (positive, negative), each item expandable to its full narrative.
- A faithful render of a single component's persisted analysis, with its explainer name as the title.
- Every surface resolves to **exactly one** of four observable states — *absent*, *loading*, *present*, *error* — and never an ambiguous blank.

**Invariants (must never be violated)**

1. **Read-only.** No user action on this layer generates, writes, or mutates anything (doc 00 invariant 1). The only network calls are the two doc 06 reads and the doc 08 status poll.
2. **Absence is a designed state, not a failure.** "No insight generated yet" is a normal, explicitly worded screen, visually distinct from an error.
3. **The two absences differ by contract.** A missing *section* (404) and a missing *component analysis* (200 + `exists:false`) are both normal "not generated yet" states, surfaced with their own copy — never an error.
4. **Domain-blind.** The shell renders whatever the Domain Pack catalog/prompts produced; it embeds no domain vocabulary, thresholds, or page list of its own.
5. **Stale-safe.** A change of `(page,sectionKey)` or `(sectionKey,componentKey)` while a fetch is in flight must not let an older response overwrite a newer view.

**Boundary with adjacent layers**

- *Down:* the doc 06 read API (section + component); the doc 08 status route (observation only — the trigger/operator UI is doc 08, not here).
- *Up:* the host dashboard screen, which mounts the section panel per section and a component-dialog opener per component. The host supplies identifiers only; it injects no insight content.

A reader can re-implement this layer on any component+fetch UI stack from this section alone.

### 3.1 Stack-neutral wireframes

**Section panel (collapsed header → expanded body):**

```
┌───────────────────────────────────────────────────────────────┐
│  «Section title»   «subtitle»                  [ Get Insight ▾ ]│  ← header bar (toggle)
├───────────────────────────────────────────────────────────────┤
│  Analysis: «scope»                  Last Updated: «timestamp»   │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐  │
│  │ POSITIVE                    │  │ NEGATIVE                │  │
│  │ ● «title»        [metric]   │  │ ● «title»     [metric]  │  │
│  │   «one-line summary…»       │  │   «one-line summary…»   │  │  ≤ 3 cards each
│  │ ● «title»                   │  │ ● «title»               │  │
│  └─────────────────────────────┘  └─────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
        (a card click opens →)        ┌───────────────────────────┐
                                      │ 👍/👎  «card title»        │  ← detail modal
                                      │  «full markdown narrative» │
                                      └───────────────────────────┘
```

**Component dialog (opened from a small per-component icon):**

```
[🔍]  ← per-component opener icon, mounted next to a KPI/chart/table

┌──────────────────────────────────────────────┐
│  «componentInfo.name»                          │  ← branded header bar
├──────────────────────────────────────────────┤
│  ⌬ AI Analysis            Last Updated: «ts»   │
│  «full markdown analysis of this component»    │
└──────────────────────────────────────────────┘
```

### 3.2 The four-state model (every surface)

| State | Section panel | Component dialog |
|---|---|---|
| **absent** | API 404 ⇒ "No insights generated yet. / Generated by the admin AI Insight batch." | API `exists:false` *or* no `analysis_md` ⇒ "No analysis available yet. Generated by the admin AI Insight batch." |
| **loading** | fetch in flight ⇒ spinner + "Loading…" | request key not yet matched ⇒ spinner + "Loading analysis…" |
| **present** | `exists:true` ⇒ scope/updated line + positive/negative lists | `exists:true` + `analysis_md` ⇒ rendered markdown + last-updated |
| **error** | non-OK / thrown ⇒ inline error text | fetch rejected ⇒ falls to *absent* copy (dialog has no distinct error state) |

The component dialog deliberately collapses *error* into *absent*: a failed component read shows the same "not generated yet" copy, because the user-facing distinction adds no value at that grain (the section panel, the primary surface, does surface errors explicitly).

## 4. Data contracts

All shapes here are **consumed**; this layer owns only ephemeral view state (which card is selected, whether the panel is expanded, the in-flight request key).

### 4.1 Consumed — section read (from doc 06 §4.1, projected client-side)

```
SectionInsightData = {
  section_id:       number
  summary_json:     SummaryJson           // doc 04
  analysis_time_s:  number
  token_count:      number
  cost_usd:         number
  date_range_start: string | null         // calendar scope
  date_range_end:   string | null
  fiscal_year:      string | null         // fiscal scope
  fiscal_range:     string | null
  generated_by:     string
  generated_at:     string                // ISO; rendered via locale
  provider_metadata?: AiProviderMetadata | null   // lifted by doc 06; unused by render
}
```

The hook treats `404` as the *absent* signal and `200 {exists:true}` as *present*; it does not surface `provider_metadata` in the UI (it is carried for completeness only).

### 4.2 Consumed — summary payload (owned by doc 04)

```
SummaryJson    = { good: SummaryInsight[], bad: SummaryInsight[], numericGuard?, providerMeta? }
SummaryInsight = { title: string, metric?: string, summary?: string, detail: string }
```

The panel reads **exactly** these four `SummaryInsight` fields: `title` (card heading), `metric` (optional badge), `summary` (the collapsed one-liner), `detail` (markdown shown in the detail modal). It uses at most the first **3** of `good` and the first **3** of `bad`. `numericGuard`/`providerMeta` are not rendered.

### 4.3 Consumed — component read (from doc 06 §4.2)

```
{ exists?: boolean,
  analysis_md?: string,        // markdown narrative for this component
  generated_at?: string,
  componentInfo?: ComponentInfo | null }   // doc 02/04
ComponentInfo = { name, whatItMeasures, formula?, indicator?, about? }
```

The dialog reads only `componentInfo.name` (for the title), `analysis_md`, `generated_at`, and `exists`. The remaining `ComponentInfo` fields are opaque to the Engine; the Domain Pack may also ship a **static fallback map** (`componentKey → ComponentInfo`) used only to title the dialog before/instead of the API value — that map is Domain Pack data, not Engine.

### 4.4 Consumed — batch status (from doc 08 §4.1)

`useBatchStatus` reads the doc 08 status route and returns `BatchRunStatus` (the normalised `BatchRun` of doc 01 / idle fallback). This layer owns the **shared poll key** and the **cadence contract** only; the operator UI that consumes it is doc 08.

## 5. Behavior & flow

> Stack-true. `[VERSION-SENSITIVE]` flags mark assumptions a different stack must adapt.

`[VERSION-SENSITIVE]` — the reference realisation is React client components (`'use client'`) under Next.js App Router, `react-markdown@10` (`MarkdownHooks`) + `remark-gfm@4`, `swr@2`, a Radix-based dialog, and `lucide-react` icons. On any other stack the contracts in §3–§4 and the state model in §3.2 are unchanged; only the primitives differ (any local-state component model, any modal, any GFM→sanitised-HTML renderer, any SWR-equivalent poll).

### 5.1 Section read hook

`useInsightAnalysis(page, sectionKey)` owns the section panel's state machine. Status enum: `idle | loading | complete | error`.

1. On mount (and whenever `(page, sectionKey)` changes) set `loading`, clear error, then `GET /api/ai-insight/section/{sectionKey}?page={page}` (page URL-encoded).
2. `404` ⇒ `data = null`, status `idle` (the *absent* state — **not** an error; doc 06 rule 1 / invariant 3 here).
3. `200` and body `exists:true` ⇒ `data = body`, status `complete`.
4. Response not OK (and not 404) ⇒ throw ⇒ status `error`, message "Failed to load saved insight".
5. Any thrown/network error ⇒ status `error`.
6. The hook returns `{ status, data, error, refetch }`. `refetch` re-runs step 1; no other layer triggers it implicitly (read-only — invariant 1).

### 5.2 Section header + panel

- `InsightSectionHeader(title, subtitle, page, sectionKey, …deprecated)` renders the header bar with a **Get Insight** toggle (default **expanded**). It calls `useInsightAnalysis(page, sectionKey)` and, while expanded, renders the panel with `{status, data, error}`. `[VERSION-SENSITIVE]` it also accepts deprecated `dateRange/fiscalPeriod/userName` props for call-site stability; these are **not** part of the read path and a clean rebuild omits them.
- `AiInsightPanel(status, data, error)` renders exactly one state (§3.2):
  - `idle && !data` → the *absent* message.
  - `loading` → spinner + "Loading…".
  - `complete && data && data.summary_json` → the **scope line** + **last-updated** line, then a two-column grid: *Positive* from `summary_json.good` (first 3), *Negative* from `summary_json.bad` (first 3). An empty side shows "No positive highlights found." / "No concerns found.".
  - `error` → inline error text (`error` || "Analysis failed").
- **Scope line derivation** (first match wins): if `date_range_start && date_range_end` → `"{localeDate(start)} – {localeDate(end)}"`; else if `fiscal_year && fiscal_range` → `"{fiscal_year} - {UPPER(fiscal_range)}"`; else → `"Current State"`. **Last updated** = locale string of `generated_at`.
- **Insight card** (one per `SummaryInsight`): a sentiment dot (green=good / red=bad), the `title` (truncated, full text on hover), an optional `metric` badge, and a one-line preview: `summary` if present, else a markdown-stripped first sentence of `detail` (strip `**Header** (scope):` and `**Header:**` patterns, collapse whitespace, take the first sentence or first 120 chars). Clicking a card opens the detail modal for that item.

### 5.3 Insight detail modal

Opened from a card. Header banner is **green** for good / **red** for bad, prefixed 👍/👎, showing the card `title`; body renders `detail` through the markdown renderer (§5.5). Closing clears the selection; nothing is fetched or written.

### 5.4 Component dialog

`ComponentInsightDialog(open, onClose, sectionKey, componentKey)` is self-fetching:

1. Define `requestKey = "{sectionKey}/{componentKey}"`. Treat the view as **loading** while `open` and the stored data's `requestKey` ≠ the current `requestKey` (this makes a key change re-enter loading without a flash of stale content — invariant 5).
2. On `open` (and on identifier change) `GET /api/ai-insight/component/{sectionKey}/{componentKey}`; on OK store `{…body, requestKey}`, on non-OK store `{exists:false, requestKey}`, on reject store `{exists:false, requestKey}`. A cleanup flag discards a resolved response if the effect was torn down first (invariant 5).
3. Title = `info?.name || componentKey`, where `info = (!loading ? fetched.componentInfo : null) ?? STATIC_FALLBACK[componentKey]` — the API value once loaded, otherwise the Domain Pack static fallback, otherwise the raw key.
4. Body: an "AI Analysis" label; the last-updated time when present and not loading; a spinner while loading; the rendered `analysis_md` when `exists !== false` and `analysis_md` is non-empty; otherwise the *absent* copy "No analysis available yet. Generated by the admin AI Insight batch." (this absorbs the error case — §3.2).

`AnalyzeIcon(sectionKey, componentKey)` is the Engine's per-component entry point: a small ghost icon button ("View AI insight") the host mounts next to a KPI/chart/table; it owns the open/close state and renders the dialog. The host passes identifiers only.

### 5.5 Markdown renderer

A single shared renderer converts insight markdown to sanitised HTML with **GFM** enabled (tables, lists). Element styling is centralised; one structural convention is contractual: **a paragraph whose only child is a bold run ending in `:` is rendered as an underlined section subtitle** (the generation prompts emit headings in that form — doc 04). Both the detail modal and the component dialog use this one renderer so narrative formatting is identical everywhere.

### 5.6 Batch-status poll hook

`useBatchStatus(isRunning?)` is a stale-while-revalidate read of the doc 08 status route under a **shared cache key** so every observer (and the operator card in doc 08) coalesces onto one poll. Cadence contract: **2000 ms while running, 10000 ms otherwise**. The fetcher throws on a non-OK response (surfaced as the hook's error). This hook performs **no** mutation; the trigger and the operator card are doc 08.

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Section API returns `404` | Panel shows *absent* copy, status `idle` — **not** error | Invariant 2/3; doc 06 rule 1 — "not generated yet" is normal. |
| 2 | Section API not OK (≠404) or network error | Panel shows inline *error* text | Errors must be visible on the primary surface, distinct from absence. |
| 3 | `summary_json.good` / `.bad` empty or absent | Render the per-side empty copy, not a crash | Bounded, null-safe render; a side may legitimately have no items. |
| 4 | More than 3 items on a side | Render only the first 3 | Bounded panel; the modal is the path to full detail. |
| 5 | `SummaryInsight.summary` missing | Derive the one-liner from `detail` (strip markdown, first sentence/120 chars) | The collapsed card must never show raw markdown. |
| 6 | Scope fields all null/empty | Scope line = "Current State" | Snapshot-scoped sections have neither date range nor fiscal period (doc 01/05). |
| 7 | Component API `exists:false` or empty `analysis_md` | Dialog shows *absent* copy + the title still renders | Doc 06 invariant 3 — explainer/title is independent of analysis. |
| 8 | Component fetch rejects | Dialog shows the same *absent* copy (no distinct error UI) | §3.2 — error collapses into absent at component grain. |
| 9 | `(page,sectionKey)` or `(sectionKey,componentKey)` changes mid-fetch | Older response must not overwrite the newer view (request-key gate + teardown flag) | Invariant 5 — no stale cross-render. |
| 10 | `componentInfo` null (unknown key) and no static fallback | Title falls back to the raw `componentKey` | Never render an empty title; doc 06 rule 5 returns `null` for unknown keys. |
| 11 | Any user interaction on this layer | Only reads (two doc 06 GETs, one doc 08 status GET) occur — never a write or generate | Invariant 1 — the entire layer is read-only. |
| 12 | Panel collapsed via the toggle | Body unmounts; the hook state persists for the session and re-renders on expand | The toggle is presentation only; it does not refetch or clear data. |

### 6.1 Configuration owned by this layer

None. This layer reads no environment variables. The poll cadence (2 s / 10 s) and the toast auto-dismiss are UI tuning, not configuration, and carry no contract.

### 6.2 Engine / Domain-Pack boundary (explicit)

In scope (Engine, finance-free): the section hook, header, panel, insight card, detail modal, component dialog, per-component opener icon, markdown renderer, batch-status poll hook, and the generic toast primitive. **Out of scope:** any domain-specific *editor* co-located in the same source folder (in the reference app, a budget-baseline editor that writes a `/api/budget` route with hardcoded finance line items) — it is a Domain-Pack/admin **edit** surface, not the Engine read shell, and a different domain ships its own (or none). The Engine read surface never writes.

## 7. Reference Implementation

Source paths are traceability evidence for the spec above — not a substitute for it.

| Path | Symbol | Responsibility |
|---|---|---|
| `hooks/ai-insight/useInsightAnalysis.ts` | `useInsightAnalysis`, `SectionInsightData`, `InsightStatus` | §5.1 — section read state machine; 404⇒idle, ok+exists⇒complete, else error. |
| `components/ai-insight/InsightSectionHeader.tsx` | `InsightSectionHeader` | §5.2 — header bar + Get Insight toggle; hosts the panel. |
| `components/ai-insight/AiInsightPanel.tsx` | `AiInsightPanel`, `InsightCard` | §5.2 — four-state render; scope/updated line; positive/negative grid; card preview derivation. |
| `components/ai-insight/InsightDetailDialog.tsx` | `InsightDetailDialog` | §5.3 — sentiment-coloured modal of one insight's `detail`. |
| `components/ai-insight/AnalyzeIcon.tsx` | `AnalyzeIcon` | §5.4 — per-component opener icon owning dialog open state. |
| `components/ai-insight/ComponentInsightDialog.tsx` | `ComponentInsightDialog` | §5.4 — self-fetching component analysis modal with request-key gate. |
| `components/ai-insight/MarkdownRenderer.tsx` | `MarkdownRenderer` | §5.5 — GFM markdown→HTML; bold-colon-subtitle convention. |
| `components/ai-insight/Toast.tsx` | `Toast` | §6.1 — generic auto-dismiss success toast (used by edit surfaces, doc 08-adjacent). |
| `hooks/ai-insight/useBatchStatus.ts` | `useBatchStatus`, `AI_INSIGHT_BATCH_STATUS_KEY` | §5.6 — shared-key SWR status poll; cadence 2 s/10 s. |
| `lib/ai-insight/types.ts` | `SummaryJson`, `SummaryInsight`, `AiProviderMetadata`, `PageKey`, `SectionKey` | Consumed shapes — owned by doc 01/03/04. |
| `lib/ai-insight/component-info.ts` | `ComponentInfo`, static fallback map | Consumed — Domain Pack (doc 02/04); Engine reads only `.name`. |

**Section hook (key skeleton):**

```ts
const res = await fetch(`/api/ai-insight/section/${sectionKey}?page=${encodeURIComponent(page)}`);
if (res.status === 404) { setData(null); setStatus('idle'); return; }      // absent
if (res.ok) { const j = await res.json(); if (j.exists) { setData(j); setStatus('complete'); return; } }
if (!res.ok) throw new Error('Failed to load saved insight');               // → error
```

**Component dialog request-key gate (key skeleton):**

```ts
const requestKey = `${sectionKey}/${componentKey}`;
const loading = open && componentData?.requestKey !== requestKey;           // re-enter loading on key change
useEffect(() => {
  if (!open) return; let cancelled = false;
  fetch(`/api/ai-insight/component/${sectionKey}/${componentKey}`)
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (!cancelled) setComponentData({ ...(d ?? { exists:false }), requestKey }); })
    .catch(() => { if (!cancelled) setComponentData({ exists:false, requestKey }); });
  return () => { cancelled = true; };
}, [open, sectionKey, componentKey, requestKey]);
const info = (!loading ? componentData?.componentInfo : null) ?? STATIC_FALLBACK[componentKey];
```

**Markdown subtitle convention (key skeleton):**

```ts
// a <p> whose single child is <strong> whose text ends with ':' → render as an underlined subtitle
const isSubtitle = onlyChildIsStrong && strongText.endsWith(':');
```

Rendered reference screenshots of each state are kept in `assets/` and are reproduced by the doc 09 walkthrough on the live reference stack; the wireframes in §3.1 and the state matrix in §3.2 are the normative description and stand alone without them.

## 8. Verification checkpoint

**Setup (no source access):** implement the surfaces per §3–§6 over the doc 06 API and a doc 04 `SummaryJson` shape. Seed one section insight for `(page='p', section='s')` whose `summary_json` has 4 `good` and 0 `bad`, where one `good` item has no `summary` (only `detail` with a `**Header:**` line) and another has a `metric`; seed a component analysis for one `componentKey` under `s`, and leave a second component of `s` with no analysis row.

**Action & expected observable result:**

1. **Absent → present (section).** Mount the panel for a section with no insight ⇒ *absent* copy, no error. Mount it for `('p','s')` ⇒ scope line + last-updated line; the *Positive* column shows exactly **3** cards (4 seeded, capped); *Negative* shows "No concerns found.".
2. **Card preview derivation.** The `good` item with no `summary` shows a one-line preview with **no** markdown and **no** `**Header:**` text; the item with a `metric` shows the metric badge.
3. **Detail modal.** Click a positive card ⇒ a green-headed modal with 👍 + the title; body renders the `detail` markdown (a `**Header:**`-only paragraph appears as an underlined subtitle, tables render with borders).
4. **Component dialog — present vs absent.** Open the dialog for the component **with** analysis ⇒ branded header titled by `componentInfo.name`, rendered `analysis_md`, a last-updated time. Open it for the component **without** analysis ⇒ same header/title, body shows "No analysis available yet. Generated by the admin AI Insight batch." (status 200, `exists:false` — **not** an error).
5. **Stale-safe.** Open the dialog for component A, immediately switch the opener to component B before A resolves ⇒ the final render is B's content (A's late response is discarded; no flash of A).
6. **Scope fallback.** Re-seed the section with both date and fiscal fields null ⇒ scope line reads exactly "Current State".
7. **Read-only.** Across all of the above, the only network calls are `GET` section, `GET` component, and (if the status hook is mounted) `GET` batch status; engine table row counts are unchanged.

**Definition of Done:** a developer who has read only `00`, `06`, and this document (plus the consumed `SummaryJson`/`ComponentInfo` shapes named in §2), with no access to this repo's source, can build both surfaces and pass all seven checks.
