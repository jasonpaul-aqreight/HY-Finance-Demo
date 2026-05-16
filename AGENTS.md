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

# [Hoi-Yong_Finance] recent context, 2026-05-16 5:41pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,982t read) | 252,786t work | 91% savings

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
5237 5:16p 🔵 Additional Feedback Loop Files Inventoried for Phase 1 Deletion
5238 " 🔵 AI Insight Schema SQL File Exists in Dashboard
5240 5:17p 🔵 PromptTree Gracefully Handles Missing Prompts — Feedback Router/Surgical Editor Will Auto-Drop
5244 5:18p 🔵 Current /api/admin/ai-insight-prompts Route: DB Dependencies for Phase 0 Replacement
5241 " 🟣 New /api/admin/ai-insight-config Endpoint Returns Prompts with thresholdGroups
5242 " 🔵 Next.js Dev Server Binds IPv6-Only — curl localhost Fails, 127.0.0.1 Succeeds
5243 " 🔵 Next.js 16.1.7 Production Build Passes Clean — 59 Static Pages, All AI-Insight Routes Dynamic
5245 5:19p 🔵 prompts.ts Contains Full Component/Section Registry for Phase 0 Config API Construction
5246 5:20p 🔵 prompts-defaults.ts: Hardcoded Threshold Values Identified as Phase 2 Tokenization Targets
5247 5:21p 🔵 prompt-store.ts: Full DB Schema and Key Routing Logic for Phase 0 Audit
5248 " 🔵 DEFAULT_SECTION_GUIDANCE All Empty: Phase 1 Guidance Removal Is Runtime No-Op for Finance
5251 5:23p 🔵 AI Insight Config Configurable Thresholds Plan — Phase Structure
5249 " 🔵 prompt-loader.ts: Cache Architecture and Throw-on-Miss Behavior for Phase 1 Safety
5250 " 🔵 Two-Pool DB Architecture: ai_insight_thresholds Will Use Local Pool
5252 " 🔵 Phase 0 Partial Implementation Already in Working Tree
5253 5:24p 🔵 bmad-quick-dev Skill Uses Step-File Architecture Workflow
5255 " ⚖️ AI Insight Threshold Config Architecture — Key Decisions and Binding Contracts
5254 " 🔵 Phase 0 Complete Pending Commit Approval — Phase 1 Is Next Action
5256 5:25p 🔵 Phase 1 Exact File Deletion List and Phase 0 Detailed Verification
5257 " 🔵 Dashboard Tech Stack — No Jest/Vitest Confirms Standalone tsx Test Approach
5258 " 🔵 Phase 0 Audit Artifact Exists in docs/plans/artifacts/
5259 5:26p 🔵 Phase 0 Replacement API Route File Confirmed Present
5260 " ✅ PromptConfigDashboard.tsx Switched to New Config API in Phase 0
5261 " 🟣 GET /api/admin/ai-insight-config Route Implemented Using Code Constants
5262 5:27p 🔵 prompt-config.ts Still Includes feedback_router and surgical_editor Prompt Rows
5263 " 🔵 Phase 0 Audit Found 4 DB Prompts Differing from Code Defaults
5264 " 🔵 Phase 0 Modified File Scope — 6 Files Changed, AGENTS.md Significantly Rewritten
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

Access 253k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
