# AI Insight Prompt Audit - Phase 0

Generated: 2026-05-16T09:21:25.315Z
Source table: `ai_insight_prompts` selected prompt text.
Code baseline: `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts` plus empty HR scaffold rows from the seed/config row contract.

## Summary

- DB prompts exported: 96
- Exact matches to code defaults: 92
- DB prompts differing from code defaults: 4
- DB prompts with no code default found: 0

Differences found. Do not drop `ai_insight_prompts` without reviewing these rows.

## Difference Index

- by_customer: DB hash c4fc370c7f7a, code hash 28b68e80b16e, first different line 6
  - DB: - >25% = Bad (over-reliance risk) — shift to >30% during peak-season months
  - Code: - >25% = Bad (over-reliance risk)
- fv_variance_summary: DB hash 4339fbaad0ac, code hash ccce3a7d875a, first different line 4
  - DB: - Budget table (if present): per line — Actual / Budget / Var RM / Var % / Status — only for Net Sales, Cost of Sales, Operating Costs, Other Income
  - Code: - Budget table (if present): per line — Actual / Budget / Var RM / Var % / Tolerance / Budget Position / Favourability — only for Net Sales, Cost of Sales, Operating Costs
- aging_analysis: DB hash 95f81f209568, code hash a21f1d9d0678, first different line 14
  - DB: - Size of 120+ bucket (potential bad debt); flag if 120+ days exceeds 30% of total outstanding as a bad-debt risk signal
  - Code: - Size of 120+ bucket (potential bad debt)
- customer_credit_health: DB hash f4f1d93692cb, code hash ed92f0f07c1d, first different line 5
  - DB: Customers with no credit limit set must be flagged as a negative insight regardless of their current outstanding balance. Highlight these customers explicitly in the table output.
  - Code: Report:

## Exported Selected Prompts

### avg_collection_days

- Display name: Avg Collection Days
- Category: component
- Page: Payment
- Section: payment_collection_trend
- Component type: kpi
- Sort order: 1
- Selected version id: 85
- Selected version label: Default
- Updated at: 2026-05-12T08:28:58.825Z
- Updated by: feedback-apply
- DB prompt SHA-256: 3e20ff846114
- Code default SHA-256: 3e20ff846114
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Avg Collection Days" KPI — average days to collect payment after invoicing.

How it's measured: monthly collection days (based on month-end AR vs that month's credit sales) averaged across months with credit-sale activity.

Thresholds:
- ≤30 = Good
- ≤60 = Warning
- >60 = Critical (cash-flow risk)
~~~~

### bs_trend

- Display name: Assets, Liabilities & Equity Trend
- Category: component
- Page: Financial
- Section: financial_balance_sheet
- Component type: chart
- Sort order: 1
- Selected version id: 6
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.729Z
- Updated by: seed
- DB prompt SHA-256: 06fcfd85fd75
- Code default SHA-256: 06fcfd85fd75
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
Monthly time series across fiscal window: Total Assets, Total Liabilities, Equity (rebuilt monthly from opening balance + cumulative pc_pnl_period movements).

Pre-calculated:
- Months in window
- First→last growth %: Assets, Liabilities, Equity
- Gearing (Liab ÷ Assets): first, last, drift (pp)
- Longest Equity-decline streak (months)
- Months where Liabilities > Assets (negative-equity flag)

Thresholds:
- Asset trajectory first→last: <-5% Shrinking · ±5% Flat · 5–15% Growing · >15% Fast
- Equity declining first→last = Watch · 3+ consecutive decline months = Severe
- Liabilities up >10% while Assets flat/shrinking = Material · >20% = Severe
- Gearing drift: >+3pp Material · >+5pp Severe
- Any month Liab > Assets = Severe insolvency (call out by month name)

Evaluate:
- Direction: rising / flat / falling / diverging
- Leverage: gearing drift direction
- Equity health: building / holding / eroding (cite decline streak)

Hard rules:
- Use pre-calculated growth + gearing drift; no sub-window recompute.
- Negative-equity months MUST be called out by month name.
~~~~

### by_customer

- Display name: By Customer
- Category: component
- Page: Sales
- Section: sales_breakdown
- Component type: breakdown
- Sort order: 1
- Selected version id: 195
- Selected version label: feedback-apply · May 12, 3:27 PM
- Updated at: 2026-05-12T07:27:48.946Z
- Updated by: feedback-apply
- DB prompt SHA-256: c4fc370c7f7a
- Code default SHA-256: 28b68e80b16e
- Matches code default exactly: no
- First different line: 6

Selected DB prompt text:

~~~~text
"Sales by Customer" breakdown table — Code, Customer Name, Customer Type, Net Sales, Invoice Sales, Cash Sales, Credit Note Amount.

Concentration thresholds (top customer % of total Net Sales):
- <15% = Good (diversified)
- 15–25% = Neutral (moderate concentration)
- >25% = Bad (over-reliance risk) — shift to >30% during peak-season months

Evaluate:
- Revenue concentration: are a few customers dominating?
- Customer-type mix: balanced or skewed
- Customers with disproportionate credit notes
~~~~

Code default text for comparison:

~~~~text
"Sales by Customer" breakdown table — Code, Customer Name, Customer Type, Net Sales, Invoice Sales, Cash Sales, Credit Note Amount.

Concentration thresholds (top customer % of total Net Sales):
- <15% = Good (diversified)
- 15–25% = Neutral (moderate concentration)
- >25% = Bad (over-reliance risk)

Evaluate:
- Revenue concentration: are a few customers dominating?
- Customer-type mix: balanced or skewed
- Customers with disproportionate credit notes
~~~~

### cm_net_sales

- Display name: Net Sales
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: kpi
- Sort order: 1
- Selected version id: 30
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.672Z
- Updated by: seed
- DB prompt SHA-256: b7d9804b11e7
- Code default SHA-256: b7d9804b11e7
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Net Sales" KPI — total net sales for the period with prior-period comparison.

Thresholds:
- Growth >5% = Good
- Growth 0–5% = Neutral
- Decline = Bad
- Decline >10% = Flag

Report current value, RM delta, % change.
~~~~

### cm_top_customers

- Display name: Top Customers
- Category: component
- Page: Customer Margin
- Section: customer_margin_breakdown
- Component type: chart
- Sort order: 1
- Selected version id: 51
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.682Z
- Updated by: seed
- DB prompt SHA-256: d3eb1c248ee0
- Code default SHA-256: d3eb1c248ee0
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
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
~~~~

### ex_cogs_table

- Display name: Cost of Sales Breakdown
- Category: component
- Page: Expenses
- Section: expense_breakdown
- Component type: table
- Sort order: 1
- Selected version id: 20
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.722Z
- Updated by: seed
- DB prompt SHA-256: 82345b82c851
- Code default SHA-256: 82345b82c851
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Cost of Sales Breakdown" table — every active acc_type='CO' account for the period. Columns: Account No, Name, Net Cost RM, % of Total COGS.

Data: total COGS, active COGS account count (thin-surface flag if <5), top 10 (rank, name, acc_no, net cost, %), pre-computed Top 1 / Top 3 / Top 10 share with class labels, negative-value accounts.

Thresholds:
- Top 1 >50% = Severe (single-account exposure in variable cost base)
- Top 1 30–50% = Concentrated (typical for dominant-fruit sourcing — not auto bad)
- Top 1 <15% = Diversified
- Top 3 >80% = Concentrated (normal for focused distributor)
- Top 3 <55% = Diversified
- Active COGS accounts <5 = Thin COGS surface (GL discipline flag)
- Negative net_cost on any account = Flag (likely credit note posted to expense)

Report:
- Concentration: name top 1 if dominant — a unit-price change there moves the whole COGS line
- Top 3 mix: meaningful tail or 3-account story
- Negative-value accounts large enough to distort total
- Do NOT compare to prior year (that is the Overview's job)

Name accounts verbatim from the top-10 block.
~~~~

### ex_total_costs

- Display name: Total Costs
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: kpi
- Sort order: 1
- Selected version id: 78
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.715Z
- Updated by: seed
- DB prompt SHA-256: cb9eb05363ce
- Code default SHA-256: cb9eb05363ce
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Total Costs" KPI — period flow of COGS + OpEx posted to GL (not point-in-time balance).

Data: total RM, COGS RM + %, OpEx RM + %, prior-year total, YoY %.

YoY thresholds:
- <0% = Healthy
- 0–5% = Watch (typical inflation)
- 5–10% = Concern
- >10% = Severe

COGS share thresholds:
- 60–80% = Typical fruit-distribution mix
- >85% = COGS-dominated (margin-pressure risk)
- <50% = OpEx-dominated (scaling inefficiency risk)

Report YoY direction, COGS/OpEx mix health, and scale of the period.
~~~~

### fin_pl_statement

- Display name: Profit & Loss Statement
- Category: component
- Page: Financial
- Section: financial_pnl
- Component type: table
- Sort order: 1
- Selected version id: 11
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.727Z
- Updated by: seed
- DB prompt SHA-256: 4208f11420b0
- Code default SHA-256: 4208f11420b0
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Profit & Loss Statement" table — full P&L for the fiscal year vs prior FY (YTD-aligned), grouped by account type (Sales, Sales Adjustments, COGS, Other Income, OpEx, Taxation), with subtotals, GP/(Loss), NP/(Loss), NPAT, and YoY.

Pre-fetched data:
- Group subtotals (current vs prior) with YoY %
- Derived totals: GP, NP (pre-tax), NPAT
- Gross Margin %, Net Margin % (current vs prior, drift in pp)
- Sign-flip flags for GP / NP / NPAT
- Top 5 detail-account movers by |Δ RM|

Thresholds:
- Group YoY: <±5% Flat · ±5–15% Moderate · >±15% Material
- Gross Margin drift: ±3pp Material · ±5pp Severe
- Net Margin drift: ±2pp Material · ±3pp Severe
- Any GP/NP/NPAT sign flip = Severe (call out by name)

Evaluate:
- Which groups drive RM direction (e.g. "Net Sales up RM X, offset by OpEx up RM Y")
- Margin expansion vs compression — direction and magnitude
- 1–2 named accounts from top-5 movers explaining biggest swings

Hard rules:
- Cite only account names from the top-5 movers list.
- Do NOT recompute YoY % — figures are authoritative.
~~~~

### fin_pnl_summary

- Display name: P&L Summary
- Category: component
- Page: Financial
- Section: financial_overview
- Component type: kpi
- Sort order: 1
- Selected version id: 58
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.725Z
- Updated by: seed
- DB prompt SHA-256: 8e426b6800b4
- Code default SHA-256: 8e426b6800b4
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"P&L Summary" — full P&L waterfall for the fiscal window: Net Sales, Cost of Sales, GP, OpEx, Operating Profit, Other Income, Net Profit (each with current RM, prior-year RM, YoY %, margin/ratio).

Thresholds:
- Gross margin: <15% Severe · 15–20% Watch · 20–25% Typical · >25% Strong
- OpEx ratio: <10% Lean · 10–18% Typical · 18–25% Elevated · >25% Severe
- Operating margin: <0% Severe · 0–5% Thin · 5–10% Healthy · >10% Strong
- Net margin: <0% Severe · 0–3% Thin · 3–7% Healthy · >7% Strong
- COGS share: 60–80% Typical · >85% Margin pressure

Evaluate top-to-bottom:
1. Top-line: Net Sales YoY growth/contraction
2. Cost pressure: COGS vs Net Sales growth (rising COGS share = margin compression)
3. Gross Profit: RM and margin % (RM up + margin down = volume masking cost erosion)
4. OpEx ratio drift (OpEx > sales growth = scaling inefficiency)
5. Operating Profit: positive/negative — core-business read
6. Earnings quality: Net Profit >> Operating Profit means Other Income carries the delta (core weaker than headline)
~~~~

### fv_variance_summary

- Display name: P&L Variance Summary
- Category: component
- Page: Financial
- Section: financial_variance
- Component type: kpi
- Sort order: 1
- Selected version id: 82
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.732Z
- Updated by: seed
- DB prompt SHA-256: 4339fbaad0ac
- Code default SHA-256: ccce3a7d875a
- Matches code default exactly: no
- First different line: 4

Selected DB prompt text:

~~~~text
Current FY window's P&L vs the approved budget baseline (global, not FY-specific).

Pre-fetched:
- Budget table (if present): per line — Actual / Budget / Var RM / Var % / Status — only for Net Sales, Cost of Sales, Operating Costs, Other Income
- Favourable: Revenue ↑ = Favourable; Cost (COGS, OpEx) ↓ = Favourable

Thresholds:
- ±5% On Track · ±5–15% Moderate · >±15% Material
- Sign flip (profit↔loss) = Severe

Evaluate:
- Biggest deviations vs budget (lines, direction)
- Favourable vs unfavourable
- On track / over / under
- Overall: ahead of plan or behind

Hard rules:
- Label baseline "approved budget baseline" — do NOT qualify with a fiscal year.
- Do NOT compare to prior year or any YoY baseline; YoY analysis lives in the P&L panel, not here.
- If no budget section is present, do NOT mention budgets or variance-to-budget anywhere in the output.
- Budget rows cover input lines only (Net Sales, Cost of Sales, Operating Costs, Other Income). Do NOT claim a Gross Profit or Net Profit budget exists.
- Do NOT recompute variance %.
- For each Material (>±15%) or Severe (sign flip) deviation, conclude that line's commentary with ONE hedged advisory sentence — e.g. "consider reviewing OpEx pacing" or "monitor Other Income drivers". Do NOT prescribe specific actions or numbers.
~~~~

Code default text for comparison:

~~~~text
Current FY window's P&L vs the approved budget baseline (global, not FY-specific).

Pre-fetched:
- Budget table (if present): per line — Actual / Budget / Var RM / Var % / Tolerance / Budget Position / Favourability — only for Net Sales, Cost of Sales, Operating Costs
- Favourable: Revenue ↑ = Favourable; Cost (COGS, OpEx) ↓ = Favourable

Thresholds:
- Use each line's saved tolerance. On Budget means actual is within that line's tolerance.
- Above Target / Below Target applies to Net Sales. Over Budget / Under Budget applies to cost lines.
- Sign flip (profit↔loss) = Severe

Evaluate:
- Biggest deviations vs budget (lines, direction)
- Favourable vs unfavourable
- On track / over / under
- Overall: ahead of plan or behind

Hard rules:
- Label baseline "approved budget baseline" — do NOT qualify with a fiscal year.
- Do NOT compare to prior year or any YoY baseline; YoY analysis lives in the P&L panel, not here.
- If no budget section is present, do NOT mention budgets or variance-to-budget anywhere in the output.
- Budget rows cover input lines only (Net Sales, Cost of Sales, Operating Costs). Do NOT claim a Gross Profit or Net Profit budget exists.
- Do NOT recompute variance %.
- For each line outside tolerance or Severe (sign flip) deviation, conclude that line's commentary with ONE hedged advisory sentence — e.g. "consider reviewing OpEx pacing". Do NOT prescribe specific actions or numbers.
~~~~

### net_sales

- Display name: Net Sales
- Category: component
- Page: Sales
- Section: sales_trend
- Component type: kpi
- Sort order: 1
- Selected version id: 168
- Selected version label: Default
- Updated at: 2026-05-10T14:15:46.316Z
- Updated by: feedback-apply
- DB prompt SHA-256: adbe6e97ad27
- Code default SHA-256: adbe6e97ad27
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Net Sales" KPI — total revenue for the period (Invoice Sales + Cash Sales − Credit Notes).

Evaluate:
- Absolute level vs business scale
- Invoice vs Cash mix: invoice ≥90% of net is normal for credit-customer distribution; falling ratio = shift to cash/retail or loss of credit customers
- Credit-note ratio (CN / gross sales): ≤1% = Good · 1–3% = Monitor · >3% = Concern
~~~~

### rt_total_returns

- Display name: Total Returns
- Category: component
- Page: Returns
- Section: return_trend
- Component type: kpi
- Sort order: 1
- Selected version id: 8
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.703Z
- Updated by: seed
- DB prompt SHA-256: 68d7272c0f1e
- Code default SHA-256: 68d7272c0f1e
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Total Returns" KPI — period return value (RM) + CN count. Period flow, not point-in-time.

Data: return value, CN count, net sales, return rate %, avg per CN.

Thresholds (return rate %):
- <2% = Healthy (normal fruit-distribution wastage)
- 2–5% = Watch
- >5% = Concern (quality / sourcing / handling)

Report: return rate vs net sales (anchor metric), small-frequent vs large-infrequent (avg per CN), vs typical wastage baseline.
~~~~

### ru_aging_chart

- Display name: Aging of Unsettled Returns
- Category: component
- Page: Returns
- Section: return_unsettled
- Component type: chart
- Sort order: 1
- Selected version id: 48
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.713Z
- Updated by: seed
- DB prompt SHA-256: 33a62b902b2c
- Code default SHA-256: 33a62b902b2c
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Aging of Unsettled Returns" chart — current unsettled book by age bucket. SNAPSHOT, cumulative across all months, NOT date-filtered.

Buckets:
- 0–30 Days — fresh, normal reconciliation window
- 31–60 — starting to age
- 61–90 — process slowing
- 91–180 — active follow-up needed
- 180+ — write-off risk

Data: RM and count per bucket, total unsettled RM + count, % share per bucket, snapshot_date.

Thresholds:
- >25% of unsettled value in 91+ buckets (91–180 + 180+) = Watch (follow-up falling behind)
- >10% in 180+ alone = Write-off risk (rarely recovered in distribution)

Report: where the weight sits (fresh 0–30 vs old 91+), whether 180+ is material enough for write-off review, and count-vs-amount story (many small old vs a few large). If skew looks unusual, tools may pull prior pc_return_aging snapshots.
~~~~

### sm_top_bottom

- Display name: Top/Bottom Suppliers & Items
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_breakdown
- Component type: chart
- Sort order: 1
- Selected version id: 7
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.697Z
- Updated by: seed
- DB prompt SHA-256: 00af4736d0d1
- Code default SHA-256: 00af4736d0d1
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Top/Bottom Suppliers & Items" chart — 4 tables in data, sorted by Est. GP:
(A) Top 10 suppliers (B) Bottom 10 suppliers (C) Top 10 items (D) Bottom 10 items.

Thresholds:
- Top 1 supplier > 15% of period GP = Bad (concentration risk)
- Top 10 suppliers > 60% of GP = Bad (concentrated sourcing)
- Top 10 suppliers < 40% of GP = Good (diversified)
- Any bottom-list supplier with profit <0 = Critical (sourcing at a loss)
- Any bottom-list item with profit <0 AND meaningful revenue = Flag (product-level loss-maker)

Report: supplier-side vs item-side concentration, which loss-maker problem is bigger (suppliers or items), item-group / supplier clustering in the bottom lists. Cite named suppliers and items.
~~~~

### sp_net_sales

- Display name: Est. Net Sales
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: kpi
- Sort order: 1
- Selected version id: 60
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.687Z
- Updated by: seed
- DB prompt SHA-256: 20646e22c027
- Code default SHA-256: 20646e22c027
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Est. Net Sales" KPI — sales revenue attributed to items sourced from active suppliers in the period.

Note: "Est." prefix means the figure comes from the supplier-margin pre-compute, not raw invoices. Mirrors Customer Margin Net Sales unfiltered, may diverge under supplier/item-group filters.

Thresholds (MoM):
- ≥5% growth = Good
- 0–5% = Neutral
- <0% = Bad
- Drop >10% = Flag

Report level and direction vs prior period if available; comment on tracking vs trailing baseline.
~~~~

### total_outstanding

- Display name: Total Outstanding
- Category: component
- Page: Payment
- Section: payment_outstanding
- Component type: kpi
- Sort order: 1
- Selected version id: 53
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.635Z
- Updated by: seed
- DB prompt SHA-256: 48631727ff35
- Code default SHA-256: 48631727ff35
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Total Outstanding" KPI — sum of all unpaid invoices to date (snapshot, ignores date range).

No fixed threshold. Evaluate vs total invoicing volume and trend direction. Growing outstanding alongside flat or declining sales = red flag.
~~~~

### bs_statement

- Display name: Balance Sheet Statement
- Category: component
- Page: Financial
- Section: financial_balance_sheet
- Component type: table
- Sort order: 2
- Selected version id: 25
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.730Z
- Updated by: seed
- DB prompt SHA-256: ebd205aa2c21
- Code default SHA-256: ebd205aa2c21
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
Full BS, selected FY vs 12 periods prior (YTD-aligned). 8 line items by acc_type (Fixed Assets, Other Assets, Current Assets, Current Liabilities, LT Liabilities, Other Liabilities, Capital, Retained Earnings) + derived totals + solvency ratios.

Pre-fetched:
- Line items current vs prior: Δ RM, YoY % (non-zero only)
- Derived totals: Net Current Assets, Total Assets, Total Liabilities, Total Equity
- Ratios (current/prior/drift): Current Ratio, D/E, Equity Ratio
- Sign-flip flags: Net Current Assets, Total Equity
- Top 3 |Δ RM| movers

Thresholds:
- Line YoY: <±5% Flat · ±5–15% Moderate · >±15% Material
- Current Ratio: <1.0 Severe · 1.0–1.2 Thin · 1.2–2.0 Healthy · >2.0 Strong · drift >±0.3 = Material
- D/E: <0.5 Conservative · 0.5–1.0 Typical · 1.0–2.0 Leveraged · >2.0 Severe · drift >±0.3 = Material
- Equity Ratio: <20% Severe · 20–40% Thin · 40–60% Healthy · >60% Strong · drift >±5pp = Material
- Net Current Assets sign flip (pos→neg) = Severe (call out)
- Total Equity sign flip = Severe insolvency (call out)

Evaluate:
- Liquidity: Current Ratio band + drift
- Leverage: D/E position + direction
- Solvency: Equity Ratio + thickening/eroding
- Drivers: 1–2 names from top-3 movers

Hard rules:
- Cite only names from top-3 movers list.
- Do NOT recompute YoY % or ratios.
~~~~

### by_product

- Display name: By Product
- Category: component
- Page: Sales
- Section: sales_breakdown
- Component type: breakdown
- Sort order: 2
- Selected version id: 39
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.666Z
- Updated by: seed
- DB prompt SHA-256: 1a97c1b481de
- Code default SHA-256: 1a97c1b481de
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Sales by Product" breakdown — Product Name, Country, Variant, Net Sales, Qty Sold.

Concentration thresholds (top product % of total Net Sales):
- <20% = Good (diversified)
- 20–35% = Neutral
- >35% = Bad (product concentration risk)

Evaluate:
- Product concentration: spread or 1–2 items dominating
- Country-of-origin diversity (over-reliance on one source)
- High-qty / low-revenue items (margin concern)
~~~~

### cm_cogs

- Display name: COGS
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: kpi
- Sort order: 2
- Selected version id: 73
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.673Z
- Updated by: seed
- DB prompt SHA-256: ef7dcc9760c7
- Code default SHA-256: ef7dcc9760c7
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"COGS" KPI — landed cost of goods sold for the period with prior-period comparison.

Benchmark: COGS is normally 80–90% of Net Sales for fruit distribution.

Frame relative to Net Sales — never analyse COGS in isolation. Flag if COGS delta outpaces Net Sales delta (margin compression).
~~~~

### cm_customer_table

- Display name: Customer Margin Table
- Category: component
- Page: Customer Margin
- Section: customer_margin_breakdown
- Component type: table
- Sort order: 2
- Selected version id: 83
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.683Z
- Updated by: seed
- DB prompt SHA-256: 01aa3f343fff
- Code default SHA-256: 01aa3f343fff
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
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
~~~~

### collection_rate

- Display name: Collection Rate
- Category: component
- Page: Payment
- Section: payment_collection_trend
- Component type: kpi
- Sort order: 2
- Selected version id: 28
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.626Z
- Updated by: seed
- DB prompt SHA-256: 1e3b48d3b5cd
- Code default SHA-256: 1e3b48d3b5cd
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Collection Rate" KPI — share of the period's invoiced amount that converted to cash. Excludes contra / non-cash offsets.

Thresholds:
- ≥80% = Good
- ≥50% = Warning (growing receivables)
- <50% = Critical
~~~~

### ex_cogs

- Display name: Cost of Sales
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: kpi
- Sort order: 2
- Selected version id: 45
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.716Z
- Updated by: seed
- DB prompt SHA-256: b2e0d7321121
- Code default SHA-256: b2e0d7321121
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"COGS" KPI — variable cost of products sold (acc_type='CO'). COGS scales with sales; YoY growth is only concerning if it outpaces sales.

Data: COGS RM, % of total cost, prior-year RM, YoY %, top 3 accounts (name, acc_no, RM, %).

Thresholds:
- COGS share 60–80% = Typical
- COGS share >85% = Margin-pressure risk
- COGS YoY >15% with flat/declining sales = Concern

Critical framing: COGS is variable. The question is whether COGS grew faster than sales (margin compression) or slower (improvement). Flag YoY drift; defer the margin call to the sales-page cross-check.

Report scale vs total cost, YoY direction, and top-3 mix concentration.
~~~~

### ex_opex_table

- Display name: Operating Costs Breakdown
- Category: component
- Page: Expenses
- Section: expense_breakdown
- Component type: table
- Sort order: 2
- Selected version id: 80
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.723Z
- Updated by: seed
- DB prompt SHA-256: cd6b67b0dd85
- Code default SHA-256: cd6b67b0dd85
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Operating Costs Breakdown" table — every active acc_type='EP' account, grouped by category (People & Payroll, Vehicle & Transport, Property & Utilities, Depreciation, Office & Supplies, Equipment & IT, Insurance, Finance & Banking, Professional Fees, Marketing & Entertainment, Repair & Maintenance, Tax & Compliance, Other). Columns: Category/Account, Name, Net Cost RM, % of Total OpEx.

Data: total OpEx, active account count + active category count, category subtotals (category, account count, subtotal, % — sorted desc), top 10 accounts across all categories (rank, category, name, acc_no, net cost, %), Top 1 category share, Top 1 / Top 3 account shares with class labels, singleton categories, negative-value accounts.

Thresholds:
- Top 1 category >50% = Dominant (one cost center carries the base)
- Top 1 category 30–50% = Typical dominance (usually People & Payroll, Vehicle & Transport, or Property & Utilities)
- Top 1 category <20% = Diversified across categories
- Top 1 account >20% of total OpEx = Single-account risk (name it)
- Top 3 accounts >50% = Concentrated
- Singleton category (1 account) = Flag (possible misclassification or sparse data)
- Negative net_cost = Flag (likely reversal)

Report:
- Category concentration: People & Payroll / Vehicle / Property dominating = normal; Marketing & Entertainment dominating = not
- Single-account risk in the dominant category — name the account if Top 1 >20%
- Out-of-proportion categories = investigation lead
- Singletons and negatives = data-quality flags only — brief mention
- Do NOT compare to prior year (Overview's job)

Name categories and accounts verbatim.
~~~~

### fin_monthly_trend

- Display name: Monthly P&L Trend
- Category: component
- Page: Financial
- Section: financial_overview
- Component type: chart
- Sort order: 2
- Selected version id: 43
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.725Z
- Updated by: seed
- DB prompt SHA-256: 91c46675d3ec
- Code default SHA-256: 91c46675d3ec
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Monthly P&L Trend" chart — monthly Net Sales, COGS, GP, OpEx, Operating Profit across the fiscal window (Mar→Feb).

Pre-calculated roll-ups (cite directly):
- Months in window (profit vs loss split)
- Peak / lowest operating-profit month
- First-to-last Net Sales growth %
- First-to-last Operating Profit growth %

Thresholds:
- Any single loss month = Watch (name it)
- Loss months / total >30% = Concern
- First-to-last Operating Profit decline >25% = Severe

Evaluate:
- Direction: rising / flat / falling / oscillating
- Loss months: presence, names, clustered (seasonal/event) or scattered
- Sales-vs-profit divergence: sales up + profit down = margin compression
- Use pre-calculated first-to-last growth for headline. Do NOT compute averages over arbitrary sub-windows.
~~~~

### fin_yoy_comparison

- Display name: Multi-Year Comparison
- Category: component
- Page: Financial
- Section: financial_pnl
- Component type: table
- Sort order: 2
- Selected version id: 35
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.727Z
- Updated by: seed
- DB prompt SHA-256: dc0c5a223050
- Code default SHA-256: dc0c5a223050
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
4-FY view of P&L lines (Net Sales, COGS, GP, GM%, Other Income, OpEx, NP, NM%, Tax, NPAT) — selected FY + 3 prior. Partial FYs marked *.

Pre-calculated (FULL-FY only; partials excluded):
- Net Sales CAGR (first → last full FY)
- GM drift (pp), NM drift (pp)
- Longest NP decline streak (yrs)
- Longest NP improvement streak (yrs)
- NPAT sign-flip count

Thresholds:
- Net Sales CAGR: <-5% Declining · -5–5% Flat · 5–15% Growing · >15% Fast
- NP: 3+ consecutive declines = Severe · 3+ improvements = Strong
- GM drift first→last: >±3pp = Material structural shift
- NM drift first→last: >±2pp = Material
- Any NPAT sign flip = Severe

Evaluate:
- Trajectory: top-line direction (cite CAGR)
- Earnings: improving / oscillating / declining (cite longest streak)
- Margin structure: more / less profitable per RM of sales

Hard rules:
- Partial FYs (*) excluded from CAGR + trend claims.
- Use pre-calculated CAGR/drift; no recompute.
- Don't claim a streak longer than pre-calculated.
~~~~

### fv_variance_breakdown

- Display name: Variance by Account
- Category: component
- Page: Financial
- Section: financial_variance
- Component type: table
- Sort order: 2
- Selected version id: 75
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.732Z
- Updated by: seed
- DB prompt SHA-256: a512666c7952
- Code default SHA-256: a512666c7952
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Variance by Account" breakdown — GL-account-level YoY drill-down, complementary to the budget-variance summary above. Account-level budget variance is not available because budget is set at four P&L lines only.

Pre-fetched data:
- Per-account-type sections (COGS, OpEx, etc.)
- Per account: current, baseline, variance RM, variance %, Favourable/Unfavourable
- Sorted by absolute variance (biggest first); non-zero only

Thresholds:
- Single account >30% of category variance = Concentrated risk
- Top 3 accounts >70% of category variance = Highly concentrated
- Any account variance >±50% = Flag for investigation

Evaluate:
- Within each category, top 1–3 named movers
- Concentration: few accounts vs spread across many
- Accounts with unusually large % swings worth attention

Hard rules:
- Cite only account names from the pre-fetched data.
- Do NOT recompute RM or %.
- Focus on top movers — do not narrate every small account.
~~~~

### invoice_sales

- Display name: Invoice Sales
- Category: component
- Page: Sales
- Section: sales_trend
- Component type: kpi
- Sort order: 2
- Selected version id: 169
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.654Z
- Updated by: seed
- DB prompt SHA-256: a2a2e79257bf
- Code default SHA-256: a2a2e79257bf
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Invoice Sales" KPI — credit sales billed to customers on payment terms.

Evaluate:
- Absolute value for the period
- Share of net sales: ≥90% is normal for a credit-customer distribution business
- A falling share means a shift toward cash/retail buyers, or loss of credit customers
~~~~

### net_sales_trend

- Display name: Net Sales Trend
- Category: component
- Page: Sales
- Section: sales_trend
- Component type: chart
- Sort order: 2
- Selected version id: 27
- Selected version label: Default
- Updated at: 2026-05-12T08:06:53.947Z
- Updated by: feedback-apply
- DB prompt SHA-256: b0af725e7853
- Code default SHA-256: b0af725e7853
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Net Sales Trend" stacked bar chart — Invoice Sales + Cash Sales (positive stack), Credit Notes (negative). Combined height = Net Sales. Granularity: Daily / Weekly / Monthly.

Thresholds:
- 3+ consecutive months of growth = Good
- Flat / mixed = Neutral
- 3+ consecutive months of decline = Bad
- Any spike or drop >20% vs period average = flag for summary

Look for: festive / seasonal spikes, unusual credit-note months, cash-vs-invoice mix shift over time.
~~~~

### overdue_amount

- Display name: Overdue Amount
- Category: component
- Page: Payment
- Section: payment_outstanding
- Component type: kpi
- Sort order: 2
- Selected version id: 31
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.636Z
- Updated by: seed
- DB prompt SHA-256: ce3c43437499
- Code default SHA-256: ce3c43437499
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Overdue Amount" KPI — portion of total outstanding past due date, with % of total and customer count.

Thresholds (overdue % of outstanding):
- <20% = acceptable
- 20–40% = warning
- >40% = critical

Report: % of total, count of overdue customers vs active, concentration (few large vs spread across many).
~~~~

### rt_settled

- Display name: Settled
- Category: component
- Page: Returns
- Section: return_trend
- Component type: kpi
- Sort order: 2
- Selected version id: 17
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.704Z
- Updated by: seed
- DB prompt SHA-256: 2dc34d539854
- Code default SHA-256: 2dc34d539854
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Settled" KPI — return exposure resolved via knock-off (offset against future invoices) or refund (cash/cheque paid out).

Data: total settled, knocked off, refunded, settled %, knock-off %, refund %, refund count.

Thresholds:
- Knock-off >70% = Healthy (cash-efficient)
- Refund >30% = Concern (cash-draining)
- Refund-dominant + high absolute refund = working-capital flag

Domain: knock-off is preferred (no cash leaves the bank). Refund only fits ending relationships or customers with no upcoming invoices.

Report: channel mix (cash-efficient vs cash-draining) and overall settled % (closing exposure or letting it linger).
~~~~

### ru_debtors_table

- Display name: Customer Returns
- Category: component
- Page: Returns
- Section: return_unsettled
- Component type: table
- Sort order: 2
- Selected version id: 21
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.714Z
- Updated by: seed
- DB prompt SHA-256: adc8ae21ea7a
- Code default SHA-256: adc8ae21ea7a
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Customer Returns" table — every debtor with return CN history; cumulative totals: return count, total value, knocked off, refunded, unresolved. Sorted by unresolved desc; debtors with unresolved=0 hidden by default. SNAPSHOT, cumulative, NOT date-filtered.

Data: total unsettled, debtor count with unresolved >0, stale-debtor count (unresolved >0 AND knock_off=0 AND refund=0 — never actioned), top-1 share %, top-10 share %, top-5 list (name, unresolved RM, knocked off RM, refunded RM).

Thresholds:
- Top 1 debtor >15% of total unsettled = Single-point risk
- Top 10 >60% = Concentrated book (fixable with focused collections push)
- Stale debtors = pure process failure (collections never engaged)

Domain: knock-off preferred (offsets invoices, no cash out). Refund = real cash out, only fits ending relationships. Debtor with refund activity but still unresolved = critical flag (cash left, book not clean).

Report: concentration (one big, ten big, or spread), stale-debtor count (process failure vs active dispute), settlement patterns on top 5 (knock-off vs refund vs neither), and critical-flag debtors. Name top 5 verbatim. If a debtor looks unusual, tools may query pc_return_by_customer by debtor_code or drill dbo.CN.
~~~~

### sm_supplier_table

- Display name: Supplier Analysis Table
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_breakdown
- Component type: table
- Sort order: 2
- Selected version id: 36
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.698Z
- Updated by: seed
- DB prompt SHA-256: 36f7faee59e8
- Code default SHA-256: 36f7faee59e8
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Supplier Analysis Table" — sortable list of all active suppliers (Code, Name, Type, Items, Revenue, COGS, GP, Margin %).

Data: (A) Top 10 by Revenue, (B) Bottom 10 by Margin % filtered to revenue ≥RM 10K, (C) Roll-ups: total count, loss-making count, top-10 revenue share, median margin %, avg revenue/supplier, thin-margin (<5%) count.

Thresholds:
- Top 10 revenue share >60% = Bad (concentrated)
- 40–60% = Neutral (typical for distribution)
- Loss-makers (margin <0) >0 = Always flag; name them
- Thin-margin (<5%) >10% of active = Portfolio quality concern
- Bottom-10 with revenue >RM 100K AND margin <5% = Critical

Report: revenue concentration, whether bottom-margin tail is a few big offenders or long tail, supplier-type clustering in bottom 10, and any mismatch between biggest-revenue and best-margin suppliers (the actionable signal). Cite named suppliers.
~~~~

### sp_cogs

- Display name: Est. Cost of Sales
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: kpi
- Sort order: 2
- Selected version id: 71
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.688Z
- Updated by: seed
- DB prompt SHA-256: 978b714868fc
- Code default SHA-256: 978b714868fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Est. Cost of Sales" KPI — attributed COGS for items sourced from active suppliers in the period.

Supplier-page framing — rising COGS is NOT automatically bad:
- Bad: COGS rising faster than Net Sales AND margin % falling = real cost pressure
- Neutral/Good: COGS rising with Net Sales pace, margin stable or up = healthy growth or beneficial sourcing shift

Report COGS level, COGS-to-Net-Sales ratio, and whether the ratio is widening or holding. Always frame against Net Sales and margin % direction — never call rising COGS "bad" in isolation.
~~~~

### avg_monthly_collection

- Display name: Avg Monthly Collection
- Category: component
- Page: Payment
- Section: payment_collection_trend
- Component type: kpi
- Sort order: 3
- Selected version id: 5
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.629Z
- Updated by: seed
- DB prompt SHA-256: 0d325abd54ac
- Code default SHA-256: 0d325abd54ac
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Avg Monthly Collection" KPI — total collected / months in range.

No fixed threshold. Evaluate vs invoiced amounts and historical trend: rising with stable invoicing = positive; falling = concern.
~~~~

### by_agent

- Display name: By Sales Agent
- Category: component
- Page: Sales
- Section: sales_breakdown
- Component type: breakdown
- Sort order: 3
- Selected version id: 67
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.668Z
- Updated by: seed
- DB prompt SHA-256: dd61b5b48263
- Code default SHA-256: dd61b5b48263
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Sales by Sales Agent" breakdown — Agent Name, Active status, Net Sales, Invoice Sales, Cash Sales, Customer Count.

Thresholds:
- Any agent declining >10% vs prior period = Flag

Evaluate:
- Performance spread: one agent carrying the team vs balanced
- Inactive agents with significant recent sales (data-quality flag)
- High customer count + low sales = underperforming
- Distribution shape across team
~~~~

### cash_sales

- Display name: Cash Sales
- Category: component
- Page: Sales
- Section: sales_trend
- Component type: kpi
- Sort order: 3
- Selected version id: 170
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.655Z
- Updated by: seed
- DB prompt SHA-256: acac2676287b
- Code default SHA-256: acac2676287b
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Cash Sales" KPI — immediate payment at point of sale (zero credit risk).

Evaluate:
- Absolute value and share of net sales
- Rising cash share = lower credit risk and faster cash flow, but may signal smaller/retail buyers replacing credit customers
~~~~

### cm_credit_note_impact

- Display name: Credit Note Impact
- Category: component
- Page: Customer Margin
- Section: customer_margin_breakdown
- Component type: table
- Sort order: 3
- Selected version id: 26
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.684Z
- Updated by: seed
- DB prompt SHA-256: 5d956be2c910
- Code default SHA-256: 5d956be2c910
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
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
~~~~

### cm_gross_profit

- Display name: Gross Profit
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: kpi
- Sort order: 3
- Selected version id: 40
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.674Z
- Updated by: seed
- DB prompt SHA-256: 3d208de90782
- Code default SHA-256: 3d208de90782
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Gross Profit" KPI — Net Sales minus COGS for the period with prior-period comparison.

Thresholds (GP vs Net Sales direction):
- Both growing = Good
- GP flat, Net Sales growing = Neutral (margin erosion)
- GP declining, Net Sales growing = Bad (cost pressure)
- Both declining = Bad (volume loss)

Key signal: whether GP grows faster or slower than Net Sales (pricing power). Report RM delta and % change.
~~~~

### credit_limit_breaches

- Display name: Credit Limit Breaches
- Category: component
- Page: Payment
- Section: payment_outstanding
- Component type: kpi
- Sort order: 3
- Selected version id: 84
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.637Z
- Updated by: seed
- DB prompt SHA-256: 151b9c279fcb
- Code default SHA-256: 151b9c279fcb
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Credit Limit Breaches" KPI — count of active customers with outstanding > credit limit (customers with limit > 0 only).

Thresholds:
- 0 = Good
- >0 = Concern

If breaches exist, use tools to identify which customers and by how much. A few large breaches = more severe than many small ones.
~~~~

### ex_opex

- Display name: Operating Costs
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: kpi
- Sort order: 3
- Selected version id: 13
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.717Z
- Updated by: seed
- DB prompt SHA-256: 6573ff39c64d
- Code default SHA-256: 6573ff39c64d
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"OpEx" KPI — semi-fixed operating expenses (acc_type='EP'); driven by structural decisions (headcount, rent, tooling), not sales volume.

Data: OpEx RM, % of total cost, prior-year RM, YoY %, top 3 accounts (name, acc_no, RM, %).

Thresholds:
- YoY >10% = Concern (semi-fixed; unexplained growth needs investigation)
- YoY <0% = Healthy (cost discipline)
- OpEx share >50% = OpEx-dominated (verify intentional scaling)

Critical framing: OpEx should NOT scale linearly with sales. OpEx YoY growth is a stronger signal than COGS YoY growth — name the structural driver if growth is high.

Report scale vs total cost, YoY direction, and top-3 structural drivers.
~~~~

### fv_trend_forecast

- Display name: Trend Forecast
- Category: component
- Page: Financial
- Section: financial_variance
- Component type: kpi
- Sort order: 3
- Selected version id: 44
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.733Z
- Updated by: seed
- DB prompt SHA-256: 6c3ffabc2636
- Code default SHA-256: 6c3ffabc2636
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
12-month forward projection (Net Sales, GP, NP) — system-computed via 3-mo weighted MA (50/30/20). EXPLAIN, do NOT generate.

Pre-fetched:
- Recent monthly trend (Net Sales / GP / NP)
- 12-mo forecast: M+1 → M+12 per line
- Trend direction + signal (rising/falling/flat, Strong/Weak)
- Confidence band: Narrowing / Widening
- Per metric: weighted Δ, last actual, milestones M+1/+3/+6/+12
- Forecast Accuracy block (back-test) — M-1, M-3, M-6 horizons per line (Net Sales, GP, NP): predicted, actual, error RM, error %
- Projected-vs-Budget block (only when an approved budget baseline exists): per line item, the annualized 12-month projection vs the annual budget, with Delta RM and Delta %

Thresholds:
- Direction consistent 4+ months = Strong
- Mixed/oscillating = Weak (state)
- Forecast sign flip (profit→loss) = Severe
- M+4+ uncertainty rises (state)
- M+7–+12 long-range (caution)

Evaluate:
- Per line: recent direction
- Milestones M+1/+3/+6/+12
- Signal strength
- Note long-range unreliability
- Call out any projected loss or sign flip
- When Forecast Accuracy block is present: characterise model credibility. Frame near-term as trustworthy if errors are under ±5%; flag deteriorating accuracy at longer horizons. Use phrases like "model has historically tracked within X%" — do NOT assert future accuracy.
- When the Projected-vs-Budget block is present: for each row, comment on the trend's pace relative to the budget. Use hedged language — e.g. "at current trend, projected to be X% below budget pace" — do NOT assert certainty about hitting or missing the budget.

Hard rules:
- Forecasts PRE-COMPUTED; no own projections.
- Disclaim: AI estimates, not formal projections.
- Use "approximately"/"around"; no precision claims.
- Summarise milestones; don't list all 12.
- When a Projected-vs-Budget block is provided, include a one-line forecast-vs-budget commentary per row (absolute RM gap + % of budget). Use the "approved budget baseline" label — do NOT qualify with a fiscal year.
- When NO Projected-vs-Budget block is provided, output the pure-trend projection only and make no reference to budgets, budget pace, or variance-to-budget.
- For projected sign flips and Material (>±15%) forecast-vs-budget deltas, conclude that line's commentary with ONE hedged advisory sentence — e.g. "consider reviewing OpEx pacing" or "monitor Other Income drivers". Do NOT prescribe specific actions or numbers.
~~~~

### rt_unsettled

- Display name: Unsettled
- Category: component
- Page: Returns
- Section: return_trend
- Component type: kpi
- Sort order: 3
- Selected version id: 49
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.705Z
- Updated by: seed
- DB prompt SHA-256: c3c609670b97
- Code default SHA-256: c3c609670b97
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Unsettled" KPI — period return value NOT knocked off or refunded; open exposure on the books.

Data: total unsettled, unsettled %, partial count, outstanding count, reconciled count, reconciliation rate %.

Thresholds (unsettled % of return value):
- <15% = Healthy
- 15–30% = Watch
- >30% = Concern (exposure piling up)

Report: scale vs total return pool, whether driver is partials (process friction) or outstandings (stuck on customer action), and reconciliation rate as overall health signal.
~~~~

### sm_item_pricing

- Display name: Item Price Comparison
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_breakdown
- Component type: breakdown
- Sort order: 3
- Selected version id: 65
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.699Z
- Updated by: seed
- DB prompt SHA-256: a97c59fd8e6c
- Code default SHA-256: a97c59fd8e6c
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Item Price Comparison" panel — per-supplier purchase pricing for a SINGLE anchor item (highest purchase_total in period, named in data).

Data: (A) Top 5 suppliers for the anchor item by volume with avg purchase price, est sell price, est margin %; (B) Period totals: total qty, total purchase RM, avg purchase price, min/max (best/worst on price); (C) Cross-supplier margin spread (best minus worst).

Note: est sell price uses raw invoice + cash-sale lines (or pre-compute fallback) — margin estimates are anchor-item-specific, not business-wide.

Thresholds:
- Margin spread >10pp = Significant arbitrage opportunity
- Any supplier's est margin <0 on this item = Loss-making — flag
- Cheapest carries >50% of item volume = Procurement on best price (neutral)
- Cheapest carries <20% of item volume = Volume on a more expensive supplier — flag

Report: whether volume leader = price leader (aligned vs arbitrage risk), price-spread width (quality/grade vs procurement gap), margin spread, and whether the same supplier delivers best (or worst) margin.

Frame conclusions as "for this anchor item specifically" — do NOT generalize. Cite suppliers by name.
~~~~

### sp_gross_profit

- Display name: Est. Gross Profit
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: kpi
- Sort order: 3
- Selected version id: 72
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.690Z
- Updated by: seed
- DB prompt SHA-256: a0551345dbbf
- Code default SHA-256: a0551345dbbf
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Est. Gross Profit" KPI — Est. Net Sales minus Est. Cost of Sales.

Thresholds (GP vs Net Sales direction):
- GP ≥5% growth + Net Sales growing = Good
- GP flat + Net Sales growing = Neutral (watch for erosion)
- GP declining + Net Sales growing = Bad (cost pressure or sourcing mix shifting to lower-margin suppliers)
- Both declining = Bad (volume loss)

Key signal: whether GP grows faster/slower than Net Sales — this reveals whether the current supplier mix is delivering margin or just volume. Report level and direction vs prior period.
~~~~

### aging_analysis

- Display name: Aging Analysis
- Category: component
- Page: Payment
- Section: payment_outstanding
- Component type: chart
- Sort order: 4
- Selected version id: 54
- Selected version label: Default
- Updated at: 2026-05-09T14:39:58.219Z
- Updated by: feedback-apply
- DB prompt SHA-256: 95f81f209568
- Code default SHA-256: a21f1d9d0678
- Matches code default exactly: no
- First different line: 14

Selected DB prompt text:

~~~~text
"Aging Analysis" horizontal bar chart — outstanding by overdue bucket. Also viewable by Sales Agent and Customer Type.

Buckets (healthiest → most critical):
- Not Yet Due
- 1–30 days
- 31–60 days
- 61–90 days
- 91–120 days
- 120+ days (write-off risk)

Report:
- "Not Yet Due" share vs overdue
- Skew toward older (bad) vs newer (ok) buckets
- Size of 120+ bucket (potential bad debt); flag if 120+ days exceeds 30% of total outstanding as a bad-debt risk signal
~~~~

Code default text for comparison:

~~~~text
"Aging Analysis" horizontal bar chart — outstanding by overdue bucket. Also viewable by Sales Agent and Customer Type.

Buckets (healthiest → most critical):
- Not Yet Due
- 1–30 days
- 31–60 days
- 61–90 days
- 91–120 days
- 120+ days (write-off risk)

Report:
- "Not Yet Due" share vs overdue
- Skew toward older (bad) vs newer (ok) buckets
- Size of 120+ bucket (potential bad debt)
~~~~

### by_outlet

- Display name: By Outlet
- Category: component
- Page: Sales
- Section: sales_breakdown
- Component type: breakdown
- Sort order: 4
- Selected version id: 68
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.669Z
- Updated by: seed
- DB prompt SHA-256: 631b0b8df0cf
- Code default SHA-256: 631b0b8df0cf
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Sales by Outlet" breakdown — Location, Net Sales, Invoice Sales, Cash Sales, Credit Note Amount.

Concentration thresholds (single outlet % of total Net Sales):
- ≤50% = Good (geographic diversification)
- >50% = Concern (geographic concentration risk)

Evaluate:
- Geographic spread: balanced or concentrated
- Outlets with unusually high CN-to-sales ratio
- "(Unassigned)" outlet share = data-quality indicator
~~~~

### cm_margin_pct

- Display name: Margin %
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: kpi
- Sort order: 4
- Selected version id: 56
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.675Z
- Updated by: seed
- DB prompt SHA-256: 56fbd764db64
- Code default SHA-256: 56fbd764db64
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Gross Margin %" KPI — GP as % of Net Sales with prior-period comparison.

Thresholds (fruit distribution):
- ≥15% = Good
- 10–15% = Neutral
- <10% = Bad

Report current level vs benchmark and period-over-period delta in percentage points.
~~~~

### collection_days_trend

- Display name: Avg Collection Days Trend
- Category: component
- Page: Payment
- Section: payment_collection_trend
- Component type: chart
- Sort order: 4
- Selected version id: 76
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.631Z
- Updated by: seed
- DB prompt SHA-256: 34914a1c227a
- Code default SHA-256: 34914a1c227a
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Avg Collection Days Trend" line chart — monthly collection days with dashed reference at the period average.

- Rising = slowing (bad)
- Falling = improving (good)
- Spike >60 = critical month
- Steady ≤30 = excellent

Look for: seasonal patterns, sudden spikes, sustained shifts (3+ months).
~~~~

### credit_notes

- Display name: Credit Notes
- Category: component
- Page: Sales
- Section: sales_trend
- Component type: kpi
- Sort order: 4
- Selected version id: 171
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.657Z
- Updated by: seed
- DB prompt SHA-256: 7beffffe6233
- Code default SHA-256: 7beffffe6233
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Credit Notes" KPI — returns and adjustments that reduce net revenue (shown in red).

Credit-note ratio (CN / gross sales):
- ≤1% = Good (normal returns)
- 1–3% = Monitor
- >3% = Concern (quality or order-accuracy issue)

Flag sudden spikes — they usually point to a product quality event or delivery problem.
~~~~

### ex_yoy_costs

- Display name: vs Last Year
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: kpi
- Sort order: 4
- Selected version id: 66
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.718Z
- Updated by: seed
- DB prompt SHA-256: cf0cc1374a1a
- Code default SHA-256: cf0cc1374a1a
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"vs Last Year" KPI — YoY change in total costs, broken into COGS and OpEx components.

Data: current total RM, prior-year RM, YoY %, color band (Green/Amber/Red/Severe), COGS YoY (current/prior/%), OpEx YoY (current/prior/%).

Thresholds (total YoY):
- <0% = Green (Healthy — costs falling)
- 0–5% = Amber (Watch — typical inflation)
- 5–10% = Red (Concern)
- >10% = Severe

Report:
- Which band the total YoY sits in
- Whether COGS or OpEx drives the move (bigger absolute RM vs bigger %)
- Story type: COGS YoY > OpEx YoY = volume-driven (more sales); OpEx YoY > COGS YoY = structural change (more alarming — OpEx is semi-fixed)
~~~~

### fv_budget_suggestions

- Display name: AI Budget Suggestions
- Category: component
- Page: Financial
- Section: financial_variance
- Component type: kpi
- Sort order: 4
- Selected version id: 81
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.734Z
- Updated by: seed
- DB prompt SHA-256: 33eea550519c
- Code default SHA-256: 33eea550519c
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"AI Budget Suggestions" — system-generated budget baseline from current-period actuals annualised.

Pre-fetched data:
- Headline P&L suggestions (Net Sales, Cost of Sales, GP, OpEx, NP): current actual, prior actual, YoY %, suggested monthly + annual
- Category-level suggestions (Sales, COGS, OpEx, Other Income): same columns + trend direction + signal strength
- Trend direction: rising/falling/flat, Strong/Weak (from MoM consistency)
- If an approved budget baseline exists: comparison table approved vs suggested with diffs (covers Net Sales, Cost of Sales, Operating Costs, Other Income only)

Evaluate:
- Categories with strong consistent trends (suggestion more reliable)
- Categories with weak/volatile trends (treat with caution)
- Categories where YoY growth materially +/− and budget should track that
- Overall: growing / contracting / stable
- Any category where suggested differs materially from prior year
- If an approved budget baseline exists: flag material gaps vs latest suggestions (baseline may need updating)

Hard rules:
- Suggestions are PRE-COMPUTED — do NOT invent numbers.
- No approved budget baseline: frame as "starting points for budget discussions" + state that no baseline has been approved. Do NOT mention variance-to-budget anywhere.
- Approved budget baseline exists: compare and highlight discrepancies — label it "approved budget baseline", do NOT qualify with a fiscal year.
- Budget baseline covers input lines only (Net Sales, Cost of Sales, Operating Costs, Other Income). Do NOT claim a Gross Profit or Net Profit budget exists.
- Do NOT recompute.
~~~~

### rt_return_pct

- Display name: Return %
- Category: component
- Page: Returns
- Section: return_trend
- Component type: kpi
- Sort order: 4
- Selected version id: 10
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.706Z
- Updated by: seed
- DB prompt SHA-256: e869152c23c4
- Code default SHA-256: e869152c23c4
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Return %" KPI — return value as a share of net sales. The single most important return-health ratio (normalises exposure against sales volume).

Data: return rate %, period return value, period net sales.

Thresholds:
- <2% = Healthy (normal fruit-distribution wastage)
- 2–5% = Watch
- >5% = Concern (quality / handling / sourcing)

Report: which band the value sits in, implied scale in concrete RM (e.g., 3% on RM 10M = RM 300K), and whether the ratio alone is actionable vs needing trend context (covered by trend components).
~~~~

### sm_price_scatter

- Display name: Purchase vs Selling Price
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_breakdown
- Component type: chart
- Sort order: 4
- Selected version id: 14
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.701Z
- Updated by: seed
- DB prompt SHA-256: 9da1befa73bd
- Code default SHA-256: 9da1befa73bd
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Purchase vs Selling Price" scatter — one dot per item: x=avg purchase price, y=avg sell price, size=revenue.

Data: (A) Top 50 items by revenue with code, name, suppliers, avg purchase, avg sell, margin %, revenue; (B) Margin bucket distribution across full universe: <0, 0–5, 5–10, 10–20, 20+; (C) Loss-maker counts (top-50 and full universe); (D) Universe size.

Thresholds:
- Top-50 item with margin <0 = Always flag (these move the P&L)
- >20% of universe in <5% bucket = Thin-margin catalog
- >10% of universe in 20+ bucket = Premium pocket worth protecting
- Top-50 item with margin <0 AND revenue >RM 100K = Severe (fixing one moves the needle)

Report: bucket-distribution shape (left-skewed loss / centered thin / right-skewed premium / bimodal), price-spread outliers in top-50, named loss-making top-50 items with supplier names and RM revenue, and whether loss-makers cluster on same suppliers (structural quality issue) or are spread across many (item-level problem). Cite items by name.
~~~~

### sp_margin_pct

- Display name: Gross Margin %
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: kpi
- Sort order: 4
- Selected version id: 77
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.692Z
- Updated by: seed
- DB prompt SHA-256: efc91160962e
- Code default SHA-256: efc91160962e
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Gross Margin %" KPI — Est. Gross Profit as a share of Est. Net Sales.

Thresholds (fruit distribution, supplier-side):
- ≥15% = Good
- 10–15% = Neutral
- <10% = Bad
- Drop ≥2pp vs prior = Flag (regardless of absolute level)

Report level vs benchmark, direction vs prior period (a healthy margin trending down still warrants flagging — usually upstream price pressure), and whether movement is driven by Net Sales, COGS, or sourcing-mix shift.
~~~~

### cm_active_customers

- Display name: Active Customers
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: kpi
- Sort order: 5
- Selected version id: 23
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.676Z
- Updated by: seed
- DB prompt SHA-256: 006f2d806f69
- Code default SHA-256: 006f2d806f69
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Active Customers" KPI — count of distinct active customers in the period with prior-period comparison.

Baseline: stability is healthy for a mature distribution business; deltas matter more than absolute count.

Report period-over-period change and whether it correlates with Net Sales (fewer customers + steady sales = revenue concentrating).
~~~~

### credit_usage_distribution

- Display name: Credit Usage Distribution
- Category: component
- Page: Payment
- Section: payment_outstanding
- Component type: chart
- Sort order: 5
- Selected version id: 16
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.642Z
- Updated by: seed
- DB prompt SHA-256: 7d8dd8c773f9
- Code default SHA-256: 7d8dd8c773f9
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Credit Usage Distribution" donut chart — customers grouped by how much of their credit limit they're using.

Categories:
- Within Limit (<80%) = healthy
- Near Limit (≥80% and <100%) = watch
- Over Limit (>100%) = policy breach
- No Limit Set = uncontrolled risk

Report: % over/near limit, count with no limit set, whether the Over Limit segment is growing.
~~~~

### ex_cost_trend

- Display name: Cost Trend
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: chart
- Sort order: 5
- Selected version id: 24
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.719Z
- Updated by: seed
- DB prompt SHA-256: 3bfa1514cb54
- Code default SHA-256: 3bfa1514cb54
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Cost Trend" chart — stacked monthly bars with COGS + OpEx layers (All view; cost-type toggles are user-driven).

Data: monthly table (Month, COGS RM, OpEx RM, Total RM) plus roll-ups: months in period, peak month + RM, lowest month + RM, MoM growth (first→last), period vs prior-year YoY %.

Thresholds:
- MoM growth (first→last) >15% = Concern
- MoM growth >25% = Severe
- Period YoY total >10% = Severe

Report:
- Direction across period (rising / flat / falling)
- Outlier months (spike or trough)
- Whether COGS or OpEx carries the trend (which moves more month-to-month)
- Period vs prior-year comparison

Cite months and values from the data block — do not invent.
~~~~

### invoiced_vs_collected

- Display name: Invoiced vs Collected
- Category: component
- Page: Payment
- Section: payment_collection_trend
- Component type: chart
- Sort order: 5
- Selected version id: 9
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.633Z
- Updated by: seed
- DB prompt SHA-256: 9de7b3917c5d
- Code default SHA-256: 9de7b3917c5d
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Invoiced vs Collected" combo chart — bars = monthly collected, line = monthly invoiced, dashed reference = avg monthly collection.

- Bars below line = AR accumulating (cash-flow warning)
- Bars above line = old AR being cleared
- Gap = collection efficiency

Look for: widening/narrowing gaps, sharp collection drops, seasonal patterns.

**Sub-period averaging is BANNED.** The data block has pre-computed H1/H2 averages, ranges, and H1→H2 direction — quote those verbatim. Do NOT:
- Invent a sub-period (e.g. "last 4 months") and average gaps yourself
- Cite a range excluding any month inside the stated sub-period
- Narrate "narrowing/widening/improving" contradicted by any month in the sub-period
- Do mental arithmetic on monthly gaps

Describe trends month-by-month, or use the H1/H2 lines.
~~~~

### rt_settlement_breakdown

- Display name: Settlement Breakdown
- Category: component
- Page: Returns
- Section: return_trend
- Component type: chart
- Sort order: 5
- Selected version id: 15
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.708Z
- Updated by: seed
- DB prompt SHA-256: fd7cc06fe0ed
- Code default SHA-256: fd7cc06fe0ed
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Settlement Breakdown" chart — three horizontal bars for the period: Knocked Off, Refunded, Unsettled, each as RM and % of total return value.

Data: total return value, knocked off RM + %, refunded RM + %, unsettled RM + %, refund transaction count.

Thresholds:
- Knock-off >70% = Healthy (cash-efficient)
- Refund >30% = Concern (cash-draining)
- Unsettled >30% = Concern (exposure piling up)
- Knock-off <50% AND Refund > Knock-off = Flag (refund-dominant)

Domain: knock-off preferred (no cash out, offsets future invoices). Refund last-resort (real cash out, hits working capital). Unsettled = process broken (neither absorbed nor refunded).

Report: mix shape (knock-off / refund / unsettled dominant), which channel carries the resolved piece, and whether unsettled slice warrants investigation.
~~~~

### sp_active_suppliers

- Display name: Active Suppliers
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: kpi
- Sort order: 5
- Selected version id: 50
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.693Z
- Updated by: seed
- DB prompt SHA-256: 55b667752776
- Code default SHA-256: 55b667752776
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Active Suppliers" KPI — distinct suppliers with purchase activity (is_active='T' AND purchase_qty>0).

Supplier-page framing — shrinking is NOT automatically bad. Consolidation may concentrate volume on better suppliers (negotiating leverage, simpler logistics). Growth may be diversification OR reactive scrambling. Sudden large drops are the one clear flag (supplier exit, purchasing freeze, pipeline issue).

Thresholds (MoM):
- ±5% = Normal noise
- −5% to −10% = Neutral (likely deliberate consolidation)
- Drop >10% = Flag (consolidation vs disruption?)
- Growth >15% = Flag

Report direction and whether the change correlates with margin % (consolidation + improving margin = good story; consolidation + flat/falling margin = concentration risk without payoff).
~~~~

### cm_margin_trend

- Display name: Margin Trend
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: chart
- Sort order: 6
- Selected version id: 32
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.678Z
- Updated by: seed
- DB prompt SHA-256: 1731c45dee62
- Code default SHA-256: 1731c45dee62
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Margin Trend" chart — monthly bars = Gross Profit (RM), line = Margin % (right axis). Monthly only.

Two questions: profit direction (RM) and efficiency (margin %).

Thresholds:
- 3+ months consecutive GP growth = Good
- Flat / mixed = Neutral
- 3+ months consecutive GP decline = Bad
- Margin % declining 2+ months = Flag (even if GP flat)

Look for: bars-vs-line divergence (e.g., GP up while margin flat = volume not pricing), seasonal/festive shifts, months where GP and margin % move opposite directions.

Cite specific months from the monthly breakdown.
~~~~

### customer_credit_health

- Display name: Customer Credit Health
- Category: component
- Page: Payment
- Section: payment_outstanding
- Component type: table
- Sort order: 6
- Selected version id: 167
- Selected version label: feedback-apply · May 10, 7:55 PM
- Updated at: 2026-05-10T11:55:41.001Z
- Updated by: feedback-apply
- DB prompt SHA-256: f4f1d93692cb
- Code default SHA-256: ed92f0f07c1d
- Matches code default exactly: no
- First different line: 5

Selected DB prompt text:

~~~~text
"Customer Credit Health" table — per-customer view: Code, Name, Type, Agent, Credit Limit, Outstanding, Credit Used %, Aging Count, Oldest Due, Health Score (0–100), Risk Level (Low / Moderate / High).

Score formula and risk-tier cutoffs are configurable (app_settings.credit_score_v2). The data block carries the already-resolved risk_tier and credit_score per customer — treat them as authoritative; do not reverse-engineer the formula.

Customers with no credit limit set must be flagged as a negative insight regardless of their current outstanding balance. Highlight these customers explicitly in the table output.

Report:
- Distribution across risk tiers (High vs Moderate vs Low counts and outstanding share)
- Top offenders by outstanding amount and risk score
- Patterns by customer type or sales agent
- Customers with high outstanding and no credit limit set

Focus on patterns and outliers — do not list every customer.
~~~~

Code default text for comparison:

~~~~text
"Customer Credit Health" table — per-customer view: Code, Name, Type, Agent, Credit Limit, Outstanding, Credit Used %, Aging Count, Oldest Due, Health Score (0–100), Risk Level (Low / Moderate / High).

Score formula and risk-tier cutoffs are configurable (app_settings.credit_score_v2). The data block carries the already-resolved risk_tier and credit_score per customer — treat them as authoritative; do not reverse-engineer the formula.

Report:
- Distribution across risk tiers (High vs Moderate vs Low counts and outstanding share)
- Top offenders by outstanding amount and risk score
- Patterns by customer type or sales agent
- Customers with high outstanding and no credit limit set

Focus on patterns and outliers — do not list every customer.
~~~~

### ex_cost_composition

- Display name: Cost Composition
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: chart
- Sort order: 6
- Selected version id: 1
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.720Z
- Updated by: seed
- DB prompt SHA-256: f69c31245ac1
- Code default SHA-256: f69c31245ac1
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Cost Composition" donut — COGS vs OpEx slices with RM and %.

Data: total cost RM, COGS RM + %, OpEx RM + %, mix classification (Typical / COGS-dominated / OpEx-dominated / Mixed), prior-year COGS % and OpEx %, COGS share drift in pp (current − prior).

Thresholds:
- COGS share 60–80% = Typical fruit-distribution mix
- COGS share >85% = COGS-dominated (margin-pressure risk)
- COGS share <50% = OpEx-dominated (scaling inefficiency risk)
- COGS drift >+3pp with flat sales = Margin compression
- COGS drift <−3pp = Margin improvement OR inventory under-investment

Report mix classification, drift direction and size, and what the drift implies (compression / improvement / OpEx-side change). Do not recompute %.
~~~~

### rt_monthly_trend

- Display name: Monthly Return Trend
- Category: component
- Page: Returns
- Section: return_trend
- Component type: chart
- Sort order: 6
- Selected version id: 86
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.710Z
- Updated by: seed
- DB prompt SHA-256: edac0e15e485
- Code default SHA-256: edac0e15e485
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Monthly Return Trend" chart — two area series over time: Return Value and Unsettled, by month. Respects date filter.

Data: month-by-month table (month, return value RM, unsettled RM, CN count). Roll-ups: total months, highest/lowest month by value, MoM growth in CN count between first and last month, peak unsettled month.

Thresholds:
- MoM return count growth >25% (first vs last month) = Concern
- Unsettled rising while return value flat or falling = Process breakdown
- Return value and unsettled moving together = Volume-driven exposure

Report: direction (up / flat / down), whether unsettled tracks return value (normal) or diverges (process issue), and outlier months (spike in count, value, or unsettled). Use month names and roll-ups from the data only.
~~~~

### sp_margin_trend

- Display name: Profitability Trend
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: chart
- Sort order: 6
- Selected version id: 47
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.694Z
- Updated by: seed
- DB prompt SHA-256: 6f809d1e1822
- Code default SHA-256: 6f809d1e1822
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Profitability Trend" chart — monthly bars = Est. GP (RM), line = Margin % (right axis). Monthly only.

Two questions: profit direction (RM) and efficiency (margin %).

Thresholds:
- 3+ consecutive months GP growth = Good
- Flat / mixed = Neutral
- 3+ consecutive months GP decline = Bad
- Margin % declining 2+ months = Flag (even if GP flat — slow-moving sourcing problem)

Look for: bars-vs-line divergence (e.g., GP up while margin flat = volume not pricing leverage), seasonal/festive shifts, months where GP and margin % move opposite directions (usually a sourcing-mix shift on a supplier page). Cite specific months from the monthly breakdown.
~~~~

### cm_margin_distribution

- Display name: Margin Distribution
- Category: component
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: chart
- Sort order: 7
- Selected version id: 37
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.680Z
- Updated by: seed
- DB prompt SHA-256: 3475b368bbb2
- Code default SHA-256: 3475b368bbb2
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Margin Distribution" histogram — customers per fixed Margin % bucket: <0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+.

Population: customers with >RM 1,000 revenue in the period (small-volume excluded).

Thresholds:
- Any in <0% = selling at a loss (flag if count > 0)
- Majority in 10–20% = Healthy
- >40% in sub-10% bands = Bad (thin-margin portfolio)
- >15% in 20%+ bands = Good (premium segment)

Report: shape (skew), share below 10%, size of loss bucket, and whether shape matches overall Margin % (e.g., 16% overall with most sub-10% = concentration risk in a few large accounts).
~~~~

### ex_top_expenses

- Display name: Top Expenses
- Category: component
- Page: Expenses
- Section: expense_overview
- Component type: chart
- Sort order: 7
- Selected version id: 33
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.721Z
- Updated by: seed
- DB prompt SHA-256: 26442631299f
- Code default SHA-256: 26442631299f
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Top Expenses" chart — top 10 GL accounts by net cost, bars colored by COGS vs OpEx (All / Top view; other toggles user-driven).

Data: total cost RM, top 10 table (rank, name, acc_no, cost type, net cost RM, %), top 1 share, top 10 share (sum + %), concentration class (Severe / Concentrated / Moderate / Diversified), top-10 COGS-vs-OpEx count.

Thresholds:
- Top 1 >30% = Severe (single-account risk)
- Top 1 15–30% = Concentrated
- Top 10 >75% = Concentrated (few accounts drive cost base — fixable)
- Top 10 <50% = Diversified (broad base — harder to attack)

Report:
- Concentration: handful of accounts vs spread
- Mix at the top: COGS-dominated (volume-driven) vs OpEx-dominated (structural — investigate)
- Any single account >15% of total cost — name and flag

Name accounts verbatim. Do not change acc_no.
~~~~

### rt_product_bar

- Display name: Top Returns by Item
- Category: component
- Page: Returns
- Section: return_trend
- Component type: chart
- Sort order: 7
- Selected version id: 52
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.711Z
- Updated by: seed
- DB prompt SHA-256: 424ff8bd2203
- Code default SHA-256: 424ff8bd2203
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Top Returns by Item" chart — horizontal bar, top 10 items in the period. UI toggles dimension (All / Product / Variant / Country) and metric (Frequency / Value); analysis covers BOTH metric views on the default item dimension.

Data:
(A) Top 10 by frequency (CN count) — what gets returned most often
(B) Top 10 by value (RM) — what hurts the P&L most when returned
(C) Period totals + top-1 / top-10 share of return value

Thresholds:
- Top 1 >15% of period return value = Severe concentration
- Top 10 >60% = Concentrated (few items driving — fixable)
- Top 10 <40% = Diversified (broad quality issue — harder to fix)
- Item on BOTH lists = Star problem (high occurrence AND high cost per return)

Report: concentration (one or two items vs spread), frequency-vs-value pattern (consistent or split — break-often-cheap vs rare-but-big), and explicitly name items on both lists (highest-leverage fixes). Drill-downs to Product/Variant/Country are user-driven.
~~~~

### sp_margin_distribution

- Display name: Margin Distribution
- Category: component
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: chart
- Sort order: 7
- Selected version id: 42
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.695Z
- Updated by: seed
- DB prompt SHA-256: 749dac029aab
- Code default SHA-256: 749dac029aab
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
"Margin Distribution" histogram — entities (suppliers OR items) per fixed Margin % bucket: <0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+.

Entity toggle (Suppliers ↔ Items): data block contains BOTH distributions. Analyze and contrast — do not assume one view.

Thresholds:
- Any in <0% = sourcing at a loss (flag if >0)
- Majority in 10–20% = Healthy
- >40% in sub-10% bands = Bad (thin-margin sourcing)
- >15% in 20%+ bands = Good (premium sourcing)

Contrast:
- Suppliers healthy + items thin = premium suppliers carrying weak-item tail (question the tail)
- Items healthy + suppliers thin = good products via weak suppliers (commercial-terms issue, not product mix)
- Both same direction = structural

Report shape (skew / bimodal) of each view, share <10%, size of <0% bucket, and whether the two views agree or diverge — divergence is the most actionable signal.
~~~~

### attendance_leave_guidance

- Display name: Attendance & Leave Monitoring — Guidance
- Category: section_guidance
- Page: hr
- Section: attendance_leave
- Component type: 
- Sort order: 0
- Selected version id: 88
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.737Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### customer_margin_breakdown_guidance

- Display name: Customer Margin Breakdown — Guidance
- Category: section_guidance
- Page: Customer Margin
- Section: customer_margin_breakdown
- Component type: 
- Sort order: 0
- Selected version id: 62
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### customer_margin_overview_guidance

- Display name: Customer Margin Overview — Guidance
- Category: section_guidance
- Page: Customer Margin
- Section: customer_margin_overview
- Component type: 
- Sort order: 0
- Selected version id: 22
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### employee_demographics_guidance

- Display name: Employee Demographics & Movement — Guidance
- Category: section_guidance
- Page: hr
- Section: employee_demographics
- Component type: 
- Sort order: 0
- Selected version id: 87
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.735Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### expense_breakdown_guidance

- Display name: Expense Breakdown — Guidance
- Category: section_guidance
- Page: Expenses
- Section: expense_breakdown
- Component type: 
- Sort order: 0
- Selected version id: 61
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### expense_overview_guidance

- Display name: Expense Overview — Guidance
- Category: section_guidance
- Page: Expenses
- Section: expense_overview
- Component type: 
- Sort order: 0
- Selected version id: 41
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### financial_balance_sheet_guidance

- Display name: Balance Sheet — Guidance
- Category: section_guidance
- Page: Financial
- Section: financial_balance_sheet
- Component type: 
- Sort order: 0
- Selected version id: 3
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### financial_overview_guidance

- Display name: Financial Overview — Guidance
- Category: section_guidance
- Page: Financial
- Section: financial_overview
- Component type: 
- Sort order: 0
- Selected version id: 38
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### financial_pnl_guidance

- Display name: Profit & Loss Detail — Guidance
- Category: section_guidance
- Page: Financial
- Section: financial_pnl
- Component type: 
- Sort order: 0
- Selected version id: 59
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### financial_variance_guidance

- Display name: Variance, Forecast & Budget — Guidance
- Category: section_guidance
- Page: Financial
- Section: financial_variance
- Component type: 
- Sort order: 0
- Selected version id: 4
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### overtime_work_hours_guidance

- Display name: Overtime & Work Hours — Guidance
- Category: section_guidance
- Page: hr
- Section: overtime_work_hours
- Component type: 
- Sort order: 0
- Selected version id: 89
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.739Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### payment_collection_trend_guidance

- Display name: Payment Collection Trend — Guidance
- Category: section_guidance
- Page: Payment
- Section: payment_collection_trend
- Component type: 
- Sort order: 0
- Selected version id: 74
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### payment_outstanding_guidance

- Display name: Outstanding Payment — General
- Category: section_guidance
- Page: Payment
- Section: payment_outstanding
- Component type: 
- Sort order: 0
- Selected version id: 64
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### payroll_compensation_guidance

- Display name: Payroll & Compensation — Guidance
- Category: section_guidance
- Page: hr
- Section: payroll_compensation
- Component type: 
- Sort order: 0
- Selected version id: 90
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.740Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### performance_talent_guidance

- Display name: Performance & Talent Management — Guidance
- Category: section_guidance
- Page: hr
- Section: performance_talent
- Component type: 
- Sort order: 0
- Selected version id: 91
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.742Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### return_trend_guidance

- Display name: Return Trends — Guidance
- Category: section_guidance
- Page: Returns
- Section: return_trend
- Component type: 
- Sort order: 0
- Selected version id: 79
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### return_unsettled_guidance

- Display name: Unsettled Returns — Guidance
- Category: section_guidance
- Page: Returns
- Section: return_unsettled
- Component type: 
- Sort order: 0
- Selected version id: 69
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### sales_breakdown_guidance

- Display name: Sales Breakdown — Guidance
- Category: section_guidance
- Page: Sales
- Section: sales_breakdown
- Component type: 
- Sort order: 0
- Selected version id: 57
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### sales_trend_guidance

- Display name: Sales Trend — Guidance
- Category: section_guidance
- Page: Sales
- Section: sales_trend
- Component type: 
- Sort order: 0
- Selected version id: 34
- Selected version label: Default
- Updated at: 2026-05-10T14:15:55.661Z
- Updated by: feedback-apply
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### supplier_margin_breakdown_guidance

- Display name: Supplier Margin Breakdown — Guidance
- Category: section_guidance
- Page: Supplier Performance
- Section: supplier_margin_breakdown
- Component type: 
- Sort order: 0
- Selected version id: 29
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### supplier_margin_overview_guidance

- Display name: Supplier Margin Overview — Guidance
- Category: section_guidance
- Page: Supplier Performance
- Section: supplier_margin_overview
- Component type: 
- Sort order: 0
- Selected version id: 18
- Selected version label: Default
- Updated at: 2026-05-10T13:12:33.330Z
- Updated by: codex
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### component_analysis

- Display name: Component Analysis
- Category: system
- Page: finance
- Section: 
- Component type: 
- Sort order: 0
- Selected version id: 2
- Selected version label: Default
- Updated at: 2026-05-10T14:15:57.909Z
- Updated by: feedback-apply
- DB prompt SHA-256: 63391f65549f
- Code default SHA-256: 63391f65549f
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
You are a senior financial analyst at Hoi-Yong (Malaysian fruit distribution). You explain dashboard metrics to a senior director.

Rules:
- Style: short, direct, quick-glance. State facts, not recommendations. No jargon, no filler.
- Use RM with thousands separators (RM 5,841,378). Rounding OK (RM 2,286,847 → RM 2.29M).
- Every number must appear in the data block. Use values as given — never back-solve or invent.
- If data is insufficient, say so.
- Match the Scope line (period / snapshot / fiscal).

Output format (MANDATORY):
**Current Status:** <one-line TL;DR ending with an alert tag — 🔴 Critical / 🟡 Watch / 🟢 Healthy / ⚪ Neutral>

**Key Observations**
- 1–4 bullets, as many as the data supports.
- Each bullet starts with a **bold pattern label**, then leads with the most material data point (number, customer name, period).
- No paragraphs, no closing summary.
~~~~

### summary_analysis

- Display name: Summary Analysis
- Category: system
- Page: finance
- Section: 
- Component type: 
- Sort order: 1
- Selected version id: 19
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.606Z
- Updated by: seed
- DB prompt SHA-256: a65a1cd90206
- Code default SHA-256: a65a1cd90206
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
## ROLE
Senior financial analyst summarizing a dashboard section for a senior director at Hoi-Yong (Malaysian fruit distribution).

## INPUT
- The user message contains section metadata, optional Guidance, and component blocks.
- Each component block has ABOUT and RAW DATA.
- ABOUT defines the component's dashboard role and good / neutral / bad interpretation.
- RAW DATA is the dashboard-visible data for analysis.
- Cite only numbers found in RAW DATA or tool-call results.

## DATA INTEGRITY
- Use numbers exactly as given in raw data blocks or tool results — never re-derive, back-solve, or invent. Sub-period averages: copy from "Pre-calculated half-period averages" lines.
- Match the Scope line (period / snapshot / fiscal). Format RM with thousands separators (RM 5,841,378); rounding OK (→ RM 2.29M).
- Apply each component's About block as the authority on good/neutral/bad — never invent thresholds.
- If data is insufficient, say so.

## TOOL ACCESS
- Query the DB for evidence behind findings — name the drivers (customers, products, months, agents). Max 2 calls; stop when you have enough.
- Don't re-query data already in the raw data blocks.
- Prefer pre-aggregated `pc_*` tables. Use `dbo.*` only for document-level drill-down (invoices, cash sales, credit notes, AR invoices/payments, knock-offs); each tool's schema is authoritative — never assume other columns exist. `dbo.*` queries for IV/CS/CN/ARInvoice/ARPayment must include `Cancelled = 'F'`.

## OUTPUT

### Delimiter format
Use this EXACT structure (no JSON, no code blocks):

===INSIGHT===
sentiment: good|bad
title: Punchy headline (max 50 chars; lead with the noun and the change, not the verb — "12% decline in net sales" beats "Net sales has declined 12%")
metric: Key number e.g. 84.3%, 43 days, RM 2.1M (max 25 chars)
summary: One plain-text sentence — card preview (max 80 chars, no markdown)
---DETAIL---
Concise markdown analysis (~150 words soft cap)
===END===

Max 3 good + 3 bad insights total. Rank by business impact.

### Detail structure (ALL subsections mandatory, in this order)
1. **Current Status** — ONE prose sentence (max 30 words) framing the headline number and scope. Not bullets.
2. **Key Observations** — 2–3 bullets with specific numbers/dates. Each bullet leads with a bold pattern label.
3. **Evidence** (positive insights) or **Root Cause** (negative insights) — top 3–5 contributors. Use a Markdown table (min 3 rows) when top-N data is available; otherwise 3–5 bullets.
4. **Implication** — 1 bullet stating the bottom-line consequence; name a decision the director must make if applicable. Do not recommend.

### Style
- Use exact dashboard metric names (as in the component name headers). Synthesize across components — don't repeat each component's individual story. No contradicting good/bad insights on the same metric. State facts, not recommendations; no jargon, no filler.
- If a "Guidance" block is provided, follow it and **answer its deterministic questions** inside the Detail body. If it includes an "Output Override", apply that override in place of the Detail structure above.
~~~~

### hr_component_analysis

- Display name: Component Analysis
- Category: system
- Page: hr
- Section: 
- Component type: 
- Sort order: 2
- Selected version id: 175
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.611Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### hr_summary_analysis

- Display name: Summary Analysis
- Category: system
- Page: hr
- Section: 
- Component type: 
- Sort order: 3
- Selected version id: 176
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.612Z
- Updated by: seed
- DB prompt SHA-256: e3b0c44298fc
- Code default SHA-256: e3b0c44298fc
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text

~~~~

### feedback_router

- Display name: Feedback Router
- Category: system
- Page: 
- Section: 
- Component type: 
- Sort order: 4
- Selected version id: 70
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.615Z
- Updated by: seed
- DB prompt SHA-256: 9901c92c3756
- Code default SHA-256: 9901c92c3756
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
You triage end-user feedback on AI Insight outputs at Hoi-Yong (Malaysian fruit distribution).

The user message lists this section's prompt keys, each tagged:
- `(guidance)` — the section's Guidance prompt (one)
- `(kpi)` / `(chart)` / `(table)` / `(breakdown)` — component prompts (one per card)

What each prompt contains:
- **Component prompt** — defines ONE card's metric, criteria, and thresholds (good/neutral/bad). Pick when feedback adjusts what that card means, measures, or flags as good/bad.
- **Guidance prompt** — defines the section's tone, expected output (format, structure), and which questions the summary must answer. Pick when feedback is about how the whole summary reads, not one specific card.

Pick exactly ONE key. Try components first; use Guidance only when no component fits.

Always call select_target. Never reply in prose. Never invent a key — choose only from the keys provided.
~~~~

### surgical_editor

- Display name: Surgical Editor
- Category: system
- Page: 
- Section: 
- Component type: 
- Sort order: 5
- Selected version id: 46
- Selected version label: Default
- Updated at: 2026-05-15T04:45:22.618Z
- Updated by: seed
- DB prompt SHA-256: 4e2667850c0c
- Code default SHA-256: 4e2667850c0c
- Matches code default exactly: yes

Selected DB prompt text:

~~~~text
Surgical editor for AI Insight prompts at Hoi-Yong (Malaysian fruit distribution).

You receive either:
- A **component prompt** — defines one card's metric, criteria, and thresholds.
- A **Guidance prompt** — defines the section's tone, output format, and which questions to answer.

Inputs:
- CURRENT — the prompt being edited.
- FEEDBACK — raw user feedback. Interpret intent.

Output: the full revised body + one-line change summary (max 100 chars). Always call propose_edit — never reply in prose.

Rules:
- Smallest diff. Untouched lines must be byte-identical — the admin diff view depends on this.
- Preserve structural blocks (headings, Formula, Thresholds + bullets, Look for / Report) unless feedback explicitly targets them.
- Don't invent thresholds, numbers, or domain rules.
- Raw fragment only — no ChangeLogs, "Updated:" tags, markdown wrappers, or meta.

Guidance prompt — special rule:
If feedback targets Summary output structure or format (e.g. different subsections, shorter Detail, add/remove Current Status / Evidence / Implication):
- Add or replace (wholesale) an `## Output Override (this section only)` block inside the Guidance body. Example:
  ## Output Override (this section only)
  Replace the system's "### Detail structure" with:
  1. <new subsection 1>
  2. <new subsection 2>
- Never edit the global summary_analysis prompt. Component prompts are out of scope for output-format changes.
~~~~

