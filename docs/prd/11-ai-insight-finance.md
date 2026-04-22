# AI Insight Engine — Finance Configuration

> Finance-specific configuration for the AI Insight Engine (see [10-ai-insight-base.md](10-ai-insight-base.md) for the shared platform). Covers all 7 modules, 16 sections, and 66 components deployed on the Hoi-Yong Finance dashboard.

---

## 1. Overview

The Finance configuration plugs into the base AI Insight Engine (doc 10) to provide automated analysis across seven dashboard modules:

| # | Module | Page | Sections | Components |
|---|--------|------|----------|------------|
| 1 | Payment | payment | 2 | 11 |
| 2 | Sales | sales | 2 | 6 |
| 3 | Customer Margin | customer-margin | 2 | 10 |
| 4 | Supplier Performance | supplier-performance | 2 | 11 |
| 5 | Returns | return | 2 | 9 |
| 6 | Expenses | expenses | 2 | 9 |
| 7 | Financial Statements | financial | 4 | 10 |

**Totals:** 16 sections, 66 components across 7 modules.

---

## 2. Analysis Persona

The global system prompt defines the persona:

> "You are a senior financial analyst reviewing a dashboard for a Malaysian fruit distribution company (Hoi-Yong). You are explaining what you see to a senior director."

### Prompt Rules

| Rule | Detail |
|------|--------|
| Currency | Malaysian Ringgit (RM) with thousands separators |
| Language | Direct, concise, no jargon |
| Format | Bullet points for observations, markdown tables for comparisons |
| Component word limit | Max 150 words |
| Summary detail word limit | 220–320 words |
| Verbatim-copy rule | Every number must match a value from the data block (display rounding OK) |
| Scope discipline | Period-based vs snapshot vs fiscal-period — language must match the scope type |
| Sub-period citation ban | Cannot define custom sub-periods and average them manually |
| Self-verification | Cross-check numbers, arithmetic, and scope before writing |

---

## 3. Scope Assignments

| Scope | Sections |
|-------|----------|
| `period` | payment_collection_trend, sales_trend, sales_breakdown, customer_margin_overview, customer_margin_breakdown, supplier_margin_overview, supplier_margin_breakdown, return_trend, expense_overview, expense_breakdown |
| `snapshot` | payment_outstanding, return_unsettled |
| `fiscal_period` | financial_overview, financial_pnl, financial_balance_sheet, financial_variance |

See doc 10, §13 for scope type definitions.

---

## 4. Section & Component Catalog

### 4.1 Payment Collection Trend

| | |
|---|---|
| **Section Key** | `payment_collection_trend` |
| **Page** | payment |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_ar_monthly |
| **Components** | 5 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| avg_collection_days | Avg Collection Days | kpi | Average days to collect payment after invoicing | ≤30 Good, ≤60 Warning, >60 Critical |
| collection_rate | Collection Rate | kpi | Percentage of invoiced amount collected as cash | ≥80% Good, ≥50% Warning, <50% Critical |
| avg_monthly_collection | Avg Monthly Collection | kpi | Average cash collected per month | No fixed threshold |
| collection_days_trend | Avg Collection Days Trend | chart | Monthly collection days over time | Rising = bad, Falling = good, >60 spike = critical |
| invoiced_vs_collected | Invoiced vs Collected | chart | Monthly cash received vs new credit sales | Bars below line = accumulating AR, above = clearing |

---

### 4.2 Outstanding Payment

| | |
|---|---|
| **Section Key** | `payment_outstanding` |
| **Page** | payment |
| **Scope** | snapshot |
| **Tool Policy** | full |
| **Data Sources** | pc_ar_customer_snapshot, pc_ar_aging_history |
| **Components** | 6 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| total_outstanding | Total Outstanding | kpi | Total unpaid invoices across all customers | Snapshot, evaluate in context |
| overdue_amount | Overdue Amount | kpi | Portion past due date | <20% acceptable, >40% critical |
| credit_limit_breaches | Credit Limit Breaches | kpi | Customers exceeding credit limit | 0 = Good, >0 = Concern |
| aging_analysis | Aging Analysis | chart | Outstanding grouped by aging buckets (6 buckets) | Most in "Not Yet Due" = healthy |
| credit_usage_distribution | Credit Usage Distribution | chart | Customer distribution by credit usage | Most within limit = healthy |
| customer_credit_health | Customer Credit Health | table | Per-customer credit health with risk scoring (11 columns) | Low ≥75, Moderate 31–74, High ≤30 |

---

### 4.3 Sales Trend

| | |
|---|---|
| **Section Key** | `sales_trend` |
| **Page** | sales |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_sales_daily |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| sales_summary | Sales Summary | kpi | Net Sales = Invoice + Cash − Credit Notes | CN ratio: ≤1% Good, 1–3% Monitor, >3% Concern |
| net_sales_trend | Net Sales Trend | chart | Stacked bar: Invoice + Cash − CN over time | 3+ months growth = Good, 3+ decline = Bad |

---

### 4.4 Sales Breakdown

| | |
|---|---|
| **Section Key** | `sales_breakdown` |
| **Page** | sales |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_sales_by_customer, pc_sales_by_fruit, pc_sales_by_outlet, pc_sales_daily |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| by_customer | Sales by Customer | breakdown | Top customers by net sales | Top 1 <15% = Good, >25% = Bad |
| by_product | Sales by Product | breakdown | Top products by net sales | Top 1 <20% = Good, >35% = Bad |
| by_agent | Sales by Agent | breakdown | Agent performance comparison | Evaluate spread and decline |
| by_outlet | Sales by Outlet | breakdown | Location-based sales | No single outlet >50% |

---

### 4.5 Customer Margin Overview

| | |
|---|---|
| **Section Key** | `customer_margin_overview` |
| **Page** | customer-margin |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_customer_margin |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| cm_net_sales | Net Sales | kpi | Period net sales across active customers | Growth >5% = Good, Decline = Bad |
| cm_cogs | Cost of Sales | kpi | Landed cost of goods sold | COGS rising faster than sales = margin pressure |
| cm_gross_profit | Gross Profit | kpi | Net Sales minus COGS | Growing with sales = Good |
| cm_margin_pct | Gross Margin % | kpi | GP / Net Sales × 100 | ≥15% = Good, 10–15% = Neutral, <10% = Bad |
| cm_active_customers | Active Customers | kpi | Distinct active customer count | Stability is baseline |
| cm_margin_trend | Profitability Trend | chart | Monthly GP bars + Margin % line | 3+ months GP growth = Good |
| cm_margin_distribution | Customer Margin Distribution | chart | Customers by margin % bucket | Most in 10–20% = Healthy |

---

### 4.6 Customer Margin Breakdown

| | |
|---|---|
| **Section Key** | `customer_margin_breakdown` |
| **Page** | customer-margin |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_customer_margin |
| **Components** | 3 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| cm_top_customers | Top Customers | chart | Top 10 by GP (RM) and by Margin % (efficiency) | Top 1 >15% GP = concentration risk |
| cm_customer_table | Customer Analysis Table | table | Full customer table with revenue, COGS, GP, Margin %, Return Rate | Loss-makers >10% = Bad |
| cm_credit_note_impact | Credit Note Impact | table | Customers ranked by margin erosion from credit notes | Top 5 >50% total margin lost = Concentrated CN problem |

---

### 4.7 Supplier Margin Overview

| | |
|---|---|
| **Section Key** | `supplier_margin_overview` |
| **Page** | supplier-performance |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_supplier_margin |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| sp_net_sales | Est. Net Sales | kpi | Sales revenue attributed to active suppliers | Growth ≥5% = Good, Drop >10% = Flag |
| sp_cogs | Est. Cost of Sales | kpi | Attributed COGS from active suppliers | Rising COGS NOT automatically bad on supplier page |
| sp_gross_profit | Est. Gross Profit | kpi | Est. Net Sales minus Est. COGS | Growing with sales = Good |
| sp_margin_pct | Gross Margin % | kpi | Est. GP / Est. Net Sales × 100 | ≥15% = Good, <10% = Bad, ≥2pp drop = Flag |
| sp_active_suppliers | Active Suppliers | kpi | Distinct suppliers with purchase activity | Shrinking NOT automatically bad (consolidation) |
| sp_margin_trend | Profitability Trend | chart | Monthly Est. GP bars + Margin % line | 3+ months GP growth = Good |
| sp_margin_distribution | Margin Distribution | chart | Suppliers AND Items by margin % bucket | Both views analyzed |

---

### 4.8 Supplier Margin Breakdown

| | |
|---|---|
| **Section Key** | `supplier_margin_breakdown` |
| **Page** | supplier-performance |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_supplier_margin, raw invoice/cash-sale line items |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| sm_top_bottom | Top/Bottom Suppliers & Items | chart | Top/Bottom 10 for suppliers AND items by GP | Top 1 >15% GP = concentration |
| sm_supplier_table | Supplier Analysis Table | table | Full supplier table with revenue, COGS, GP, Margin % | Top 10 >60% revenue = concentrated |
| sm_item_pricing | Item Price Comparison | breakdown | Per-supplier pricing for highest-revenue item | Margin spread >10pp = arbitrage |
| sm_price_scatter | Purchase vs Selling Price | chart | Item scatter: purchase price vs sell price vs revenue | Top-50 items margin <0 = Always flag |

---

### 4.9 Return Trends

| | |
|---|---|
| **Section Key** | `return_trend` |
| **Page** | return |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_return_monthly, pc_return_products |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| rt_total_returns | Total Returns | kpi | Period return value + CN count | Return rate: <2% = Good, >5% = Concern |
| rt_settled | Settled | kpi | Returns resolved (knock-off + refund) | Knock-off >70% = Healthy, Refund >30% = Concern |
| rt_unsettled | Unsettled | kpi | Unresolved return value | <15% = Healthy, >30% = Concern |
| rt_return_pct | Return % | kpi | Return value / Net Sales × 100 | <2% = Green, 2–5% = Amber, >5% = Red |
| rt_settlement_breakdown | Settlement Breakdown | chart | Three-channel: Knock-off / Refund / Unsettled | Knock-off >70% = Healthy |
| rt_monthly_trend | Monthly Return Trend | chart | Return value + Unsettled by month | Unsettled rising while value flat = Process issue |
| rt_product_bar | Top Returns by Item | chart | Top 10 items by frequency AND value | Top 1 >15% return value = Severe |

---

### 4.10 Unsettled Returns

| | |
|---|---|
| **Section Key** | `return_unsettled` |
| **Page** | return |
| **Scope** | snapshot |
| **Tool Policy** | full |
| **Data Sources** | pc_return_aging, pc_return_by_customer |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| ru_aging_chart | Aging of Unsettled Returns | chart | Unsettled book by aging bucket (5 buckets, snapshot) | 91+ >25% = Watch, 180+ >10% = Write-off risk |
| ru_debtors_table | Customer Returns | table | Per-debtor cumulative return exposure (snapshot) | Top 1 >15% unsettled = Single-point risk |

---

### 4.11 Expense Overview

| | |
|---|---|
| **Section Key** | `expense_overview` |
| **Page** | expenses |
| **Scope** | period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_expense_monthly |
| **Components** | 7 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| ex_total_costs | Total Costs | kpi | COGS + OpEx for period | YoY: <0% = Healthy, >10% = Severe |
| ex_cogs | Cost of Sales | kpi | Variable cost (acc_type = 'CO') | COGS share 60–80% = Typical, >85% = Pressure |
| ex_opex | Operating Costs | kpi | Semi-fixed costs (acc_type = 'EP') | YoY >10% = Concern |
| ex_yoy_costs | vs Last Year | kpi | Year-over-year total cost change | <0% = Green, >10% = Severe |
| ex_cost_trend | Cost Trend | chart | Monthly COGS + OpEx stacked bars | MoM >15% = Concern |
| ex_cost_composition | Cost Composition | chart | COGS/OpEx donut with prior-year drift | COGS share drift >+3pp = margin compression |
| ex_top_expenses | Top Expenses | chart | Top 10 GL accounts by net cost | Top 1 >30% = Severe concentration |

---

### 4.12 Expense Breakdown

| | |
|---|---|
| **Section Key** | `expense_breakdown` |
| **Page** | expenses |
| **Scope** | period |
| **Tool Policy** | full |
| **Data Sources** | pc_expense_monthly |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| ex_cogs_table | Cost of Sales Breakdown | table | Every COGS GL account with share of total | Top 1 >50% = Severe |
| ex_opex_table | Operating Costs Breakdown | table | Every OpEx GL account grouped by category taxonomy | Top 1 category >50% = Dominant |

---

### 4.13 Financial Overview

| | |
|---|---|
| **Section Key** | `financial_overview` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| fin_pnl_summary | P&L Summary | kpi | Full P&L waterfall for fiscal window | Multiple margin thresholds |
| fin_monthly_trend | Monthly P&L Trend | chart | Monthly Net Sales, COGS, GP, OpEx, Operating Profit | Any loss month = Watch |

---

### 4.14 Profit & Loss Detail

| | |
|---|---|
| **Section Key** | `financial_pnl` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| fin_pl_statement | Profit & Loss Statement | table | Full P&L by account type with YoY | Group YoY >±15% = Material |
| fin_yoy_comparison | Multi-Year Comparison | table | 4-fiscal-year P&L with CAGR + margin drift | 3+ consecutive NP declines = Severe |

---

### 4.15 Balance Sheet

| | |
|---|---|
| **Section Key** | `financial_balance_sheet` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period |
| **Components** | 2 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| bs_trend | Assets, Liabilities & Equity Trend | chart | Monthly Assets/Liabilities/Equity series | Liabilities > Assets = Severe |
| bs_statement | Balance Sheet Statement | table | Full BS with solvency ratios | Current Ratio <1.0 = Severe |

---

### 4.16 Variance, Forecast & Budget

| | |
|---|---|
| **Section Key** | `financial_variance` |
| **Page** | financial |
| **Scope** | fiscal_period |
| **Tool Policy** | aggregate_only |
| **Data Sources** | pc_pnl_period, budget table |
| **Components** | 4 |

| Key | Name | Type | What It Measures | Thresholds |
|-----|------|------|-----------------|------------|
| fv_variance_summary | P&L Variance Summary | kpi | Actual vs prior year + budget (if exists) | ±5% = On Track, >±15% = Material |
| fv_variance_breakdown | Variance by Account | table | Account-level variance drivers per category | Top 3 >70% = Highly concentrated |
| fv_trend_forecast | Trend Forecast | kpi | 12-month projection (weighted moving average) | Consistent 4+ months = Strong signal |
| fv_budget_suggestions | AI Budget Suggestions | kpi | AI-generated annual budget based on actuals | Compare against approved budget if exists |

**Special behavior:** After analysis completes for this section, a "Save as Budget" button appears allowing the user to approve the AI-generated budget suggestions for the fiscal year. See §6 for details.

---

## 5. Tool Policy by Section

| Section Key | Policy | Accessible Tables |
|-------------|--------|-------------------|
| payment_collection_trend | aggregate_only | pc_ar_monthly |
| payment_outstanding | full | All local pc_* + all RDS dbo.* |
| sales_trend | aggregate_only | pc_sales_daily |
| sales_breakdown | full | All local pc_* + all RDS dbo.* |
| customer_margin_overview | aggregate_only | pc_customer_margin |
| customer_margin_breakdown | full | All local pc_* + all RDS dbo.* |
| supplier_margin_overview | aggregate_only | pc_supplier_margin |
| supplier_margin_breakdown | full | All local pc_* + all RDS dbo.* |
| return_trend | aggregate_only | pc_return_monthly, pc_return_products |
| return_unsettled | full | All local pc_* + all RDS dbo.* |
| expense_overview | aggregate_only | pc_expense_monthly |
| expense_breakdown | full | All local pc_* + all RDS dbo.* |
| financial_overview | aggregate_only | pc_pnl_period |
| financial_pnl | aggregate_only | pc_pnl_period |
| financial_balance_sheet | aggregate_only | pc_pnl_period |
| financial_variance | aggregate_only | pc_pnl_period |

**Pattern:** "Overview" sections use `aggregate_only`. "Breakdown" sections use `full` (both local and RDS access). All Financial sections use `aggregate_only`.

---

## 6. Budget Approval Flow

Applies only to the `financial_variance` section.

After analysis completes:

1. A blue banner appears below the insight panel: "Save the AI-generated budget suggestions as the approved budget for {fiscalYear}?"
2. User clicks "Approve as Budget" → POST `/api/budget/save` with `{ fiscalYear }`.
3. Button states: idle → saving → saved → error (retry).
4. Only visible when: section is `financial_variance`, analysis is complete, and the panel is expanded.

### Budget API Endpoints

| Method | Path | Purpose | Request / Response |
|--------|------|---------|-------------------|
| POST | `/api/budget/save` | Upsert AI-generated budget lines for a fiscal year | `{ fiscalYear }` → computes headline P&L lines, upserts to `budget` table |
| GET | `/api/budget/:fiscalYear` | Retrieve saved budget for a fiscal year | → `BudgetRow[]` (empty array if none) |

---

## 7. Data Source Tables

### 7.1 Local PostgreSQL (pre-computed, `pc_*`)

| Table | Module | Key Columns |
|-------|--------|-------------|
| pc_sales_daily | Sales | doc_date, invoice_total, cash_total, cn_total, net_revenue, doc_count |
| pc_sales_by_customer | Sales | doc_date, debtor_code, company_name, debtor_type, sales_agent, invoice_sales, cash_sales, credit_notes, total_sales |
| pc_sales_by_outlet | Sales | doc_date, dimension, dimension_key, dimension_label, invoice_sales, cash_sales, credit_notes, total_sales, customer_count |
| pc_sales_by_fruit | Sales | doc_date, fruit_name, fruit_country, fruit_variant, invoice_sales, cash_sales, credit_notes, total_sales, total_qty |
| pc_ar_monthly | Payment | month, invoiced, collected, cn_applied, refunded, total_outstanding, total_billed, customer_count |
| pc_ar_customer_snapshot | Payment | debtor_code, company_name, debtor_type, sales_agent, credit_limit, total_outstanding, overdue_amount, credit_score, risk_tier |
| pc_ar_aging_history | Payment | snapshot_date, bucket, dimension, dimension_key, invoice_count, total_outstanding |
| pc_customer_margin | Customer Margin | month, debtor_code, company_name, iv_revenue, dn_revenue, cn_revenue, iv_cost, dn_cost, cn_cost |
| pc_supplier_margin | Supplier Perf. | month, creditor_code, creditor_name, item_code, item_group, sales_revenue, attributed_cogs, purchase_qty, purchase_value |
| pc_return_monthly | Returns | month, cn_count, cn_total, knock_off_total, refund_total, unresolved_total |
| pc_return_products | Returns | month, item_code, item_description, fruit_name, cn_count, total_qty, total_amount |
| pc_return_aging | Returns | snapshot_date, bucket, count, amount |
| pc_return_by_customer | Returns | month, debtor_code, company_name, cn_count, cn_total, knock_off_total, refund_total, unresolved |
| pc_expense_monthly | Expenses | month, acc_no, account_name, acc_type, net_amount |
| pc_pnl_period | Financial | period_no, acc_type, acc_no, account_name, parent_acc_no, home_dr, home_cr, proj_no |
| budget | Financial | fiscal_year, line_item, annual_budget, monthly_budget, updated_at |

### 7.2 Remote SQL Server (RDS, transaction detail)

| Table | Module | Key Columns | Required Filter |
|-------|--------|-------------|----------------|
| dbo.IV | Invoices | DocNo, DocDate, DebtorCode, LocalNetTotal, SalesAgent | Cancelled = 'F' |
| dbo.CS | Cash Sales | DocNo, DocDate, DebtorCode, LocalNetTotal, SalesAgent | Cancelled = 'F' |
| dbo.CN | Credit Notes | DocNo, DocDate, DebtorCode, LocalNetTotal, CNType | Cancelled = 'F' |
| dbo.ARInvoice | AR Invoices | DocNo, DocDate, DueDate, DebtorCode, Outstanding | Cancelled = 'F' |
| dbo.ARPayment | AR Payments | DocNo, DocDate, DebtorCode, LocalPaymentAmt | Cancelled = 'F' |
| dbo.ARPaymentKnockOff | Payment KO | DocKey, KnockOffDocKey, KnockOffAmt, KnockOffDate | — |

**Aggregate-only tables (9):** pc_sales_daily, pc_ar_monthly, pc_ar_aging_history, pc_customer_margin, pc_supplier_margin, pc_return_monthly, pc_return_products, pc_expense_monthly, pc_pnl_period

---

## 8. Deterministic Summary Questions

Each section has fixed questions the AI must answer during summary synthesis. This makes the summary output predictable — same data always answers the same questions. See doc 10, §16 for the shared pattern.

| Section | Summary Questions |
|---------|-------------------|
| payment_collection_trend | 1. Is avg collection days improving or worsening vs last month? 2. Is collection rate above or below 80%? 3. Which month had the worst collection? |
| payment_outstanding | 1. How much total is outstanding? 2. What % is in the >60 days bucket? 3. Which customers have the highest outstanding? |
| sales_trend | 1. Is net sales up or down vs last month and vs same month last year? 2. What's the month-over-month growth rate? |
| sales_breakdown | 1. Does the top customer exceed 25% of total sales? 2. Which product category drives the most revenue? 3. Is credit note ratio below 1%? |
| customer_margin_overview | 1. Is overall gross margin above 15%? 2. Is margin trending up or down over the last 3 months? 3. How many customers have negative margin? |
| customer_margin_breakdown | 1. Who are the top 3 customers by gross profit? 2. Who are the bottom 3 by margin %? 3. Any customer with margin below 5%? |
| supplier_margin_overview | 1. Is supplier margin above 10%? 2. Is margin trending up or down? 3. How many suppliers have negative margin? |
| supplier_margin_breakdown | 1. Which supplier gives the best margin? 2. Which items have the biggest gap between purchase and selling price? 3. Any supplier with margin below 5%? |
| return_trend | 1. Is return rate above 5%? 2. Is the return trend increasing or decreasing? 3. Which items have the most returns? |
| return_unsettled | 1. How much total unsettled returns? 2. What % is older than 60 days? 3. Which customers have the most unsettled returns? |
| expense_overview | 1. Is total cost up or down vs same period last year? 2. Which cost category grew the most? 3. What are the top 3 expenses? |
| expense_breakdown | 1. What's the COGS to revenue ratio? 2. Which OpEx line item is the largest? 3. Any expense category with >10% YoY increase? |
| financial_overview | 1. Is net profit positive or negative? 2. Is profit margin improving or declining? |
| financial_pnl | 1. Which revenue line changed the most vs last year? 2. Which expense line changed the most? 3. Is gross profit margin stable? |
| financial_balance_sheet | 1. Are total assets growing? 2. Is current ratio above 1.5 (can pay short-term debts)? 3. Is debt increasing or decreasing? |
| financial_variance | 1. Which accounts missed budget by more than 15%? 2. Is the total variance favorable or unfavorable? 3. What's the biggest single variance item? |

---

## 9. RBAC (Role-Based Access Control)

| Role | Can Trigger Analysis | Can View Insights |
|------|---------------------|-------------------|
| Superadmin | Yes | Yes |
| Finance | Yes | Yes |
| Director | Yes | Yes |
| Other roles | No | View cached insights only |

**Current implementation:** Client-side only. The "Analyze" button is hidden for non-authorized roles via `useRole()` context. No server-side role validation on API routes.

See doc 10, §17 for the shared RBAC pattern.

---

## 10. Column Whitelisting (Data Protection)

Finance uses column whitelisting to control what data the LLM's tools can access. See doc 10, §15 for the shared pattern.

### Local PostgreSQL Whitelist

Each `pc_*` table has a declared list of allowed columns in `tools.ts` (`LOCAL_WHITELIST`). Only these columns can be queried by the LLM.

**Intentionally exposed:** Customer/company names (`company_name`), debtor/creditor codes, sales agent names, invoice numbers — needed for actionable insights.

**Blocked by omission:** Customer emails, phone numbers, contact persons, bank account details — never in any whitelist.

### Remote RDS Whitelist

Each `dbo.*` table has a declared list in `tools.ts` (`RDS_WHITELIST`). Transaction-level columns like `DocNo`, `DocDate`, `DebtorCode`, `LocalNetTotal` are allowed. No personal contact details.

### Runtime Enforcement

`validateColumns()` in `tools.ts` rejects any tool call requesting columns not in the whitelist. This is enforced at query execution time, not prompt-level.

---

## 11. In-App User Guide

An end-user manual page is available at `/manual/general/ai-insight` explaining how to use the AI Insight feature. Includes 5 annotated screenshots covering: collapsed panel, analysis results, insight detail dialog, component icon, and component dialog.
