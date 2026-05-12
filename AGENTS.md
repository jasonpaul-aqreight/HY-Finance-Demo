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

# [Hoi-Yong_Finance] recent context, 2026-05-12 9:16am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (24,459t read) | 549,328t work | 96% savings

### May 10, 2026
S568 Phase 2 of AI Insight Config Overhaul — complete and commit all backend/schema/HR scaffold work (May 10 at 11:31 AM)
S567 Phase 2 of AI Insight Config Overhaul — complete implementation, verification, and commit/push (May 10 at 12:07 PM)
S569 Phase 2 AI Insight Config Overhaul — pre-commit git status check confirms all changes ready to stage (May 10 at 12:12 PM)
S570 Phase 2 AI Insight Config Overhaul — commit and push all changes to GitHub (May 10 at 12:13 PM)
S571 BMad agent dev session initialized for Hoi-Yong_Finance project (May 10 at 12:14 PM)
S572 UI polish pass: Amelia reviewing mockup differences against current Phase 3 implementation before making targeted component changes (May 10 at 5:33 PM)
S573 Full-width layout + VersionPanel improvements for ai-insight-config admin page (May 10 at 5:37 PM)
S574 BMad agent dev session started for Hoi-Yong_Finance project (May 10 at 7:56 PM)
S576 Sales Trend AI Insight KPI cards show AnalyzeIcon but orchestrator never generates their component analysis — awaiting fix decision (May 10 at 8:02 PM)
S575 Sales Trend AI Insight config mismatch — only 2 of 5 components shown; KPI cards have AnalyzeIcon but no orchestrator analysis (May 10 at 8:24 PM)
3180 10:43p 🔵 S01 Playwright Eval Exposed Three Concrete AI Output Bugs
3181 " ✅ ROLLOUT_TRACKER.md Updated with S01 Evaluation Row
3182 10:50p 🔴 S01 Data Fetcher Fixed with Pre-computed Rank Labels and Average Gap
3183 " ⚖️ S01 Tool Policy Changed from aggregate_only to none
3184 " ✅ Rollout Tracker Gains Formal Quality Issue Handling Process
3185 " 🔵 Next.js Build Fails in Sandboxed Shell Without Network Access
3187 10:55p ⚖️ S01 Committed and Pushed; S02 Rollout Next
3188 " 🔄 Sales Summary Fetcher Split into Four Individual Component Fetchers
3189 10:56p 🔵 Working Tree Contains Large Uncommitted AI Insight Config Admin UI Overhaul
3193 " ⚖️ Selective Hunk Staging Used to Isolate S01 Fixes from Sales Refactor in data-fetcher.ts
3190 10:57p 🟣 S01 payment_collection_trend Rollout Completed — 9/10 Quality Achieved
3191 " 🔵 data-fetcher.ts Contains Unrelated Uncommitted Sales Fetchers from Prior Session
3192 " 🔵 git index.lock Requires Escalated Sandbox Permissions
3194 " ✅ Hunks 1–9 Staged for S01 Commit; Hunk 10 (New Sales Fetchers) Skipped
3195 10:58p 🔵 git restore --staged Failed Due to Index Lock from Active git add -p TTY Session
3196 " 🔴 Accidental Sales Hunk Unstaged via git restore with Escalated Permissions
3197 " ✅ Corrected Hunk Staging: Only S01 Hunks 1–8 Staged, Both Sales Hunks 9–10 Skipped
3198 10:59p ✅ ROLLOUT_TRACKER.md and tool-policy.ts Staged to Complete S01 Commit Index
3200 " 🔵 AI Insight Improvement Rollout Tracker — S03 Next in Queue
3199 " 🔵 Staged Index Verified: data-fetcher.ts Shows 48 Insertions Confirming Sales Hunks Excluded
3201 " 🔵 AI Insight Live Architecture and Verified Improvement State
3202 11:01p 🔵 AI Insight Study MASTER_LOG — Iteration History, Architectural Lessons, and Pending Iter 8.1
3203 " 🔵 S03 Sales Summary Split — Partial Implementation State Audit
3204 " 🔵 Iter 8.1 Implementation Spec — Provider Abstraction, Tool Schema Translation, and Open Gate Items
3205 " 🔵 Git Working Tree State Before S03 Rollout — Pre-existing Modifications Confirmed
3206 11:02p 🔵 S03 sales_trend Codebase Audit — Tool Policy, Data Sources, and Allowed Columns
3207 " 🔵 S03 net_sales_trend Fetcher Has Sparse Allowed Whitelist — No Pre-computed Aggregates
3208 11:03p 🔵 sales_trend Section Already Refactored — sales_summary Split Into 4 Individual KPI Fetchers
3209 " 🔵 Complete SECTION_COMPONENTS Mapping for All Finance AI Insight Sections
3211 " 🔵 Sales KPI UI Components Wired to New Individual sales_trend Component Keys
3210 11:04p 🔵 sales_trend Component Prompts Populated in Defaults with Correct Thresholds
3212 11:18p 🔵 AI Insight Rollout Tracker State Read for S04 Resume
3213 11:19p 🔵 AI Insight System Architecture and Handoff Context Loaded
3215 11:20p 🔵 AI Insight Optimization MASTER_LOG Full History Loaded
3216 " 🔵 Iter 8.1 OpenRouter/GLM-5.1 Implementation Spec and Study Stop Criteria
3217 " 🔵 Working Tree Dirty State Before S04 Work Begins
3218 " 🔵 S04 sales_breakdown Audit: Summary Prompt Is Empty in prompts-defaults.ts
3214 " 🔵 S04 sales_breakdown Section Audit: Architecture and Data Sources Mapped
3219 11:23p 🔵 S04 sales_breakdown Tool Policy Discrepancy: Code Is 'full' But Compaction Notes Say 'aggregate_only'
3220 " 🔵 sales_breakdown Component Registry Confirmed: Four 'breakdown' Type Components
3221 11:24p 🔵 Full Tool Policy Map for All 16 Finance Sections Confirmed
3222 " 🔵 Section Scope Classification Map and Fetcher Routing Logic Confirmed
3223 " 🔵 S04 Fetcher Bug: by_agent Fetcher Queries pc_sales_by_outlet Instead of an Agent Table
3224 11:25p 🔵 S04 Fetcher Implementation Fully Audited: by_agent Uses Correct Multi-Dimension Table
3225 " 🔵 S04 Component Prompt Thresholds Confirmed in prompts-defaults.ts
3226 11:26p 🔵 PRD Summary Questions for All 16 Sections and Tool Policy Rationale Confirmed
3228 " 🔵 Historical sales_breakdown Logs Confirm Recurring Summary Tool-Call Schema Failures Since April 2026
3227 11:27p 🔵 pc_sales_daily Has Pre-computed cn_total and net_revenue for Section-Level CN Ratio
3229 11:35p ⚖️ AI Insight Rollout Policy Correction: Section Guidance Empty by Default, Tools Must Stay
3230 " 🟣 S04 sales_breakdown Fetchers Overhauled with Pre-calculated Diagnostics and Richer Allowed Values

Access 549k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
