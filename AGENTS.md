# Codex Project Memory - Hoi-Yong Finance Demo

## Communication And Process

- Use simple, concise English.
- Do not overengineer. Prefer the smallest solution that proves or improves the concept.
- The user wants senior guidance and product clarity before code. For AI Insight optimization iterations, discuss the iteration first, write a change plan, and get explicit approval before implementation.
- Ask before committing after implementation.
- End users are older executives. Prioritize readability, strong contrast, and business trust. Do not use gray/muted text for important labels, section headers, or values.

## Project Purpose

- This repo, `/Users/aqreight/Documents/Projects/Hoi-Yong_Finance`, is a demo/proof-of-concept for:
  - the Finance dashboard concept
  - the AI Insight concept: an embedded analyst inside the dashboard
- The Finance dashboard concept is considered finalized enough for the demo.
- Current focus is improving the AI Insight concept. The existing plan works, but is not good enough yet.
- After the concept is finalized, create the PRD and transfer the validated direction to the actual dashboard repo: `/Users/aqreight/Documents/Projects/Hoi-Yong_HR`.
- Do not silently switch to `/Users/aqreight/Documents/Projects/Hoi-Yong_HR`. Ask the user before working there.

## Current App Shape

- Main app: `apps/dashboard`
- Stack: Next.js 16.1.7, React 19, TypeScript strict, Tailwind 4, shadcn/Base UI primitives, Recharts, PostgreSQL via `pg`, OpenRouter SDK `@openrouter/sdk` for AI Insight model calls.
- Supporting service: `apps/sync-service`
- AI Insight implementation lives mainly in:
  - `apps/dashboard/src/lib/ai-insight/`
  - `apps/dashboard/src/components/ai-insight/`
  - `apps/dashboard/src/hooks/ai-insight/`
  - `apps/dashboard/src/app/api/ai-insight/`
  - `apps/dashboard/sql/ai-insight-schema.sql`

## AI Insight Product Concept

- AI Insight is an embedded analyst, not a chatbot. Users do not type free-form questions.
- Purpose: explain what the user already sees in dashboard KPIs, tables, and charts, then extract the important findings and highlight them as good or bad.
- The dashboard shows an AI Insight panel per section/page. Users trigger analysis and receive structured cards plus detail.
- There are two user-facing output layers:
  - Component AI narrative: individual analysis for a specific KPI, table, or chart.
  - AI Panel Insight: section-level positive/negative insight cards, ranked by business impact, with evidence and detail.
- Finance concept: section/component-oriented analysis.
  - Phase 1: Haiku analyzes each component from pre-fetched data, no tools.
  - Phase 2: Sonnet synthesizes section-level good/bad insight cards and may use tools for root-cause evidence.
  - Output is parsed from `===INSIGHT===` blocks into `{ good: Insight[], bad: Insight[] }`.
  - Numeric guard validates every RM, percent, days, and count citation against source-data/tool-result whitelists.
  - Results stream over SSE and persist to PostgreSQL.
- Key trust rules:
  - Every number must trace to raw data blocks or tool results.
  - Summary reads raw fetcher data, not Haiku narrations.
  - Fetchers should include pre-calculated totals/ratios/percentages; do not ask the model to do arithmetic.
  - Include population labels so the model does not mix active-customer, outstanding, snapshot, and period scopes.
  - Column whitelisting is the core data-protection pattern for Finance tools.

## AI Insight Improvement Goal

The improvement work is not only cost cutting. It has three linked goals:

1. Simplify the AI Insight implementation.
   - Input: simplify tooling.
   - Input: simplify prompts.
   - Flow: simplify the number of model calls, retries, and tool loops.
2. Reduce token cost.
   - Fewer API calls, smaller prompts, less repeated context, fewer wasted tool calls, fewer guard retries.
3. Improve output quality.
   - Better good/bad findings.
   - Clearer executive-facing explanations.
   - Accurate number reporting with no hallucinated RM, percent, days, or count values.

Treat quality and trust as the non-negotiable output target. Cost savings are useful only if the AI still behaves like a reliable built-in analyst.

## Active AI Insight Study

- Single source of truth: `AI_Insight_Study/MASTER_LOG.md`.
- Procedure: `AI_Insight_Study/HOW_TO_RUN_ITERATION.md`.
- Pilot section: `payment_outstanding`.
- Eval set: `AI_Insight_Study/eval_set/snapshot_state.md` and `expected_values.json`.
- Target: reduce cost toward `$0.010/click` while keeping quality `>=8/10`.
- Baseline Iteration 0: `$0.141/click`, quality `9/10`, about 2 hallucinations.
- Iteration 1 is complete and locally committed as `ba4d192`:
  - change: numeric guard whitelist fixes
  - result: `$0.134/click`, quality `10/10`, 0 hallucinations
  - guard now passes final output; remaining retry cost comes from real Sonnet arithmetic hallucinations
- Current active baseline: Iteration 1.
- Next pending iteration: Iteration 2, add column-schema hint to the summary system prompt.
- `ba4d192` was blocked from push to `main` by branch protection. Check current git state before starting new iteration work.

## AI Insight Roadmap

Pending iterations from `AI_Insight_Study/MASTER_LOG.md`:

1. Iteration 2: add column-schema hint to summary system prompt.
2. Iteration 3: reduce summary tool cap from 4 to 2.
3. Iteration 4: pre-compute subtotals and strengthen no-arithmetic rule.
4. Iteration 5: enable prompt caching.
5. Iteration 6: combine 6 Haiku component calls into 1 call.
6. Iteration 7: pre-fetch agent/type breakdown and average payment days.
7. Iteration 8: switch summary model from Sonnet to Haiku, only if quality holds.
8. Iteration 9: tool reduction / set tool policy to `none`; keep this last because it is highest risk.

Follow the iteration process strictly:

1. Read `MASTER_LOG.md` and the relevant section of `02_analysis.md`.
2. Discuss the iteration with the user before any code edit.
3. Write a concise change plan.
4. Get explicit approval.
5. Implement only the approved change.
6. Run two study passes, score quality, update study docs.
7. Confirm with the user before committing.

## HR Transfer Considerations

- HR AI Insight work was previously designed/deferred. Epic 4 code was removed, but specs were preserved.
- HR is not a simple copy of Finance AI Insight. HR has stricter requirements:
  - PII filtering before model exposure
  - server-side RBAC scope filtering
  - role/user-specific caching
  - possibly a single-call briefing architecture instead of Finance's two-phase component architecture
  - JSON output with severity/detail bullets may be more appropriate than Finance good/bad delimiter output
- `ai-insight-hr-gap-analysis.md` estimates about 40% overlap and 60% gap between Finance base and HR design.
- Before writing the PRD for production, resolve whether HR should adopt the Finance two-phase pattern, keep a distinct HR briefing pattern, or converge on a simpler shared base.

## High-Value Docs

- `docs/prd/10-ai-insight-base.md` - shared/base AI Insight platform concept.
- `docs/prd/11-ai-insight-finance.md` - Finance AI Insight configuration.
- `docs/prd/12-ai-insight-hr.md` - HR AI Insight configuration.
- `docs/ai-insight-expected-output.md` - expected page/section/card outputs.
- `AI_Insight_Study/MASTER_LOG.md` - current optimization state and roadmap.
- `AI_Insight_Study/02_analysis.md` - detailed iteration plan.
- `AI_Insight_Study/HOW_TO_RUN_ITERATION.md` - mandatory worker procedure.
- `ai-insight-hr-gap-analysis.md` - Finance vs HR compatibility risks.
- `ai-insight-hr.md`, `hr-ai-insight-raw-docs.md`, `epic-4-ai-insights.md` - preserved HR specs and history.


<claude-mem-context>
# Memory Context

# [Hoi-Yong_Finance] recent context, 2026-05-16 6:31pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,067t read) | 226,798t work | 90% savings

### May 16, 2026
S749 AI Insight Config Rework — planning session wrap-up and handoff to Amelia (BMad dev) for implementation (May 16 at 2:53 PM)
S750 AI Insight Config Rework — session wrap-up, memory index update, plan handoff to Amelia (May 16 at 4:24 PM)
S751 AI Insight Config Rework — memory finalization with duplicate-run resolution and post-implementation follow-up instructions added (May 16 at 4:28 PM)
S752 AI Insight Config Rework — plan file finalized with "Execution &amp; Handoff" copy-paste prompts for Amelia + all memory fully written (May 16 at 4:34 PM)
S753 AI Insight Config Rework — all artifacts finalized; plan doc and memory fully updated with Execution &amp; Handoff section; ready for Amelia Phase 1 (May 16 at 4:34 PM)
S754 Review and approve the AI Insight Configurable Thresholds plan, then patch identified technical gaps before implementation begins (May 16 at 4:35 PM)
S755 Review AI Insight Configurable Thresholds plan for technical gaps, then patch the plan file after user approved with "Yes patch it" (May 16 at 5:06 PM)
S756 Patch the AI Insight Configurable Thresholds plan with 5 binding technical contracts identified during review (May 16 at 5:06 PM)
S757 Approve and finalize the AI Insight Configurable Thresholds plan (Revision 2), then prepare to kick off Phase 0 implementation (May 16 at 5:08 PM)
S758 AI Insight Configurable Thresholds plan reviewed, patched with 5 binding contracts, approved — awaiting Phase 0 kickoff decision (May 16 at 5:10 PM)
5263 5:27p 🔵 Phase 0 Audit Found 4 DB Prompts Differing from Code Defaults
5265 5:28p 🔵 Phase 0 Build Passes Clean — Old Feedback/Prompt Routes Still Present in Build Output
5266 " 🔵 Phase 1 Cleanup Scope Extended — BreadcrumbBar.tsx and PromptTree.tsx Need Edits Not Listed in Plan
5268 " 🔵 Complete Admin AI-Insight API File Inventory — 10 Files to Delete, 1 to Keep
5269 " 🔵 Two Additional Feedback API Routes Found Outside Admin Path
5267 5:29p 🔵 Phase 1 Execution Plan — 5 Steps, Currently Mapping References
5270 5:30p 🔵 Complete Phase 1 Reference Map — AppSidebar Polling, PromptTree feedbackBadge, PromptConfigDashboard FeedbackList All Confirmed
5271 " 🔵 AiInsightPanel.tsx Feedback Button Implementation — Exact Removals Mapped
5272 " 🔵 AppSidebar.tsx Feedback Removal Scope — useSWR Import Also Removable
5273 5:31p 🔵 prompt-loader.ts Full Implementation — DB Query Will Break After Migration 024, Fallback Chain Must Become Primary
5274 " 🔵 prompts.ts Architecture — Thin Public API Over prompt-loader; buildSummaryUserPrompt Uses Guidance Injection
5275 " 🔵 buildSummaryUserPrompt Guidance Injection Block — Exact Code to Remove in Phase 1
5276 " 🔵 AiInsightPanel.tsx Complete Feedback Removal — FeedbackModal and Toast Are Standalone JSX Blocks After Footer
5277 5:33p 🔵 PromptConfigDashboard Layout Must Be Restructured in Phase 1 — 3-Row Grid Collapses to 2
5278 " 🔵 PromptTree.tsx Requires Extensive Restructuring in Phase 1
5279 " 🔵 BreadcrumbBar.tsx — Small Edit Scope, Two feedback_router/surgical_editor Checks and One section_guidance Label
5280 5:34p 🔵 PromptTextPanel.tsx Has Feedback Reference Text and Version Pill — Both Need Phase 1 Updates
5281 5:35p 🔵 model-provider.ts and client.ts — feedback_router/surgical_editor Model Slots and Env Vars Need Phase 1 Removal
5282 5:36p 🔄 AI Insight Feedback Loop Removed (Phase 1 Complete)
5283 " 🔴 Toast.tsx Accidentally Deleted in Phase 1 Cleanup — Restored
5284 " 🟣 Playwright E2E Smoke Spec for Post-Feedback AI Insight Config
5285 5:39p 🔄 AI Insight Config Phase 2: Major Refactor In Progress
5286 5:40p 🔵 Phase 2 Plan: Threshold Registry, DB Table, and Token Substitution Architecture
5287 5:41p 🔵 Phases 0 and 1 Confirmed Complete; Revision 2 Binding Contracts Defined
5288 " 🔵 Phase 3 Tokenization Scope and Golden Regression Coverage Defined
5289 " 🔵 Plan Execution Model: One Phase Per Session with PRD Update Deferred
5290 5:42p ✅ Phase 0 + Phase 1 Net Change: 4073 Deletions, 255 Insertions Across 38 Files
5291 5:43p 🟣 New Files Created in Phases 0 and 1: Replacement API, Audit Artifact, Dev Overlay, Prompt Config
5292 " 🟣 Agentation Visual Dev Overlay Added to Dashboard
5293 " 🔵 Agentation Supports Two Modes: Browser-Local and MCP-Synced
5294 5:44p ✅ Phase 0 and Phase 1 Changes Staged for Commit
5298 " 🔵 Database Connection Architecture: Local Dev on Port 5433, AWS RDS for Autocount
5301 " 🔴 threshold-config.ts: Monotonic Validation Fixed with enforceMonotonic Flag and Token Reordering
5295 5:46p 🔵 Staged Commit Composition: 3132-Line Audit Artifact and 122-Line prompt-config.ts Are the Key Additions
5296 5:47p ✅ Phase 0+1 Committed to main: 73a3f5f "feat(ai-insight): remove feedback loop config baseline"
5297 " ✅ Phase 2 Execution Plan Activated with 5 Steps
5299 5:50p 🔵 Dashboard Tech Stack: OpenRouter SDK, node-postgres, No Test Runner
5300 " 🟣 threshold-config.ts Implemented: Full Registry, Loader, Formatter, Validator, and Save Logic
5302 5:58p 🔴 Fixed Default Validation Failures in 5 Threshold-Config Components
5303 " 🔵 Threshold Registry State: 56 Components, 194 Seed Rows, DB Falls Back to Defaults
5304 " 🟣 Phase 2 Threshold API Routes Confirmed in Production Build
5305 5:59p 🟣 Migration 025: ai_insight_thresholds Table with 194 Seed Rows
5306 6:02p 🔵 Phase 2 AI Insight Configurable Thresholds - Uncommitted Changes Ready
5307 " 🟣 Phase 2 AI Insight Configurable Thresholds Committed and Pushed
5308 " 🔵 Phase 3 Plan: Tokenize Prompts + Wire Single Source of Truth
5309 6:03p 🔵 threshold-config.ts Token Registry — Full Component Coverage
5310 6:06p 🔵 prompts-defaults.ts Already Tokenized with {{token}} Placeholders
5311 " 🔵 data-fetcher.ts Already Wired to classifyThresholdValue from Phase 2
5312 " 🔵 component-info.ts Has Hardcoded Threshold Strings — Primary Phase 3 Tokenization Target
5313 6:07p 🔵 numeric-guard.ts Live-Value Wire Already Active from Phase 2

Access 227k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
