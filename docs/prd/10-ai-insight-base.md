# AI Insight Engine — Base PRD (Engine Foundation)

Reference implementation stack: Next.js 16 (App Router), React, TypeScript, PostgreSQL. The contracts in this PRD are stack-agnostic; cited file paths point to the reference implementation for traceability only.

This PRD describes the **engine** that powers AI Insight: shared UI, runtime orchestration, prompt registry, model gateway, data/tool contract, persistence, validation. The Finance module PRD (`11-ai-insight-finance.md`) owns the 16 section catalog, 69-component prompt library, fetcher implementations, and per-section tuning. The HR module PRD (`12-ai-insight-hr.md`) adopts this engine as-is.

> **Source-of-truth principle.** Every claim cites a file path and line range in the reference implementation. The following features are **explicitly excluded** from this spec and must not be implemented unless re-scoped: evidence-label allowlist / evidence guard, PII filter / privacy guard, RBAC user-scoped data filter, run-log database table, evaluation-result database table, audit-trailed feedback (rows are deleted on apply/discard), automatic section re-evaluation trigger on prompt apply, scoped lock key (the lock is singleton), per-component re-run endpoint, `change_summary` persistence on prompt-version rows, force-reseed mode on `seed-defaults`.

Screenshots referenced below live under [docs/prd/screenshots/](screenshots/).

---

## 1. Purpose & User Model

AI Insight gives a non-technical executive a one-click, plain-language assessment of every "section" (a cohesive group of KPI cards, charts and tables) on a dashboard page. Every section ships with the same UI shell, the same two-phase analysis pipeline, the same numerical guardrail, and the same feedback loop. Only the prompts, the data fetchers, and the section→tool policy map differ between sections.

User roles:

- **Viewer** — sees stored section results; can submit free-text feedback (see §9). Cannot trigger a fresh analysis. Determined client-side by `useRole().isAdmin === false`; the panel displays "Admin role required to analyze" in place of the Analyze button ([apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx:280-281](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L280-L281)).
- **Admin** — same as Viewer plus can click **Analyze** to spend tokens on a fresh run, cancel an in-flight run, and access the AI Insight Config admin page (see §6) to manage prompt versions and triage feedback.

There is no per-user-scoped data filter in code. The role check is purely a UI gate — the analyze API trusts the body's `user_name` for lock attribution ([apps/dashboard/src/app/api/ai-insight/analyze/route.ts:13-36](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L13-L36)).

---

## 2. Scope Split — Base vs. Module

| Concern | Owned by | Source of truth |
|---|---|---|
| Section header + panel + cards UI | Base (this PRD) | [AiInsightPanel.tsx](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx), [InsightSectionHeader.tsx](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx) |
| Insight detail dialog, Component dialog, Feedback modal | Base | [InsightDetailDialog.tsx](../../apps/dashboard/src/components/ai-insight/InsightDetailDialog.tsx), [ComponentInsightDialog.tsx](../../apps/dashboard/src/components/ai-insight/ComponentInsightDialog.tsx), [FeedbackModal.tsx](../../apps/dashboard/src/components/ai-insight/FeedbackModal.tsx) |
| Admin Config dashboard (tree, breadcrumb, text panel, version cards, feedback list, diff modal) | Base | [components/admin/ai-insight-config/](../../apps/dashboard/src/components/admin/ai-insight-config/) |
| Two-phase orchestrator, concurrency pool, cost/runtime caps, numeric guard retry loop | Base | [orchestrator.ts](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts) |
| Model gateway, slot config, OpenRouter routing, fallback paths, cost & metadata capture | Base | [model-provider.ts](../../apps/dashboard/src/lib/ai-insight/model-provider.ts), [client.ts](../../apps/dashboard/src/lib/ai-insight/client.ts) |
| Prompt registry, versioning, cache, seeding | Base | [prompt-loader.ts](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts), [prompt-store.ts](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts), [api/admin/ai-insight-prompts/](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/) |
| Feedback lifecycle (router → store → preview → apply / discard) | Base | [feedback-llm.ts](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts), [api/ai-insight/feedback/](../../apps/dashboard/src/app/api/ai-insight/feedback/), [api/admin/ai-insight-feedback/](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/) |
| Tool catalog (`query_local_table`, `query_rds_table`), column whitelists, `Cancelled='F'` injection, WHERE-clause blocklist | Base | [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts) |
| Tool policy levels (`none` / `aggregate_only` / `full`) | Base | [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts) |
| Section → component registry (`SECTION_COMPONENTS`) | Base contract, Module data | [prompts.ts:12-121](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L12-L121) (Finance fills it) |
| Default system / component / section-guidance prompt text | **Module** | [prompts-defaults.ts](../../apps/dashboard/src/lib/ai-insight/prompts-defaults.ts) (Finance), HR PRD §HR Defaults |
| Per-component data fetchers (`{ prompt, allowed }`) | **Module** | [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts) (Finance) |
| Per-section tool policy mapping | **Module** | [tool-policy.ts:6-31](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L6-L31) |
| Per-section verification & tuning recipes | **Module** | [AI_Insight_Study/ROLLOUT_TRACKER.md](../../AI_Insight_Study/ROLLOUT_TRACKER.md) |

The Base engine is intentionally domain-agnostic: every reference to "Finance" inside `lib/ai-insight/` is data (a default prompt string, a page key, a column whitelist) rather than control flow. Swapping in HR or any future module means writing a new fetcher set, prompt-defaults set, tool-policy map, and (optionally) page→section registry. The orchestrator and gateway do not need to change.

---

## 3. UI Shell — Section Header, Panel, Cards

### 3.1 Section Header

Rendered above every section by [InsightSectionHeader.tsx](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx). Always visible; never hidden by role.

```
┌──────────────────────────────────────────────────────────────────┐
│ <Section title>   <subtitle>                       Get Insight ▾ │
└──────────────────────────────────────────────────────────────────┘
```

- The title comes from the page; the subtitle is optional ([InsightSectionHeader.tsx:67-70](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx#L67-L70)). Callers conventionally pass `"Filtered by date range"` for period sections and `"Snapshot only"` for snapshot sections.
- "Get Insight" is a ghost button with a chevron that toggles the panel open/closed ([InsightSectionHeader.tsx:71-80](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx#L71-L80)).
- The AI panel renders only while the header is expanded ([InsightSectionHeader.tsx:83-98](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx#L83-L98)). On collapse, the analysis result stays in `ai_insight_section` and re-appears the next time the user expands the header.

**Module-specific extension hook.** `InsightSectionHeader.tsx` has a single hard-coded branch for the Finance `financial_variance` section: when `sectionKey === 'financial_variance' && insight.status === 'complete' && expanded`, a blue "Approve as Budget" bar appears below the AI panel ([InsightSectionHeader.tsx:36-55](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx#L36-L55), [InsightSectionHeader.tsx:100-119](../../apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx#L100-L119)). Clicking it POSTs to `/api/budget/save` with the active fiscal year and is outside the AI Insight engine — it lives in `InsightSectionHeader` only because that is where the budget-suggestions analysis is shown. The production rebuild should either (a) move this extension out of the shared header into a Finance-only wrapper or (b) make the header accept an `afterPanel` slot. Documented here so the production team does not assume it is part of the generic AI Insight contract.

Screenshot: [screenshots/payment/ai-insight-section-header.png](screenshots/payment/ai-insight-section-header.png).

### 3.2 AI Panel (Open)

Owned by [AiInsightPanel.tsx](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx). When open the panel shows three regions stacked vertically:

```
┌── content (state-dependent) ─────────────────────────────────────┐
│   idle / loading / analyzing / complete / blocked / error rows   │
├── metadata footer ───────────────────────────────────────────────┤
│  Analyzed: <date range>  Time: <s>  Tokens: <N>  Cost: $<X.YY>   │
│  Last Updated: <ts>  By: <user>                                  │
├── action footer ─────────────────────────────────────────────────┤
│                                       [Feedback]  [Analyze ▸]    │
└──────────────────────────────────────────────────────────────────┘
```

- Metadata footer: only populated when a stored result exists; otherwise every value is `-` ([AiInsightPanel.tsx:243-265](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L243-L265)).
- Feedback button is always enabled when the panel is open, except during an active analyze run ([AiInsightPanel.tsx:267-275](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L267-L275)).
- Analyze button: visible only when `isAdmin === true` ([AiInsightPanel.tsx:280-281](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L280-L281)). During analysis it is replaced by a destructive Cancel button ([AiInsightPanel.tsx:276-280](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L276-L280)).

Screenshot (results / complete): [screenshots/payment/ai-insight-panel-results.png](screenshots/payment/ai-insight-panel-results.png).

### 3.3 Insight Cards

When `summary_json.good` / `summary_json.bad` are populated, the content region renders a two-column grid headed "Positive" (green) and "Negative" (red), each capped at three cards ([AiInsightPanel.tsx:120-121](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L120-L121), [AiInsightPanel.tsx:178-220](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L178-L220)).

Card shape (`SummaryInsight`, [types.ts:61-66](../../apps/dashboard/src/lib/ai-insight/types.ts#L61-L66)):

| Field | Required | Rendering |
|---|---|---|
| `title` | yes | Truncated bold heading |
| `metric` | optional | Pill chip to the right of the title |
| `summary` | optional | Single line under title, gray, line-clamped |
| `detail` | yes | Hidden in card; shown in the detail dialog |

If `summary` is absent the card falls back to extracting the first sentence of `detail` after stripping `**Header:**` and `**Header** (scope):` markdown patterns ([AiInsightPanel.tsx:76-91](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L76-L91)). Clicking a card opens the detail dialog (§3.4).

### 3.4 Insight Detail Dialog

[InsightDetailDialog.tsx](../../apps/dashboard/src/components/ai-insight/InsightDetailDialog.tsx) — a 60vw modal whose header bar is green for positive insights and red for negative ([InsightDetailDialog.tsx:26-41](../../apps/dashboard/src/components/ai-insight/InsightDetailDialog.tsx#L26-L41)). The body is a scrollable markdown renderer ([MarkdownRenderer.tsx](../../apps/dashboard/src/components/ai-insight/MarkdownRenderer.tsx)) that consumes the GFM-formatted `detail` field — paragraphs, lists, tables, and bold "**Header:**" subtitle paragraphs are all styled ([MarkdownRenderer.tsx:16-69](../../apps/dashboard/src/components/ai-insight/MarkdownRenderer.tsx#L16-L69)).

Screenshot: [screenshots/payment/ai-insight-detail-dialog.png](screenshots/payment/ai-insight-detail-dialog.png).

---

## 4. AI Panel States

`useInsightAnalysis()` returns a discriminated `status` of type `InsightStatus = 'idle' | 'loading' | 'analyzing' | 'complete' | 'error' | 'blocked'` ([useInsightAnalysis.ts:28](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L28)). Each value drives a distinct content block in the panel.

### 4.1 `idle` — No stored result yet

Trigger: GET `/api/ai-insight/section/{section_key}` returns 404, i.e. no prior run for this page+section ([api/ai-insight/section/[section_key]/route.ts:7-13](../../apps/dashboard/src/app/api/ai-insight/section/%5Bsection_key%5D/route.ts#L7-L13)).

Rendering ([AiInsightPanel.tsx:127-133](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L127-L133)):

```
No insights generated yet.
Click "Analyze" to generate AI insights.
```

Screenshot: [screenshots/expenses/ai-insight-panel-idle.png](screenshots/expenses/ai-insight-panel-idle.png).

### 4.2 `loading` — Re-fetching stored result

Transient state during `fetchStored()` while the GET is in flight ([useInsightAnalysis.ts:46-62](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L46-L62)). Rendering: spinner + "Loading…" ([AiInsightPanel.tsx:135-141](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L135-L141)).

### 4.3 `analyzing` — Live SSE stream

Trigger: user clicked Analyze; the hook opened a POST stream to `/api/ai-insight/analyze` ([useInsightAnalysis.ts:80-156](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L80-L156)). The panel renders one row per component as the orchestrator emits `progress` events:

```
🔄 Analyzing avg_collection_days …
✓  collection_rate — done
✗  invoiced_vs_collected — Error executing query: column "x" not allowed
```

Rendering: [AiInsightPanel.tsx:143-175](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L143-L175). The `progress` payload shape is [`SSEProgressData`](../../apps/dashboard/src/lib/ai-insight/types.ts#L186-L190). Until the first event arrives, a fallback row reads "Starting analysis…" ([AiInsightPanel.tsx:168-173](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L168-L173)).

Screenshot: [screenshots/payment/ai-insight-panel-analyzing.png](screenshots/payment/ai-insight-panel-analyzing.png) (captured during a live `payment_collection_trend` run: 5 components complete, summary phase in progress).

The `summary` phase emits its own progress events keyed on the literal string `'summary'` ([orchestrator.ts:143-147](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L143-L147)) — that is why the screenshot's final row reads "Analyzing summary…". Treat `summary` as a virtual component key on the progress stream; do not look up a real `SECTION_COMPONENTS` entry for it.

### 4.4 `complete` — Result rendered

Trigger: SSE `complete` event received; the hook calls `fetchStored()` which re-GETs the section row and sets `status='complete'` ([useInsightAnalysis.ts:174-178](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L174-L178)). Rendering is the two-column "Positive" / "Negative" card grid (§3.3) plus the populated metadata footer.

### 4.5 `blocked` — Another analysis is running

Trigger: either GET `/api/ai-insight/status` returned `{ locked: true, section_key: <other> }` on mount-checkLock, or POST `/api/ai-insight/analyze` returned 409 ([useInsightAnalysis.ts:107-110](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L107-L110)).

Rendering ([AiInsightPanel.tsx:222-229](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L222-L229)):

```
⛔ Analysis is currently running by <user>. Please wait for it to complete.
```

The Analyze button is disabled while `isBlocked === true` ([AiInsightPanel.tsx:286](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L286)).

Screenshot: [screenshots/payment/ai-insight-panel-blocked.png](screenshots/payment/ai-insight-panel-blocked.png).

### 4.6 `error` — Analysis failed

Trigger: SSE `error` event received, or POST `/api/ai-insight/analyze` returned non-409 non-200 ([useInsightAnalysis.ts:111-113](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L111-L113), [useInsightAnalysis.ts:186-190](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L186-L190)). Rendering: red error message in the content region ([AiInsightPanel.tsx:232-237](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L232-L237)).

Screenshot: [screenshots/payment/ai-insight-panel-error.png](screenshots/payment/ai-insight-panel-error.png).

### 4.7 `cancelled` — User clicked Cancel

Not its own `status` value: the cancel flow sets `status='idle'`, clears `progress` and `error`, cancels the SSE reader client-side, posts to `/api/ai-insight/cancel`, and re-fetches any prior stored result ([useInsightAnalysis.ts:195-224](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L195-L224)). The orchestrator's `AbortController` aborts in-flight component/summary calls; the server emits a final `cancelled` SSE event with a short message before closing the stream ([api/ai-insight/analyze/route.ts:89-100](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L89-L100)). The DB is **not** updated — `upsertSectionInsight` only runs on the success path, so any prior stored result remains intact.

### 4.8 SSE event payloads

| Event | Shape | Source |
|---|---|---|
| `progress` | `{ component, status: 'analyzing'\|'complete'\|'error', message? }` | [api/ai-insight/analyze/route.ts:60-62](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L60-L62) |
| `complete` | `{ section_id, analysis_time_s, token_count, cost_usd, provider_metadata }` | [api/ai-insight/analyze/route.ts:82-88](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L82-L88) |
| `cancelled` | `{ message }` | [api/ai-insight/analyze/route.ts:90-94](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L90-L94) |
| `error` | `{ message }` | [api/ai-insight/analyze/route.ts:96-99](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L96-L99) |

Stream framing: `event: <type>\ndata: <json>\n\n`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` ([api/ai-insight/analyze/route.ts:47-50](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L47-L50), [api/ai-insight/analyze/route.ts:109-114](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L109-L114)).

The browser cannot use `EventSource` (which is GET-only); the hook reads the POST body via `fetch().body.getReader()` and splits on `\n` manually ([useInsightAnalysis.ts:117-148](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L117-L148)).

---

## 5. Component Insight Dialog

Every KPI / chart / table on the page renders an `<AnalyzeIcon>` (a SearchCheck magnifying-glass button) in its header ([AnalyzeIcon.tsx:19-27](../../apps/dashboard/src/components/ai-insight/AnalyzeIcon.tsx#L19-L27)). The icon takes two props: `sectionKey` and `componentKey`. Clicking opens a `ComponentInsightDialog` ([ComponentInsightDialog.tsx](../../apps/dashboard/src/components/ai-insight/ComponentInsightDialog.tsx)).

Layout:

```
┌── [#1F4E79] header with component name ──────────────────────────┐
├── 📖 About ─────────────────────────────────────────────────────┤
│  Static copy from COMPONENT_INFO[componentKey].about              │
├── 🧠 AI Analysis ───────────────────────────────────────────────┤
│  GET /api/ai-insight/component/{section}/{component}              │
│  └─ analysis_md (markdown)                                        │
├── footer ────────────────────────────────────────────────────────┤
│  Last Updated: <ts>   By: <user>                                  │
└──────────────────────────────────────────────────────────────────┘
```

- "About" copy is purely client-side; it lives in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts) and rendered by [ComponentInsightDialog.tsx:70-84](../../apps/dashboard/src/components/ai-insight/ComponentInsightDialog.tsx#L70-L84). About text never changes per analyze; it is documentation.
- AI Analysis fetches stored markdown via [api/ai-insight/component/[section_key]/[component_key]/route.ts](../../apps/dashboard/src/app/api/ai-insight/component/%5Bsection_key%5D/%5Bcomponent_key%5D/route.ts) which joins `ai_insight_component` to `ai_insight_section` ([storage.ts:85-96](../../apps/dashboard/src/lib/ai-insight/storage.ts#L85-L96)). If no analysis exists, the dialog shows "No analysis available. Run 'Analyze' from the section panel." ([ComponentInsightDialog.tsx:101-105](../../apps/dashboard/src/components/ai-insight/ComponentInsightDialog.tsx#L101-L105)).
- The Component Insight Dialog **never triggers a model call.** It is purely a read of the latest persisted component analysis from the most recent section run. There is no `/api/ai-insight/component/.../run` endpoint.

Screenshot of the icon in a KPI card: [screenshots/payment/ai-insight-component-icon.png](screenshots/payment/ai-insight-component-icon.png).
Screenshot of the dialog: [screenshots/payment/ai-insight-component-dialog.png](screenshots/payment/ai-insight-component-dialog.png).

---

## 6. AI Insight Config — Admin Page

URL: `/admin/ai-insight-config`. Component: [PromptConfigDashboard.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx). Full-width layout, no max-content shell.

Outer grid: `[20rem tree] | [breadcrumb / text+versions / feedback]`. Three rows on the right: breadcrumb (auto), text + versions (1fr), feedback (≤18rem) ([PromptConfigDashboard.tsx:88-122](../../apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx#L88-L122)).

Screenshot: [screenshots/ai-insight-admin/config-page-full.png](screenshots/ai-insight-admin/config-page-full.png).

### 6.1 Prompt Tree (left)

[PromptTree.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx). Two top-level groups:

```
System Prompt
├─ Finance
│  ├─ Component Analysis    (component_analysis)
│  └─ Summary Analysis      (summary_analysis)
├─ HR
│  ├─ Component Analysis    (hr_component_analysis)
│  └─ Summary Analysis      (hr_summary_analysis)
├─ Feedback Router          (feedback_router)
└─ Surgical Editor          (surgical_editor)

User Prompt
├─ Finance
│  ├─ Payment
│  │  ├─ Payment Collection Trend
│  │  │  ├─ Guidance          (payment_collection_trend_guidance)
│  │  │  ├─ Avg Collection Days
│  │  │  ├─ Collection Rate
│  │  │  └─ …
│  │  └─ Outstanding Payment
│  ├─ Sales / Customer Margin / Supplier Performance / Returns / Expenses / Financial
└─ HR
   └─ <empty until HR module ships fetchers>
```

- The two system-group sub-trees (Finance / HR) are hard-coded in [PromptTree.tsx:76-89](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx#L76-L89) with legacy-key fallbacks so an in-flight rename does not blank the panel.
- User-prompt tree builds dynamically from `prompts.category in ('component', 'section_guidance')` rows grouped by `page` and `section_key` ([PromptTree.tsx:27-65](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx#L27-L65)).
- Each leaf shows an optional **blue feedback-count badge** when ≥1 pending feedback rows target that prompt ([PromptTree.tsx:220-230](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx#L220-L230)). Closed groups collapse-roll-up the count.
- HR group expands collapsed by default ([PromptTree.tsx:108](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx#L108)); Finance group expands open by default ([PromptTree.tsx:107](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx#L107)).

Screenshot: [screenshots/ai-insight-admin/prompt-tree-finance-hr.png](screenshots/ai-insight-admin/prompt-tree-finance-hr.png).

### 6.2 Breadcrumb Bar

[BreadcrumbBar.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/BreadcrumbBar.tsx). Renders the human path to the selected prompt:

- System leaf: `System Prompt / Finance / Component Analysis` ([BreadcrumbBar.tsx:31-46](../../apps/dashboard/src/components/admin/ai-insight-config/BreadcrumbBar.tsx#L31-L46)).
- Component leaf: `User Prompt / Finance / Payment / Payment Collection Trend / Avg Collection Days` ([BreadcrumbBar.tsx:49-65](../../apps/dashboard/src/components/admin/ai-insight-config/BreadcrumbBar.tsx#L49-L65)).
- Guidance leaf: same path, last crumb is `Guidance`.

### 6.3 Prompt Text Panel (read-only)

[PromptTextPanel.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx). Shows the currently-selected version's `prompt_text` in a monospace `<pre>` block, plus a "selected-version pill" (Default = amber, user version = blue) ([PromptTextPanel.tsx:34-44](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx#L34-L44)).

The panel is **read-only by design.** There is no inline edit, save, or reset. The only path to a new prompt body is the feedback Apply flow (§9). When the body is empty (e.g. an HR scaffold guidance row), the panel shows "This prompt is empty. Submit feedback from the user-facing AI insight panel to populate it." ([PromptTextPanel.tsx:47-54](../../apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx#L47-L54)).

Screenshot: [screenshots/ai-insight-admin/prompt-text-panel.png](screenshots/ai-insight-admin/prompt-text-panel.png).

### 6.4 Version Panel

[VersionPanel.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/VersionPanel.tsx). Cards-style list of `ai_insight_prompt_versions` rows for the selected prompt, fetched from GET `/api/admin/ai-insight-prompts/{prompt_key}/versions` ([api/admin/ai-insight-prompts/[prompt_key]/versions/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/%5Bprompt_key%5D/versions/route.ts)). Header reads `Version:  <n>/6` ([VersionPanel.tsx:108-115](../../apps/dashboard/src/components/admin/ai-insight-config/VersionPanel.tsx#L108-L115)).

- Sort order: Default first, then `created_at DESC` ([prompt-store.ts:99-100](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L99-L100)).
- Each card renders a label like `feedback-apply · May 10, 9:21 PM` ([prompt-store.ts:341-355](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L341-L355)).
- Clicking a non-selected card calls POST `/.../versions/{id}/select`, which write-throughs the version's text to `ai_insight_prompts.prompt_text` (the runtime cache row) in a single transaction and invalidates the in-memory snapshot ([api/admin/ai-insight-prompts/[prompt_key]/versions/[id]/select/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/%5Bprompt_key%5D/versions/%5Bid%5D/select/route.ts), [prompt-store.ts:205-241](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L205-L241)).
- Non-Default cards have a trash icon. Confirm → DELETE `/.../versions/{id}`. If the deleted version was selected, the next-newer non-default takes over, else Default ([prompt-store.ts:258-337](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L258-L337)).
- When 6 versions exist a non-dismissable warning banner reads "The prompt version section is full. Please clear unwanted versions before proceeding with feedback Apply." ([VersionPanel.tsx:135-146](../../apps/dashboard/src/components/admin/ai-insight-config/VersionPanel.tsx#L135-L146)).

Screenshots: [version-panel-default.png](screenshots/ai-insight-admin/version-panel-default.png) (Default only), [version-panel-with-versions.png](screenshots/ai-insight-admin/version-panel-with-versions.png) (Default + 3 user versions).

### 6.5 Feedback List

[FeedbackList.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx). Renders the rows from `ai_insight_feedback` whose `target_prompt_key` matches the selected prompt, fetched from GET `/api/admin/ai-insight-feedback?prompt_key=...` ([api/admin/ai-insight-feedback/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/route.ts)).

Each row shows submitter + timestamp + the raw feedback text + two actions:

- **Apply** — POST `/.../feedback/{id}/preview` (LLM call to surgical editor; returns `{ proposedText, changeSummary }`), then opens DiffModal. Clicking "Confirm & apply" inside the modal POSTs `/.../feedback/{id}/apply` which inserts a new version row and deletes the feedback row in a single best-effort sequence ([FeedbackList.tsx:162-221](../../apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx#L162-L221), [api/admin/ai-insight-feedback/[id]/apply/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/apply/route.ts)).
- **Discard** — DELETE `/.../feedback/{id}`. Row is permanently removed; there is no audit trail and no soft-delete column ([api/admin/ai-insight-feedback/[id]/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/route.ts)).

Screenshot: [screenshots/ai-insight-admin/feedback-list.png](screenshots/ai-insight-admin/feedback-list.png).

### 6.6 Diff Modal

[DiffModal.tsx](../../apps/dashboard/src/components/admin/ai-insight-config/DiffModal.tsx). Side-by-side "Current" (red highlights for removed lines) vs. "Proposed" (green highlights for added lines), plus a single-line **Change summary** banner from the surgical editor tool call. The diff uses per-line set-membership rather than a full LCS — surgical edits keep most lines verbatim, so a cheap set diff is sufficient ([prompt-diff.tsx:10-29](../../apps/dashboard/src/components/admin/ai-insight-config/prompt-diff.tsx#L10-L29)).

Screenshot: [screenshots/ai-insight-admin/feedback-diff-modal.png](screenshots/ai-insight-admin/feedback-diff-modal.png) (captured against a real `by_customer` feedback row: the surgical editor proposed raising the bad-tier concentration cutoff from 25% to 30% and added a seasonal-adjustment note. The change-summary banner reads "Raise bad-tier cutoff to 30% for seasonal peaks; add seasonal-adjustment note.").

---

## 7. Runtime Sequence — `runSectionAnalysis()`

POST `/api/ai-insight/analyze` body: `{ page, section_key, date_range, fiscal_period?, user_name }` ([types.ts:53-59](../../apps/dashboard/src/lib/ai-insight/types.ts#L53-L59)). The server then:

```
1. validate section_key against SECTION_COMPONENTS                ([analyze/route.ts:18-22])
2. acquireLock(user_name, section_key)                            (§16)
   ── if not acquired → 409 { error, locked_by, section_key }
3. open SSE stream, register AbortController in activeControllers
4. orchestrator.runSectionAnalysis(...)                           (orchestrator.ts:64)
   4a. set MAX_RUNTIME_MS timer (5 min). On expiry → abort()
   4b. component pool (MAX_CONCURRENCY = 2)
       └─ for each component def in SECTION_COMPONENTS[section_key]:
          • fetchComponentData(...) → { prompt, allowed }
          • build component user prompt (system + user)
          • callAiModel({ slot: 'component', ... })   (no tools)
          • emit 'progress'
          • totalCost += cost; if totalCost > MAX_COST_PER_SECTION → throw
   4c. summary attempt loop (MAX_GUARD_ATTEMPTS = 2)
       └─ build summary user prompt from raw component data (not from analyses)
       └─ inner agent loop:
            • callAiModel({ slot: 'summary', tools? })
            • if stop_reason === 'tool_use' → execute tools serially
              (cap MAX_TOOL_CALLS_PER_SUMMARY = 2)
            • after final text → exit agent loop
       └─ runNumericGuard(text, allAllowed ∪ tool-result numbers)
       └─ if guard.ok → break
       └─ else if attempt < MAX_GUARD_ATTEMPTS → append guard-error
              as a new user message and replay; loop
       └─ else → keep text but record numericGuard.passed=false
5. parseSummaryResponse → SummaryJson { good[≤3], bad[≤3], numericGuard, providerMeta }
6. upsertSectionInsight(...)  (DELETE+INSERT in a tx → cascades components)
7. emit 'complete' { section_id, analysis_time_s, token_count, cost_usd, provider_metadata }
8. releaseLock()                                                  ([analyze/route.ts:101-104])
```

Numeric constants — all in [orchestrator.ts:41-45](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L41-L45) and [orchestrator.ts:297](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L297):

| Constant | Value | Purpose |
|---|---|---|
| `MAX_CONCURRENCY` | `2` | Parallel component analyses |
| `MAX_TOOL_CALLS_PER_SUMMARY` | `2` | Per attempt; once reached the loop appends a user message instructing the model to produce its final answer |
| `MAX_COST_PER_SECTION` | `0.50` USD | Aborts the run if exceeded |
| `MAX_RUNTIME_MS` | `5 * 60_000` | Wall-clock deadline; abort the controller |
| `SUMMARY_MAX_TOKENS` | `4096` | `max_tokens` on the summary slot |
| `MAX_GUARD_ATTEMPTS` | `2` | Numeric-guard retries before giving up |
| `MAX_TOKENS` (component) | `2048` | `max_tokens` on the component slot ([client.ts:5](../../apps/dashboard/src/lib/ai-insight/client.ts#L5)) |

### 7.1 Component prompt build

For each component the orchestrator concatenates ([prompts.ts:249-277](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L249-L277)):

```
<DB-loaded component prompt — describes this card and its thresholds>
Page: <pageName>
Section: <sectionName>
Component: <componentName> (<componentType>)
<Date Range: yyyy-mm-dd to yyyy-mm-dd | Fiscal Period: FYxxxx (fy|last12|ytd) | Scope: Snapshot — current state>

Current Values:
<formattedValues from the fetcher — pre-formatted markdown>
```

System prompt for the component slot: `component_analysis` row (Module-owned default text). Component slot is called with **no tools** — components only narrate the pre-fetched data ([orchestrator.ts:204-213](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L204-L213)).

### 7.2 Summary prompt build

The summary slot is called once per attempt. The user prompt is **not** the concatenated component analyses — it is the **raw fetcher data**, plus each component's "About" prompt as authoritative thresholds ([prompts.ts:181-247](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L181-L247)):

```
Section: <sectionName>
Page: <pageName>
<scope line>
Generated: <YYYY-MM-DD HH:MM>

<Guidance block — only if section guidance row is non-empty>

---

Tool budget for this run: at most 2 tool calls. Use the RAW DATA first; call a
tool only when a specific driver is not already named in the raw data blocks.

### Component 1: <name> (<type>)

About:
"""
<DB-loaded component prompt>
"""

Raw Data:
<raw_data_md from fetcher>

### Component 2: …

---

Produce the summary now using the ===INSIGHT=== delimiter format.
```

Two consequences:

1. Hallucinations the component slot may have introduced cannot leak into the summary, because the summary never sees the component prose ([orchestrator.ts:255-268](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L255-L268)).
2. Section Guidance is optional: when `getSectionGuidance(sectionKey)` returns `null` (no DB row or empty text after trim), the Guidance block is omitted entirely ([prompts.ts:222-230](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L222-L230), [prompt-loader.ts:175-186](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts#L175-L186)). This matches the rollout policy in [ROLLOUT_TRACKER.md:115-119](../../AI_Insight_Study/ROLLOUT_TRACKER.md#L115-L119).

### 7.3 Cache control

When `process.env.AI_INSIGHT_VALIDATION_BASELINE === '1'`, `cacheSystem` is set to `false` on every `callAiModel` call, stripping the cache-control hint passed via OpenRouter ([orchestrator.ts:49-50](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L49-L50), [orchestrator.ts:212](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L212)). Default (unset) keeps caching on so iteration costs stay low.

### 7.4 Output parsing

[orchestrator.ts:486-573](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L486-L573). The summary text is split on `===INSIGHT===` blocks; each block is split on `---DETAIL---` to separate header (sentiment, title, metric, summary) from the markdown detail body. Blocks are capped at 3 good + 3 bad. If no `===INSIGHT===` blocks are found, the parser tries to fall back to a JSON envelope `{ good[], bad[] }`; if even that fails it returns a single `good[]` insight whose `detail` is the raw model text ([orchestrator.ts:534-562](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L534-L562)).

### 7.5 Numeric guard

[numeric-guard.ts](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts). For each summary attempt the orchestrator aggregates `allowed: AllowedValue[]` across every component's fetcher result, plus every numeric token that appeared in any tool result during the same attempt (registered under all four units; tool results are treated as ground truth — [orchestrator.ts:333-341](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L333-L341)). Then:

- `extractNumbers(text)` finds every RM amount, percent, days, count token in the summary text, after stripping `YYYY-MM-DD`-style dates and similar date patterns ([numeric-guard.ts:13-95](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L13-L95)).
- Each found number is checked against the whitelist (`matchesAllowed`), with absolute and 5% relative tolerance for RM display rounding ([numeric-guard.ts:148-181](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L148-L181)).
- Two soft passes: derived percentages (any ratio `a/b * 100` of two whitelisted values) and supported lower-bound phrases ("over X days", "more than RM Y") whose whitelist contains a value beyond the bound ([numeric-guard.ts:183-210](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L183-L210)).
- Safe-integer whitelist for counts: `{0,1,…,12, 30, 60, 80, 90, 100, 120, 365}` ([numeric-guard.ts:19](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L19), [numeric-guard.ts:218](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L218)).
- Default tolerances per unit: RM ±1, pct ±0.1, days ±0.1, count ±0.5 ([numeric-guard.ts:4-9](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L4-L9)). Fetchers can override per-value via `tolerance?: number` on `AllowedValue` ([types.ts:141-146](../../apps/dashboard/src/lib/ai-insight/types.ts#L141-L146)).
- If any number is unmatched and we have attempts remaining, the orchestrator appends `formatGuardError(unmatched)` as a new user message and replays the summary loop ([orchestrator.ts:343-354](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L343-L354), [numeric-guard.ts:228-231](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L228-L231)).
- On final failure the parsed output is kept and `summary_json.numericGuard = { passed: false, attempts: 2, unmatched: [...] }` is recorded; nothing is silently dropped ([orchestrator.ts:360-365](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L360-L365)).

### 7.6 Cost & runtime caps

Cost is accumulated component-by-component; the run aborts with `Cost limit exceeded: $X > $0.5` if any component pushes total cost above `MAX_COST_PER_SECTION` ([orchestrator.ts:110-112](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L110-L112)). Runtime is policed by a `setTimeout` that calls `abortController.abort()` after 5 minutes; in-flight component / summary calls observe the abort signal and throw `Analysis timed out. Please try again.` ([orchestrator.ts:86-91](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L86-L91), [orchestrator.ts:122-123](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L122-L123)).

---

## 8. Prompt Contracts — Registry, Versioning, Cache, Seeding

### 8.1 Tables

```sql
CREATE TABLE ai_insight_prompts (              -- migration 016, mutated by 019/020/021
  prompt_key       TEXT PRIMARY KEY,
  prompt_text      TEXT NOT NULL,              -- denormalised cache of selected version's body
  category         TEXT NOT NULL CHECK (category IN ('system','component','section_guidance')),
  page             TEXT,
  section_key      TEXT,
  section_name     TEXT,
  component_type   TEXT,                       -- 'kpi'|'chart'|'table'|'breakdown'|NULL
  display_name     TEXT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       TEXT,
  selected_version_id INTEGER REFERENCES ai_insight_prompt_versions(id) ON DELETE SET NULL
);

CREATE TABLE ai_insight_prompt_versions (      -- migration 020
  id                  SERIAL PRIMARY KEY,
  prompt_key          TEXT NOT NULL REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE,
  version_label       TEXT NOT NULL,           -- e.g. "Default" or "feedback-apply · May 10, 9:21 PM"
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_text         TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT,
  source_feedback_id  INTEGER                  -- NOT a FK; feedback rows are deleted on apply
);
CREATE UNIQUE INDEX idx_prompt_versions_one_default
  ON ai_insight_prompt_versions(prompt_key) WHERE is_default = TRUE;
```

Sources: [migrations/016_ai_insight_prompts.sql](../../migrations/016_ai_insight_prompts.sql), [migrations/019_ai_insight_section_guidance.sql](../../migrations/019_ai_insight_section_guidance.sql), [migrations/020_prompt_versions.sql](../../migrations/020_prompt_versions.sql), [migrations/021_ai_insight_system_prompt_keys.sql](../../migrations/021_ai_insight_system_prompt_keys.sql).

The non-empty `CHECK` constraint on `prompt_text` was dropped in migration 020 because HR scaffold rows ship blank by design; see [migrations/020_prompt_versions.sql:62-68](../../migrations/020_prompt_versions.sql#L62-L68).

### 8.2 Categories and prompt-key conventions

| Category | Prompt key convention | Examples |
|---|---|---|
| `system` | named slot | `component_analysis`, `summary_analysis`, `hr_component_analysis`, `hr_summary_analysis`, `feedback_router`, `surgical_editor` |
| `component` | `<component_key>` | `avg_collection_days`, `total_outstanding`, `net_sales`, … |
| `section_guidance` | `<section_key>_guidance` | `payment_collection_trend_guidance`, `sales_breakdown_guidance`, … |

Migration 021 renamed the legacy system keys: `global_system→component_analysis`, `summary_system→summary_analysis`, `feedback_router_system→feedback_router`, `surgical_editor_system→surgical_editor` ([migrations/021_ai_insight_system_prompt_keys.sql:22-29](../../migrations/021_ai_insight_system_prompt_keys.sql#L22-L29)). Both old and new keys are accepted by the loader fallbacks so an in-flight rename never blanks a prompt ([prompt-loader.ts:124-154](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts#L124-L154)).

### 8.3 Selected version semantics

Each `ai_insight_prompts` row has a `selected_version_id` pointing into `ai_insight_prompt_versions`. The runtime hot path reads only `ai_insight_prompts.prompt_text` (the denormalised cache); a write to `selected_version_id` is always paired with a write to `prompt_text` in the same transaction so the cache cannot diverge ([prompt-store.ts:172-180](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L172-L180), [prompt-store.ts:222-230](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L222-L230)).

`VERSION_CAP = 6` — 1 Default + up to 5 user versions per prompt key. Enforced in `insertVersionAndSelect()` with a `SELECT COUNT(*) FROM ai_insight_prompt_versions WHERE prompt_key = $1` under `FOR UPDATE` lock so concurrent applies cannot both pass the check ([prompt-store.ts:23-25](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L23-L25), [prompt-store.ts:136-153](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L136-L153)).

When the cap is reached the apply endpoint returns `400 { error: 'VERSION_CAP_REACHED', message: 'The prompt version section is full. Please clear unwanted versions before proceeding with this action.' }` ([api/admin/ai-insight-feedback/[id]/apply/route.ts:54-65](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/apply/route.ts#L54-L65)).

### 8.4 In-memory snapshot cache

[prompt-loader.ts](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts). A single `Snapshot { loadedAt, byKey: Map, rows: PromptRow[] }` is held in module state; it is re-loaded if older than `CACHE_TTL_MS = 30_000` ([prompt-loader.ts:21](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts#L21), [prompt-loader.ts:95-116](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts#L95-L116)). On DB miss or error, an empty snapshot is cached briefly to avoid per-request warnings, and every getter falls back to the module-default text ([prompt-loader.ts:104-111](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts#L104-L111), [prompt-loader.ts:128-129](../../apps/dashboard/src/lib/ai-insight/prompt-loader.ts#L128-L129)).

Every write helper (`insertVersionAndSelect`, `selectVersion`, `deleteVersion`) calls `invalidateCache()` so the next read repopulates the snapshot ([prompt-store.ts:183](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L183), [prompt-store.ts:232](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L232), [prompt-store.ts:329](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L329)).

### 8.5 Seeding

POST `/api/admin/ai-insight-prompts/seed-defaults` is idempotent: every default row is inserted via `INSERT … ON CONFLICT (prompt_key) DO NOTHING`. It is safe to call repeatedly and only fills gaps ([api/admin/ai-insight-prompts/seed-defaults/route.ts:182-205](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L182-L205)). After the prompt rows exist, the same handler runs a second `INSERT … SELECT … WHERE NOT EXISTS` to give every prompt-key a Default version row and point `selected_version_id` at it ([api/admin/ai-insight-prompts/seed-defaults/route.ts:210-238](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L210-L238)).

Seed input is built from the Module's defaults map plus `SECTION_COMPONENTS` / `SECTION_NAMES` / `SECTION_PAGE` ([api/admin/ai-insight-prompts/seed-defaults/route.ts:41-153](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L41-L153)). Every section produces:

- 1 `section_guidance` row, `sort_order = 0` (rendered above components in the tree).
- N `component` rows, `sort_order = idx + 1`.

Guidance rows are always seeded even when the default body is blank (e.g. Finance currently ships empty Guidance prompts; HR scaffolds also blank) — this keeps the tree entry visible so feedback can fill them later without breaking the routing enum ([api/admin/ai-insight-prompts/seed-defaults/route.ts:118-129](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L118-L129)).

---

## 9. Feedback Lifecycle

### 9.1 Capture (user)

User clicks **Feedback** in the open AI panel. The `FeedbackModal` collects free-text, validates against `FEEDBACK_MAX_WORDS = 80`, and POSTs to `/api/ai-insight/feedback` ([FeedbackModal.tsx:53-82](../../apps/dashboard/src/components/ai-insight/FeedbackModal.tsx#L53-L82), [word-count.ts:4](../../apps/dashboard/src/lib/ai-insight/word-count.ts#L4)).

Screenshot: [screenshots/payment/ai-insight-feedback-modal.png](screenshots/payment/ai-insight-feedback-modal.png).

### 9.2 Router (Phase 1)

The user-facing endpoint validates body, then calls `routeFeedback({ section_key, page, raw_feedback })` ([api/ai-insight/feedback/route.ts:22-90](../../apps/dashboard/src/app/api/ai-insight/feedback/route.ts#L22-L90)).

`routeFeedback()` ([feedback-llm.ts:44-123](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L44-L123)) calls `callAiModel({ slot: 'feedback_router', toolChoice: { type: 'tool', name: 'select_target' }, … })` with a single tool whose `input_schema.target_prompt_key.enum` is `[...sectionComponentKeys, '<section_key>_guidance']`. Forced tool use + enum-scoping means the model cannot pick a target outside the section. Validation rejects any return value that is not in the enum ([feedback-llm.ts:117-120](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L117-L120)).

The user feedback is stored verbatim — there is no rewrite/compaction step. Both `raw_feedback` and the legacy `compact_feedback` column are set to the same trimmed string ([api/ai-insight/feedback/route.ts:58-77](../../apps/dashboard/src/app/api/ai-insight/feedback/route.ts#L58-L77)).

```sql
INSERT INTO ai_insight_feedback (section_key, page, raw_feedback, compact_feedback,
                                  target_prompt_key, submitted_by)
VALUES (...)
RETURNING id;
```

Returned to the client: `{ ok: true, id, target_prompt_key }`. The panel shows a toast "Feedback sent. Thank you."

### 9.3 Triage (admin)

Admin opens `/admin/ai-insight-config`, navigates to the prompt the feedback was routed to (badged with a blue count). The Feedback List shows the raw text + Apply / Discard ([FeedbackList.tsx:71-126](../../apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx#L71-L126)).

### 9.4 Apply preview (Phase 2)

Admin clicks **Apply** → POST `/.../feedback/{id}/preview` ([api/admin/ai-insight-feedback/[id]/preview/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/preview/route.ts)):

1. Load feedback + currently-selected prompt body via SQL JOIN.
2. Call `proposeSurgicalEdit({ current_prompt_text, compact_feedback, prompt_display_name })` ([feedback-llm.ts:141-225](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L141-L225)) — a forced-tool call to the `surgical_editor` slot whose tool returns `{ proposed_text: string, change_summary: string (≤100 chars) }`.
3. Return `{ id, targetPromptKey, currentText, proposedText, changeSummary }`. **Nothing is written to the DB yet.**

The browser opens the [DiffModal](../../apps/dashboard/src/components/admin/ai-insight-config/DiffModal.tsx).

### 9.5 Apply confirm

Admin clicks **Confirm & apply** in the DiffModal → POST `/.../feedback/{id}/apply` with body `{ proposedText, updatedBy }` ([api/admin/ai-insight-feedback/[id]/apply/route.ts:30-72](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/apply/route.ts#L30-L72)):

1. Re-fetch feedback row's `target_prompt_key` (so an admin can't redirect the edit).
2. `insertVersionAndSelect({ promptKey, promptText, createdBy: 'feedback-apply', sourceFeedbackId })` — single transaction that
   - locks the prompts row `FOR UPDATE`,
   - checks `count(*) < VERSION_CAP = 6`,
   - inserts a new `ai_insight_prompt_versions` row (`is_default = FALSE`, auto-generated label),
   - updates `ai_insight_prompts.selected_version_id` + `prompt_text` cache,
   - calls `invalidateCache()` ([prompt-store.ts:127-196](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L127-L196)).
3. `DELETE FROM ai_insight_feedback WHERE id = $1`. This is a separate query because the worst-case (version inserted but delete fails) just leaves a pending feedback row that an admin can discard manually — preferable to holding a long-running write tx across two helpers ([api/admin/ai-insight-feedback/[id]/apply/route.ts:68-72](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/apply/route.ts#L68-L72)).

`change_summary` is shown to the admin in the DiffModal banner but **is not persisted** in any DB column. There is no audit trail; feedback rows are gone after apply or discard.

### 9.6 Discard

Admin clicks **Discard** → DELETE `/.../feedback/{id}` → `DELETE FROM ai_insight_feedback WHERE id = $1` ([api/admin/ai-insight-feedback/[id]/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/route.ts)). Permanent. No soft-delete column. No audit trail.

### 9.7 No automatic re-evaluation

Applying or selecting a new prompt version does **not** automatically re-run the section analysis. Stored `ai_insight_section` rows continue to reference the old text via their `summary_json` snapshot until the next manual Analyze click. The decision is intentional — re-analysis is a paid action and should be operator-initiated.

---

## 10. Model Gateway & OpenRouter

OpenRouter is the only model gateway. Direct Anthropic SDK use was removed during the 2026-05-11 migration documented in [AI_Insight_Study/OPENROUTER_ONLY_PLAN.md](../../AI_Insight_Study/OPENROUTER_ONLY_PLAN.md). The OpenAI SDK is not used either. If the production rebuild's stack is not Node.js / TypeScript, the gateway can be re-implemented in any language — the contract below is what matters.

### 10.1 Four slots

[model-provider.ts:32](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L32):

```ts
type AiModelSlot = 'component' | 'summary' | 'feedback_router' | 'surgical_editor';
```

| Slot | Used in | Tools | `max_tokens` |
|---|---|---|---|
| `component` | `analyzeComponent()` — narrate one card's pre-fetched data | No | `MAX_TOKENS = 2048` |
| `summary` | `runSummaryAnalysis()` — synthesise section insight, may use SQL tools | Yes (per `tool-policy`, cap 2 calls) | `SUMMARY_MAX_TOKENS = 4096` |
| `feedback_router` | `routeFeedback()` — pick the prompt key feedback targets | Forced `select_target` tool | `ROUTER_MAX_TOKENS = 256` ([feedback-llm.ts:29](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L29)) |
| `surgical_editor` | `proposeSurgicalEdit()` — minimal-edit a prompt | Forced `propose_edit` tool | `SURGICAL_EDITOR_MAX_TOKENS = 4096` ([feedback-llm.ts:32](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L32)) |

### 10.2 Per-slot model fallback chain

`openRouterModelsForSlot(slot)` ([model-provider.ts:391-403](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L391-L403)):

| Slot | Primary (env override) | Fallback chain |
|---|---|---|
| `component` | `deepseek/deepseek-v4-flash` (`AI_INSIGHT_OPENROUTER_COMPONENT_MODEL`) | `anthropic/claude-haiku-latest` (`..._COMPONENT_FALLBACK_MODEL`) |
| `feedback_router` | same as component slot by default | same as component fallback by default |
| `summary` | `z-ai/glm-5.1` (`AI_INSIGHT_OPENROUTER_SUMMARY_MODEL`) | `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-latest` (`..._SUMMARY_FALLBACK_MODELS`, comma-separated) |
| `surgical_editor` | same as summary slot by default | same as summary fallbacks by default |

Defaults are in [client.ts:14-42](../../apps/dashboard/src/lib/ai-insight/client.ts#L14-L42). The fallback chain is tried in order; an attempt fails over only on **technical** errors classified by `isOpenRouterFallbackStatus()`: HTTP 408 / 409 / 429 / 5xx, connection errors, request timeouts, or messages matching `/unavailable|no endpoint|no provider|model.*not.*available|provider.*not.*available|provider.*support|required parameter|require.*parameter|unsupported.*parameter/i` ([model-provider.ts:458-462](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L458-L462)). Weak analysis, hallucinated arithmetic, low quality scores **never** trigger a fallback — those are handled by the numeric guard retry loop and the rollout acceptance gate.

When the entire chain is exhausted, `callAiModel()` throws `OpenRouterProviderError: OpenRouter model fallback exhausted: …` and the orchestrator surfaces this via the SSE `error` event ([model-provider.ts:127-132](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L127-L132)).

### 10.3 Per-slot OpenRouter provider order

`openRouterProviderForSlot(slot, model)` ([model-provider.ts:405-415](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L405-L415)) picks one of three orders depending on the model namespace and slot:

- **Component / feedback_router / non-anthropic models** ([model-provider.ts:87-95](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L87-L95)):
  ```
  parasail/fp8 → atlas-cloud/fp8 → deepseek → deepinfra/fp4 → siliconflow/fp8 → akashml/fp8 → novita
  ```
- **Summary / surgical_editor / non-anthropic models** ([model-provider.ts:97-103](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L97-L103)):
  ```
  deepinfra/fp4 → siliconflow/fp8 → friendli → atlas-cloud/fp8 → z-ai
  ```
- **Any anthropic/* model (regardless of slot)** ([model-provider.ts:105](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L105)):
  ```
  Anthropic
  ```

Provider preferences passed to every OpenRouter call ([model-provider.ts:417-424](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L417-L424)):

```ts
{
  order: <one of the three lists above>,
  allowFallbacks: false,           // do not route outside the approved order
  requireParameters: true,         // skip providers that drop required fields
  dataCollection: 'deny'           // opt out of data retention
}
```

Plus `reasoning: { effort: 'none' }` to disable hidden reasoning tokens on models that support it ([model-provider.ts:196](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L196)).

Per-call timeout: `OPENROUTER_TIMEOUT_MS = 45_000` ms (env override: `AI_INSIGHT_OPENROUTER_TIMEOUT_MS`) ([client.ts:11-12](../../apps/dashboard/src/lib/ai-insight/client.ts#L11-L12), [model-provider.ts:201-204](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L201-L204)).

### 10.4 Response metadata

Every `AiModelResponse.providerMeta` ([types.ts:112-130](../../apps/dashboard/src/lib/ai-insight/types.ts#L112-L130)) carries:

| Field | Source |
|---|---|
| `sdk: 'openrouter'` | constant |
| `providerLabel: 'OpenRouter'` | constant |
| `model` | `response.model` returned by OpenRouter |
| `requestedModel` | the slot model we asked for |
| `upstreamProvider` | from `response.openrouterMetadata.attempts[*].provider` (last successful) |
| `providerOrder` | echoes the provider preference array |
| `providerFallbackPath` | the full sequence of attempted providers from OpenRouter's metadata |
| `modelFallbackPath` | the sequence of attempted model slugs (length ≥ 1) |
| `modelFallbackUsed` | `modelFallbackPath.length > 1` |
| `fallbackUsed` | provider or model fallback used |
| `fallbackReason` | error message from the last failed model attempt, when applicable |
| `costSource` | `'openrouter_usage_cost'` if `response.usage.cost` was numeric; else `'local_estimate'` |
| `reasoningTokens` | `response.usage.completionTokensDetails.reasoningTokens` when present |

For the section summary call, the orchestrator combines per-call meta into `summarizeProviderMetadata(metas, primary)` ([model-provider.ts:135-164](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L135-L164)) and writes it into `summary_json.providerMeta`, which the panel footer then renders ([orchestrator.ts:365](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L365)).

### 10.5 Cost computation

`costUsd = response.usage.cost` when OpenRouter returns it (the source-of-truth path). Otherwise a per-model `PRICING` table is used ([client.ts:61-79](../../apps/dashboard/src/lib/ai-insight/client.ts#L61-L79)):

```
claude-haiku-4-5-20251001          : $0.80 / $4.00     per 1M input / output
claude-sonnet-4-5-20250514         : $3.00 / $15.00
claude-sonnet-4-6                  : $3.00 / $15.00
anthropic/claude-haiku-latest      : $0.80 / $4.00
anthropic/claude-sonnet-latest     : $3.00 / $15.00
deepseek/deepseek-v4-flash         : $0.14 / $0.28
deepseek/deepseek-v4-pro           : $1.00 / $3.00
z-ai/glm-5.1                       : $1.05 / $3.50
```

Local fallback to the haiku-priced bucket when no entry matches ([client.ts:73-79](../../apps/dashboard/src/lib/ai-insight/client.ts#L73-L79)).

### 10.6 Internal type system

All call sites use provider-neutral types ([types.ts:74-110](../../apps/dashboard/src/lib/ai-insight/types.ts#L74-L110)):

```ts
type AiRole = 'user' | 'assistant';
interface AiTextBlock      { type: 'text'; text: string }
interface AiToolUseBlock   { type: 'tool_use'; id: string; name: string; input: unknown }
interface AiToolResultBlock{ type: 'tool_result'; tool_use_id: string; content: string }
interface AiMessage        { role: AiRole; content: string | AiMessageContentBlock[] }
interface AiTool           { name: string; description: string; input_schema: Record<string, unknown> }
type AiToolChoice          = { type: 'tool'; name: string } | { type: 'any' } | { type: 'auto' }
```

`toOpenRouterMessages()` converts between these and OpenRouter chat-completion shape: tool-use turns become assistant `tool_calls`; tool-result blocks become `role: 'tool'` messages with `toolCallId` ([model-provider.ts:270-321](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L270-L321)). `normalizeOpenRouterContent()` reverses the conversion on the response side ([model-provider.ts:343-389](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L343-L389)).

A production rebuild on a different stack can implement the same gateway by:

1. Defining the four slots and their primary / fallback chains as configuration.
2. Posting to OpenRouter's `/api/v1/chat/completions` with the slot's `provider.order`, `allowFallbacks: false`, `requireParameters: true`, `dataCollection: 'deny'`.
3. Normalising the response to the internal `AiContentBlock[]` shape so the orchestrator does not need provider knowledge.
4. Capturing the metadata fields in §10.4 for logging and the panel footer.

---

## 11. Data Provider Contract

The Base engine never reads from a domain table directly. Every component has a fetcher function that produces a `FetcherResult`. The Module owns the fetcher implementations and the resolution table; the Base defines only the contract.

### 11.1 Contract

[types.ts:139-151](../../apps/dashboard/src/lib/ai-insight/types.ts#L139-L151):

```ts
type AllowedValueUnit = 'RM' | 'pct' | 'days' | 'count';

interface AllowedValue {
  label: string;          // human-readable description, e.g. "H1 avg neg gap"
  value: number;          // raw numeric value (RM = ringgit, pct = 0-100, days, count)
  tolerance?: number;     // absolute tolerance; defaults applied by numeric guard if omitted
  unit?: AllowedValueUnit;
}

interface FetcherResult {
  prompt: string;         // pre-formatted markdown to splice into the user prompt
  allowed: AllowedValue[];// numeric whitelist for the numeric guard
}
```

The orchestrator calls a single `fetchComponentData(componentKey, sectionKey, dateRange, fiscalPeriod) → Promise<FetcherResult>` ([orchestrator.ts:176-177](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L176-L177)). The Module owns the dispatch (a switch on `componentKey`).

### 11.2 Prompt formatting rules

The `prompt` string from a fetcher is spliced verbatim into the component user prompt under "Current Values:" ([prompts.ts:275-276](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L275-L276)) and into the summary user prompt under "Raw Data:" ([prompts.ts:213-214](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L213-L214)). Conventions used by Finance and reused as expectations for HR:

- Use plain text and short markdown — no fenced code blocks unless quoting JSON / SQL.
- Every numeric value cited in the prompt **must** also appear in `allowed[]` with the right unit. The numeric guard is the safety net.
- Pre-compute totals, ranks, deltas, ratios, half-period averages, streaks, peak / trough labels. The summary model is explicitly told it has at most 2 tool calls and should not back-solve.
- Use unambiguous scope labels: `(period)`, `(snapshot)`, `(active universe only)`, `(top 5)`, etc., to prevent the model from mixing populations.
- Single source of truth per dimension: if a section has both a chart and a KPI for the same number, prefer one fetcher to provide the canonical value and the other to cite it explicitly.

### 11.3 Whitelist composition

`runSummaryAnalysis()` flattens `allowed[]` across every component into a single section whitelist, then unions in every numeric token that appears in tool results during the same attempt ([orchestrator.ts:295](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L295), [orchestrator.ts:333-341](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L333-L341)). The guard then validates the parsed summary text against this combined whitelist.

Tool result numbers are registered under all four units because tool results return bare numeric tokens (no `RM` / `%` / `days` suffix); the orchestrator uses the permissive `extractToolResultNumbers()` rather than the labeled `extractNumbers()` for them ([numeric-guard.ts:97-114](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts#L97-L114)).

---

## 12. Tool Catalog & Policy

### 12.1 Tools

Defined in [tools.ts:92-167](../../apps/dashboard/src/lib/ai-insight/tools.ts#L92-L167). Two functions, both row-limited to 100 ([tools.ts:33](../../apps/dashboard/src/lib/ai-insight/tools.ts#L33)).

**`query_local_table`** — read a pre-computed local PostgreSQL table. The table name must be one of the 15 `pc_*` keys in `LOCAL_WHITELIST` ([tools.ts:6-22](../../apps/dashboard/src/lib/ai-insight/tools.ts#L6-L22)):

```
pc_sales_daily, pc_sales_by_customer, pc_sales_by_outlet, pc_sales_by_fruit,
pc_ar_monthly, pc_ar_customer_snapshot, pc_ar_aging_history,
pc_customer_margin, pc_supplier_margin,
pc_return_monthly, pc_return_products, pc_return_aging, pc_return_by_customer,
pc_expense_monthly, pc_pnl_period
```

Each table has a closed column allowlist; any column not listed for that table is rejected with `Columns not allowed for <table>: <list>. Allowed: <whitelist>` ([tools.ts:180-188](../../apps/dashboard/src/lib/ai-insight/tools.ts#L180-L188)).

Special case: `pc_ar_customer_snapshot` is auto-deduplicated to the latest `snapshot_date` and uses `DISTINCT ON (debtor_code)` so the LLM sees one row per debtor without having to write the dedup itself ([tools.ts:218-238](../../apps/dashboard/src/lib/ai-insight/tools.ts#L218-L238)).

**`query_rds_table`** — read a remote SQL Server (RDS) table. Six allowed tables ([tools.ts:24-31](../../apps/dashboard/src/lib/ai-insight/tools.ts#L24-L31)):

```
dbo.IV, dbo.CS, dbo.CN, dbo.ARInvoice, dbo.ARPayment, dbo.ARPaymentKnockOff
```

Five of these store a `Cancelled` column; the tool both instructs the LLM to include `Cancelled = 'F'` in the WHERE clause **and** injects it server-side via `ensureRdsCancelledFilter()` so a cancelled document can never leak into analysis ([tools.ts:39-45](../../apps/dashboard/src/lib/ai-insight/tools.ts#L39-L45), [tools.ts:81-88](../../apps/dashboard/src/lib/ai-insight/tools.ts#L81-L88), [tools.ts:263](../../apps/dashboard/src/lib/ai-insight/tools.ts#L263)). The 6th table (`ARPaymentKnockOff`) has no Cancelled column and is excluded from the injection.

### 12.2 WHERE / ORDER BY safety blocklist

Any `where_clause` or `order_by` supplied by the LLM is checked against a token blocklist ([tools.ts:50-79](../../apps/dashboard/src/lib/ai-insight/tools.ts#L50-L79)). Matching any pattern returns a structured error message back to the LLM (which the orchestrator records as `Error executing query…` in the section log):

```
;   --   /*   */   UNION   SELECT   INSERT   UPDATE   DELETE
DROP   TRUNCATE   ALTER   EXEC   EXECUTE   GRANT   REVOKE
xp_*   sp_*
```

(18 patterns total; case-insensitive.) Parameter placeholders `$1, $2, …` are allowed; the `params` array supplies their values.

### 12.3 Tool policy levels

[tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts). Each section is mapped to one of three policies — Module owns the section → policy map ([tool-policy.ts:6-31](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L6-L31)):

| Policy | Tools exposed | Validation |
|---|---|---|
| `none` | `[]` — no tools at all | Any tool call is impossible because the slot is invoked without `tools` |
| `aggregate_only` | `query_local_table` only, with `table.enum` restricted to 9 pre-aggregated `pc_*` tables (`AGGREGATE_LOCAL_TABLES`, [tool-policy.ts:33-43](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L33-L43)) | Server-side `validateToolForSection()` rejects calls to other tables or to `query_rds_table` ([tool-policy.ts:73-89](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L73-L89)) |
| `full` | both tools, all whitelisted tables | No additional policy validation; column whitelists from §12.1 still apply |

The orchestrator calls `toolsForSection(sectionKey)` to get the per-slot tool array, and runs every tool block through `validateToolForSection()` before execution. A rejection becomes a tool result string the model can read on the next turn (so it learns to back off without crashing the run) ([orchestrator.ts:454-466](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L454-L466)).

The runtime tool-call cap is enforced separately by the orchestrator (`MAX_TOOL_CALLS_PER_SUMMARY = 2`); when reached the orchestrator appends a final user message telling the model to produce its final summary without more drill-down ([orchestrator.ts:476-481](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L476-L481)).

---

## 13. Guardrails Actually Implemented

A complete list of guardrails the engine enforces. Anything not on this list is **not** implemented and is **not** a P0 for the production rebuild.

| Guardrail | Mechanism | Source |
|---|---|---|
| Concurrency | Pool of `MAX_CONCURRENCY = 2` parallel component calls | [orchestrator.ts:41](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L41), [orchestrator.ts:122-138](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L122-L138) |
| Tool-call cap | `MAX_TOOL_CALLS_PER_SUMMARY = 2`, with a final "produce your summary now" user message on cap-hit | [orchestrator.ts:42](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L42), [orchestrator.ts:476-481](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L476-L481) |
| Cost cap | `MAX_COST_PER_SECTION = 0.50` USD; abort with error if exceeded | [orchestrator.ts:43](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L43), [orchestrator.ts:110-112](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L110-L112) |
| Runtime cap | `MAX_RUNTIME_MS = 5 min` wall-clock; `abortController.abort()` on timeout | [orchestrator.ts:44](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L44), [orchestrator.ts:86-91](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L86-L91) |
| Singleton lock | `ai_insight_lock` row id=1, 6-min stale TTL | [lock.ts](../../apps/dashboard/src/lib/ai-insight/lock.ts), §16 |
| Output parser | `===INSIGHT===` block scanner; caps `good[≤3]` + `bad[≤3]`; tolerant of JSON fallback | [orchestrator.ts:486-573](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L486-L573) |
| Numeric guard | Extract → match → derived-pct / lower-bound passes → retry up to 2 attempts → record `numericGuard` regardless | [numeric-guard.ts](../../apps/dashboard/src/lib/ai-insight/numeric-guard.ts), [orchestrator.ts:297-365](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L297-L365) |
| Tool column whitelist | Per-table fixed allowlist; rejection returns structured error to the LLM | [tools.ts:180-188](../../apps/dashboard/src/lib/ai-insight/tools.ts#L180-L188) |
| WHERE / ORDER BY blocklist | 18-pattern token check against statement separators and DDL/DML/admin keywords | [tools.ts:50-79](../../apps/dashboard/src/lib/ai-insight/tools.ts#L50-L79) |
| RDS `Cancelled='F'` injection | Server-side WHERE-clause rewrite on five RDS tables | [tools.ts:81-88](../../apps/dashboard/src/lib/ai-insight/tools.ts#L81-L88) |
| Tool row limit | `min(input.limit ?? 100, 100)` | [tools.ts:33](../../apps/dashboard/src/lib/ai-insight/tools.ts#L33), [tools.ts:215](../../apps/dashboard/src/lib/ai-insight/tools.ts#L215), [tools.ts:265](../../apps/dashboard/src/lib/ai-insight/tools.ts#L265) |
| Feedback word limit | `FEEDBACK_MAX_WORDS = 80`, enforced client and server | [word-count.ts:4](../../apps/dashboard/src/lib/ai-insight/word-count.ts#L4), [api/ai-insight/feedback/route.ts:45-50](../../apps/dashboard/src/app/api/ai-insight/feedback/route.ts#L45-L50) |
| Router enum scoping | `select_target.target_prompt_key.enum` = section's component keys + guidance key | [feedback-llm.ts:88-100](../../apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L88-L100) |
| Version cap | `VERSION_CAP = 6` per prompt key, enforced under `FOR UPDATE` | [prompt-store.ts:23-25](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L23-L25), [prompt-store.ts:136-153](../../apps/dashboard/src/lib/ai-insight/prompt-store.ts#L136-L153) |
| Provider fallback policy | `allowFallbacks: false`, fail-over only on technical errors | [model-provider.ts:417-462](../../apps/dashboard/src/lib/ai-insight/model-provider.ts#L417-L462) |
| Per-call timeout | `OPENROUTER_TIMEOUT_MS = 45 s` | [client.ts:11-12](../../apps/dashboard/src/lib/ai-insight/client.ts#L11-L12) |

Out of scope (not implemented; do not add to production rebuild unless newly approved):

- Evidence-label allowlist / "evidence guard"
- PII filter / privacy guard
- RBAC user-scoped data filter
- Per-user / per-role data limits beyond the singleton lock
- Run-log database table (a `logs/ai-debug-*.log` file is written instead; see §14.5)
- Evaluation-result database table (rollout evaluations live in [AI_Insight_Study/](../../AI_Insight_Study/) as markdown)
- Persistent audit trail on feedback (rows are deleted on apply / discard)
- Automatic section re-evaluation trigger on prompt apply
- Scoped-by-section lock key (the lock is still a global singleton)
- Per-component re-run endpoint
- Persistence of `change_summary` on prompt-version rows (it is shown in the DiffModal banner only)

---

## 14. Persistence & Cost/Token Logging

### 14.1 `ai_insight_lock` (singleton row)

```sql
CREATE TABLE ai_insight_lock (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  locked_by    TEXT,
  locked_at    TIMESTAMPTZ,
  section_key  TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO ai_insight_lock (id) VALUES (1) ON CONFLICT DO NOTHING;
```

[sql/ai-insight-schema.sql:5-15](../../apps/dashboard/sql/ai-insight-schema.sql#L5-L15). See §16 for semantics.

### 14.2 `ai_insight_section`

```sql
CREATE TABLE ai_insight_section (
  id               SERIAL PRIMARY KEY,
  page             TEXT NOT NULL,
  section_key      TEXT NOT NULL,
  summary_json     JSONB NOT NULL,             -- SummaryJson incl. providerMeta, numericGuard
  analysis_time_s  NUMERIC(6,1),
  token_count      INTEGER,                    -- total tokens for the whole run
  cost_usd         NUMERIC(8,4),               -- total USD cost
  date_range_start DATE,
  date_range_end   DATE,
  fiscal_year      TEXT,                       -- "FYxxxx" when fiscal scope used
  fiscal_range     TEXT,                       -- 'fy' | 'last12' | 'ytd'
  generated_by     TEXT NOT NULL,
  generated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (page, section_key)
);
```

[sql/ai-insight-schema.sql:18-37](../../apps/dashboard/sql/ai-insight-schema.sql#L18-L37). One row per `(page, section_key)`. Re-runs DELETE+INSERT in one transaction so the cascade drops old components automatically — there is no history table ([storage.ts:18-49](../../apps/dashboard/src/lib/ai-insight/storage.ts#L18-L49)).

### 14.3 `ai_insight_component`

```sql
CREATE TABLE ai_insight_component (
  id              SERIAL PRIMARY KEY,
  section_id      INTEGER NOT NULL REFERENCES ai_insight_section(id) ON DELETE CASCADE,
  component_key   TEXT NOT NULL,
  component_type  TEXT NOT NULL,               -- 'kpi'|'chart'|'table'|'breakdown'
  analysis_md     TEXT NOT NULL,               -- markdown shown in ComponentInsightDialog
  token_count     INTEGER,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (section_id, component_key)
);
```

[sql/ai-insight-schema.sql:40-49](../../apps/dashboard/sql/ai-insight-schema.sql#L40-L49). One row per component for the latest section run. `analysis_md` is the raw markdown the component model produced — neither parsed nor pruned. Cost per component is **not** stored; only total tokens.

### 14.4 `summary_json` shape

`SummaryJson` ([types.ts:132-138](../../apps/dashboard/src/lib/ai-insight/types.ts#L132-L138)):

```ts
{
  good: SummaryInsight[],                       // 0..3
  bad: SummaryInsight[],                        // 0..3
  numericGuard?: { passed, attempts, unmatched[] },
  providerMeta?: AiProviderMetadata             // §10.4
}
```

Stored as JSONB. The panel footer reads `cost_usd` / `token_count` / `analysis_time_s` from the row, not from `summary_json` ([AiInsightPanel.tsx:243-265](../../apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L243-L265)).

### 14.5 Debug log files

When `AI_INSIGHT_DEBUG_FILE=true`, [debug-logger.ts](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts) writes a per-section log to `<cwd>/logs/ai-debug-<section_key>-<iso>.log` ([debug-logger.ts:7](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L7), [debug-logger.ts:14-40](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L14-L40)). Each log captures, per turn:

- system + user prompts ([debug-logger.ts:44-70](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L44-L70)),
- model id requested + returned, upstream provider, fallback paths, fallback reason, stop reason ([debug-logger.ts:72-129](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L72-L129)),
- token usage (input / output / cache create / cache read / reasoning) and cost with source attribution,
- tool call inputs and (truncated to 3000 chars) tool results ([debug-logger.ts:131-152](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L131-L152)),
- numeric guard attempt + unmatched values ([debug-logger.ts:258-274](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L258-L274)),
- final session summary with total tokens, total cost, provider summary ([debug-logger.ts:278-307](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L278-L307)).

These files are also the artefacts the validation/tuning workflow scores (§17). They are **not** loaded into the DB.

### 14.6 Console logging

`AI_INSIGHT_LOG_PROMPTS=true` mirrors every system and user prompt to stdout. Used during early debugging and noisy in production ([client.ts:6](../../apps/dashboard/src/lib/ai-insight/client.ts#L6), [orchestrator.ts:190-198](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L190-L198), [orchestrator.ts:270-278](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L270-L278)).

---

## 15. Streaming & API

### 15.1 User-facing endpoints

| Method | Path | Body / Query | Response | Source |
|---|---|---|---|---|
| POST | `/api/ai-insight/analyze` | `AnalyzeRequest` | SSE stream (events: `progress`, `complete`, `cancelled`, `error`) | [analyze/route.ts](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts) |
| POST | `/api/ai-insight/cancel` | `{ section_key }` | `{ message }` | [cancel/route.ts](../../apps/dashboard/src/app/api/ai-insight/cancel/route.ts) |
| GET | `/api/ai-insight/status` | — | `LockStatus { locked, locked_by, locked_at, section_key }` | [status/route.ts](../../apps/dashboard/src/app/api/ai-insight/status/route.ts) |
| GET | `/api/ai-insight/section/{section_key}` | — | `{ exists: true, …row, provider_metadata }` or `404 { exists: false }` | [section/[section_key]/route.ts](../../apps/dashboard/src/app/api/ai-insight/section/%5Bsection_key%5D/route.ts) |
| GET | `/api/ai-insight/component/{section_key}/{component_key}` | — | `{ exists: true, …row }` or `404 { exists: false }` | [component/[section_key]/[component_key]/route.ts](../../apps/dashboard/src/app/api/ai-insight/component/%5Bsection_key%5D/%5Bcomponent_key%5D/route.ts) |
| POST | `/api/ai-insight/feedback` | `{ section_key, page, raw_feedback, submitted_by? }` | `{ ok: true, id, target_prompt_key }` | [feedback/route.ts](../../apps/dashboard/src/app/api/ai-insight/feedback/route.ts) |

`AnalyzeRequest` shape ([types.ts:53-59](../../apps/dashboard/src/lib/ai-insight/types.ts#L53-L59)):

```ts
{
  page: PageKey,                                // 'payment' | 'sales' | …
  section_key: SectionKey,                      // 21 values incl. HR scaffolds
  date_range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } | null,
  fiscal_period?: { fiscalYear: 'FYxxxx', range: 'fy' | 'last12' | 'ytd' } | null,
  user_name: string                             // attribution; also lock owner
}
```

Snapshot sections (e.g. customer credit health) pass `date_range: null`; fiscal sections (Financial page) pass `date_range: null` and `fiscal_period: {…}`.

### 15.2 Admin endpoints

| Method | Path | Source |
|---|---|---|
| GET | `/api/admin/ai-insight-prompts` | [route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts) |
| GET | `/api/admin/ai-insight-prompts/{prompt_key}` | [route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/%5Bprompt_key%5D/route.ts) |
| GET | `/api/admin/ai-insight-prompts/{prompt_key}/versions` | [versions/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/%5Bprompt_key%5D/versions/route.ts) |
| DELETE | `/api/admin/ai-insight-prompts/{prompt_key}/versions/{id}` | [versions/[id]/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/%5Bprompt_key%5D/versions/%5Bid%5D/route.ts) |
| POST | `/api/admin/ai-insight-prompts/{prompt_key}/versions/{id}/select` | [versions/[id]/select/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/%5Bprompt_key%5D/versions/%5Bid%5D/select/route.ts) |
| POST | `/api/admin/ai-insight-prompts/seed-defaults` | [seed-defaults/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts) |
| GET | `/api/admin/ai-insight-feedback?prompt_key=…` (optional filter) | [route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/route.ts) |
| DELETE | `/api/admin/ai-insight-feedback/{id}` | [[id]/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/route.ts) |
| POST | `/api/admin/ai-insight-feedback/{id}/preview` | [[id]/preview/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/preview/route.ts) |
| POST | `/api/admin/ai-insight-feedback/{id}/apply` | [[id]/apply/route.ts](../../apps/dashboard/src/app/api/admin/ai-insight-feedback/%5Bid%5D/apply/route.ts) |

The admin endpoints do not check role in code — they trust the route mounting and any upstream proxy. The UI hides them behind `useRole().isAdmin`. The production rebuild should enforce authentication / authorization in the API layer; the demo is an open localhost prototype.

### 15.3 SSE framing on `analyze`

Frame format: `event: <type>\ndata: <json>\n\n`. Headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

`EventSource` is not used because the body is POST — the client reads via `fetch().body.getReader()` and splits on `\n` ([useInsightAnalysis.ts:117-148](../../apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts#L117-L148)).

### 15.4 Dynamic-render flag

Every admin / feedback / per-id route declares `export const dynamic = 'force-dynamic'` ([api/admin/ai-insight-prompts/route.ts:9](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts#L9), [api/ai-insight/feedback/route.ts:13](../../apps/dashboard/src/app/api/ai-insight/feedback/route.ts#L13), etc.). Without it, Next.js's Turbopack would attempt to statically render and cache the GET responses (which is wrong: the prompts list, the feedback list, and the section / component reads all reflect mutating DB state). The production rebuild on a non-Next stack should make the equivalent guarantee: every AI-Insight endpoint is dynamic.

### 15.5 In-process `activeControllers` map

`analyze/route.ts` keeps an in-process `Map<sectionKey, AbortController>` so `/cancel` can abort the right run ([analyze/route.ts:9-11](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L9-L11), [cancel/route.ts:14-18](../../apps/dashboard/src/app/api/ai-insight/cancel/route.ts#L14-L18)). The production rebuild on a horizontally-scaled stack will need a different cancel propagation mechanism (e.g. a notification channel keyed on the lock row, or a per-instance cancel endpoint).

---

## 16. The Singleton Lock

[lock.ts](../../apps/dashboard/src/lib/ai-insight/lock.ts). `ai_insight_lock` has exactly one row (`id = 1`). It is acquired by:

```sql
UPDATE ai_insight_lock
   SET locked_by = $1, locked_at = NOW(), section_key = $2
 WHERE id = 1
   AND (locked_by IS NULL
        OR locked_at < NOW() - INTERVAL '6 minutes')
RETURNING locked_by, locked_at, section_key;
```

[lock.ts:18-26](../../apps/dashboard/src/lib/ai-insight/lock.ts#L18-L26). The compound predicate means a stale lock (older than `STALE_LOCK_MINUTES = 6`) is auto-evicted on the next acquire attempt — necessary because a crashed Node process or a force-killed dev server may not have released the lock in `finally`.

`getLockStatus()` similarly auto-releases stale rows before returning the current state ([lock.ts:54-78](../../apps/dashboard/src/lib/ai-insight/lock.ts#L54-L78)).

Behaviour summary:

- **Single in-flight analysis per dashboard.** The lock is global, not scoped to a section — there is no concurrent multi-section analysis. The production rebuild may choose to scope it per `section_key` (an explicit non-goal for this PRD).
- **6-minute TTL** matches `MAX_RUNTIME_MS = 5 min` plus a 1-minute buffer for tear-down.
- POST `/analyze` returns `409 { error: 'Analysis is currently running', locked_by, section_key }` when acquisition fails ([analyze/route.ts:26-36](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L26-L36)).
- Release happens in the SSE `finally` block whether the run succeeded, errored, or was cancelled ([analyze/route.ts:101-104](../../apps/dashboard/src/app/api/ai-insight/analyze/route.ts#L101-L104)).
- Cancel additionally calls `releaseLock()` after aborting the controller ([cancel/route.ts:14-21](../../apps/dashboard/src/app/api/ai-insight/cancel/route.ts#L14-L21)).

---

## 17. Validation & Tuning Workflow

The engine is data-quality-sensitive: numeric trust is more valuable than insight cleverness. The team built a 14-step validation procedure that any section rollout follows. Production teams should adopt the same procedure when:

- adding a new section,
- modifying a fetcher,
- changing a system or component prompt,
- after any model swap or model-default change.

### 17.1 14-step iteration procedure

Source: [AI_Insight_Study/HOW_TO_RUN_ITERATION.md](../../AI_Insight_Study/HOW_TO_RUN_ITERATION.md).

Each iteration is owned by a single worker session and proceeds in this order:

1. **Orient (≤2 min)** — read MASTER_LOG, the iteration spec, the baseline, confirm the eval set has not drifted.
2. **Discuss with user** — describe the iteration, the root cause, the files you intend to touch, and open questions. Do not propose code yet.
3. **Plan** — write a ~15-line plan: goal, files to change, what stays the same, risk, success criteria (cost target + quality target), rollback approach.
4. **Approval** — explicit yes/no from user. No coding without it.
5. **Implement** — one focused change, no drive-by fixes.
6. **Pre-flight** — dev server up, DB snapshot matches eval fixture, `tsc --noEmit` passes.
7. **Run 2× and capture logs** — clear `ai_insight_section` + components, click Analyze via Playwright, copy the resulting `apps/dashboard/logs/ai-debug-<section>-…log` files to `AI_Insight_Study/iter<N>_run{1,2}_log.log`.
8. **Extract metrics** — `grep` total tokens, cost, latency, API turn count, tool-call count, failed tool calls, guard attempts, cache hit ratio.
9. **Score quality** against [eval_set/quality_rubric.md](../../AI_Insight_Study/eval_set/quality_rubric.md) for each run (§17.2).
10. **Decide — keep, revert, or skip** against §17.3 thresholds.
11. **Document** — copy `ITERATION_TEMPLATE.md` to `03_iteration_<NN>_<short_name>.md`; fill every section.
12. **Update MASTER_LOG** — status, Δcost vs baseline, quality, hallucinations, lessons learned, decisions.
13. **Confirm commit message with user.**
14. **Commit (or revert)** — `study(iter-N): <change> — cost $X→$Y, quality A/10→B/10`.

### 17.2 Quality rubric

[AI_Insight_Study/eval_set/quality_rubric.md](../../AI_Insight_Study/eval_set/quality_rubric.md). Each run scored 0–10 (median of 2 runs):

| Sub-score | Range | Pass criteria |
|---|---|---|
| Numeric Accuracy | 0–3 | 3 = all numbers match `expected_values.json` (RM ±1, pct ±0.1, days ±0.1, count exact). 0 = any hallucinated number |
| Relevance | 0–3 | 3 = addresses the most important findings; correct good/bad sentiment |
| Actionability | 0–2 | 2 = names specific customers / amounts / root causes |
| Clarity | 0–2 | 2 = follows the detail template; scannable; no jargon |

Pass / fail thresholds:

- **Production-ready** — total ≥ 8/10 **and** numeric accuracy = 3 **and** hallucinations = 0.
- **Acceptable** — total ≥ 7/10 **and** hallucinations = 0.
- **Fail** — total < 7/10 **or** any hallucinated numbers.

### 17.3 Acceptance gate (rollout-level)

[AI_Insight_Study/ROLLOUT_TRACKER.md:24-34](../../AI_Insight_Study/ROLLOUT_TRACKER.md#L24-L34). A section is rollout-accepted only when **all** of these are true:

- Final Summary has 3/3 numeric accuracy.
- No material hallucination.
- Overall quality ≥ 8/10 (target ≥ 9/10).
- Numeric guard passes within 2 attempts.
- Tool use ≤ 2 calls unless drill-down is documented as useful.
- Failed tool calls = 0, or are documented immaterial.
- Any remaining issue is minor and does not change the business interpretation.

Material hallucination examples (must fix): wrong RM/pct/days/count/rank, wrong trend direction, wrong entity attribution, unsupported cause stated as fact, anything that could change an executive decision.

Minor issues (accept and document): qualified language ("may indicate", "likely"), small wording imperfections, one guard retry that ends clean, relevance gaps that don't affect the headline insight.

### 17.4 Three canonical tuning patterns

The five Finance sections rolled out so far (S01–S05) used three recurring fixes — these are the moves a worker session should reach for first:

1. **Numeric guard failures → add pre-computed values to the fetcher.** Don't expand the safe-integer set; widen the whitelist. Most rejected numbers are derived (e.g. an average-gap RM number the model back-solved). Move that calculation into the fetcher and add the result to `allowed[]`. Example: S01 added explicit `RM -1,055,577/month` average gap with rank labels ([ROLLOUT_TRACKER.md:209-214](../../AI_Insight_Study/ROLLOUT_TRACKER.md#L209-L214)).
2. **Scope-mixing hallucination → split or relabel the component.** If a single fetcher prompt mixes "period total" with "snapshot top-5", the model conflates populations. Either split into two fetchers or add explicit `(period)` / `(snapshot)` / `(active universe only)` scope labels to every number. Example: S03 added explicit MoM/YoY rank labels, May-to-September streak markers, peak/trough flags ([ROLLOUT_TRACKER.md:312-327](../../AI_Insight_Study/ROLLOUT_TRACKER.md#L312-L327)).
3. **Tool schema errors → tighten the policy or the whitelist, not the analysis quality.** Failed tool calls happen when the model hallucinates a column name. The fix is either (a) downgrade the section's tool policy to `aggregate_only`, (b) add the failing column to the table whitelist if it actually exists, or (c) shorten the table's allowlist so the model can't try the bad column. Don't accept "the analysis was fine anyway" as a fix — failed tool calls are a sign the data layer is the wrong shape. Example: S01 dropped tools entirely after fetcher rework, then surgical rebase restored `aggregate_only` with `MAX_TOOL_CALLS_PER_SUMMARY = 2` and accepted immaterial failed calls ([ROLLOUT_TRACKER.md:212-214](../../AI_Insight_Study/ROLLOUT_TRACKER.md#L212-L214)).

### 17.5 Per-section evaluation table

Module PRDs (Finance, HR) maintain an evaluation table with this column shape (one row per evaluation run, multiple rows per section as iterations progress):

```
| ID | Section Key | Date | Eval Source | Cost/Click | Quality | Num Acc | Relevance | Action | Clarity |
| Hallucinations | Guard | Tool Calls | Failed Calls | Result | Log Path | Notes |
```

Source: [AI_Insight_Study/ROLLOUT_TRACKER.md:169-182](../../AI_Insight_Study/ROLLOUT_TRACKER.md#L169-L182).

### 17.6 Per-section verification template

Used by Finance PRD §14 and HR PRD §10:

```
Section: [section_key]
Page: [page]
Components: [list with type]
Scope: [period | snapshot | fiscal]
Tool policy: [none | aggregate_only | full]

Questions answered
- [main business question 1]
- …

Pre-computed values (provided by fetcher)
- [exact list]

Numerical guardrails (allowed-values whitelist composition)
- RM values: [labels]
- pct values: [labels]
- days values: [labels]
- count values: [labels]

Expected-values fixture
- File: AI_Insight_Study/eval_set/[section]/expected_values.json

Rollout status
- [Done / Pending / Needs fix] as of [date]
- Latest cost/click, quality, hallucinations, guard attempts, tool calls

Known tuning lessons
- [bullet from MASTER_LOG.md if applicable]
```

---

## 18. Acceptance Criteria

The production rebuild of the Base engine is acceptance-tested against the following criteria. **All must hold** before the engine is considered re-implemented.

### 18.1 UI shell

- [ ] Every section on every page renders an `InsightSectionHeader`-equivalent with a title, optional subtitle, and a "Get Insight" toggle.
- [ ] The expanded panel renders all 7 hook states (idle, loading, analyzing, complete, blocked, error, plus the cancel-back-to-idle transition) per §4.
- [ ] Cards cap 3 + 3, with title, optional metric pill, optional one-line summary, and `detail` field. Sentiment-colored borders (green / red).
- [ ] Clicking a card opens the Insight Detail Dialog with the matching sentiment-colored header.
- [ ] Every KPI / chart / table has an Analyze Icon next to its title; clicking it opens the Component Insight Dialog with About + AI Analysis + metadata footer.
- [ ] Feedback button always present in the open panel (except during active analysis). Modal enforces `FEEDBACK_MAX_WORDS = 80` with a near-limit warning at `MAX − 10`.

### 18.2 Admin config

- [ ] `/admin/ai-insight-config` full-width 3-column layout: tree (20rem), breadcrumb / text + version cards / feedback list.
- [ ] Prompt tree has System and User Prompt groups; System has Finance + HR subgroups and two free-standing leaves (Feedback Router, Surgical Editor). User Prompt has Finance + HR top groups; pages and sections expand on demand.
- [ ] Feedback badge appears on every node that carries (or aggregates) ≥ 1 pending feedback row.
- [ ] Selected-version pill: amber for Default, blue for user version.
- [ ] Version Panel: card list, header reads `n/6`. Default cannot be deleted. Delete prompt-shows a confirmation dialog. When 6 versions exist, the warning banner blocks further apply.
- [ ] Apply opens DiffModal showing side-by-side current vs. proposed with the surgical editor's `change_summary` banner. Confirm inserts a new version, selects it, deletes the feedback row.
- [ ] Discard removes the feedback row permanently with no audit trail.

### 18.3 Runtime

- [ ] POST `/api/ai-insight/analyze` acquires the singleton lock; returns 409 with `locked_by` if not acquired.
- [ ] Component pool runs at most `MAX_CONCURRENCY = 2` parallel calls.
- [ ] Component slot called with `max_tokens = 2048` and no tools.
- [ ] Summary slot called with `max_tokens = 4096`, tools per `tool-policy`, capped at `MAX_TOOL_CALLS_PER_SUMMARY = 2` per attempt.
- [ ] Summary user prompt is built from raw fetcher data + About text, never from component prose.
- [ ] Numeric guard runs after each summary attempt with retry cap `MAX_GUARD_ATTEMPTS = 2`.
- [ ] Run aborts at `MAX_COST_PER_SECTION = 0.50 USD` or `MAX_RUNTIME_MS = 5 min`.
- [ ] Output parser handles `===INSIGHT===` delimiter format with `---DETAIL---` / `===END===`; caps 3 good + 3 bad; falls back to JSON envelope, then to "Summary generated" wrapper.

### 18.4 Model gateway

- [ ] OpenRouter is the only gateway; no direct Anthropic / OpenAI SDK use.
- [ ] Four slots: `component`, `summary`, `feedback_router`, `surgical_editor`.
- [ ] Per-slot model fallback chain follows §10.2; provider order follows §10.3; provider preferences include `allowFallbacks: false`, `requireParameters: true`, `dataCollection: 'deny'`.
- [ ] `reasoning: { effort: 'none' }` set on every call.
- [ ] Per-call timeout `OPENROUTER_TIMEOUT_MS = 45 s`.
- [ ] Cost source defaults to OpenRouter `usage.cost`; falls back to a per-model PRICING table.
- [ ] Response metadata exposes `requestedModel`, `model`, `upstreamProvider`, `providerFallbackPath`, `modelFallbackPath`, `fallbackUsed`, `fallbackReason`, `costSource`, `reasoningTokens` (when present).
- [ ] Technical-error fallback policy per §10.2 (HTTP 408/409/429/5xx + connection/timeout + parameter / unavailable error messages).

### 18.5 Data + tools

- [ ] `FetcherResult = { prompt: string, allowed: AllowedValue[] }`.
- [ ] `AllowedValue` includes `label`, `value`, `unit ∈ {'RM','pct','days','count'}`, optional `tolerance`.
- [ ] `query_local_table` with closed per-table column whitelist and a 100-row cap.
- [ ] `query_rds_table` with closed per-table column whitelist, mandatory `Cancelled='F'` injection on the 5 transaction tables.
- [ ] WHERE / ORDER BY token blocklist of 18 patterns.
- [ ] Tool policy levels `none` / `aggregate_only` / `full` with server-side `validateToolForSection()`.

### 18.6 Prompts

- [ ] DB tables `ai_insight_prompts`, `ai_insight_prompt_versions` per §8.1.
- [ ] Categories: `system`, `component`, `section_guidance`.
- [ ] `VERSION_CAP = 6` per prompt key.
- [ ] In-memory snapshot cache, TTL 30 s; invalidate-on-write.
- [ ] Idempotent seed-defaults endpoint; safe to re-run.
- [ ] Empty section-guidance row → block omitted entirely from the summary user prompt.

### 18.7 Feedback

- [ ] Capture: free-text, 80-word cap, validated client- and server-side.
- [ ] Router (Phase 1): forced `select_target` tool, enum-scoped to the section's component keys + guidance key.
- [ ] Raw feedback stored verbatim; no rewrite step.
- [ ] Admin preview (Phase 2): forced `propose_edit` tool returns `{ proposed_text, change_summary }`. Nothing written.
- [ ] Apply: single transaction inserts version + selects it + updates `prompt_text` cache; separate query deletes feedback row.
- [ ] Discard: hard delete; no audit trail.
- [ ] No automatic section re-evaluation on apply.

### 18.8 Persistence

- [ ] `ai_insight_section` UNIQUE on `(page, section_key)`; DELETE+INSERT on every re-run.
- [ ] `ai_insight_component` cascade-deleted on section overwrite.
- [ ] `ai_insight_lock` is a singleton row, 6-minute stale TTL.
- [ ] Latest-only retention; no history tables for sections or components.

### 18.9 Validation workflow

- [ ] HOW_TO_RUN_ITERATION procedure documented and followed for every prompt/fetcher change.
- [ ] Quality rubric with the four sub-scores (NA/Rel/Act/Clarity).
- [ ] Acceptance gate as in §17.3.
- [ ] Three canonical tuning patterns recognised; no quick-fix bypasses.
- [ ] Per-section evaluation table maintained.

---

## 19. Environment Variables

[client.ts:8-42](../../apps/dashboard/src/lib/ai-insight/client.ts#L8-L42), [orchestrator.ts:49](../../apps/dashboard/src/lib/ai-insight/orchestrator.ts#L49), [debug-logger.ts:7](../../apps/dashboard/src/lib/ai-insight/debug-logger.ts#L7), [client.ts:6](../../apps/dashboard/src/lib/ai-insight/client.ts#L6).

| Name | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | (required) | OpenRouter authentication |
| `AI_INSIGHT_OPENROUTER_TIMEOUT_MS` | `45000` | Per-call timeout |
| `AI_INSIGHT_OPENROUTER_COMPONENT_MODEL` | `deepseek/deepseek-v4-flash` | Component slot primary |
| `AI_INSIGHT_OPENROUTER_COMPONENT_FALLBACK_MODEL` | `anthropic/claude-haiku-latest` | Component slot fallback |
| `AI_INSIGHT_OPENROUTER_SUMMARY_MODEL` | `z-ai/glm-5.1` | Summary slot primary |
| `AI_INSIGHT_OPENROUTER_SUMMARY_FALLBACK_MODELS` | `deepseek/deepseek-v4-pro,anthropic/claude-sonnet-latest` | Summary fallback chain (comma-separated) |
| `AI_INSIGHT_OPENROUTER_ROUTER_MODEL` | inherit component primary | Feedback router primary |
| `AI_INSIGHT_OPENROUTER_ROUTER_FALLBACK_MODEL` | inherit component fallback | Feedback router fallback |
| `AI_INSIGHT_OPENROUTER_EDITOR_MODEL` | inherit summary primary | Surgical editor primary |
| `AI_INSIGHT_OPENROUTER_EDITOR_FALLBACK_MODELS` | inherit summary fallbacks | Surgical editor fallback chain |
| `AI_INSIGHT_LOG_PROMPTS` | `false` | Mirror system + user prompts to stdout |
| `AI_INSIGHT_DEBUG_FILE` | `false` | Write per-section debug log to `<cwd>/logs/` |
| `AI_INSIGHT_VALIDATION_BASELINE` | `0` | When `1`, disable prompt cache markers for baselining |
| `NEXT_PUBLIC_AI_INSIGHT_LOCK_SYSTEM_PROMPTS` | unset | Admin UI lock (read by client only) |

---

## 20. End-User Help Page

Lives at `/manual/general/ai-insight` ([apps/dashboard/src/app/manual/general/ai-insight/page.tsx](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx)). Plain HTML / Tailwind page, not part of the engine but distributed alongside it so executives can find the documentation without leaving the dashboard.

Sections covered:

1. **What AI Insight is** — built-in analyst, reads every number on a section, tells you what's going well and what needs attention ([page.tsx:8-15](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx#L8-L15)).
2. **Where it lives** — Payment Collection, Sales Report, Financial Statements, and other pages ([page.tsx:17-22](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx#L17-L22)).
3. **Warning: do not navigate away during analysis.** Navigating disconnects the progress display ([page.tsx:24-29](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx#L24-L29)).
4. **Opening, running, reading, and using the detail dialog** — step-by-step screenshots.
5. **Stage-1 / Stage-2 pipeline diagram** — ASCII flow + per-stage request shape ([page.tsx:205-289](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx#L205-L289)). Names DeepSeek V4 Flash and GLM 5.1 explicitly.
6. **Important notes** — only one analysis at a time, results are saved, date range matters, the AI observes-not-recommends, cancel is safe ([page.tsx:299-324](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx#L299-L324)).
7. **Available sections** — a hand-curated table of the 8 Finance sections users can run today (Payment Collection Trend, Outstanding Payment, Sales Trend, Sales Breakdown, Financial Overview, Profit & Loss Detail, Balance Sheet, Variance/Forecast/Budget) ([page.tsx:330-385](../../apps/dashboard/src/app/manual/general/ai-insight/page.tsx#L330-L385)).

This page is **not** auto-generated from `SECTION_COMPONENTS` — it is hand-maintained Markdown-as-JSX. If the section catalog grows, this page must be updated by hand.

Screenshot: [screenshots/manual/ai-insight-help-page.png](screenshots/manual/ai-insight-help-page.png) (full-page capture).

---

## Appendix A — File Inventory (Base engine)

```
apps/dashboard/src/lib/ai-insight/
├── client.ts                       ← OpenRouter client + per-slot model env vars + PRICING
├── model-provider.ts               ← callAiModel(), provider preferences, fallback engine
├── orchestrator.ts                 ← runSectionAnalysis(): pool → summary → guard → parse
├── numeric-guard.ts                ← extractNumbers, runNumericGuard, formatGuardError
├── prompts.ts                      ← SECTION_COMPONENTS, SECTION_NAMES, prompt builders
├── prompts-defaults.ts             ← (Module) factory text — Finance: 1126 lines
├── prompt-loader.ts                ← 30s in-memory snapshot, getters with fallbacks
├── prompt-store.ts                 ← insertVersionAndSelect, selectVersion, deleteVersion
├── tools.ts                        ← AI_TOOLS, column whitelists, WHERE blocklist
├── tool-policy.ts                  ← per-section policy + validateToolForSection
├── data-fetcher.ts                 ← (Module) per-component fetchers — Finance: ~5k lines
├── feedback-llm.ts                 ← routeFeedback, proposeSurgicalEdit
├── lock.ts                         ← acquireLock, releaseLock, getLockStatus
├── storage.ts                      ← upsertSectionInsight, getSection/Component
├── debug-logger.ts                 ← per-section debug log writer
├── component-info.ts               ← (Module) static About text for ComponentInsightDialog
├── word-count.ts                   ← FEEDBACK_MAX_WORDS = 80, countWords
└── types.ts                        ← shared types

apps/dashboard/src/app/api/ai-insight/
├── analyze/route.ts                ← POST: SSE stream
├── cancel/route.ts                 ← POST: abort + release
├── status/route.ts                 ← GET: lock status
├── section/[section_key]/route.ts  ← GET: stored summary
├── component/[section_key]/[component_key]/route.ts   ← GET: stored component analysis
└── feedback/route.ts               ← POST: capture + route

apps/dashboard/src/app/api/admin/
├── ai-insight-prompts/
│   ├── route.ts                                       ← GET: list with feedback counts
│   ├── [prompt_key]/route.ts                          ← GET: single
│   ├── [prompt_key]/versions/route.ts                 ← GET: list versions
│   ├── [prompt_key]/versions/[id]/route.ts            ← DELETE
│   ├── [prompt_key]/versions/[id]/select/route.ts     ← POST
│   └── seed-defaults/route.ts                         ← POST: idempotent seed
└── ai-insight-feedback/
    ├── route.ts                                       ← GET: list (optional prompt_key filter)
    ├── [id]/route.ts                                  ← DELETE
    ├── [id]/preview/route.ts                          ← POST: surgical editor preview
    └── [id]/apply/route.ts                            ← POST: insert version + delete feedback

apps/dashboard/src/components/ai-insight/
├── AiInsightPanel.tsx              ← state machine + 7 states + footer
├── InsightSectionHeader.tsx        ← "Get Insight" toggle + budget approval (financial_variance)
├── InsightDetailDialog.tsx         ← 60vw modal, sentiment-colored header
├── ComponentInsightDialog.tsx      ← About + AI Analysis + metadata
├── FeedbackModal.tsx               ← textarea + word counter + submit
├── AnalyzeIcon.tsx                 ← magnifying-glass button next to KPI/chart/table
├── MarkdownRenderer.tsx            ← react-markdown + remark-gfm + subtitle styling
└── Toast.tsx                       ← success toast (3.5s auto-dismiss)

apps/dashboard/src/components/admin/ai-insight-config/
├── PromptConfigDashboard.tsx       ← 3-column layout shell
├── PromptTree.tsx                  ← System + User Prompt groups; feedback badges
├── BreadcrumbBar.tsx               ← System / Finance / Component Analysis style path
├── PromptTextPanel.tsx             ← read-only <pre> + version pill
├── VersionPanel.tsx                ← card list, select + delete, cap = 6
├── FeedbackList.tsx                ← raw feedback + Apply / Discard
├── DiffModal.tsx                   ← side-by-side current vs. proposed + change summary
└── prompt-diff.tsx                 ← per-line set-membership diff helpers

apps/dashboard/src/hooks/ai-insight/
└── useInsightAnalysis.ts           ← SSE reader + cancel + fetchStored + checkLock

apps/dashboard/src/app/manual/general/ai-insight/page.tsx   ← end-user help page

apps/dashboard/sql/ai-insight-schema.sql                     ← lock + section + component tables

migrations/
├── 016_ai_insight_prompts.sql                              ← ai_insight_prompts
├── 017_ai_insight_feedback.sql                             ← ai_insight_feedback
├── 018_prompts_history.sql                                 ← (deprecated by 020)
├── 019_ai_insight_section_guidance.sql                     ← adds section_guidance category
├── 020_prompt_versions.sql                                 ← ai_insight_prompt_versions
└── 021_ai_insight_system_prompt_keys.sql                   ← rename system prompt keys

AI_Insight_Study/
├── HOW_TO_RUN_ITERATION.md                                  ← 14-step worker procedure
├── ROLLOUT_TRACKER.md                                       ← acceptance gate + S01–S05 logs
├── OPENROUTER_ONLY_PLAN.md                                  ← provider migration record
├── MASTER_LOG.md                                            ← iteration history
└── eval_set/
    └── quality_rubric.md                                    ← 0–10 scoring rubric
```
