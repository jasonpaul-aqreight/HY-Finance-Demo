# 06 — API

> **Classification:** Engine
> **Enables:** Read-only endpoints serving section and component insight.
> **Read after:** 00, 01

---

## 1. Purpose

This layer is the **read boundary** between the persisted insight store and any client. It exposes exactly two endpoints — one for a section's insight, one for a single component's insight — and it does nothing but read: it never triggers generation, never writes, and holds no business logic of its own. Its only transformations are envelope shaping: lifting provider metadata to the top level so a client need not parse the summary JSON, and pairing a component's analysis with its rendered explainer text. After this document you can build the public read surface that the frontend (doc 07) consumes, with a precise contract for every field and status code.

## 2. Prerequisites

- **Doc 00** — the vocabulary (Page, Section, Component, Insight) in §3; invariant 1 (end users only ever read); the Engine/Domain split in §4 (this layer is Engine).
- **Doc 01** — the two read functions `getSectionInsight(sectionKey, page?)` and `getComponentInsight(sectionKey, componentKey)`, the *latest-wins* read rule (§5.3), and the persisted column shapes these return. This layer **consumes** them and adds only an HTTP envelope.
- **Doc 02 / 04** (Domain Pack) — the rendered component-info contract `getRenderedComponentInfo(componentKey)`: the static per-component explainer with threshold tokens already substituted to numbers, fail-soft. This layer surfaces it but does not own it.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the read API as an idea.*

The layer is a **thin, side-effect-free projection of stored insight over a request/response boundary**.

**Inputs**

- A section read: a `sectionKey`, optionally narrowed by `page`.
- A component read: a `sectionKey` and a `componentKey`.

**Outputs / guarantees**

- A section read returns either the current section insight (with provider metadata lifted out of the summary payload) or an explicit *absent* marker.
- A component read returns the component's stored analysis (when it exists) **always paired with** the component's rendered explainer; when no analysis exists yet, the explainer is still returned with an *absent-analysis* marker.
- Every response is computed from reads alone. No state changes as a result of any call.

**Invariants (must never be violated)**

1. **Read-only.** No call generates, writes, or mutates anything (doc 00 invariant 1).
2. **Absence is explicit, not an error.** "No insight yet" is a normal, well-typed answer — distinguishable by the client from a malformed request.
3. **The explainer is independent of the analysis.** A component with no generated analysis still returns its rendered explainer, so a client can always show *what a component means* even before a batch has run.
4. **No business logic.** Scope resolution, prompt rendering, numeric guarding all happened upstream; this layer only reshapes what storage returns.

**Boundary with adjacent layers**

- *Down:* storage (doc 01) for the two reads; the Domain Pack renderer (doc 02/04) for component info.
- *Up:* the frontend (doc 07) is the only consumer.
- *Auth:* the read path is **unauthenticated** by design — it exposes only already-persisted, user-facing narrative; write/admin auth lives in docs 05/08.

A reader can re-implement this layer on any request/response runtime from this section alone.

## 4. Data contracts

### 4.1 Owned — section response envelope

`GET` section → one of:

| Case | Status | Body |
|---|---|---|
| Found | 200 | `{ exists: true, …<all stored section columns>, provider_metadata }` |
| Absent | 404 | `{ exists: false }` |

The stored section columns (owned by doc 01): `id, page, section_key, summary_json, analysis_time_s, token_count, cost_usd, date_range_start, date_range_end, fiscal_year, fiscal_range, generated_by, generated_at`. The single **owned derived field**:

| Field | Type | Derivation |
|---|---|---|
| `provider_metadata` | `AiProviderMetadata \| null` | `summary_json.providerMeta ?? null` — lifted to the top level so clients need not reach into the JSON. Shape owned by doc 03/04. |

### 4.2 Owned — component response envelope

`GET` component → always **200** (absence is in the body, not the status):

| Case | Body |
|---|---|
| Analysis found | `{ exists: true, componentInfo, …<all stored component columns> }` |
| Analysis absent | `{ exists: false, componentInfo }` |

Stored component columns (owned by doc 01, from `getComponentInsight`): `id, component_key, component_type, analysis_md, token_count, generated_at`, plus the parent section's `generated_by, date_range_start, date_range_end, fiscal_year, fiscal_range`.

### 4.3 Consumed — rendered component info (owned by doc 02/04)

```
ComponentInfo = {
  name:           string
  whatItMeasures: string            // threshold tokens substituted
  formula?:       string            // omitted when source value empty
  indicator?:     string
  about?:         string
}
```

`getRenderedComponentInfo(componentKey)` returns this with every `{{component.token}}` resolved to its configured number (doc 02), or `null` when the `componentKey` is unknown to the Domain Pack catalog. It is **fail-soft**: token resolution never throws into the response.

## 5. Behavior & flow

> Stack-true. `[VERSION-SENSITIVE]` flags mark assumptions a different stack must adapt.

### 5.1 `GET /api/ai-insight/section/{section_key}` (optional `?page=`)

1. Read the dynamic `section_key` path segment and the optional `page` query parameter.
2. `insight = await getSectionInsight(section_key, page)` (doc 01 — *latest-wins* when `page` is omitted).
3. If `null` ⇒ respond `404 { exists: false }`.
4. Else respond `200 { exists: true, ...insight, provider_metadata: insight.summary_json?.providerMeta ?? null }`.

`[VERSION-SENSITIVE]` — reference stack is a Next.js App Router route handler where dynamic params arrive as an awaited `Promise<{ section_key }>` and the query is read via `req.nextUrl.searchParams`. On Pages Router this is an API route reading `req.query`; on other stacks, route + query parsing differ but the contract (§4.1) is identical.

### 5.2 `GET /api/ai-insight/component/{section_key}/{component_key}`

1. Read both dynamic path segments.
2. **In parallel:** `insight = getComponentInsight(section_key, component_key)` (doc 01) and `componentInfo = getRenderedComponentInfo(component_key)` (doc 02/04).
3. If `insight` is `null` ⇒ respond `200 { exists: false, componentInfo }`.
4. Else respond `200 { exists: true, componentInfo, ...insight }`.

Note the deliberate asymmetry with §5.1: a missing **section** is a `404`; a missing **component analysis** is a `200` carrying `exists:false` plus `componentInfo`, because the explainer must render even when no batch has produced an analysis for that component yet (invariant 3).

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Section has no stored insight | `404 { exists:false }` | Invariant 2 — the client shows an empty/"not generated" state, distinct from a 4xx input error. |
| 2 | `page` query omitted | `getSectionInsight` applies the *latest-wins* rule (doc 01 §5.3) | The same `section_key` may exist under multiple pages; without `page` the most recent wins. |
| 3 | `page` query present and wrong | Filtered query returns no row ⇒ `404 { exists:false }` | A page-scoped client must not receive another page's insight. |
| 4 | Component analysis missing | `200 { exists:false, componentInfo }` (**not** 404) | Invariant 3 — the static explainer is independent of whether analysis ran. |
| 5 | `componentKey` unknown to the catalog | `componentInfo` is `null`; `exists` reflects the analysis row independently | Renderer returns `null` for unknown keys; the API does not invent one. |
| 6 | Threshold token cannot be resolved | Renderer is fail-soft (doc 02) — response still returns; never 5xx for this | A misconfigured threshold degrades text, it must not break the read path. |
| 7 | Any read call | No write, no generation, no auth challenge | Invariants 1 & 4 — the read path is pure and public. |
| 8 | `provider_metadata` absent in `summary_json` | Field is `null`, not omitted | Stable shape for clients (doc 03/04 own the inner type). |

### 6.1 Configuration owned by this layer

None. This layer reads no environment variables; its behavior is fully determined by the request and the stores it consumes.

### 6.2 Cache / dynamic behavior

`[VERSION-SENSITIVE]` — the reference Next.js route handlers do not set an explicit `dynamic = 'force-dynamic'` export and do not attach `Cache-Control: no-store` headers. They are dynamic route handlers that read request parameters and return the current persisted database row at execution time. A production rebuild must make this cache policy explicit for its runtime:

- Prefer `no-store` or an equivalent dynamic/read-through policy when the frontend must show a newly completed batch immediately.
- If HTTP or framework caching is enabled, key section reads by both `section_key` and optional `page`, key component reads by `section_key + component_key`, and invalidate those keys when a batch writes new insights.
- Never let a cached 404/`exists:false` hide a later successful batch result.

## 7. Reference Implementation

Source paths are traceability evidence for the spec above — not a substitute for it.

| Path | Symbol | Responsibility |
|---|---|---|
| `app/api/ai-insight/section/[section_key]/route.ts` | `GET` | §5.1 — section read + `provider_metadata` lift + 404-on-absent. |
| `app/api/ai-insight/component/[section_key]/[component_key]/route.ts` | `GET` | §5.2 — parallel analysis+info read; 200-with-`exists:false` on absent analysis. |
| `lib/ai-insight/storage.ts` | (doc 01) `getSectionInsight`, `getComponentInsight` | The two reads — **consumed**, owned by doc 01. |
| `lib/ai-insight/component-info-renderer.ts` | (doc 02/04) `getRenderedComponentInfo` | The rendered explainer — **consumed**, owned by the Domain Pack. |

**Handler shapes (key skeleton):**

```ts
// section
export async function GET(req, { params }) {
  const { section_key } = await params;
  const page = req.nextUrl.searchParams.get('page') ?? undefined;
  const insight = await getSectionInsight(section_key, page);
  if (!insight) return Response.json({ exists: false }, { status: 404 });
  return Response.json({
    exists: true, ...insight,
    provider_metadata: insight.summary_json?.providerMeta ?? null,
  });
}

// component
export async function GET(_req, { params }) {
  const { section_key, component_key } = await params;
  const [insight, componentInfo] = await Promise.all([
    getComponentInsight(section_key, component_key),
    getRenderedComponentInfo(component_key),
  ]);
  if (!insight) return Response.json({ exists: false, componentInfo });
  return Response.json({ exists: true, componentInfo, ...insight });
}
```

## 8. Verification checkpoint

**Setup (no source access):** implement the two handlers per §3–§6 over a storage layer (doc 01) and a Domain-Pack renderer (doc 02/04). Seed one section insight for `(page='p', section='s')` with two components, where the `summary_json` contains a `providerMeta` object, and ensure at least one component's explainer text contains a threshold token.

**Action & expected observable result:**

1. **Section found.** `GET section/s?page=p` ⇒ `200`, `exists:true`, all stored columns present, and `provider_metadata` equals the object inside `summary_json.providerMeta` (top-level, not nested).
2. **Section absent / wrong page.** `GET section/zzz` ⇒ `404 { exists:false }`. `GET section/s?page=other` ⇒ `404 { exists:false }`. `GET section/s` with no `page` ⇒ `200` returning the same row (latest-wins).
3. **Component found.** `GET component/s/<componentKey>` ⇒ `200`, `exists:true`, `analysis_md` present, parent scope fields present, and `componentInfo` has its threshold token replaced by a concrete number (no `{{…}}` remaining).
4. **Component analysis absent.** `GET component/s/<a component whose section never ran>` ⇒ `200`, `exists:false`, but `componentInfo` is still a populated object.
5. **Unknown component key.** `GET component/s/not-a-real-key` ⇒ `200`, `componentInfo:null`.
6. **Purity.** After all of the above, the row count in every engine table is unchanged — no GET created or modified data.

**Definition of Done:** a developer who has read only `00`, `01`, and this document (plus the consumed contracts named in §2), with no access to this repo's source, can build both endpoints and pass all six checks.
