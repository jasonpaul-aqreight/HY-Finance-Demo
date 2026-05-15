# AI Insight Engine — HR Configuration

> HR-specific insight modules, tools, and domain rules layered on the shared base platform (10-ai-insight-base.md).

---

## 1. Overview [DESIGNED — DEFERRED]

The HR configuration provides automated AI-driven analysis across six HR dashboard modules for Hoi-Yong Fruits Enterprise (~70 employees, Malaysian fruit distribution).

All Epic 4 code was **written, tested, and code-review-passed**, then **removed from the main branch** on 2026-04-15 (commit `7f154a2`) per team lead decision to freeze AI Insights across both HR and Finance. Specs, stories, and design docs remain preserved. Two components survive in the codebase: the Settings system (Story 1.11a) and the Pattern Detection Service.

| # | Module | Page | Tools | Patterns | Status |
|---|--------|------|-------|----------|--------|
| 1 | Workforce | workforce | 4 + 1 shared | 10 CORE + 5 EXPLORE | DESIGNED — DEFERRED |
| 2 | Attendance | attendance | 7 | 14 CORE + 2 EXPLORE | DESIGNED — DEFERRED, partially IMPLEMENTED |
| 3 | Leave | leave | 7 | 13 CORE + 1 EXPLORE | DESIGNED — DEFERRED, partially IMPLEMENTED |
| 4 | Performance | performance | 6 | 15 CORE | DESIGNED — DEFERRED |
| 5 | Disciplinary | disciplinary | 6 | 17 CORE + 2 EXPLORE | DESIGNED — DEFERRED |
| 6 | Probation | probation | 4 | 10 CORE | DESIGNED — DEFERRED |

**Totals:** 6 modules, 34 page-specific tools + 1 shared cross-module tool, 89 patterns (79 CORE + 10 EXPLORE).

### SDK Decision Timeline

1. **Initial design (pre-2026-01):** Hybrid local algorithms (`simple-statistics`, `ml.js`) + OpenAI (`gpt-4o`, `gpt-4o-mini`) for NLG insights. The QA gate (§18) reflects this architecture.
2. **SCP-119 pivot:** Technology change to Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), model `claude-sonnet-4-6`, MCP tool pattern. Stories 4.1–4.6 were implemented against this SDK.
3. **2026-04-15 architecture decision:** Agent SDK declared overkill. Platform standardizes on client SDK (`@anthropic-ai/sdk`) with single `messages.create()` call. Story headers mark Agent SDK runtime sections as obsolete.
4. **2026-04-15 deferral:** Entire Epic 4 frozen. Code removed from main branch. Specs preserved.

### Implementation Note

When Epic 4 un-defers, Story 4.1 must be rewritten against the client SDK pattern first. The insight content (what each page analyzes, PII rules, RBAC scoping, finding types) remains valid; only the runtime shape changes.

---

## 2. Analysis Persona [DESIGNED — DEFERRED]

### Prompt Structure (~1,200 tokens)

The prompt lives in a `.md` file (PO-reviewable). A thin `.ts` glue file loads the markdown and injects the runtime briefing via `buildSystemPrompt(briefing)`. Six sections:

| # | Section | Size | Content |
|---|---------|------|---------|
| 1 | PERSONA | ~60 tokens | Domain-specific analyst role (see per-domain table below) |
| 2 | BRIEFING | ~400–600 tokens | Injected at runtime from briefing generator. Includes `Current date: {YYYY-MM-DD}`. |
| 3 | INVESTIGATION_GUIDANCE | ~150 tokens | Mandatory tool sequence for the domain |
| 4 | PATTERNS | ~120 tokens | Numbered checklist filtered by `AI_INSIGHT_PROMPT_MODE` |
| 5 | RULES | ~100 tokens | Cite numbers, separate observation from inference, recommendations must specify WHO/WHAT/WHEN |
| 6 | OUTPUT_FORMAT | ~300 tokens | JSON schema for output (InsightResult) |

### Per-Domain Persona

| Domain | Persona |
|--------|---------|
| Workforce | "Workforce analytics expert analyzing HR data for Hoi Yong Fruits Enterprise, a ~70-employee Malaysian fruit distribution company" |
| Attendance | Attendance and workforce compliance analyst, Malaysian Employment Act 1955, max 104 OT hours/month, 1.5x/2.0x multipliers |
| Leave | Leave management + workforce planning analyst, Malaysian Employment Act 1955: AL 8–16 days, MC 14–22 days, maternity 98 days |
| Performance | Performance management and talent development analyst |
| Disciplinary | Disciplinary and employee relations analyst, Malaysian IRA 1967 |
| Probation | Employee lifecycle and compliance analyst, Malaysian Employment Act 1955 — deemed confirmation exposure |

### Prompt Mode

Controlled by `AI_INSIGHT_PROMPT_MODE` environment variable:

| Mode | Behavior |
|------|----------|
| `strict` | Only CORE patterns evaluated |
| `exploratory` | CORE + EXPLORE patterns evaluated |

`buildSystemPrompt()` filters the pattern checklist by mode before injecting into the prompt.

### Key Prompt Rules

- Cite specific numbers from tool data
- Separate observation from inference
- Recommendations must specify WHO, WHAT, and WHEN
- Aim 5–8 insights, depth over breadth
- Severity ordering: critical, high, medium, low — then by employee count

---

## 3. Architecture Deviations from Base [DESIGNED — DEFERRED]

The HR AI Insight system differs from the base platform (10-ai-insight-base.md) in several structural ways. This section describes the differences factually. The gap analysis file evaluates compatibility.

### 3.1 Single Model, Single Call (No Dual-Model Strategy)

> See §3 of 10-ai-insight-base.md for the base dual-model strategy.

The base platform uses two models: a component-analysis model for per-component narration and a summary model for cross-component synthesis. HR uses a **single `claude-sonnet-4-6` call** per generation — there is no separate component-analysis phase and no summary synthesis phase. The model receives the full briefing and tool access in one session.

### 3.2 Briefing System (Not Component Fetchers)

> See §4.1 of 10-ai-insight-base.md for the base Phase 1 component data fetching.

The base platform fetches data per-component via data fetchers that return formatted prompt blocks plus allowed-value whitelists. HR instead uses a **briefing system**: a server-side briefing generator runs 6–11 parallel queries, applies domain-specific flag conditions against configurable thresholds from `hr_settings`, and outputs ~400–600 tokens of structured markdown injected into the system prompt at runtime.

Briefing format:
```
Current date: {YYYY-MM-DD}

**What Management Sees Right Now ({Page} Dashboard):**
- KPI 1: value
- KPI 2: value
...

[Warning flags if applicable]

**What's on screen:** [Description of visible dashboard elements]
```

Workforce is a special case: its briefing provides raw numbers only (no threshold flagging) — the agent reasons via the 15-pattern checklist.

### 3.3 MCP Tools (Not Generic Query Tools)

> See §7 of 10-ai-insight-base.md for the base tool use system.

The base platform exposes two generic tools (`query_local_table`, `query_rds_table`) with column whitelists and parameterized queries. HR instead uses **named domain-specific MCP tools** (e.g. `get_workforce_snapshot`, `get_attendance_flags`). Each tool:

- Runs fixed, pre-written SQL (not model-generated queries)
- Returns structured JSON with pre-computed aggregations
- Applies PII stripping and RBAC scope filtering in the tool closure
- Is capped at 16K chars (~4K tokens) per response
- Uses `QueryParams` class with `$N` positional placeholders for SQL parameterization

### 3.4 No Numeric Guard

> See §6 of 10-ai-insight-base.md for the base numeric guard.

The base platform extracts numbers from LLM output and validates them against an allowed-value whitelist. HR does not implement this guard. Instead, HR relies on prompt discipline ("cite specific numbers from tool data") and the fact that tools return pre-computed aggregations rather than raw tables the model must sum.

### 3.5 Flat Output Schema (Not Delimiter-Based)

> See §12 of 10-ai-insight-base.md for the base delimiter format.

The base platform uses a `===INSIGHT===` delimiter format parsed into `{ good: Insight[], bad: Insight[] }`. HR uses a **flat JSON array** parsed from the model's output: `{ insights: Finding[], metadata: InsightMetadata }`. See §12 for the full schema.

### 3.6 Cache Architecture

> See §5 of 10-ai-insight-base.md for the base concurrency and locking.

The base platform uses a database-backed singleton lock table and persists results to PostgreSQL. HR uses an **in-memory `Map`** with 24-hour TTL, keyed by `${userId}:${module}`. Cache is lost on server restart. There is no database persistence for insight results. See §16 for details.

### 3.7 Concurrency Model

The base platform uses a global singleton lock (one analysis across all users). HR uses a **per-user limit**: 1 active generation per user across all modules. Additional requests are rejected with an error (not queued). There is no global lock.

---

## 4. Workforce Insights [DESIGNED — DEFERRED]

### 4.1 Module Summary

| | |
|---|---|
| **Page** | workforce |
| **Tools** | 4 page-specific + 1 shared |
| **Patterns** | 10 CORE + 5 EXPLORE |
| **Briefing** | 6 raw KPIs, no threshold flagging |
| **Story** | 4.1 (86 tests, code-complete, then removed) |

### 4.2 Tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_workforce_snapshot` | Current headcount, department breakdown, tenure stats, turnover rate | 11 parallel queries; distributions with counts + percentages; composition grid |
| `get_department_breakdown` | Per-department headcount, demographics, manager coverage | 5 dimension breakdowns pivoted by department |
| `get_workforce_movement` | 12-month joiners/leavers/headcount (max 24 months) | Monthly joiners, leavers, net headcount change |
| `get_employee_details` | PII-stripped employee-level data for flagged cohorts | Filtered rows, hard limit 25 rows |
| `get_cross_module_flags` | [SHARED] Aggregates flags from Attendance, Leave, Disciplinary | Last upload date, data freshness, at-risk employee count, pending warnings count |

### 4.3 Briefing Design

6 raw KPIs: headcount, department count, turnover rate, average tenure, largest department, 30-day joiners/leavers.

**No threshold flagging** — the agent reasons via the 15-pattern checklist. This is unique among the six domains; all others apply flag conditions against `hr_settings` thresholds.

### 4.4 Pattern Checklist (10 CORE + 5 EXPLORE)

**CORE:**

| Code | Pattern | Notes |
|------|---------|-------|
| NEG-R10 | Department Dominance | >40% headcount in one department |
| NEG-P2 | Turnover Concentration | — |
| NEG-P4 | Workforce Shrinkage | 3+ months net negative |
| POS-M4 | Long Service Milestones | — |
| POS-T1 | Hiring vs Attrition | — |
| NEG-R5 | Flight Risk Composite | Cross-module, DATA-DEP |
| NEG-I5 | New Joiner Early Warning | DATA-DEP |
| NEG-A4 | Salary Below Market | DATA-DEP |
| NEG-R9 | Salary Compression Risk | DATA-DEP |
| POS-O2 | Top Performer Below Market | DATA-DEP |

**EXPLORE:**

| Code | Pattern |
|------|---------|
| — | Contract/probation expiry 30d |
| — | Demographic imbalances |
| — | Tenure risk |
| — | Age concentration risk |
| — | Single points of failure |

### 4.5 Mandatory Tool Sequence

1. `get_cross_module_flags`
2. `get_workforce_snapshot`
3. `get_department_breakdown`
4. `get_workforce_movement`
5. *(optional)* `get_employee_details`

### 4.6 Thresholds

Workforce uses no configurable `hr_settings` thresholds. The agent applies pattern-level thresholds directly from the pattern checklist (e.g. >40% headcount for Department Dominance).

---

## 5. Attendance Insights [DESIGNED — DEFERRED, partially IMPLEMENTED]

### 5.1 Module Summary

| | |
|---|---|
| **Page** | attendance |
| **Tools** | 7 page-specific |
| **Patterns** | 14 CORE + 2 EXPLORE |
| **Settings dependencies** | 10 configurable values |
| **Story** | 4.2 (120 tests across 3 review rounds, code-complete, then removed) |
| **Partial implementation** | `pattern-detection.service.ts` implements chronic lateness detection [IMPLEMENTED] |

### 5.2 Tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_attendance_snapshot` | Daily KPIs, monthly summary, OT breakdown, thresholds | `data_coverage`, `thresholds` (10 settings), `daily_kpis`, `monthly_summary`, `ot_breakdown`, `department_rates`, `employee_group_split` |
| `get_attendance_trends` | 12-month monthly data with MoM changes | `monthly_data` (attendance_rate, late, early, absent, OT by type), `summary`, `attendance_deteriorating_3mo`, `ot_returning_to_normal` |
| `get_attendance_flags` | Flagged employee counts by type | `lateness`, `early_departure`, `absence`, `break_compliance`, `daily_hours_exceeded`, `ot_anomaly`, `thresholds_used` |
| `get_attendance_department_comparison` | Department-level comparisons | Per-dept: headcount, rates, perm vs contract split, `ot_concentration_flagged`, `perfect_attendance_departments`, `absence_rate_vs_median` |
| `get_attendance_employee_details` | Per-employee attendance data | PII-stripped, 25-row limit, date-range-based, 6 boolean filter params, sort support |
| `get_attendance_break_compliance` | Dedicated break compliance deep-dive | `settings`, `period_summary` (by violation type: missing/too_late/too_short), `by_department`, `monthly_trend`, `daily_hours_exceeded` |
| `get_attendance_ot_analysis` | OT anomaly analysis | `period_summary` (paid vs extra, by type), `department_concentration`, `concentration_flags`, `anomaly_detection` (excessive + suspiciously_low), `monthly_ot_trend`, `ot_returning_to_normal` |

### 5.3 Briefing Design

8 flag conditions evaluated against `hr_settings` thresholds:

| Flag | Condition |
|------|-----------|
| Low attendance rate | <85% |
| High lateness | >10% |
| OT month-on-month increase | >20% |
| Department absence | >2x median |
| Break violation | >10% |
| 3-month decline | Attendance rate declining 3 consecutive months |
| Excellent attendance | >=95% |
| Rest/holiday OT | >40% |

### 5.4 Pattern Checklist (14 CORE + 2 EXPLORE)

**CORE:**

| Code | Pattern |
|------|---------|
| NEG-A1 | OT Hours Anomaly |
| NEG-A2 | Suspiciously Low OT |
| NEG-A3 | Department Rate Drop |
| NEG-R1 | Chronic Lateness |
| NEG-R2 | High Absence |
| NEG-AL1 | Daily Hours Exceeded |
| NEG-AL2 | Break Compliance Violation (missing/too late) |
| NEG-AL3 | Break Compliance Violation (too short) |
| NEG-AL4 | Early Departure Repeated |
| NEG-P1 | Attendance Deterioration |
| NEG-C1 | Department Absence Disparity |
| NEG-C4 | Permanent vs Contract Disparity |
| NEG-C5 | OT Concentration |
| POS-AL1 | Perfect Attendance Month |
| POS-T5 | OT Returning to Normal |

**EXPLORE:**

| Code | Pattern |
|------|---------|
| — | Seasonal Holiday Awareness |
| — | OT Type Composition |

### 5.5 Mandatory Tool Sequence

1. `get_cross_module_flags` *(shared)*
2. `get_attendance_snapshot`
3. `get_attendance_trends`
4. `get_attendance_flags`
5. `get_attendance_department_comparison`
6. `get_attendance_break_compliance`
7. *(optional)* `get_attendance_ot_analysis`
8. *(optional)* `get_attendance_employee_details`

### 5.6 Settings Dependencies (10 values)

| Setting Key | Type | Default | Used By |
|-------------|------|---------|---------|
| `chronic_lateness_days` | int | 3 | `get_attendance_flags`, pattern detection service |
| `high_absence_days` | int | 3 | `get_attendance_flags` |
| `early_departure_days` | int | 3 | `get_attendance_flags` |
| `abnormal_ot_hour_threshold` | decimal | 4.5 | `get_attendance_ot_analysis` |
| `abnormal_ot_day_threshold` | int | 36 | `get_attendance_ot_analysis` |
| `ot_wage_threshold` | int | 4000 | `get_attendance_ot_analysis` |
| `daily_work_hour_limit` | int | 12 | `get_attendance_break_compliance` |
| `dinner_break_window` | string | "17:00-19:00" | `get_attendance_break_compliance` |
| `dinner_break_min_duration_min` | int | 30 | `get_attendance_break_compliance` |
| `ot_dinner_break_cutoff` | string | "21:00" | `get_attendance_break_compliance` |

---

## 6. Leave Insights [DESIGNED — DEFERRED, partially IMPLEMENTED]

### 6.1 Module Summary

| | |
|---|---|
| **Page** | leave |
| **Tools** | 7 page-specific |
| **Patterns** | 13 CORE + 1 EXPLORE |
| **Settings dependencies** | 2 configurable values |
| **Story** | 4.3 (47 tests after review, code-complete, then removed) |
| **Partial implementation** | `pattern-detection.service.ts` implements holiday-adjacent leave flagging [IMPLEMENTED] |

### 6.2 Tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_leave_snapshot` | KPIs, distributions, utilization, balance health | `thresholds`, `kpis` (8 metrics), `self_service_pct`/`manual_entry_pct`, `type_distribution`, `status_distribution`, `department_utilization`, `balance_health` |
| `get_leave_balance_analysis` | Per-dept and per-type balance health | `by_department`, `by_leave_type` (avg, sigma, thresholds, outliers — AL subtypes combined), `expiring_soon`, `exhausted_employees`, `hourly_leave_summary` |
| `get_leave_utilization_analysis` | Statistical outliers, correlations | `outlier_summary`, `per_leave_type`, `ot_correlation` (cross-module), `burnout_correlation` (cross-module), `mc_clustering` |
| `get_leave_patterns` | Adjacent holidays, coverage risk, lead time | `adjacent_holiday` (flagged employees), `monthly_trends`, `coverage_risk` (14 days), `lead_time_analysis` (5 buckets), `day_of_week_distribution` |
| `get_leave_upcoming` | Forward-looking coverage, pending urgency | `upcoming_by_department` (per dept+date), `pending_applications` (overdue 7d/14d, imminent 3d/7d) |
| `get_leave_employee_details` | Per-employee leave data | PII-stripped, 25-row limit, 10 filter params, per-type balances with outlier classification, adjacent_holiday_count, burnout_flag |
| `get_leave_application_health` | Workflow health metrics | `rejection_analysis` (by dept, flag >2x avg), `portal_adoption` (source='EL'), `approval_turnaround` (avg/median, flag >3 days) |

### 6.3 Briefing Design

7 flag conditions:

| Flag | Condition |
|------|-----------|
| High pending | >10 pending applications |
| Overdue pending | >3 pending applications overdue >7 days |
| Imminent pending | Any pending application starting within 3 days |
| Coverage risk | Any department >30% on leave within 14 days |
| Expiring credits | >5 employees with expiring leave credits |
| Low utilization | Any department with utilization <30% |
| High rejection | Any department with rejection rate >2x company average |

### 6.4 Pattern Checklist (13 CORE + 1 EXPLORE)

**CORE:**

| Code | Pattern | Notes |
|------|---------|-------|
| NEG-A5 | Credits Expiring | — |
| NEG-R4 | Team Coverage Risk | — |
| NEG-R6 | Leave Pattern Abuse | — |
| NEG-R11 | MC Frequency Clustering | — |
| NEG-R12 | Chronically Short Lead Time | — |
| NEG-I6 | Low Utilization + Elevated OT | — |
| NEG-AL6 | Balance Exhausted | — |
| NEG-W3 | Applications Unanswered | — |
| NEG-W6 | Disproportionate Rejection | — |
| NEG-P3 | High Leave Post-Burnout | — |
| POS-T3 | Healthy Utilization | — |
| POS-O4 | Unused Leave Nudge | — |
| POS-O5 | High Portal Adoption | — |

**Deferred CORE:**

| Code | Pattern | Notes |
|------|---------|-------|
| NEG-P5 | Leave Demand Forecast | PHASE-2 deferred |

**EXPLORE:**

| Code | Pattern |
|------|---------|
| — | Expired Credits Forfeiture |

### 6.5 Mandatory Tool Sequence

1. `get_cross_module_flags` *(shared)*
2. `get_leave_snapshot`
3. `get_leave_balance_analysis`
4. `get_leave_utilization_analysis`
5. `get_leave_patterns`
6. `get_leave_upcoming`
7. *(optional)* `get_leave_application_health`
8. *(optional)* `get_leave_employee_details`

### 6.6 Settings Dependencies (2 values)

| Setting Key | Type | Default | Used By |
|-------------|------|---------|---------|
| `leave_abuse_threshold` | int | 3 | `get_leave_patterns`, pattern detection service |
| `adjacent_holiday_days` | int | 2 | `get_leave_patterns`, pattern detection service |

### 6.7 AL Subtype Combination Rule

All `leave_type.startsWith('AL')` rows are combined into "Annual Leave (Combined)" per the `LeaveUtilizationService` pattern. This applies across balance analysis and utilization tools.

---

## 7. Performance Insights [DESIGNED — DEFERRED]

### 7.1 Module Summary

| | |
|---|---|
| **Page** | performance |
| **Tools** | 6 page-specific |
| **Patterns** | 15 CORE, 0 EXPLORE |
| **Settings dependencies** | 7 configurable values |
| **Story** | 4.4 (121 tests after 3 review rounds, code-complete, then removed) |

### 7.2 Tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_performance_snapshot` | KPIs, distributions, validation pipeline, velocity | `settings` (7 thresholds), `kpis` (11 fields), `score_distribution` (10 buckets), `status_breakdown`, `validation_status` (aging buckets), `acknowledgement_status`, `completion_velocity`, `year_range` |
| `get_performance_department_comparison` | Department avg, spread, YoY, rater density | `departments` (per-dept stats + deviation + high/low), `prior_year_avg_score`/`yoy_change_pp`, `appraiser_count`, `employee_group_split`, `dept_score_gap_flagged` |
| `get_performance_trends` | YoY progression, improvement, movers | `yearly_data`, `improvement_tracking` (4 buckets), `first_time_vs_returning` (gap), `top_movers` (top 5 improved/declined, PII-stripped) |
| `get_performance_burnout_signals` | Burnout, driver breakdown, correlations | `burnout_flags` (by dept), `burnout_driver_breakdown`, `monthly_burnout_trend`, `performance_attendance_correlation` (score buckets), `low_score_high_absence`, `compounding_signals` |
| `get_performance_employee_details` | Per-employee appraisal data | PII-stripped, 25-row limit, 10 filter params, consecutive top/low years tracking, at-risk composite score |
| `get_performance_criteria_analysis` | Per-criterion ratings, template ecosystem | `form_templates`, `criteria_performance` (20-slot rating distribution), `weakest_criteria` (top 5), `strongest_criteria` (top 5), `dept_criteria_weakness` (top 10 by gap) |

### 7.3 Briefing Design

8 flag conditions:

| Flag | Condition |
|------|-----------|
| Low completion | <70% completion rate |
| Stale pending | Any pending appraisal >14 days |
| Validation bottleneck | Any validation queue building up |
| Low performers | >10% of appraised employees |
| Structural overload | >0 employees flagged |
| At-risk | >0 employees flagged by composite score |
| Department gap | Any department average >20pp below company average |
| Criterion weakness | Any criterion with >40% poor ratings |

### 7.4 Pattern Checklist (15 CORE)

| Code | Pattern |
|------|---------|
| NEG-I1 | Structural Overload |
| NEG-I4 | Absence + Low Score |
| NEG-I8 | First-Time Score Gap |
| NEG-I9 | Template Difficulty Disparity |
| NEG-C3 | Department Score Gap |
| NEG-C6 | Criteria Weakness |
| NEG-C7 | Permanent vs Contract Gap |
| NEG-W1 | Validation Pipeline Slowdown |
| NEG-W5 | Validation Pipeline Slowdown (variant) |
| NEG-W7 | Validation Pipeline Slowdown (variant) |
| POS-M1 | Top Performer and Succession |
| POS-M6 | Top Performer (variant) |
| POS-M2 | Score Improved YoY |
| POS-M7 | Org-Wide Competency Strengths |
| POS-T2 | Cycle Adherence |
| POS-T6 | Completion Velocity Improving |
| POS-O1 | Promotion Candidate |
| POS-AL3 | New Cycle Underway |

### 7.5 Mandatory Tool Sequence

1. `get_cross_module_flags` *(shared)*
2. `get_performance_snapshot`
3. `get_performance_department_comparison`
4. `get_performance_trends`
5. `get_performance_burnout_signals`
6. `get_performance_criteria_analysis`
7. *(optional)* `get_performance_employee_details`

### 7.6 Settings Dependencies (7 values)

| Setting Key | Type | Default | Used By |
|-------------|------|---------|---------|
| `top_performer_threshold` | decimal | 0.85 | Score classification |
| `low_performer_threshold` | decimal | 0.6 | Score classification |
| `poor_appraisal_threshold` | decimal | 0.625 | At-risk scoring |
| `atrisk_weight_warning` | decimal | 0.5 | At-risk composite formula |
| `atrisk_weight_appraisal` | decimal | 0.3 | At-risk composite formula |
| `atrisk_weight_combined` | decimal | 0.2 | At-risk composite formula |
| `atrisk_threshold` | decimal | 0.3 | At-risk flagging cutoff |

### 7.7 Rating System

`RATING_MULTIPLIERS = [0.00, 0.35, 0.70, 1.00]` mapping rating values 0–3 (Poor / Fair / Good / Excellent).

Formula: `final_score = SUM(rating_multiplier_i x weight_i) / SUM(weight_i) x 100`

---

## 8. Disciplinary Insights [DESIGNED — DEFERRED]

### 8.1 Module Summary

| | |
|---|---|
| **Page** | disciplinary |
| **Tools** | 6 page-specific |
| **Patterns** | 17 CORE + 2 EXPLORE |
| **Settings dependencies** | 5 configurable values |
| **Story** | 4.5 (272 tests total, 3 review rounds, code-complete, then removed) |

### 8.2 Tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_disciplinary_snapshot` | KPIs, distributions, coaching lifecycle | 10 sections: `kpis`, `by_stage` (6 stages), `by_offense_category`, `by_department`, `by_status`, `coaching_lifecycle`, `rejection_overview`, `issuer_distribution`, `filing_lag`, `settings` |
| `get_disciplinary_trends` | Monthly volumes, escalation velocity, seasonal | `monthly_data`, `analysis`, `escalation_velocity` (avg days between stages, rapid escalation), `volume_trend`, `pending_approval_age`, `seasonal_patterns`, `coaching_resolution_trend`, `rejection_trend` |
| `get_disciplinary_repeat_offenders` | Repeat offense, at-risk scoring, cross-module | `at_risk_scoring`, `repeat_offense`, `escalation_pattern`, `unresolved_coaching`, `at_risk_summary`, `category_switching`, `post_coaching_recurrence`, `attendance_correlation` (cross-module), `post_warning_mc` (cross-module MC spike) |
| `get_disciplinary_department_comparison` | Per-dept comparison, manager effectiveness | `departments`, `company_averages`, `company_median_warnings_per_capita`, `manager_effectiveness` (flagged if ratio >2.0), `coaching_resolved_30d`, `flag_thresholds` |
| `get_disciplinary_workflow_health` | Process health metrics | `rejection_analysis` (by dept, issuer_role, top reasons), `filing_lag` (avg/median/p90, by dept), `approval_turnaround` (completed + pending metrics), `coaching_resolution` (stagnant >90d), `stage6_outcomes` (termination cases, DI split) |
| `get_disciplinary_employee_details` | Per-employee drill-down | PII-stripped, 25-row limit, 4 boolean filters, at-risk composite scoring, cross-module: `attendance_issues`, `mc_leave_count_ytd`, `latest_appraisal_score`, `employment_status` |

### 8.3 Stage Name Mapping

| Internal Stage | Display Label |
|----------------|---------------|
| `retraining` | Coaching |
| `show_cause` | Show Cause Letter |
| `warning_1` | 1st Warning |
| `warning_2` | 2nd Warning |
| `warning_3` | 3rd Warning |
| `termination` | Termination / DI |

Extracted into `shared/constants.ts` as `STAGE_DISPLAY_LABELS` for reuse by probation.

### 8.4 Briefing Design

9 flag conditions:

| Flag | Condition |
|------|-----------|
| High pending | >3 pending cases |
| Stale pending | Any pending case >14 days |
| Rapid escalation | >30% escalation rate |
| At-risk | >0 employees flagged by composite score |
| Volume increasing | 3 consecutive months of increasing volume |
| Unresolved coaching + new warning | Any employee with both |
| Single issuer dominance | Any single issuer >40% of all cases |
| Filing lag | Average >14 days |
| Low coaching resolution | <50% resolution rate |

### 8.5 Pattern Checklist (17 CORE + 2 EXPLORE)

**Original CORE (8):**

| Code | Pattern |
|------|---------|
| NEG-I2 | Escalation Pattern |
| NEG-I3 | Repeat Offense Category |
| NEG-AL5 | Unresolved Coaching + New Warning |
| NEG-C2 | Team Warning Rate Disparity |
| NEG-W2 | Warning Approvals Stuck |
| POS-M5 | Coaching Resolved |
| POS-T4 | Volume Declining |
| POS-AL2 | At-Risk Cleared |

**New CORE (6):**

| Code | Pattern |
|------|---------|
| NEG-Q1 | Filing Quality |
| NEG-Q2 | Documentation Delay |
| NEG-R14 | Coaching Stagnation |
| NEG-I5 | Broadening Misconduct |
| NEG-R15 | Post-Coaching Recidivism |
| POS-M6 | Quick Coaching Resolution |

**Sensitivity-Gated CORE (3):**

| Code | Pattern | Gate Rule |
|------|---------|-----------|
| NEG-C3 | Issuer Concentration | >40%. Must frame as potential bias, understaffing, or one manager doing all work. |
| NEG-I4 | Attendance-Disciplinary Mismatch | Surfaces only when validation_rate <50%. |
| NEG-P6 | Post-Warning Stress Signal | MC spike >50% in 90 days post-warning. Framed as organizational concern, not individual blame. |

Data is always computed for sensitivity-gated patterns, but the prompt gates surfacing. The agent must frame findings neutrally.

**EXPLORE (2):**

| Code | Pattern |
|------|---------|
| — | Seasonal Warning Patterns |
| — | Attendance Validation |

### 8.6 Mandatory Tool Sequence

1. `get_cross_module_flags` *(shared)*
2. `get_disciplinary_snapshot`
3. `get_disciplinary_trends`
4. `get_disciplinary_repeat_offenders`
5. `get_disciplinary_department_comparison`
6. `get_disciplinary_workflow_health`
7. *(optional)* `get_disciplinary_employee_details`

### 8.7 Settings Dependencies (5 values)

| Setting Key | Type | Default | Used By |
|-------------|------|---------|---------|
| `atrisk_weight_warning` | decimal | 0.5 | At-risk composite formula |
| `atrisk_weight_appraisal` | decimal | 0.3 | At-risk composite formula |
| `atrisk_weight_combined` | decimal | 0.2 | At-risk composite formula |
| `atrisk_threshold` | decimal | 0.3 | At-risk flagging cutoff |
| `poor_appraisal_threshold` | decimal | 0.625 | At-risk appraisal factor |

---

## 9. Probation Insights [DESIGNED — DEFERRED]

### 9.1 Module Summary

| | |
|---|---|
| **Page** | probation |
| **Tools** | 4 page-specific |
| **Patterns** | 10 CORE, 0 EXPLORE |
| **Settings dependencies** | 5 configurable values (same as Disciplinary) |
| **Story** | 4.6 (89 backend + 48 frontend tests, 2 review rounds, code-complete, then removed) |
| **Cost** | Most cost-efficient page (4–5 turns, ~$0.12–0.18) |

### 9.2 Tools

| Tool | Description | Key Data Returned |
|------|-------------|-------------------|
| `get_probation_snapshot` | Status counts, overdue detail, upcoming, disciplinary overlay | `probation_settings`, `counts` (just_join/mid_way/overdue/closed), `by_action`, `by_department`, `overdue_detail`, `upcoming_end_30d`, `upcoming_end_60d`, `completion_rate`, `disciplinary_overlay` (with_warnings, with_active_coaching, at_risk, by_department) |
| `get_probation_trends` | Monthly activity, outcome-warning correlation | `monthly_activity` (N months), `probation_cohort`, `outcome_distribution`, `outcome_warning_correlation`, `warnings_during_probation` (by_stage, top_offense_categories) |
| `get_probation_employee_details` | Per-employee drill-down with disciplinary context | PII-stripped, 25-row limit, 6 filter params (department, status, action, expiring_within_days, has_warnings, sort_by), warning_count, highest_stage, at_risk_score |
| `get_probation_disciplinary_risk` | Probation-vs-tenured comparison, onboarding risk | `probation_warning_incidence` (risk_ratio), `dept_onboarding_risk` (flagged if ratio >2.0), `offense_profile_comparison` (during vs post), `time_to_first_warning` (median, by dept), `active_dual_risk` |

### 9.3 Probation Status Computation (SCP-118)

Probation status is **computed at query time**, not stored:

```sql
CASE
  WHEN rt.action IS NOT NULL THEN 'Closed'
  WHEN CURRENT_DATE > rt.probation_end_date THEN 'Overdue'
  WHEN CURRENT_DATE >= rt.join_date + ((rt.probation_end_date - rt.join_date) / 2)
    THEN 'Mid Way'
  ELSE 'Just Join'
END AS status
```

### 9.4 Briefing Design

7 flag conditions:

| Flag | Condition |
|------|-----------|
| Overdue | >0 overdue probation periods |
| Long overdue | Any overdue >30 days |
| Upcoming | Any probation ending within 30 days |
| Mid-review | Any mid-way probation with review due within 14 days |
| Probationers with warnings | >0 probationers with active warnings |
| Probationers at-risk | >0 probationers flagged by composite score |
| Department onboarding risk | Any department with risk_ratio >2.0 |

### 9.5 Pattern Checklist (10 CORE)

| Code | Pattern |
|------|---------|
| NEG-R7 | Probation Overdue |
| NEG-R8 | End Approaching |
| NEG-C8 | Period Variation |
| POS-M3 | Successfully Completed |
| POS-O3 | High Performer on Probation |
| NEG-PD1 | Under Disciplinary Action |
| NEG-PD2 | Department Onboarding Risk |
| NEG-PD3 | Rapid First Warning |
| NEG-PD4 | Warning-Correlated Termination |
| POS-PD5 | Clean Probation Completion |

### 9.6 Mandatory Tool Sequence

1. `get_cross_module_flags` *(shared)*
2. `get_probation_snapshot`
3. `get_probation_trends`
4. `get_probation_disciplinary_risk`
5. *(optional)* `get_probation_employee_details`

### 9.7 Settings Dependencies (5 values)

Same at-risk settings as Disciplinary (§8.7).

---

## 10. Cross-Module Shared Tool [DESIGNED — DEFERRED]

### `get_cross_module_flags`

| | |
|---|---|
| **Location** | `shared/cross-module.tools.ts` |
| **Registered in** | Every domain's MCP server |
| **Called** | First tool in every investigation protocol |
| **Returns** | Last upload date, data freshness, at-risk employee count, pending warnings count |
| **Origin** | Net-new (no pilot reference). Spec in `docs/ai-insight/ai-insight-tooling.md`. |

### `get_employee_details` (Workforce, reused)

| | |
|---|---|
| **Source** | `workforce/workforce.tools.ts` |
| **Reused by** | All 6 domain MCP servers import and register it |
| **Returns** | PII-stripped employee-level data, hard limit 25 rows |
| **Usage** | Optional tool — only called when prior tools reveal specific individuals to drill into |

### At-Risk Composite Scoring Formula

Used by Performance, Disciplinary, and Probation tools:

```
at_risk_score = (warning_factor x weight_warning)
             + (appraisal_factor x weight_appraisal)
             + (coaching_factor x weight_combined)
```

| Factor | Value = 1.0 when | Value = 0.0 when |
|--------|------------------|------------------|
| `warning_factor` | ANY approved warning at stage `warning_1`/`warning_2`/`warning_3` (stages 3–5) | No approved warnings at those stages |
| `appraisal_factor` | `final_score < poor_appraisal_threshold x 100` | Score at or above threshold |
| `coaching_factor` | 2+ distinct offense categories in active coaching (stage 1, `resolved_at IS NULL`) | Fewer than 2 categories |

Flagged when `at_risk_score x 100 >= atrisk_threshold x 100`.

**CRITICAL:** Use `warning_1`/`warning_2`/`warning_3` (stages 3–5) for `warning_factor`, NOT `final_warning` (HIGH-001 from Story 4.4 code review).

---

## 11. Settings & Thresholds [IMPLEMENTED]

This section covers the settings system that **remains in the codebase** after the Epic 4 deferral.

### 11.1 Alert Categories (10 visible + 1 hidden)

| # | Sidebar Label | Category Key | Fields | Default Values |
|---|--------------|--------------|--------|----------------|
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
| — | *(hidden)* | `alert_payroll_variance` | `payroll_variance_threshold` (int) | 15 |

**Total:** 10 visible categories, 24+ configurable fields across all categories. The hidden `alert_payroll_variance` category is excluded from the sidebar and API responses (Story 1.13 deferred).

### 11.2 Settings CRUD API

| Method | Path | Purpose | Access |
|--------|------|---------|--------|
| GET | `/api/v1/hr/settings` | All visible settings grouped by category | Superadmin only |
| PUT | `/api/v1/hr/settings/:category` | Update settings for a category with audit trail | Superadmin only |

**Model:** `hr-settings.model.ts` — `getAll()`, `getByCategory()`, `updateCategory()`, `resetCategory()`.

### 11.3 Settings Utilities

```typescript
getSettingInt(category, key)     -> Promise<number | null>
getSettingDecimal(category, key) -> Promise<number | null>
getSettingString(category, key)  -> Promise<string | null>
parseTimeToMinutes(timeStr)      -> number  // '17:00' -> 1020
```

### 11.4 Settings UI Pages [IMPLEMENTED]

11 stub pages at `code/frontend/src/app/(dashboard)/settings/insights/`:

- `leave-pattern/page.tsx`
- `chronic-lateness/page.tsx`
- `high-absence/page.tsx`
- `break-compliance/page.tsx`
- `labor-compliance/page.tsx`
- `abnormal-ot/page.tsx`
- `at-risk/page.tsx`
- `early-departure/page.tsx`
- `leave-utilization/page.tsx`
- `appraisal-analytics/page.tsx`
- `ot-wage-threshold/page.tsx`

### 11.5 Settings Sidebar [IMPLEMENTED]

11 insight items + 3 data management items in the sidebar navigation.

### 11.6 Pattern Detection Service [IMPLEMENTED]

**Location:** `code/backend/src/modules/hr/services/pattern-detection.service.ts`

**Class:** `PatternDetectionService`

Two detection features that run as algorithmic checks (no LLM involved):

**1. Chronic Lateness** (`detectChronicLateness`):
- Queries `attendance_list` for employees with `lateness > 0` count exceeding threshold
- Threshold from `hr_settings` (`alert_chronic_lateness.chronic_lateness_threshold`, default 3)
- Groups by employee_code, filters by period (YYYYMM format) and department
- Supports RBAC scope filter via `buildScopeFilterSql()`
- Returns `{ flagged_count, employees[], threshold, period }`

**2. Holiday-Adjacent Leave Pattern** (two modes):
- **Mode 1 (Sync-time)** — `flagLeavesForSync()`: Flags ALL leave transactions during data sync. Updates `leave_transaction` records with `is_adjacent_holiday`, `adjacent_holiday_name`, `days_from_holiday`.
- **Mode 2 (Dashboard)** — `getLeavePatternAlerts()`: Queries pre-computed flags. Only APPROVED leaves count toward abuse flag. Uses `leave_abuse_threshold` (default 3) and `adjacent_holiday_days` (default 2) from settings.
- `computeAdjacentHolidayFlag()`: Calculates business days between leave date and holidays, flags if within threshold.
- `backfillAdjacentHolidayFlags()`: One-time historical backfill in batches of 500.

### 11.7 Test Coverage

- **Backend:** 802 tests (Story 1.11a)
- **Frontend:** 282 tests (Story 1.11a)

---

## 12. Output Schema [DESIGNED — DEFERRED]

### 12.1 InsightResult / Finding Types

The E2E tests (`ai-insight-parity.spec.ts`) define the production schema:

```typescript
// InsightResult (from SSE complete or /latest cache)
{
  insights: Finding[]       // flat array
  metadata: InsightMetadata
}

// Finding
{
  title: string             // e.g. "Warehouse turnover reached 31%"
  severity: 'high' | 'medium' | 'low' | 'info'
  summary: string           // 1-line summary
  detail_bullets: string[]  // array of bullet points
  recommendation?: string   // ABSENT for severity='info'
}

// InsightMetadata
{
  generated_at: string      // ISO timestamp
  model: string             // 'claude-sonnet-4-6'
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  duration_ms: number
  turns: number
}
```

### 12.2 Key Schema Rules (from E2E parity spec)

- The field is `insights[]` (flat array), NOT `negative_insights[]` + `positive_insights[]` (which was the Story 4.1 prompt design — superseded by the parity spec)
- Finding must NOT have `type` or `detail` fields (E2E asserts `'type' in insight` is falsy, `'detail' in insight` is falsy)
- `info` severity findings must NOT have `recommendation` (E2E: `if (insight.severity === 'info') expect(Boolean(insight.recommendation)).toBeFalsy()`)

### 12.3 Severity Levels

| Level | Meaning | Card Color |
|-------|---------|------------|
| `high` | Critical issues requiring immediate action | Dark red bg, white text |
| `medium` | Notable concerns worth monitoring | Dark red bg, white text |
| `low` | Minor observations | Dark red bg, white text |
| `info` | Positive findings or neutral observations. No recommendation field. | Teal bg, white text |

### 12.4 JSON Parsing (`parseAgentOutput`)

Exported from `service.ts`:

1. Strip `` ```json ... ``` `` markdown fences
2. `JSON.parse()`
3. Validate against InsightResult shape (has `insights[]` array)
4. Each finding must have: `title`, `severity`, `summary`, `detail_bullets`
5. Fallback to error state if malformed

### 12.5 Partial Result Recovery

When `maxTurns` or `maxBudgetUsd` is hit (result subtype `error_max_turns` / `error_max_budget_usd`):

1. Walk prior `SDKAssistantMessage` entries for text content blocks
2. Attempt `parseAgentOutput()` on the last text block
3. If valid: return with metadata note "Analysis was cut short due to resource limits"
4. If invalid: return error "Analysis timed out, please retry"

### 12.6 Contrast with Finance Output Format

> See §12 of 10-ai-insight-base.md for the base delimiter format.

The Finance output uses a `===INSIGHT===` delimiter format parsed into `{ good: Insight[], bad: Insight[] }` with fields: `title`, `metric`, `summary`, `detail`. HR uses a flat JSON `insights[]` array with fields: `title`, `severity`, `summary`, `detail_bullets`, optional `recommendation`. The two schemas are structurally different and do not share parsing logic.

---

## 13. Frontend Components [DESIGNED — DEFERRED]

### 13.1 AIInsightPanel

- Container component: generate/cancel button, grouped sections, metadata footer
- Prop: `endpoint` (e.g. `"/workforce/insights"` — hook prepends `/hr/ai-insight`)
- On mount: calls `GET /latest` to check cache
- Generate button triggers SSE stream via `useAIInsightGenerate` hook
- Regenerate action shows confirmation dialog before overwriting cache
- RBAC: hidden for `sale`/`operation` roles via `canViewInsights = userRole !== 'sale' && userRole !== 'operation'` (uses `user.role` directly, NOT `hasRole()` — `hasRole()` returns true for superadmin for any check)

### 13.2 Panel Layout

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

Note: CR-15 resolved that the Agent SDK does NOT expose per-message token counts. Metadata footer shows turns count instead when tokens are zero.

### 13.3 AIInsightCard

- Clickable card with colored background
- **Negative insights:** dark red bg + white text (`bgcolor: '#d32f2f'`, `color: '#fff'`)
- **Positive insights:** teal bg + white text (`bgcolor: '#00796b'`, `color: '#fff'`)
- Severity icon: `tabler-alert-triangle` (high/critical), `tabler-info-circle` (medium/low)
- Dark bg + white text contrast rule (NEVER pastel)
- `tabler-sparkles` icon in panel header

### 13.4 AIInsightModal

3 accordion sections (arrow on LEFT via `flexDirection: 'row-reverse'` + `ml: 1`):

1. **Detail Analysis** — `finding.detail_bullets` rendered as list items
2. **Evidence** — `finding.evidence_table` rendered as MUI Table if present; text fallback if absent. Schema: `{ headers: string[], rows: (string|number)[][] }`
3. **Recommendation** — `finding.recommendation` in callout Box. Hidden for `severity === 'info'`.

### 13.5 AIInsightLoading

- Live SSE progress step list with checkmarks
- Shows tool call names as they occur (e.g. "fetching workforce snapshot", "analyzing department breakdown")

### 13.6 useAIInsightGenerate Hook

Uses `fetch()` + `ReadableStream` (NOT `EventSource` — browser EventSource API does not support POST and auto-retries on disconnect which would trigger duplicate generations):

```typescript
const response = await fetch(endpoint + '/generate', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  signal: abortController.signal,
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  // Parse SSE "data: {...}\n\n" lines from buffer
}
```

### 13.7 Frontend Types

Single source of truth: `components/hr/ai-insight/types.ts` (CR-21 fix — eliminated duplicate type definitions between backend `shared/types.ts` and frontend hook).

### 13.8 Settings Pages [IMPLEMENTED]

11 stub pages exist in the codebase (see §11.4). These are the only frontend components that survived the Epic 4 deferral.

---

## 14. API Endpoints [DESIGNED — DEFERRED]

### 14.1 Endpoint Pattern (18 total: 3 per module)

Each of the 6 modules registers 3 endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/hr/ai-insight/{module}/insights/generate` | SSE endpoint, streams events |
| GET | `/api/v1/hr/ai-insight/{module}/insights/latest` | Returns cached result or `{ cached: false }` |
| GET | `/api/v1/hr/ai-insight/{module}/insights/status` | Returns `{ generating, queuePosition? }` |

Where `{module}` is one of: `workforce`, `attendance`, `leave`, `performance`, `disciplinary`, `probation`.

All routes mounted under `/ai-insight` sub-router in `hr.routes.ts` with middleware chain: `authenticate` -> `attachAbility` -> `canReadHR`.

### 14.2 SSE Event Types

| Event | Payload | When |
|-------|---------|------|
| `progress` | `{ type: "progress", step: "tool_call", tool: "get_workforce_snapshot" }` | Per-tool-call status update |
| `progress` | `{ type: "progress", step: "briefing", message: "Preparing data briefing..." }` | Briefing preparation |
| `complete` | `{ type: "complete", data: { insights: [...], metadata: {...} } }` | Analysis finished successfully |
| `error` | `{ type: "error", message: "Access denied" }` | Unrecoverable error |

SSE is delivered via POST response using `res.setHeader('Content-Type', 'text/event-stream')`. Progress events are fired via `PreToolUse` hooks during generation.

### 14.3 Response Schema (from E2E tests)

**`/latest` when cached:**
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

**`/latest` when not cached:**
```json
{ "cached": false }
```

### 14.4 RBAC on Endpoints

- RBAC check: call `getDataScopeFilter(scopeContext)`. If returns `'deny'`, send SSE error event and end response.
- `AbortController` wired to `req.on('close')` for cancel support.

---

## 15. Quality Guardrails [DESIGNED — DEFERRED]

### 15.1 Three-Layer Quality Model

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
| Prompt | Severity ordering | critical, high, medium, low — then by employee count |
| Prompt | Depth guidance | "Aim 5-8 insights, cite specific numbers, depth > breadth" |

### 15.2 PII Filter (29 fields)

**Location:** `shared/pii-filter.ts` — `stripPii()`, `stripPiiFromRows()`

29 sensitive fields stripped (updated from 26 to 29 per CR-10):
- Names, employee codes, IC/passport numbers, emails, phone numbers, addresses, salary figures

**Security boundary:** PII must NEVER be sent to external LLM providers (NFR-HR-SEC-04). A failing PII audit blocks generation. Applied to all `get_*_employee_details` tool responses before data reaches the model.

### 15.3 RBAC Scope Matrix (4 roles)

| Role | Scope | AI Insight Access |
|------|-------|-------------------|
| Superadmin / HR / Director | All employees (`scopeFilter = null`) | Full access |
| Finance | Own department only | Department-scoped insights |
| Manager | Own dept + direct reports | Team-scoped insights |
| Sale / Operation | Denied (`scopeFilter = 'deny'`) | No insight panel shown, 403 from API |

- **Server-side:** CASL ability layer returns 403 for `sale`/`operation` users
- **Client-side:** Panel not rendered via `canViewInsights` guard
- **Scope filter cannot be overridden by the model:** `buildScopeWhere()` is applied in the tool closure, not passed as a parameter the model could modify

### 15.4 Cost Model

| Domain | Lean | Normal | Max |
|--------|------|--------|-----|
| Workforce | ~$0.10–0.15 (4 calls) | ~$0.18–0.25 (5–6 calls) | ~$0.30 |
| Attendance | ~$0.15–0.20 (6 calls) | ~$0.20–0.28 (7 calls) | ~$0.30 |
| Leave | ~$0.15–0.20 (6 calls) | ~$0.20–0.28 (7 calls) | ~$0.30 |
| Performance | ~$0.15–0.20 (6 calls) | ~$0.20–0.28 (7 calls) | ~$0.30 |
| Disciplinary | ~$0.15–0.22 (6 calls) | ~$0.20–0.28 (7 calls) | ~$0.30 |
| Probation | ~$0.08–0.12 (4 calls) | ~$0.12–0.18 (5 calls) | ~$0.18–0.22 |

Expected average across all domains: **$0.15–0.25** per generation. 24-hour per-user cache minimizes repeat cost.

### 15.5 Output Determinism

SDK v0.2.63 does NOT support `temperature`. Prompt discipline is the primary lever. Expected ~70% consistency across runs.

**Fallback if <70% consistency:** Swap to raw `@anthropic-ai/sdk` with `messages.create({ temperature: 0 })` + manual tool loop. Reference: `spike/ai-insight/src/service.ts` (230 lines).

---

## 16. Concurrency, Caching & Logging [DESIGNED — DEFERRED]

### 16.1 Cache Strategy

| Property | Value |
|----------|-------|
| Type | Per-user, per-module, in-memory `Map` |
| Key | `${userId}:${module}` (changed from `userId` only in Story 4.2) |
| TTL | 24 hours |
| Cleanup | Periodic `setInterval` with `.unref()` (CR-22 fix) |
| Process lifecycle | `SIGTERM`/`SIGINT` handlers call `insightCache.destroy()` (CR-9 fix) |
| Persistence | NOT persisted to database — intentional. Insights are derivative of live data. |
| Restart behavior | Cache lost on server restart. First request triggers fresh generation. |

### 16.2 Concurrency Handling

| Property | Value |
|----------|-------|
| Limit | 1 active generation per user (across ALL modules, not per-module) |
| Behavior | Additional requests rejected with error (not queued — CR-2 removed dead queue code) |
| Cancel support | `AbortController` wired to `req.on('close')` |
| Check | `isGenerating(userId)` checks `activeGenerations` Map keyed by `userId` only |

### 16.3 Structured Audit Logging

**Location:** `insight-logger.ts`

Logged per generation:
- Briefing payload
- Every tool call and response
- PII-check pass/fail
- Cost metadata (tokens in/out, dollar cost, elapsed time)
- Module field (parameterized from Story 4.2 onward)

Requirement: FR-HR-AI-09.

---

## 17. OpenAI Salary Benchmarking Service [IMPLEMENTED — THEN REMOVED]

This is a **separate** feature from Epic 4. It provides salary benchmarking using the OpenAI API. It was implemented (Story 1.16, 38 tests, live API verified), then removed along with the Epic 4 code.

### 17.1 Architecture

| Property | Value |
|----------|-------|
| Package | `openai@4.77.0` |
| Model | `gpt-4o-mini` (configurable via `OPENAI_MODEL` env var) |
| Location | `code/backend/src/common/services/openai.service.ts` |
| Temperature | 0.2 (low for factual accuracy) |
| Timeout | 30,000 ms |

### 17.2 Schema

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

### 17.3 Response Validation (Zod)

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

### 17.4 Circuit Breaker

Using `opossum` library:

| Parameter | Value |
|-----------|-------|
| `timeout` | 30,000 ms |
| `errorThresholdPercentage` | 50% |
| `resetTimeout` | 60,000 ms |
| `volumeThreshold` | 3 |

### 17.5 Error Handling

| Error Type | Strategy |
|------------|----------|
| Timeout (30s) | Return empty, log error |
| Rate Limited (429) | Exponential backoff: 1s, 2s, 4s (max 3 retries) |
| API Error (5XX) | Log error, return empty |
| Invalid API Key | Log warning, return empty |
| Invalid Response | Validate with Zod, return cached data on failure |
| Circuit Open | Return cached data, log warning |

### 17.6 PII Protection

**NEVER send to OpenAI:** Employee names, codes, IDs, actual salary data, IC numbers, phone numbers, emails, any PII.

**ONLY send:** Job titles (sanitized) + Country (hardcoded to "Malaysia" in system prompt).

Input sanitizer (`openai.sanitizer.ts`): PII detection for IC numbers, emails, phone numbers, employee codes; injection character removal.

### 17.7 Cache

Results cached to `hr_salary_benchmarks` table with `fetched_at` + `expires_at` (default 30 days). Manual refresh via button always fetches fresh. Auto-refresh when `expires_at` passed and user views benchmark table.

### 17.8 System Prompt

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

### 17.9 Files

| File | Purpose |
|------|---------|
| `openai.service.ts` | Main service class |
| `openai.config.ts` | Configuration constants |
| `openai.prompts.ts` | System prompts |
| `openai.sanitizer.ts` | Input sanitization |
| `openai-response.validator.ts` | Zod schemas |
| `openai.service.test.ts` | 38 unit tests |
| `verify-openai-service.ts` | Live verification script |

---

## 18. Known Limitations & Gaps

### 18.1 What Is Not Built

- No database persistence for insight results (in-memory cache only)
- No numeric guard / hallucination prevention (relies on prompt discipline)
- No dual-model strategy (single model per generation)
- No per-component analysis phase (briefing system replaces component fetchers)
- No budget approval flow (Finance-only feature)

### 18.2 QA Gate Architecture Mismatch

The QA gate (`epic4-ai-insights-gate-20260120.yml`) contains 156 scenarios across 8 stories (4.1–4.8 in gate numbering). It was created on 2026-01-20 and reflects the **pre-pivot architecture**: hybrid local algorithms (`simple-statistics`, `ml.js`) + OpenAI. It does NOT reflect the Claude SDK pivot. When Epic 4 un-defers, the gate must be rewritten to match the client SDK architecture.

| Gate Aspect | Pre-Pivot (Gate) | Post-Pivot (Implemented) | Client SDK (Target) |
|-------------|------------------|--------------------------|---------------------|
| Engine | `simple-statistics` + `ml.js` + OpenAI | Claude Agent SDK with MCP tools | Single `messages.create()` |
| Insight types | 25 (17 local, 1 ML, 7 LLM) | Per-domain pattern checklists | Per-domain pattern checklists |
| Latency profile | <50ms (local), <300ms (ML), 1–5s (LLM) | ~15–30s per module | TBD |
| Cost | Free (local/ML) + API cost (LLM) | $0.15–0.25 per generation | $0.15–0.25 per generation |

### 18.3 What Needs to Change When Epic 4 Un-Defers

1. **Rewrite Story 4.1 against client SDK.** Replace Agent SDK `query()` with `messages.create()`. Remove MCP tool server pattern. Move to server-side data assembly with PII stripping before prompt construction. Insight content (patterns, thresholds, RBAC) remains valid.
2. **Re-evaluate concurrency model.** Decide between per-user limit (current HR) and global singleton lock (Finance base).
3. **Re-evaluate caching model.** Decide between in-memory cache (current HR) and database-persisted results (Finance base).
4. **Rebuild QA gate.** 156 scenarios are obsolete for the Claude SDK architecture.
5. **Resolve output schema.** HR uses flat `insights[]` with `severity` and `detail_bullets`. Finance uses `{ good: Insight[], bad: Insight[] }` with `metric` and `detail`. Decide whether to converge.

### 18.4 Code Review Lessons (Systemic)

These findings were identified across adversarial code reviews of all 6 stories and should be preserved for re-implementation:

| Lesson | Source | Description |
|--------|--------|-------------|
| SQL parameterization | CR-4 (4.1) | All SQL must use `QueryParams` class with `$N` placeholders |
| Separate QueryParams per query | L-1 (4.2) | Never share params between independent queries |
| Lazy-cache settings | M-3 (4.2) | Fetch settings once per MCP server lifetime, not per-handler |
| RBAC scope in all CTEs | HIGH-001 (4.4 CR3) | Every sub-CTE must include scope + ACTIVE_JOIN |
| Use `warning_1/2/3` not `final_warning` | HIGH-001 (4.4) | At-risk scoring CTE uses stages 3–5 |
| `make_interval()` for parameterized intervals | LOW-001 (4.4) | Never use string concatenation for SQL intervals |
| Frontend RBAC: `user.role` not `hasRole()` | H-1 (4.2 CR3) | `hasRole()` returns true for superadmin for any check |
| SDK does not expose token counts | CR-6 (4.1) | Metadata footer uses turns, not tokens |
| `readFile` from `fs/promises`, never `readFileSync` | CR-18 (4.1) | All prompt loading is async |
| Pre-aggregate CTEs for O(n*m) joins | H-1 (4.5 CR3) | Replace cross-product joins with pre-aggregated monthly CTEs |
| `COUNT(*)` must cast `::int` | CR-4 (4.1) | Avoids BigInt issues in Prisma `$queryRawUnsafe` |
