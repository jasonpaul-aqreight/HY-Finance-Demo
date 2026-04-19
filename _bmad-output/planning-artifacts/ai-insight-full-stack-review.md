# AI Insight Engine — Per-Section Config Reference

**Date:** 2026-04-19
**Purpose:** Complete reference for every section's business question, components, data sources, thresholds, and business rules. This documents the current state of the per-section config layer — what each insight does, what data it uses, and what rules the AI follows.

**How to read:** Each section has a business question, tool policy, component table, and business rules. The component table shows what the AI receives and what thresholds guide its analysis.

---

## Payment Page

### Section 1: Payment Collection Trend (Period)

**Business question:** "How efficiently are we collecting cash from credit sales?"
**Tool policy:** `aggregate_only` — summary can query pre-aggregated tables for context
**Data source:** All components use `pc_ar_monthly`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `avg_collection_days` | KPI | Collection days per month, period avg, best/worst month | ≤30d Green, ≤60d Yellow, >60d Red |
| `collection_rate` | KPI | (Collected / Invoiced) x 100 | ≥80% Green, ≥50% Yellow, <50% Red |
| `avg_monthly_collection` | KPI | Total Collected / Months | No fixed threshold (relative) |
| `collection_days_trend` | Chart | Monthly collection days line + period avg reference | Rising=bad, falling=good, spikes >60=critical |
| `invoiced_vs_collected` | Chart | Monthly bars vs line + gap analysis, H1/H2 splits | Pre-computed H1/H2 averages, sub-period averaging banned |

**Business rules:**
- `avg_collection_days` and `collection_days_trend` both calculate collection days from same data — intentional (KPI gives single number, chart shows monthly trend)
- `invoiced_vs_collected` has the most hardened prompt — sub-period averaging banned, must use pre-computed H1/H2 values only
- Pre-computed derived values: period avg, best/worst months, months above thresholds, H1/H2 averages + direction

**Pending improvements:**
- `customer_credit_health` fetcher: read weights/thresholds from `app_settings` instead of hardcoding

---

### Section 2: Outstanding Payment (Snapshot)

**Business question:** "What's our current AR exposure and who are the risky customers?"
**Tool policy:** `full` — summary can query both local + RDS for root cause
**Data source:** `pc_ar_customer_snapshot` (latest snapshot_date), `pc_ar_aging_history`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `total_outstanding` | KPI | Sum of all unpaid, Top 5 customers + % shares | No fixed threshold (contextual) |
| `overdue_amount` | KPI | Overdue sum, % of total, top 5 customers | <20% acceptable, >40% critical |
| `credit_limit_breaches` | KPI | Count of breaching customers, top 10 by utilization | 0=Green, >0=Red |
| `aging_analysis` | Chart | 6 buckets (Not Yet Due → 120+), amounts + % + invoice count | Older buckets = worse, 120+ = write-off risk |
| `credit_usage_distribution` | Chart | 4 categories (<80%, 80-99%, >100%, no limit) | Over Limit = Red, No Limit = uncontrolled risk |
| `customer_credit_health` | Table | Risk tiers (High/Moderate/Low), credit health score (0-100), top 5 by outstanding/overdue/utilization | ≥75 Low, 31-74 Moderate, ≤30 High risk |

**Business rules:**
- All snapshot-based — ignores date range selector
- Excludes "CASH SALES%" customers from all calculations
- Credit Health Score = 4 weighted factors: Usage 40%, Overdue Days 30%, Timeliness 20%, Double Breach 10%
- Weights and risk thresholds are **configurable via settings** (`app_settings` key `credit_score_v2`)

**Pending improvements:**
- Fetcher should read actual configured weights/thresholds from DB instead of hardcoding defaults in prompt

---

## Sales Page

### Section 1: Sales Trend (Period)

**Business question:** "What's our sales volume and trend?"
**Tool policy:** `aggregate_only`
**Data source:** All components use `pc_sales_daily`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `net_sales` | KPI | Net = Invoice + Cash - CN | MoM ≥5% Good, 0-5% Neutral, <0% Bad |
| `invoice_sales` | KPI | Invoice total + % of net | ≥90% of net = normal for distribution |
| `cash_sales` | KPI | Cash total + % of net | No fixed threshold (contextual) |
| `credit_notes` | KPI | CN total + % of gross | ≤1% Good, 1-3% Monitor, >3% Concern |
| `net_sales_trend` | Chart | Monthly breakdown (Invoice/Cash/CN/Net) | 3+ months growth=Good, 3+ decline=Bad |

**Business rules:**
- All from same table, same date range query
- `credit_notes` displayed as negative (red), thresholds based on % of gross sales

**Pending improvements:**
- Combine `net_sales` + `invoice_sales` + `cash_sales` into one "Sales Summary" component (reduces 3 AI calls to 1)

---

### Section 2: Sales Breakdown (Period)

**Business question:** "Where is our revenue concentrated?"
**Tool policy:** `full`

| Component | Type | Data Source | Key Metrics | Thresholds |
|-----------|------|-------------|-------------|------------|
| `by_customer` | Breakdown | `pc_sales_by_customer` | Top 15, type mix, Top 5/10 share | Top customer <15% Good, >25% Bad |
| `by_product` | Breakdown | `pc_sales_by_fruit` | Top 15 + country | Top product <20% Good, >35% Bad |
| `by_agent` | Breakdown | `pc_sales_by_outlet` (agent) | Performance spread, customer counts | Decline >10% = flag |
| `by_outlet` | Breakdown | `pc_sales_by_outlet` (location) | Geographic spread, CN anomalies | No outlet >50% = Good |

**Business rules:**
- Pre-computes Top 5 / Top 10 share for `by_customer`
- Concentration risk analysis across 4 dimensions

---

## Customer Margin Page

### Section 1: Customer Margin Overview (Period)

**Business question:** "What's our gross margin at the customer level?"
**Tool policy:** `aggregate_only`
**Data source:** `getMarginKpi()` → `pc_customer_margin`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `cm_net_sales` | KPI | Revenue (customer margin view) | — |
| `cm_cogs` | KPI | COGS + ratio to revenue | 80-90% of net = normal for distribution |
| `cm_gross_profit` | KPI | GP = Net Sales - COGS | GP growth vs Net Sales growth = key signal |
| `cm_margin_pct` | KPI | Margin % + color band | ≥15% Good, 10-15% Neutral, <10% Bad |
| `cm_active_customers` | KPI | Count + avg revenue per customer | Drop in count + steady revenue = concentration |
| `cm_margin_trend` | Chart | Monthly NS/COGS/GP/Margin% + aggregates | 3+ months growth/decline, 2+ month margin drop |
| `cm_margin_distribution` | Chart | Customer count by margin bucket (<0% → 30%+) | <0% always flag, >40% sub-10% = bad |

**Business rules:**
- Margin distribution uses RM 1,000 revenue floor (cuts noise)
- 7 margin buckets with roll-ups (loss-making, sub-10%, healthy, premium)
- Polarized portfolio (>50pp spread) = concentration risk

**Pending improvements:**
- Add prior-period delta (RM, %) to match Supplier Performance pattern

---

### Section 2: Customer Margin Breakdown (Period)

**Business question:** "Which customers are most/least profitable?"
**Tool policy:** `full`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `cm_top_customers` | Chart | Top/bottom 10 by GP + margin%, stars, concentration | Top 1 >15% GP = bad, Top 10 >60% = bad |
| `cm_customer_table` | Table | Loss-makers, thin-margin count, median, spread | Loss >10% of count = bad, spread >50pp = polarized |
| `cm_credit_note_impact` | Table | Top 25 by margin lost, return rate | Top 5 >50% of margin lost = concentrated |

**Business rules:**
- Revenue floor RM 10k on margin ranking lists
- Star accounts = customers appearing on both profit AND margin top lists
- `cm_credit_note_impact` shows margin before/after credit notes — links returns to profitability

**Pending improvements:**
- `cm_customer_table`: focus on at-risk tail only, remove redundant top-10 and summary metrics already covered by `cm_top_customers`

---

## Supplier Performance Page

### Section 1: Supplier Margin Overview (Period)

**Business question:** "What's our margin at the supplier/item level?"
**Tool policy:** `aggregate_only`
**Data source:** `getSupplierMarginSummary()` → `pc_supplier_margin`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `sp_net_sales` | KPI | Revenue + prior period + delta | ≥5% MoM Good, <0% Bad, >10% drop = flag |
| `sp_cogs` | KPI | COGS + ratio + delta | Rising COGS not auto-bad; check vs margin |
| `sp_gross_profit` | KPI | GP + delta RM + delta % | GP declining + NS growing = cost pressure |
| `sp_margin_pct` | KPI | Margin % + delta pp | ≥15% Good, 10-15% Neutral, <10% Bad |
| `sp_active_suppliers` | KPI | Count + avg per supplier | >10% drop = flag, ±5% = normal |
| `sp_margin_trend` | Chart | Monthly NS/COGS/GP/Margin% | 3+ months growth/decline |
| `sp_margin_distribution` | Chart | Dual: supplier + item distributions | Must analyze BOTH; divergence = actionable |

**Business rules:**
- Has prior-period comparison (delta) — Customer Margin does not yet
- `sp_margin_distribution` requires analyzing both supplier AND item views — divergence is key insight
- Supplier consolidation (shrinking count) can be positive if margin improves

---

### Section 2: Supplier Margin Breakdown (Period)

**Business question:** "Which suppliers/items are most profitable and at what pricing?"
**Tool policy:** `full`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `sm_top_bottom` | Chart | Top/bottom 10 suppliers + items (8 tables: profit + margin% sorted), stars, concentration | Top 1 >15% GP = bad, Top 10 >60% = bad |
| `sm_supplier_table` | Table | Top 10 revenue, bottom 10 margin, loss-makers | Top 10 >60% = bad, thin-margin >10% = concern |
| `sm_item_pricing` | Breakdown | Anchor item pricing across suppliers | Spread >10pp = arbitrage opportunity |
| `sm_price_scatter` | Chart | Top 50 items + margin histogram | <0% margin + >RM100k revenue = severe |

**Business rules:**
- `sm_top_bottom` currently generates 8 tables (top/bottom x suppliers/items x profit/margin%) — heavy on tokens
- `sm_item_pricing` analyses single anchor item (highest revenue) — conclusions scoped to that item only
- `sm_price_scatter` has both top-50 detail AND full-universe histogram
- Recurring loss-making items from same supplier = structural problem; spread across suppliers = item-level

**Pending improvements:**
- `sm_top_bottom`: reduce from 8 tables to 4 (drop margin%-sorted lists, keep profit-sorted only)

---

## Returns Page

### Section 1: Return Trends (Period)

**Business question:** "How much are we returning and how is it being settled?"
**Tool policy:** `aggregate_only`

| Component | Type | Data Source | Key Metrics | Thresholds |
|-----------|------|-------------|-------------|------------|
| `rt_total_returns` | KPI | `getReturnOverview()` | Return value, count, return rate% | <2% Good, 2-5% Watch, >5% Concern |
| `rt_settled` | KPI | `getReturnOverview()` + `getRefundSummary()` | Settled %, knock-off %, refund % | Knock-off >70% healthy, Refund >30% concern |
| `rt_unsettled` | KPI | `getReturnAging()` | Unsettled total RM | — |
| `rt_return_pct` | KPI | Derived | Return % of sales | Same as rt_total_returns |
| `rt_settlement_breakdown` | Chart | `getReturnOverview()` + `getRefundSummary()` | Knock-off/Refund/Unsettled mix | Knock-off >70% healthy |
| `rt_monthly_trend` | Chart | `getReturnTrend()` | Monthly return value, CN count, MoM | MoM count >25% = concern |
| `rt_product_bar` | Chart | `getReturnProducts()` | Top 10 by frequency + value, star items | Top-1 >15% severe, Top-10 >60% concentrated |

**Business rules:**
- Settlement preference: knock-off (no cash out) > refund (cash drain) > unsettled (process fail)
- Star items = items appearing on both frequency AND value top lists

---

### Section 2: Return Unsettled (Snapshot)

**Business question:** "What returns are still unresolved and who owes us?"
**Tool policy:** `full`

| Component | Type | Data Source | Key Metrics | Thresholds |
|-----------|------|-------------|-------------|------------|
| `ru_aging_chart` | Chart | `getReturnAging()` snapshot | Aging buckets (0-30 → 180+) | 91+ >25% watch, 180+ >10% write-off risk |
| `ru_debtors_table` | Table | `getAllCustomerReturnsAll()` snapshot | Debtor count, stale count, top-1/10 shares | Top-1 >15% risk, Top-10 >60% concentrated |

---

## Expenses Page

### Section 1: Expense Overview (Period)

**Business question:** "What are our costs and how do they compare to last year?"
**Tool policy:** `aggregate_only`

| Component | Type | Data Source | Key Metrics | Thresholds |
|-----------|------|-------------|-------------|------------|
| `ex_total_costs` | KPI | `getCostKpisV2()` | Total (COGS+OpEx), COGS%, OpEx%, YoY | YoY <0% healthy, 5-10% concern, >10% severe |
| `ex_cogs` | KPI | `getCostKpisV2()` + `getCogsBreakdown()` | COGS RM, YoY%, top 3 accounts | COGS 60-80% of total = typical |
| `ex_opex` | KPI | `getCostKpisV2()` + `getOpexBreakdown()` | OpEx RM, YoY%, top 3 accounts | YoY >10% = structural concern |
| `ex_yoy_costs` | KPI | `getCostKpisV2()` | YoY total, COGS, OpEx components | Green <0%, Amber 0-5%, Red >10% |
| `ex_cost_trend` | Chart | `getCostTrendV2()` | Monthly COGS+OpEx, peak/low, MoM% | MoM >15% concern, >25% severe |
| `ex_cost_composition` | Chart | `getCostCompositionV2()` | COGS/OpEx mix, drift vs prior year | Drift >+3pp + flat sales = compression |
| `ex_top_expenses` | Chart | `getTopExpensesByType()` | Top 10 GL accounts, concentration class | Top-1 >30% severe, Top-10 >75% concentrated |

**Business rules:**
- COGS = variable (scales with sales), OpEx = semi-fixed
- COGS YoY growth acceptable if sales volume grew proportionally
- Mix classification: Typical (60-80% COGS), COGS-dominated (>85%), OpEx-dominated (<50%)

---

### Section 2: Expense Breakdown (Period)

**Business question:** "What GL accounts drive our COGS and OpEx?"
**Tool policy:** `full`

| Component | Type | Data Source | Key Metrics | Thresholds |
|-----------|------|-------------|-------------|------------|
| `ex_cogs_table` | Table | `getCogsBreakdown()` | Total COGS, top 10 accounts, shares | Top-1 >50% severe, negative accounts = flag |
| `ex_opex_table` | Table | `getOpexBreakdown()` (category-grouped) | Total OpEx, categories, top 10, singletons | Top-1 category >50% dominant |

**Business rules:**
- OpEx grouped by category taxonomy (People, Vehicle, Property, Depreciation, etc.)
- For fruit distribution, People/Vehicle/Property dominating = normal

---

## Financial Page

### Section 1: Financial Overview (Fiscal Period)

**Business question:** "What's the P&L summary for this fiscal period?"
**Tool policy:** `aggregate_only`
**Data source:** `getV2PLStatement()` — fiscal-period P&L

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `fin_net_sales` | KPI | Net Sales, YoY% | <-5% severe, >10% strong |
| `fin_cost_of_sales` | KPI | COGS, COGS% of sales, YoY% | 60-80% typical, >85% margin pressure |
| `fin_gross_profit` | KPI | GP, margin%, YoY%, margin drift ppts | <15% severe, 20-25% typical, >25% strong |
| `fin_operating_costs` | KPI | OpEx, OpEx/Sales ratio, YoY% | <10% lean, 10-18% typical, >25% severe |
| `fin_operating_profit` | KPI | Op Profit, op margin%, YoY% | <0% loss, 5-10% healthy, >10% strong |
| `fin_net_profit` | KPI | NP, net margin%, other income check | <0% severe, 3-7% healthy, >7% strong |
| `fin_monthly_trend` | Chart | Monthly sales→OP, peak/low, loss months | Any loss month = watch |

**Business rules:**
- Fiscal-period scoped (period_no indexed, not calendar dates)
- Quality check: large Other Income propping up NP = core business weaker
- RM up + margin down = volume masking price erosion

**Pending improvements:**
- Combine 6 KPIs into one "P&L Summary" component (full waterfall, reduces 6 AI calls to 1)

---

### Section 2: Financial P&L Detail (Fiscal Period)

**Business question:** "Full P&L and year-over-year comparison?"
**Tool policy:** `aggregate_only`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `fin_pl_statement` | Table | Group subtotals, YoY%, top-5 movers, sign flips | YoY >±15% = material, sign flip = severe |
| `fin_yoy_comparison` | Table | 4-FY CAGR, margin drift, profit streak | CAGR <-5% declining, >15% fast |

**Business rules:**
- Hard rule: only cite account names from the pre-fetched "Top 5 movers" list
- Partial FYs excluded from CAGR/streak calculations

---

### Section 3: Balance Sheet (Fiscal Period)

**Business question:** "What's the balance sheet structure and trend?"
**Tool policy:** `aggregate_only`

| Component | Type | Key Metrics | Thresholds |
|-----------|------|-------------|------------|
| `bs_trend` | Chart | Monthly Assets/Liabilities/Equity series | — |
| `bs_statement` | Table | Totals, ratios, top-3 movers | Net Current Assets sign flip = severe, Equity sign flip = insolvency |

**Business rules:**
- Hard rule: only cite movers in the pre-fetched "Top 3 movers" list
- Do NOT recompute YoY % or ratios — data block values are authoritative

---

## Summary: Pending Improvements

| # | Page | Item | Complexity |
|---|------|------|-----------|
| 1 | Payment | `customer_credit_health`: read weights/thresholds from `app_settings` | Small |
| 2 | Sales | Combine `net_sales` + `invoice_sales` + `cash_sales` into one component | Medium |
| 3 | Customer Margin | Add prior-period delta to overview KPIs | Medium |
| 4 | Financial | Combine 6 overview KPIs into one P&L Summary | Medium |
| 5 | Supplier | `sm_top_bottom`: reduce from 8 to 4 tables (profit-sorted only) | Medium |
| 6 | Customer Margin | `cm_customer_table`: focus on at-risk tail, remove redundant summaries | Small |

## Quick Reference: Tool Policy Map

| Section | Policy | What it means |
|---------|--------|---------------|
| `payment_collection_trend` | `aggregate_only` | Summary can query pre-aggregated local tables |
| `payment_outstanding` | `full` | Summary can query local + RDS tables |
| `sales_trend` | `aggregate_only` | |
| `sales_breakdown` | `full` | |
| `customer_margin_overview` | `aggregate_only` | |
| `customer_margin_breakdown` | `full` | |
| `supplier_margin_overview` | `aggregate_only` | |
| `supplier_margin_breakdown` | `full` | |
| `return_trend` | `aggregate_only` | |
| `return_unsettled` | `full` | |
| `expense_overview` | `aggregate_only` | |
| `expense_breakdown` | `full` | |
| `financial_overview` | `aggregate_only` | |
| `financial_pnl` | `aggregate_only` | |
| `financial_balance_sheet` | `aggregate_only` | |

**Pattern:** Overview sections use `aggregate_only` (pre-aggregated data is enough). Breakdown/detail sections use `full` (may need drill-down into raw transactions). Exception: `payment_collection_trend` was upgraded from `none` to `aggregate_only`.

## Quick Reference: Scope Map

| Section | Scope | What it means |
|---------|-------|---------------|
| `payment_collection_trend` | `period` | Filtered by date range — activity within the period |
| `payment_outstanding` | `snapshot` | Current state — ignores date range |
| `sales_trend` | `period` | |
| `sales_breakdown` | `period` | |
| `customer_margin_overview` | `period` | |
| `customer_margin_breakdown` | `period` | |
| `supplier_margin_overview` | `period` | |
| `supplier_margin_breakdown` | `period` | |
| `return_trend` | `period` | |
| `return_unsettled` | `snapshot` | Current state — ignores date range |
| `expense_overview` | `period` | |
| `expense_breakdown` | `period` | |
| `financial_overview` | `fiscal_period` | Fiscal year + window (FY/last12/YTD) |
| `financial_pnl` | `fiscal_period` | |
| `financial_balance_sheet` | `fiscal_period` | |

**Pattern:** Most sections are `period` (calendar date range). Two are `snapshot` (point-in-time balances). Three are `fiscal_period` (fiscal year + window, not calendar dates).
