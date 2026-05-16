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

# [Hoi-Yong_Finance] recent context, 2026-05-16 10:29pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19,310t read) | 322,465t work | 94% savings

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
5383 9:20p 🔵 Threshold Tokens Appear in Three Surfaces: prompts-defaults, data-fetcher, and component-info — component-info Has Static Placeholder Fallbacks
5384 9:21p 🔵 component-info.ts IS Dynamically Rendered via component-info-renderer.ts — Previous Static Stale Risk Assessment Was Wrong
5385 " ⚖️ Simplify "No Threshold" Message in Prompt UI
5386 " ⚖️ H1/H2 Terminology is Not Hoi Yong Domain Language — Needs Replacement
5387 9:31p 🔵 Threshold Config and Prompt Defaults File Structure for AI Insight Prompts
5388 " 🔵 AI Insight Threshold Config Has E2E Tests and JSON Snapshots
5389 9:32p 🔵 Located Verbose "No Threshold" Message in ConfigurationPanel.tsx
5395 " 🔵 H1/H2 Split Logic in data-fetcher.ts — Positional, Not Calendar-Based
5397 " 🔵 H1/H2 Also Present in Docs Audit Artifact — Adds to Rename Scope
5398 " 🟣 H1/H2 Replaced with Fiscal Quarter Groups in Invoiced vs Collected Data Fetcher
5390 " 🔵 H1/H2 Terminology Scope — Three Files in AI Insight Pipeline
5391 " 🔵 Current Working Tree State — AI Insight Config Feature in Progress
5392 9:33p 🔵 ReadOnlyState Component Has Two Distinct Usage Contexts in ConfigurationPanel
5393 " 🔴 Simplified "No Threshold" Message — Moved to Title, Body Removed
5394 9:34p ✅ Production Build Passes After ConfigurationPanel.tsx Copy Change
5396 9:35p 🔵 No Q1/Q2/Quarter Terminology in Payment/Collection Domain — Fiscal Year is Mar–Feb
5404 9:38p ✅ Production Build Passes After Full H1/H2 → Fiscal Quarter Rename
5399 9:40p 🔵 Post-Patch File Read Shows Stale Cache — Old H1/H2 Code Still Visible in Read Output
5400 9:41p 🔵 Fiscal Quarter Patch to data-fetcher.ts May Not Have Applied — H1/H2 Still Found by rg After Patch
5401 " 🔵 prompts-defaults.ts Still Contains H1/H2 — Not Yet Updated After data-fetcher.ts Change
5402 " ✅ Fiscal Quarter Patch Re-Applied to data-fetcher.ts — Second Successful write_file Call
5403 " ✅ prompts-defaults.ts Updated — H1/H2 References Replaced with Fiscal Quarter Language
5405 9:43p 🔵 types.ts Added to Modified Files — H1/H2 Comment Likely Updated
5406 " 🔵 Git Diff Confirms H1/H2 Rename Scope: 3 Files, 132 Insertions, 71 Deletions
5407 " ✅ H1/H2 Terminology Fully Removed from ai-insight Source Directory
5410 " 🔵 Hoi-Yong Finance Project Structure and AI Insight Architecture
5408 " 🔵 Fiscal Quarter Implementation Confirmed Live in data-fetcher.ts
5409 9:44p ⚖️ Plan Doc Formalizes H1/H2 → Fiscal Quarter Rule with Explicit Quarter Boundaries
5411 " 🔵 Session 4 Starting Git State — Uncommitted Session 2/3 Changes Present
5412 " ⚖️ AI Insight Config Client-Ready Threshold Settings Plan — Full Design Decisions
5413 " 🔵 BMAD Framework Configured in Hoi-Yong Finance Project
5414 9:45p 🔵 THRESHOLD_PRESENTATION Map State — Session 2/3 Entries Present, Sales KPIs Missing
5415 " 🔵 Sales KPI Prompt Threshold Tokens Identified in prompts-defaults.ts
5416 9:47p 🔵 Sales KPI Threshold Token Definitions — Exact Defaults and Structure Confirmed
5417 " 🔵 Playwright e2e Spec Current Coverage — Session 2/3 Tests Established Patterns for Session 4
5418 " 🔵 Playwright Test Cleanup Pattern — Finally Block Must Restore All Edited Threshold Values
5419 " 🔵 THRESHOLD_PRESENTATION Schema Pattern — Full Structure Confirmed from Existing Entries
5425 " 🔵 Sales KPI Fetchers Hardcode Threshold Values in Data Block Status Text
5420 9:48p 🔵 Multi-Rule THRESHOLD_PRESENTATION Pattern — bs_statement Confirms net_sales Needs Two Rules
5421 9:49p 🔵 Threshold Runtime Internals — Token Key Format, Validation Fallback, and Cache TTL
5422 " 🔵 ConfigurationPanel Rendering Logic — Title Display Conditional on Multiple Rules
5423 9:50p 🔵 PromptConfigDashboard Default Selection Logic Prioritizes Prompts With Presentation Metadata
5424 " 🔵 Sales KPI Prompt Templates — Exact Token Injection Points and Band Labels Confirmed
5426 9:51p 🔵 by_customer Fetcher Uses Live net_sales Credit Note Thresholds — Separate from credit_notes Component Tokens
5427 9:52p 🔵 PromptTree Search Indexes Business Labels When Presentation Exists — Token Names Become Unsearchable
5428 9:53p 🔵 test-thresholds.ts Scope — Sales KPI Prompts Not in Snapshot; Snapshot Safe After THRESHOLD_PRESENTATION Addition
5429 " 🔵 Snapshot Contains No Sales KPI or Presentation Terms; Config API Route Confirmed Thin
5430 " 🔵 Thresholds API Routes Already Return thresholdPresentation — Zero Route Changes Needed for Session 4
5431 9:54p 🔵 prompt-config.ts Uses Generic Logic — No Hardcoded Sales KPI References
5432 10:01p ⚖️ Sales KPI Prompt Overlap Identified — Component Insight Modal Deduplication Deferred to Separate Study

Access 322k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
