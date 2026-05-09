# HR AI-Insight System -- Comprehensive Raw Documentation

> Generated from Hoi-Yong_HR source files on 2026-04-20.
> Covers: Epic 4 PRD, Stories 4.1--4.6, Story 1.16 (OpenAI), Story 1.11a (Settings), QA gate, running code.

---

## 1. Implementation Status Summary

Epic 4 was **deferred 2026-04-15** per team lead decision ("Freeze AI Insights -- HR AND Finance"). All code was subsequently **removed** from the main branch (commit `7f154a2` -- "AI Insights + OpenAI removed"). The specs, stories, and design docs remain preserved.

| Component | Status | Notes |
|-----------|--------|-------|
| **Story 4.1 -- Workforce AI Insight + Shared Infra** | [DESIGNED -- DEFERRED] | All 3 phases code-complete (86 tests), then removed. Story status: `done` |
| **Story 4.2 -- Attendance AI Insight** | [DESIGNED -- DEFERRED] | All 3 phases code-complete (120 tests across 3 review rounds), then removed. Story status: `done` |
| **Story 4.3 -- Leave AI Insight** | [DESIGNED -- DEFERRED] | All 3 phases code-complete (47 tests after review), then removed. Story status: `complete` |
| **Story 4.4 -- Performance AI Insight** | [DESIGNED -- DEFERRED] | All 3 phases code-complete (121 tests after 3 review rounds), then removed. Story status: `complete` |
| **Story 4.5 -- Disciplinary AI Insight** | [DESIGNED -- DEFERRED] | All 3 phases code-complete (272 tests total, 3 review rounds), then removed. Story status: `done` |
| **Story 4.6 -- Probation AI Insight** | [DESIGNED -- DEFERRED] | All 3 phases code-complete (89 backend + 48 frontend tests, 2 review rounds), then removed. Story status: `done` |
| **Story 1.16 -- OpenAI API Service** | [IMPLEMENTED -- THEN REMOVED] | Salary benchmarking via OpenAI. 38 tests. Live API verified. Story status: `Done`. Code removed with Epic 4. |
| **Story 1.11a -- Insights Settings UI** | [IMPLEMENTED] | 10 settings categories, 24 threshold fields, Settings page shell. 802 backend + 282 frontend tests. Still in codebase. |
| **Pattern Detection Service** | [IMPLEMENTED] | Chronic lateness detection + holiday-adjacent leave flagging. Still in codebase at `code/backend/src/modules/hr/services/pattern-detection.service.ts`. |
| **Settings Model (CRUD)** | [IMPLEMENTED] | `hr-settings.model.ts` -- getAll, getByCategory, updateCategory, resetCategory. Still in codebase. |
| **Settings Sidebar** | [IMPLEMENTED] | 11 insight items + 3 data management items. Still in codebase. |
| **E2E Parity Tests** | [DESIGNED -- DEFERRED] | `ai-insight-parity.spec.ts` -- Playwright tests for schema contract. Code exists but AI Insight endpoints are removed. |
| **QA Gate** | [SPEC ONLY] | `epic4-ai-insights-gate-20260120.yml` -- 156 scenarios. Based on pre-pivot architecture (local algorithms + OpenAI hybrid). Does NOT reflect the Claude SDK pivot. |

### SDK Decision Change Timeline

1. **Initial design (pre-2026-01)**: Hybrid local algorithms (`simple-statistics`, `ml.js`) + OpenAI (`gpt-4o`, `gpt-4o-mini`) for NLG insights. The QA gate reflects this architecture.
2. **SCP-119 pivot**: Technology change to Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), model `claude-sonnet-4-6`, MCP tool pattern.
3. **2026-04-15 architecture decision**: Agent SDK declared overkill. Platform standardizes on **client SDK** (`@anthropic-ai/sdk`) with single `messages.create()` call. Stories still reference Agent SDK patterns but header note marks runtime sections as **obsolete as architecture**.
4. **2026-04-15 deferral**: Entire Epic 4 frozen. Code removed from main branch. Specs preserved.

---

## 2. Architecture

### SDK Choice

The system went through three SDK decisions:

1. **OpenAI SDK** (`openai` npm package) -- Used in Story 1.16 for salary benchmarking (separate feature, not Epic 4).
2. **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) -- Stories 4.1--4.6 were actually implemented against this SDK. Uses `query()` with MCP tools, `createSdkMcpServer`, `maxTurns`, `maxBudgetUsd`.
3. **Claude Client SDK** (`@anthropic-ai/sdk`) -- 2026-04-16 decision: "Agent SDK is overkill." Future re-implementation should use single `messages.create()` call. Data assembly and PII stripping happen server-side BEFORE prompt construction. No MCP tools expose raw data to the model.

**When Epic 4 un-defers**, Story 4.1 must be rewritten against the client SDK pattern first. The insight content (what each page analyzes, PII rules, RBAC scoping, finding types) remains valid; only the runtime shape changes.

### Model Selection

`claude-sonnet-4-6` -- Used across all 6 domains.

### Single Call Approach (Target Architecture)

Per 2026-04-16 reconciliation:
- Single `messages.create(...)` call per insight generation (no multi-turn loops)
- Server-side data assembly with PII stripping BEFORE the prompt is built (no MCP tools exposing raw data)
- Server-side RBAC scoping on the data pre-fetch (not tool-injected)
- Concurrency: simple per-user limit with 409 response, not a queue with position
- Cost cap: `maxBudgetUsd = 0.30` applies (tracked server-side)

### Implemented Architecture (Agent SDK, now deferred)

The code that was written and tested used the Agent SDK pattern:

```typescript
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'

const q = query({
  prompt: createPrompt(userMessage),
  options: {
    model: 'claude-sonnet-4-6',
    systemPrompt: buildSystemPrompt(briefing),
    mcpServers: { 'hr-workforce-tools': createWorkforceTools(pool, scopeFilter) },
    allowedTools: ['mcp__hr-workforce-tools__*'],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxTurns: 8,
    maxBudgetUsd: 0.30,
    settingSources: [],
    abortController: ac,
  },
})

for await (const message of q) {
  if (message.type === 'result') {
    // message.result = final text
    // message.total_cost_usd, message.num_turns, message.duration_ms
  }
}
```

**CR-12 resolution:** Plain string prompt works (initial async generator pattern was unnecessary for SDK MCP). The final implementation passed prompt as a plain string.

### Briefing System Design

Each domain has a briefing generator that:
1. Fetches raw KPIs from the database (6--11 parallel queries depending on domain)
2. For workforce: provides raw numbers only (no threshold flagging -- agent reasons via 15-pattern checklist)
3. For attendance/leave/performance/disciplinary/probation: applies flag conditions (8/7/8/9/7 flags respectively) against configurable thresholds from `hr_settings`
4. Outputs ~400--600 tokens of structured markdown injected into the system prompt at runtime

Briefing sections:
```
Current date: {YYYY-MM-DD}

**What Management Sees Right Now ({Page} Dashboard):**
- KPI 1: value
- KPI 2: value
...

[Warning flags if applicable]

**What's on screen:** [Description of visible dashboard elements]
```

### File/Module Structure (Production)

```
code/backend/src/modules/hr/ai-insight/
  shared/
    types.ts                   -- InsightResult, Finding, SSEEvent, ScopeFilter, InsightMetadata
    pii-filter.ts              -- stripPii(), stripPiiFromRows() -- 29 sensitive fields
    scope-filter.ts            -- buildScopeWhere(scopeFilter, alias) -> SQL AND clause; QueryParams class
    truncate.ts                -- truncateResponse(data, cap=16000)
    percentage.ts              -- addPercentages() for distributions
    cross-module.tools.ts      -- get_cross_module_flags (sync status + at-risk counts)
    constants.ts               -- STAGE_DISPLAY_LABELS (extracted from disciplinary for probation reuse)
    __tests__/
      pii-filter.test.ts
      truncate.test.ts
      scope-filter.test.ts
  workforce/
    workforce.tools.ts         -- 4 MCP tools
    workforce.briefing.ts      -- fetchBriefingKPIs() + formatBriefing() + generateBriefing()
    workforce.prompt.md        -- static prompt: persona, patterns, rules, output format
    workforce.prompt.ts        -- buildSystemPrompt() loads .md + injects briefing
    __tests__/
      briefing.test.ts
      tools.test.ts
  attendance/
    attendance.tools.ts        -- 7 tool handlers
    attendance.briefing.ts     -- KPI fetch + format with 8 flags
    attendance.prompt.md       -- static prompt template
    attendance.prompt.ts       -- buildSystemPrompt + CORE/EXPLORE patterns
    __tests__/
      briefing.test.ts
      tools.test.ts
      tools-handlers.test.ts
  leave/
    leave.tools.ts             -- 7 tool handlers
    leave.briefing.ts          -- KPI fetch + format with 7 flags
    leave.prompt.md            -- static prompt template
    leave.prompt.ts            -- CORE/EXPLORE patterns + buildSystemPrompt
    __tests__/
      briefing.test.ts
      tools-handlers.test.ts
  performance/
    performance.tools.ts       -- 6 tool handlers
    performance.briefing.ts    -- KPI fetch + format with 8 flags
    performance.prompt.md      -- static prompt template
    performance.prompt.ts      -- CORE_PATTERNS + buildSystemPrompt
    __tests__/
      briefing.test.ts
      tools-handlers.test.ts
  disciplinary/
    disciplinary.tools.ts      -- 6 tool handlers (~2100 lines)
    disciplinary.briefing.ts   -- KPI fetch + 9 flags + formatter
    disciplinary.prompt.md     -- static prompt template
    disciplinary.prompt.ts     -- buildSystemPrompt + CORE/EXPLORE patterns
    __tests__/
      briefing.test.ts
      tools-handlers.test.ts
  probation/
    probation.tools.ts         -- 4 tool handlers + factory
    probation.briefing.ts      -- KPI fetch + 7 flags + formatter
    probation.prompt.md        -- static prompt template
    probation.prompt.ts        -- buildSystemPrompt + 10 CORE patterns
    __tests__/
      briefing.test.ts
      tools-handlers.test.ts
  service.ts                   -- shared generateInsight() + ModuleConfig + parseAgentOutput
  controller.ts                -- shared SSE endpoint handler + createModuleHandlers factory
  routes.ts                    -- route registration for all 6 modules
  cache.ts                     -- per-user-per-module 24h Map<key, {result, expiresAt}>
  insight-logger.ts            -- structured JSON generation logging
  __tests__/
    service.test.ts
    controller.test.ts

code/frontend/src/components/hr/ai-insight/
  types.ts                     -- shared frontend types (single source of truth, CR-21)
  AIInsightPanel.tsx            -- container: generate/cancel button, grouped sections, metadata footer
  AIInsightCard.tsx             -- clickable card: colored bg, severity icon, type chip, summary
  AIInsightModal.tsx            -- detail modal with 3 accordion sections
  AIInsightLoading.tsx          -- live SSE progress step list with checkmarks
  index.ts                     -- barrel export
  __tests__/
    AIInsightComponents.test.tsx

code/frontend/src/hooks/
  useAIInsightGenerate.ts       -- SSE client hook (fetch + ReadableStream, NOT EventSource)
```

### ModuleConfig Interface

Introduced in Story 4.2 to support multi-module architecture:

```typescript
export interface ModuleConfig {
  name: string
  userMessage: string
  createMcpServer: (scopeFilter: ScopeFilter | null) => ReturnType<typeof createSdkMcpServer>
  generateBriefing: (scopeFilter: ScopeFilter | null) => Promise<string>
  buildSystemPrompt: (briefing: string) => Promise<string>
}
```

Six configs exported: `workforceConfig`, `attendanceConfig`, `leaveConfig`, `performanceConfig`, `disciplinaryConfig`, `probationConfig`.

### Database Access Pattern

Uses Prisma `$queryRawUnsafe` with `QueryParams` class for SQL parameterization. All queries use `$N` positional placeholders (CR-4 fix from Story 4.1). Direct `pg.Pool` is available as a fallback but was not needed. `COUNT(*)` must be cast `::int` to avoid BigInt issues.

---

## 3. Per-Domain Tool Definitions

### 3.1 Workforce (Story 4.1) -- 4 page-specific tools + 1 shared

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_workforce_snapshot` | Current headcount, department breakdown, tenure stats, turnover rate | 11 parallel queries; distributions with counts + percentages; composition grid |
| `get_department_breakdown` | Per-department headcount, demographics, manager coverage | 5 dimension breakdowns pivoted by department |
| `get_workforce_movement` | 12-month joiners/leavers/headcount (max 24 months) | Monthly joiners, leavers, net headcount change |
| `get_employee_details` | PII-stripped employee-level data for flagged cohorts | Filtered rows, hard limit 25 rows |
| `get_cross_module_flags` | [SHARED] Aggregates flags from Attendance, Leave, Disciplinary | Last upload date, data freshness, at-risk employee count, pending warnings count |

**Briefing**: 6 raw KPIs (headcount, dept count, turnover rate, avg tenure, largest dept, 30d joiners/leavers). **No threshold flagging** -- agent reasons via 15-pattern checklist.

**Pattern Checklist (15 items: 10 CORE + 5 EXPLORE)**:
- CORE: NEG-R10 Department Dominance (>40% headcount), NEG-P2 Turnover Concentration, NEG-P4 Workforce Shrinkage (3+ months net negative), POS-M4 Long Service Milestones, POS-T1 Hiring vs Attrition, NEG-R5 Flight Risk Composite (cross-module, DATA-DEP), NEG-I5 New Joiner Early Warning (DATA-DEP), NEG-A4 Salary Below Market (DATA-DEP), NEG-R9 Salary Compression Risk (DATA-DEP), POS-O2 Top Performer Below Market (DATA-DEP)
- EXPLORE: Contract/probation expiry 30d, Demographic imbalances, Tenure risk, Age concentration risk, Single points of failure

**Mandatory tool sequence**: `get_cross_module_flags` -> `get_workforce_snapshot` -> `get_department_breakdown` -> `get_workforce_movement` -> (opt) `get_employee_details`

### 3.2 Attendance (Story 4.2) -- 7 page-specific tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_attendance_snapshot` | Daily KPIs, monthly summary, OT breakdown, thresholds | `data_coverage`, `thresholds` (10 settings), `daily_kpis`, `monthly_summary`, `ot_breakdown`, `department_rates`, `employee_group_split` |
| `get_attendance_trends` | 12-month monthly data with MoM changes | `monthly_data` (attendance_rate, late, early, absent, OT by type), `summary`, `attendance_deteriorating_3mo`, `ot_returning_to_normal` |
| `get_attendance_flags` | Flagged employee counts by type | `lateness`, `early_departure`, `absence`, `break_compliance`, `daily_hours_exceeded`, `ot_anomaly`, `thresholds_used` |
| `get_attendance_department_comparison` | Department-level comparisons | Per-dept: headcount, rates, perm vs contract split, `ot_concentration_flagged`, `perfect_attendance_departments`, `absence_rate_vs_median` |
| `get_attendance_employee_details` | Per-employee attendance data | PII-stripped, 25-row limit, date-range-based, 6 boolean filter params, sort support |
| `get_attendance_break_compliance` | Dedicated break compliance deep-dive | `settings`, `period_summary` (by violation type: missing/too_late/too_short), `by_department`, `monthly_trend`, `daily_hours_exceeded` |
| `get_attendance_ot_analysis` | OT anomaly analysis | `period_summary` (paid vs extra, by type), `department_concentration`, `concentration_flags`, `anomaly_detection` (excessive + suspiciously_low), `monthly_ot_trend`, `ot_returning_to_normal` |

**Settings dependencies (10 values)**:
- `chronic_lateness_days` (int, default 3)
- `high_absence_days` (int, default 3)
- `early_departure_days` (int, default 3)
- `abnormal_ot_hour_threshold` (decimal, default 4.5)
- `abnormal_ot_day_threshold` (int, default 36)
- `ot_wage_threshold` (int, default 4000)
- `daily_work_hour_limit` (int, default 12)
- `dinner_break_window` (string, default "17:00-19:00")
- `dinner_break_min_duration_min` (int, default 30)
- `ot_dinner_break_cutoff` (string, default "21:00")

**Briefing flags (8)**: attendance rate <85%, late >10%, OT MoM >20%, dept absence >2x median, break violation >10%, 3-month decline, excellent >=95%, rest/holiday OT >40%.

**Pattern Checklist (16 items: 14 CORE + 2 EXPLORE)**:
- CORE: NEG-A1 OT Hours Anomaly, NEG-A2 Suspiciously Low OT, NEG-A3 Department Rate Drop, NEG-R1 Chronic Lateness, NEG-R2 High Absence, NEG-AL1 Daily Hours Exceeded, NEG-AL2/AL3 Break Compliance Violations, NEG-AL4 Early Departure Repeated, NEG-P1 Attendance Deterioration, NEG-C1 Department Absence Disparity, NEG-C4 Permanent vs Contract Disparity, NEG-C5 OT Concentration, POS-AL1 Perfect Attendance Month, POS-T5 OT Returning to Normal
- EXPLORE: Seasonal Holiday Awareness, OT Type Composition

**Mandatory tool sequence**: Steps 1-6 required (get_cross_module_flags -> snapshot -> trends -> flags -> department_comparison -> break_compliance), Steps 7-8 optional (ot_analysis, employee_details).

### 3.3 Leave (Story 4.3) -- 7 page-specific tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_leave_snapshot` | KPIs, distributions, utilization, balance health | `thresholds`, `kpis` (8 metrics), `self_service_pct`/`manual_entry_pct`, `type_distribution`, `status_distribution`, `department_utilization`, `balance_health` |
| `get_leave_balance_analysis` | Per-dept and per-type balance health | `by_department`, `by_leave_type` (avg, sigma, thresholds, outliers -- AL subtypes combined), `expiring_soon`, `exhausted_employees`, `hourly_leave_summary` |
| `get_leave_utilization_analysis` | Statistical outliers, correlations | `outlier_summary`, `per_leave_type`, `ot_correlation` (cross-module), `burnout_correlation` (cross-module), `mc_clustering` |
| `get_leave_patterns` | Adjacent holidays, coverage risk, lead time | `adjacent_holiday` (flagged employees), `monthly_trends`, `coverage_risk` (14 days), `lead_time_analysis` (5 buckets), `day_of_week_distribution` |
| `get_leave_upcoming` | Forward-looking coverage, pending urgency | `upcoming_by_department` (per dept+date), `pending_applications` (overdue 7d/14d, imminent 3d/7d) |
| `get_leave_employee_details` | Per-employee leave data | PII-stripped, 25-row limit, 10 filter params, per-type balances with outlier classification, adjacent_holiday_count, burnout_flag |
| `get_leave_application_health` | Workflow health metrics | `rejection_analysis` (by dept, flag >2x avg), `portal_adoption` (source='EL'), `approval_turnaround` (avg/median, flag >3 days) |

**Settings dependencies (2 values)**: `leave_abuse_threshold` (int, default 3), `adjacent_holiday_days` (int, default 2).

**AL Subtype Combination Rule**: All `leave_type.startsWith('AL')` rows combined into "Annual Leave (Combined)" per `LeaveUtilizationService` pattern.

**Briefing flags (7)**: pending >10, pending overdue >7d >3, imminent pending 3d, dept >30% on leave 14d, expiring credits >5, utilization <30%, dept rejection >2x.

**Pattern Checklist (14 items: 13 CORE + 1 EXPLORE)**:
- CORE: NEG-A5 Credits Expiring, NEG-R4 Team Coverage Risk, NEG-R6 Leave Pattern Abuse, NEG-R11 MC Frequency Clustering, NEG-R12 Chronically Short Lead Time, NEG-I6 Low Utilization + Elevated OT, NEG-AL6 Balance Exhausted, NEG-W3 Applications Unanswered, NEG-W6 Disproportionate Rejection, NEG-P3 High Leave Post-Burnout, POS-T3 Healthy Utilization, POS-O4 Unused Leave Nudge, POS-O5 High Portal Adoption, NEG-P5 Leave Demand Forecast (PHASE-2 deferred)
- EXPLORE: Expired Credits Forfeiture

**Mandatory tool sequence**: Steps 1-6 required, Steps 7-8 optional (application_health, employee_details).

### 3.4 Performance (Story 4.4) -- 6 page-specific tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_performance_snapshot` | KPIs, distributions, validation pipeline, velocity | `settings` (7 thresholds), `kpis` (11 fields), `score_distribution` (10 buckets), `status_breakdown`, `validation_status` (aging buckets), `acknowledgement_status`, `completion_velocity`, `year_range` |
| `get_performance_department_comparison` | Department avg, spread, YoY, rater density | `departments` (per-dept stats + deviation + high/low), `prior_year_avg_score`/`yoy_change_pp`, `appraiser_count`, `employee_group_split`, `dept_score_gap_flagged` |
| `get_performance_trends` | YoY progression, improvement, movers | `yearly_data`, `improvement_tracking` (4 buckets), `first_time_vs_returning` (gap), `top_movers` (top 5 improved/declined, PII-stripped) |
| `get_performance_burnout_signals` | Burnout, driver breakdown, correlations | `burnout_flags` (by dept), `burnout_driver_breakdown`, `monthly_burnout_trend`, `performance_attendance_correlation` (score buckets), `low_score_high_absence`, `compounding_signals` |
| `get_performance_employee_details` | Per-employee appraisal data | PII-stripped, 25-row limit, 10 filter params, consecutive top/low years tracking, at-risk composite score |
| `get_performance_criteria_analysis` | Per-criterion ratings, template ecosystem | `form_templates`, `criteria_performance` (20-slot rating distribution), `weakest_criteria` (top 5), `strongest_criteria` (top 5), `dept_criteria_weakness` (top 10 by gap) |

**Settings dependencies (7 values)**: `top_performer_threshold` (0.85), `low_performer_threshold` (0.6), `poor_appraisal_threshold` (0.625), `atrisk_weight_warning` (0.5), `atrisk_weight_appraisal` (0.3), `atrisk_weight_combined` (0.2), `atrisk_threshold` (0.3).

**Rating System**: RATING_MULTIPLIERS = [0.00, 0.35, 0.70, 1.00] mapping rating values 0-3 (Poor/Fair/Good/Excellent). `final_score = SUM(rating_multiplier_i x weight_i) / SUM(weight_i) x 100`.

**Briefing flags (8)**: completion <70%, pending >14d, validation bottleneck, low performers >10%, structural overload >0, at-risk >0, dept avg >20pp below company, criterion >40% poor.

**Pattern Checklist (15 items, all CORE, 0 EXPLORE)**: NEG-I1 Structural Overload, NEG-I4 Absence + Low Score, NEG-I8 First-Time Score Gap, NEG-I9 Template Difficulty Disparity, NEG-C3 Dept Score Gap, NEG-C6 Criteria Weakness, NEG-C7 Permanent vs Contract Gap, NEG-W1/W5/W7 Validation Pipeline Slowdown, POS-M1/M6 Top Performer & Succession, POS-M2 Score Improved YoY, POS-M7 Org-Wide Competency Strengths, POS-T2 Cycle Adherence, POS-T6 Completion Velocity Improving, POS-O1 Promotion Candidate, POS-AL3 New Cycle Underway.

**Mandatory tool sequence**: Steps 1-6 required, Step 7 optional (employee_details).

### 3.5 Disciplinary (Story 4.5) -- 6 page-specific tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_disciplinary_snapshot` | KPIs, distributions, coaching lifecycle | 10 top-level sections: `kpis`, `by_stage` (6 stages), `by_offense_category`, `by_department`, `by_status`, `coaching_lifecycle`, `rejection_overview`, `issuer_distribution`, `filing_lag`, `settings` |
| `get_disciplinary_trends` | Monthly volumes, escalation velocity, seasonal | `monthly_data`, `analysis`, `escalation_velocity` (avg days between stages, rapid escalation), `volume_trend`, `pending_approval_age`, `seasonal_patterns`, `coaching_resolution_trend`, `rejection_trend` |
| `get_disciplinary_repeat_offenders` | Repeat offense, at-risk scoring, cross-module | `at_risk_scoring`, `repeat_offense`, `escalation_pattern`, `unresolved_coaching`, `at_risk_summary`, `category_switching`, `post_coaching_recurrence`, `attendance_correlation` (cross-module), `post_warning_mc` (cross-module MC spike) |
| `get_disciplinary_department_comparison` | Per-dept comparison, manager effectiveness | `departments`, `company_averages`, `company_median_warnings_per_capita`, `manager_effectiveness` (flagged if ratio >2.0), `coaching_resolved_30d`, `flag_thresholds` |
| `get_disciplinary_workflow_health` | Process health metrics | `rejection_analysis` (by dept, issuer_role, top reasons), `filing_lag` (avg/median/p90, by dept), `approval_turnaround` (split: completed metrics + pending metrics), `coaching_resolution` (stagnant >90d), `stage6_outcomes` (termination cases, DI split) |
| `get_disciplinary_employee_details` | Per-employee drill-down | PII-stripped, 25-row limit, 4 boolean filters, at-risk composite scoring, cross-module: `attendance_issues`, `mc_leave_count_ytd`, `latest_appraisal_score`, `employment_status` |

**Stage Name to Display Label Mapping**:
```
retraining -> Coaching
show_cause -> Show Cause Letter
warning_1 -> 1st Warning
warning_2 -> 2nd Warning
warning_3 -> 3rd Warning
termination -> Termination / DI
```

**Settings dependencies (5 values)**: `atrisk_weight_warning` (0.5), `atrisk_weight_appraisal` (0.3), `atrisk_weight_combined` (0.2), `atrisk_threshold` (0.3), `poor_appraisal_threshold` (0.625).

**Briefing flags (9)**: pending >3, pending >14d, escalation >30%, at-risk >0, volume increasing 3mo, unresolved coaching + new warning, single issuer >40%, filing lag avg >14d, coaching resolution <50%.

**Pattern Checklist (19 items: 17 CORE + 2 EXPLORE)**:
- Original CORE (8): NEG-I2 Escalation Pattern, NEG-I3 Repeat Offense Category, NEG-AL5 Unresolved Coaching + New Warning, NEG-C2 Team Warning Rate Disparity, NEG-W2 Warning Approvals Stuck, POS-M5 Coaching Resolved, POS-T4 Volume Declining, POS-AL2 At-Risk Cleared
- New CORE (6): NEG-Q1 Filing Quality, NEG-Q2 Documentation Delay, NEG-R14 Coaching Stagnation, NEG-I5 Broadening Misconduct, NEG-R15 Post-Coaching Recidivism, POS-M6 Quick Coaching Resolution
- SENSITIVITY-GATED CORE (3): NEG-C3 Issuer Concentration (>40%), NEG-I4 Attendance-Disciplinary Mismatch (validation_rate <50%), NEG-P6 Post-Warning Stress Signal (MC spike >50% in 90d)
- EXPLORE (2): Seasonal Warning Patterns, Attendance Validation

**Sensitivity-gated pattern handling**: Data is always computed, but prompt gates surfacing. NEG-C3 must frame as potential bias/understaffing/one manager doing all work. NEG-I4 surfaces only when rate is low. NEG-P6 framed as organizational concern, not individual blame.

**Mandatory tool sequence**: Steps 1-6 required, Step 7 optional (employee_details).

### 3.6 Probation (Story 4.6) -- 4 page-specific tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_probation_snapshot` | Status counts, overdue detail, upcoming, disciplinary overlay | `probation_settings`, `counts` (just_join/mid_way/overdue/closed), `by_action`, `by_department`, `overdue_detail`, `upcoming_end_30d`, `upcoming_end_60d`, `completion_rate`, `disciplinary_overlay` (with_warnings, with_active_coaching, at_risk, by_department) |
| `get_probation_trends` | Monthly activity, outcome-warning correlation | `monthly_activity` (N months), `probation_cohort`, `outcome_distribution`, `outcome_warning_correlation`, `warnings_during_probation` (by_stage, top_offense_categories) |
| `get_probation_employee_details` | Per-employee drill-down with disciplinary context | PII-stripped, 25-row limit, 6 filter params (department, status, action, expiring_within_days, has_warnings, sort_by), warning_count, highest_stage, at_risk_score |
| `get_probation_disciplinary_risk` | Probation-vs-tenured comparison, onboarding risk | `probation_warning_incidence` (risk_ratio), `dept_onboarding_risk` (flagged if ratio >2.0), `offense_profile_comparison` (during vs post), `time_to_first_warning` (median, by dept), `active_dual_risk` |

**Probation status is COMPUTED (SCP-118), not stored**:
```sql
CASE
  WHEN rt.action IS NOT NULL THEN 'Closed'
  WHEN CURRENT_DATE > rt.probation_end_date THEN 'Overdue'
  WHEN CURRENT_DATE >= rt.join_date + ((rt.probation_end_date - rt.join_date) / 2) THEN 'Mid Way'
  ELSE 'Just Join'
END AS status
```

**Settings dependencies (5 values)**: Same at-risk settings as Disciplinary.

**Briefing flags (7)**: overdue >0, overdue >30d, upcoming 30d, mid-review 14d, probationers with warnings >0, probationers at-risk >0, dept risk_ratio >2.0.

**Pattern Checklist (10 items, all CORE, 0 EXPLORE)**:
NEG-R7 Probation Overdue, NEG-R8 End Approaching, NEG-C8 Period Variation, POS-M3 Successfully Completed, POS-O3 High Performer on Probation, NEG-PD1 Under Disciplinary Action, NEG-PD2 Department Onboarding Risk, NEG-PD3 Rapid First Warning, NEG-PD4 Warning-Correlated Termination, POS-PD5 Clean Probation Completion.

**Mandatory tool sequence**: Steps 1-4 required, Step 5 optional (employee_details). Most cost-efficient page (4-5 turns, ~$0.12-0.18).

---

## 4. Cross-Module Shared Tool

### `get_cross_module_flags`

- **Location**: `shared/cross-module.tools.ts`
- **Description**: Aggregates flags from Attendance, Leave, and Disciplinary for a given employee or cohort
- **Returns**: Last upload date, data freshness, at-risk employee count, pending warnings count
- **Scope**: Registered in every domain's MCP server. Called as the FIRST tool in every investigation protocol.
- **Note**: This tool is net-new (no pilot reference). Spec is in `docs/ai-insight/ai-insight-tooling.md`.

### `get_employee_details` (Workforce, reused everywhere)

- **Source**: `workforce/workforce.tools.ts`
- **Reused by**: All 6 domain MCP servers import and register it
- **Returns**: PII-stripped employee-level data, hard limit 25 rows
- **Usage**: Optional tool in investigation protocols -- only called when prior tools reveal specific individuals to drill into

---

## 5. System Prompt & Persona

### Prompt Structure (~1,200 tokens)

The prompt lives in a `.md` file (PO-reviewable). A thin `.ts` glue file injects the runtime briefing:

1. **PERSONA** (~60 tokens) -- Domain-specific analyst role
2. **BRIEFING** (dynamic ~400-600 tokens) -- Injected from briefing generator at runtime. Includes `Current date: {YYYY-MM-DD}`.
3. **INVESTIGATION_GUIDANCE** (~150 tokens) -- Mandatory tool sequence
4. **PATTERNS** (~120 tokens) -- Numbered checklist filtered by `AI_INSIGHT_PROMPT_MODE` env var
5. **RULES** (~100 tokens) -- Cite numbers, separate observation from inference, recommendations must specify WHO/WHAT/WHEN
6. **OUTPUT_FORMAT** (~300 tokens) -- JSON schema for output

### Per-Domain Persona

| Domain | Persona Description |
|--------|-------------------|
| Workforce | "workforce analytics expert analyzing HR data for Hoi Yong Fruits Enterprise, a ~70-employee Malaysian fruit distribution company" |
| Attendance | Attendance and workforce compliance analyst, Malaysian Employment Act 1955, max 104 OT hours/month, 1.5x/2.0x multipliers |
| Leave | Leave management + workforce planning analyst, Malaysian Employment Act 1955: AL 8-16 days, MC 14-22 days, maternity 98 days |
| Performance | Performance management & talent development analyst |
| Disciplinary | Disciplinary and employee relations analyst, Malaysian IRA 1967 |
| Probation | Employee lifecycle and compliance analyst, Malaysian Employment Act 1955 -- deemed confirmation exposure |

### Prompt Mode

Controlled by `AI_INSIGHT_PROMPT_MODE` env var:
- **strict**: Only CORE patterns evaluated
- **exploratory**: CORE + EXPLORE patterns evaluated

`buildSystemPrompt()` filters the checklist by mode.

### Key Prompt Rules

- Cite specific numbers from tool data
- Separate observation from inference
- Recommendations must specify WHO, WHAT, and WHEN
- Aim 5-8 insights, depth > breadth
- Severity ordering: critical -> high -> medium -> low, then by employee count

---

## 6. Output Schema

### InsightResult / Finding Types

The E2E tests (`ai-insight-parity.spec.ts`) define the production schema:

```typescript
// InsightResult (from SSE complete or /latest cache)
{
  insights: Finding[]      // flat array -- NOT negative_insights[] + positive_insights[]
  metadata: InsightMetadata
}

// Finding (per the parity spec)
{
  title: string            // e.g. "Warehouse turnover reached 31%"
  severity: 'high' | 'medium' | 'low' | 'info'
  summary: string          // 1-line summary
  detail_bullets: string[] // array of bullet points
  recommendation?: string  // ABSENT for severity='info'
}

// InsightMetadata
{
  generated_at: string     // ISO timestamp
  model: string            // 'claude-sonnet-4-6'
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  duration_ms: number
  turns: number
}
```

**Important schema note from E2E tests**:
- The field is `insights[]` (flat array), NOT `negative_insights[]` + `positive_insights[]` (which was the Story 4.1 prompt design)
- Finding must NOT have `type` or `detail` fields (E2E asserts `'type' in insight` is falsy, `'detail' in insight` is falsy)
- `info` severity findings must NOT have `recommendation` (E2E: `if (insight.severity === 'info') expect(Boolean(insight.recommendation)).toBeFalsy()`)

**Note on schema evolution**: The Story 4.1 dev notes describe an output format with `negative_insights[]` and `positive_insights[]`, while the E2E parity spec enforces `insights[]`. The parity spec represents the final contract.

### Severity Levels

- `high` -- Critical issues requiring immediate action (dark red card)
- `medium` -- Notable concerns worth monitoring (dark red card)
- `low` -- Minor observations (dark red card)
- `info` -- Positive findings or neutral observations (teal card). No recommendation field.

### JSON Parsing (`parseAgentOutput`)

Exported from `service.ts`:

1. Strip `` ```json ... ``` `` markdown fences
2. `JSON.parse()`
3. Validate against InsightResult shape (has `insights[]` array)
4. Each finding must have: `title`, `severity`, `summary`, `detail_bullets`
5. Fallback to error state if malformed

### Partial Result Recovery

When `maxTurns` or `maxBudgetUsd` is hit (result subtype `error_max_turns` / `error_max_budget_usd`):
1. Walk prior `SDKAssistantMessage` entries for text content blocks
2. Attempt `parseAgentOutput()` on the last text block
3. If valid: return with metadata note "Analysis was cut short due to resource limits"
4. If invalid: return error "Analysis timed out, please retry"

---

## 7. API Endpoints & SSE

### Endpoint Pattern (per module)

Each of the 6 modules (workforce, attendance, leave, performance, disciplinary, probation) registers 3 endpoints:

```
POST /api/v1/hr/ai-insight/{module}/insights/generate  -- SSE endpoint, streams events
GET  /api/v1/hr/ai-insight/{module}/insights/latest     -- Returns cached result or { cached: false }
GET  /api/v1/hr/ai-insight/{module}/insights/status      -- Returns { generating, queuePosition? }
```

All routes mounted under `/ai-insight` sub-router in `hr.routes.ts` with middleware chain: `authenticate` -> `attachAbility` -> `canReadHR`.

### SSE Endpoint Pattern

```typescript
// POST /{module}/insights/generate
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')
res.flushHeaders()

const sendEvent = (event: SSEEvent) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}
```

### SSE Event Types

1. **`progress`** -- Fired via `PreToolUse` hooks during generation
   ```json
   { "type": "progress", "step": "tool_call", "tool": "get_workforce_snapshot" }
   ```
   Also: `{ "type": "progress", "step": "briefing", "message": "Preparing data briefing..." }`

2. **`complete`** -- Final result
   ```json
   {
     "type": "complete",
     "data": {
       "insights": [...],
       "metadata": { "generated_at": "...", "model": "...", ... }
     }
   }
   ```

3. **`error`** -- Error event
   ```json
   { "type": "error", "message": "Access denied" }
   ```

### Response Schema from E2E Tests

**`/latest` response when cached**:
```json
{
  "cached": true,
  "data": {
    "insights": [
      {
        "title": "...",
        "severity": "high|medium|low|info",
        "summary": "...",
        "detail_bullets": ["...", "..."],
        "recommendation": "..."
      }
    ],
    "metadata": {
      "generated_at": "...",
      "model": "claude-sonnet-4-6",
      "total_tokens": 1200,
      "input_tokens": 900,
      "output_tokens": 300,
      "cost_usd": 0.041,
      "duration_ms": 14250,
      "turns": 4
    }
  }
}
```

**`/latest` response when not cached**:
```json
{ "cached": false }
```

### RBAC on Endpoints

- RBAC check: call `getDataScopeFilter(scopeContext)`. If returns `'deny'`, send SSE error event and end response.
- `AbortController` wired to `req.on('close')` for cancel support.

---

## 8. Frontend Components

### AIInsightPanel

- Container component: generate/cancel button, grouped sections, metadata footer
- Prop: `endpoint` (e.g., `"/workforce/insights"` -- hook prepends `/hr/ai-insight`)
- On mount: calls `GET /latest` to check cache
- Generate button triggers SSE stream via `useAIInsightGenerate` hook
- Regenerate action shows confirmation dialog before overwriting cache
- RBAC: hidden for `sale`/`operation` roles via `canViewInsights = userRole !== 'sale' && userRole !== 'operation'` (uses `user.role` directly, NOT `hasRole()`)

### Layout

```
+-----------------------------------------------------------+
|  AI Insights  [N insights]              [Generate/Cancel]  |
+-----------------------------------------------------------+
|  -- NEGATIVE INSIGHTS (N) --------------------------       |
|  [red card] [red card] [red card] ...                      |
+-----------------------------------------------------------+
|  -- POSITIVE INSIGHTS (N) --------------------------       |
|  [teal card] [teal card] ...                               |
+-----------------------------------------------------------+
| Tokens: 43,100 (37,955 in / 5,145 out)                    |
| Cost: $0.191    Time taken: 28.3s                          |
+-----------------------------------------------------------+
```

Note: CR-15 resolved that SDK does NOT expose per-message token counts. Metadata footer shows turns count instead when tokens are zero.

### AIInsightCard

- Clickable card with colored background
- **Negative insights**: dark red bg + white text (`bgcolor: '#d32f2f', color: '#fff'`)
- **Positive insights**: teal bg + white text (`bgcolor: '#00796b', color: '#fff'`)
- Severity icon: `tabler-alert-triangle` (high/critical), `tabler-info-circle` (medium/low)
- Dark bg + white text contrast rule (NEVER pastel)
- `tabler-sparkles` icon in panel header

### AIInsightModal

3 accordion sections (arrow on LEFT via `flexDirection: 'row-reverse'` + `ml: 1`):

1. **Detail Analysis** -- `finding.detail_bullets` rendered as list items
2. **Evidence** -- `finding.evidence_table` rendered as MUI Table if present; text fallback if absent. Schema: `{ headers: string[], rows: (string|number)[][] }`
3. **Recommendation** -- `finding.recommendation` in callout Box. Hidden for `severity === 'info'`.

### AIInsightLoading

- Live SSE progress step list with checkmarks
- Shows tool call names as they occur (e.g., "fetching workforce snapshot", "analyzing department breakdown")

### useAIInsightGenerate Hook

Uses `fetch()` + `ReadableStream` (NOT `EventSource` -- browser EventSource API does not support POST and auto-retries on disconnect which would trigger duplicate generations):

```typescript
const response = await fetch(endpoint + '/generate', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  signal: abortController.signal,
})

const reader = response.body!.getReader()  // CR-19: added null check
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  // Parse SSE "data: {...}\n\n" lines from buffer
}
```

### Frontend Types

Single source of truth: `components/hr/ai-insight/types.ts` (CR-21 fix -- eliminated duplicate type definitions between backend `shared/types.ts` and frontend hook).

---

## 9. Settings & Thresholds

### 10 Alert Categories (from Settings Sidebar)

The sidebar defines 11 INSIGHTS_ITEMS (the Appraisal Analytics entry maps to the `analytics_appraisal` category):

| # | Sidebar Label | Category Key | Configurable Fields | Default Values |
|---|--------------|--------------|-------------------|----------------|
| 1 | Leave Pattern Abuse | `alert_leave_pattern` | `leave_abuse_threshold` (int), `adjacent_holiday_days` (int) | 3, 2 |
| 2 | Always Late In | `alert_chronic_lateness` | `chronic_lateness_threshold` (int) | 3 |
| 3 | High Absence | `alert_high_absence` | `high_absence_threshold` (int) | 3 |
| 4 | Dinner Break Violation | `alert_break_compliance` | `threshold` (int) | 3 |
| 5 | Labor Compliance | `alert_labor_compliance` | `daily_work_hour_limit` (int), `violation_threshold` (int), `dinner_break_window_start` (time), `dinner_break_window_end` (time), `dinner_break_min_duration` (int, min), `ot_dinner_break_cutoff` (time) | 12, 3, 17:00, 19:00, 30, 21:00 |
| 6 | Abnormal OT | `alert_ot_anomaly` | `ot_anomaly_threshold` (decimal z-score), `ot_anomaly_min_expected` (int), `ot_anomaly_absolute_cap` (int) | 2.0, 5, 40 |
| 7 | At-Risk Employees | `alert_at_risk` | `atrisk_weight_warning` (decimal), `atrisk_weight_appraisal` (decimal), `atrisk_weight_combined` (decimal), `atrisk_threshold` (decimal), `poor_appraisal_threshold` (decimal) | 0.5, 0.3, 0.2, 0.3, 0.625 |
| 8 | Always Early Out | `alert_early_departure` | `early_departure_threshold` (int) | 3 |
| 9 | Leave Utilization | `alert_leave_utilization` | `leave_utilization_low_threshold` (decimal), `leave_utilization_high_threshold` (decimal) | 0.3, 0.9 |
| 10 | Appraisal Analytics | `analytics_appraisal` | `top_performer_threshold` (decimal), `low_performer_threshold` (decimal) | 0.85, 0.5 |
| -- | *(hidden)* | `alert_payroll_variance` | `payroll_variance_threshold` (int) | 15 |

**Hidden category**: `alert_payroll_variance` is excluded from sidebar and API responses (Story 1.13 deferred).

### Settings API

- `GET /api/v1/hr/settings` -- Returns all visible settings grouped by category (Superadmin-only)
- `PUT /api/v1/hr/settings/:category` -- Updates settings for a category with audit trail

### Settings UI Pages

11 stub pages exist at `code/frontend/src/app/(dashboard)/settings/insights/`:
- `leave-pattern/page.tsx`
- `chronic-lateness/page.tsx`
- `high-absence/page.tsx`
- `break-compliance/page.tsx`
- `labor-compliance/page.tsx`
- `abnormal-ot/page.tsx` (sidebar label "Abnormal OT")
- `at-risk/page.tsx`
- `early-departure/page.tsx`
- `leave-utilization/page.tsx`
- `appraisal-analytics/page.tsx`
- `ot-wage-threshold/page.tsx`

### Settings Utilities (`hr-settings.util.ts`)

```typescript
getSettingInt(category, key) -> Promise<number | null>
getSettingDecimal(category, key) -> Promise<number | null>
getSettingString(category, key) -> Promise<string | null>
parseTimeToMinutes(timeStr) -> number  // '17:00' -> 1020
```

### At-Risk Composite Scoring Formula

Used by Performance, Disciplinary, and Probation tools:

```
at_risk_score = (warning_factor x weight_warning) + (appraisal_factor x weight_appraisal) + (coaching_factor x weight_combined)
```

Where:
- `warning_factor` = 1.0 if ANY approved warning at stage `warning_1`/`warning_2`/`warning_3` (stages 3-5), else 0.0
- `appraisal_factor` = 1.0 if `final_score < poor_appraisal_threshold x 100`, else 0.0
- `coaching_factor` = 1.0 if 2+ distinct offense categories in active coaching (stage 1, resolved_at IS NULL), else 0.0
- Flagged if `at_risk_score x 100 >= atrisk_threshold x 100`

**CRITICAL**: Use `warning_1`/`warning_2`/`warning_3` (stages 3-5) for warning_factor, NOT `final_warning` (HIGH-001 from Story 4.4 code review).

### Pattern Detection Service (Algorithmic, Running Code)

`code/backend/src/modules/hr/services/pattern-detection.service.ts` -- [IMPLEMENTED]

**Class**: `PatternDetectionService`

Two detection features:

1. **Chronic Lateness** (`detectChronicLateness`):
   - Queries `attendance_list` for employees with `lateness > 0` count exceeding threshold
   - Threshold from `hr_settings` (`alert_chronic_lateness.chronic_lateness_threshold`, default 3)
   - Groups by employee_code, filters by period (YYYYMM format) and department
   - Supports RBAC scope filter via `buildScopeFilterSql()`
   - Returns `{ flagged_count, employees[], threshold, period }`

2. **Holiday-Adjacent Leave Pattern** (two modes):
   - **Mode 1 (Sync-time)** -- `flagLeavesForSync()`: Flags ALL leave transactions during data sync. Updates `leave_transaction` records with `is_adjacent_holiday`, `adjacent_holiday_name`, `days_from_holiday`.
   - **Mode 2 (Dashboard)** -- `getLeavePatternAlerts()`: Queries pre-computed flags. Only APPROVED leaves count toward abuse flag. Uses `leave_abuse_threshold` (default 3) and `adjacent_holiday_days` (default 2) from settings.
   - `computeAdjacentHolidayFlag()`: Calculates business days between leave date and holidays, flags if within threshold.
   - `backfillAdjacentHolidayFlags()`: One-time historical backfill in batches of 500.

---

## 10. Quality Guardrails

### 3-Layer Quality Model

| Layer | Control | Value |
|-------|---------|-------|
| Tool-level | Per-tool response cap | 16K chars (~4K tokens) |
| Tool-level | Employee details row limit | 25 rows |
| Tool-level | Distributions cap | Top 15 per category |
| Tool-level | Movement months max | 24 |
| SDK | maxTurns | 8 |
| SDK | maxBudgetUsd | $0.30 |
| Prompt | Investigation protocol | Fixed tool-call sequence (mandatory) |
| Prompt | Pattern checklist | Evaluate ALL patterns, report triggered |
| Prompt | Severity ordering | critical -> high -> medium -> low, then by employee count |
| Prompt | Depth guidance | "Aim 5-8 insights, cite specific numbers, depth > breadth" |

### PII Filter (`stripPiiFromRows()`)

- **Location**: `shared/pii-filter.ts`
- **29 sensitive fields** stripped (AC4 updated from 26 to 29 per CR-10):
  - Names, employee codes, IC/passport numbers, emails, phone numbers, addresses, salary figures
- **Security boundary**: PII must NEVER be sent to external LLM providers (NFR-HR-SEC-04)
- A failing PII audit blocks generation
- Applied to all `get_*_employee_details` tool responses before data reaches the model

### RBAC Scope Matrix

| Role | Scope | AI Insight |
|------|-------|------------|
| Superadmin / HR / Director | All employees (scopeFilter = null) | Full access |
| Finance | Own department only | Department-scoped insights |
| Manager | Own dept + direct reports | Team-scoped insights |
| Sale / Operation | Denied (scopeFilter = 'deny') | No insight panel shown, 403 from API |

- **Server-side**: CASL ability layer returns 403 for `sale`/`operation` users
- **Client-side**: Panel not rendered via `canViewInsights` guard
- **Scope filter cannot be overridden by the model**: `buildScopeWhere()` is applied in the tool closure, not passed as a parameter the model could modify

### Cost Model

| Domain | Lean | Normal | Max |
|--------|------|--------|-----|
| Workforce | ~$0.10-0.15 (4 calls) | ~$0.18-0.25 (5-6 calls) | ~$0.30 |
| Attendance | ~$0.15-0.20 (6 calls) | ~$0.20-0.28 (7 calls) | ~$0.30 |
| Leave | ~$0.15-0.20 (6 calls) | ~$0.20-0.28 (7 calls) | ~$0.30 |
| Performance | ~$0.15-0.20 (6 calls) | ~$0.20-0.28 (7 calls) | ~$0.30 |
| Disciplinary | ~$0.15-0.22 (6 calls) | ~$0.20-0.28 (7 calls) | ~$0.30 |
| Probation | ~$0.08-0.12 (4 calls) | ~$0.12-0.18 (5 calls) | ~$0.18-0.22 |

Expected average across all domains: **$0.15-0.25** per generation. 24h per-user cache minimizes repeat cost.

### Output Determinism

SDK v0.2.63 does NOT support `temperature`. Prompt discipline is the primary lever. Expected ~70% consistency across runs.

**Fallback if <70% consistency**: Swap to raw `@anthropic-ai/sdk` with `messages.create({ temperature: 0 })` + manual tool loop. Reference: `spike/ai-insight/src/service.ts` (230 lines).

---

## 11. Concurrency, Caching, Logging

### Cache Strategy

- **Type**: Per-user, per-module, in-memory `Map`
- **Key**: `${userId}:${module}` (changed from `userId` only in Story 4.2)
- **TTL**: 24 hours
- **Cleanup**: Periodic `setInterval` with `.unref()` (CR-22 fix)
- **Process lifecycle**: `SIGTERM`/`SIGINT` handlers call `insightCache.destroy()` (CR-9 fix)
- **NOT persisted to database**: Intentional -- insights are derivative of live data, not durable artifacts. Cache lost on server restart.
- **Regeneration**: First request after restart triggers fresh generation

### Concurrency Handling

- **Limit**: 1 active generation per user (across ALL modules, not per-module)
- **Behavior**: Additional requests rejected with error (not queued -- CR-2 removed dead queue code)
- **Cancel support**: `AbortController` wired to `req.on('close')`
- **`isGenerating(userId)`**: Checks `activeGenerations` Map keyed by `userId` only

### Logging

- **Structured JSON**: `insight-logger.ts`
- **Logged per generation**: briefing payload, every tool call and response, PII-check pass/fail, cost metadata (tokens in/out, dollar cost, elapsed time)
- **Module field**: Already parameterized from Story 4.2 onward
- **Audit requirement**: FR-HR-AI-09

---

## 12. OpenAI API Service (Story 1.16)

This is a **SEPARATE** feature from Epic 4. It provides salary benchmarking using the OpenAI API.

### Architecture

- **Package**: `openai@4.77.0`
- **Model**: `gpt-4o-mini` (configurable via `OPENAI_MODEL` env var)
- **Location**: `code/backend/src/common/services/openai.service.ts`
- **Status**: [IMPLEMENTED -- THEN REMOVED] (removed with Epic 4 code removal)

### Schema

```prisma
model hr_salary_benchmarks {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  job_title     String    @unique
  country       String    @default("Malaysia")
  salary_min    Decimal?  @db.Decimal(12, 2)
  salary_median Decimal?  @db.Decimal(12, 2)
  salary_max    Decimal?  @db.Decimal(12, 2)
  fetched_at    DateTime  @db.Timestamptz(6)
  expires_at    DateTime  @db.Timestamptz(6)
  source        String    @default("OpenAI API")
  @@index([job_title])
}
```

### Response Schema (Zod validated)

```typescript
SalaryBenchmarkResponseSchema = z.object({
  job_salaries: z.array(z.object({
    job_title: z.string().min(1).max(100),
    salary_monthly: z.object({
      min: z.number().min(0).max(100000),
      median: z.number().min(0).max(100000),
      max: z.number().min(0).max(100000),
    }),
    confidence: z.enum(['high', 'medium', 'low']),
    data_year: z.number().min(2020).max(2026).optional(),
  })),
})
```

### Circuit Breaker

Using `opossum` library:

| Parameter | Value |
|-----------|-------|
| `timeout` | 30,000 ms |
| `errorThresholdPercentage` | 50% |
| `resetTimeout` | 60,000 ms |
| `volumeThreshold` | 3 |

### Error Handling

| Error Type | Strategy |
|------------|----------|
| Timeout (30s) | Return empty, log error |
| Rate Limited (429) | Exponential backoff: 1s, 2s, 4s (max 3 retries) |
| API Error (5XX) | Log error, return empty |
| Invalid API Key | Log warning, return empty |
| Invalid Response | Validate with Zod, return cached data on failure |
| Circuit Open | Return cached data, log warning |

### PII Protection

**NEVER send to OpenAI**: Employee names, codes, IDs, actual salary data, IC numbers, phone numbers, emails, any PII.
**ONLY send**: Job titles (sanitized) + Country (hardcoded to "Malaysia" in system prompt).

Input sanitizer (`openai.sanitizer.ts`): PII detection for IC numbers, emails, phone numbers, employee codes; injection character removal.

### Cache

Results cached to `hr_salary_benchmarks` table with `fetched_at` + `expires_at` (default 30 days).
- Manual refresh via button always fetches fresh
- Auto-refresh when `expires_at` passed and user views benchmark table

### System Prompt

```
You are a Malaysian labor market data assistant.

CONSTRAINTS:
- Return ONLY data for Malaysia (MYR currency)
- Base estimates on 2024-2025 labor market data
- If uncertain about a job title, set confidence: "low"
- Salary ranges must be realistic for Malaysian market:
  - Entry-level (fresh grad): RM 2,000 - 4,000
  - Mid-level (3-7 years): RM 4,000 - 10,000
  - Senior (8-15 years): RM 10,000 - 20,000
  - Management: RM 15,000 - 40,000
  - Executive: RM 40,000+
- Blue collar roles (Packer, Warehouse, Driver): RM 1,500 - 3,500
- NEVER invent specific company names or data sources
- Return empty array if job title is unrecognizable

OUTPUT FORMAT: JSON only, matching the schema exactly. No explanations.
```

### OpenAI Configuration

```typescript
OPENAI_CONFIG = {
  temperature: 0.2,       // Low for factual accuracy
  top_p: 0.9,
  max_tokens: 1000,
  presence_penalty: 0,
  frequency_penalty: 0,
  timeout: 30000,         // 30 seconds
}
```

### Files

| File | Purpose |
|------|---------|
| `code/backend/src/common/services/openai.service.ts` | Main service class |
| `code/backend/src/common/services/openai.config.ts` | Configuration constants |
| `code/backend/src/common/services/openai.prompts.ts` | System prompts |
| `code/backend/src/common/services/openai.sanitizer.ts` | Input sanitization |
| `code/backend/src/common/validators/openai-response.validator.ts` | Zod schemas |
| `code/backend/src/common/services/__tests__/openai.service.test.ts` | 38 unit tests |
| `code/backend/src/scripts/verify-openai-service.ts` | Live verification script |

---

## 13. QA Gate Summary

### Gate File

`docs/hr/qa/gates/epic4-ai-insights-gate-20260120.yml`

**Important context**: This gate was created on 2026-01-20 and reflects the **pre-pivot architecture** (hybrid local algorithms + OpenAI). It does NOT reflect the Claude SDK pivot that happened later. The story IDs (4.1--4.8) also differ from the final stories (4.1--4.6).

### Coverage

- **Total scenarios**: 156
- **Stories covered**: 8 (4.1--4.8 in gate numbering)
- **Insight types**: 25
- **By level**: Unit (72), Integration (64), E2E (20)
- **By priority**: P0 (48), P1 (76), P2 (32)
- **Gate status**: PASS

### Engine Breakdown (Pre-Pivot Architecture)

| Engine | Technology | Insight Count | Latency | Cost |
|--------|-----------|--------------|---------|------|
| Local Algorithm | `simple-statistics` | 17 | <50ms | Free |
| Local ML | `ml.js` | 1 | <300ms | Free |
| OpenAI LLM | `openai` SDK | 7 | 1-5s | API cost |

### Key Risk Areas

**Privacy Critical (P0)**: 6 PII-to-OpenAI scenarios covering Turnover Root Cause, Recognition Suggestions, Top Performer Analysis, Improvement Plans, Mitigation Suggestions, Open-Ended Discovery.

**Algorithm Accuracy (P0)**: Promotion Readiness Score (SCP-026), Attendance Deterioration (SCP-020), Overtime Limit Violation (FR66).

**Engine Routing (P0)**: Local vs OpenAI routing tests.

### E2E Parity Tests (Running Code)

`code/frontend/e2e/ai-insight-parity.spec.ts` -- Tests the current production schema:

1. **Endpoint smoke test**: Verifies `/latest` is reachable for all 6 modules and uses correct schema when cached (`insights[]` array, severity enum, `detail_bullets`, no `type`/`detail` fields, info has no recommendation).

2. **Frontend UI cached test**: Mocks `/latest` with cached payload, verifies panel renders titles, modal shows 3 accordion sections (Detail Analysis, Evidence, Recommendation), info severity hides Recommendation.

3. **Frontend SSE generate test**: Mocks `/generate` SSE endpoint, verifies generate button triggers stream, insights render after complete event.

---

## Appendix: Code Review Findings Summary

Across all 6 stories, adversarial code reviews identified and fixed significant issues. Key systemic lessons:

| Lesson | Source | Description |
|--------|--------|-------------|
| SQL parameterization | CR-4 (4.1) | All SQL must use `QueryParams` class with `$N` placeholders |
| Separate QueryParams per query | L-1 (4.2) | Never share params between independent queries |
| Lazy-cache settings | M-3 (4.2) | Fetch settings once per MCP server lifetime, not per-handler |
| RBAC scope in all CTEs | HIGH-001 (4.4 CR3) | Every sub-CTE must include scope + ACTIVE_JOIN |
| Use `warning_1/2/3` not `final_warning` | HIGH-001 (4.4) | At-risk scoring CTE uses stages 3-5 |
| `make_interval()` for parameterized intervals | LOW-001 (4.4) | Never use string concatenation for SQL intervals |
| Frontend RBAC: `user.role` not `hasRole()` | H-1 (4.2 CR3) | `hasRole()` returns true for superadmin for any check |
| SDK does not expose token counts | CR-6 (4.1) | Metadata footer uses turns, not tokens |
| `readFile` from `fs/promises`, never `readFileSync` | CR-18 (4.1) | All prompt loading is async |
| Pre-aggregate CTEs for O(n*m) joins | H-1 (4.5 CR3) | Replace cross-product joins with pre-aggregated monthly CTEs |
