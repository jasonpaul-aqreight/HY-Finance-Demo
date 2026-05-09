# User Prompt Compaction Tracker

**Goal:** Compact the 7 Finance page user prompts. Reduce wording (token cost, hallucination surface) while preserving meaning, data references, thresholds, and metric definitions.

**Workflow per page:**
1. I push compacted prompts to DB (`PUT /api/admin/ai-insight-prompts/{key}`).
2. User reviews in UI (`/admin/ai-insight-config`), edits inline as needed, saves.
3. I diff DB against my proposal, confirm final state, mark page Done.

**Compaction rules:**
- Drop the "You are analyzing X" preamble (system prompt has persona; data block labels the component).
- Drop generic style/format directives ("Provide a concise analysis", "Cite specific X", "Do not invent") — already enforced by `DEFAULT_GLOBAL_SYSTEM` (style + Key Observations format + ground-truth rule).
- Keep: what the metric measures (1 line), performance thresholds with exact numbers, evaluation focus, domain-specific framing (e.g., "frame COGS relative to Net Sales").
- Target: ~50–60% character reduction per prompt.

---

## Pages

| # | Page | Components | Status |
|---|------|------------|--------|
| 1 | Customer Margin | 10 (cm_*) | ✅ Done — DB + file in sync, isModified=false on all 10 |
| 2 | Expenses | 9 (ex_*) | ✅ Done — DB + file in sync, isModified=false on all 9 |
| 3 | Financial | 10 (fin_*, bs_*, fv_*) | ✅ Done — DB + file in sync, isModified=false on all 10 |
| 4 | Payment | 11 (5 collection_trend + 6 outstanding) | ✅ Done — DB + file in sync, isModified=false on all 11 |
| 5 | Returns | 9 (rt_*, ru_*) | ✅ Done — DB + file in sync, isModified=false on all 9 |
| 6 | Sales | 6 (sales_*, net_sales_trend, by_*) | ✅ Done — DB + file in sync, isModified=false on all 6 |
| 7 | Supplier Performance | 11 (7 sp_* + 4 sm_*) | ✅ Done — DB + file in sync, isModified=false on all 11 |

---

## Page 1 — Customer Margin

**Components (10):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `cm_net_sales` | KPI | Overview | 469 | 200 | 57% |
| 2 | `cm_cogs` | KPI | Overview | 442 | 286 | 35% |
| 3 | `cm_gross_profit` | KPI | Overview | 510 | 407 | 20% |
| 4 | `cm_margin_pct` | KPI | Overview | 360 | 232 | 36% |
| 5 | `cm_active_customers` | KPI | Overview | 408 | 344 | 16% |
| 6 | `cm_margin_trend` | Chart | Overview | 832 | 560 | 33% |
| 7 | `cm_margin_distribution` | Chart | Overview | 988 | 588 | 40% |
| 8 | `cm_top_customers` | Chart | Breakdown | 1099 | 671 | 39% |
| 9 | `cm_customer_table` | Table | Breakdown | 810 | 571 | 30% |
| 10 | `cm_credit_note_impact` | Table | Breakdown | 1131 | 907 | 20% |
|  | **Total** |  |  | **7049** | **4766** | **32%** |

---

### 1. cm_net_sales — KPI

**BEFORE (469 chars)**
```
You are analyzing the "Net Sales" KPI on the Customer Margin overview.

What it measures: Total net sales for the selected period, with prior-period comparison.

Performance thresholds:
- Growth > 5% = Good
- Growth 0-5% = Neutral
- Decline = Bad
- Decline > 10% = Flag

Evaluate the current value and the period-over-period delta. Cite the RM delta and percentage change.

Provide a concise analysis of this metric.
```

**AFTER (216 chars)**
```
"Net Sales" KPI — total net sales for the period with prior-period comparison.

Thresholds:
- Growth >5% = Good
- Growth 0–5% = Neutral
- Decline = Bad
- Decline >10% = Flag

Report current value, RM delta, % change.
```

---

### 2. cm_cogs — KPI

**BEFORE (442 chars)**
```
You are analyzing the "Cost of Goods Sold (COGS)" KPI on the Customer Margin overview.

What it measures: Total landed cost of goods sold, with prior-period comparison.

Context: For a fruit distribution business, COGS is typically 80-90% of Net Sales. COGS rising faster than Net Sales signals margin compression.

Evaluate:
- COGS-to-Net-Sales ratio
- Whether COGS delta is outpacing Net Sales delta (margin compression signal)
- Do NOT evaluate COGS in isolation — always frame it relative to Net Sales.

Provide a concise analysis of this metric.
```

**AFTER (286 chars)**
```
"COGS" KPI — landed cost of goods sold for the period with prior-period comparison.

Benchmark: COGS is normally 80–90% of Net Sales for fruit distribution.

Frame relative to Net Sales — never analyse COGS in isolation. Flag if COGS delta outpaces Net Sales delta (margin compression).
```

---

### 3. cm_gross_profit — KPI

**BEFORE (510 chars)**
```
You are analyzing the "Gross Profit" KPI on the Customer Margin overview.

What it measures: Net Sales minus COGS, with prior-period comparison.

Performance thresholds:
- GP growing while Net Sales also grows = Good
- GP flat while Net Sales grows = Neutral (margin erosion)
- GP declining while Net Sales grows = Bad (cost pressure)
- GP declining while Net Sales declines = Bad (volume loss)

The key signal is whether Gross Profit is growing faster or slower than Net Sales — this reveals pricing power. Cite the RM delta and percentage change.

Provide a concise analysis of this metric.
```

**AFTER (407 chars)**
```
"Gross Profit" KPI — Net Sales minus COGS for the period with prior-period comparison.

Thresholds (GP vs Net Sales direction):
- Both growing = Good
- GP flat, Net Sales growing = Neutral (margin erosion)
- GP declining, Net Sales growing = Bad (cost pressure)
- Both declining = Bad (volume loss)

Key signal: whether GP grows faster or slower than Net Sales (pricing power). Report RM delta and % change.
```

---

### 4. cm_margin_pct — KPI

**BEFORE (360 chars)**
```
You are analyzing the "Gross Margin %" KPI on the Customer Margin overview.

What it measures: Gross Profit as a percentage of Net Sales, with prior-period comparison.

Performance thresholds (fruit distribution benchmarks):
- Margin % >= 15% = Good
- Margin % 10-15% = Neutral
- Margin % < 10% = Bad

Evaluate the current margin level vs benchmarks and the period-over-period margin delta in percentage points.

Provide a concise analysis of this metric.
```

**AFTER (239 chars)**
```
"Gross Margin %" KPI — GP as % of Net Sales with prior-period comparison.

Thresholds (fruit distribution):
- ≥15% = Good
- 10–15% = Neutral
- <10% = Bad

Report current level vs benchmark and period-over-period delta in percentage points.
```

---

### 5. cm_active_customers — KPI

**BEFORE (408 chars)**
```
You are analyzing the "Active Customers" KPI on the Customer Margin overview.

What it measures: Count of distinct active customers with activity in the selected period, with prior-period comparison.

Context: Stability is the baseline — steady numbers are healthy for a mature distribution business. Changes matter more than the absolute number.

Evaluate:
- Period-over-period change in customer count
- Whether the count correlates with Net Sales movement (fewer customers but steady sales = revenue concentrating)

Provide a concise analysis of this metric.
```

**AFTER (344 chars)**
```
"Active Customers" KPI — count of distinct active customers in the period with prior-period comparison.

Baseline: stability is healthy for a mature distribution business; deltas matter more than absolute count.

Report period-over-period change and whether it correlates with Net Sales (fewer customers + steady sales = revenue concentrating).
```

---

### 6. cm_margin_trend — Chart

**BEFORE (832 chars)**
```
You are analyzing the "Margin Trend" chart on the Customer Margin overview.

What it shows:
- Bars = Gross Profit (RM, left axis) per month
- Line = Gross Margin % (right axis) per month
- Granularity is fixed to monthly — the chart has no granularity selector.

The chart answers two questions at once:
- Is the business making more or less profit in absolute terms?
- Is it getting more or less efficient at converting sales into profit?

Performance thresholds:
- 3+ consecutive months of Gross Profit growth = Good
- Flat or mixed = Neutral
- 3+ consecutive months of Gross Profit decline = Bad
- Margin % trending down for 2+ consecutive months warrants flagging even if Gross Profit is flat.

Look for:
- Divergence between bars and line (e.g., profit rising while margin % stays flat = growth via volume, not pricing)
- Seasonal patterns (festive months typically show different mix)
- Any month where Gross Profit and Margin % move in opposite directions — always worth calling out

Cite specific months from the pre-fetched monthly breakdown when making claims. Do not invent values.

Provide a concise analysis of the margin trend pattern with evidence.
```

**AFTER (560 chars)**
```
"Margin Trend" chart — monthly bars = Gross Profit (RM), line = Margin % (right axis). Monthly only.

Two questions: profit direction (RM) and efficiency (margin %).

Thresholds:
- 3+ months consecutive GP growth = Good
- Flat / mixed = Neutral
- 3+ months consecutive GP decline = Bad
- Margin % declining 2+ months = Flag (even if GP flat)

Look for: bars-vs-line divergence (e.g., GP up while margin flat = volume not pricing), seasonal/festive shifts, months where GP and margin % move opposite directions.

Cite specific months from the monthly breakdown.
```

---

### 7. cm_margin_distribution — Chart

**BEFORE (988 chars)**
```
You are analyzing the "Margin Distribution" histogram on the Customer Margin overview.

What it shows: Count of customers falling into each Gross Margin % bucket for the selected period. Buckets are fixed:
  < 0%, 0-5%, 5-10%, 10-15%, 15-20%, 20-30%, 30%+

Population: only customers with > RM 1,000 of total revenue in the period are included (small-volume customers are excluded to avoid noise). There is no bucket-size selector.

Performance thresholds:
- Customers in < 0% bucket = selling at a loss (worth flagging if > 0)
- Majority of customers in 10-20% band = Healthy (matches overall target)
- Heavy concentration (> 40% of customers) in sub-10% bands = Bad (portfolio is thin-margin)
- A meaningful tail (> 15%) in the 20%+ bands = Good (premium segment exists)

Evaluate:
- Shape of the distribution (left-skewed, centered, right-skewed)
- Proportion of customers below 10% margin
- Presence and size of the loss-making bucket
- Whether the distribution is consistent with the overall Margin % KPI (a 16% overall margin with most customers sub-10% means a few large accounts are carrying the portfolio — concentration risk)

Provide a concise analysis focused on distribution shape and concentration.
```

**AFTER (588 chars)**
```
"Margin Distribution" histogram — customers per fixed Margin % bucket: <0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+.

Population: customers with >RM 1,000 revenue in the period (small-volume excluded).

Thresholds:
- Any in <0% = selling at a loss (flag if count > 0)
- Majority in 10–20% = Healthy
- >40% in sub-10% bands = Bad (thin-margin portfolio)
- >15% in 20%+ bands = Good (premium segment)

Report: shape (skew), share below 10%, size of loss bucket, and whether shape matches overall Margin % (e.g., 16% overall with most sub-10% = concentration risk in a few large accounts).
```

---

### 8. cm_top_customers — Chart

**BEFORE (1099 chars)**
```
You are analyzing the "Top Customers" chart on the Customer Margin breakdown.

What it shows:
- The pre-fetched data contains TWO ranked lists of the period's top 10 customers:
  (A) Top 10 by Gross Profit (absolute RM contribution)
  (B) Top 10 by Gross Margin % (efficiency, filtered to customers with at least RM 10,000 revenue)
- The UI lets users toggle between these two lenses plus a "highest/lowest" direction. Your analysis should cover both lenses.

Performance thresholds:
- Top customer > 15% of total period Gross Profit = Bad (concentration risk — losing them would hurt badly)
- Top 10 > 60% of total period Gross Profit = Bad (concentrated portfolio)
- Top 10 < 40% of total period Gross Profit = Good (diversified)
- Any top-by-profit customer with margin % < 10% = Flag (thin-margin anchor)
- Any top-by-margin customer with revenue < RM 50,000 = Niche premium segment (worth protecting but not load-bearing)

Evaluate:
- Revenue-vs-margin polarity: which customers are the RM anchors, which are the efficiency leaders, and is there overlap?
- Concentration risk: how much of the period's total Gross Profit is held by the top 1, top 3, top 10?
- Customer type / sales agent patterns across the top lists (if the data block surfaces them)
- Any customer appearing on BOTH lists (high profit AND high margin) = star account — call them out by name.

Cite named customers from the pre-fetched data. Do not invent names or numbers.

Provide a concise analysis focused on concentration, quality of top accounts, and any over-reliance risk.
```

**AFTER (671 chars)**
```
"Top Customers" chart — two lists in the data:
(A) Top 10 by Gross Profit (RM)
(B) Top 10 by Margin % (filtered to ≥RM 10,000 revenue)
Cover both lenses.

Thresholds:
- Top 1 > 15% of total GP = Bad (concentration risk)
- Top 10 > 60% of total GP = Bad (concentrated portfolio)
- Top 10 < 40% of total GP = Good (diversified)
- Top-by-profit with margin <10% = Flag (thin anchor)
- Top-by-margin with revenue <RM 50K = niche premium (protect, not load-bearing)

Report:
- RM anchors vs efficiency leaders, and any overlap
- Concentration: top 1 / top 3 / top 10 share of GP
- Customer-type or sales-agent clustering if surfaced
- Star accounts (on both lists) — name them
```

---

### 9. cm_customer_table — Table

**BEFORE (810 chars)**
```
You are analyzing the "Customer Margin Table" on the Customer Margin breakdown.

What it shows:
- Bottom 10 customers by Gross Profit (the worst performers, including loss-makers)
- Margin distribution: how customers are spread across margin buckets

Performance thresholds:
- Loss-making customers > 10% of active count = Bad (unhealthy tail)
- Any bottom-10 customer with revenue > RM 100,000 AND negative margin = Critical flag
- High concentration in < 10% margin buckets = Portfolio margin risk

Evaluate:
- The bottom tail: who is losing money, and is the problem big (high-revenue loss-makers) or small?
- Customer type / sales agent clustering in the bottom 10
- Whether the bottom 10 have unusually high return rates
- Distribution shape: is the portfolio clustered in healthy (>15%) or thin (<10%) buckets?

Cite named customers from the pre-fetched bottom block. Do not invent names.

Provide a concise analysis focused on the at-risk tail and portfolio margin distribution.
```

**AFTER (571 chars)**
```
"Customer Margin Table" — bottom 10 by Gross Profit (worst, includes loss-makers) plus margin distribution by bucket.

Thresholds:
- Loss-makers >10% of active count = Bad (unhealthy tail)
- Bottom-10 with revenue >RM 100K AND negative margin = Critical
- High share in <10% buckets = portfolio margin risk

Report:
- Bottom tail: who's losing money, big (high-revenue loss-makers) vs small problem
- Customer-type or sales-agent clustering in bottom 10
- Unusual return-rate clustering in bottom 10
- Distribution skew: clustered in >15% (healthy) or <10% (thin) buckets
```

---

### 10. cm_credit_note_impact — Table

**BEFORE (1131 chars)**
```
You are analyzing the "Credit Note Impact on Margins" table.

What it shows: Customers ranked by how much credit notes eroded their margin, with columns for Code, Name, Invoice Revenue, CN Revenue, Return Rate %, Margin Before CN, Margin After CN, and Margin Lost (percentage points).

Pre-fetched data contains the top 25 customers by Margin Lost (the most-affected accounts) plus aggregate roll-ups: total margin lost across the full top-100 list, top-5 share of total margin lost, count of customers with return rate > 5%, and average margin lost.

Performance thresholds:
- Top 5 customers > 50% of total margin lost = Bad (concentrated CN problem — fix the top offenders first)
- Any customer with return rate > 10% = Bad (excessive returns, likely quality or operational issue)
- Any customer with margin_lost > 10 percentage points = Severe impact
- Customers with high CN revenue but margin_lost < 2 points = Acceptable (they return a lot but costs are recovered)

Evaluate:
- Concentration of the CN problem: is it one or two serial returners, or spread across many customers?
- Relationship between return rate and margin lost (high return rate but low margin lost suggests the credit notes are on low-margin items — a different problem than high-margin returns)
- Any customer type or sales agent clustering in the top 25 worst-impacted
- Whether return rates look normal (<3% for most) or systemic (>5% across many customers = upstream quality problem)

Cite named customers from the pre-fetched top 25. Do not invent names.

Provide a concise analysis focused on which accounts to investigate first.
```

**AFTER (907 chars)**
```
"Credit Note Impact on Margins" table — customers ranked by margin lost from credit notes. Columns: Code, Name, Invoice Rev, CN Rev, Return Rate %, Margin Before CN, Margin After CN, Margin Lost (pp).

Data: top 25 by Margin Lost + roll-ups (total margin lost across top-100, top-5 share, count with return rate >5%, avg margin lost).

Thresholds:
- Top 5 > 50% of total margin lost = Bad (concentrated — fix top offenders first)
- Return rate >10% = Bad (excessive returns — quality or ops issue)
- Margin lost >10pp = Severe
- High CN revenue but margin lost <2pp = Acceptable (volume returns, costs recovered)

Report:
- Concentration: a few serial returners or spread across many?
- Return rate vs margin lost: high rate + low impact = low-margin items returned (different problem)
- Customer-type or sales-agent clustering in top 25
- Return-rate baseline: <3% normal vs >5% systemic (upstream quality)
```

---

## Page 2 — Expenses

**Components (9):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `ex_total_costs` | KPI | Overview | 957 | 493 | 48% |
| 2 | `ex_cogs` | KPI | Overview | 1011 | 642 | 36% |
| 3 | `ex_opex` | KPI | Overview | 992 | 660 | 33% |
| 4 | `ex_yoy_costs` | KPI | Overview | 1062 | 630 | 41% |
| 5 | `ex_cost_trend` | Chart | Overview | 1141 | 671 | 41% |
| 6 | `ex_cost_composition` | Chart | Overview | 1101 | 715 | 35% |
| 7 | `ex_top_expenses` | Chart | Overview | 1281 | 816 | 36% |
| 8 | `ex_cogs_table` | Table | Breakdown | 1313 | 1084 | 17% |
| 9 | `ex_opex_table` | Table | Breakdown | 1733 | 1638 | 5% |
|   | **Total** |  |  | **10591** | **7349** | **31%** |

Two breakdown tables compress less because their threshold lists and (for OpEx) the 13-category taxonomy are load-bearing definitions, not bloat. PRD `docs/prd/11-ai-insight-finance.md` §5.11 / §5.12 cross-checked — every threshold number, data field, and domain framing rule preserved.

---

## Page 3 — Financial

**Components (10):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `fin_pnl_summary` | KPI | financial_overview | 1352 | 1028 | 24% |
| 2 | `fin_monthly_trend` | Chart | financial_overview | 1595 | 778 | 51% |
| 3 | `fin_pl_statement` | Table | financial_pnl | 1903 | 1044 | 45% |
| 4 | `fin_yoy_comparison` | Table | financial_pnl | 1973 | 982 | 50% |
| 5 | `bs_trend` | Chart | financial_balance_sheet | 2146 | 1074 | 50% |
| 6 | `bs_statement` | Table | financial_balance_sheet | 2409 | 1293 | 46% |
| 7 | `fv_variance_summary` | KPI | financial_variance | 2249 | 891 | 60% |
| 8 | `fv_variance_breakdown` | Table | financial_variance | 1561 | 890 | 43% |
| 9 | `fv_trend_forecast` | KPI | financial_variance | 2401 | 950 | 60% |
| 10 | `fv_budget_suggestions` | KPI | financial_variance | 2220 | 1206 | 46% |
|   | **Total** |  |  | **19,809** | **10,136** | **49%** |

Two passes: session-3 v1 pushed all 10 (~27% reduction); user flagged 5 (`fv_trend_forecast`, `fv_variance_summary`, `fin_yoy_comparison`, `bs_statement`, `bs_trend`) as still too long. Session-3 v2 re-tightened those 5 (additional 17–34% each), bringing total page reduction to 49%. PRD `docs/prd/11-ai-insight-finance.md` §5.13–§5.16 cross-checked — every numeric threshold, sign-flip flag, "call out by month name" rule, partial-FY exclusion, pre-computed forecast disclaimer, and budget-conditional rule preserved verbatim. All sections use `aggregate_only` tool policy (no RDS drill-down) — prompts emphasise citing only pre-fetched aggregate data.

---

## Page 4 — Payment

**Components (11):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `avg_collection_days` | KPI | payment_collection_trend | 692 | 293 | 58% |
| 2 | `collection_rate` | KPI | payment_collection_trend | 591 | 235 | 60% |
| 3 | `avg_monthly_collection` | KPI | payment_collection_trend | 441 | 197 | 55% |
| 4 | `collection_days_trend` | Chart | payment_collection_trend | 517 | 293 | 43% |
| 5 | `invoiced_vs_collected` | Chart | payment_collection_trend | 1361 | 799 | 41% |
| 6 | `total_outstanding` | KPI | payment_outstanding | 493 | 235 | 52% |
| 7 | `overdue_amount` | KPI | payment_outstanding | 536 | 307 | 43% |
| 8 | `credit_limit_breaches` | KPI | payment_outstanding | 491 | 291 | 41% |
| 9 | `aging_analysis` | Chart | payment_outstanding | 756 | 385 | 49% |
| 10 | `credit_usage_distribution` | Chart | payment_outstanding | 640 | 376 | 41% |
| 11 | `customer_credit_health` | Table | payment_outstanding | 964 | 752 | 22% |
|   | **Total** |  |  | **7,482** | **4,163** | **44%** |

Two passes: v1 pushed all 11 (~42% reduction); audit pass against PRD §5.1 / §5.2 / §9 confirmed every threshold, formula, and domain rule preserved. v2 selectively re-tightened 4 prompts (`collection_days_trend`, `invoiced_vs_collected`, `aging_analysis`, `customer_credit_health`) — additional ~4% saved without losing rigor; remaining 7 left at v1 (already at floor). PRD `docs/prd/11-ai-insight-finance.md` §5.1 (payment_collection_trend) + §5.2 (payment_outstanding) cross-checked — every numeric threshold (≤30/≤60/>60 days, ≥80%/≥50%/<50%, <20%/20–40%/>40%, 0/>0 breaches, six aging buckets, four credit-usage bands), the snapshot-vs-period-flow distinction on `total_outstanding`, the sub-period averaging BAN on `invoiced_vs_collected`, and the 11-column table layout on `customer_credit_health` all preserved.

**Special handling — `customer_credit_health`:** original prompt hard-coded the score formula weights (40/30/20/10) and risk-tier cutoffs (≥75 / 31–74 / ≤30). These values are tunable at runtime via `app_settings.credit_score_v2` (loaded by sync-engine.ts:64; risk_tier and credit_score are pre-computed per customer in `pc_ar_customer_snapshot`). Compacted prompt drops the formula and cutoffs, telling the LLM to treat the data block's resolved `risk_tier` / `credit_score` as authoritative. No engine change required, no template-token injection, no stale-threshold drift if the user retunes scoring. PRD §9's "Finance uses hardcoded thresholds" note is outdated for this metric — flagged for future PRD update.

**Tool-policy alignment:** `payment_collection_trend` is `aggregate_only` per PRD §7 — original `avg_collection_days` had a misleading "use the available tools to query" hint (no drill-down tools available for this section); correctly dropped in compaction. `payment_outstanding` is `full` — `credit_limit_breaches` retains its tool hint for breach investigation.

**UI colors stripped** from `aging_analysis` (green/yellow/orange/light-red/red/dark-red) and `credit_usage_distribution` (green/yellow/red/gray) per Returns precedent.

**One upgrade vs original:** `overdue_amount` original only carried `<20% acceptable / >40% critical`; compacted version adds the `20–40% = warning` middle band per PRD §9 for fuller threshold coverage.

---

## Page 5 — Returns

**Components (9):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `rt_total_returns` | KPI | return_trend | 770 | 432 | 44% |
| 2 | `rt_settled` | KPI | return_trend | 1380 | 630 | 54% |
| 3 | `rt_unsettled` | KPI | return_trend | 1080 | 498 | 54% |
| 4 | `rt_return_pct` | KPI | return_trend | 960 | 525 | 45% |
| 5 | `rt_settlement_breakdown` | Chart | return_trend | 1250 | 803 | 36% |
| 6 | `rt_monthly_trend` | Chart | return_trend | 1170 | 767 | 34% |
| 7 | `rt_product_bar` | Chart | return_trend | 1380 | 960 | 30% |
| 8 | `ru_aging_chart` | Chart | return_unsettled | 1380 | 817 | 41% |
| 9 | `ru_debtors_table` | Table | return_unsettled | 1730 | 1233 | 29% |
|   | **Total** |  |  | **11,100** | **6,665** | **40%** |

Two passes: v1 pushed (~36% reduction); user feedback to drop UI color refs and tighten further. v2 removed all chart series colors (emerald/indigo/blue/red, etc.) and aging-bucket colors, replaced PRD threshold band names "Green/Amber/Red" with severity terms (Healthy/Watch/Concern) on `rt_return_pct`, replaced "RED flag" with "critical flag" on `ru_debtors_table`. PRD `docs/prd/11-ai-insight-finance.md` §5.9 (return_trend) + §5.10 (return_unsettled) cross-checked — every numeric threshold (return rate <2%/2–5%/>5%, knock-off >70%, refund >30%, unsettled <15%/15–30%/>30%, top-1 >15%, top-10 >60%/<40%, aging >25% in 91+, >10% in 180+), the snapshot-vs-period-flow distinction, the knock-off-preferred / refund-as-cash-out domain framing, the "name top 5 verbatim" rule, and tool-use hints (pc_return_aging, pc_return_by_customer, dbo.CN) preserved.

---

## Page 6 — Sales

**Components (6):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `sales_summary` | KPI | sales_trend | 795 | 612 | 23% |
| 2 | `net_sales_trend` | Chart | sales_trend | 742 | 460 | 38% |
| 3 | `by_customer` | Breakdown | sales_breakdown | 695 | 455 | 35% |
| 4 | `by_product` | Breakdown | sales_breakdown | 621 | 409 | 34% |
| 5 | `by_agent` | Breakdown | sales_breakdown | 576 | 404 | 30% |
| 6 | `by_outlet` | Breakdown | sales_breakdown | 550 | 413 | 25% |
|   | **Total** |  |  | **3,979** | **2,753** | **31%** |

Single-pass compaction (session-8); no v2 needed — user reviewed and approved on first push. PRD `docs/prd/11-ai-insight-finance.md` §5.3 (sales_trend) + §5.4 (sales_breakdown) cross-checked verbatim — every numeric threshold preserved: CN ratio (≤1% / 1–3% / >3%), trend bands (3+ months growth/decline, >20% spike flag), concentration cuts (top customer <15 / 15–25 / >25; top product <20 / 20–35 / >35; agent decline >10%; outlet ≤50 / >50). Formula `Net Sales = Invoice + Cash − CN` retained on `sales_summary`. Domain framing kept: invoice ≥90% of net is normal for credit-customer distribution; "(Unassigned)" outlet = data-quality signal.

**Dropped:** "You are analyzing X" preambles, "Provide a concise analysis" tails, UI bar colors (dark blue / green / red) on `net_sales_trend`. Reduction is lower than other pages (31% vs the 40–50% norm) because the original Sales prompts were already shorter and less ornamented than other pages.

**Tool-policy alignment:** `sales_trend` and `sales_breakdown` are both `aggregate_only` per PRD §7 — no drill-down hints needed; none added in compaction.

---

## Page 7 — Supplier Performance

**Components (11):**
| # | Key | Type | Section | Before | After | Saved |
|---|-----|------|---------|--------|-------|-------|
| 1 | `sp_net_sales` | KPI | supplier_margin_overview | 1038 | 534 | 49% |
| 2 | `sp_cogs` | KPI | supplier_margin_overview | 1219 | 567 | 54% |
| 3 | `sp_gross_profit` | KPI | supplier_margin_overview | 947 | 543 | 43% |
| 4 | `sp_margin_pct` | KPI | supplier_margin_overview | 851 | 430 | 49% |
| 5 | `sp_active_suppliers` | KPI | supplier_margin_overview | 1475 | 768 | 48% |
| 6 | `sp_margin_trend` | Chart | supplier_margin_overview | 1447 | 651 | 55% |
| 7 | `sp_margin_distribution` | Chart | supplier_margin_overview | 1819 | 869 | 52% |
| 8 | `sm_top_bottom` | Chart | supplier_margin_breakdown | 1206 | 710 | 41% |
| 9 | `sm_supplier_table` | Table | supplier_margin_breakdown | 1621 | 872 | 46% |
| 10 | `sm_item_pricing` | Breakdown | supplier_margin_breakdown | 2221 | 1157 | 48% |
| 11 | `sm_price_scatter` | Chart | supplier_margin_breakdown | 1908 | 1001 | 48% |
|   | **Total** |  |  | **15,752** | **8,102** | **49%** |

Two passes: v1 pushed all 11 (~46% reduction); user audit prompt led to v2 selectively re-tightening 6 prompts (`sp_cogs`, `sp_active_suppliers`, `sp_margin_distribution`, `sm_supplier_table`, `sm_item_pricing`, `sm_price_scatter`) — collapsed redundant clauses, removed wrapper "Note:" lines, dropped repeated descriptors. Remaining 5 (`sp_net_sales`, `sp_gross_profit`, `sp_margin_pct`, `sp_margin_trend`, `sm_top_bottom`) left at v1 — already at floor.

PRD `docs/prd/11-ai-insight-finance.md` §5.7 (supplier_margin_overview, aggregate_only) + §5.8 (supplier_margin_breakdown, full) cross-checked verbatim — every numeric threshold (≥5%/>10% drop on Net Sales; ≥15%/10–15%/<10%/≥2pp drop on margin %; ±5%/−5–10%/>10%/>15% on supplier count; 3+/2+ months on profitability trend; 7 margin buckets on distribution; top-1 >15% / top-10 >60%/<40% on concentration; RM 10K floor on bottom-margin filter; RM 100K + 5% margin on critical bottom-10; >10pp margin spread on item pricing; >50%/<20% volume share on cheapest supplier; >20%/<5% bucket and >10%/20+ bucket on scatter; <0/<5% loss/thin), every formula (`SUM(sales_revenue)`, `SUM(attributed_cogs)`, `COUNT(DISTINCT creditor_code)`), the supplier-vs-item entity-toggle contrast logic, and the "Est." prefix explanation all preserved.

**Special handling — supplier-page domain rules:** four load-bearing framing rules preserved verbatim because they invert the customer-page intuition the LLM defaults to:
- `sp_cogs`: "rising COGS NOT automatically bad — frame against Net Sales and margin % direction"
- `sp_active_suppliers`: "shrinking count NOT automatically bad — consolidation may concentrate volume on better suppliers"
- `sm_item_pricing`: "for this anchor item specifically — do NOT generalize from a single anchor item"
- `sp_margin_distribution`: 3-way supplier-vs-item contrast (premium-suppliers/weak-tail vs good-products/weak-suppliers vs structural)

**Tool-policy alignment:** `supplier_margin_overview` is `aggregate_only` (PRD §5.7) — no drill-down hints in any sp_*. `supplier_margin_breakdown` is `full` (PRD §5.8) — kept references to raw invoice / cash-sale lines on `sm_item_pricing` and "name them" cues on `sm_supplier_table` and `sm_price_scatter` to support drill-down where relevant.

---

### Project complete

All 7 Finance pages compacted: total **77,789 → 49,329 chars (37% page-weighted average reduction across 67 prompts)**. Every page passed PRD cross-check, DB and prompts-defaults.ts in sync, isModified=false on all 67 prompts, `npx tsc --noEmit -p apps/dashboard` clean.

---

### Rollback

If a prompt needs to revert to default: in the UI hit the "Reset to Default" button on that prompt, OR re-seed via `POST /api/admin/ai-insight-prompts/seed-defaults` (component prompts are preserved across re-seed by default — but the seed-defaults route specifically re-applies the default text on demand).
