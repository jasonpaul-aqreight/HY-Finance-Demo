# Epic 4 — AI Insights

> ## ⚠️ DEFERRED 2026-04-15 — DO NOT EXECUTE
>
> **Epic 4 is DEFERRED per the 2026-04-15 team lead decision** ("Freeze AI Insights — HR AND Finance. 'Finalize later' = mark as DEFERRED in PRDs, do not delete specs."). The entire epic below is preserved as-is so the functional intent, per-page scope, PII requirements, RBAC scope requirements, and module-specific insight inventories survive the freeze. **No Story 4.x is active today.**
>
> ### SDK reconciled 2026-04-16 — client SDK wins
>
> The platform uses **`@anthropic-ai/sdk`** (Anthropic client SDK, `messages.create` pattern) per the 2026-04-15 architecture decision — NOT `@anthropic-ai/claude-agent-sdk`. "Agent SDK is overkill for intended features; client SDK is sufficient."
>
> **This document still references the agent SDK in the detailed runtime sections below** (agent orchestration service, `query()`, `maxTurns`, MCP tools, queue semantics). Those sections are **obsolete as architecture** but **preserved as intent** — the *insight content* (what each page analyses, PII rules, RBAC scoping, finding types) remains valid and must port forward; the *runtime shape* is replaced with a simpler pattern when Epic 4 un-defers:
>
> - Single `messages.create(...)` call per insight generation (no multi-turn loops)
> - Server-side data assembly with PII stripping happens BEFORE the prompt is built (no MCP tools exposing raw data to the model)
> - Server-side RBAC scoping on the data pre-fetch (not tool-injected)
> - Concurrency is a simple per-user limit with a 409 response, not a queue with position
> - Cost cap `maxBudgetUsd = 0.30` applies (tracked server-side); `maxTurns = 8` is obsolete (single call)
>
> When Epic 4 is un-deferred, Story 4.1 is re-written against this client-SDK pattern first. Stories 4.2–4.6 reuse the shared infra and only add per-page prompt + data assembly.
>
> **Authoritative reference:** [`../planning-artifacts/implementation-readiness-report-2026-04-15-hr-rebuild.md`](../planning-artifacts/implementation-readiness-report-2026-04-15-hr-rebuild.md) (MAJOR-01 resolved 2026-04-16).

---

## Overview

Epic 4 delivers per-page AI Insight panels on all six HR dashboard pages — Workforce, Attendance, Leave, Performance, Disciplinary, and Probation — rebuilt on the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, model `claude-sonnet-4-6`). Each page surfaces actionable findings through agentic investigation: the agent reasons over page-specific HR data using MCP tools, not by generating text from a single prompt.

Epic 4 replaces the legacy OpenAI-based AI Insight implementation entirely. The legacy `src/modules/hr/ai-insight/` module is not ported. See [project-context.md §3 Architecture](../../../project-context.md#3-architecture) for the platform AI strategy.

> **⚠️ Architecture alignment note.** The runtime architecture detailed below (agent orchestration service, per-user 24h cache, SSE streaming via `fetch + ReadableStream`, MCP tool wiring, cost caps, specific file layouts) is **carried over from the legacy HR AI Insight implementation** and is **not yet reconciled** against the Finance AI standard. When Finance ships its AI pattern, HR Epic 4 must align to it — the runtime shape may change. The **insight content** (the per-page panel scope, what each insight analyses, PII and RBAC requirements, and the per-module MCP tool inventories) is the **authoritative preservation** and remains valid regardless of the runtime shape. Preserve the insight detail; treat the architecture as reference only.

Story 4.1 builds all shared infrastructure (agent orchestration service, SSE endpoints, per-user 24h cache, PII filter, RBAC scope filter, response truncation, generation logging, concurrency control, cost caps, and the frontend panel / card / modal components) in addition to the Workforce page panel. Stories 4.2–4.6 reuse that infrastructure and only add page-scoped MCP tools plus the per-page placeholder replacement.

## Dependencies

- HR Epic 1, Epic 2, and Epic 3 — AI tools query live HR data across every module. The PII filter and RBAC scope filter depend on the finalized data shape produced by Epic 1–3.
- Finance platform — shared platform foundation (auth, RBAC base, route registration, SSE infrastructure pattern).
- [docs/shared/rbac-specification.md](../../shared/rbac-specification.md) — Epic 4 relies on the same CASL ability system from Epic 2 Story 2.0 for hiding the AI Insight panel from roles without HR access (`sale`, `operation`).

## Stories

### Story 4.1 — Workforce AI Insight (+ Shared Infrastructure)

**As an** HR leader viewing the Workforce dashboard, **I want** an AI Insight panel that surfaces structural risks, demographic imbalances, and succession concerns, **so that** I get actionable analysis beyond what the dashboard KPIs already show.

**Depends On:** Epic 1–3.

**Requirements covered:** FR-HR-AI-01 through FR-HR-AI-13.

Story 4.1 is the pilot story and must land first — it builds the shared infrastructure that every other Epic 4 story consumes.

**Shared infrastructure (built here, reused by 4.2–4.6):**

- Agent orchestration service (`service.ts`) using `@anthropic-ai/claude-agent-sdk` `query()` with `claude-sonnet-4-6`, `maxTurns = 8`, `maxBudgetUsd = 0.30`.
- SSE endpoint controller (`controller.ts`) wired under `/api/v1/hr/{page}/insights/*`.
- Per-user 24h in-memory cache (`cache.ts`) with TTL cleanup. Not persisted to the database.
- PII filter (`pii-filter.ts`) implementing `stripPiiFromRows()` — removes at least 26 sensitive fields (names, employee codes, IC / passport numbers, emails, phone numbers, addresses, salary figures).
- RBAC scope filter helper (`scope-filter.ts`) implementing `buildScopeWhere()` — injects department scope into every tool SQL call via a closure the agent cannot override.
- Response truncation helper (`truncate.ts`) capping every tool response at 16,000 characters.
- Generation logger (`insight-logger.ts`) recording the briefing payload, every tool call and response, PII-check pass / fail, and cost metadata (tokens in / out, dollar cost, elapsed time).
- Concurrency control: at most one active generation per user. Additional requests are queued with a visible queue position.
- Frontend components in `frontend/src/components/hr/ai-insight/`: `AIInsightPanel`, `AIInsightCard`, `AIInsightModal`, `AIInsightLoading`.
- SSE client hook `useAIInsightGenerate` — uses `fetch` + `ReadableStream`, **not** `EventSource` (the browser `EventSource` API does not support POST requests, which the generate endpoint requires).

**4.1a — Backend: Tools & Data Layer (Workforce)**

- **4 Workforce MCP tools implemented:**
  - `get_workforce_snapshot` — current headcount, department breakdown, tenure stats, turnover rate.
  - `get_department_breakdown` — per-department headcount, demographics, manager coverage.
  - `get_workforce_movement` — 12-month joiners / leavers, resignation patterns.
  - `get_employee_details` — PII-stripped employee-level data for flagged cohorts.
- **1 shared cross-module tool implemented:**
  - `get_cross_module_flags` — aggregates flags from Attendance, Leave, Disciplinary for a given employee or cohort. Reused by every Epic 4 story.
- **Briefing generator.** Fetches six workforce KPIs and applies the Workforce flag thresholds from `hr_settings` before handing to the agent.
- **PII filter.** `stripPiiFromRows()` strips the 26 sensitive fields from all employee-level tool responses.
- **Scope filter.** `buildScopeWhere()` injects the RBAC scope clause into every tool SQL call.
- **Response cap.** Every tool result capped at 16K characters via `truncateResponse()`.

**4.1b — Backend: Agent Orchestration & API**

- Agent SDK `query()` wired with `claude-sonnet-4-6`, `maxTurns = 8`, `maxBudgetUsd = 0.30`.
- `POST /api/v1/hr/workforce/insights/generate` — SSE endpoint streaming `progress`, `complete`, and `error` events.
- `GET /api/v1/hr/workforce/insights/latest` — returns the cached result or `{ cached: false }`.
- `GET /api/v1/hr/workforce/insights/status` — returns `{ generating, queuePosition? }`.
- Per-user 24h in-memory cache active with TTL cleanup.
- Concurrency: one active generation per user. Additional requests queued with a visible position.
- Generation logging: briefing payload, every tool call and response, PII-check pass / fail, cost metadata.

**4.1c — Frontend: Panel + Cards + Modal**

- `AIInsightPanel` replaces the legacy `AIInsightPlaceholder` on the Workforce page.
- Generate button triggers the SSE stream. Loading state shows live progress steps (e.g. "fetching workforce snapshot", "analyzing department breakdown").
- Findings render as `AIInsightCard` components — dark red for negative, teal for positive.
- Clicking a card opens `AIInsightModal` with three accordion sections: Detail, Evidence, Recommendation.
- Metadata footer displays: tokens in / out, dollar cost, elapsed time, generated timestamp.
- Regenerate action shows a confirmation dialog before overwriting the cached insight.
- **RBAC.** Sale and Operation roles see no insight panel. Enforced both via CASL ability (server-side — no data leaks) and via sidebar / page gating (client-side — the panel is not rendered).

**Integration Verification:**

- Generate endpoint streams `progress`, `complete`, and `error` events correctly.
- `latest` endpoint returns the cached result after a successful generation and `{ cached: false }` after TTL expiry.
- `status` endpoint accurately reflects `generating` state and queue position during concurrent requests from the same user.
- PII filter audit passes: a test fixture with 26 sensitive fields is stripped completely before any tool response reaches the agent.
- Scope filter audit passes: a `manager` user's tool calls return only their department's data.
- `maxTurns` and `maxBudgetUsd` caps are enforced — a runaway agent is terminated at the cap.
- Cached results are keyed per user and expire after 24 hours.

---

### Story 4.2 — Attendance AI Insight

**As an** HR leader viewing the Attendance dashboard, **I want** AI-driven insights on labor compliance risks, OT cost anomalies, and department disparities, **so that** I can proactively address attendance and overtime issues.

**Depends On:** Story 4.1.

**Acceptance Criteria:**

- **4.2a — Tools & Data Layer.** Seven Attendance MCP tools implemented:
  - `get_attendance_snapshot`
  - `get_attendance_trends`
  - `get_attendance_flags`
  - `get_attendance_department_comparison`
  - `get_attendance_employee_details`
  - `get_attendance_break_compliance`
  - `get_attendance_ot_analysis`
- Briefing generator: attendance rate, late / absent counts, OT breakdown by type, 12-month trend, flagged counts from `hr_settings` thresholds.
- **4.2b — Agent Orchestration & API.** SSE endpoints under `/api/v1/hr/attendance/insights/` (`generate`, `latest`, `status`) reusing the shared orchestration service from Story 4.1.
- **4.2c — Frontend.** `AIInsightPanel` replaces the legacy placeholder on the Attendance page.

---

### Story 4.3 — Leave AI Insight

**As an** HR leader viewing the Leave dashboard, **I want** AI-driven insights on planning risks, policy compliance gaps, and team coverage threats, **so that** I can address leave management issues before they impact operations.

**Depends On:** Story 4.1.

**Acceptance Criteria:**

- **4.3a — Tools & Data Layer.** Seven Leave MCP tools implemented:
  - `get_leave_snapshot`
  - `get_leave_balance_analysis`
  - `get_leave_utilization_analysis`
  - `get_leave_patterns`
  - `get_leave_upcoming`
  - `get_leave_employee_details`
  - `get_leave_application_health`
- Briefing generator: pending count, YTD totals, utilization rate, expiring credits, exhausted balances.
- **4.3b — Agent Orchestration & API.** SSE endpoints under `/api/v1/hr/leave/insights/` (`generate`, `latest`, `status`).
- **4.3c — Frontend.** `AIInsightPanel` replaces the legacy placeholder on the Leave page.

---

### Story 4.4 — Performance AI Insight

**As an** HR leader viewing the Performance dashboard, **I want** AI-driven insights on skill gaps, cycle bottlenecks, and talent development opportunities, **so that** I can improve appraisal outcomes and identify structural issues.

**Depends On:** Story 4.1.

**Acceptance Criteria:**

- **4.4a — Tools & Data Layer.** Six Performance MCP tools implemented:
  - `get_performance_snapshot`
  - `get_performance_department_comparison`
  - `get_performance_trends`
  - `get_performance_burnout_signals`
  - `get_performance_employee_details`
  - `get_performance_criteria_analysis`
- Briefing generator: average score, completion rate, top / low performer counts, pending appraisal count, validation pipeline bottleneck, structural overload signals.
- **4.4b — Agent Orchestration & API.** SSE endpoints under `/api/v1/hr/performance/insights/` (`generate`, `latest`, `status`).
- **4.4c — Frontend.** `AIInsightPanel` replaces the legacy placeholder on the Performance page.

---

### Story 4.5 — Disciplinary AI Insight

**As an** HR leader viewing the Disciplinary dashboard, **I want** AI-driven insights on fairness concerns, process gaps, and intervention opportunities, **so that** I can improve disciplinary processes and coaching effectiveness.

**Depends On:** Story 4.1.

**Acceptance Criteria:**

- **4.5a — Tools & Data Layer.** Six Disciplinary MCP tools implemented:
  - `get_disciplinary_snapshot`
  - `get_disciplinary_trends`
  - `get_disciplinary_repeat_offenders`
  - `get_disciplinary_department_comparison`
  - `get_disciplinary_workflow_health`
  - `get_disciplinary_employee_details`
- Briefing generator: active warnings by stage, pending approval count, escalation rate, at-risk count, active coaching count, filing lag between incident date and submission date.
- **4.5b — Agent Orchestration & API.** SSE endpoints under `/api/v1/hr/disciplinary/insights/` (`generate`, `latest`, `status`).
- **4.5c — Frontend.** `AIInsightPanel` added to the Disciplinary page.

---

### Story 4.6 — Probation AI Insight

**As an** HR leader viewing the Probation surface, **I want** AI-driven insights on overdue reviews, at-risk probationers, and department onboarding patterns, **so that** I can ensure compliance and improve new-hire outcomes.

**Depends On:** Story 4.1.

**Acceptance Criteria:**

- **4.6a — Tools & Data Layer.** Four Probation MCP tools implemented:
  - `get_probation_snapshot`
  - `get_probation_trends`
  - `get_probation_employee_details`
  - `get_probation_disciplinary_risk`
- Briefing generator: count on probation by status, overdue count, upcoming end count, completion rate, disciplinary overlay (probationers with active warnings).
- **4.6b — Agent Orchestration & API.** SSE endpoints under `/api/v1/hr/probation/insights/` (`generate`, `latest`, `status`).
- **4.6c — Frontend.** `AIInsightPanel` added to the Probation surface (Review Reminders section on the Performance page per Epic 3 Story 3.1, scoped to the Probation tab).

## Technical Notes

- **Model.** `claude-sonnet-4-6` via `@anthropic-ai/claude-agent-sdk`. Do not use the legacy OpenAI integration for Epic 4 tools — the shared LLM service from Epic 1 Story 1.16 is retained only for Salary Benchmarks (Story 1.13a).
- **Cost caps are a hard security boundary.** `maxTurns = 8` and `maxBudgetUsd = 0.30` per generation are enforced in the Agent SDK configuration, not just in the prompt. A runaway agent is terminated at the cap.
- **PII filter is a security boundary, not a best practice.** `stripPiiFromRows()` must strip at least 26 sensitive fields (names, employee codes, IC / passport numbers, emails, phone numbers, addresses, salary figures) before any tool result reaches Claude. Per NFR-HR-SEC-04, PII must never be sent to external LLM providers. A failing PII audit blocks generation.
- **Scope filter cannot be overridden by the model.** `buildScopeWhere()` is applied in the tool closure, not passed as a parameter the model could modify. A manager's tool calls return only their department's data regardless of what the agent "wants" to query.
- **Per-user, in-memory, 24h cache.** The cache is explicitly not persisted to the database. On server restart the cache is lost and the first user request after restart regenerates. This is intentional: insights are a derivative of live data, not a durable artifact.
- **Concurrency control.** One active generation per user. Additional requests queue with a visible position. This caps both cost (one running agent per user) and perceived latency surprise.
- **SSE client uses `fetch` + `ReadableStream`, not `EventSource`.** The browser `EventSource` API does not support POST — which the generate endpoint requires — so `useAIInsightGenerate` uses `fetch` with a streaming response body.
- **Generation logging is an audit requirement.** Every generation writes a log row with briefing payload, tool calls and responses, PII-check pass / fail, and cost metadata (FR-HR-AI-09). These logs are used for cost tracking and for validating the PII boundary during regular audits.
- **RBAC visibility is enforced both server and client side.** The CASL ability layer prevents `sale` and `operation` users from hitting the insight endpoints at all (they return 403). The frontend also hides the panel and the sidebar entry through the shared `module-permissions` map so that unauthorized users never see a broken UI element.
- **Shared infrastructure ownership.** The infrastructure built in Story 4.1 (agent service, SSE controller, cache, PII filter, scope filter, truncation, logger, concurrency queue, frontend panel / card / modal / loading components) is owned by Epic 4 in this PRD but is written to be reusable if later epics (post-HR, post-Sales) need to layer their own AI panels on the same pattern.
