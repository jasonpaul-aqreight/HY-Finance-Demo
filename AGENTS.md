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

# [Hoi-Yong_Finance] recent context, 2026-05-15 1:05pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,778t read) | 101,820t work | 80% savings

### May 15, 2026
S719 Round 2 plan still at approval gate — session looping on plain-English summary while awaiting Aqreight's Budget Setting placement decision (May 15 at 10:54 AM)
S720 Round 2 plan approval — data-fetcher.ts grep confirmed Budget scope; Budget Setting placement decision now fully evidence-backed (May 15 at 11:15 AM)
S721 Round 2 plan revised — Budget Setting moves to InsightSectionHeader panel header; empty state corrected to inline banner (not blocking); Aqreight deciding before approving (May 15 at 11:16 AM)
S722 Round 2 plan finalized — empty-state banner dropped; 3-change plan confirmed; awaiting Aqreight's approval to update plan file and call ExitPlanMode (May 15 at 11:17 AM)
S723 Round 2 Refinement implementation — Variance/Forecast/Budget panel: Budget Setting move, panel rename, prompt tightening (May 15 at 11:19 AM)
S724 Plan 2 research phase — PB&F methodology study requested before /financial-fpa-preview build; plan file also condensed to 105-line bullet format (May 15 at 11:27 AM)
S725 FP&A plan file finalised + PB&F research directive issued — plan condensed, session prompts delivered, research-first approach confirmed for Plan 2 (May 15 at 11:38 AM)
S726 FP&A AI Insight rework — plan file finalised at 105-line bullet format, PB&F research directive issued, session prompts ready for execution (May 15 at 11:38 AM)
S727 FP&A plan file condensed and finalised — both session prompts delivered, PB&F research directive issued before Plan 2 execution (May 15 at 11:39 AM)
4773 11:40a 🔵 budget_global Migration Drops Legacy budget Table — 4 Line Items, No FY Key, Seed from Latest FY
4774 " 🔵 Base Tables Schema — fiscal_year Table Provides FY Date Ranges; gl_account Links P&L Accounts to AccType
4775 11:41a 🔵 No period_no-to-Calendar Mapping Table in Schema — Resolution Handled in Application Layer
4776 " 🔵 Dashboard lib Directory Structure — 11 Domain Modules Including ai-insight, pnl, and budget
4777 " 🔵 lib/pnl Module Contains period-utils.ts — Period Resolution Logic Already Extracted
4779 11:42a 🔵 period-utils.ts — Period Encoding Scheme: period_no = year * 12 + month; Fiscal Year = Mar–Feb
4797 " 🔵 Forecasting & Variance Analysis Panel — Round 2 Rework Awaiting Verification
4802 " 🔵 Hoi-Yong Finance Dashboard Forecasting Panel Content
4780 " 🔵 budget/queries.ts Full API — BudgetRow Shape and saveGlobalBudget Transaction Pattern Confirmed
4781 " 🔵 lib/pnl/queries.ts Type Interfaces — PLTrendRow and PLLineItem Are the Core Shapes for Plan 2 Components
4782 11:43a 🔵 P&L Core Query Pattern — queryPLRaw + aggregatePL + AccType Codes Confirmed
4783 " 🔵 Round 2 Changes Still Unstaged — Big Commit NOT Yet Made
4784 " 🔵 Playwright Confirms Panel Footer: Feedback + Analyze Only (No Budget Setting)
4785 " 🔵 No Forecast or Scenario Tables in Schema — Forecast is Purely Computed, No Persistence
4786 " ✅ Root-Level Planning Docs Moved to archive/ Directory
4788 " 🔵 PB&F Industry Research — Adaptive Planning and Anaplan Dashboard Patterns for Plan 2 Grounding
4790 " 🔵 FP&A Dashboard UX Research — Dumbbell Charts, Color-Coded Variance Pills, Side-by-Side Budget vs Actual Are Industry Standards
4787 " 🔵 AiInsightPanel.tsx Already Committed — No Unstaged Changes
4789 11:44a 🔵 Production Build Passes Clean with All Round 2 Working-Tree Changes
4791 " ✅ Round 2 + Round 1 Files Staged for Big Commit — 12 Items Indexed
4792 " 🔵 No Cost-Centre or Department Dimension in P&L Schema — Segmentation Limited to Sales Outlet/Agent/Type
4793 " ✅ Staged Diff Verified — 12 Files, 896 Insertions, 261 Deletions Confirmed
4794 " 🔵 FP&A Dashboard Design Best Practices — Inverted Pyramid Model and F-Pattern Scanning Validate Plan 2 Card Order
4795 " 🟣 Commit 0c78969 Made — Round 1 + Round 2 Variance Panel Rework Complete
4796 11:45a 🔵 expense-categories.ts — 13 Expense Categories Mapped to GL AccNos; Used by Both Financial and Expenses Pages
4798 " 🔵 PLTrendRow Generation Pattern — MAX(period_no) Anchor + queryPLRaw + aggregatePL Loop Confirmed in queries.ts
4799 " 🔵 Pre-flight Confirmed: HEAD at 0c78969, Dev Server Live on Port 3000
4800 11:46a 🔵 Rolling Forecast Research — M-3 Is Natural Confidence Boundary; Scenario Planning Not Required for Plan 2 MVP
4801 " 🔵 AI Commentary Placement Research — Industry Tools Use Collapsible Contextual AI Companion Per Data Section
4803 " 🔵 Executive Dashboard Anti-Patterns — "Mixing Audiences," Too Many Metrics, and Data Without Context Are Top Failure Modes
4805 " 🔵 Session Handoff: Forecasting & Variance Analysis Panel Round 2 Rework Verification
4804 " 🔵 Variance Analysis Industry Standard — Four Comparison Dimensions; Plan 2 Implements Two (Budget vs Actual + YoY)
4806 11:47a 🔵 Pre-flight Confirmed: Commit 0c78969 at HEAD, Dev Server Live
4807 " 🔵 Financial Page Panel Order Confirmed: Forecasting & Variance Analysis is Index 1
4808 " 🔵 Financial Page DOM Confirms Round 2 UI Changes Live
4809 11:48a 🔵 Forecasting Panel Has No Separate "Analyze" Button — Get Insight Directly Triggers Analysis
4810 " 🔵 Forecasting Panel Get Insight Shows Chevron-Up — Panel Content Is Sibling, Not Child
4811 " 🔵 Analyze Button Confirmed Present After Get Insight Expand
4812 11:49a 🔵 Cached Pre-Rework Insight Displayed — Analyze Button Not Yet Clicked for Fresh Run
4813 11:50a 🔵 Fresh Analyze Run Completed — Token Count Increased to 30,774 (AC6 FAIL)
4814 " 🔵 Post-Rework Insight Content: YoY Language Persists, One Forecast Card Confirmed (AC1 Fail, AC3 Pass)
4834 11:55a 🔵 Dev server restarted with nohup/disown — PID 20108 — to resolve /api/budget HTTP 000 issue
4841 11:56a 🔵 Playwright MCP Chrome process (PID 8979) survives kill — same PIDs persist across multiple kill attempts
4843 11:57a 🔵 nohup dev server (PID 20108) confirmed healthy — all routes serving correctly from /tmp/dashboard-dev.log
4846 " 🔵 Section §12 renders with unexpected title "Forecasting & Variance Analysis" instead of "Variance, Forecast & Budget"
4850 11:58a 🔵 Budget Setting button confirmed in §12 header bar — but section title is "Forecasting & Variance Analysis", not Session 2 value
4852 11:59a 🟣 BudgetSettingDialog opens and renders "Approved Baseline" — end-to-end flow verified via Playwright
4854 " 🟣 BudgetSettingDialog fully verified — correct 4 rows, no GP/NP, no FY selector, note field and Save button present
4857 " 🟣 BudgetSettingDialog save flow verified end-to-end — edit input, click Save, toast "Budget baseline saved." appears
4859 " 🔵 Dialog save reverted Net Sales to original value — native setter + input event didn't update React form state
S728 Session 2 — Frontend variance panel rework: page reorder, BudgetBaselinePanel removal, BudgetSettingDialog creation, Budget Setting button; Playwright --headed verification and cleanup (May 15 at 12:02 PM)
**Investigated**: - DashboardShellV3.tsx section ordering (§12 positioning relative to §9 and KPI cards)
    - InsightSectionHeader.tsx BudgetBaselinePanel wiring (showBudgetPanel condition)
    - BudgetBaselinePanel.tsx issues (6 breaking items: stale FY-scoped routes, wrong line items, missing source field)
    - AiInsightPanel.tsx footer structure for Budget Setting button placement
    - Available shadcn primitives (dialog, input, textarea)
    - React controlled input mutation behavior in Playwright (native setter + input event vs change event)
    - Dev server stability patterns (background task vs nohup detachment)
    - Empty-budget edge case (dialog behavior when budget_global table is empty)

**Learned**: - React controlled inputs do NOT update state when mutated via HTMLInputElement.prototype.value setter + `input` event dispatch; only `change` event or `browser_type` works
    - nohup pattern (`nohup pnpm dev > /tmp/dashboard-dev.log 2>&1 & disown`) is required for stable dev server; background tasks prone to HTTP 000 on /api/budget route specifically
    - The dialog correctly shows empty rows (no crash, no audit footer) when budget_global is empty — empty-budget path is clean
    - Admin save round-trip confirmed working: value mutated in DB, persists on dialog reopen
    - `pnpm tsc --noEmit` exits 0 with all new components
    - Budget Setting button gating (`sectionKey === 'financial_variance'`) is correctly isolated to the Forecasting & Variance Analysis section only

**Completed**: - **DashboardShellV3.tsx**: §12 ("Forecasting & Variance Analysis") repositioned to appear directly after §9 Financial Overview header, before PLKpiCardsV3 (y=403, KPI cards at y=747)
    - **InsightSectionHeader.tsx**: BudgetBaselinePanel import, showBudgetPanel computed value, and conditional render block removed; file reduced from 92 to 77 lines
    - **BudgetBaselinePanel.tsx**: DELETED (had 6 breaking issues with FY-scoped routes and wrong line items)
    - **BudgetSettingDialog.tsx**: CREATED (~220 lines) — fetches GET /api/budget on open, saves via PUT /api/budget with x-user-role header, 4-item allowlist (Net Sales, Cost of Sales, Operating Costs, Other Income), note textarea, audit metadata footer, admin-only Save button, amber warning for non-admin
    - **AiInsightPanel.tsx**: WalletCards + BudgetSettingDialog imports added; budgetSettingOpen state added; Budget Setting button in footer gated by `showBudgetSetting = sectionKey === 'financial_variance'`; BudgetSettingDialog modal wired
    - **Playwright verification**: section order ✓, button gating ✓, dialog structure ✓ (4 rows, no FY, note+Save), admin save round-trip ✓ (DB confirmed 7000001), empty-budget path ✓
    - **DB restored**: original seed values restored (Net Sales 6,793,349 / Cost of Sales 6,324,046 / Operating Costs 754,243 / Other Income 0)
    - **Browser closed** (user requirement)
    - **Dev server stopped** (PID 20108)
    - **TSC**: exit 0

**Next Steps**: Session 2 is fully complete. Per variance-panel-rework-tracker.md, the next sessions cover:
    - Session 3: Prompt re-seed (push updated prompts-defaults.ts content into ai_insight_prompts DB table)
    - Session 4+: Remaining PRD tasks per docs/plans/variance-panel-rework-tracker.md
    - PRD 11 (docs/prd/11-ai-insight-finance.md) needs an update to reflect the final design (Budget Setting button in header bar rather than panel action row)


Access 102k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
