# AI Insight Engine — HR vs Base Layer Gap Analysis

> Compatibility assessment: what the HR AI-Insight design (ai-insight-hr.md) needs from the shared base platform (10-ai-insight-base.md) that doesn't exist yet, and where HR's approach diverges.

---

## 1. Summary

The HR design and the base layer share the same high-level goal — LLM-driven analysis of dashboard data, delivered via SSE — but diverge on almost every structural decision below that level. The base layer uses a dual-model, two-phase architecture (component analysis then summary synthesis) with generic SQL query tools, delimiter-parsed output, PostgreSQL persistence, and a global singleton lock. HR uses a single-model, single-call architecture with 35 named domain-specific tools, JSON-array output, in-memory caching, and per-user concurrency limits. The base layer's §15 Extensibility Contract assumes new domains provide data fetchers, component prompts, and tool policies that plug into the existing orchestrator — HR's design does not use any of those extension points. This is not a "configure and extend" situation; it is a moderate rearchitecture. The base layer needs new capabilities (PII filtering, RBAC scope injection, settings-driven thresholds, severity classification, briefing injection), and several of its own features (numeric guard, dual-model split, component-level storage) should be offered as opt-in rather than mandatory. Estimated overlap: ~40% (SSE protocol, API route shape, frontend panel concept, cost tracking). Estimated gap: ~60%.

---

## 2. Architectural Differences

| Aspect | Base Layer (Finance) | HR Design | Gap Type |
|--------|---------------------|-----------|----------|
| **Model strategy** | Dual-model: fast/cheap model for component analysis, larger model for summary synthesis (§3). Both configurable via env vars. | Single `claude-sonnet-4-6` call per generation. No component-analysis model. (§3.1) | Structural — base assumes two model roles; HR uses one. Base must make dual-model opt-in. |
| **Analysis phases** | Two sequential phases: Phase 1 parallel component analysis, Phase 2 summary synthesis with tool use (§4). | Single phase: model receives briefing + tool access in one session, generates all insights in one conversation. (§3.1) | Structural — base orchestrator hardcodes two phases. HR needs a single-phase code path. |
| **Data preparation** | Per-component data fetchers return formatted prompt blocks + allowed-value whitelists. Fetchers are the extensibility contract's primary input (§15 item 6). | Briefing system: server-side generator runs 6–11 parallel queries, applies threshold-based flagging from `hr_settings`, outputs ~400–600 tokens of structured markdown injected into system prompt. (§3.2) | Structural — fundamentally different data assembly model. Base has no concept of a "briefing." |
| **Tool system** | 2 generic tools (`query_local_table`, `query_rds_table`) with column/table whitelists, parameterized queries, max 100 rows. Max 2 tool calls per summary. (§7) | 35 named domain-specific MCP tools with fixed pre-written SQL, structured JSON responses, pre-computed aggregations. Mandatory tool sequences of 4–8 calls per module. Max 8 turns. (§3.3, §15.1) | Structural — entirely different tool philosophy. Base tools are model-directed SQL; HR tools are fixed-query data endpoints. |
| **Concurrency model** | Global singleton lock — one analysis across all users. Stale lock expiry at 6 minutes. (§5) | Per-user limit: 1 active generation per user across all modules. No global lock. Additional requests rejected with error. (§3.7, §16.2) | Behavioral — base blocks all users when one runs; HR isolates per user. |
| **Cost tracking** | Per-section $0.50 USD hard cap. Cost accumulated from per-model pricing table with input/output token tracking. (§5) | Per-generation $0.30 USD cap via SDK `maxBudgetUsd`. Cost tracked in metadata (tokens, cost_usd, duration_ms, turns). (§15.1, §15.4) | Compatible but different caps. Base tracks cost internally; HR delegates to SDK budget parameter. |
| **Cache/storage strategy** | PostgreSQL: section table + component table with cascade delete. One stored result per (page, section_key). Persists across restarts. (§8) | In-memory `Map` keyed by `${userId}:${module}` with 24-hour TTL. Lost on restart. No database persistence. (§3.6, §16.1) | Structural — base persists results per-section globally; HR caches per-user-per-module ephemerally. |
| **Output format** | Delimiter-parsed (`===INSIGHT===...===END===`), sentiment `good`/`bad`, max 3+3 insight cards, detail 220–320 words. (§12) | Flat JSON array, severity `high`/`medium`/`low`/`info`, variable count (aim 5–8), `detail_bullets` + optional `recommendation`. (§12) | Structural — different parsing, classification, and rendering logic. |
| **Prompt architecture** | Global system prompt + per-component system prompt + user prompt with fetched data. Summary system prompt for Phase 2. (§4, §15) | Single `.md` prompt file with 6 sections (PERSONA, BRIEFING, INVESTIGATION_GUIDANCE, PATTERNS, RULES, OUTPUT_FORMAT). Injected via `buildSystemPrompt(briefing)`. (§2) | Structural — HR's prompt is monolithic and domain-specific; base splits across component + summary. |

---

## 3. Output Format Differences

### Side-by-Side Comparison

| Dimension | Base Layer (Finance) §12 | HR Design §12 |
|-----------|--------------------------|---------------|
| **Raw format** | Delimiter text: `===INSIGHT===`...`===END===` blocks | JSON object: `{ insights: Finding[], metadata: InsightMetadata }` |
| **Classification** | Binary sentiment: `good` or `bad` | Four-level severity: `high`, `medium`, `low`, `info` |
| **Parsed structure** | `{ good: Insight[], bad: Insight[] }` | `{ insights: Finding[] }` (flat array) |
| **Insight fields** | `title`, `metric?`, `summary?`, `detail` (markdown, 220–320 words) | `title`, `severity`, `summary`, `detail_bullets` (string array), `recommendation?` (absent for `info`) |
| **Insight count** | Max 3 positive + 3 negative (6 total) | Aim 5–8, no hard max |
| **Detail format** | Free-form markdown with mandatory sections (Current Status, Key Observations, Supporting Evidence, Implication) | Structured array of bullet strings + separate recommendation field |
| **Metadata** | `analysis_time_s`, `token_count`, `cost_usd`, `date_range_start/end`, `fiscal_year`, `generated_by`, `generated_at` | `generated_at`, `model`, `total_tokens`, `input_tokens`, `output_tokens`, `cost_usd`, `duration_ms`, `turns` |
| **Parsing logic** | Regex-based delimiter parser with JSON fallback | `JSON.parse()` with shape validation and markdown fence stripping |

### What the Base Layer's Output Parser Would Need to Change

The base layer's delimiter parser (`===INSIGHT===` regex extraction) is hardcoded to the Finance output format. To support HR:

1. The parser must be made pluggable — either accept a parser function per domain, or support both delimiter and JSON modes.
2. The `InsightResult` type must be generalized. Currently it enforces `{ good: Insight[], bad: Insight[] }`. HR needs `{ insights: Finding[] }` with severity instead of sentiment.
3. The `AiInsightPanel` component renders a two-column layout (positive/negative). HR renders grouped sections (negative first, then positive). The panel layout must be domain-configurable or replaced with a generic renderer.
4. The `InsightDetailDialog` renders free-form markdown. HR renders bullet lists + a recommendation callout. The detail renderer must accept both formats.

---

## 4. Tool System Differences

### Architecture Comparison

| Dimension | Base Layer §7 | HR Design §3.3, §4–9 |
|-----------|---------------|------------------------|
| **Tool count** | 2 (`query_local_table`, `query_rds_table`) | 35 (34 page-specific + 1 shared `get_cross_module_flags`) |
| **SQL authorship** | Model writes WHERE clauses; server enforces column/table whitelists | SQL is pre-written in tool implementations; model passes filter parameters only |
| **Response format** | Raw query rows (up to 100) | Structured JSON with pre-computed aggregations, distributions, flags |
| **Tool calls per session** | Max 2 (summary phase only; component phase has no tools) | Max 8 turns (SDK `maxTurns`); mandatory sequences of 4–8 calls |
| **Tool policy** | Per-section tiers: `none`, `aggregate_only`, `full` | All modules have full tool access; mandatory tool sequences enforce investigation protocol |
| **Response size limit** | 100 rows per query | 16K chars (~4K tokens) per tool response; 25 rows for employee details |

### Security Model Differences

| Dimension | Base Layer §7.3 | HR Design §15.2, §15.3 |
|-----------|-----------------|--------------------------|
| **Data access control** | Column whitelists per table; table whitelists; row limit 100 | PII stripping (29 fields) applied in tool closure before model sees data |
| **User scope** | Not implemented — all users see all data | RBAC scope injection: 4 roles with different data visibility. `buildScopeWhere()` applied in tool closure, not a model parameter. |
| **SQL injection** | Parameterized queries (but §17.2 notes `where_clause` from LLM is not pattern-checked) | Fixed SQL with `QueryParams` class using `$N` positional placeholders. Model never writes SQL. |
| **PII protection** | Implicit — PII columns excluded from column whitelists (§17.1) | Explicit — 29 fields stripped by `stripPii()` / `stripPiiFromRows()` in `shared/pii-filter.ts`. Failing PII audit blocks generation. |

### Impact on Base Layer's Tool Policy Tiers

The base layer's three-tier tool policy (`none` / `aggregate_only` / `full`) does not accommodate HR's approach:

- HR tools are not generic query tools — they cannot be classified as "aggregate_only" vs "full" because each tool is a fixed-purpose data endpoint.
- The base layer would need a fourth tier — something like `domain_tools` — where the domain registers its own tool set and the orchestrator passes them through without applying column/table whitelists.
- Alternatively, the tool system could be fully pluggable: each domain provides a `ToolProvider` that returns the tool definitions and execution functions, and the base orchestrator handles the agent loop mechanics (call counting, exhaustion nudge, result aggregation) without knowing the tool internals.

---

## 5. Features HR Needs That Base Doesn't Support

### 5.1 PII Filtering

**What it is:** 29 sensitive fields (names, employee codes, IC/passport numbers, emails, phone numbers, addresses, salary figures) stripped from all tool responses before data reaches the model. Implemented in `shared/pii-filter.ts` via `stripPii()` and `stripPiiFromRows()`. A failing PII audit blocks the entire generation.

**Why HR needs it:** HR data contains employee PII that must never be sent to external LLM providers (NFR-HR-SEC-04). Finance data is company-level financial data where PII exposure is lower risk (customer names/contacts are already excluded via column whitelists).

**What would need to change in the base layer:** Add a `PiiFilter` interface to the extensibility contract (§15). The orchestrator calls `piiFilter.strip(toolResult)` before returning tool results to the model. Finance can provide a no-op implementation. The filter must run in the tool execution path, not as a post-processing step.

### 5.2 RBAC Scope Filtering

**What it is:** Four role-based scopes (superadmin/HR/director see all; finance sees own department; manager sees own dept + direct reports; sale/operation denied entirely). Scope filter is applied server-side in the tool closure via `buildScopeWhere()` — the model cannot override or omit it.

**Why HR needs it:** Different managers should only see insights about their own teams. Finance dashboards are typically company-wide for all authorized users.

**What would need to change in the base layer:** Add `ScopeProvider` to the extensibility contract. The provider receives the authenticated user and returns a scope filter (SQL WHERE clause fragment or `'deny'`). The orchestrator passes this to tool executors. The API route checks for `'deny'` before starting analysis. The frontend needs a `canViewInsights` guard that hides the panel for denied roles.

### 5.3 Algorithmic Pattern Detection

**What it is:** Pre-AI threshold-based alerting that runs without LLM involvement. Currently implemented in `PatternDetectionService` with two features: chronic lateness detection and holiday-adjacent leave flagging. These run as pure algorithmic checks against configurable thresholds from `hr_settings`.

**Why HR needs it:** Some patterns (e.g., "employee was late 5+ times this month") are deterministic checks that do not need LLM reasoning. Running them algorithmically is cheaper, faster, and more reliable than asking the LLM to detect them.

**What would need to change in the base layer:** This is a new capability with no base layer equivalent. The base layer would need a `PatternDetector` hook in the extensibility contract — a function that runs before or alongside LLM analysis and produces structured alerts. These could be injected into the briefing or displayed separately from LLM-generated insights.

### 5.4 Settings/Thresholds UI

**What it is:** User-configurable alert thresholds stored in the `hr_settings` table. 10 visible categories with 24+ configurable fields (e.g., chronic lateness days, OT anomaly thresholds, at-risk scoring weights). Settings CRUD API at `/api/v1/hr/settings`. 11 stub settings pages in the frontend.

**Why HR needs it:** HR alert thresholds vary by company policy (e.g., one company considers 3 late arrivals chronic, another uses 5). Finance thresholds are currently hardcoded in prompts.

**What would need to change in the base layer:** Add a `SettingsProvider` interface that domains can implement. The base layer would provide: a generic settings storage table, CRUD API routes, and a settings-loading utility (`getSettingInt`, `getSettingDecimal`, `getSettingString`). Domain-specific settings categories and UI pages remain domain-specific.

### 5.5 Briefing System

**What it is:** A server-side briefing generator that runs 6–11 parallel database queries, applies domain-specific flag conditions against configurable thresholds, and outputs ~400–600 tokens of structured markdown. This is injected into the system prompt at runtime via `buildSystemPrompt(briefing)`. The briefing tells the model "what management sees right now" before the model starts its tool-based investigation.

**Why HR needs it:** HR's single-call architecture needs the model to have context before it starts calling tools. The briefing acts as a "situation report" that focuses the model's investigation. Finance's base layer achieves this differently — component fetchers provide data directly, and the summary phase receives all raw data blocks.

**What would need to change in the base layer:** Add an optional `BriefingGenerator` to the extensibility contract. If a domain provides one, the orchestrator calls it before LLM invocation and injects the result into the system prompt. Domains that use the dual-model/fetcher approach (Finance) would not provide a briefing generator.

### 5.6 Per-User-Per-Module Caching

**What it is:** In-memory `Map` keyed by `${userId}:${module}` with 24-hour TTL. Each user sees their own cached insights, scoped to the RBAC data they can access. Cache is not persisted to database.

**Why HR needs it:** Because RBAC scope filtering means different users see different data, a single global cached result per section would leak data across roles. A department manager's insights should not be shown to another department's manager.

**What would need to change in the base layer:** The base layer's storage schema (§8) stores one result per `(page, section_key)` — no user dimension. To support HR, either: (a) add a `generated_for` column to the section table and change the unique constraint to `(page, section_key, generated_for)`, or (b) make the storage backend pluggable so HR can use in-memory caching while Finance uses PostgreSQL. Option (b) is simpler and avoids database schema changes for a feature Finance doesn't need.

### 5.7 Severity-Based Insight Classification

**What it is:** Four severity levels (`high`, `medium`, `low`, `info`) instead of binary sentiment (`good`/`bad`). `info` severity is used for positive findings and neutral observations; `high`/`medium`/`low` represent escalating urgency for negative findings. `info` findings do not have a `recommendation` field.

**Why HR needs it:** HR findings have different urgency levels (e.g., "3 employees overdue for probation review" is higher severity than "attendance rate declined slightly"). Binary good/bad loses this granularity.

**What would need to change in the base layer:** The `InsightResult` type and the output parser must support both classification systems. The `AiInsightPanel` must render severity-based cards (colored by severity) in addition to sentiment-based cards (two-column good/bad). This could be handled by making the classification scheme a domain configuration: `{ type: 'sentiment', values: ['good', 'bad'] }` vs `{ type: 'severity', values: ['high', 'medium', 'low', 'info'] }`.

### 5.8 Cross-Module Data Aggregation

**What it is:** The `get_cross_module_flags` shared tool aggregates flags from Attendance, Leave, and Disciplinary modules into a single response. It is the first tool called in every investigation protocol, providing data freshness and at-risk employee counts.

**Why HR needs it:** HR modules are interdependent — a workforce analysis is incomplete without knowing about attendance issues and pending disciplinary cases. Finance sections are more self-contained.

**What would need to change in the base layer:** Add support for "shared tools" in the tool registration system. The extensibility contract (§15 item 7) currently assigns tool policy per section. It would need to also support cross-section or cross-domain tool registration, where a tool defined in one module can be registered in another module's tool set.

### 5.9 Prompt Mode Switching

**What it is:** `AI_INSIGHT_PROMPT_MODE` environment variable controls whether the pattern checklist includes only CORE patterns (`strict` mode) or CORE + EXPLORE patterns (`exploratory` mode). `buildSystemPrompt()` filters patterns by mode before injection.

**Why HR needs it:** Allows production deployments to run with a conservative, well-tested pattern set while development/staging can test experimental patterns. Finance does not have a comparable concept.

**What would need to change in the base layer:** Add an optional `promptMode` parameter to the extensibility contract's prompt-building interface. Domains that support mode switching provide a `filterPatterns(mode)` function. Domains that don't (Finance) ignore it.

---

## 6. Base Features HR Doesn't Use

### 6.1 Numeric Guard / Hallucination Prevention (§6)

**What it is:** Extracts all numbers from LLM output, matches them against an allowed-value whitelist aggregated from component fetchers and tool results. Rejects and re-prompts (up to 2 attempts) if unmatched numbers are found. Includes tolerance by unit type, derived-percentage matching, and safe-integer exemptions.

**Why HR skips it:** HR tools return pre-computed aggregations rather than raw tables the model must sum. The prompt instructs the model to "cite specific numbers from tool data." HR relies on prompt discipline and structured tool responses rather than output validation.

**Whether HR should adopt it:** Yes, as an opt-in feature. Even with pre-computed aggregations, the model can still hallucinate numbers (e.g., inventing a percentage not in the data). The guard should be offered as a configurable option per domain. HR may want to enable it once the base layer supports it, with a domain-specific whitelist built from tool responses rather than fetcher outputs.

### 6.2 Dual-Model Strategy (§3)

**What it is:** Two LLM models with different roles — a fast/cheap model for component narration (2,048 max tokens) and a larger model for summary synthesis with tool use (4,096 max tokens).

**Why HR skips it:** HR's single-call architecture does not have a component-analysis phase. All analysis happens in one model session. The single-model approach is simpler and costs ~$0.15–0.25 per generation vs Finance's ~$0.50 cap.

**Whether HR should adopt it:** No. HR's single-model approach is appropriate for its data volume (~70 employees, 6 modules). The dual-model split is a cost/quality optimization for Finance's larger datasets with many chart components. This should remain an opt-in architectural choice per domain.

### 6.3 Component/Summary Phase Split (§4)

**What it is:** Phase 1 runs parallel per-component analysis (no tools), then Phase 2 synthesizes across components with tool access.

**Why HR skips it:** HR does not decompose dashboards into individually-analyzed components. The briefing + tool-based investigation pattern replaces both phases with a single agentic session.

**Whether HR should adopt it:** No. The phase split is tightly coupled to Finance's per-chart analysis model. HR's briefing + investigation approach is fundamentally different and produces good results. The base orchestrator should support both patterns: two-phase (Finance) and single-phase (HR).

### 6.4 InsightSectionHeader Collapsible Toggle (§11.1)

**What it is:** Wraps each dashboard section with a collapsible "Get Insight" toggle. Contains the `AiInsightPanel` inside the collapsible region. The "Analyze" button is admin-only.

**Why HR skips it:** HR places one `AIInsightPanel` per page, not per section. There is no per-section collapsible wrapper because HR analyzes the entire module in one call.

**Whether HR should adopt it:** Partially. The collapsible UI pattern is useful, but HR would use it at the page level (one panel per page) rather than the section level (multiple panels per page). The component should accept a `granularity` prop (`'section'` or `'page'`).

### 6.5 AnalyzeIcon Per-Chart Component Analysis (§11.5)

**What it is:** Small icon button on individual charts, KPIs, and tables. Clicking opens `ComponentInsightDialog` for that specific component, fetching stored per-component narrative.

**Why HR skips it:** HR does not generate per-component narratives. All insights are generated as a flat list in a single call.

**Whether HR should adopt it:** No. Per-component analysis requires the dual-model/fetcher architecture. HR's insights are cross-cutting (e.g., "3 departments show attendance decline") and cannot be meaningfully attributed to a single chart component.

### 6.6 Cost-Per-Section Tracking in Storage Schema (§8)

**What it is:** The section table stores `cost_usd` (Numeric(8,4)), `token_count` (Integer), and `analysis_time_s` (Numeric(6,1)) per stored result.

**Why HR skips it:** HR uses in-memory caching with metadata embedded in the `InsightMetadata` object. Cost is tracked but not persisted to a database table.

**Whether HR should adopt it:** Yes, if HR migrates to database-backed storage. The metadata fields are equivalent (`cost_usd`, `total_tokens`/`input_tokens`/`output_tokens`, `duration_ms`). HR adds `turns` and `model` fields that the base schema doesn't have — those should be added.

### 6.7 PostgreSQL-Based Result Storage with Cascade Delete (§8)

**What it is:** Section table + component table with cascade delete. Unique constraint on `(page, section_key)`. On re-analyze, existing row is deleted and new rows inserted in a transaction.

**Why HR skips it:** Deliberate design decision — "insights are derivative of live data" (§16.1). In-memory cache with 24-hour TTL is simpler and ensures insights are always fresh.

**Whether HR should adopt it:** Possibly. Database persistence has advantages (survive restarts, audit trail, faster page loads for returning users). But the schema needs the user dimension (§5.6 above). This decision should be made when Epic 4 un-defers.

### 6.8 Component-Level Narrative Storage (§8.3)

**What it is:** Per-component markdown narrative stored in a component table, linked to the parent section via foreign key. Max 150 words per component.

**Why HR skips it:** HR does not generate per-component narratives (see §6.5 above).

**Whether HR should adopt it:** No. This is specific to the dual-model/component-analysis architecture.

### 6.9 Stale Lock Expiry Mechanism (§5)

**What it is:** If the global lock age exceeds 6 minutes, it is automatically released on the next status check. Prevents permanently stuck locks from crashed sessions.

**Why HR skips it:** HR uses per-user concurrency tracking (an `activeGenerations` Map), not a database lock row. Cleanup is handled by `AbortController` wired to `req.on('close')`.

**Whether HR should adopt it:** The specific mechanism (stale lock expiry) is not needed, but the concept (prevent stuck state from crashed sessions) is important. HR's `AbortController` approach handles the normal case but may not cover all crash scenarios. If HR moves to a database-backed concurrency model, stale expiry should be included.

### 6.10 Debug File-Based Logging (§14)

**What it is:** Per-session log files with timestamped names. Logs system/user prompts, API responses (token counts, cost, cache stats), tool calls and results, numeric guard attempts, session completion with totals. Enabled via environment variable.

**Why HR skips it:** HR uses structured audit logging via `insight-logger.ts` (§16.3) — logs briefing payload, tool calls/responses, PII check results, and cost metadata. Different format but same intent.

**Whether HR should adopt it:** The base layer's file-based approach is more useful for debugging (one file per session vs structured log entries). HR should adopt file-based debug logging as an option, while keeping its structured audit logging for production. The base layer should make its debug logger available to all domains.

---

## 7. Reconciliation Path

### 7.1 What HR Should Adopt from Base

1. **Numeric guard (§6) — opt-in.** HR should enable output number validation when rebuilding on the base. The guard would build its whitelist from tool responses rather than fetcher outputs. Pre-computed aggregations reduce but do not eliminate hallucination risk.

2. **Database-backed result storage (§8) — with user dimension.** Persisting results survives restarts, provides audit trail, and reduces redundant LLM calls. The schema needs a `generated_for` (user/role) column to support RBAC-scoped caching.

3. **File-based debug logging (§14).** Per-session debug files are more useful for troubleshooting than structured log entries alone. HR's `insight-logger.ts` should emit to the base layer's debug file system.

4. **Cost tracking in storage (§8.2).** HR already tracks the same metadata fields. Persisting them enables cost monitoring dashboards and budget alerts.

5. **SSE protocol standardization (§9).** HR's SSE event types (`progress`, `complete`, `error`) are compatible with the base layer's. The `progress` payload differs slightly (base: `{ component, status, message }` vs HR: `{ type, step, tool }`) but can be unified with a flexible payload schema.

### 7.2 What Base Should Add to Support HR

1. **PII filter interface.** Add `PiiFilter` to the extensibility contract. Called on all tool results before they reach the model. Finance provides a no-op; HR provides `stripPii()`.

2. **RBAC scope provider.** Add `ScopeProvider` that receives the authenticated user and returns a scope filter or `'deny'`. Applied in tool execution, API route authorization, and frontend visibility.

3. **Single-phase orchestration mode.** The orchestrator currently hardcodes two phases. Add a configuration option: `{ phases: 'dual' | 'single' }`. In single-phase mode, the orchestrator runs one model call with briefing + tools, skipping component analysis entirely.

4. **Briefing generator hook.** Optional `BriefingGenerator` in the extensibility contract. If provided, the orchestrator calls it before LLM invocation and injects the result into the system prompt.

5. **Pluggable tool provider.** Replace the fixed 2-tool system with a `ToolProvider` interface. Each domain registers its own tools. The orchestrator handles the agent loop (call counting, exhaustion nudge) without knowing tool internals.

6. **Pluggable output parser.** Replace the delimiter parser with a `OutputParser` interface. Finance provides the delimiter parser; HR provides the JSON parser. Both return a normalized `InsightResult` that the UI can render.

7. **Severity classification support.** The `InsightResult` type and UI components must support severity-based classification alongside sentiment-based. This affects `AiInsightPanel`, `AIInsightCard`, and `InsightDetailDialog`.

8. **Pluggable storage backend.** Allow domains to choose between PostgreSQL persistence and in-memory caching (or provide their own). The base layer provides both implementations; the domain selects one via configuration.

9. **Settings provider interface.** Generic settings storage/retrieval that domains can populate with their own categories and thresholds.

10. **Per-user-per-module concurrency.** The concurrency model should be configurable: global singleton lock (Finance) or per-user limit (HR). Both should include stale-state recovery.

### 7.3 What Should Stay Domain-Specific

1. **Tool definitions and SQL.** The 35 HR tools and 2 Finance tools are fundamentally different in design philosophy. Tool implementation belongs entirely in the domain layer. The base provides the execution framework; domains provide the tools.

2. **Pattern checklists.** HR's 89 patterns (79 CORE + 10 EXPLORE) and prompt mode switching (`strict` vs `exploratory`) are domain-specific analytical frameworks. Finance has no equivalent concept. Pattern definitions stay in the domain.

3. **Briefing content and flag conditions.** The specific KPIs, thresholds, and flag conditions in each HR module's briefing are domain knowledge. The base provides the injection mechanism; the domain provides the content.

4. **Prompt persona and investigation guidance.** The six HR domain personas (workforce analyst, attendance compliance analyst, etc.) and mandatory tool sequences are domain-specific. Finance has its own persona. These are extensibility contract items (§15 items 4 and 8).

5. **PII field list.** Which fields are sensitive varies by domain. HR strips 29 fields; Finance blocks 4 columns via whitelists. The domain defines its PII policy; the base enforces it.

6. **RBAC role definitions.** HR's 4-role matrix (superadmin/HR/director, finance, manager, sale/operation) is specific to the HR application. Finance may have different roles. The domain defines role-to-scope mapping; the base provides the enforcement mechanism.

7. **Algorithmic pattern detection.** The `PatternDetectionService` (chronic lateness, holiday-adjacent leave) is domain-specific business logic. The base layer should not contain HR detection algorithms. If the base provides a hook for pre-AI detection, the implementation is fully domain-owned.

8. **Output detail structure.** Finance requires mandatory sections (Current Status, Key Observations, Supporting Evidence, Implication) in free-form markdown. HR uses `detail_bullets` + `recommendation`. The output schema within each insight is domain-specific; the base normalizes at the insight-list level.

9. **Settings categories and thresholds.** The 10 HR settings categories (leave pattern abuse, chronic lateness, OT anomaly, at-risk scoring, etc.) are domain knowledge. Finance would have different categories. The base provides storage infrastructure; domains define their settings.

10. **Cross-module aggregation logic.** `get_cross_module_flags` aggregates across HR modules in a way specific to HR's data model. Finance sections are self-contained. Cross-module tools are domain-specific.

---

## 8. Migration Complexity Assessment

### Extension Points Used

Of the 9 extension points in the base layer's extensibility contract (§15):

| # | Extension Point | HR Can Use? | Notes |
|---|----------------|-------------|-------|
| 1 | Section Registry | Yes | HR maps 6 modules to component lists (though HR "components" are tools, not charts) |
| 2 | Section Names | Yes | Direct mapping: module display names |
| 3 | Section-to-Page Mapping | Yes | Direct mapping: module → page |
| 4 | Component Prompts | No | HR does not have per-component prompts; uses single monolithic prompt |
| 5 | Component Info | No | HR does not have per-component "About" content |
| 6 | Data Fetchers | No | HR uses briefing system instead of per-component fetchers |
| 7 | Tool Policy | Partially | HR needs full tool access for all modules, but the tool definitions themselves are entirely different |
| 8 | Global System Prompt | Yes | HR provides per-domain persona + rules |
| 9 | Summary System Prompt | No | HR has no summary phase |

**Result:** HR can directly use 3 of 9 extension points, partially use 1, and cannot use 5.

### New Extension Points Needed

1. `BriefingGenerator` — server-side data assembly injected into prompt
2. `ToolProvider` — domain-specific tool registration
3. `PiiFilter` — tool-result sanitization
4. `ScopeProvider` — RBAC scope injection
5. `OutputParser` — domain-specific output parsing
6. `StorageBackend` — pluggable persistence (PostgreSQL vs in-memory)
7. `ConcurrencyStrategy` — global lock vs per-user limit
8. `PatternDetector` — optional pre-AI algorithmic detection hook
9. `SettingsProvider` — domain-specific threshold management
10. `PhaseStrategy` — dual-phase vs single-phase orchestration

**Total: 10 new extension points.**

### Estimated Effort

**Significant rearchitecture.** The base layer was designed as a two-phase, dual-model orchestrator with generic SQL tools and delimiter-parsed output. Supporting HR requires making nearly every layer pluggable: model strategy, data preparation, tool system, output parsing, storage, concurrency, and UI rendering. The core SSE streaming, API route structure, and frontend panel concept are reusable, but the orchestrator — the largest and most complex component — needs substantial refactoring to support both Finance's two-phase pattern and HR's single-phase pattern.

Rough breakdown:
- **Orchestrator refactoring** (phase strategy, tool provider, briefing hook): significant
- **Output system** (pluggable parser, severity support, UI components): moderate
- **Security layer** (PII filter, RBAC scope provider): moderate
- **Storage/concurrency** (pluggable backend, configurable locking): moderate
- **Settings infrastructure** (generic settings CRUD): moderate
- **Extension contract updates** (interface definitions, documentation): trivial

The alternative — HR running its own orchestrator that shares only the SSE protocol and frontend shell — may be simpler in the short term but creates maintenance burden. The recommended path is to refactor the base orchestrator into a plugin-based architecture, which serves both Finance and HR and future domains.
