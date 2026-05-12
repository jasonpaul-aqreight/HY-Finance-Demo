# HR AI Insight Module

Engine base: [10-ai-insight-base.md](./10-ai-insight-base.md)  
Companion module: [11-ai-insight-finance.md](./11-ai-insight-finance.md)

> **Status banner.** HR AI Insight fully adopts the Finance engine described in [10-ai-insight-base.md](./10-ai-insight-base.md): same orchestrator, same component/summary two-phase flow, same `===INSIGHT===` parser, same numeric guard, same singleton lock, same prompt registry, same OpenRouter gateway, same UI shell, same admin config page. The HR-specific governance layers — PII filtering, RBAC user-scoped fetching, aggregation thresholds, role/user cache-key isolation, and payroll-data governance — are explicitly **deferred** to the production team. They live in §12 *Out-of-Scope Addendum*; nothing in §§1–11 of this PRD requires them.

## 1. Purpose & User Behavior

HR AI Insight is an embedded HR analyst inside the HR dashboard. End-users (HR staff, HR managers, HR leaders, superadmin) do not type free-form questions. They click `Get Insight` on an HR section, watch the analyzing state, and read up to 3 positive and 3 negative cards plus expandable detail dialogs. Component dialogs (KPI / chart / table) explain individual surfaces.

Same user behavior as Finance:

- Click `Get Insight` → analyzing → complete (or blocked / error / cancelled).
- Click a card → detail dialog.
- Click the component Analyze Icon → component dialog with About + AI Analysis.
- Submit feedback that lands in the admin queue; admin previews a surgical edit and applies it as a new prompt version.

What changes for HR (versus Finance) is data scope and prompt content only. The engine is identical.

## 2. HR Dashboard Surface

The Hoi-Yong HR dashboard exposes these pages. AI Insight sections will be placed near the surface they explain.

| Page | Dashboard surface | AI Insight implication |
|------|-------------------|------------------------|
| Workforce | Demographics KPIs, demographic filters, donut chart, department bar chart, movement section, employee directory. | Explain headcount, department concentration, tenure, demographic mix, and movement. |
| Attendance & OT | Daily attendance, data health/upload, monthly summary, attendance/hour trends, flagged-staff tabs. | Explain attendance health, overtime, lateness, absence, break compliance, flagged patterns. |
| Leave | Leave applications, leave analysis, leave balances, upcoming leave, outliers/patterns. | Explain leave load, utilization, balances, upcoming risk, pattern flags. |
| Payroll | Placeholder / coming soon in current dashboard. | AI Insight stays disabled until payroll data contract + governance approved (see §12). |
| Performance | Year filter, KPI cards, appraisal table, score analysis, appraisal form action. | Explain appraisal completion, score distribution, departments needing attention, trend signals. |
| Disciplinary | Create record action, disciplinary KPIs, warning list, analysis charts. | Explain active warning exposure, offense patterns, repeat risk, workflow status. |
| Probation | Probation tracking, filters, table, review modal, settings tab. | Explain probation volume, upcoming reviews, overdue reviews, decision-readiness signals. |
| HR Settings | Insight threshold settings + data/operations settings. | Threshold changes invalidate affected section results — see §6 and Base §17.1. |

Placement rule: HR AI Insight appears *next to* the dashboard section it explains. There is no separate HR chatbot page.

### 2.1 Code-vs-target gap

The current codebase contains only an HR *scaffold*. Section keys, tool policies, and system prompts exist; component lists, fetchers, and section guidance bodies do not.

| Item | Code today | Production target |
|------|-----------|--------------------|
| Section keys | 5 placeholders in [prompts.ts:114-120](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L114-L120): `employee_demographics`, `attendance_leave`, `overtime_work_hours`, `payroll_compensation`, `performance_talent` | 14 finer-grained sections — §4. |
| `SECTION_COMPONENTS` (HR) | All 5 scaffold keys hold `[]` (empty arrays) | One row per HR component per section — §5. |
| `SECTION_PAGE` (HR) | Lowercase `'hr'` for all 5 keys ([prompts.ts:140-144](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L140-L144)) | Page values per the 14-section catalog (Title-Case to match Finance). |
| `DEFAULT_SECTION_GUIDANCE` (HR) | **No HR entries** at all ([prompts-defaults.ts:1057-1074](../../apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L1057-L1074)) | Empty-string default per section; admin can fill via feedback (Base §8). |
| Tool policy (HR) | `'none'` for all 5 keys with comment "no analyze pipeline yet" ([tool-policy.ts:23-30](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L23-L30)) | Per-section policy from §9 (mix of `none` / `aggregate_only` / `full`). |
| HR system prompts | Two empty seed rows: `hr_component_analysis`, `hr_summary_analysis` ([seed-defaults/route.ts:66-86](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L66-L86)) | Populated from §7 / Base §8.5. |
| Data fetchers / pre-computed values | None | One per HR component — §5 / §10. |

The implementation work in front of the production team is: register the 14 section keys, register the components per §5, write fetchers, fill component prompts, set tool policies per §9, and run the 14-step validation procedure (Base §17.1) per section. No engine changes are required.

## 3. UI Shell — References Base PRD

HR uses the same UI shell as Finance — see Base [10-ai-insight-base.md §3 (UI Shell)](./10-ai-insight-base.md#3-ui-shell--section-header-panel-cards), §4 (Panel States), §5 (Component Dialog), §9 (Feedback Lifecycle). No HR-specific UI primitives are required.

```
+----------------------------------------------------------------------------+
| Attendance & OT                                       [ Get Insight  v ]   |
| Daily attendance, monthly summary, overtime, and flagged-staff tabs.       |
+----------------------------------------------------------------------------+
| (KPI cards / charts / flagged table — each carries an Analyze Icon)        |
+----------------------------------------------------------------------------+
```

Expanded panel — identical to Finance (Base §3.2): two-column positive / negative cards, footer with scope · duration · tokens · cost · generated_by · generated_at, `Feedback` + `Get Insight` buttons on the right.

Detail dialog (Base §3.3) and component dialog (Base §5) likewise reused unmodified.

No-access state, per-row PII suppression, and aggregation messaging are **not** in the Base engine today; they sit in §12 (Out-of-Scope Addendum) as production additions.

## 4. HR Section Catalog (target)

The 14-section list below is the HR production target. Each maps to a `SECTION_COMPONENTS` entry, a `SECTION_PAGE`, a `SECTION_NAMES` entry, a tool policy in `tool-policy.ts`, and a guidance row in the prompt registry.

| # | Section key | HR page | Scope | Tool policy (§9) | Status |
|--:|-------------|---------|-------|------------------|--------|
| 1 | `workforce_demographic` | Workforce | snapshot | `aggregate_only` | Pending (scaffold only) |
| 2 | `workforce_movement` | Workforce | period | `aggregate_only` | Pending (scaffold only) |
| 3 | `attendance_daily` | Attendance & OT | snapshot (daily) | `none` | Pending (scaffold only) |
| 4 | `attendance_monthly` | Attendance & OT | period | `aggregate_only` | Pending (scaffold only) |
| 5 | `attendance_flagged` | Attendance & OT | period | `full` | Pending (scaffold only) |
| 6 | `leave_application` | Leave | period | `aggregate_only` | Pending (scaffold only) |
| 7 | `leave_analysis` | Leave | period | `full` | Pending (scaffold only) |
| 8 | `leave_balance` | Leave | snapshot | `aggregate_only` | Pending (scaffold only) |
| 9 | `performance_full` | Performance | period | `full` | Pending (scaffold only) |
| 10 | `disciplinary_records` | Disciplinary | snapshot | `aggregate_only` | Pending (scaffold only) |
| 11 | `disciplinary_analysis` | Disciplinary | period | `full` | Pending (scaffold only) |
| 12 | `probation_full` | Probation | snapshot | `aggregate_only` | Pending (scaffold only) |
| 13 | `payroll_overview` | Payroll | period | `none` | **Disabled** until payroll governance (§12) |
| 14 | `payroll_breakdown` | Payroll | period | `none` | **Disabled** until payroll governance (§12) |

### 4.1 Section questions

The summary prompt must answer these questions per section. They drive guidance and component prompts.

| Section | Main questions |
|---------|----------------|
| `workforce_demographic` | What is current headcount? Is tenure healthy? Are departments / demographic groups over-concentrated? |
| `workforce_movement` | Are joiners, leavers, or department movement changing materially? |
| `attendance_daily` | Is daily attendance normal? Are there same-day exceptions HR should review? |
| `attendance_monthly` | Are attendance, work-hours, overtime, lateness trends improving or worsening? |
| `attendance_flagged` | Which flag categories carry the highest count? Are flags concentrated by department? Are multi-flag counts increasing? |
| `leave_application` | Are leave applications, upcoming leave, or approval statuses creating coverage risk? |
| `leave_analysis` | Are leave utilization, holiday adjacency, or outlier patterns unusual? |
| `leave_balance` | Are leave balances too high, too low, or unevenly distributed? |
| `performance_full` | Is appraisal completion healthy? Are scores concentrated in specific bands / departments? |
| `disciplinary_records` | Are active warnings concentrated by stage, category, or department? |
| `disciplinary_analysis` | Are disciplinary patterns changing over time? Which categories need HR review? |
| `probation_full` | Are probation reviews overdue or approaching? Are status buckets healthy? |
| `payroll_overview` | Is payroll cost rising faster than headcount? Which departments drive cost? |
| `payroll_breakdown` | Which payroll components or departments explain cost movement? |

### 4.2 Component / data-source catalog

Each row defines one component for `SECTION_COMPONENTS`. The shape is identical to Finance ([prompts.ts §SECTION_COMPONENTS](../../apps/dashboard/src/lib/ai-insight/prompts.ts)):

```ts
{ key: string, name: string, type: 'kpi' | 'chart' | 'table' | 'breakdown' }
```

| Section | Component key | Type | Measures |
|---------|---------------|------|----------|
| `workforce_demographic` | `wf_kpis` | kpi | Total employees, active departments, average tenure. |
| `workforce_demographic` | `wf_pie_chart` | chart | Gender, nationality, age, tenure, group distribution. |
| `workforce_demographic` | `wf_dept_bar` | chart | Department headcount and demographic distribution. |
| `workforce_movement` | `wf_joiners_leavers` | chart | Joiners, leavers, movement by period and department. |
| `attendance_daily` | `att_daily_kpis` | kpi | Present, absent, on-leave, late, OT, exception counts for date. |
| `attendance_daily` | `att_daily_table` | table | Daily attendance aggregates + safe exception buckets. |
| `attendance_monthly` | `att_monthly_kpis` | kpi | Monthly attendance, absence, lateness, overtime, work-hour totals. |
| `attendance_monthly` | `att_trend_charts` | chart | Attendance trend, hours trend, OT trend. |
| `attendance_monthly` | `att_monthly_table` | table | Monthly summary by department / status / bucket. |
| `attendance_monthly` | `ot_sales_correlation` | chart | Optional safe aggregate relationship between OT and business activity. |
| `attendance_flagged` | `att_flagged_all` | table | High absence, chronic lateness, early departure, break compliance, abnormal OT flags. |
| `leave_application` | `lv_app_kpis` | kpi | Leave application counts, status mix, upcoming leave. |
| `leave_application` | `lv_upcoming_table` | table | Upcoming leave by department / date range. |
| `leave_application` | `lv_applications_table` | table | Application status aggregates. |
| `leave_analysis` | `lv_monthly_breakdown` | chart | Leave volume by month and leave type. |
| `leave_analysis` | `lv_utilization_outliers` | table | High / low utilization buckets. |
| `leave_analysis` | `lv_near_ph_patterns` | table | Leave near public holidays. |
| `leave_balance` | `lv_balance_summary` | table | Leave balances by department / type / bucket. |
| `performance_full` | `pf_kpis` | kpi | Appraisal completion, average score, score-band distribution. |
| `performance_full` | `pf_table` | table | Appraisal aggregates by department / status / band. |
| `performance_full` | `pf_charts` | chart | Score trend and score distribution. |
| `disciplinary_records` | `dc_kpis` | kpi | Active warnings, pending actions, stage counts, at-risk buckets. |
| `disciplinary_records` | `dc_warning_list` | table | Warning list summarised by category / status / stage. |
| `disciplinary_analysis` | `dc_charts` | chart | Offense-category trend, department comparison, repeat-risk buckets. |
| `probation_full` | `pb_kpis` | kpi | Probation count, upcoming reviews, overdue reviews, status mix. |
| `probation_full` | `pb_records_table` | table | Probation records summarised by status / department / review timing. |
| `payroll_overview` | `pr_total_kpis` | kpi | Total payroll cost, headcount, average cost per employee. |
| `payroll_overview` | `pr_dept_waterfall` | chart | Payroll cost by department. |
| `payroll_overview` | `pr_yoy_trend` | chart | Monthly payroll cost and YoY trend. |
| `payroll_breakdown` | `pr_component_breakdown` | breakdown | Payroll cost by component. |
| `payroll_breakdown` | `pr_cost_drivers` | table | Department + component cost drivers. |

31 HR components across 14 sections.

## 5. HR Component Prompt Rules

Component prompts follow the Finance template exactly (see [11-ai-insight-finance.md §7](./11-ai-insight-finance.md#7-prompt-inventory) and Base §8.2):

- One prompt per component key, stored in `ai_insight_prompts` with `category = 'component'`.
- Body sections: What it shows · How to read it · What to look for · Thresholds (when defined in §6) · Formula (when arithmetic is non-obvious) · Report style.
- Threshold blocks must cite the HR Settings category from §6 by name (e.g. *Thresholds: see `alert_chronic_lateness`*). Numeric values inside thresholds must come from the settings row at fetch time — the prompt itself documents the **bands**, not the values.
- Prompts must explain aggregate patterns, not individual cases.
- Use "review" / "follow up" / "monitor" language, never "terminate" / "punish" / "promote" / "approve".
- Trend rule: compare at least 3 supplied points before claiming a trend. State that trend evidence is limited when fewer than 3 points are supplied.
- Arithmetic rule (Base §13 — numeric guard row): do not re-derive totals. Every cited number must come from the fetcher's pre-computed values, the loaded threshold setting, or an approved tool result.
- Scope rule: match language to the section scope (daily / period / snapshot).

The two HR system prompts (`hr_component_analysis`, `hr_summary_analysis`) ship with empty body and must be filled before the first HR section is enabled. The shapes mirror `DEFAULT_GLOBAL_SYSTEM` and `DEFAULT_SUMMARY_SYSTEM` from Finance ([prompts-defaults.ts](../../apps/dashboard/src/lib/ai-insight/prompts-defaults.ts)), with the persona changed from "finance analyst for Hoi-Yong" to "HR analyst for Hoi-Yong".

Feedback router (`feedback_router`) and surgical editor (`surgical_editor`) are global system prompts and apply unchanged across Finance + HR — see [seed-defaults/route.ts:87-108](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L87-L108).

## 6. HR Settings & Thresholds

AI Insight must load the relevant HR Settings threshold row(s) before component analysis. Threshold values are passed *into* the fetcher's pre-computed values list, not into the prompt body — that keeps the numeric guard's `allowed[]` whitelist canonical.

| # | Settings category | Applies to | Purpose |
|--:|-------------------|------------|---------|
| 1 | `alert_chronic_lateness` | `attendance_flagged` | Chronic-lateness threshold. |
| 2 | `alert_high_absence` | `attendance_flagged` | High-absence threshold. |
| 3 | `alert_early_departure` | `attendance_flagged` | Early-departure threshold. |
| 4 | `alert_break_compliance` | `attendance_flagged` | Break-compliance violation threshold. |
| 5 | `alert_labor_compliance` | All Attendance sections | Daily work-hour limit, dinner-break window, minimum break duration, OT dinner-break cutoff. |
| 6 | `alert_abnormal_ot` | All Attendance sections | Abnormal OT hour threshold + flag-day threshold. |
| 7 | `attendance_ot` | Attendance + Payroll sections | OT-wage threshold (classifies Paid OT vs Extra Hours). |
| 8 | `alert_leave_pattern` | All Leave sections | Holiday-adjacent and suspicious-pattern threshold. |
| 9 | `alert_leave_utilization` | All Leave sections | Low + high utilization thresholds. |
| 10 | `analytics_appraisal` | `performance_full` | Appraisal score bands + completion thresholds. |
| 11 | `alert_at_risk` | All Disciplinary sections | Warning / appraisal weights + at-risk threshold. |
| 12 | `probation_review` | `probation_full` | Upcoming + overdue review windows (may live in probation_settings table). |
| 13 | `alert_payroll_variance` | All Payroll sections | Payroll variance threshold. Hidden until §12 governance signed off. |

13 threshold categories.

### 6.1 Threshold-change protocol

When a threshold row changes:

1. The HR Settings UI writes the new row with a fresh `version`/`updated_at`.
2. Any stored `ai_insight_section` result for affected sections must be re-generated before being treated as canonical. The current engine does **not** auto-invalidate (see Base §13 / Finance acceptance gate); the production team must wire the re-evaluation trigger, or rely on the admin re-running `Get Insight` after each threshold edit.
3. Acceptance: §11 requires the section to pass the validation gate again after threshold changes that move any whitelist value.

## 7. HR Output Contract

Identical to Finance and the Base engine ([10-ai-insight-base.md §7.4 Output parsing](./10-ai-insight-base.md#7-runtime-sequence--runsectionanalysis)):

```text
===INSIGHT===
sentiment: good|bad
title: Short executive title
metric: 18 staff
summary: One plain sentence for the card preview.
---DETAIL---
Detail explains the aggregate HR pattern, why it matters, what evidence supports it, what HR should review next.
===END===
```

Parser rules (Base §7.4):

- Parse every `===INSIGHT===` block into `{ good: Insight[], bad: Insight[] }`.
- Reject unknown sentiment.
- Keep at most 3 good and 3 bad cards (Base parser cap).
- Rank by business impact, not chart order.

What the prompt body must avoid (governance — enforced at prompt level, not at engine level):

- Naming or identifying employees.
- Listing employee IDs / sensitive personal data.
- Telling HR to approve / reject leave, confirm / terminate probation, discipline an employee, change pay, or change appraisal outcome.

These rules belong in the HR system prompt (§5). They are **not** a separate guard module — see §12 for the deferred privacy guard.

## 8. HR Runtime Flow

HR runs the exact same orchestrator as Finance. See Base [§7 Runtime Sequence — `runSectionAnalysis()`](./10-ai-insight-base.md#7-runtime-sequence--runsectionanalysis) for the canonical contract. In short:

1. POST `/api/ai-insight/analyze` → acquire singleton lock (`MAX_RUNTIME_MS = 5 min`, `MAX_COST_PER_SECTION = 0.50 USD`).
2. Resolve `SECTION_COMPONENTS[section_key]`; build fetcher inputs.
3. For each component, call `componentFetcher(...)` → `{ prompt, allowed }`.
4. Component pool: `MAX_CONCURRENCY = 2`, no tool access, component-slot model.
5. Build summary user prompt from **raw fetcher prompt blocks + About text + optional guidance**, never from component prose. (Base §7.2)
6. Summary call with `toolsForSection(section_key)` per §9, `MAX_TOOL_CALLS_PER_SUMMARY = 2`.
7. Parse `===INSIGHT===` output (Base §7.4).
8. Numeric guard with `MAX_GUARD_ATTEMPTS = 2`; replay on failure with the error appended. (Base §7.5)
9. Persist `ai_insight_section` + `ai_insight_component` rows (DELETE+INSERT — Base §14).
10. SSE `complete` event → UI re-fetches and renders.

HR introduces no new step. RBAC, privacy, and aggregation governance are deferred to §12; the engine does not call them today.

## 9. HR Tools

The Finance tool catalog and policy levels from [10-ai-insight-base.md §12](./10-ai-insight-base.md#12-tool-catalog--policy) are reused. The engine's two HR tools today are:

- `query_local_table` — already exists for Finance. Adding HR `pc_*` (or `hr_*`) tables here is a `tools.ts` whitelist edit.
- `query_rds_table` — already exists for Finance. Out of scope for HR until HR's source-of-truth tables are mapped to `dbo.*`.

Until HR fetcher data is in place, HR tool whitelist additions are deferred. Once HR sections come online, the team must register the HR-side tables in [`AGGREGATE_LOCAL_TABLES`](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L33) and in `tools.ts` along with column allowlists (Base §12.1).

Section → policy map (Base engine levels — `none` / `aggregate_only` / `full`):

| Section | Tool policy | Max calls | Notes |
|---------|-------------|----------:|-------|
| `workforce_demographic` | `aggregate_only` | 2 | Department + demographic aggregates from a future `pc_workforce_*` table. |
| `workforce_movement` | `aggregate_only` | 2 | Joiner / leaver / movement aggregates. |
| `attendance_daily` | `none` | 0 | Fetcher should provide daily facts in full. |
| `attendance_monthly` | `aggregate_only` | 2 | Attendance + hours aggregate drill-down. |
| `attendance_flagged` | `full` | 2 | Flag-category and department root-cause aggregates. (Previously called `fixed_drilldown_tools`; mapped to engine's `full` level with the 2-call cap from Base §13.) |
| `leave_application` | `aggregate_only` | 2 | Application + upcoming-leave aggregates. |
| `leave_analysis` | `full` | 2 | Utilization + pattern aggregates. |
| `leave_balance` | `aggregate_only` | 2 | Balance-bucket aggregates. |
| `performance_full` | `full` | 2 | Score-band + completion aggregates. |
| `disciplinary_records` | `aggregate_only` | 2 | Warning status + stage aggregates. |
| `disciplinary_analysis` | `full` | 2 | Offense + trend aggregates. |
| `probation_full` | `aggregate_only` | 2 | Review timing + status aggregates. |
| `payroll_overview` | `none` | 0 | Disabled until §12 governance. |
| `payroll_breakdown` | `none` | 0 | Disabled until §12 governance. |

Engine rules from Base §12 still apply: tools are server-fixed, `query_rds_table` injects `Cancelled='F'` on transaction tables, WHERE / ORDER_BY blocks the 18-token SQL allowlist, row cap 100 per call.

## 10. HR Per-Section Verification & Tuning

Every HR section must pass the validation procedure defined in Base [§17 Validation & Tuning Workflow](./10-ai-insight-base.md#17-validation--tuning-workflow) before being enabled. Each subsection below uses the §17.6 template. Status is **Pending** for all 14 sections because no HR section has run an evaluation yet.

### 10.1 `workforce_demographic`

```
Section: workforce_demographic
Page: Workforce
Components: wf_kpis (kpi), wf_pie_chart (chart), wf_dept_bar (chart)
Scope: snapshot
Tool policy: aggregate_only

Questions answered
- What is current headcount?
- Is tenure healthy?
- Are departments / demographic groups over-concentrated?

Pre-computed values (provided by fetcher) — production team to define
- Total active headcount (count)
- Active department count (count)
- Average tenure (years, count)
- Top department headcount + % of total (count, pct)
- Top demographic bucket headcount + % of total (count, pct)
- Department-level headcount table (count + pct per row)

Numerical guardrails (allowed-values whitelist composition)
- RM values: none
- pct values: department %, demographic %
- days values: none
- count values: headcount totals, department counts, tenure-bucket counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/workforce_demographic/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12
- No cost / quality / hallucination / guard / tool-call data yet

Known tuning lessons
- None — pre-rollout
```

### 10.2 `workforce_movement`

```
Section: workforce_movement
Page: Workforce
Components: wf_joiners_leavers (chart)
Scope: period
Tool policy: aggregate_only

Questions answered
- Are joiners, leavers, or department movement changing materially?

Pre-computed values (provided by fetcher) — production team to define
- Joiners count + MoM delta + pct
- Leavers count + MoM delta + pct
- Net headcount change (count + pct)
- Department-level joiners / leavers ranked table

Numerical guardrails (allowed-values whitelist composition)
- RM values: none
- pct values: MoM joiner %, MoM leaver %, net change %
- days values: none
- count values: joiner / leaver / net / department-row counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/workforce_movement/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12

Known tuning lessons
- None — pre-rollout
```

### 10.3 `attendance_daily`

```
Section: attendance_daily
Page: Attendance & OT
Components: att_daily_kpis (kpi), att_daily_table (table)
Scope: snapshot (daily)
Tool policy: none

Questions answered
- Is daily attendance normal?
- Are there same-day exceptions HR should review?

Pre-computed values (provided by fetcher) — production team to define
- Present / absent / on-leave / late / OT / exception counts for the date
- Daily department-level attendance aggregates
- Daily exception buckets (count per bucket)

Numerical guardrails (allowed-values whitelist composition)
- pct values: attendance rate, absence rate, lateness rate
- count values: per-bucket counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/attendance_daily/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12

Known tuning lessons
- None — pre-rollout. Daily scope means short histories; the prompt must explicitly avoid claiming trends.
```

### 10.4 `attendance_monthly`

```
Section: attendance_monthly
Page: Attendance & OT
Components: att_monthly_kpis (kpi), att_trend_charts (chart), att_monthly_table (table), ot_sales_correlation (chart)
Scope: period
Tool policy: aggregate_only

Questions answered
- Are attendance, work-hour, OT, lateness trends improving or worsening?

Pre-computed values (provided by fetcher) — production team to define
- Monthly attendance / absence / lateness / OT totals + MoM + YoY pct deltas
- Department-level monthly summary (count + pct per row)
- OT vs sales-activity correlation indicator (pct or qualitative bucket)

Numerical guardrails
- pct values: attendance %, absence %, lateness %, OT vs salaried hours %
- count values: monthly totals, department-row counts
- days values: monthly day counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/attendance_monthly/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12

Known tuning lessons
- None — pre-rollout. Apply tuning pattern (a) from Base §17.4 early: pre-compute MoM / YoY deltas in the fetcher; do not let the model re-derive them.
```

### 10.5 `attendance_flagged`

```
Section: attendance_flagged
Page: Attendance & OT
Components: att_flagged_all (table)
Scope: period
Tool policy: full

Questions answered
- Which flag categories carry the highest count?
- Are flags concentrated by department?
- Are multi-flag (employees hitting >1 flag) counts increasing?

Pre-computed values (provided by fetcher) — production team to define
- Per-flag-category counts: chronic lateness, high absence, early departure, break compliance, abnormal OT
- Threshold rows (loaded from `alert_chronic_lateness`, `alert_high_absence`, `alert_early_departure`, `alert_break_compliance`, `alert_abnormal_ot`)
- Department-level flag aggregates
- Multi-flag count + MoM delta

Numerical guardrails
- pct values: flag share, multi-flag rate, MoM delta
- count values: per-flag counts, per-department counts, multi-flag count

Expected-values fixture
- File: AI_Insight_Study/eval_set/attendance_flagged/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12
- High-risk section per old PRD 12 §14.3: requires two clean evaluation passes (Base §17 acceptance gate).

Known tuning lessons
- None — pre-rollout. Tool policy is `full` so tools may drill into department-level aggregates; cap stays at 2 (`MAX_TOOL_CALLS_PER_SUMMARY`).
```

### 10.6 `leave_application`

```
Section: leave_application
Page: Leave
Components: lv_app_kpis (kpi), lv_upcoming_table (table), lv_applications_table (table)
Scope: period
Tool policy: aggregate_only

Questions answered
- Are leave applications, upcoming leave, or approval statuses creating coverage risk?

Pre-computed values (provided by fetcher) — production team to define
- Application count by status + MoM delta + pct
- Upcoming leave (next 14 / 30 days) by department
- Approval pipeline depth (count of pending applications)

Numerical guardrails
- pct values: status share, MoM delta
- days values: upcoming-leave window days
- count values: application counts, upcoming counts, department-row counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/leave_application/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12

Known tuning lessons
- None — pre-rollout.
```

### 10.7 `leave_analysis`

```
Section: leave_analysis
Page: Leave
Components: lv_monthly_breakdown (chart), lv_utilization_outliers (table), lv_near_ph_patterns (table)
Scope: period
Tool policy: full

Questions answered
- Are leave utilization, holiday adjacency, or outlier patterns unusual?

Pre-computed values (provided by fetcher) — production team to define
- Monthly leave-volume series by leave type
- Utilization buckets (low / normal / high) with thresholds from `alert_leave_utilization`
- Holiday-adjacency pattern counts (threshold from `alert_leave_pattern`)

Numerical guardrails
- pct values: utilization %, holiday-adjacency share
- count values: leave-day counts, outlier-bucket counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/leave_analysis/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12
- High-risk section: requires two clean evaluation passes.

Known tuning lessons
- None — pre-rollout. The prompt must avoid suggesting why an outlier exists (motive inference is forbidden — see §7 / §12 governance).
```

### 10.8 `leave_balance`

```
Section: leave_balance
Page: Leave
Components: lv_balance_summary (table)
Scope: snapshot
Tool policy: aggregate_only

Questions answered
- Are leave balances too high, too low, or unevenly distributed?

Pre-computed values (provided by fetcher) — production team to define
- Average leave balance by leave type
- High-balance bucket count + pct (per type)
- Low-balance / zero-balance bucket count + pct
- Department-level balance summary

Numerical guardrails
- pct values: balance distribution %, department share %
- days values: leave-balance days
- count values: per-bucket employee counts, per-department counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/leave_balance/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12

Known tuning lessons
- None — pre-rollout.
```

### 10.9 `performance_full`

```
Section: performance_full
Page: Performance
Components: pf_kpis (kpi), pf_table (table), pf_charts (chart)
Scope: period
Tool policy: full

Questions answered
- Is appraisal completion healthy?
- Are scores concentrated in specific bands / departments?

Pre-computed values (provided by fetcher) — production team to define
- Appraisal completion rate (pct) + completed / pending counts
- Average score + score-band distribution (counts + pct per band)
- Department-level completion + average score
- Score thresholds loaded from `analytics_appraisal`

Numerical guardrails
- pct values: completion %, score-band share, department share
- count values: completed / pending / band counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/performance_full/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12
- High-risk section: requires two clean evaluation passes. Scores are sensitive — the prompt must avoid naming employees (§7 / §12).

Known tuning lessons
- None — pre-rollout.
```

### 10.10 `disciplinary_records`

```
Section: disciplinary_records
Page: Disciplinary
Components: dc_kpis (kpi), dc_warning_list (table)
Scope: snapshot
Tool policy: aggregate_only

Questions answered
- Are active warnings concentrated by stage, category, or department?

Pre-computed values (provided by fetcher) — production team to define
- Active warning count by stage
- Pending action count
- At-risk bucket count (threshold from `alert_at_risk`)
- Department-level warning aggregates
- Warning list summarized by category × status × stage (sensitive notes excluded)

Numerical guardrails
- pct values: stage share, category share, at-risk %
- count values: per-stage / per-category / per-department counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/disciplinary_records/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12
- High-risk section: requires two clean evaluation passes. Sensitive disciplinary notes must never reach the model — enforced at fetcher level (§12 deferred).

Known tuning lessons
- None — pre-rollout.
```

### 10.11 `disciplinary_analysis`

```
Section: disciplinary_analysis
Page: Disciplinary
Components: dc_charts (chart)
Scope: period
Tool policy: full

Questions answered
- Are disciplinary patterns changing over time?
- Which categories need HR review?

Pre-computed values (provided by fetcher) — production team to define
- Offense category trend (counts per month per category)
- Department comparison (counts per department per category)
- Repeat-risk buckets (counts + pct)

Numerical guardrails
- pct values: category share, repeat-risk %, MoM delta %
- count values: per-category / per-department / per-bucket counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/disciplinary_analysis/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12
- High-risk section: requires two clean evaluation passes.

Known tuning lessons
- None — pre-rollout.
```

### 10.12 `probation_full`

```
Section: probation_full
Page: Probation
Components: pb_kpis (kpi), pb_records_table (table)
Scope: snapshot
Tool policy: aggregate_only

Questions answered
- Are probation reviews overdue or approaching?
- Are status buckets healthy?

Pre-computed values (provided by fetcher) — production team to define
- Probation employee count
- Upcoming-review count (window from `probation_review`)
- Overdue-review count (window from `probation_review`)
- Status-mix counts + pct
- Department-level probation summary

Numerical guardrails
- pct values: status-mix share, overdue %, upcoming %
- days values: review-window days
- count values: per-status / per-department counts

Expected-values fixture
- File: AI_Insight_Study/eval_set/probation_full/expected_values.json (to be created)

Rollout status
- Pending (scaffold only) as of 2026-05-12

Known tuning lessons
- None — pre-rollout.
```

### 10.13 `payroll_overview` — disabled

```
Section: payroll_overview
Page: Payroll
Components: pr_total_kpis (kpi), pr_dept_waterfall (chart), pr_yoy_trend (chart)
Scope: period
Tool policy: none

Status: DISABLED until payroll data contract + governance approved (§12).
No fetcher, no expected-values fixture, no rollout date.
```

### 10.14 `payroll_breakdown` — disabled

```
Section: payroll_breakdown
Page: Payroll
Components: pr_component_breakdown (breakdown), pr_cost_drivers (table)
Scope: period
Tool policy: none

Status: DISABLED until payroll data contract + governance approved (§12).
No fetcher, no expected-values fixture, no rollout date.
```

### 10.15 Rollout summary

| Status | Count | Sections |
|--------|------:|----------|
| Done | 0 | — |
| Pending (scaffold only) | 12 | All §§10.1–10.12 |
| Disabled until §12 governance | 2 | `payroll_overview`, `payroll_breakdown` |

## 11. HR Acceptance Criteria

HR AI Insight is production-ready when **all** of the following hold for every enabled section:

1. Section key registered in [`SECTION_COMPONENTS`](../../apps/dashboard/src/lib/ai-insight/prompts.ts), [`SECTION_PAGE`](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L123), [`SECTION_NAMES`](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L147), and [`tool-policy.ts`](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts).
2. Components in §4.2 registered with non-empty arrays in `SECTION_COMPONENTS`.
3. Component prompts seeded into `ai_insight_prompts` and visible in the admin prompt tree.
4. `hr_component_analysis` + `hr_summary_analysis` system-prompt bodies filled.
5. Per-component fetcher implemented and returning `{ prompt, allowed }` per Base [§11 Data Provider Contract](./10-ai-insight-base.md#11-data-provider-contract).
6. HR Settings threshold rows (§6) wired into fetcher pre-computed values.
7. Section passes the Base §17.3 acceptance gate (numeric accuracy 3/3, no material hallucination, quality ≥ 8/10, guard ≤ 2 attempts, tool calls ≤ 2, failed tool calls 0 / immaterial).
8. High-risk sections (`attendance_flagged`, `leave_analysis`, `performance_full`, `disciplinary_records`, `disciplinary_analysis`) require two clean evaluation passes.
9. UI panel renders idle / loading / analyzing / complete / blocked / error / cancelled per Base §4.
10. Feedback round-trip works for HR prompts in the admin Config page (capture → router → preview → diff → apply → version).
11. Per-section evaluation row(s) recorded in the section's `AI_Insight_Study/eval_set/<section>/` folder with cost / click, quality, sub-scores, hallucinations, guard attempts, tool calls, failed-call counts, and result.

Acceptance is **not** transitive from Finance. Even though the engine is identical, every HR section must run the validation procedure independently because its data shape, threshold sensitivity, and output guidance are different.

## 12. Out-of-Scope Addendum — HR Governance (Deferred)

The following requirements are real and important for HR-in-production, but the demo engine **does not** implement them today. The production team must decide where each lands (engine, module, infrastructure, or policy).

### 12.1 PII filtering / privacy guard

- Strip employee names, employee IDs, IC/passport numbers, contact details, addresses, bank details, individual salary rows, and sensitive notes before any fetcher result reaches the model.
- Inspect: model input · tool input · tool output · final parsed output · card text · detail dialog text · feedback text before storage.
- Today: the engine has parser / numeric / cost / runtime / lock guards (Base §13). No PII inspector exists.

### 12.2 RBAC scope filter

- Apply role + user scope (HR staff / HR manager / HR leader / superadmin) server-side, before fetcher returns data.
- UI must not reveal the existence of restricted populations.
- Today: every fetcher is unscoped. There is no `userId` / `role` parameter in the analyze request.

### 12.3 Aggregation thresholds

- Suppress small groups before exposing sensitive aggregates (k-anonymity-style).
- Especially relevant for: `attendance_flagged`, `leave_analysis`, `performance_full`, `disciplinary_*`, `payroll_*`.
- Today: fetchers return raw aggregates with no minimum-group-size logic.

### 12.4 Role / user cache-key isolation

- Persistence key today is `(page, section_key)` only — see [ai-insight-schema.sql §2](../../apps/dashboard/sql/ai-insight-schema.sql) (`UNIQUE (page, section_key)`).
- HR in production must extend the key with `role`, `user_scope_hash`, `threshold_version`, and `prompt_versions`.
- This changes the persistence shape, the storage module, the lock semantics (probably no longer a singleton — Base §16), the cancel route, and the SSE result fetch. Non-trivial engine refactor.

### 12.5 Payroll governance

- Payroll AI Insight is `none` tool-policy and not exposed in the dashboard. Two sections (`payroll_overview`, `payroll_breakdown`) are catalogued but disabled.
- Before enabling payroll, the production team must:
  - Confirm payroll API / source-data contract.
  - Confirm which roles may view payroll aggregates (HR vs Finance crossover).
  - Confirm minimum aggregation thresholds for salary, bank, statutory, and personal fields.
  - Confirm exclusion of salary, bank, statutory, and personal payroll fields from model input.
  - Build expected-value + PII-trap fixtures.
  - Run two clean evaluation passes for both payroll sections.

### 12.6 Automatic re-evaluation on threshold / prompt change

- Threshold change (§6.1) and prompt-version apply (Base §9) **do not** trigger automatic re-evaluation of stored section results.
- The admin must manually click `Get Insight` again to refresh.
- The production team must decide whether to wire a queue-based re-evaluation trigger or accept the manual workflow.

### 12.7 Audit trail on feedback

- The current engine deletes the feedback row when admin clicks Apply or Discard (Base §9).
- HR (and any regulated context) probably needs the feedback rows + their lifecycle preserved for audit.
- This is a schema change (`ai_insight_feedback` gets a soft-delete column + a status enum) plus an admin-UI change.

### 12.8 Forbidden-output guard

- Today's "do not suggest terminate / approve / discipline" rule is enforced via prompt instructions only (§5 / §7).
- HR in production may want a post-parse guard that rejects outputs matching a forbidden-verb list and forces a retry — analogous to the numeric guard (Base §13).

### 12.9 Open decisions to close before HR launch

1. Exact RBAC scope matrix per HR role.
2. Exact aggregation thresholds per section + sensitivity class.
3. Historical retention vs latest-only for sensitive sections.
4. Cost cap per HR section + role scope.
5. Governance approval path for threshold edits that affect AI Insight output.
6. Whether HR-mode `hr_component_analysis` + `hr_summary_analysis` should diverge structurally from their Finance equivalents or stay format-identical and persona-different only.

None of §12 blocks engine adoption. HR can ship sections §§10.1–10.12 against the existing Base engine and add §§12.1–12.8 as production-only layers without re-architecting.

---

## Appendix A — Source File Index

| Concern | File |
|---------|------|
| HR section keys | [prompts.ts:114-145](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L114-L145) |
| HR tool policy (scaffold) | [tool-policy.ts:23-30](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts#L23-L30) |
| HR system-prompt seeding | [seed-defaults/route.ts:66-86](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L66-L86) |
| Section-guidance defaults (no HR rows today) | [prompts-defaults.ts:1057-1074](../../apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L1057-L1074) |
| AI Insight schema (no HR-specific tables) | [ai-insight-schema.sql](../../apps/dashboard/sql/ai-insight-schema.sql) |
