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

# [Hoi-Yong_Finance] recent context, 2026-05-20 10:47am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (22,891t read) | 261,148t work | 91% savings

### May 17, 2026
S783 User asked whether Finance KPI and Budget Setting screenshots are included in the documentation. Primary session ran a full screenshot audit confirming the gap, then completed B7 doc work (docs 11/12 + 4 patches). Commit e341c9a created and pushed to GitHub. Claude's response to user is still at the "Want me to commit?" stage in the current replay batch. (May 17 at 7:40 PM)
S784 User asked whether Finance KPI and Budget Setting screenshots are included in the documentation. Primary session confirmed the gap via screenshot audit, completed all B7 doc work (docs 11/12 + 4 patches), and committed + pushed e341c9a. (May 17 at 7:41 PM)
S785 AI Insight Documentation Build 6 completion + pre-handoff assessment of ai-insight-docs for AI Agent Amelia (May 17 at 7:42 PM)
6024 9:05p ✅ AI Insight Docs Session 4: Final Consistency Pass Completed
6025 9:07p ✅ AI Insight Docs Implementation Readiness Tracker Updated
6029 " ⚖️ Production Build Order and Two Remaining Open Decisions Documented
6030 " 🔵 Production Hardening Gaps Identified in Frontend and Admin Layers
6031 " 🔵 AI Insight Engine Uses OpenRouter Exclusively — No Direct Anthropic or OpenAI SDK
6026 9:08p 🔵 Seven Files Modified Across AI Insight Docs Project
6027 9:09p 🔵 AI Insight Docs Readiness Audit Fully Completed — All 4 Sessions Done
6028 " ⚖️ query_rds_table SQL Dialect Must Be Resolved Before Production
6032 9:10p 🔵 Complete Open Decisions List — Eight Items Requiring Human Resolution
6033 " ✅ Session 3 Fixed Domain-Pack and Prompt Catalog Contracts
6034 " ✅ Session 4 Final Pass Corrected Admin Scope, Variance KPI Cards, and Storage Wording
6035 " 🔵 Finance Budget Setting and Variance KPI Not Yet Deployed to Production App
6036 9:12p 🔵 Finance-Specific Cancelled Filter Is Baked Into Engine tools.ts — New Domain Packs Must Respect This Boundary
6037 " 🔵 Batch Orchestrator Has Single-Process Assumption — Serverless Deployments Require Durable Worker
6038 " 🔵 Public Read API Cache Policy Must Be Made Explicit in Production
6039 " 🔵 Finance Budget Setting and Variance KPI Reference Implementation File Map Documented
6040 " 🔵 Seven Verification Checkpoints Defined for Budget Setting and Variance KPI Production Acceptance
6041 9:13p 🔵 fv_variance_summary Prompt Uses Fixed ±5/15% Bands While Fetcher Sends Per-Line Saved Tolerance
6043 " 🔵 "Approve as Budget" Button Is Finance-Specific Code Baked Into Shared InsightSectionHeader
6044 " 🔵 Applying a New Prompt Version Does Not Auto-Trigger Re-Analysis — Intentional Paid-Action Gate
S786 AI Insight docs handoff assessment for AI Agent Amelia + Build 6 completion confirmation (May 17 at 9:15 PM)
S787 Amelia handoff assessment: _TEMPLATE.md purpose, assets/ linkage audit, and B6 documentation completion (May 17 at 9:15 PM)
6048 9:15p 🔵 ai-insight-docs assets/ Contains 7 PNGs; Doc 12 and Tracker File Exist Beyond the 11-Doc Set
S788 Amelia handoff assessment answered: _TEMPLATE.md is an authoring artifact to exclude; assets/ are all linked but require scope decision for doc 12 (May 17 at 9:16 PM)
S789 Amelia handoff preparation for ai-insight-docs — _TEMPLATE.md and assets/ audit, then three fixes committed and pushed (May 17 at 9:16 PM)
6049 9:17p 🔵 PRODUCTION_HANDOFF.md Is the Entry Point for AI Agent Amelia — Reveals Full Doc Scope and P0 Blockers
6053 " ✅ PRODUCTION_HANDOFF.md Updated with Implementer Bundle Scope Section
6054 " ✅ Amelia Handoff Cleanup — 3 Files Modified, 27 Insertions Staged for Commit
S790 Amelia handoff preparation complete — three fixes committed and pushed (3ba33d9) (May 17 at 9:17 PM)
6050 " ✅ _TEMPLATE.md Updated with Implementer Warning Banner
6051 " 🔵 08-admin.md Insertion Point Located for Adding §7 Reference Captures Block
6052 9:18p ✅ 08-admin.md §7 Reference Captures Block Added for 08-*.png Screenshots
6055 9:19p ✅ Amelia Handoff Fixes Committed and Pushed — commit 3ba33d9
S791 Amelia handoff complete — tracker structure inspected, commit 3ba33d9 pushed (repeated idempotently) (May 17 at 9:19 PM)
6056 9:20p 🔵 IMPLEMENTATION_READINESS_TRACKER.md Structure: 4 Completed Audit Sessions, No P0/P1 Blockers
6057 9:21p 🔵 IMPLEMENTATION_READINESS_TRACKER.md Open Decisions — 8 Specific Items with Owner Assignments
S792 Amelia handoff complete — tracker Open Decisions and Session Notes fully read; all fixes on remote (May 17 at 9:22 PM)
6058 9:23p ✅ 00-overview.md §7 Stripped of _TEMPLATE.md Reference
6059 " ✅ PRODUCTION_HANDOFF.md Bundle Scope Refined — Tracker and Template Exclude Lines Removed
### May 19, 2026
7602 4:27p 🔵 Hoi-Yong Finance AI Insight Documentation Inventory
7603 " 🔵 Hoi-Yong Finance Uses .serena and .claude Memory Directories
7609 " 🔵 AI Insight Concept Handoff — Architecture, HR Gap Analysis, and User Preferences
7604 4:28p 🔵 AI Insight Persistent Memory Files Inventoried in .serena and .claude
7606 4:29p 🔵 AI Insight Optimization Master Log — Full Iteration History and Architecture Decisions
7607 " 🔵 AI Insight Production Handoff Doc — Build Order, Blockers, and HR Transfer Warning
7608 " 🔵 Hoi-Yong Finance CLAUDE.md — Project AI Collaboration Norms
7610 4:30p 🔵 AI Insight Interaction Model and Prompt Architecture from Claude Project Memory
7612 " ⚖️ UI Readability Rule — No Gray/Muted Text for Important Labels
7614 " 🔵 SQLite-to-PostgreSQL Migration Lessons — API Param Validation and Service Separation
7616 4:31p ⚖️ AI Insight Model Ladder Updated 2026-05-16 — DeepSeek-v4-Pro Replaces GLM 5.1 as Summary Primary
7618 " ⚖️ AI Insight Rollout S05 — OpenRouter Provider Decision and Privacy-Preserving Routing Requirements
7620 " 🔵 AI Insight Docs Readiness Audit Complete — 4-Session Audit, Final State 2026-05-17
7621 " 🟣 AI Insight Config Threshold Metadata — Sales KPIs and Breakdown Implemented (Sessions 4-5, 2026-05-16)
7622 4:32p ⚖️ AI Insight PRD Update Deferred — Obsolete Features to Remove, New Features to Add
7624 4:33p 🔵 Hoi-Yong_HR Has No Existing Memory Files, CLAUDE.md, or AGENTS.md
7625 " 🔵 Hoi-Yong_HR Project Structure — Has CLAUDE.md, AGENTS.md, and All Agent Dirs
7626 " 🔵 Hoi-Yong_HR Working Tree — Active Changes Including AWS SES Sprint Proposal

Access 261k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
