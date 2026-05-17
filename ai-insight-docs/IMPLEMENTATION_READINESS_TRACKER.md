# AI Insight Docs Implementation Readiness Tracker

Started: 2026-05-17
Repository: `/Users/aqreight/Documents/Projects/Hoi-Yong_Finance`
Scope: `/ai-insight-docs`
Goal: verify the documentation against the Finance demo implementation and supporting artifacts so a production developer can build AI Insight without ambiguity.

## Current Status

| Session | Scope | Status | Date | Output |
|---:|---|---|---|---|
| 0 | Create tracker and handoff instructions | Done | 2026-05-17 | This tracker |
| 1 | Engine contracts: docs 00-06 | Done | 2026-05-17 | Findings resolved with approved doc patches; one dialect decision remains |
| 2 | Frontend, admin, finance config: docs 07, 08, 12 | Not started | - | Findings + approved doc patches |
| 3 | Prompt catalog, domain-pack, validation: docs 04a, 09, 10, 11 | Not started | - | Findings + approved doc patches |
| 4 | Final consistency and production-readiness pass | Not started | - | Final readiness report + unresolved decisions |

## Source-Of-Truth Order

When documents disagree, use this priority:

1. Running code in `apps/dashboard`.
2. Database schema in `apps/dashboard/sql/ai-insight-schema.sql` and code-created tables.
3. Current UI behavior and screenshots in `ai-insight-docs/assets`.
4. Study artifacts in `AI_Insight_Study`, especially `MASTER_LOG.md`, `HOW_TO_RUN_ITERATION.md`, eval sets, and run logs.
5. PRD and plan docs under `docs/prd` and `docs/plans`.
6. Existing `/ai-insight-docs` prose.

If the source of truth is unclear, mark it as a decision instead of guessing.

## Ground Rules For Every Session

- Work only in this Finance repo. Do not switch to `/Users/aqreight/Documents/Projects/Hoi-Yong_HR` without explicit user approval.
- This is a documentation-readiness audit. Do not implement production features in the demo app unless the user gives a separate approval.
- Before editing docs beyond tracker status updates, produce findings and a concise change plan, then get explicit approval.
- Keep edits small and targeted. Do not rewrite correct sections for style only.
- Check `git status --short` at the start and end. Do not revert user changes.
- Ask before committing.
- Use simple, direct language. Older executives are the end users, so flag low-contrast or unclear product wording when relevant.

## Finding Severity

| Severity | Meaning |
|---|---|
| P0 Blocking | A production developer would build the wrong behavior, data model, security posture, or API from this doc. |
| P1 Ambiguous | The doc leaves a real implementation choice unclear or omits a needed contract. |
| P2 Cleanup | Minor mismatch, stale reference, weak wording, missing citation, or non-blocking example issue. |
| Decision | Code/docs do not provide enough evidence; user/product decision is required. |

## Required Finding Format

Use this format in each audit session:

| ID | Severity | Doc section | Source of truth | Issue | Proposed fix |
|---|---|---|---|---|---|
| S1-001 | P1 | `01-storage.md` section X | `apps/...` | What is wrong or missing | Exact doc change needed |

For each source-of-truth claim, cite a file path and line number when practical.

## Session 1 - Engine Contracts Audit

### Scope

Docs:

- `ai-insight-docs/00-overview.md`
- `ai-insight-docs/01-storage.md`
- `ai-insight-docs/02-domain-catalog-and-thresholds.md`
- `ai-insight-docs/03-model-provider.md`
- `ai-insight-docs/04-insight-generation-and-prompts.md`
- `ai-insight-docs/05-batch-orchestration.md`
- `ai-insight-docs/06-api.md`

Implementation and artifacts to check:

- `apps/dashboard/sql/ai-insight-schema.sql`
- `apps/dashboard/src/lib/ai-insight/types.ts`
- `apps/dashboard/src/lib/ai-insight/storage.ts`
- `apps/dashboard/src/lib/ai-insight/batch-store.ts`
- `apps/dashboard/src/lib/ai-insight/batch-scope.ts`
- `apps/dashboard/src/lib/ai-insight/batch-runner.ts`
- `apps/dashboard/src/lib/ai-insight/orchestrator.ts`
- `apps/dashboard/src/lib/ai-insight/model-provider.ts`
- `apps/dashboard/src/lib/ai-insight/mock-llm.ts`
- `apps/dashboard/src/lib/ai-insight/numeric-guard.ts`
- `apps/dashboard/src/lib/ai-insight/tool-policy.ts`
- `apps/dashboard/src/lib/ai-insight/tools.ts`
- `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`
- `apps/dashboard/src/lib/ai-insight/prompt-loader.ts`
- `apps/dashboard/src/lib/ai-insight/prompt-config.ts`
- `apps/dashboard/src/lib/ai-insight/prompts.ts`
- `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`
- `apps/dashboard/src/lib/ai-insight/threshold-config.ts`
- `apps/dashboard/src/lib/ai-insight/component-info.ts`
- `apps/dashboard/src/lib/ai-insight/component-info-renderer.ts`
- `apps/dashboard/src/app/api/ai-insight/section/[section_key]/route.ts`
- `apps/dashboard/src/app/api/ai-insight/component/[section_key]/[component_key]/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight/batch/status/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight/batch/trigger/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight-thresholds/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight-config/route.ts`

### What To Verify

- Engine/domain-pack split is accurate and not hiding Finance-specific assumptions.
- Table names, columns, indexes, upsert behavior, stale-run behavior, and page/fiscal-period scope are correct.
- API paths, response envelopes, HTTP statuses, and dynamic/no-cache behavior match routes.
- Batch locking, in-memory state, persisted run status, delay config, section order, and error handling are clear.
- Model provider env vars, fallback rules, mock mode, cost metadata, prompt logging, and retry behavior are documented correctly.
- Generation flow, component calls, summary calls, parser, numeric guard, tool loop, tool whitelist, and debug logging are complete.
- Threshold registry and renderer contracts are clear enough for production rebuild.

### Session 1 Outcome - 2026-05-17

Status: completed after user approval.

Changed files:

- `ai-insight-docs/00-overview.md`
- `ai-insight-docs/02-domain-catalog-and-thresholds.md`
- `ai-insight-docs/03-model-provider.md`
- `ai-insight-docs/04-insight-generation-and-prompts.md`
- `ai-insight-docs/05-batch-orchestration.md`
- `ai-insight-docs/06-api.md`
- `ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md`

Applied fixes:

- Clarified the datastore split: local `DATABASE_URL` holds engine tables and Finance `pc_*`/budget/app-setting projections; `RDS_DATABASE_URL` is the fail-soft drill-down/source-query port.
- Added the exact Finance batch scope resolver map: section keys, persisted page keys, source tables, and concrete range/snapshot/fiscal rules.
- Corrected the model-provider cancellation verification setup so it does not conflict with the fail-fast missing-credential gate.
- Documented the summary tool-call cap nuance and the production rule to enforce a hard two-call cap.
- Corrected the stale-run verification check from `AI_INSIGHT_BATCH_STALE_MIN=0` to a positive stale window.
- Added explicit public read API cache/dynamic behavior guidance.

Open decision:

- `query_rds_table` dialect/driver must be resolved before production rebuild. The reference uses a Node `pg` pool for `RDS_DATABASE_URL`, but the AI tool executor currently emits SQL Server-shaped SQL (`dbo.*`, `SELECT TOP`, bracket-quoted columns). Production must choose one concrete dialect and align the driver, executor, examples, and tests.

Known code follow-up if the demo remains the reference:

- The summary agent loop should enforce the two-tool-call cap at the individual tool-block level. The docs now state the production rule; current code gates the next model turn after the counter reaches two.

### Copy-Paste Prompt For A New Session

```text
Continue AI Insight docs implementation-readiness audit - Session 1 (Engine Contracts).

Load:
- ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md
- AGENTS.md

Goal:
Audit docs 00-06 against the Finance demo implementation. Do not edit docs yet except tracker status updates.

Required steps:
1. Check git status and preserve unrelated user changes.
2. Read the tracker ground rules and Session 1 scope.
3. Verify docs 00-06 against the listed code and SQL files.
4. Produce findings using the tracker finding table format with file/line evidence.
5. Write a concise doc patch plan and ask for explicit approval before applying doc edits.
6. After approved edits, update this tracker with completed items, open decisions, and changed files.
7. Update project memory with the session outcome.
8. Ask before committing.
```

## Session 2 - Frontend, Admin, Finance Config Audit

### Scope

Docs:

- `ai-insight-docs/07-frontend.md`
- `ai-insight-docs/08-admin.md`
- `ai-insight-docs/12-finance-domain-config.md`
- Screenshots in `ai-insight-docs/assets`

Implementation and artifacts to check:

- `apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx`
- `apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx`
- `apps/dashboard/src/components/ai-insight/InsightDetailDialog.tsx`
- `apps/dashboard/src/components/ai-insight/ComponentInsightDialog.tsx`
- `apps/dashboard/src/components/ai-insight/MarkdownRenderer.tsx`
- `apps/dashboard/src/components/ai-insight/BudgetSettingDialog.tsx`
- `apps/dashboard/src/hooks/ai-insight/useInsightAnalysis.ts`
- `apps/dashboard/src/hooks/ai-insight/useBatchStatus.ts`
- `apps/dashboard/src/lib/ai-insight/client.ts`
- `apps/dashboard/src/components/admin/sync/AiInsightBatchCard.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/ConfigurationPanel.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx`
- `apps/dashboard/src/app/admin/ai-insight-config/page.tsx`
- `apps/dashboard/src/app/admin/sync/page.tsx`
- `apps/dashboard/src/app/api/admin/ai-insight/batch/status/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight/batch/trigger/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight-thresholds/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight-config/route.ts`
- `apps/dashboard/src/app/api/budget/route.ts`
- `apps/dashboard/src/lib/budget/queries.ts`
- `apps/dashboard/src/lib/budget/status.ts`
- `apps/dashboard/src/app/api/pnl/v3/variance-kpi/route.ts`
- `apps/dashboard/src/components/pnl/dashboard-v3/PLKpiCardsV3.tsx`
- `apps/dashboard/src/components/pnl/dashboard-v3/DashboardShellV3.tsx`

### What To Verify

- Section panel states, empty states, auto-expanded behavior, detail dialog, component dialog, and markdown rendering match code and screenshots.
- The docs do not describe removed manual Analyze/SSE behavior as current end-user behavior.
- Admin batch trigger/status UI, API envelopes, auth gate, polling behavior, and error states are complete.
- Prompt/threshold admin UI is described accurately, including what is editable versus read-only.
- Budget setting and variance KPI docs match actual data model, API validation, badge logic, polarity rules, and AI Insight read-only integration.
- Screenshots are current and referenced correctly.
- Important labels and values are not described in a way that would encourage muted/low-contrast UI for older executives.

### Copy-Paste Prompt For A New Session

```text
Continue AI Insight docs implementation-readiness audit - Session 2 (Frontend, Admin, Finance Config).

Load:
- ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md
- AGENTS.md

Goal:
Audit docs 07, 08, 12 and ai-insight-docs/assets against the current UI, admin surfaces, budget config, and variance KPI implementation. Do not edit docs yet except tracker status updates.

Required steps:
1. Check git status and preserve unrelated user changes.
2. Read the tracker ground rules and Session 2 scope.
3. Verify the docs against the listed component, hook, route, budget, and variance files.
4. If needed, run the dashboard and use Playwright/browser screenshots to confirm UI states.
5. Produce findings using the tracker finding table format with file/line or screenshot evidence.
6. Write a concise doc patch plan and ask for explicit approval before applying doc edits.
7. After approved edits, update this tracker with completed items, open decisions, and changed files.
8. Update project memory with the session outcome.
9. Ask before committing.
```

## Session 3 - Prompt Catalog, Domain-Pack, Validation Audit

### Scope

Docs:

- `ai-insight-docs/04a-prompt-catalog.md`
- `ai-insight-docs/09-end-to-end-walkthrough.md`
- `ai-insight-docs/10-adding-a-domain-pack.md`
- `ai-insight-docs/11-validation-and-tuning.md`

Implementation and artifacts to check:

- `apps/dashboard/src/lib/ai-insight/prompts.ts`
- `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`
- `apps/dashboard/src/lib/ai-insight/prompt-loader.ts`
- `apps/dashboard/src/lib/ai-insight/prompt-config.ts`
- `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`
- `apps/dashboard/src/lib/ai-insight/threshold-config.ts`
- `apps/dashboard/src/lib/ai-insight/component-info.ts`
- `apps/dashboard/src/lib/ai-insight/component-info-renderer.ts`
- `apps/dashboard/src/lib/ai-insight/batch-scope.ts`
- `apps/dashboard/src/lib/ai-insight/numeric-guard.ts`
- `apps/dashboard/src/lib/ai-insight/tools.ts`
- `apps/dashboard/src/lib/ai-insight/tool-policy.ts`
- `AI_Insight_Study/MASTER_LOG.md`
- `AI_Insight_Study/HOW_TO_RUN_ITERATION.md`
- `AI_Insight_Study/02_analysis.md`
- `AI_Insight_Study/eval_set/expected_values.json`
- `AI_Insight_Study/eval_set/snapshot_state.md`
- `AI_Insight_Study/eval_set/quality_rubric.md`
- Relevant completed iteration docs and logs under `AI_Insight_Study`
- `docs/prd/10-ai-insight-base.md`
- `docs/prd/11-ai-insight-finance.md`
- `docs/prd/12-ai-insight-hr.md`
- `ai-insight-hr-gap-analysis.md` if present

### What To Verify

- Prompt catalog component counts, section names, page names, component keys, and prompt bodies match code.
- System prompts and summary delimiter/parser rules match implementation.
- Domain-pack guide clearly separates engine-owned contracts from pack-owned contracts.
- Adding a new domain pack is implementable without hidden Finance assumptions.
- HR transfer guidance does not overstate compatibility or ignore PII/RBAC/cache risks.
- Validation/tuning procedure matches the current study process and active baseline.
- Eval-set expectations, quality gate, cost targets, and iteration roadmap are current.
- Numeric trust rules, no-arithmetic rules, whitelist behavior, and tool-policy guidance are accurate.

### Copy-Paste Prompt For A New Session

```text
Continue AI Insight docs implementation-readiness audit - Session 3 (Prompt Catalog, Domain-Pack, Validation).

Load:
- ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md
- AGENTS.md

Goal:
Audit docs 04a, 09, 10, and 11 against prompts, fetchers, threshold metadata, domain-pack boundaries, numeric guard, tools, and AI_Insight_Study artifacts. Do not edit docs yet except tracker status updates.

Required steps:
1. Check git status and preserve unrelated user changes.
2. Read the tracker ground rules and Session 3 scope.
3. Verify prompt catalog counts, keys, prompt bodies, domain-pack instructions, and validation/tuning rules against the listed files.
4. Produce findings using the tracker finding table format with file/line evidence.
5. Write a concise doc patch plan and ask for explicit approval before applying doc edits.
6. After approved edits, update this tracker with completed items, open decisions, and changed files.
7. Update project memory with the session outcome.
8. Ask before committing.
```

## Session 4 - Final Consistency And Production-Readiness Pass

### Scope

All `/ai-insight-docs` files:

- `ai-insight-docs/00-overview.md`
- `ai-insight-docs/01-storage.md`
- `ai-insight-docs/02-domain-catalog-and-thresholds.md`
- `ai-insight-docs/03-model-provider.md`
- `ai-insight-docs/04-insight-generation-and-prompts.md`
- `ai-insight-docs/04a-prompt-catalog.md`
- `ai-insight-docs/05-batch-orchestration.md`
- `ai-insight-docs/06-api.md`
- `ai-insight-docs/07-frontend.md`
- `ai-insight-docs/08-admin.md`
- `ai-insight-docs/09-end-to-end-walkthrough.md`
- `ai-insight-docs/10-adding-a-domain-pack.md`
- `ai-insight-docs/11-validation-and-tuning.md`
- `ai-insight-docs/12-finance-domain-config.md`
- `ai-insight-docs/_TEMPLATE.md`
- `ai-insight-docs/assets`

### What To Verify

- All previous P0/P1 findings are resolved or explicitly listed as decisions.
- Cross-document names, paths, API routes, table names, env vars, model names, and section/component counts are consistent.
- Every doc has enough prerequisites, contracts, behavior, edge cases, reference implementation, and verification checkpoints.
- No doc silently requires production features that are not in the demo implementation unless labeled as production decisions.
- The implementation order is clear for a production developer.
- Remaining decisions are isolated, named, and assigned to user/product/production engineering.

### Copy-Paste Prompt For A New Session

```text
Continue AI Insight docs implementation-readiness audit - Session 4 (Final Readiness Pass).

Load:
- ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md
- AGENTS.md

Goal:
Run the final cross-document consistency and production-readiness pass after Sessions 1-3 are complete.

Required steps:
1. Check git status and preserve unrelated user changes.
2. Confirm Sessions 1-3 are marked Done or clearly note any skipped scope.
3. Review all ai-insight-docs markdown files and assets for cross-document contradictions, stale references, missing implementation order, and unresolved decisions.
4. Produce a final readiness report with:
   - resolved findings,
   - remaining decisions,
   - any P0/P1 blockers,
   - recommended production build order.
5. Apply only approved final doc patches.
6. Update this tracker to mark final status.
7. Update project memory with the final outcome.
8. Ask before committing.
```

## Session Notes

Add notes below as sessions complete.

### Session 0 - Tracker Created (2026-05-17)

- Created this tracker.
- No implementation audit has been performed yet.
- Known pre-existing worktree state at creation time:
  - `AGENTS.md` modified.
  - `ai-insight-docs/assets/12-budget-setting-dialog.png` untracked.
  - `ai-insight-docs/assets/12-financial-kpi-cards.png` untracked.
  - `scripts/` untracked.

## Open Decisions

None recorded yet.

## Changed Files Log

| Date | Session | Files changed | Notes |
|---|---:|---|---|
| 2026-05-17 | 0 | `ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md` | Tracker created |
