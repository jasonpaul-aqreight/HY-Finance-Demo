# AI Insight PRD Reverse-Engineering Plan (v3 — approved 2026-05-12)

Approved version of the plan that drives the 4-session rewrite of `docs/prd/10-ai-insight-base.md`, `11-ai-insight-finance.md`, and `12-ai-insight-hr.md`. See the live tracker at `docs/prd/ai-insight-prd-rewrite-tracker.md`.

## Context

The Hoi-Yong Finance demo has the AI Insight feature fully implemented and proven across 5 Finance sections (S01–S05). The user wants the same feature rebuilt exactly in the production dashboard (different tech stack). Three PRDs already exist (`docs/prd/10-ai-insight-base.md`, `11-ai-insight-finance.md`, `12-ai-insight-hr.md`), last refreshed 2026-05-11.

Corrected planning direction:

1. **Code and dashboard UI/UX are the source of truth.** The existing PRDs may be wrong or claim features that don't exist. The new PRDs must describe what the code does — nothing more, nothing less. Where the previous PRD pass mandated "production gaps" (evidence guard, privacy guard, run-log table, evaluation-result table, audit trail), the new pass drops those from the spec entirely.
2. **Playwright is not a feature.** It was the QA tool used during section rollouts. The activity that IS part of the spec is the per-section validation/tuning loop — evaluate output, then iterate on pre-computed values in the fetcher and the numerical guardrail until the section passes the acceptance gate.
3. **HR adopts Finance fully.** Same engine, same orchestration, same output, same guardrails. PII/RBAC/aggregation layers are explicitly out of scope for this PRD pass.
4. **Re-capture all screenshots.** The admin UI Phase 3+4 overhaul materially changed the live UI; existing screenshots are stale.
5. **Four sessions.** Plan → Base → Finance → HR. Each reviewable before the next.

## Goals

- A developer on a different stack can rebuild AI Insight from these three PRDs alone, without reading this repo.
- Every claim in every PRD is grounded in a specific file + line range in the demo.
- OpenRouter is the model gateway (locked); provider routing, fallback policy, and metadata fields are documented exactly as implemented.
- Every Finance section's verification & tuning recipe — numerical guardrails, pre-computed values, expected values, evaluation status — is captured in the Finance PRD.
- HR PRD documents the section catalog, prompts, tool policies, and per-section verification that the production team will need, all under the Finance engine.

## Out of Scope

- Switching to the `Hoi-Yong_HR` repo (AGENTS.md forbids silent cross-repo work).
- Documenting features that don't exist in this repo's code/UI (no inventing PII filters, RBAC, audit logs, etc.).
- Running paid AI analyses to capture screenshots. Stored results will be used; the feedback diff modal will be captured only if reachable without a paid surgical-editor call.
- Implementing any code changes. This is documentation only.

## Source-of-Truth Principle

For every section/feature documented in the new PRDs, the author must answer:

1. **What does the code do today?** Cite the exact file + line range.
2. **What is shown in the dashboard UI today?** Cite the screenshot path.
3. **What is *not* in the code that the old PRD claimed?** Drop it. Do not "mandate" it as P0.

## Confirmed Feature Inventory

42 in-code features grouped by area:

### UI features (Base PRD + screenshots)
1. Insight section header with `Get Insight` action button.
2. AI panel states: idle / loading / analyzing / complete / blocked / error / cancelled.
3. Insight cards (positive + negative, capped 3 each), with title, metric chip, summary.
4. Insight detail dialog (title, metric, executive detail bullets, scope label).
5. Component Analyze icon next to KPI/chart/table.
6. Component insight dialog (About text + AI analysis + last-updated metadata).
7. Feedback modal (capture + submit free text).
8. Completed-panel metadata bar (analyzed scope, time, tokens, cost, by user).
9. Cancel button during analyze.
10. Blocked-state message ("Another analysis is running…").
11. Manual / help page at `/manual/general/ai-insight` (user-facing how-to).

### Admin UI features (Base PRD + admin screenshots)
12. AI Insight Config dashboard at `/admin/ai-insight-config` — full-width layout (Phase 3+4): tree (20rem) | breadcrumb / read-only prompt text + version panel / feedback list.
13. Prompt tree with Finance / HR groups, system prompts (component_analysis, summary_analysis, feedback_router, surgical_editor), per-section component prompts, and section_guidance entries.
14. Feedback badges on tree nodes (count of pending feedback).
15. Version panel: cards-style list, Default + up to 5 user versions (cap 6), select-to-activate, delete non-default.
16. Read-only prompt text panel (no inline edit — edits flow through feedback only).
17. Feedback list with apply / discard actions and side-by-side diff modal.

### Engine features (Base PRD)
18. Section/component registry (`SECTION_COMPONENTS`) — 16 Finance sections × 69 components, types: kpi / chart / table / breakdown.
19. Component analysis: parallel pool (`MAX_CONCURRENCY = 2`), no tool access at component level, output stored as markdown.
20. Summary analysis: tool access controlled by section policy, `MAX_TOOL_CALLS_PER_SUMMARY = 2`, output parsed from `===INSIGHT===` blocks.
21. Section orchestration: `MAX_RUNTIME_MS = 5 minutes`, `MAX_COST_PER_SECTION = 0.50 USD`.
22. Numeric guard with 4 units (RM, pct, days, count), default tolerances ±1 / ±0.1 / ±0.1 / ±0.5, derived percentages, lower-bound phrases, safe integers (0–12, 30, 60, 80, 90, 100, 120, 365).
23. Numeric guard retry loop (`MAX_GUARD_ATTEMPTS = 2`) — appends error message and replays the summary turn.
24. Output parser: `===INSIGHT===` / sentiment / title / metric / summary / `---DETAIL---` / `===END===`. Caps 3 good + 3 bad cards.
25. Singleton lock (`ai_insight_lock` row id=1), 6-minute stale TTL, returns HTTP 409 when held.
26. Cancel API: aborts in-flight orchestrator, releases lock, leaves prior result intact.
27. SSE events on POST `/api/ai-insight/analyze`: `progress`, `complete`, `cancelled`, `error`.
28. Persistence: `ai_insight_section` (one row per `(page, section_key)`, summary_json + tokens + cost + scope + generated_by/at), `ai_insight_component` (cascade-deleted on section overwrite). Latest-only — DELETE+INSERT on every re-run.
29. Scope: `DateRange` (calendar) and `FiscalPeriod` (`fiscalYear` + `range` enum `'fy' | 'last12' | 'ytd'`). Snapshot sections use latest snapshot_date in DB.

### Model gateway features (Base PRD)
30. `callAiModel()` abstraction with 4 slots: `component`, `summary`, `feedback_router`, `surgical_editor`.
31. OpenRouter as the only provider gateway (direct Anthropic SDK removed per `OPENROUTER_ONLY_PLAN.md`).
32. Per-slot provider order: component → Parasail → Atlas → DeepSeek → DeepInfra → SiliconFlow → AkashML → Novita; summary → DeepInfra → SiliconFlow → Friendli → Atlas → z-ai; Anthropic-only chain for anthropic models.
33. Per-slot model fallback chain: component primary `deepseek/deepseek-v4-flash`, fallback `anthropic/claude-haiku-latest`; summary primary `z-ai/glm-5.1`, fallbacks `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-latest`; feedback_router uses component-slot config; surgical_editor uses summary-slot config.
34. OpenRouter settings: `requireParameters: true`, `dataCollection: 'deny'`, `allowFallbacks: false`, no reasoning effort, `OPENROUTER_TIMEOUT_MS` default 45s.
35. Response metadata: `requestedModel`, `actualModel`, `upstreamProvider`, `modelFallbackPath`, `providerFallbackPath`, `fallbackReason`, `costSource` (`'openrouter_usage_cost' | 'local_estimate'`).
36. Cost computation: prefer `response.usage.cost`; fall back to per-model `PRICING` table in `client.ts`.

### Data + tool features (Base PRD + Finance PRD)
37. Data-fetcher contract — every component fetcher returns `{ prompt: string, allowed: AllowedValue[] }`. Prompt is pre-formatted markdown with pre-computed totals/percentages/ranks/deltas. `allowed[]` defines the numeric whitelist (label, value, unit, optional tolerance).
38. Tool catalog — `query_local_table` (15 `pc_*` tables, exact column allowlists per table) and `query_rds_table` (6 `dbo.*` tables: IV, CS, CN, ARInvoice, ARPayment, ARPaymentKnockOff). Row limit 100. WHERE/ORDER_BY block 18 SQL tokens. Mandatory server-side `Cancelled='F'` injection on 5 RDS transaction tables.
39. Tool policy levels — `none`, `aggregate_only`, `full`. Mapped per Finance section in `tool-policy.ts`.

### Prompt features (Base PRD)
40. Prompt registry (`ai_insight_prompts`) + versioning (`ai_insight_prompt_versions`): version cap 6 (1 Default + 5 user), `selected_version_id` controls live text, in-memory snapshot cache 30s TTL with invalidate-on-write, idempotent `seed-defaults` endpoint.
41. Prompt categories: `system`, `component`, `section_guidance`. Section guidance default-empty; injected at end of summary user prompt only if non-empty.
42. Feedback lifecycle: capture → feedback_router LLM (forced tool call, enum-scoped to current section keys + guidance) → store with `target_prompt_key` → admin preview (surgical_editor LLM, forced `propose_edit` tool returning `proposed_text` + `change_summary`) → diff modal → apply (insert version + select + delete feedback row).

### Environment toggles (Base PRD)
- `OPENROUTER_API_KEY` (required), `AI_INSIGHT_OPENROUTER_TIMEOUT_MS` (45s default).
- Per-slot model overrides: `AI_INSIGHT_OPENROUTER_COMPONENT_MODEL`, `..._SUMMARY_MODEL`, `..._ROUTER_MODEL`, `..._EDITOR_MODEL`, `..._COMPONENT_FALLBACK_MODEL`, `..._SUMMARY_FALLBACK_MODELS` (comma-separated).
- `AI_INSIGHT_DEBUG_FILE` (true → write per-section debug logs to `./logs/`).
- `AI_INSIGHT_LOG_PROMPTS` (true → console-log full system + user prompts).
- `AI_INSIGHT_VALIDATION_BASELINE` (1 → disable prompt cache markers for cost baselining).
- `NEXT_PUBLIC_AI_INSIGHT_LOCK_SYSTEM_PROMPTS` (admin UI lock).

### Validation / tuning loop (Base PRD)
- 14-step iteration procedure (`HOW_TO_RUN_ITERATION.md`).
- Quality rubric (`quality_rubric.md`): Numeric Accuracy (0–3), Relevance (0–3), Actionability (0–2), Clarity (0–2). Median of 2 runs.
- Acceptance gate (`ROLLOUT_TRACKER.md`): numeric accuracy = 3/3, 0 material hallucinations, quality ≥ 8/10 (target ≥ 9/10), guard ≤ 2 attempts, tool calls ≤ 2.
- Three canonical tuning patterns from S01–S05: (a) numeric failures → add pre-computed values to fetcher; (b) scope-mixing hallucination → split component; (c) tool schema errors → fix table/column whitelist, lower tool cap, improve raw-data coverage.
- Per-section evaluation table format (date, eval source, cost/click, quality, sub-scores, hallucinations, guard attempts, tool calls, failed calls, result, log path, notes).

### Confirmed NOT in code — exclude from new PRDs
- Evidence-label allowlist / evidence guard.
- PII filter / privacy guard.
- RBAC user-scoped data filter.
- Run-log database table.
- Evaluation-result database table.
- Persistent audit trail on feedback (rows are deleted on apply/discard).
- Automatic section re-evaluation trigger on prompt apply.
- Scoped lock key (still singleton).
- Per-component re-run endpoint.
- `change_summary` persistence on prompt version rows.
- Force-reseed mode on `seed-defaults`.

## Session Plan

### Session 1 — This plan
Deliverable: this file + tracker. Done 2026-05-12.

### Session 2 — Rewrite `docs/prd/10-ai-insight-base.md` (Engine Base)

Pre-work: full Playwright screenshot re-capture against the running dashboard.

Screenshot capture list (saved under `docs/prd/screenshots/`):
- `payment/ai-insight-section-header.png`
- `payment/ai-insight-panel-results.png` (uses stored result)
- `payment/ai-insight-panel-analyzing.png` (if reachable without paid run; otherwise skip + note)
- `payment/ai-insight-panel-blocked.png` (forced by simulating an active lock)
- `payment/ai-insight-panel-error.png` (forced by simulating a failure path)
- `payment/ai-insight-detail-dialog.png`
- `payment/ai-insight-component-icon.png`
- `payment/ai-insight-component-dialog.png`
- `payment/ai-insight-feedback-modal.png`
- `expenses/ai-insight-panel-idle.png`
- `ai-insight-admin/config-page-full.png`
- `ai-insight-admin/prompt-tree-finance-hr.png`
- `ai-insight-admin/prompt-text-panel.png`
- `ai-insight-admin/version-panel-default.png`
- `ai-insight-admin/version-panel-with-versions.png`
- `ai-insight-admin/feedback-list.png`
- `ai-insight-admin/feedback-diff-modal.png` (only if reachable without paid surgical-editor call)
- `manual/ai-insight-help-page.png`

PRD 10 structure (full rewrite):
1. Purpose & user model.
2. Scope split — Base owns shared; Module owns prompts/data/tools per section.
3. UI shell — section header / panel / cards / detail dialog / component dialog. ASCII wireframes + screenshot links.
4. AI panel states — idle / loading / analyzing / complete / blocked / error / cancelled. Each state's wireframe + event payload.
5. Component insight dialog.
6. AI Insight Config admin — full-width layout, prompt tree (Finance/HR split, system + component + guidance categories), breadcrumb, read-only text panel, version panel, feedback list with diff modal.
7. Runtime sequence — lock → fetcher pool → component model calls (concurrency 2, no tools) → summary prompt build (raw component data, not component prose) → summary model call (tools per policy, cap 2) → parser → numeric guard (retry cap 2) → persistence → SSE complete. Caps: 5 min, $0.50.
8. Prompt contracts — registry shape, version shape, categories, default seeding, selected-version semantics, 30s cache TTL, empty-guidance behavior.
9. Feedback lifecycle — capture (validate non-empty, `FEEDBACK_MAX_WORDS`), router (forced tool, enum-scoped), store, admin preview, diff, apply, discard.
10. Model gateway & OpenRouter — 4 slots, per-slot primary + fallback + provider order, OpenRouter settings, response metadata, cost computation, env knobs.
11. Data provider contract — `FetcherResult`, pre-formatted markdown rules, `AllowedValue` shape.
12. Tool catalog & policy — `query_local_table` (12 `pc_*`), `query_rds` (6 `dbo.*`, mandatory `Cancelled='F'`), row limit 100, 18 blocked tokens, policy levels.
13. Guardrails actually implemented — parser, numeric, tool, cost, runtime, lock. NO evidence/privacy guard.
14. Persistence & cost/token logging — `ai_insight_section`, `ai_insight_component`, scope columns, `summary_json` JSONB shape, component-level token_count only, debug-file logging.
15. Streaming & API — every endpoint + payload + SSE event schema.
16. Lock — singleton, 6-min stale TTL, 409 response, status endpoint.
17. Validation & tuning workflow — 14-step procedure, rubric, gate, three tuning patterns, per-section evaluation table format.
18. Acceptance criteria.

Critical files to read (Session 2):
- `apps/dashboard/src/lib/ai-insight/{orchestrator,client,model-provider,lock,storage,numeric-guard,feedback-llm,types,prompt-loader,prompt-store,debug-logger}.ts`
- `apps/dashboard/src/app/api/ai-insight/**/*`
- `apps/dashboard/src/app/api/admin/ai-insight-prompts/**/*`
- `apps/dashboard/src/app/api/admin/ai-insight-feedback/**/*`
- `apps/dashboard/src/components/ai-insight/`
- `apps/dashboard/src/components/admin/ai-insight-config/`
- `apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts`
- `apps/dashboard/src/app/manual/general/ai-insight/page.tsx`
- `apps/dashboard/sql/ai-insight-schema.sql`
- `apps/dashboard/migrations/016–021`
- `AI_Insight_Study/OPENROUTER_ONLY_PLAN.md`
- `AI_Insight_Study/HOW_TO_RUN_ITERATION.md`
- `AI_Insight_Study/eval_set/quality_rubric.md`
- `AI_Insight_Study/ROLLOUT_TRACKER.md`

### Session 3 — Rewrite `docs/prd/11-ai-insight-finance.md` (Finance module)

PRD 11 structure (full rewrite):
1. Finance purpose & user behavior.
2. Finance dashboard surface map (7 pages, references to `docs/prd/00–09`).
3. Finance screenshots (reuse Session 2 captures).
4. Section catalog — 16 sections × 69 components.
5. Component prompt inventory — Appendix A (move to companion file if needed).
6. System prompts — Finance component_analysis + summary_analysis + global feedback_router + surgical_editor.
7. Section guidance — current defaults (mostly empty).
8. Model & provider configuration — full table per slot.
9. Database design — only the tables that exist.
10. Tool catalog (Finance).
11. Data fetcher patterns — `{prompt, allowed}` contract, S03 unified `fetchSalesPeriodTotals()`, S04 pre-computed concentration diagnostics.
12. Output parser — current behavior as-is.
13. Numeric guard — Finance-specific usage and `allowed[]` composition examples.
14. Per-section verification & tuning — 16 subsections using the template below.
15. Rollout workflow.
16. Acceptance criteria.

Critical files (Session 3):
- `apps/dashboard/src/lib/ai-insight/{prompts,prompts-defaults,data-fetcher,tools,tool-policy,numeric-guard,component-info}.ts`
- `AI_Insight_Study/{MASTER_LOG,ROLLOUT_TRACKER,02_analysis}.md`
- `AI_Insight_Study/eval_set/{snapshot_state,expected_values,quality_rubric}`
- `docs/prd/00–09`

### Session 4 — Rewrite `docs/prd/12-ai-insight-hr.md` (HR module)

PRD 12 structure (full rewrite):
1. Status banner — HR fully adopts Finance engine; PII/RBAC/aggregation deferred.
2. HR purpose & user behavior.
3. HR dashboard surface map.
4. HR section catalog (preserve current list).
5. HR component prompt rules.
6. HR settings & thresholds (preserved categories).
7. HR output contract — identical to Finance.
8. HR runtime flow — references Base §7.
9. HR tools — section→policy map using Finance levels.
10. HR per-section verification & tuning — using the Finance template.
11. HR acceptance criteria.
12. Out-of-scope addendum — PII/RBAC/aggregation/role caches/payroll governance still open for production team.

Critical files (Session 4):
- `docs/prd/12-ai-insight-hr.md` (current)
- Fresh PRDs from Sessions 2 + 3
- `apps/dashboard/src/lib/ai-insight/prompts.ts`
- `apps/dashboard/migrations/021_ai_insight_system_prompt_keys.sql`

## Per-Section Verification & Tuning Template

```
Section: [section_key]
Page: [page]
Components: [list with type]
Scope: [period | snapshot | fiscal]
Tool policy: [none | aggregate_only | full]

Questions answered
- [main business question 1]
- ...

Pre-computed values (provided by fetcher)
- [exact list]

Numerical guardrails (allowed-values whitelist composition)
- RM values: [labels]
- pct values: [labels]
- days values: [labels]
- count values: [labels]

Expected-values fixture
- File: AI_Insight_Study/eval_set/[section]/expected_values.json (or shared)

Rollout status
- [Done / Pending / Needs fix] as of [date]
- Latest cost/click, quality score, hallucinations, guard attempts, tool calls

Known tuning lessons
- [bullet from MASTER_LOG.md if applicable]
```

## Verification (per session)

1. Every numeric cap, model name, table name, column name, file name, API path traces to a specific file + line range.
2. Every UI claim has either an ASCII wireframe + screenshot path, or an explicit "not yet captured because [reason]" note.
3. PRD does not claim any feature in the "Confirmed NOT in code" exclusion list.
4. Finance + HR PRDs each have a per-section verification & tuning subsection using the template.
5. Token count of each PRD recorded; if any PRD exceeds ~45k tokens, move appendices to companion files.
6. After Session 4: 30-minute cross-doc consistency pass.

## Open Items For The User

1. HR PRD §12 closing reminder paragraph wording for the production team about PII/RBAC.
2. Feedback diff modal screenshot — default skip; user can approve a single paid surgical-editor run in Session 2.
3. The "live prompt panel" is the read-only PromptTextPanel.
4. Confirm exact `FEEDBACK_MAX_WORDS` value in code during Session 2.
