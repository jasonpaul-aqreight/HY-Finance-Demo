# AI Insight Engine — HR Configuration

> **Status: Specification only — not yet implemented. Epic 4 was deferred on 2026-04-15.**

> HR-specific configuration for the AI Insight Engine. This document is self-contained: a junior developer can read it top-to-bottom and understand the full HR AI Insight specification. Shared platform patterns live in [doc 10 (10-ai-insight-base.md)](10-ai-insight-base.md) and are referenced as "See doc 10, §X" where needed — you do not need to read doc 10 unless you want deeper platform-level context.

---

## 1. Overview

The HR configuration plugs into the base AI Insight Engine (doc 10) to provide automated analysis across seven dashboard pages:

| # | Page | Route | Sections | Components |
|---|------|-------|----------|------------|
| 1 | Workforce | /hr-dashboard/workforce | 2 | 4 |
| 2 | Attendance | /hr-dashboard/attendance | 3 | 7 (includes OT-Sales correlation) |
| 3 | Leave | /hr-dashboard/leave | 3 | 7 |
| 4 | Performance | /hr-dashboard/performance | 1 | 3 |
| 5 | Disciplinary | /hr-dashboard/disciplinary | 2 | 3 |
| 6 | Probation | /probation | 1 | 2 |
| 7 | Payroll | /hr-dashboard/payroll | 2 | 5 (page not yet built) |

**Totals:** 14 sections, 31 components across 7 pages.

**Excluded:** Employee Directory (Workforce — searchable list, no analysis value), Probation Settings (config page, no data to analyze).

**How it works (simplified):**

1. User clicks "Analyze" on a section header.
2. The orchestrator fetches pre-computed data from PostgreSQL (with PII stripped and thresholds pre-flagged).
3. Phase 1: Each component is analyzed in parallel by a fast model (Haiku) using the component prompt + data.
4. Phase 2: A summary model (Sonnet) reads all component results and produces 1-6 structured insight cards (good + bad findings).
5. Results are stored in PostgreSQL and displayed in the UI.

See doc 10, §2 for the full architecture diagram and §4 for the analysis lifecycle.

---

## 2. Analysis Persona

The global system prompt is sent as the `system` parameter on every component-level LLM call. It is the same for all 31 components. Component-specific prompts (documented in section 5) are prepended to the `user` message, not the system message. This keeps the system prompt cacheable across all calls.

### Full Global System Prompt

> You are an HR analyst at Hoi-Yong (Malaysian fruit distribution). You explain HR dashboard metrics to HR management.
>
> Rules:
> - Be direct, concise, no HR jargon. State facts, not recommendations.
> - Bullet points for observations. Markdown tables for comparisons.
> - Compare at least 3 data points for trends.
> - If data is insufficient, say so.
> - Keep analysis under 150 words.
> - Do NOT re-derive totals. Use values as given.
> - Every number you cite MUST appear in the data block. Display rounding OK. Never back-solve or invent values.
> - Match your language to the Scope line in the data (daily vs period vs snapshot).
> - Never reference employee names, IDs, or IC numbers. Use department-level or aggregate language only.

### Prompt Rules (extracted)

| Rule | Detail |
|------|--------|
| Language | Direct, concise, no HR jargon |
| Format | Bullet points for observations, markdown tables for comparisons |
| Component word limit | Max 150 words |
| Summary detail word limit | Max 150 words |
| Verbatim-copy rule | Every number must match a value from the data block (display rounding OK) |
| Scope discipline | Match language to the Scope line in the data (daily vs period vs snapshot) |
| PII ban | Never reference employee names, IDs, IC numbers — columns containing PII are never whitelisted. Use department-level or aggregate language only |

---

## 3. Scope Assignments

Each section uses one of three scope types. The scope controls what language the AI uses when describing numbers and how date filtering works. See doc 10, §13 for scope type definitions.

| Scope | Sections | How determined |
|-------|----------|---------------|
| `daily` | attendance_daily | Date picker on page |
| `period` | workforce_movement, attendance_monthly, attendance_flagged, leave_application, leave_analysis, performance_full, disciplinary_analysis, payroll_overview, payroll_breakdown | Year/month selector on page |
| `snapshot` | workforce_demographic, leave_balance, disciplinary_records, probation_full | Current state, no date filter |

**Scope follows the user's current page selection** — AI analyzes what the user sees.

---

## 4. Dual-Model Strategy (HR)

HR uses the shared dual-model strategy from the base platform. See doc 10, §3 for full details.

| Phase | Model | Max Tokens | Purpose | HR notes |
|-------|-------|-----------|---------|----------|
| Phase 1 — Component analysis | Haiku 4.5 | 2,048 | Fast, parallel analysis of each component (no tools, 150-word cap) | 31 components across 14 sections. Haiku keeps cost low. |
| Phase 2 — Summary synthesis | Sonnet 4.6 | 4,096 | Synthesis of all component results into insight cards | Has tool access for root-cause investigation per section policy (see §7). Max 4 tool calls per summary; stop once enough context. |

---

## 5. Section & Component Catalog

This section documents all 14 sections and their 31 components. For each section you will find:
1. A metadata table (section key, page, scope, tool policy, data sources, component count)
2. A component table (key, name, type, what it measures, thresholds)
3. The exact component prompt for each component, shown in a blockquote

---

### 5.1 Workforce — Demographic

| | |
|---|---|
| **Section Key** | `workforce_demographic` |
| **Page** | workforce |
| **Scope** | snapshot |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `employee_list` |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| wf_kpis | Workforce KPIs | kpi | Total Employees, Active Departments, Average Tenure (years) | Tenure <2yr avg = high turnover signal, >5yr = stable |
| wf_pie_chart | Overall Demographics | chart | Distribution by Gender, Nationality, Age, Tenure, Group | Any single category >70% = low diversity flag |
| wf_dept_bar | Department Breakdown | chart | Per-department headcount with demographic split | Any dept >40% of total = concentration risk |

**Component Prompt — `wf_kpis`:**
> You are analyzing the "Workforce KPIs" — three cards showing Total Employees, Active Departments, and Average Tenure.
>
> What it measures: Current workforce size, organizational breadth, and employee retention proxy.
>
> How to read it:
> - Total Employees = active headcount (excludes resigned)
> - Active Departments = departments with at least 1 active employee
> - Average Tenure = mean years of service across all active employees
>
> Evaluate: Is the workforce growing or shrinking? Is tenure healthy (>3 years suggests stability)?

**Component Prompt — `wf_pie_chart`:**
> You are analyzing the "Overall Demographics" pie chart showing workforce distribution by a selected category (Gender, Nationality, Age, Tenure, or Group).
>
> What it measures: Workforce composition and diversity across demographic dimensions.
>
> Look for: Over-concentration in any single category (>70%), unusual age distribution (aging workforce vs very young), nationality composition trends.

**Component Prompt — `wf_dept_bar`:**
> You are analyzing the "Department Breakdown" stacked bar chart showing headcount per department with demographic overlay.
>
> What it measures: How employees are distributed across departments.
>
> Look for: Departments that are disproportionately large (>40% of total), departments with very low headcount (understaffing risk), demographic imbalances within departments.

---

### 5.2 Workforce — Movement

| | |
|---|---|
| **Section Key** | `workforce_movement` |
| **Page** | workforce |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `employee_list` (join_date, resign_date) |
| **Components** | 1 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| wf_joiners_leavers | Joiners & Leavers Trend | chart | Monthly new hires vs resignations over 12 months | Leavers > Joiners for 3+ months = attrition concern |

**Component Prompt — `wf_joiners_leavers`:**
> You are analyzing the "Joiners & Leavers" trend chart showing monthly new hires and resignations over 12 months.
>
> What it measures: Workforce growth trajectory — whether the company is gaining or losing employees net.
>
> How to read it:
> - Joiners bar above Leavers = net growth that month
> - Leavers bar above Joiners = net attrition that month
>
> Look for: Sustained attrition (3+ months leavers > joiners), seasonal hiring patterns, resignation clusters (multiple departures in same month), overall net movement direction.

---

### 5.3 Attendance — Daily Summary

| | |
|---|---|
| **Section Key** | `attendance_daily` |
| **Page** | attendance |
| **Scope** | daily |
| **Tool Policy** | none |
| **Data Sources** | `attendance_list`, `public_holiday` |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| att_daily_kpis | Daily KPI Cards | kpi | Present, On Leave, Absent, Worked Hours, OT Hours, Punctuality Violations, Dinner Break Violations | Attendance rate <85% = concern, OT >4.5h avg = abnormal |
| att_daily_table | Daily Attendance Table | table | Per-employee attendance for the selected date | Evaluate aggregate patterns, not individuals (PII) |

**Component Prompt — `att_daily_kpis`:**
> You are analyzing 7 daily attendance KPI cards: Present (+ OT employees), On Leave, Absence, Worked Hours, OT Hours, Punctuality Violations (Late/Early), and Dinner Break Violations.
>
> What it measures: Single-day workforce attendance health snapshot.
>
> How to read it:
> - Present / Total = attendance rate for the day
> - OT employees = staff working overtime that day
> - Punctuality = late arrivals + early departures
> - Dinner Break = labor compliance violations
>
> Evaluate: Is attendance rate acceptable? Are OT levels unusual for this day? Are punctuality violations concentrated or widespread?

**Component Prompt — `att_daily_table`:**
> You are analyzing the daily attendance table showing per-employee records for the selected date.
>
> What it measures: Individual attendance entries including clock-in/out times, lateness, OT status.
>
> Note: Employee names/IDs are not included. Analyze aggregate patterns only — e.g., "X employees were late by >30 minutes" rather than naming individuals.
>
> Look for: Clusters of lateness in specific departments, unusually long/short work hours, OT concentration.

---

### 5.4 Attendance — Monthly/Yearly Summary

| | |
|---|---|
| **Section Key** | `attendance_monthly` |
| **Page** | attendance |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `attendance_list` |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| att_monthly_kpis | Monthly Summary KPIs | kpi | Present Days, Leave Days, Off Days, Absence Days, OT Days/Hours, Violations | Month avg attendance <85% = concern |
| att_trend_charts | Attendance & Hours Trends | chart | Two line charts: daily attendance rate over the month + worked/OT hours over the month | Declining attendance trend = flag, OT spike = flag |
| att_monthly_table | Monthly Summary Table | table | Per-employee monthly breakdown (days worked, leave, absent, OT, violations) | Analyze department-level patterns, not individuals |
| ot_sales_correlation | OT vs Sales Trend | chart | Monthly OT hours alongside monthly sales revenue (cross-module data from Finance `pc_sales_daily`) | OT rising + sales rising = expected (busier). OT rising + sales flat/falling = labor efficiency concern |

**Component Prompt — `att_monthly_kpis`:**
> You are analyzing monthly/yearly summary KPI cards: Present Days, Leave Days, Off Days, Unpaid Days, Absence Days, OT Days (Rest/Holiday), Worked Hours, OT Hours, Total Hours, Punctuality Violations, Dinner Break Violations.
>
> What it measures: Aggregated attendance health for the selected period.
>
> Evaluate: Compare to prior period if available. Are absence rates rising? Is OT sustainable? Are violations trending up or down?

**Component Prompt — `att_trend_charts`:**
> You are analyzing two trend line charts: (1) Daily attendance rate over the month, (2) Worked hours and OT hours over the month.
>
> What they measure: Day-by-day attendance patterns and work effort within the selected period.
>
> Look for: Mid-week dips, Friday/Monday absence patterns, OT spikes on specific days, correlation between low attendance and high OT (remaining staff covering).

**Component Prompt — `att_monthly_table`:**
> You are analyzing the employee monthly summary table showing per-employee attendance aggregates for the period.
>
> What it measures: Individual-level monthly totals (days worked, leave taken, absences, OT, violations).
>
> Note: Employee names/IDs are not included. Focus on department-level patterns and statistical distributions — e.g., "the top quartile of OT hours is concentrated in 2 departments."

**Component Prompt — `ot_sales_correlation`:**
> You are analyzing a cross-module comparison: monthly OT hours (from HR) vs monthly sales revenue (from Finance).
>
> What it measures: Whether overtime trends correlate with business activity (sales volume).
>
> How to read it:
> - OT rising + Sales rising = business is getting busier (expected, healthy OT)
> - OT rising + Sales flat or falling = possible labor efficiency problem (doing more OT without generating more revenue)
> - OT falling + Sales rising = improved productivity or understaffing risk
>
> Data source: OT hours from `attendance_list`, sales revenue from Finance's `pc_sales_daily` (monthly totals).

---

### 5.5 Attendance — Flagged Staff

| | |
|---|---|
| **Section Key** | `attendance_flagged` |
| **Page** | attendance |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | `attendance_list`, `hr_settings` (thresholds), `pattern-detection.service` |
| **Components** | 1 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| att_flagged_all | Flagged Employees Summary | table | Combined view of all 5 alert types: High Absence, Chronic Lateness, Early Departure, Break Compliance, Abnormal OT | Flagged/not-flagged is pre-computed by backend using configurable thresholds |

**Component Prompt — `att_flagged_all`:**
> You are analyzing the "Flagged Staff" section which combines 5 behavioral alert categories: High Absence, Chronic Lateness, Early Departure, Break Compliance Violations, and Abnormal OT.
>
> What it measures: Employees whose attendance patterns exceed configurable thresholds (pre-flagged by the system).
>
> The data shows: count of flagged employees per category, department distribution of flags, and trend vs prior period.
>
> Note: Thresholds are configured by HR admin. The data is pre-flagged — you do not need to re-evaluate individual records.
>
> Look for: Which alert category has the most flags? Are flags concentrated in specific departments? Is the total flag count growing or shrinking vs prior period? Do any employees appear in multiple categories (multi-flag risk)?

---

### 5.6 Leave — Application

| | |
|---|---|
| **Section Key** | `leave_application` |
| **Page** | leave |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `leave_transaction` |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| lv_app_kpis | Leave KPIs | kpi | Pending Approval count, Upcoming Leave count (Today + Future) | Pending >10 = backlog concern |
| lv_upcoming_table | Upcoming Leave | table | Approved leaves in the near future with dates, days, and timing | Coverage gaps (multiple same-dept leaves overlapping) = risk |
| lv_applications_table | Leave Applications | table | Filtered leave applications with status, type, holiday adjacency warnings | High rejection rate (>15%) = process issue |

**Component Prompt — `lv_app_kpis`:**
> You are analyzing 2 leave KPI cards: Pending Approval and Upcoming Leave (split into Today and Future).
>
> What it measures: Leave pipeline health — how many applications are awaiting decision and how many approved leaves are coming.
>
> Evaluate: Is the pending backlog reasonable? Are there many leaves upcoming in the near term (coverage risk)?

**Component Prompt — `lv_upcoming_table`:**
> You are analyzing the "Upcoming Leave" table showing approved future leave entries.
>
> What it measures: Short-term workforce availability — who is going on leave and when.
>
> Note: Employee names are not included. Focus on department coverage — e.g., "3 employees from the same department are on leave next week."
>
> Look for: Overlapping leaves in the same department, long-duration leaves (>5 days), clustering around holidays.

**Component Prompt — `lv_applications_table`:**
> You are analyzing the leave applications table with status breakdown (Applied, Approved, Rejected, Cancelled).
>
> What it measures: Leave application patterns and approval health.
>
> The data includes holiday adjacency flags (leaves taken next to public holidays).
>
> Look for: High rejection rates, leave types with unusual patterns, holiday-adjacent clustering, departments with disproportionate leave volume.

---

### 5.7 Leave — Analysis

| | |
|---|---|
| **Section Key** | `leave_analysis` |
| **Page** | leave |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | `leave_transaction`, `leave_balance`, `public_holiday`, `hr_settings` |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| lv_monthly_breakdown | Monthly Leave Breakdown | chart | Donut (overall distribution) + Stacked bar (monthly trend by type or status) | Sick leave >30% of total = health concern, Unpaid >10% = financial signal |
| lv_utilization_outliers | Leave Utilization Outliers | table | Statistical outlier detection — high usage and low usage employees per leave type | High/low thresholds from `hr_settings` (configurable). Pre-flagged. |
| lv_near_ph_patterns | Near-PH Leave Patterns | table | Employees who frequently take leave adjacent to public holidays | Flagged if adjacent count > threshold (configurable, default 3). Pre-flagged. |

**Component Prompt — `lv_monthly_breakdown`:**
> You are analyzing the leave monthly breakdown: a donut chart showing overall distribution and a stacked bar chart showing monthly trend (grouped by leave type or status).
>
> What it measures: How leave is distributed across types and months.
>
> Look for: Seasonal patterns (e.g., December spike), dominant leave types, months with unusually high leave volume, trend direction (increasing or decreasing leave usage).

**Component Prompt — `lv_utilization_outliers`:**
> You are analyzing leave utilization outliers — employees flagged as statistically high or low leave users per leave type.
>
> What it measures: Employees whose leave usage deviates significantly from the population average (using standard deviation).
>
> The data shows: average usage %, standard deviation, high/low thresholds, and flagged employees per category.
>
> Note: Employees are pre-flagged by the system. Names are stripped. Focus on: how many are flagged, which leave types have the most outliers, department concentration of outliers.
>
> High usage may signal burnout or abuse. Low usage may signal presenteeism or unused entitlement risk.

**Component Prompt — `lv_near_ph_patterns`:**
> You are analyzing the "Frequent Near-PH Taker" table — employees who frequently take leave adjacent to public holidays.
>
> What it measures: Pattern of leave-taking around public holidays, which may indicate leave abuse (extending holidays).
>
> The data shows: flagged employees with instance count, last occurrence, and associated holiday. Pre-flagged by the system against configurable threshold.
>
> Look for: Total flagged count, department concentration, frequency of pattern (one-time vs habitual), which public holidays are most "extended."

---

### 5.8 Leave — Balance

| | |
|---|---|
| **Section Key** | `leave_balance` |
| **Page** | leave |
| **Scope** | snapshot |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `leave_balance` |
| **Components** | 1 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| lv_balance_summary | Leave Balance Summary | table | Per-employee balance by leave type: BF + Entitled + Credits - Taken - Pending = Balance | Near-zero balance = risk of unpaid leave; High unused balance = forfeiture risk |

**Component Prompt — `lv_balance_summary`:**
> You are analyzing the leave balance summary table showing per-employee balances across all leave types (AL, CL, HL, MC, PL, RL, ML).
>
> What it measures: Current leave entitlement health — how much leave employees have remaining.
>
> Note: Employee names are not included. Analyze aggregate patterns:
> - How many employees have near-zero Annual Leave balance (may need unpaid leave)?
> - How many have high unused balances (forfeiture risk if not taken before year-end)?
> - Are any leave types being underutilized company-wide?
>
> Formula per type: Brought Forward + Entitled + Credits - Taken - Pending = Balance

---

### 5.9 Performance — Full Page

| | |
|---|---|
| **Section Key** | `performance_full` |
| **Page** | performance |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | `appraisal`, `appraisal_form_template` |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| pf_kpis | Performance KPIs | kpi | Average Score, High Performers count, Low Performers count, Completion Rate (approved/total) | High Performer threshold from `hr_settings` (default 0.85), Low Performer threshold (default 0.6) |
| pf_table | Performance Table | table | Employee-level scores with previous score, current score, change direction, status | Analyze department-level distributions, not individuals |
| pf_charts | Performance Charts | chart | Score distribution (horizontal bar) + Average score by department (line with overall avg reference) | Department avg below overall avg = underperforming dept |

**Component Prompt — `pf_kpis`:**
> You are analyzing 4 performance KPI cards: Average Score, High Performers count, Low Performers count, and Completion Rate.
>
> What it measures: Overall appraisal health for the selected year.
>
> How to read it:
> - Average Score = mean appraisal score across all evaluated employees
> - High/Low Performers = employees above/below configurable thresholds (pre-flagged)
> - Completion Rate = approved appraisals / total expected (includes Pending and Not Appraised counts)
>
> Evaluate: Is the average score healthy? Is the completion rate on track? What is the ratio of high to low performers?

**Component Prompt — `pf_table`:**
> You are analyzing the employee performance table showing appraisal scores, YoY change direction, and completion status.
>
> What it measures: Individual appraisal outcomes for the selected year.
>
> Note: Employee names are not included. Focus on:
> - Distribution of score changes (how many improved vs declined vs new)
> - Department-level patterns (which depts are improving/declining)
> - Completion gaps (how many are "Not Appraised" or "Pending")
> - Status breakdown (Approved vs Pending vs Not Appraised)

**Component Prompt — `pf_charts`:**
> You are analyzing two performance charts: (1) Score Distribution — horizontal bar showing how many employees fall in each score range, (2) Average Score by Department — line chart with overall average as reference.
>
> What they measure: Score spread across the workforce and department-level performance comparison.
>
> Look for: Is the distribution bell-shaped (healthy) or skewed? Are most employees clustered in a narrow range (rating inflation)? Which departments are above/below the overall average? Is there significant spread between departments?

---

### 5.10 Disciplinary — Records/KPIs

| | |
|---|---|
| **Section Key** | `disciplinary_records` |
| **Page** | disciplinary |
| **Scope** | snapshot |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `hr_warnings`, `hr_offense_categories` |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| dc_kpis | Disciplinary KPIs | kpi | Pending Approval, Under Coaching, At Risk (with 2nd/3rd warning sub-counts) | At Risk >0 = immediate attention, Pending >5 = process backlog |
| dc_warning_list | Active Warnings | table | Current warning records for active employees with type, offence, status | Analyze by department and offence type, not individuals |

**Component Prompt — `dc_kpis`:**
> You are analyzing 3 disciplinary KPI cards: Pending Approval (warnings awaiting sign-off), Under Coaching (active coaching cases), and At Risk (employees with 2nd or 3rd stage warnings).
>
> What it measures: Current disciplinary pipeline health.
>
> Evaluate: Is the pending queue growing? How many employees are under active coaching? How many are at-risk (2nd/3rd warning — potential termination path)? What is the ratio of coaching to at-risk?

**Component Prompt — `dc_warning_list`:**
> You are analyzing the active warnings table showing current warning records.
>
> What it measures: Active disciplinary cases — what types of offences are occurring and their current status.
>
> Note: Employee names are not included. Focus on:
> - Most common offence types
> - Department concentration of warnings
> - Warning stage distribution (1st vs 2nd vs 3rd)
> - Action types (Written Warning, Coaching, etc.)

---

### 5.11 Disciplinary — Analysis

| | |
|---|---|
| **Section Key** | `disciplinary_analysis` |
| **Page** | disciplinary |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | `hr_warnings` |
| **Components** | 1 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| dc_charts | Disciplinary Trends | chart | Donut (overall by category) + Stacked bar (monthly trend by action/offence/department) | Rising monthly trend = concern, seasonal spikes = investigate |

**Component Prompt — `dc_charts`:**
> You are analyzing the disciplinary analysis charts: a donut showing overall warning distribution (by Action Type, Offence Type, or Department) and a stacked bar showing monthly trend.
>
> What it measures: Warning volume patterns over the selected year.
>
> Look for: Is the monthly volume increasing or decreasing? Which category dominates? Are there seasonal patterns (e.g., post-holiday spikes)? Is one department generating disproportionate warnings? Which offence types are most common?

---

### 5.12 Probation — Full Page

| | |
|---|---|
| **Section Key** | `probation_full` |
| **Page** | probation |
| **Scope** | snapshot |
| **Tool Policy** | aggregate_only |
| **Data Sources** | `employee_list`, `probation_settings` |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| pb_kpis | Probation KPIs | kpi | Under Probation (with Just Join / Mid Way sub-counts), Overdue (requires immediate HR action) | Overdue >0 = critical, Overdue/Total >20% = systemic process failure |
| pb_records_table | Probation Records | table | Employee probation status: period, join date, end date, remaining days, status, action | Remaining days <14 = urgent, negative remaining = overdue |

**Component Prompt — `pb_kpis`:**
> You are analyzing 2 probation KPI cards: Under Probation (split into Just Joined and Mid Way) and Overdue (probation period expired without confirmation).
>
> What it measures: Probation pipeline health — how many new employees are being evaluated and how many have fallen through the cracks.
>
> Evaluate: Is the overdue count zero (ideal) or growing? What percentage of probationers are overdue (process health)? Is the Just Joined vs Mid Way ratio reasonable for the company's hiring pace?

**Component Prompt — `pb_records_table`:**
> You are analyzing the probation records table showing all employees currently in probation.
>
> What it measures: Individual probation status — remaining days, current stage, and HR action taken.
>
> Note: Employee names are not included. Focus on:
> - How many are overdue (negative remaining days) — color-coded red
> - How many are approaching deadline (<14 days) — color-coded orange
> - Department distribution of probationers
> - Action taken vs not (how many have been confirmed, discontinued, or still pending)

---

### 5.13 Payroll — Overview (Page Not Yet Built)

| | |
|---|---|
| **Section Key** | `payroll_overview` |
| **Page** | payroll |
| **Scope** | period |
| **Tool Policy** | none (page not built, tables TBD) |
| **Data Sources** | TBD (payroll tables not yet defined) |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| pr_total_kpis | Payroll Total KPIs | kpi | Total payroll cost, headcount, avg cost per employee | YoY growth >10% = concern |
| pr_dept_waterfall | Department Payroll Waterfall | chart | Payroll cost breakdown by department | Any dept >40% of total = concentration |
| pr_yoy_trend | Payroll YoY Trend | chart | Monthly payroll cost over 12 months with YoY comparison | Rising faster than headcount growth = cost pressure |

**PII Rule:** Department averages only. AI never sees individual salaries.

**Component Prompt — `pr_total_kpis`:**
> You are analyzing payroll KPI cards: Total Payroll Cost, Headcount, and Average Cost Per Employee.
>
> What it measures: Overall payroll spend and per-head cost for the selected period.
>
> Evaluate: Is total payroll growing? Is per-head cost rising (salary inflation) or stable? How does headcount change relate to total cost change?

**Component Prompt — `pr_dept_waterfall`:**
> You are analyzing a waterfall chart showing payroll cost broken down by department.
>
> What it measures: How payroll spend is distributed across departments.
>
> Look for: Which department has the highest payroll cost? Is any department disproportionately expensive relative to its headcount? Any unexpected changes vs prior period?

**Component Prompt — `pr_yoy_trend`:**
> You are analyzing a 12-month payroll trend with year-over-year comparison.
>
> What it measures: Monthly payroll cost trajectory and how it compares to the same months last year.
>
> Look for: Is payroll trending up or down? Are there seasonal spikes (bonuses, year-end)? Is YoY growth consistent or accelerating?

---

### 5.14 Payroll — Breakdown (Page Not Yet Built)

| | |
|---|---|
| **Section Key** | `payroll_breakdown` |
| **Page** | payroll |
| **Scope** | period |
| **Tool Policy** | none (page not built, tables TBD) |
| **Data Sources** | TBD (payroll tables not yet defined) |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| pr_component_breakdown | Payroll Component Breakdown | chart | Split of payroll into base salary, OT pay, allowances, claims | OT pay >20% of total in any dept = flag |
| pr_cost_drivers | Payroll Cost Drivers | table | Top cost-increasing factors vs prior period | Any single factor >50% of total increase = concentrated |

**PII Rule:** Department averages only. AI never sees individual salaries.

**Component Prompt — `pr_component_breakdown`:**
> You are analyzing payroll component breakdown: base salary, OT pay, allowances, and claims as percentages of total payroll.
>
> What it measures: Where payroll money goes — fixed vs variable components.
>
> Look for: Is OT pay growing as a share of total? Are allowances or claims spiking? Which component changed the most vs prior period?

**Component Prompt — `pr_cost_drivers`:**
> You are analyzing the payroll cost drivers table showing what caused payroll to increase or decrease vs prior period.
>
> What it measures: Root causes of payroll changes.
>
> Look for: Is the increase driven by headcount growth, salary adjustments, or OT? Which department contributed most to the change?

---

## 6. Deterministic Summary Questions

Each section has fixed questions the AI must answer during summary synthesis. This makes the summary output predictable — same data always answers the same questions. See doc 10, §16 for the shared pattern.

| Section | Summary Questions |
|---------|-------------------|
| workforce_demographic | 1. Is headcount growing or shrinking vs last month? 2. Is average tenure above 3 years? 3. Any department with less than 3 staff? |
| workforce_movement | 1. How many joiners vs leavers this month? 2. Is there a department losing more people than others? 3. What's the turnover rate? |
| attendance_daily | 1. What's today's attendance rate? Is it below 85%? 2. How many staff are late today? 3. How many are on OT? |
| attendance_monthly | 1. Is monthly avg attendance above 85%? 2. Is OT hours trending up or down? 3. Does OT trend match sales trend (cross-module check)? 4. Any department with attendance below 80%? |
| attendance_flagged | 1. How many staff are flagged for chronic lateness? 2. How many flagged for post-public-holiday leave? 3. How many flagged for abnormal OT (>4.5h for 10+ days)? |
| leave_application | 1. How many leave applications this month vs last month? 2. What's the approval rate? 3. Any spike in a specific leave type? |
| leave_analysis | 1. Which leave type is most used? 2. Any staff taking leave right before/after public holidays repeatedly? 3. Any department using more leave than average? |
| leave_balance | 1. How many staff have used less than 30% of annual leave? 2. How many are at risk of forfeiting leave (>80% remaining near year end)? |
| performance_full | 1. What's the average appraisal score? Is it above 0.7? 2. How many high performers (>0.85) vs low performers (<0.6)? 3. Any department with avg score below overall average? |
| disciplinary_records | 1. How many active warnings currently? 2. Which department has the most warnings? 3. What's the most common offence type? |
| disciplinary_analysis | 1. Are warnings increasing or decreasing vs last month? 2. Any staff with 2+ warnings in the same period? 3. Any pattern in timing (e.g., more warnings on certain days)? |
| probation_full | 1. How many staff currently on probation? 2. Any probation reviews overdue? 3. Any reviews due in the next 2 weeks? |
| payroll_overview | 1. What's total payroll cost this month? Up or down vs last month? 2. Which department has the highest payroll cost? 3. Is YoY payroll growth above 10%? |
| payroll_breakdown | 1. What % of payroll is base salary vs OT pay vs allowances? 2. Which component grew the most vs last month? 3. Any department where OT pay exceeds 20% of total payroll? |

---

## 7. Tool Policy

The tool policy controls whether the LLM can make database queries during analysis. See doc 10, §7 for the shared tool-use system.

### Design

HR uses a single tool `query_hr_table` — all data is in local PostgreSQL (no remote RDS like Finance). The tool enforces column whitelisting and a `ROW_LIMIT = 100` per query. The AI can query any date range or filter, but results are capped at 100 rows.

Only Sonnet (summary synthesis) gets tool access. Haiku (component narration) never has tools.

### Three Tiers

| Tier | What the LLM Can Do | When Used |
|------|---------------------|-----------|
| `none` | No tool access. LLM receives only the pre-fetched data block. | Single-day attendance (all data pre-fetched), payroll (page not built). |
| `aggregate_only` | Can query `HR_AGGREGATE_TABLES` only via `query_hr_table`. | Overview/snapshot sections — data is already pre-aggregated, tools for light drill-down. |
| `full` | Can query all whitelisted tables via `query_hr_table`. | Analysis/flagged sections — used for root-cause investigation. |

### Per-Section Assignments

| Section Key | Policy | Rationale |
|-------------|--------|-----------|
| workforce_demographic | aggregate_only | Snapshot KPIs — drill into dept-level counts |
| workforce_movement | aggregate_only | Period trend — joiners/leavers by month |
| attendance_daily | none | Single day, all data pre-fetched |
| attendance_monthly | aggregate_only | Period aggregates — attendance trends, OT patterns |
| attendance_flagged | full | Drill into specific flag categories, dept breakdown |
| leave_application | aggregate_only | Period stats — approval rates, type distribution |
| leave_analysis | full | Outlier investigation needs full table access |
| leave_balance | aggregate_only | Snapshot — balance distributions by type |
| performance_full | full | Score distributions, dept comparisons, YoY changes |
| disciplinary_records | aggregate_only | Snapshot — active warning counts by dept/type |
| disciplinary_analysis | full | Trend investigation, multi-warning patterns |
| probation_full | aggregate_only | Snapshot — overdue/upcoming counts |
| payroll_overview | none | Page not built, tables TBD |
| payroll_breakdown | none | Page not built, tables TBD |

**Pattern:** Snapshot/overview sections use `aggregate_only`. Analysis/flagged sections use `full`. Payroll and daily attendance use `none`.

---

## 8. Data Source Tables

All HR data lives in Prisma-managed PostgreSQL (no remote RDS like Finance).

| Table | Modules | Key Columns |
|-------|---------|-------------|
| `employee_list` | Workforce, Probation | employee_code, name, department, join_date, resign_date, is_active |
| `attendance_list` | Attendance | date, employee_code, clock_in, clock_out, lateness, status, ot_hours |
| `leave_transaction` | Leave | employee_code, leave_type, start_date, end_date, days, apply_status, is_adjacent_holiday |
| `leave_balance` | Leave | employee_code, leave_type, bf, entitled, credits, taken, pending, balance |
| `public_holiday` | Attendance, Leave | date, name |
| `appraisal` | Performance | employee_code, year, score, status, department |
| `appraisal_form_template` | Performance | criteria, weights |
| `hr_warnings` | Disciplinary | employee_code, warning_stage, offence_category, action_type, status, department |
| `hr_offense_categories` | Disciplinary | category, description |
| `probation_settings` | Probation | department, months |
| `hr_settings` | All (thresholds) | category, key, value |

---

## 9. Configurable Thresholds (from `hr_settings`)

Unlike Finance (hardcoded thresholds), HR thresholds are configurable via the Settings UI and stored in `hr_settings`.

**Design:** Fetchers pre-flag data using thresholds. The AI sees flagged/not-flagged results. Thresholds are NOT injected into prompts — the fetcher does the evaluation.

| Category | Used By Section | Default Values |
|----------|----------------|----------------|
| `alert_chronic_lateness` | attendance_flagged | chronic_lateness_threshold = 3 |
| `alert_high_absence` | attendance_flagged | high_absence_threshold = 3 |
| `alert_early_departure` | attendance_flagged | early_departure_threshold = 3 |
| `alert_break_compliance` | attendance_flagged | threshold = 3 |
| `alert_labor_compliance` | attendance_flagged | daily_work_hour_limit = 12h, violation_threshold = 3, dinner_break_window_start = 17:00, dinner_break_window_end = 19:00, dinner_break_min_duration = 30m, ot_dinner_break_cutoff = 21:00 |
| `alert_abnormal_ot` | attendance_flagged | abnormal_ot_hour_threshold = 4.5h, abnormal_ot_flag_threshold = 10 days |
| `alert_leave_pattern` | leave_analysis | leave_abuse_threshold = 3, adjacent_holiday_days = 2 |
| `alert_leave_utilization` | leave_analysis | leave_utilization_low_threshold = 0.3, leave_utilization_high_threshold = 0.9 |
| `analytics_appraisal` | performance_full | top_performer_threshold = 0.85, low_performer_threshold = 0.6 |
| `alert_at_risk` | disciplinary_records | atrisk_weight_warning = 0.5, atrisk_weight_appraisal = 0.3, atrisk_weight_combined = 0.2, atrisk_threshold = 0.3, poor_appraisal_threshold = 0.625 |

---

## 10. Column Whitelisting (Data Protection)

HR uses the same column whitelisting strategy as Finance. See doc 10, §15 for the shared pattern. PII-containing columns are never whitelisted — the LLM cannot access them.

### HR Column Whitelist

Each HR table declares allowed columns. Only these columns appear in fetcher output and tool queries.

| Table | Whitelisted Columns |
|-------|-------------------|
| `employee_list` | `department_code`, `department_description`, `job_title`, `employee_type_code`, `employee_group_title`, `gender`, `nationality_description`, `is_foreigner`, `is_active`, `join_date`, `confirm_date`, `resign_date`, `branch_code`, `branch_description`, `wages_type`, `is_disable` |
| `attendance_list` | `date`, `work_type`, `status`, `shift`, `start_work`, `end_work`, `hour_worked`, `ot`, `lateness`, `early_out` |
| `attendance_upload` | `uploaded_at`, `row_count`, `employee_count`, `date_range_start`, `date_range_end`, `status` |
| `leave_transaction` | `leave_date`, `leave_type_code`, `leave_type_description`, `apply_date`, `apply_status`, `apply_status_description`, `day_no`, `hour_no`, `days`, `is_hourly`, `is_credit`, `is_adjustment`, `is_adjacent_holiday`, `adjacent_holiday_name`, `days_from_holiday` |
| `leave_balance` | `leave_type`, `bf`, `entitled`, `credits`, `expiring_credits`, `expired_credits`, `taken`, `available`, `pending`, `balance_year`, `balance_month` |
| `public_holiday` | `date`, `holiday_name`, `location`, `is_active` |
| `appraisal` | `appraisal_year`, `department`, `job_title`, `appraised_date`, `rating_1`–`rating_20`, `final_score`, `status`, `hr_validated`, `director_validated`, `employee_acknowledged` |
| `appraisal_form_template` | `form_name`, `in_use`, `criteria_1_name`–`criteria_20_name`, `criteria_1_weight`–`criteria_20_weight` |
| `hr_warnings` | `department_code`, `department_description`, `incident_date`, `stage`, `stage_name`, `offense_category`, `status`, `di_required`, `final_decision`, `version`, `created_at` |
| `hr_offense_categories` | `name`, `examples`, `is_default`, `is_active` |

### Aggregate vs Full Table Access

Tables allowed under `aggregate_only` policy (reference + high-level data):

- `employee_list`
- `attendance_list`
- `leave_balance`
- `leave_transaction`
- `public_holiday`
- `hr_offense_categories`

Tables only available under `full` policy (granular drill-down):

- `appraisal`
- `appraisal_form_template`
- `hr_warnings`
- `attendance_upload`

### PII Exclusions — Never Whitelisted

- **Names:** first_name, last_name, full_name, employee_name
- **IDs:** employee_code, employee_id, ic_number, passport_number
- **Contact:** email, phone_number, mobile_number, address fields
- **Salary:** salary, basic_salary, gross_salary, bank_account, account_number

### How It Differs From Finance

Finance whitelists customer/company names because they're needed for actionable insights ("Customer ABC owes RM 500K"). HR does **not** whitelist employee names because department-level analysis suffices ("3 employees in Warehouse are chronically late").

### Additional HR Protection Layer: Pre-Flagging

Backend fetchers pre-compute flagged/not-flagged status against `hr_settings` thresholds before sending to AI. This serves two purposes:
1. **Frontend display** — flagged badges shown in the dashboard UI
2. **AI input** — AI reads flags, not raw threshold values

### Runtime Enforcement

`validateColumns()` rejects any tool call requesting columns not in the whitelist. Enforced at query execution time, not prompt-level.

### Prompt Guidance

Component prompts state: "Employee names/IDs are not included. Focus on aggregate/department-level patterns."

---

## 11. RBAC Scoping (Role-Based Access Control)

| Role | Can Trigger Analysis | Can View Insights |
|------|---------------------|-------------------|
| Superadmin / HR / Director | Yes | Yes |
| Finance | No | Yes |
| Manager | No | Yes |
| Sale / Operation | No | No (403) |

Analysis always runs against all employees (no department scoping). All authorized viewers see the same shared result.

**Implementation (planned):**
- Client-side: `canTriggerAnalysis = ['superadmin', 'hr', 'director'].includes(userRole)`
- Client-side: `canViewInsights = userRole !== 'sale' && userRole !== 'operation'`
- Server-side: role validation on generate/latest endpoints. Unauthorized roles get 403.

See doc 10, §18 for the shared RBAC pattern.

---

## 12. Summary System Prompt

The summary system prompt is used in Phase 2 when Sonnet synthesizes all component results into insight cards. It shares the same base rules as the component prompt (conciseness, no jargon, scope matching, PII ban) plus tool access and output format rules. Full text:

> You are an HR analyst synthesizing HR dashboard data for HR management at Hoi-Yong (Malaysian fruit distribution).
>
> Rules:
> - Be direct, concise, no HR jargon. State facts, not recommendations.
> - Bullet points for observations. Markdown tables for comparisons.
> - Compare at least 3 data points for trends.
> - If data is insufficient, say so.
> - Do NOT re-derive totals. Use values as given.
> - Every number you cite MUST come from the raw data blocks or a tool-call result. Display rounding OK. Never back-solve or invent values.
> - Match your language to the Scope line in the data (daily vs period vs snapshot).
> - Never reference employee names, IDs, or IC numbers. Use department-level or aggregate language only.
>
> ===============================================================================
> TOOL ACCESS
> ===============================================================================
>
> You can query the HR database to find supporting evidence or root causes. Use tools for both positive and negative findings — identify which departments, leave types, offence categories, or months drove the result.
>
> Rules:
> - Maximum 4 tool calls. Stop once you have enough context to explain the finding — do not go deeper than needed.
> - Do not query data already in the raw data blocks.
> - Use `query_hr_table` only. Tables available depend on section tool policy (see §7).
> - Row limit: 100 per query. PII columns are blocked at the whitelist layer.
>
> ===============================================================================
> OUTPUT FORMAT
> ===============================================================================
>
> Use this EXACT delimiter structure (no JSON, no code blocks):
>
> ===INSIGHT===
> sentiment: good|bad
> title: Punchy headline (max 50 chars, no verbs like "is"/"has"/"shows")
> metric: Key number e.g. 84.3%, 12 days, 23 staff (max 25 chars)
> summary: One plain-text sentence — card preview (max 80 chars, no markdown)
> ---DETAIL---
> Concise markdown analysis (max 150 words)
> ===END===
>
> Max 3 good + 3 bad insights. Rank by business impact.
>
> Detail structure (all sections MANDATORY):
>
> **Current Status**: 1-2 bullets with headline number and scope.
>
> **Key Observations**: 2-3 bullets with specific numbers/dates.
>
> **Evidence** (positive) or **Root Cause** (negative):
> - Name top 3-5 contributors (departments, leave types, offence categories). Include a Markdown table (min 3 rows) when top-N data exists.
>
> **Implication**: 1 bullet — bottom-line consequence.
>
> Content rules:
> - Use exact dashboard metric names. No HR jargon.
> - Cross-reference components — synthesize, don't isolate.
> - No contradicting good/bad insights on same metric.
> - Use department-level language only. Never name individual employees.

See doc 10, §12 for the shared `===INSIGHT===` output format and sentiment mapping.

---

## 13. Storage DDL

HR-specific database tables. Same shared-cache structure as Finance — one result per section, no per-user scoping.

```sql
CREATE TABLE hr_ai_insight_section (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  section_key TEXT NOT NULL,
  summary_json JSONB NOT NULL,
  analysis_time_s REAL,
  token_count INT,
  cost_usd REAL,
  period_start TEXT,
  period_end TEXT,
  generated_by TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, section_key)
);

CREATE TABLE hr_ai_insight_component (
  id SERIAL PRIMARY KEY,
  section_id INT REFERENCES hr_ai_insight_section(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL,
  component_type TEXT NOT NULL,
  analysis_md TEXT,
  token_count INT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, component_key)
);
```

Concurrency lock uses the same global lock pattern as Finance. See doc 10, §5 for the shared lock schema and stale expiry logic.

---

## 14. API Routes

```
GET  /api/v1/hr/ai-insight/:module/insights/latest    -- cached or { cached: false }
POST /api/v1/hr/ai-insight/:module/insights/generate   -- SSE stream
```

SSE events: `progress`, `complete`, `error`, `cancelled` (same as Finance — see doc 10, §9 for the shared SSE pattern).

---

## 15. File Structure

Planned file structure for the HR AI Insight module:

```
code/backend/src/modules/hr/ai-insight/
  types.ts              -- HR-specific types
  client.ts             -- Anthropic client config (Haiku + Sonnet)
  prompts.ts            -- Registry + 31 component prompts + summary prompt
  data-fetcher.ts       -- 31 fetcher functions
  orchestrator.ts       -- Phase 1 (parallel components) + Phase 2 (summary)
  numeric-guard.ts      -- Whitelist validation (copy from Finance + add hours unit)
  storage.ts            -- PostgreSQL read/upsert (shared cache, no user scoping)
  lock.ts               -- Global lock (same pattern as Finance)
  column-whitelist.ts   -- HR_LOCAL_WHITELIST + validateColumns()
  settings-loader.ts    -- Batch-fetch hr_settings for threshold pre-flagging
  component-info.ts     -- Static "about" content per component
  response-adapter.ts   -- SummaryJson → E2E-expected format
```

---

## 16. Implementation Sequence

Build order for a developer implementing the HR AI Insight module:

| Step | What | Depends On |
|------|------|------------|
| 1 | `types.ts` + `client.ts` — copy from Finance, adapt types | Nothing |
| 2 | `prompts.ts` — registry (14 sections, 31 components) + all component prompts + summary prompt | types.ts |
| 3 | `settings-loader.ts` — batch query `hr_settings` by categories | Database access |
| 4 | `column-whitelist.ts` — define HR_LOCAL_WHITELIST per table + validateColumns() | types.ts |
| 5 | `data-fetcher.ts` — 31 fetchers (start with Workforce, one module at a time) | settings-loader.ts, column-whitelist.ts |
| 6 | `numeric-guard.ts` — copy from Finance, add `hours` unit | Nothing |
| 7 | `orchestrator.ts` — copy from Finance, remove RDS tool-use logic, add scope/PII threading | All above |
| 8 | `storage.ts` + `lock.ts` — same shared-cache pattern as Finance | Storage tables (DDL from §13) |
| 9 | `response-adapter.ts` — map good/bad sentiment to output format | types.ts |
| 10 | API routes — controller + SSE streaming | orchestrator.ts, lock.ts, storage.ts |
| 11 | `component-info.ts` — static "about" content | Nothing |
| 12 | Frontend — InsightSectionHeader + AiInsightPanel per section | API routes, client.ts |

---

## 17. Verification Plan

### Per-Section Smoke Test

For each of the 14 sections:
1. Click "Analyze" on the section header.
2. Verify SSE stream shows progress events for each component.
3. Verify all components complete (check count matches the catalog in §5).
4. Verify summary produces 1-6 insight cards (good + bad).
5. Verify cached results load on page refresh (GET latest endpoint).
6. Verify component detail dialog shows markdown analysis.

### Fetcher / PII Verification

1. Unit test each fetcher — returns `{ prompt, allowed[] }`, PII stripped, thresholds applied.
2. Column whitelist test — no PII columns in any fetcher output or tool query result.

### Tool Policy Verification

1. For `none` sections: verify no tool calls are made.
2. For `aggregate_only` sections: verify tool calls only access `HR_AGGREGATE_TABLES`.
3. For `full` sections: verify tool calls can access all whitelisted tables.
4. Verify `validateColumns()` rejects queries with non-whitelisted columns.

### Threshold Verification

For each threshold in §9: provide data that triggers the flag and verify the fetcher pre-flags it correctly. The AI should see "flagged" — not re-evaluate raw numbers.

### RBAC Verification

1. Log in as Superadmin/HR/Director: verify "Analyze" button is visible, all data returned.
2. Log in as Finance/Manager: verify "Analyze" button is hidden, but cached insights are viewable.
3. Log in as Sale/Operation: verify 403 response, no insight panel shown.
4. Verify all authorized viewers see the same cached result (shared cache, no per-user scoping).

### Numeric Guard Verification

1. Mock AI response with hallucinated numbers — verify numeric guard catches them.

### Integration / E2E

1. Integration test orchestrator — mock AI responses, verify SSE events + storage writes.
2. E2E test — run against `ai-insight-parity.spec.ts` (response schema matches).
3. Playwright browser verification — click Analyze, verify UI shows insights correctly.
