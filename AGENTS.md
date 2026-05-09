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
- Stack: Next.js 16.1.7, React 19, TypeScript strict, Tailwind 4, shadcn/Base UI primitives, Recharts, PostgreSQL via `pg`, Anthropic SDK `@anthropic-ai/sdk`.
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

# [Hoi-Yong_Finance] recent context, 2026-05-08 9:03am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (14,880t read) | 108,004t work | 86% savings

### May 8, 2026
S367 Sales page validation Steps 0–3 complete — awaiting user approval + hallucination scoring clarification (May 8 at 7:38 AM)
S368 Validation Study Page 1 (sales_trend) — executing all 4 measurement runs (2 baseline + 2 after) per HOW_TO_RUN_PAGE.md procedure (May 8 at 7:38 AM)
S369 Validation Study Page 1 (sales_trend) — all 4 measurement runs executing; AFTER run #2 (cache proof run) in progress (May 8 at 7:44 AM)
S370 Validation Study Page 1 (sales_trend) — AFTER run #2 (cache proof run) still in progress; multiple Analyze clicks observed (May 8 at 7:44 AM)
S371 Validation Study continuation — Page 1 (sales_trend) AFTER run #2 pending API credit replenishment (May 8 at 7:47 AM)
S372 Restart the Next.js dashboard dev server for Hoi-Yong_Finance (May 8 at 7:48 AM)
S373 BMad Analyst Agent (Mary) initialized for Hoi-Yong Finance project — awaiting user task selection (May 8 at 7:56 AM)
S375 AI Insight Config — DB-backed prompt system: Session 1 backend rewire complete, handoff created for Session 2 (API routes + UI) (May 8 at 7:57 AM)
2234 8:18a ⚖️ AI Insight Config Implementation Split Into 2 Sessions
2235 " ⚖️ AI Insight Config Plan Finalized and Submitted for Approval
2236 8:19a 🟣 AI Insight Config Implementation Begun — Plan Approved
2237 " 🔵 Confirmed Exact Line Boundaries for Phase A Extraction in prompts.ts
2238 " 🔵 Actual Component Count is 66, Not ~42 as Estimated in Plan
2239 " 🔵 tsx Not in Dashboard devDependencies — Seed Script Runner Needs Alternative
2240 8:20a 🔵 tsx and ts-node Absent From Entire Monorepo — Seed Script Must Use npx tsx
2241 " ⚖️ Seed Script Replaced With Next.js API Endpoint to Avoid tsx Dependency
2242 " 🟣 prompts-defaults.ts Created — Phase A Extraction Complete
2243 8:21a 🔵 prompts-defaults.ts Verified: 66 Component Prompts, 3 Exports at Correct Line Numbers
2244 " 🔄 prompts.ts Slimmed From 1,856 to 228 Lines — Phase A Bridge Import in Place
2245 " 🟣 Phase A TypeScript Check Passes — prompts.ts Bridge Import Compiles Clean
2246 " 🟣 Migration 016_ai_insight_prompts.sql Created — Phase B DB Schema
2247 " 🟣 prompt-loader.ts Created — Phase B DB Loader With 30s In-Memory Cache
2248 8:22a 🟣 prompt-store.ts Created — Phase B Write Helpers With Delimiter Validation
2249 8:23a 🔵 Admin API Directory Structure Confirmed — ai-insight-prompts Folder Created
2250 8:24a 🟣 seed-defaults/route.ts Created — Idempotent Seed Endpoint for ai_insight_prompts
2251 " 🟣 Phase B TypeScript Check Passes — DB Layer Compiles Clean
2252 " 🔵 Phase C Targets Confirmed in Current prompts.ts — 3 Functions to Make Async
S374 bmad-agent-dev session startup for Hoi-Yong Finance project (May 8 at 8:25 AM)
2253 8:29a 🔵 Hoi-Yong Finance BMAD Configuration Loaded
2254 8:30a 🔵 No project-context.md Found in Hoi-Yong Finance
2255 " ⚖️ AI Insight Config Page Plan Loaded — Prompts Move from Code to DB
2256 " 🔵 Phase B Backend Files Already Exist in Hoi-Yong Finance
S376 AI Insight Config feature — Session 1 backend committed to git, ready to start Session 2 (admin API routes + UI) (May 8 at 8:31 AM)
2257 8:31a 🔵 prompt-store.ts Fully Implemented with Validation and Transaction Safety
2258 " 🔵 prompt-loader.ts Uses Inflight Deduplication Pattern on Top of 30s TTL Cache
2259 " 🔵 Seed-Defaults API Route Complete with Idempotent INSERT and Telemetry Response
2260 " 🟣 GET /api/admin/ai-insight-prompts Route Created
2261 8:32a 🟣 GET + PUT /api/admin/ai-insight-prompts/[prompt_key] Route Created
2262 " 🟣 POST /api/admin/ai-insight-prompts/[prompt_key]/reset Route Created
2263 " 🟣 POST /api/admin/ai-insight-prompts/reset-all Route Created — Phase D Complete
2264 " 🔵 TypeScript Type Check Passes Clean After Phase D API Routes
2265 8:33a 🔵 AppSidebar adminItems Has Only Data Sync; All Required UI Primitives Confirmed Present
2266 " 🔵 Admin Guard Pattern Confirmed: useRole() Returns isAdmin from localStorage-Backed RoleContext
2267 " 🔵 Textarea Uses field-sizing-content Auto-Resize — Prompt Editor Will Need Explicit Height Override
2268 " 🔵 SyncScheduleForm Confirms Admin Guard Pattern: Disable Inputs + Conditional Sections via isAdmin
2269 8:35a 🔵 SWR v2.4.1 Present but Existing Admin Components Only Use mutate(), Not useSWR Hook
2270 " 🔵 Dialog Component Built on @base-ui/react — Uses data-open/data-closed, Not Radix data-state
2271 " ✅ Sparkles Icon Imported in AppSidebar — Nav Link Addition in Progress
2272 8:36a 🟣 AppSidebar Now Shows AI Insight Config Nav Link in Admin Section
2273 " 🟣 AI Insight Config Page Shell Created at /admin/ai-insight-config
2274 8:37a 🟣 PromptConfigDashboard Client Component Created with useSWR Data Fetching
2275 " 🔴 PromptConfigDashboard Auto-Select Fixed: useEffect Imported to Replace useMemo Side Effect
2276 " 🔴 PromptConfigDashboard Auto-Select Converted from useMemo to useEffect
2279 " 🟣 Phase E Complete — All UI Components Pass TypeScript with Zero Errors
2280 " 🔵 Next.js Dev Server Not Running — Verification Cannot Proceed Without Starting It
2277 8:38a 🟣 PromptTree Component Created with Three-Level Collapsible Navigation
2278 " 🟣 PromptEditor Component Created — Full CRUD Editor with Show Default, Warnings, and Reset All Dialog
2282 8:39a ✅ Next.js Dev Server Ready on localhost:3000 — Phase F Verification Can Begin
2283 " 🔵 GET /api/admin/ai-insight-prompts Returns 68 Prompts — DB Already Seeded, All at Default
2281 8:40a ✅ Next.js Dev Server Started in Background for Phase F Verification

Access 108k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
