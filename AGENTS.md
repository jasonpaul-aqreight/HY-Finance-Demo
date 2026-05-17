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

# [Hoi-Yong_Finance] recent context, 2026-05-17 9:09pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (24,187t read) | 304,716t work | 92% savings

### May 17, 2026
S774 Cross-reference legacy AI Insight PRDs (10-base, 11-finance) against new ai-insight-docs/ to identify gaps — what should be added so devs can build the production feature without ambiguity (May 17 at 6:41 PM)
S778 All pre-writing decisions finalized — proceeding to write ai-insight-docs/11-finance-domain-config.md covering Budget Setting, Credit Score config, and unbuilt KPI budget badge feature, plus patch existing docs for tool column whitelist gaps (May 17 at 6:59 PM)
S777 User confirmed doc scope and approved proceeding: create ai-insight-docs/11-finance-domain-config.md (for developers) covering Budget Setting, Credit Score config, KPI budget badges, plus patch existing docs for tool column whitelist gaps and other confirmed missing content (May 17 at 7:00 PM)
S776 Gap analysis between legacy AI Insight PRDs and new ai-insight-docs/ complete; now planning specific documentation additions — 11-validation-and-tuning.md, tool column whitelist patch, and new Finance domain config docs for Budget Setting and Credit Score Setting (May 17 at 7:00 PM)
S779 User asked whether Finance KPI screenshots (budget tag, vs budget, variance, last year) and Budget Setting screenshots are included in the documentation — triggering a B7 gap-audit review of docs 11/12 and screenshot coverage. (May 17 at 7:06 PM)
S780 User asked whether Finance KPI screenshots (budget tag, vs budget, variance, last year) and Budget Setting screenshots are included in the documentation — primary session completed B7 work, committed, and pushed to GitHub. (May 17 at 7:28 PM)
S781 User asked whether Finance KPI (budget tag, vs budget, variance, last year) and Budget Setting screenshots are included in the documentation. Primary session addressed the question, completed all B7 doc work, committed and pushed e341c9a, then updated both memory files. (May 17 at 7:38 PM)
S782 User asked whether Finance KPI (budget tag, vs budget, variance, last year) and Budget Setting screenshots are included in the documentation. Primary session responded, completed all B7 gap-audit work, and committed + pushed e341c9a to GitHub. (May 17 at 7:38 PM)
S783 User asked whether Finance KPI and Budget Setting screenshots are included in the documentation. Primary session ran a full screenshot audit confirming the gap, then completed B7 doc work (docs 11/12 + 4 patches). Commit e341c9a created and pushed to GitHub. Claude's response to user is still at the "Want me to commit?" stage in the current replay batch. (May 17 at 7:40 PM)
S784 User asked whether Finance KPI and Budget Setting screenshots are included in the documentation. Primary session confirmed the gap via screenshot audit, completed all B7 doc work (docs 11/12 + 4 patches), and committed + pushed e341c9a. (May 17 at 7:42 PM)
5973 8:21p 🔵 Pre-Existing Worktree State at Tracker Creation: Two Untracked Screenshots and scripts/ Directory
5981 8:22p 🔵 BudgetSettingDialog Shows Raw Line Codes (NS/CO/EP) Not Human Labels in Table Column
5977 8:24p 🔵 doc 08-admin.md: Admin Layer Contracts Read — Batch Trigger, Status Self-Heal, and Threshold Config
5978 " 🔵 doc 12-finance-domain-config.md: Budget Setting + Variance KPI Contracts Read — Not Yet Deployed to Production
5979 8:25p 🔵 doc 07-frontend.md Verification Checkpoint: Screenshots Are Confirming Evidence, Not Normative Spec
5982 8:29p 🔵 Variance KPI Route Filters to Only NS/CO/EP — OI Excluded Despite Being a Budget-Configurable Line
5983 " 🔵 V3VarianceKpiTile Interface in Code Diverges Significantly From doc 12 §4.3 Spec — Multiple Field Name and Shape Mismatches
5984 8:30p 🔵 getVarianceKpiTiles Produces Only 3 Tiles (NS/CO/EP); budget_global line_item PK Stores Full Labels Not Codes
5985 8:31p 🔵 PLKpiCardsV3: StatusBadge Renders "No Budget" Pill (Not Hidden); AnalyzeIcon Links to financial_overview Section
5986 8:32p 🔵 PLKpiCardsV3 Row Layout and financial_overview AI Component Keys Confirmed
5987 " 🔵 BudgetSettingDialog Always Receives Hardcoded userName="Admin" — approved_by Never Shows Real User
5990 8:33p ✅ Session 2 Audit Phase Complete — Findings Ready, Awaiting Approval Before Doc Patches
5994 " 🔴 doc 08-admin.md Patch Not Yet Reflected in Re-Read — Rule 12 and Verification Check 4 Still Show Old Text
5988 " 🔴 AI Insight Docs Session 2: Six Implementation Mismatches Fixed in Docs 07, 08, 12
5989 " ⚖️ Six Open Production Hardening Decisions Recorded in Tracker After Session 2 Audit
5991 8:35p ✅ User Approved Session 2 Doc Patches — Application to docs 07, 08, 12 Now In Progress
5992 " ✅ doc 07-frontend.md Patched: Section Hook Missing Stale-Safe Guard Documented
5993 8:36p ✅ doc 08-admin.md Patched: Cache-Control no-store Scope Corrected and Stale-Heal Test Fixed
5995 8:41p ✅ Session-3 Started for Hoi-Yong Finance AI Insight Implementation
5996 " 🔵 Session-3 Working Branch Has 5 Uncommitted Modified Files
5997 " 🔵 AI Insight Docs Readiness Tracker: Sessions 1 & 2 Complete, Session 3 Scope Loaded
5998 8:42p 🔵 Session 2 Doc Patches Uncommitted; Session 1 Pushed as Commit 4a451ed
5999 " 🔵 Session 3 Audit Scope: Prompt Catalog, Domain-Pack, and Validation Docs
6000 8:43p 🔵 AI_Insight_Study Has a Financial Variance Eval Subdirectory Not Listed in Session 3 Scope
6001 " ✅ Session 2 Doc Patches: Exact Corrections to 07-frontend, 08-admin, and 12-finance-domain-config
6002 " 🔵 data-fetcher.ts Is 5,820 Lines — Largest File in Session 3 Audit Scope
6003 " 🔵 Prompt Catalog Has 69 Components Across 7 Pages; Validation Doc References Removed "Click Analyze" Behavior
6004 8:44p 🔵 Summary System Prompt Hardcodes SQL Server dbo.* Syntax — Confirms Session 1 Dialect Decision
6005 8:46p 🔵 AI Insight Engine Now OpenRouter-Only; No Direct Claude SDK; HOW_TO_RUN_ITERATION Uses Removed "Click Analyze" Trigger
6006 8:47p 🔵 SECTION_COMPONENTS Confirms 69 Components Across 16 Finance Sections; 2-Tool Cap in Summary User Prompt
6007 " 🔵 Tool Policy Confirmed: 9 Aggregate Tables; aggregate_only Mutates Tool Schema, Not Just Validates
6008 " 🔵 executeRdsQuery Generates SQL Server Syntax: SELECT TOP + Bracket-Quoted Columns — Dialect Mismatch Confirmed
6009 8:50p 🔵 prompts-defaults.ts Comment Reveals Prompt DB Tables Were Dropped; Code Is Now the Runtime Source
6010 8:54p ✅ AI Insight Docs Session 3 Audit Patches Applied
6011 " ⚖️ Open Production Decisions Consolidated After Session 3
6012 " ✅ Project Memory Updated With Session 3 Audit Outcomes
6013 8:57p 🔵 Session 4 of AI Insight Docs Readiness Audit Initiated
6014 " 🔵 AI Insight Docs Audit Sessions 1–3 Completed Prior to Session 4
6015 " 🔵 Session 3 Outcomes and Full Open Decisions List Loaded for Session 4
6016 " 🔵 ai-insight-docs Complete File Inventory Confirmed for Session 4
6017 " 🔵 Session 4 Cross-Document Consistency Sweep: Key Terms All Verified
6018 8:58p 🔵 All 13 Layer Docs Conform to 8-Section Template Structure
6019 " 🔵 00-overview.md ENV Matrix and Documentation Map Verified Clean
6020 9:00p 🔵 Cache-Control no-store Gap Confirmed in Source Routes via Direct Code Verification
6021 " 🔵 Public AI Insight Section Route Inaccessible via Direct Shell Path Due to Bracket Globbing
6022 9:01p 🔵 Budget and Variance-KPI Route Implementation Verified Against Doc 12 Contracts
6023 " 🔵 Public Section Route Confirmed: No Cache Headers, Matches Doc 06 Handler Skeleton Exactly
6024 9:05p ✅ AI Insight Docs Session 4: Final Consistency Pass Completed
6025 9:07p ✅ AI Insight Docs Implementation Readiness Tracker Updated
6026 9:08p 🔵 Seven Files Modified Across AI Insight Docs Project

Access 305k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
