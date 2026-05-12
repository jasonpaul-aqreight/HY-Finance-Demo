# AI Insight Reverse Engineering Plan

Date: 2026-05-11  
Purpose: create implementation-grade production documentation from the proven Finance AI Insight demo.  
Primary docs to rebuild: `docs/prd/10-ai-insight-base.md` and `docs/prd/11-ai-insight-finance.md`.

This is a multi-session plan. Each stage should be completed in a separate session so the work can be reviewed before moving on.

## 1. Why The Docs Are Split

The production docs must be split because AI Insight has two different layers.

### 1.1 AI Insight Base

`10-ai-insight-base.md` must describe the reusable engine that any module can implement:

- AI panel shell and UI states.
- Component insight dialog.
- Section summary insight cards and detail dialog.
- Prompt registry and prompt versioning.
- Model gateway and fallback behavior.
- Runtime orchestration.
- Data package contract.
- Tool contract.
- Numeric, evidence, privacy, parser, cost, and runtime guards.
- Persistence, cache, lock, streaming, feedback, logs, and evaluation.

This doc should be tech-stack agnostic, but not shallow. It must tell a developer what systems, records, contracts, lifecycle, and validation rules to build without forcing Next.js, PostgreSQL, or OpenRouter as the only possible stack.

### 1.2 Finance AI Insight Module

`11-ai-insight-finance.md` must describe the Finance-specific implementation:

- Finance pages, sections, and components.
- Actual Finance prompt library.
- Finance data fetchers and source data packages.
- Finance tool policies and whitelisted tables/columns.
- Finance numeric whitelist behavior.
- Finance output format and parser behavior.
- Finance model-slot defaults proven in the demo.
- Finance dashboard screenshots.
- Finance evaluation and rollout requirements.

Finance must not pollute the base engine. Future modules such as HR should reuse the base engine, but must not inherit Finance-specific prompts, data scopes, tools, cache rules, or section catalog.

## 2. Important Correction

Screenshots must come from the actual running dashboard using Playwright. Do not create synthetic HTML mock screenshots.

Screenshots must be saved under `docs/prd/screenshots/`, following the existing Finance page documentation pattern:

```text
docs/prd/screenshots/
  payment/
  sales/
  customer-margin/
  supplier-margin/
  return/
  expenses/
  financial/
  ai-insight-admin/
```

If a new folder is needed for shared AI Insight UI, use:

```text
docs/prd/screenshots/ai-insight/
```

Only capture real UI from the dashboard. If a completed AI Insight result is not already stored in the local DB, ask before running a new analysis because it may call paid models.

## 3. Stage Plan

### Stage 1 - Reverse Engineering Plan

Status: complete.

Goal: replace the old audit document with a concrete work plan.

Deliverables:

- This file rewritten as a staged reverse-engineering plan.
- Clear explanation of the base/module split.
- Clear screenshot capture requirements.
- Clear source-code audit map.
- Clear output expectations for `10-ai-insight-base.md` and `11-ai-insight-finance.md`.

No production PRD rewrite should happen in Stage 1.

### Stage 2 - Actual Dashboard Screenshot Capture

Status: complete. Screenshot inventory: `docs/prd/ai-insight-stage-2-screenshot-inventory.md`.

Goal: capture real AI Insight UI evidence from the running Finance dashboard.

Inputs:

- Existing Finance screenshot pattern under `docs/prd/screenshots/`.
- Actual dashboard routes in `apps/dashboard`.
- Existing stored AI Insight results in local DB, if available.
- Playwright.

Work:

1. Start the real dashboard locally.
2. Use Playwright against the running dashboard, not synthetic HTML.
3. Capture actual AI Insight screens:
   - Section header with `Get Insight`.
   - Expanded idle panel.
   - Expanded analyzing panel, if running analysis is approved.
   - Completed AI panel with positive/negative cards.
   - Insight detail dialog.
   - Component Analyze icon.
   - Component insight dialog.
   - Feedback modal.
   - Admin AI Insight Config page.
   - Prompt version panel.
   - Feedback apply/diff modal, if available without fabricating data.
4. Save screenshots into `docs/prd/screenshots/...` using descriptive filenames.
5. Add a screenshot inventory table to this plan or a companion note if needed.

Target screenshot paths:

```text
docs/prd/screenshots/payment/ai-insight-section-header.png
docs/prd/screenshots/payment/ai-insight-panel-results.png
docs/prd/screenshots/payment/ai-insight-detail-dialog.png
docs/prd/screenshots/payment/ai-insight-component-icon.png
docs/prd/screenshots/payment/ai-insight-component-dialog.png
docs/prd/screenshots/payment/ai-insight-feedback-modal.png
docs/prd/screenshots/ai-insight-admin/config-page.png
docs/prd/screenshots/ai-insight-admin/prompt-version-panel.png
docs/prd/screenshots/ai-insight-admin/feedback-diff-modal.png
```

Acceptance:

- Screenshots are real dashboard screenshots.
- Filenames are stable and usable from markdown.
- No synthetic mockups are included.
- Any paid model run is explicitly approved first.

### Stage 3 - Reverse Engineer The Base Engine

Status: complete. Output: `docs/prd/10-ai-insight-base.md`.

Goal: rebuild `10-ai-insight-base.md` so a developer can implement the shared AI Insight engine.

Source files to audit:

```text
apps/dashboard/src/components/ai-insight/
apps/dashboard/src/hooks/ai-insight/
apps/dashboard/src/app/api/ai-insight/
apps/dashboard/src/app/api/admin/ai-insight-prompts/
apps/dashboard/src/app/api/admin/ai-insight-feedback/
apps/dashboard/src/lib/ai-insight/client.ts
apps/dashboard/src/lib/ai-insight/model-provider.ts
apps/dashboard/src/lib/ai-insight/orchestrator.ts
apps/dashboard/src/lib/ai-insight/prompt-loader.ts
apps/dashboard/src/lib/ai-insight/prompt-store.ts
apps/dashboard/src/lib/ai-insight/numeric-guard.ts
apps/dashboard/src/lib/ai-insight/storage.ts
apps/dashboard/src/lib/ai-insight/lock.ts
apps/dashboard/src/lib/ai-insight/types.ts
apps/dashboard/sql/ai-insight-schema.sql
migrations/016_ai_insight_prompts.sql
migrations/017_ai_insight_feedback.sql
migrations/018_prompts_history.sql
migrations/019_ai_insight_section_guidance.sql
migrations/020_prompt_versions.sql
migrations/021_ai_insight_system_prompt_keys.sql
```

Required base doc sections:

1. Product purpose: embedded analyst, not chatbot.
2. Shared UI states and screenshots.
3. Runtime sequence diagram.
4. Component-plus-summary orchestration contract.
5. Model gateway contract.
6. Model slots:
   - component
   - summary
   - feedback router
   - surgical editor
7. Provider/model fallback policy:
   - explicit fallback list per slot
   - fallback only for technical failures
   - metadata required for every call
8. Prompt registry:
   - prompt categories
   - default prompt seeding
   - selected version behavior
   - immutable version history
   - section guidance behavior
9. Feedback loop:
   - capture
   - LLM routing
   - admin preview
   - surgical edit
   - version creation
   - discard/apply audit
10. Data package contract:
   - formatted model block
   - machine-readable allowed values
   - scope label
   - population label
   - freshness
   - redaction/security status
11. Tool provider contract.
12. Guardrail contracts:
   - parser
   - numeric
   - evidence
   - privacy
   - tool
   - cost
   - runtime
   - lock
13. Persistence model:
   - section result
   - component result
   - prompt
   - prompt version
   - feedback
   - lock
   - production run log requirement
   - production evaluation result requirement
14. Streaming/API behavior.
15. Evaluation gate before production acceptance.

Acceptance:

- The base doc is not Finance-specific.
- The base doc is still technically deep.
- A developer knows what contracts, records, services, APIs, and guards to build.
- Stack-specific implementation is described only as reference behavior.

### Stage 4 - Reverse Engineer The Finance Module

Status: complete. Output: `docs/prd/11-ai-insight-finance.md`.

Goal: rebuild `11-ai-insight-finance.md` so a developer can implement the Finance module on top of the base engine.

Source files to audit:

```text
apps/dashboard/src/lib/ai-insight/prompts.ts
apps/dashboard/src/lib/ai-insight/prompts-defaults.ts
apps/dashboard/src/lib/ai-insight/data-fetcher.ts
apps/dashboard/src/lib/ai-insight/tools.ts
apps/dashboard/src/lib/ai-insight/tool-policy.ts
apps/dashboard/src/lib/ai-insight/numeric-guard.ts
apps/dashboard/src/lib/ai-insight/client.ts
apps/dashboard/src/lib/ai-insight/model-provider.ts
apps/dashboard/src/components/ai-insight/
apps/dashboard/src/app/api/ai-insight/
apps/dashboard/sql/ai-insight-schema.sql
migrations/003_precomputed_tables.sql
migrations/010_ar_monthly_counts_and_supplier_is_active.sql
migrations/012_sales_daily_grain.sql
migrations/013_supplier_margin_attributed_cogs.sql
migrations/015_budget_table.sql
AI_Insight_Study/MASTER_LOG.md
AI_Insight_Study/ROLLOUT_TRACKER.md
AI_Insight_Study/HOW_TO_RUN_ITERATION.md
AI_Insight_Study/eval_set/
```

Required Finance doc sections:

1. Finance purpose and user behavior.
2. Finance screenshots from `docs/prd/screenshots/`.
3. Full section catalog:
   - 7 pages
   - 16 sections
   - 69 components. The earlier 66-component count was stale; current source audit found 69 Finance components in `SECTION_COMPONENTS`.
   - page
   - section key
   - component key
   - component name
   - component type
   - scope type
   - tool policy
4. Actual prompt inventory:
   - component system prompt
   - summary system prompt
   - feedback router system prompt
   - surgical editor system prompt
   - every Finance component prompt
   - section guidance defaults
   - note whether prompt text comes from defaults or DB-selected versions
5. Finance model/provider configuration:
   - OpenRouter reference implementation
   - component primary model: `deepseek/deepseek-v4-flash`
   - summary primary model: `z-ai/glm-5.1`
   - router primary model behavior
   - editor primary model behavior
   - component fallback: `anthropic/claude-haiku-latest`
   - summary/editor fallbacks: `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-latest`
   - provider order
   - timeout
   - token/cost capture
   - data-retention controls where supported
6. Finance database design:
   - logical result tables
   - component result storage
   - lock table
   - prompt table
   - prompt version table
   - feedback table
   - required production additions such as run logs and evaluation logs
7. Finance data package contract:
   - fetcher per component
   - formatted raw data block
   - allowed numeric whitelist
   - precomputed values
   - population labels
   - period/snapshot/fiscal rules
8. Finance tools:
   - `query_local_table`
   - `query_rds_table`
   - local `pc_*` table whitelist
   - RDS table whitelist
   - column whitelist
   - row limit
   - unsafe token blocking
   - server-side cancelled-document filter
   - section-level tool policy
9. Finance output parser:
   - `===INSIGHT===` blocks
   - `sentiment`
   - `title`
   - `metric`
   - `summary`
   - `---DETAIL---`
   - `===END===`
   - compatibility fallbacks
   - production parser tightening recommendation
10. Finance numeric guard:
   - RM
   - percent
   - days
   - count phrases
   - tolerances
   - derived percentage compatibility
   - retry behavior
11. Finance rollout and evaluation:
   - current proof-of-concept lessons
   - production must rerun evaluation
   - expected values
   - quality score
   - hallucination count
   - cost per click

Acceptance:

- The Finance doc contains the real prompts, not just prompt rules.
- The Finance doc contains the real model/provider/fallback setup.
- The Finance doc contains the real DB design and production DB gaps.
- The Finance doc contains real dashboard screenshots.
- A developer can implement Finance AI Insight without reading the demo repo first.

### Stage 5 - Final Cross-Document Review

Status: complete. Outputs:

- Stage 5 review section added to `docs/prd/11-ai-insight-finance.md`.
- HR transfer caveat clarified in `docs/prd/10-ai-insight-base.md`.
- HR draft caveat clarified in `docs/prd/12-ai-insight-hr.md` so Finance production transfer is not blocked by unresolved HR architecture decisions.

Goal: validate the rebuilt docs as an implementation pack.

Review checklist:

- `10-ai-insight-base.md` is reusable and not Finance-specific.
- `11-ai-insight-finance.md` contains all Finance-specific details.
- All actual prompts are captured or referenced in an implementation-grade appendix.
- All model/provider/fallback behavior is documented.
- The DB model is clear enough to build.
- The screenshot links work.
- The docs distinguish proven demo behavior from production requirements.
- Any production gaps are explicit, not hidden.
- HR transfer risks remain visible but do not distract the Finance production transfer.

Acceptance:

- Product owner can hand the docs to a developer.
- Developer can identify what to build, what tables to create, what prompts to load, what model slots to configure, what APIs to expose, what screenshots to match, and how to validate output quality.

Stage 5 verification performed on 2026-05-11:

| Check | Result |
|------|--------|
| Screenshot links | All screenshot references in `10-ai-insight-base.md` and `11-ai-insight-finance.md` resolve to files under `docs/prd/screenshots/`. |
| Finance catalog | Source audit confirms 16 Finance sections and 69 Finance components; `11-ai-insight-finance.md` lists all component keys. |
| Prompt appendix | Appendix A in `11-ai-insight-finance.md` exactly matches `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`. |
| Prompt coverage | Source audit confirms 69 default component prompts for 69 Finance component keys. |
| Model and provider behavior | Documented in Finance section 8 and base section 11. |
| Database and production gaps | Documented in Finance section 13 and base section 14. |
| HR risk visibility | Base and HR docs now state that HR production architecture remains a separate decision and must not be silently inferred from Finance. |

## 4. Session Boundaries

Use one session per stage:

| Session | Stage | Output |
|---------|-------|--------|
| Session 1 | Stage 1 | This reverse-engineering plan. |
| Session 2 | Stage 2 | Actual dashboard screenshots saved under `docs/prd/screenshots/`. |
| Session 3 | Stage 3 | Rewritten `10-ai-insight-base.md`. |
| Session 4 | Stage 4 | Rewritten `11-ai-insight-finance.md`. |
| Session 5 | Stage 5 | Final cross-document review and fixes. |

Do not combine stages unless the user explicitly approves it.

## 5. Follow-Up Prompt

Stage 5 is complete. Use this only if another review session is needed:

```text
Continue AI Insight production transfer reverse engineering.
Read docs/prd/ai-insight-reverse-engineering-audit.md.
Review the completed Stage 5 implementation pack:
- docs/prd/10-ai-insight-base.md
- docs/prd/11-ai-insight-finance.md
- docs/prd/12-ai-insight-hr.md
Check only for newly discovered inconsistencies or production-transfer gaps.
```

---

## 6. v3 Rewrite — Complete (2026-05-12)

The original Stages 1–5 produced the implementation pack above. A subsequent v3 rewrite re-grounded the three PRDs in the *running code and dashboard UI* and explicitly excluded features the demo does not implement. This block records the v3 completion state. Plan: [ai-insight-prd-rewrite-plan-v3.md](./ai-insight-prd-rewrite-plan-v3.md). Tracker: [ai-insight-prd-rewrite-tracker.md](./ai-insight-prd-rewrite-tracker.md).

### 6.1 Deliverables

| Session | Scope | Status | Output |
|--------:|-------|--------|--------|
| 1 | Plan + audit re-grounding | ✅ Done 2026-05-12 | Plan v3 + tracker |
| 2 | Base PRD 10 + 18 Playwright screenshots | ✅ Done 2026-05-12 | `docs/prd/10-ai-insight-base.md` (20 sections + Appendix A, 1372 lines) and `docs/prd/screenshots/` (18 captures, including live `analyzing` state and feedback diff modal) |
| 3 | Finance PRD 11 | ✅ Done 2026-05-12 | `docs/prd/11-ai-insight-finance.md` (17 sections + Appendix A exact factory-prompt snapshot, 1793 lines) — 16-section catalog, 69-component inventory, model/provider table, fetcher contract, tool whitelist, rollout status from `ROLLOUT_TRACKER.md` |
| 4 | HR PRD 12 + cross-doc close-out | ✅ Done 2026-05-12 | `docs/prd/12-ai-insight-hr.md` (12 sections + Appendix A, 821 lines) — HR fully adopts the Finance engine; PII / RBAC / aggregation / role caches / payroll governance preserved in §12 Out-of-Scope Addendum |

### 6.2 What v3 changed versus the earlier Stage 5 pack

| Area | Stage 5 (2026-05-11) | v3 (2026-05-12) |
|------|----------------------|-----------------|
| Source of truth | Mix of code, prior PRD intent, and "production gap" mandates | Code + running dashboard UI only; prior intent dropped where it disagreed with code |
| Excluded features | Some "production gap" features still spec'd as P0 (evidence guard, PII filter, RBAC scope filter, run-log table, evaluation-result table, feedback audit trail, automatic re-evaluation, scoped lock, per-component re-run endpoint, `change_summary` persistence) | All ten items explicitly excluded from the PRDs; HR governance items moved to PRD 12 §12 Out-of-Scope Addendum for the production team to revisit |
| Screenshots | Older captures from before the admin Phase 3+4 overhaul | 18 fresh Playwright captures including live LLM-call states and the real surgical-editor diff modal |
| Per-section verification | High-level rollout summary only | Per-section verification & tuning subsections using the §17.6 template — Finance §14 (16 sections) and HR §10 (14 sections, all Pending) |
| HR posture | HR design described its own RBAC / PII / aggregation pipeline inline | HR adopts the Finance engine unmodified; governance layers deferred and named explicitly in §12 |
| Tool naming | Plan text said `query_rds` | PRDs use the in-code name `query_rds_table` |
| `FEEDBACK_MAX_WORDS` | Unconfirmed | Confirmed 80 in [word-count.ts:4](../../apps/dashboard/src/lib/ai-insight/word-count.ts#L4) |

### 6.3 v3 cross-doc consistency check

Performed at v3 close-out:

- **Section numbering.** All `Base §N.N` cross-references in PRD 12 verified against PRD 10's actual subsection headings — three stale references (§7.5/§7.6/§7.7, §8.4, §13.2) corrected.
- **Finance content leakage in Base.** PRD 10 mentions Finance section keys (`payment_collection_trend`, `sales_breakdown`, etc.) only as concrete examples for generic engine contracts and as one explicit known wart (`financial_variance` "Approve as Budget" hook in `InsightSectionHeader`). No engine logic depends on a Finance key.
- **HR keys in Base.** Zero. PRD 10 does not reference any HR section key.
- **Section + component counts.** Finance 16/69 and HR 14/31 (target) are stated consistently in PRDs 10/11/12.
- **Tool policy levels.** All three PRDs use `none` / `aggregate_only` / `full` — the engine's actual levels. The earlier HR-only `fixed_drilldown_tools` term is mapped to `full` in PRD 12 §9 with an explicit note.
- **Engine caps.** `MAX_RUNTIME_MS = 5 min`, `MAX_COST_PER_SECTION = 0.50 USD`, `MAX_CONCURRENCY = 2`, `MAX_TOOL_CALLS_PER_SUMMARY = 2`, `MAX_GUARD_ATTEMPTS = 2`, `FEEDBACK_MAX_WORDS = 80` — defined in PRD 10 and referenced (not re-defined) in PRDs 11/12.
- **Confirmed NOT-in-code list.** Identical in plan, tracker, and all three PRDs.

### 6.4 Code-versus-PRD gaps surfaced in v3

These are intentional gaps the PRDs flag for the production team — they are **not** PRD bugs, but real differences between the demo and the production target:

1. **HR is scaffold-only.** 5 placeholder section keys in code; PRD 12 documents the 14-section production target and the work needed to bridge.
2. **HR `SECTION_PAGE` uses lowercase `'hr'`** while Finance uses Title-Case page names. Production rebuild should normalise (Session 2 open item #5).
3. **`SECTION_NAMES` for `customer_margin_*` uses "Customer Margin" with a space**, while the dashboard URL is `/manual/general/customer-margin` (hyphen). Production rebuild should pick one slug convention (Session 2 open item #6).
4. **`/api/admin/ai-insight-prompts/seed-defaults` force modes** (`?force=seed`, `?force=all`) exist in code but are admin-only utilities, not P0 product features. PRD 10 §8.5 documents only the default idempotent path.
5. **`change_summary` is not persisted** to `ai_insight_prompt_versions`; it appears in the surgical-editor preview response but is discarded on apply. Explicit in PRD 10 §9 and on the exclusion list.
6. **Lock is singleton, not scoped.** PRD 10 §16 documents this. Multi-tenant deployments must extend the schema.
7. **Persistence is latest-only (DELETE+INSERT).** PRD 10 §14.

### 6.5 What still needs the production team's decision

These items were intentionally left to the production team rather than re-spec'd in v3:

1. PRD 12 §12 — PII filter, RBAC scope, aggregation thresholds, role/user cache keys, payroll governance, automatic re-evaluation, feedback audit trail, forbidden-output guard.
2. Whether `hr_component_analysis` and `hr_summary_analysis` should structurally diverge from Finance equivalents or stay format-identical with HR persona only.
3. Whether to wire automatic re-evaluation triggers on threshold or prompt-version changes.
4. Whether the singleton lock survives the move to a multi-user / multi-org production deployment.
5. Cost cap per HR section + role scope.

### 6.6 v3 close-out

v3 rewrite is complete. PRDs 10/11/12 are the implementation pack for a stack-agnostic production rebuild and replace any earlier conflicting guidance in this repo.
