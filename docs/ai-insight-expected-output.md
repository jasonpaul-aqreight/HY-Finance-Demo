# AI Insight — Expected Output by Page & Section

> **For the team:** This document maps what AI insights to expect when a user clicks "Analyze" on each dashboard section. Each section produces **1–6 insight cards** (max 3 good + 3 bad), ranked by business impact.
>
> **Each insight card contains:** Title → Key Metric → One-line Summary → Detail (Current Status, Key Observations, Supporting Evidence table, Implication).

---

# Part 1: Finance (7 Pages, 16 Sections, 66 Components)

---

## 1. Payment Page (`/payment`)

### Section 1.1 — Collection Trend (`payment_collection_trend`)

**Scope:** Period (user-selected date range) | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Avg Collection Days | Average days to collect payment after invoicing | Good: ≤30 days. Bad: >60 days |
| Collection Rate | % of invoiced amount collected as cash | Good: ≥80%. Bad: <50% |
| Avg Monthly Collection | Average cash collected per month | Good: rising with stable invoicing. Bad: falling |
| Collection Days Trend | Monthly collection days over time (line chart) | Good: falling trend. Bad: rising trend, spikes >60 |
| Invoiced vs Collected | Monthly cash received vs new credit sales (combo chart) | Good: bars above line (clearing AR). Bad: bars below line (accumulating AR) |

**Summary Questions (AI must answer):**
1. Is avg collection days improving or worsening vs last month?
2. Is collection rate above or below 80%?
3. Which month had the worst collection?

---

### Section 1.2 — Outstanding Payment (`payment_outstanding`)

**Scope:** Snapshot (current state, ignores date filter) | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Total Outstanding | Total unpaid invoices across all customers | Evaluate in context of invoicing volume |
| Overdue Amount | Portion past due date + % of total | Good: <20% overdue. Bad: >40% overdue |
| Credit Limit Breaches | Customers exceeding credit limit | Good: 0 breaches. Bad: >0 breaches |
| Aging Analysis | Outstanding grouped by 6 aging buckets (bar chart) | Good: most in "Not Yet Due". Bad: large amounts in 120+ days |
| Credit Usage Distribution | Customer distribution by credit usage (donut) | Good: most within limit. Bad: many over limit or no limit set |
| Customer Credit Health | Per-customer credit health with risk scoring (table) | Good: most Low risk (≥75). Bad: many High risk (≤30) |

**Summary Questions:**
1. How much total is outstanding?
2. What % is in the >60 days bucket?
3. Which customers have the highest outstanding?

---

## 2. Sales Page (`/sales`)

### Section 2.1 — Sales Trend (`sales_trend`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Sales Summary | Net Sales = Invoice + Cash − Credit Notes | Good: CN ratio ≤1%. Bad: CN ratio >3% |
| Net Sales Trend | Stacked bar: Invoice + Cash − CN over time | Good: 3+ months growth. Bad: 3+ months decline |

**Summary Questions:**
1. Is net sales up or down vs last month and vs same month last year?
2. What's the month-over-month growth rate?

---

### Section 2.2 — Sales Breakdown (`sales_breakdown`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Sales by Customer | Top customers by net sales, concentration risk | Good: top 1 <15%. Bad: top 1 >25% |
| Sales by Product | Top products by net sales, product diversity | Good: top 1 <20%. Bad: top 1 >35% |
| Sales by Agent | Agent performance spread and decline detection | Bad: any agent declining >10% vs prior period |
| Sales by Outlet | Location-based sales, geographic diversification | Good: no single outlet >50%. Bad: one outlet >50% |

**Summary Questions:**
1. Does the top customer exceed 25% of total sales?
2. Which product category drives the most revenue?
3. Is credit note ratio below 1%?

---

## 3. Customer Margin Page (`/customer-margin`)

### Section 3.1 — Customer Margin Overview (`customer_margin_overview`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Net Sales | Period net sales with prior-period comparison | Good: growth >5%. Bad: decline >10% |
| Cost of Sales | COGS with prior-period comparison | Bad: COGS rising faster than sales (margin pressure) |
| Gross Profit | Net Sales minus COGS | Good: GP growing with sales. Bad: GP declining while sales grow |
| Gross Margin % | GP / Net Sales × 100 | Good: ≥15%. Bad: <10% |
| Active Customers | Distinct active customer count | Stable = healthy. Fewer customers + steady sales = concentration risk |
| Profitability Trend | Monthly GP bars + Margin % line (chart) | Good: 3+ months GP growth. Bad: margin % down 2+ months |
| Customer Margin Distribution | Customers by margin % bucket (histogram) | Good: most in 10–20%. Bad: >40% below 10%, any in <0% |

**Summary Questions:**
1. Is overall gross margin above 15%?
2. Is margin trending up or down over the last 3 months?
3. How many customers have negative margin?

---

### Section 3.2 — Customer Margin Breakdown (`customer_margin_breakdown`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Top Customers | Top 10 by GP (RM) and by Margin % (efficiency) | Bad: top 1 >15% of total GP (concentration risk) |
| Customer Analysis Table | Bottom 10 customers, loss-makers, margin distribution | Bad: loss-makers >10% of active count |
| Credit Note Impact | Customers ranked by margin erosion from credit notes | Bad: top 5 >50% of total margin lost |

**Summary Questions:**
1. Who are the top 3 customers by gross profit?
2. Who are the bottom 3 by margin %?
3. Any customer with margin below 5%?

---

## 4. Supplier Performance Page (`/supplier-performance`)

### Section 4.1 — Supplier Margin Overview (`supplier_margin_overview`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Est. Net Sales | Sales revenue attributed to active suppliers | Good: growth ≥5%. Bad: drop >10% |
| Est. Cost of Sales | Attributed COGS from active suppliers | Bad only if: COGS rising + sales flat + margin falling |
| Est. Gross Profit | Est. Net Sales minus Est. COGS | Good: GP growing ≥5% with sales. Bad: GP declining while sales grow |
| Gross Margin % | Est. GP / Est. Net Sales × 100 | Good: ≥15%. Bad: <10% or drop ≥2pp |
| Active Suppliers | Distinct suppliers with purchase activity | Drop >10% = flag (verify consolidation vs disruption) |
| Profitability Trend | Monthly Est. GP bars + Margin % line (chart) | Good: 3+ months GP growth. Bad: margin % down 2+ months |
| Margin Distribution | Suppliers AND Items by margin % bucket (histogram) | Analyzes both views and contrasts them. Bad: >40% below 10% |

**Summary Questions:**
1. Is supplier margin above 10%?
2. Is margin trending up or down?
3. How many suppliers have negative margin?

---

### Section 4.2 — Supplier Margin Breakdown (`supplier_margin_breakdown`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Top/Bottom Suppliers & Items | Top/Bottom 10 for suppliers AND items by GP | Bad: top 1 supplier >15% GP, any bottom with profit <0 |
| Supplier Analysis Table | Full supplier table with revenue, COGS, GP, Margin % | Bad: top 10 >60% revenue, loss-making suppliers exist |
| Item Price Comparison | Per-supplier pricing for highest-revenue item | Bad: margin spread >10pp (arbitrage opportunity missed) |
| Purchase vs Selling Price | Scatter: purchase vs sell price vs revenue (top 50 items) | Bad: any top-50 item with margin <0 |

**Summary Questions:**
1. Which supplier gives the best margin?
2. Which items have the biggest gap between purchase and selling price?
3. Any supplier with margin below 5%?

---

## 5. Returns Page (`/return`)

### Section 5.1 — Return Trends (`return_trend`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Total Returns | Period return value + CN count + return rate % | Good: <2% return rate. Bad: >5% |
| Settled | Returns resolved (knock-off + refund) | Good: knock-off >70%. Bad: refund >30% (cash drain) |
| Unsettled | Unresolved return value | Good: <15% unsettled. Bad: >30% |
| Return % | Return value / Net Sales × 100 | Good: <2% (green). Bad: >5% (red) |
| Settlement Breakdown | Three-channel: Knock-off / Refund / Unsettled (chart) | Good: knock-off dominant. Bad: refund or unsettled dominant |
| Monthly Return Trend | Return value + Unsettled by month (area chart) | Bad: unsettled rising while return value flat = process issue |
| Top Returns by Item | Top 10 items by frequency AND value (bar chart) | Bad: top 1 >15% return value. Items on both lists = priority fix |

**Summary Questions:**
1. Is return rate above 5%?
2. Is the return trend increasing or decreasing?
3. Which items have the most returns?

---

### Section 5.2 — Unsettled Returns (`return_unsettled`)

**Scope:** Snapshot | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Aging of Unsettled Returns | Unsettled book by 5 aging buckets (bar chart) | Bad: 91+ days >25% of value, 180+ days >10% (write-off risk) |
| Customer Returns | Per-debtor cumulative return exposure (table) | Bad: top 1 >15% unsettled (single-point risk), stale debtors with zero action |

**Summary Questions:**
1. How much total unsettled returns?
2. What % is older than 60 days?
3. Which customers have the most unsettled returns?

---

## 6. Expenses Page (`/expenses`)

### Section 6.1 — Expense Overview (`expense_overview`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Total Costs | COGS + OpEx for period with YoY | Good: YoY <0%. Bad: YoY >10% |
| Cost of Sales | Variable cost (COGS) with YoY | COGS share 60–80% = typical. Bad: >85% |
| Operating Costs | Semi-fixed costs (OpEx) with YoY | Bad: YoY >10% (structural growth) |
| vs Last Year | YoY total cost change with COGS/OpEx split | Good: <0% (green). Bad: >10% (severe) |
| Cost Trend | Monthly COGS + OpEx stacked bars (chart) | Bad: MoM growth >15% |
| Cost Composition | COGS/OpEx donut with prior-year drift | Bad: COGS share drift >+3pp while sales flat |
| Top Expenses | Top 10 GL accounts by net cost (bar chart) | Bad: top 1 >30% of total (severe concentration) |

**Summary Questions:**
1. Is total cost up or down vs same period last year?
2. Which cost category grew the most?
3. What are the top 3 expenses?

---

### Section 6.2 — Expense Breakdown (`expense_breakdown`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Cost of Sales Breakdown | Every COGS GL account with share of total (table) | Bad: top 1 account >50% of COGS |
| Operating Costs Breakdown | Every OpEx GL account grouped by category (table) | Bad: top 1 category >50% of OpEx, any negative-value accounts |

**Summary Questions:**
1. What's the COGS to revenue ratio?
2. Which OpEx line item is the largest?
3. Any expense category with >10% YoY increase?

---

## 7. Financial Statements Page (`/financial`)

### Section 7.1 — Financial Overview (`financial_overview`)

**Scope:** Fiscal period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| P&L Summary | Full P&L waterfall: Sales → COGS → GP → OpEx → Operating Profit → Net Profit | Good: operating margin 5–10%. Bad: gross margin <15%, net margin <0% |
| Monthly P&L Trend | Monthly Net Sales, COGS, GP, OpEx, Operating Profit (chart) | Bad: any loss month, loss months >30% of total |

**Summary Questions:**
1. Is net profit positive or negative?
2. Is profit margin improving or declining?

---

### Section 7.2 — Profit & Loss Detail (`financial_pnl`)

**Scope:** Fiscal period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| P&L Statement | Full P&L by account type with YoY comparison | Bad: group YoY >±15%, any sign flip (profit→loss) |
| Multi-Year Comparison | 4-fiscal-year P&L with CAGR + margin drift | Bad: 3+ consecutive NP declines, NPAT sign flip |

**Summary Questions:**
1. Which revenue line changed the most vs last year?
2. Which expense line changed the most?
3. Is gross profit margin stable?

---

### Section 7.3 — Balance Sheet (`financial_balance_sheet`)

**Scope:** Fiscal period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Assets, Liabilities & Equity Trend | Monthly 3-line series (chart) | Bad: liabilities > assets (insolvency), equity declining 3+ months |
| Balance Sheet Statement | Full BS with solvency ratios (table) | Bad: current ratio <1.0, debt-to-equity >2.0, net current assets sign flip |

**Summary Questions:**
1. Are total assets growing?
2. Is current ratio above 1.5?
3. Is debt increasing or decreasing?

---

### Section 7.4 — Variance, Forecast & Budget (`financial_variance`)

**Scope:** Fiscal period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| P&L Variance Summary | Actual vs prior year + budget (if exists) | Good: within ±5%. Bad: >±15% or sign flip |
| Variance by Account | Account-level variance drivers per category | Bad: top 3 accounts >70% of category variance |
| Trend Forecast | 12-month projection (weighted moving average) | Strong signal: consistent 4+ months. Bad: forecast projects sign flip |
| AI Budget Suggestions | AI-generated annual budget based on actuals | Compare against approved budget if exists; highlights material differences |

**Summary Questions:**
1. Which accounts missed budget by more than 15%?
2. Is the total variance favorable or unfavorable?
3. What's the biggest single variance item?

---
---

# Part 2: HR (7 Pages, 14 Sections, 31 Components)

---

## 1. Workforce Page (`/hr-dashboard/workforce`)

### Section 1.1 — Demographic (`workforce_demographic`)

**Scope:** Snapshot | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Workforce KPIs | Total Employees, Active Departments, Average Tenure | Good: tenure >3yr (stable). Bad: tenure <2yr (high turnover signal) |
| Overall Demographics | Distribution by Gender, Nationality, Age, Tenure, Group (pie chart) | Bad: any single category >70% (low diversity) |
| Department Breakdown | Per-department headcount with demographic split (bar chart) | Bad: any dept >40% of total (concentration risk) |

**Summary Questions:**
1. Is headcount growing or shrinking vs last month?
2. Is average tenure above 3 years?
3. Any department with less than 3 staff?

---

### Section 1.2 — Movement (`workforce_movement`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Joiners & Leavers Trend | Monthly new hires vs resignations over 12 months (chart) | Bad: leavers > joiners for 3+ months (attrition concern) |

**Summary Questions:**
1. How many joiners vs leavers this month?
2. Is there a department losing more people than others?
3. What's the turnover rate?

---

## 2. Attendance Page (`/hr-dashboard/attendance`)

### Section 2.1 — Daily Summary (`attendance_daily`)

**Scope:** Daily (date picker) | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Daily KPI Cards | Present, On Leave, Absent, Worked Hours, OT Hours, Punctuality Violations, Dinner Break Violations | Bad: attendance rate <85%, OT >4.5h avg |
| Daily Attendance Table | Per-employee attendance for selected date (aggregate patterns only, no names) | Bad: clusters of lateness in specific departments |

**Summary Questions:**
1. What's today's attendance rate? Is it below 85%?
2. How many staff are late today?
3. How many are on OT?

---

### Section 2.2 — Monthly/Yearly Summary (`attendance_monthly`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Monthly Summary KPIs | Present Days, Leave Days, Off Days, Absence Days, OT, Violations | Bad: month avg attendance <85% |
| Attendance & Hours Trends | Daily attendance rate + worked/OT hours over month (line charts) | Bad: declining attendance trend, OT spike |
| Monthly Summary Table | Per-employee monthly breakdown (aggregate patterns, no names) | Bad: OT concentrated in specific departments |
| OT vs Sales Trend | Monthly OT hours alongside monthly sales revenue (cross-module) | Good: OT up + sales up (busier). Bad: OT up + sales flat/down (efficiency concern) |

**Summary Questions:**
1. Is monthly avg attendance above 85%?
2. Is OT hours trending up or down?
3. Does OT trend match sales trend (cross-module check)?
4. Any department with attendance below 80%?

---

### Section 2.3 — Flagged Staff (`attendance_flagged`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Flagged Employees Summary | Combined view of 5 alert types: High Absence, Chronic Lateness, Early Departure, Break Compliance, Abnormal OT | Bad: flags concentrated in specific departments, total flag count growing, employees in multiple categories |

**Summary Questions:**
1. How many staff are flagged for chronic lateness?
2. How many flagged for post-public-holiday leave?
3. How many flagged for abnormal OT (>4.5h for 10+ days)?

---

## 3. Leave Page (`/hr-dashboard/leave`)

### Section 3.1 — Application (`leave_application`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Leave KPIs | Pending Approval count, Upcoming Leave count | Bad: pending >10 (backlog) |
| Upcoming Leave | Approved future leaves with dates and timing (table) | Bad: overlapping leaves in same department (coverage gap) |
| Leave Applications | Filtered applications with status, type, holiday adjacency warnings (table) | Bad: rejection rate >15% (process issue) |

**Summary Questions:**
1. How many leave applications this month vs last month?
2. What's the approval rate?
3. Any spike in a specific leave type?

---

### Section 3.2 — Analysis (`leave_analysis`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Monthly Leave Breakdown | Donut (overall distribution) + stacked bar (monthly trend by type/status) | Bad: sick leave >30% of total, unpaid >10% |
| Leave Utilization Outliers | Statistical outlier detection — high and low usage per leave type (table) | High usage = burnout/abuse signal. Low usage = presenteeism risk |
| Near-PH Leave Patterns | Employees frequently taking leave adjacent to public holidays (table) | Bad: flagged count growing, concentrated in specific departments |

**Summary Questions:**
1. Which leave type is most used?
2. Any staff taking leave right before/after public holidays repeatedly?
3. Any department using more leave than average?

---

### Section 3.3 — Balance (`leave_balance`)

**Scope:** Snapshot | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Leave Balance Summary | Per-employee balance across all leave types: BF + Entitled + Credits − Taken − Pending = Balance (table) | Bad: many near-zero AL balance (unpaid leave risk), many high unused balance (forfeiture risk) |

**Summary Questions:**
1. How many staff have used less than 30% of annual leave?
2. How many are at risk of forfeiting leave (>80% remaining near year end)?

---

## 4. Performance Page (`/hr-dashboard/performance`)

### Section 4.1 — Full Page (`performance_full`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Performance KPIs | Average Score, High Performers, Low Performers, Completion Rate | Good: avg >0.7, high > low. Bad: completion rate low |
| Performance Table | Employee-level scores with YoY change direction, status (table) | Bad: many "Not Appraised" or declining departments |
| Performance Charts | Score distribution (bar) + avg score by department (line with overall avg reference) | Good: bell-shaped distribution. Bad: skewed, departments below overall avg |

**Summary Questions:**
1. What's the average appraisal score? Is it above 0.7?
2. How many high performers (>0.85) vs low performers (<0.6)?
3. Any department with avg score below overall average?

---

## 5. Disciplinary Page (`/hr-dashboard/disciplinary`)

### Section 5.1 — Records/KPIs (`disciplinary_records`)

**Scope:** Snapshot | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Disciplinary KPIs | Pending Approval, Under Coaching, At Risk (2nd/3rd warning counts) | Bad: At Risk >0, Pending >5 |
| Active Warnings | Current warning records with type, offence, status (table) | Bad: warnings concentrated in specific departments or offence types |

**Summary Questions:**
1. How many active warnings currently?
2. Which department has the most warnings?
3. What's the most common offence type?

---

### Section 5.2 — Analysis (`disciplinary_analysis`)

**Scope:** Period | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Disciplinary Trends | Donut (overall by category) + stacked bar (monthly trend) | Bad: rising monthly trend, seasonal spikes, one department disproportionate |

**Summary Questions:**
1. Are warnings increasing or decreasing vs last month?
2. Any staff with 2+ warnings in the same period?
3. Any pattern in timing (e.g., more warnings on certain days)?

---

## 6. Probation Page (`/probation`)

### Section 6.1 — Full Page (`probation_full`)

**Scope:** Snapshot | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Probation KPIs | Under Probation (Just Join / Mid Way), Overdue count | Bad: overdue >0 (critical), overdue/total >20% (systemic failure) |
| Probation Records | Employee probation status: period, remaining days, status, action (table) | Bad: negative remaining days (overdue), <14 days remaining (urgent) |

**Summary Questions:**
1. How many staff currently on probation?
2. Any probation reviews overdue?
3. Any reviews due in the next 2 weeks?

---

## 7. Payroll Page (`/hr-dashboard/payroll`) — NOT YET BUILT

> Payroll page and database tables are not yet built. Sections below show planned spec only.

### Section 7.1 — Overview (`payroll_overview`) — NOT YET BUILT

**Scope:** Period | **Tool policy:** none (no tables yet) | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Payroll Total KPIs | Total payroll cost, headcount, avg cost per employee | Bad: YoY growth >10% |
| Department Payroll Waterfall | Payroll cost breakdown by department (chart) | Bad: any dept >40% of total |
| Payroll YoY Trend | Monthly payroll cost over 12 months with YoY (chart) | Bad: rising faster than headcount growth |

**Summary Questions:**
1. What's total payroll cost this month? Up or down vs last month?
2. Which department has the highest payroll cost?
3. Is YoY payroll growth above 10%?

---

### Section 7.2 — Breakdown (`payroll_breakdown`) — NOT YET BUILT

**Scope:** Period | **Tool policy:** none (no tables yet) | **Insight cards:** 1–6

| Component | What AI Checks | Good / Bad Triggers |
|-----------|---------------|-------------------|
| Payroll Component Breakdown | Split into base salary, OT pay, allowances, claims (chart) | Bad: OT pay >20% of total in any dept |
| Payroll Cost Drivers | Top cost-increasing factors vs prior period (table) | Bad: any single factor >50% of total increase |

**Summary Questions:**
1. What % of payroll is base salary vs OT pay vs allowances?
2. Which component grew the most vs last month?
3. Any department where OT pay exceeds 20% of total payroll?

---

## Quick Reference — Totals

| | Pages | Sections | Components | Insight Cards per Section |
|---|---|---|---|---|
| **Finance** | 7 | 16 | 66 | 1–6 (max 3 good + 3 bad) |
| **HR** | 7 | 14 | 31 | 1–6 (max 3 good + 3 bad) |
| **Total** | 14 | 30 | 97 | — |
