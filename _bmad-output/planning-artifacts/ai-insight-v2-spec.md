# AI Insight Engine v2 — Section Specs

**Status:** Active (section-by-section authoring in progress)
**Base document:** [ai-insight-engine-spec.md](./ai-insight-engine-spec.md) (v1 — the quality bar)
**Rollout tracker:** [ai-insight-v2-rollout-plan.md](./ai-insight-v2-rollout-plan.md)

---

## 0. Scope & Relationship to v1

This document specifies the **11 new sections** being rolled out across Customer Margin, Supplier Performance, Returns, Expenses, and Financial pages. It **does not** duplicate v1 infrastructure — all cross-cutting concerns are inherited from the v1 spec:

| Concern | Inherited from v1 section |
|---------|---------------------------|
| AI engine config (SDK, models, limits) | v1 §3 |
| UI panel behavior (states, dialogs, collapse) | v1 §4 |
| Analysis flow (steps, cancellation, timeout) | v1 §5 |
| Global system prompt (prepended to all calls) | v1 §6.1 |
| Summary prompt template | v1 §6.6 |
| User prompt template | v1 §6.7 |
| Concurrency lock | v1 §7 |
| Storage schema | v1 §8 |
| Tool safety rules (server-side guards) | v1 §9.4 |
| Verification protocol | v1 §9.5 + Appendix C |
| API design | v1 §10 |
| Error handling | v1 §12 (pre-move) |
| Implementation patterns (dual-model, numeric guard, etc.) | v1 §12 |
| 9-step extension playbook | v1 §14 |

This v2 spec adds **only what is section-specific**: component inventory, per-section scope, per-component prompts, column whitelist additions, Appendix A/B rows, and truth queries.

**New concept introduced in v2 only:** `fiscal_period` scope type (for Financial sections 9–11). Specified in Section 10 below when authored.

**Mode:** Phase A only (no live API calls). Every section must be offline-verifiable (fetcher SQL runs cleanly, truth queries documented, build/lint clean). Phase B (live runs, numeric guard against real LLM output) is deferred.

---

## Section 1 — `customer_margin_overview`

**Page:** Customer Margin (`/customer-margin`)
**Scope:** `period` (date-filtered)
**Tool policy:** `aggregate_only`
**Data source:** `pc_customer_margin`
**AI calls:** 7 parallel component analyses + 1 summary = **8 total**

### 1.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 21 | Net Sales | KPI | `pc_customer_margin` | RM N (period total revenue net of credit notes) |
| 22 | COGS | KPI | `pc_customer_margin` | RM N (period total cost of goods sold) |
| 23 | Gross Profit | KPI | `pc_customer_margin` | RM N (Net Sales − COGS) |
| 24 | Margin % | KPI | `pc_customer_margin` | % (Gross Profit ÷ Net Sales × 100) |
| 25 | Active Customers | KPI | `pc_customer_margin` | Count (distinct customers with any activity in period) |
| 26 | Margin Trend | Chart (ComposedChart — bars + line) | `pc_customer_margin` | Monthly Gross Profit + Margin % |
| 27 | Margin Distribution | Chart (Bar) | `pc_customer_margin` | Customer count per fixed margin % bucket |

**Component key registry (to be added to [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts) `SECTION_COMPONENTS`):**

```ts
customer_margin_overview: [
  { key: 'cm_net_sales',            name: 'Net Sales',            type: 'kpi' },
  { key: 'cm_cogs',                 name: 'COGS',                 type: 'kpi' },
  { key: 'cm_gross_profit',         name: 'Gross Profit',         type: 'kpi' },
  { key: 'cm_margin_pct',           name: 'Margin %',             type: 'kpi' },
  { key: 'cm_active_customers',     name: 'Active Customers',     type: 'kpi' },
  { key: 'cm_margin_trend',         name: 'Margin Trend',         type: 'chart' },
  { key: 'cm_margin_distribution',  name: 'Margin Distribution',  type: 'chart' },
],
```

`SECTION_PAGE.customer_margin_overview = 'Customer Margin'`
`SECTION_NAMES.customer_margin_overview = 'Customer Margin Overview'`

### 1.2 Filter Dimensions Available to Prompts

The overview endpoints (`/api/customer-margin/margin/kpi`, `/margin/trend`, `/margin/distribution`) accept the following filter params:

| Param | Source | Notes |
|-------|--------|-------|
| `date_from`, `date_to` | `MarginDashboardFilters.startDate` / `endDate` | Always required — defines the period |
| `customer` | `customers[]` | Multi-select customer codes (array joined comma) |
| `type` | `types[]` | Multi-select customer types |
| `agent` | `agents[]` | Multi-select sales agents |

**Not accepted by overview endpoints:** product group. The `productGroups[]` state exists in [useDashboardFilters.ts:7-14](../../apps/dashboard/src/components/customer-margin/dashboard/useDashboardFilters.ts#L7-L14) but is not wired through to the overview routes.

**Prompt dimension rule:** Component prompts may reference date range, customer type mix, and sales agent distribution as analytical context (the data carries `debtor_type` and `sales_agent` columns and the fetcher may surface them in its pre-computed block). Prompts must **not** reference product-group slicing in this section — the backend cannot filter by it here.

None of the 3 visual components in the overview expose per-component selectors (verified: [KpiCards.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/KpiCards.tsx), [MarginTrendChart.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/MarginTrendChart.tsx), [MarginDistributionChart.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/MarginDistributionChart.tsx) — no local `useState` for view options). Granularity, bucket size, and metric toggles do not exist and must not be referenced in prompts.

### 1.3 Formulas (derived at query time)

All formulas operate on `pc_customer_margin` rows already filtered to the selected period and dimension filters:

| Metric | Formula |
|--------|---------|
| Net Sales | `SUM(iv_revenue + dn_revenue - cn_revenue)` |
| COGS | `SUM(iv_cost + dn_cost - cn_cost)` |
| Gross Profit | `Net Sales − COGS` |
| Margin % | `(Gross Profit ÷ Net Sales) × 100` |
| Active Customers | `COUNT(DISTINCT debtor_code)` where row had non-zero revenue or cost in period |

### 1.4 Component System Prompts

All prompts inherit the v1 global system prompt (§6.1) and the standard user prompt template (§6.7). Component prompts narrate pre-fetched values only — **no tool access**.

Thresholds below are fruit-distribution-contextual and may be tuned after Phase B (live runs). They are informed by: typical distribution-business gross margin bands (10–20%), the page's existing color coding, and v1 Sales Trend prompt patterns.

#### Net Sales (KPI)

```
You are analyzing the "Net Sales" KPI on the Customer Margin overview.

What it measures: Total net sales for the selected period, summed across all
active customers after subtracting credit notes.
Formula: SUM(iv_revenue + dn_revenue − cn_revenue) from pc_customer_margin.

Context:
- This is the same Net Sales figure as the Sales page but scoped to the
  customer-margin view (excludes any customers with zero margin activity).
- Small variance vs the Sales page Net Sales is expected and is NOT an error.

Performance thresholds:
- Month-over-month growth ≥ 5% = Good
- Month-over-month growth 0% to 5% = Neutral
- Month-over-month decline < 0% = Bad
- A drop > 10% in a single period warrants flagging

Evaluate the level and, if trend data is included in the pre-fetched block,
the direction. Comment on whether the current period is tracking above or
below the trailing average.

Provide a concise analysis of this metric.
```

#### COGS (KPI)

```
You are analyzing the "Cost of Goods Sold (COGS)" KPI on the Customer Margin overview.

What it measures: Total landed cost of goods sold for the selected period.
Formula: SUM(iv_cost + dn_cost − cn_cost) from pc_customer_margin.

Context:
- For a fruit distribution business, COGS is expected to be the dominant
  expense line — typically 80–90% of Net Sales.
- COGS rising faster than Net Sales is the leading indicator of margin
  compression (upstream price pressure or sourcing mix shift).

Evaluate:
- COGS-to-Net-Sales ratio for the period
- Whether the ratio is widening vs a prior period (margin compression)
- Whether COGS is moving in the same direction as Net Sales

Do NOT evaluate COGS in isolation — always frame it relative to Net Sales.

Provide a concise analysis of this metric.
```

#### Gross Profit (KPI)

```
You are analyzing the "Gross Profit" KPI on the Customer Margin overview.

What it measures: Net Sales minus COGS for the selected period.
Formula: Net Sales − COGS (both from pc_customer_margin).

Performance thresholds:
- Gross Profit growing ≥ 5% while Net Sales also grows = Good
- Gross Profit flat while Net Sales grows = Neutral (watch for margin erosion)
- Gross Profit declining while Net Sales grows = Bad (cost pressure)
- Gross Profit declining while Net Sales declines = Bad (volume loss)

Evaluate:
- Absolute Gross Profit level
- Direction vs prior period
- Whether Gross Profit is growing faster/slower than Net Sales (the most
  important signal — it reveals whether the business is gaining or losing
  pricing power)

Provide a concise analysis of this metric.
```

#### Margin % (KPI)

```
You are analyzing the "Gross Margin %" KPI on the Customer Margin overview.

What it measures: Gross Profit as a percentage of Net Sales.
Formula: (Gross Profit ÷ Net Sales) × 100.

Performance thresholds (fruit distribution benchmarks):
- Margin % ≥ 15% = Good
- Margin % 10% to 15% = Neutral
- Margin % < 10% = Bad
- A drop ≥ 2 percentage points vs the prior period warrants flagging,
  regardless of absolute level.

Evaluate:
- Current margin level vs the benchmark bands
- Direction vs prior period (even a healthy margin trending down deserves
  attention)
- Whether movement is driven by Net Sales change, COGS change, or both —
  the pre-fetched block will contain both numerators and denominators

Provide a concise analysis of this metric.
```

#### Active Customers (KPI)

```
You are analyzing the "Active Customers" KPI on the Customer Margin overview.

What it measures: Count of distinct customers that had any revenue or cost
activity during the selected period.
Formula: COUNT(DISTINCT debtor_code) from pc_customer_margin where the
customer had non-zero activity in the period.

Context:
- This is a period-scoped count, not a total customer base count.
- Stability is the baseline — steady numbers are healthy for a mature
  distribution business.
- Changes matter more than the absolute number.

Performance thresholds:
- Month-over-month change within ±3% = Normal (noise)
- Drop > 5% = Concerning (possible churn or seasonality)
- Growth > 5% = Positive (new customer acquisition or reactivation)

Evaluate:
- Direction of change
- Whether the change correlates with Net Sales movement (a drop in active
  customers but steady Net Sales = revenue concentrating on fewer accounts)

Provide a concise analysis of this metric.
```

#### Margin Trend (ComposedChart — bars + line)

```
You are analyzing the "Margin Trend" chart on the Customer Margin overview.

What it shows:
- Bars = Gross Profit (RM, left y-axis) per month
- Line = Gross Margin % (right y-axis) per month
- Granularity is fixed to monthly — the chart has no granularity selector.

The chart answers two questions simultaneously:
- Is the business making more or less profit in absolute terms?
- Is it getting more or less efficient at converting sales into profit?

Performance thresholds:
- 3+ consecutive months of Gross Profit growth = Good
- Flat or mixed = Neutral
- 3+ consecutive months of Gross Profit decline = Bad
- Margin % trending down for 2+ consecutive months warrants flagging even
  if Gross Profit is flat

Look for:
- Divergence between the bars and the line (e.g., profit going up while
  margin % stays flat = growth via volume, not pricing)
- Seasonal patterns (festive months typically show different mix)
- Any month where Gross Profit and Margin % move in opposite directions —
  this is always worth calling out

Use the pre-fetched monthly breakdown to cite specific months when making
claims. Do not invent values not present in the data block.

Provide a concise analysis of the margin trend pattern with evidence.
```

#### Margin Distribution (Bar chart)

```
You are analyzing the "Margin Distribution" histogram on the Customer Margin overview.

What it shows: Count of customers falling into each Gross Margin % bucket
for the selected period. Buckets are fixed:
  < 0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+

There is no bucket-size selector — these 7 buckets are hardcoded in the UI.

Performance thresholds:
- Customers in < 0% bucket = selling at a loss (always worth flagging if > 0)
- Majority of customers in 10–20% band = Healthy (matches overall target)
- Heavy concentration (> 40% of customers) in sub-10% bands = Bad (portfolio
  is thin-margin)
- A meaningful tail (> 15%) in the 20%+ bands = Good (premium segment exists)

Evaluate:
- Shape of the distribution (left-skewed, centered, right-skewed, bimodal)
- Proportion of customers below 10% margin
- Presence and size of the loss-making bucket (< 0%)
- Whether the distribution is consistent with the overall Margin % KPI (a
  16% overall margin with most customers sub-10% means a few large accounts
  are carrying the portfolio — concentration risk)

Provide a concise analysis focused on distribution shape and concentration.
```

### 1.5 Data Source — `pc_customer_margin`

Add to v1 §9.2 Tier 1 table list under a new "Customer Margin Domain" heading:

| Table | Allowed Columns |
|-------|----------------|
| `pc_customer_margin` | `month, debtor_code, company_name, debtor_type, sales_agent, is_active, iv_revenue, dn_revenue, cn_revenue, iv_cost, dn_cost, cn_cost, iv_count, cn_count` |

**Population label** (to be emitted by every fetcher in this section):
`"Population: customers with non-zero revenue or cost activity in {period}"`

**Tool policy:** `aggregate_only` — summary analysis may drill down into `pc_customer_margin` itself for root-cause investigation (e.g., "which customer types are compressing margin"), but must not hit RDS tables. Per v1 §12.9.

### 1.6 Fetcher Contracts (per component)

Each fetcher in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts) must return a `FetcherResult` with:
- **`prompt`** — human-readable markdown block with labeled numeric values
- **`allowed`** — whitelist of every numeric value rendered in the prompt (per v1 §12.10)

Values that MUST appear in the `allowed` whitelist for each component:

| Component key | Values to whitelist |
|--------------|---------------------|
| `cm_net_sales` | period Net Sales RM, prior-period Net Sales RM, MoM delta %, MoM delta RM |
| `cm_cogs` | period COGS RM, COGS-to-Net-Sales ratio %, prior-period COGS RM, COGS delta RM |
| `cm_gross_profit` | period Gross Profit RM, prior-period Gross Profit RM, GP delta RM, GP delta % |
| `cm_margin_pct` | period Margin %, prior-period Margin %, Margin % delta (pp), Net Sales RM, COGS RM |
| `cm_active_customers` | period active count, prior-period active count, delta count, delta % |
| `cm_margin_trend` | for each month in range: month label, Gross Profit RM, Margin %; plus period totals |
| `cm_margin_distribution` | count per bucket (7 values), total customer count, % per bucket (7 values) |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in the prompt must be in `allowed`, except dates/years and safe small integers (0, 1, 100).

### 1.7 Truth Queries (per key metric)

These independent SQL queries verify the fetcher's output. Each must match the fetcher value (within RM 1 tolerance) and the dashboard displayed value. Truth queries live in `_bmad-output/planning-artifacts/truth-queries/customer-margin-overview.sql`.

```sql
-- Parameters (bind before running):
-- :date_from — ISO date (e.g. '2025-01-01')
-- :date_to   — ISO date (e.g. '2025-12-31')
-- No customer / type / agent filters applied (match a clean un-filtered run)

-- T1. Net Sales — should match cm_net_sales fetcher + KpiCards "Net Sales" card
SELECT COALESCE(SUM(iv_revenue + dn_revenue - cn_revenue), 0)::numeric(18,2) AS net_sales
FROM pc_customer_margin
WHERE month >= to_char(:date_from::date, 'YYYY-MM')
  AND month <= to_char(:date_to::date, 'YYYY-MM');

-- T2. COGS — should match cm_cogs fetcher + KpiCards "Cost of Sales" card
SELECT COALESCE(SUM(iv_cost + dn_cost - cn_cost), 0)::numeric(18,2) AS cogs
FROM pc_customer_margin
WHERE month >= to_char(:date_from::date, 'YYYY-MM')
  AND month <= to_char(:date_to::date, 'YYYY-MM');

-- T3. Gross Profit — should match cm_gross_profit fetcher + KpiCards "Gross Profit" card
SELECT COALESCE(
  SUM(iv_revenue + dn_revenue - cn_revenue)
  - SUM(iv_cost + dn_cost - cn_cost), 0
)::numeric(18,2) AS gross_profit
FROM pc_customer_margin
WHERE month >= to_char(:date_from::date, 'YYYY-MM')
  AND month <= to_char(:date_to::date, 'YYYY-MM');

-- T4. Margin % — should match cm_margin_pct fetcher + KpiCards "Gross Margin %" card
WITH totals AS (
  SELECT
    SUM(iv_revenue + dn_revenue - cn_revenue) AS net_sales,
    SUM(iv_cost + dn_cost - cn_cost) AS cogs
  FROM pc_customer_margin
  WHERE month >= to_char(:date_from::date, 'YYYY-MM')
    AND month <= to_char(:date_to::date, 'YYYY-MM')
)
SELECT
  CASE WHEN net_sales > 0
    THEN ROUND(((net_sales - cogs) / net_sales * 100)::numeric, 2)
    ELSE 0
  END AS margin_pct
FROM totals;

-- T5. Active Customers — should match cm_active_customers fetcher + KpiCards "Active Customers" card
SELECT COUNT(DISTINCT debtor_code) AS active_customers
FROM pc_customer_margin
WHERE month >= to_char(:date_from::date, 'YYYY-MM')
  AND month <= to_char(:date_to::date, 'YYYY-MM')
  AND (
    (iv_revenue + dn_revenue + cn_revenue) <> 0
    OR (iv_cost + dn_cost + cn_cost) <> 0
  );

-- T6. Margin Trend — monthly breakdown for cm_margin_trend fetcher + MarginTrendChart
SELECT
  month,
  SUM(iv_revenue + dn_revenue - cn_revenue)::numeric(18,2) AS net_sales,
  SUM(iv_cost + dn_cost - cn_cost)::numeric(18,2) AS cogs,
  (SUM(iv_revenue + dn_revenue - cn_revenue)
    - SUM(iv_cost + dn_cost - cn_cost))::numeric(18,2) AS gross_profit,
  CASE WHEN SUM(iv_revenue + dn_revenue - cn_revenue) > 0
    THEN ROUND(
      ((SUM(iv_revenue + dn_revenue - cn_revenue)
        - SUM(iv_cost + dn_cost - cn_cost))
       / SUM(iv_revenue + dn_revenue - cn_revenue) * 100)::numeric, 2)
    ELSE 0
  END AS margin_pct
FROM pc_customer_margin
WHERE month >= to_char(:date_from::date, 'YYYY-MM')
  AND month <= to_char(:date_to::date, 'YYYY-MM')
GROUP BY month
ORDER BY month;

-- T7. Margin Distribution — should match cm_margin_distribution fetcher + MarginDistributionChart
-- Uses the same 7 fixed buckets as MarginDistributionChart.tsx
WITH per_customer AS (
  SELECT
    debtor_code,
    SUM(iv_revenue + dn_revenue - cn_revenue) AS revenue,
    SUM(iv_cost + dn_cost - cn_cost) AS cogs
  FROM pc_customer_margin
  WHERE month >= to_char(:date_from::date, 'YYYY-MM')
    AND month <= to_char(:date_to::date, 'YYYY-MM')
  GROUP BY debtor_code
  HAVING SUM(iv_revenue + dn_revenue - cn_revenue) > 0
),
bucketed AS (
  SELECT
    CASE
      WHEN (revenue - cogs) / revenue * 100 < 0    THEN '< 0%'
      WHEN (revenue - cogs) / revenue * 100 < 5    THEN '0-5%'
      WHEN (revenue - cogs) / revenue * 100 < 10   THEN '5-10%'
      WHEN (revenue - cogs) / revenue * 100 < 15   THEN '10-15%'
      WHEN (revenue - cogs) / revenue * 100 < 20   THEN '15-20%'
      WHEN (revenue - cogs) / revenue * 100 < 30   THEN '20-30%'
      ELSE '30%+'
    END AS bucket
  FROM per_customer
)
SELECT bucket, COUNT(*) AS customer_count
FROM bucketed
GROUP BY bucket
ORDER BY CASE bucket
  WHEN '< 0%'   THEN 1
  WHEN '0-5%'   THEN 2
  WHEN '5-10%'  THEN 3
  WHEN '10-15%' THEN 4
  WHEN '15-20%' THEN 5
  WHEN '20-30%' THEN 6
  WHEN '30%+'   THEN 7
END;
```

**Three-way match required** (per v1 §9.5): fetcher output, truth query output, and dashboard displayed value must all agree.

### 1.8 Implementation Checklist (v1 §14 playbook, instantiated)

- [x] **Step 1** — Add `'customer_margin_overview'` to `SectionKey` union in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [x] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [x] **Step 3** — Add 7 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [x] **Step 4** — Add 7 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §1.6
- [x] **Step 5** — Add `customer_margin_overview: 'period'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts)
- [x] **Step 6** — Add `customer_margin_overview: 'aggregate_only'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts); add `pc_customer_margin` to `AGGREGATE_LOCAL_TABLES` AND to `LOCAL_WHITELIST` in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts); add the table + column list to the summary prompt's `LOCAL` reference in `prompts.ts`
- [x] **Step 7** — Mount `<InsightSectionHeader sectionKey="customer_margin_overview" />` in [MarginDashboardShell.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/MarginDashboardShell.tsx) above the KpiCards + charts cluster
- [x] **Step 7b** — Per §1.9, wire per-component `AnalyzeIcon` + add `COMPONENT_INFO` entries. See §1.9 for the checklist.
- [x] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/customer-margin-overview.sql`
- [x] **Step 9** — `npm run build` and `tsc --noEmit` clean; commit with message `feat: add AI insight for customer margin overview (customer_margin_overview)`
- [x] **Step 10 (deferred to Phase B)** — Run Appendix C verification with live LLM — **blocked 2026-04-14 on Anthropic "credit balance too low" error.** UI path verified end-to-end via Playwright (7 icons render, dialog opens, About section populated, Analyze click reaches Anthropic through full orchestration). LLM output verification pending user top-up.

### 1.9 Per-Component Analyze Icons (MANDATORY — inherit from v1 §4.3)

> **Warning — discovered 2026-04-14 in section 1 implementation.** The original §1.8 checklist did not call out the per-component analyze icon wiring and I shipped section 1 without it on the first pass. This §1.9 exists so sections 2–11 do not repeat that miss. v1 §4.3 requires **every** KPI card, chart, and table to render its own 🔍 icon in the header.

**Pattern (verified in [KpiCardsV2.tsx:23-30](../../apps/dashboard/src/components/sales/dashboard-v2/KpiCardsV2.tsx#L23-L30) and [NetSalesTrend.tsx:92-96](../../apps/dashboard/src/components/sales/dashboard-v2/NetSalesTrend.tsx#L92-L96)):**

```tsx
// In the CardHeader, wrap CardTitle in a flex container and drop the icon inline
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';

<CardHeader>
  <div className="flex items-center gap-1">  {/* gap-2 for charts/tables */}
    <CardTitle>{title}</CardTitle>
    <AnalyzeIcon sectionKey="<section_key>" componentKey="<component_key>" />
  </div>
</CardHeader>
```

`AnalyzeIcon` is defined in [AnalyzeIcon.tsx](../../apps/dashboard/src/components/ai-insight/AnalyzeIcon.tsx) and is self-contained — it manages its own open state and renders `<ComponentInsightDialog>`. No provider, no context, no parent state needed.

**Per-component `COMPONENT_INFO` registry ([component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts)):** every `componentKey` added in §1.2 (or the equivalent registry for sections 2–11) must also have a matching entry in `COMPONENT_INFO` with these fields:

| Field | Purpose |
|-------|---------|
| `name` | Display name shown in dialog header (usually matches the `SECTION_COMPONENTS` entry's `name`) |
| `whatItMeasures` | One-sentence description of what the metric represents |
| `formula` *(optional but recommended for KPIs)* | Plain-English formula |
| `indicator` *(optional)* | Color-coded threshold line (e.g. "≥15% = Good · 10–15% = Neutral · <10% = Bad") |
| `about` | Human-friendly explanation rendered in the dialog's About card — this is what end users (senior directors) actually read |

**Checklist for Section 1 (customer_margin_overview) — completed 2026-04-14:**

- [x] **§1.9.1** — Add 7 entries to `COMPONENT_INFO`: `cm_net_sales`, `cm_cogs`, `cm_gross_profit`, `cm_margin_pct`, `cm_active_customers`, `cm_margin_trend`, `cm_margin_distribution`
- [x] **§1.9.2** — [KpiCards.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/KpiCards.tsx): add `componentKey` field to each entry in the `cards` array; render `<AnalyzeIcon sectionKey="customer_margin_overview" componentKey={card.componentKey} />` inline with `<CardTitle>` via `flex items-center gap-1`
- [x] **§1.9.3** — [MarginTrendChart.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/MarginTrendChart.tsx): wrap `<CardTitle>` in `flex items-center gap-2`; add icon with `componentKey="cm_margin_trend"`
- [x] **§1.9.4** — [MarginDistributionChart.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/MarginDistributionChart.tsx): same as §1.9.3; `componentKey="cm_margin_distribution"`
- [x] **§1.9.5** — Playwright spot-check: icons render at expected coordinates, dialog opens with About section populated, AI Analysis section shows "No analysis..." placeholder pre-run

**Boilerplate instructions for any future section (sections 2–11):**

1. For every `componentKey` in the section's `SECTION_COMPONENTS` array, add a `COMPONENT_INFO` entry.
2. For every dashboard component file (KPI card, chart, table) that renders a component from the section, import `AnalyzeIcon` and wire it into the `CardHeader` using the pattern above.
3. Add a **§X.9 Per-Component Analyze Icons** subsection to that section's spec with a file-by-file checklist mirroring §1.9.1–§1.9.5.
4. Verify via Playwright: count the icons, click one, confirm the About section is populated.

Skipping §X.9 = the section ships without per-component drill-in, which breaks the v1 UX contract.

---

## Appendix A addendum (section key reference)

Add to v1 Appendix A table:

| Section Key | Page | Section Name | Date Filtered |
|-------------|------|-------------|---------------|
| `customer_margin_overview` | Customer Margin | Customer Margin Overview | Yes (period) |

---

## Appendix B addendum (estimated cost model)

Add to v1 Appendix B table:

| Section | Components | Est. Tokens | Est. Cost (Haiku+Sonnet) | Observed |
|---------|-----------|-------------|--------------------------|----------|
| Customer Margin Overview | 7 + summary | ~22,000 | ~$0.10 | Deferred to Phase B |

**Estimation basis:** 7 component calls at ~2,000 tokens each (Haiku) + 1 summary call at ~8,000 tokens (Sonnet, with up to 2 tool calls). Pattern matches v1 Sales Trend (5 components, ~$0.08 estimated) scaled for 2 additional KPIs.

---

## Section 2 — `customer_margin_breakdown`

**Page:** Customer Margin (`/customer-margin`)
**Scope:** `period` (date-filtered)
**Tool policy:** `full` (matches v1 `sales_breakdown` — breakdown sections need RDS drill-down for root-cause investigation)
**Data source:** `pc_customer_margin` (local) + optional drill-down to `dbo.IV`, `dbo.CN` (RDS)
**AI calls:** 3 parallel component analyses + 1 summary = **4 total**

### 2.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 28 | Top Customers | Chart (horizontal bar) | `pc_customer_margin` | Top 10 by Gross Profit + Top 10 by Margin % (two views) |
| 29 | Customer Margin Table | Table (paginated) | `pc_customer_margin` | Per-customer revenue, COGS, GP, Margin %, return rate |
| 30 | Credit Note Impact Table | Table (top 100) | `pc_customer_margin` | Customers ranked by `margin_lost` to credit notes |

**Component key registry (to be added to [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts) `SECTION_COMPONENTS`):**

```ts
customer_margin_breakdown: [
  { key: 'cm_top_customers',       name: 'Top Customers',             type: 'chart' },
  { key: 'cm_customer_table',      name: 'Customer Margin Table',     type: 'table' },
  { key: 'cm_credit_note_impact',  name: 'Credit Note Impact',        type: 'table' },
],
```

`SECTION_PAGE.customer_margin_breakdown = 'Customer Margin'`
`SECTION_NAMES.customer_margin_breakdown = 'Customer Margin Breakdown'`

### 2.2 Filter Dimensions Available to Prompts

All 3 breakdown endpoints (`/api/customer-margin/margin/customers`, `/margin/credit-note-impact`) accept the same filter params as the overview:

| Param | Notes |
|-------|-------|
| `date_from`, `date_to` | Always required — defines the period |
| `customer` | Multi-select customer codes |
| `type` | Multi-select customer types |
| `agent` | Multi-select sales agents |

**Not accepted:** product group. The AI must not reference product-group slicing in this section.

**Per-component selectors** (local component state, NOT filter bar):
- **TopCustomersChart:** `metric` toggle (`'profit'` ↔ `'margin'`), `direction` toggle (`'highest'` ↔ `'lowest'`). Fetcher feeds both "highest" views (profit + margin) per β decision — AI gets to reason across both. See [TopCustomersChart.tsx:26-27](../../apps/dashboard/src/components/customer-margin/dashboard/TopCustomersChart.tsx#L26-L27).
- **CustomerMarginTable:** sort column (8 options), sort direction, page, pageSize (default 25), customer combobox (multi-select). Fetcher feeds top 10 by GP + bottom 10 by GP + aggregates. See [CustomerMarginTable.tsx:146-153](../../apps/dashboard/src/components/customer-margin/dashboard/CustomerMarginTable.tsx#L146-L153).
- **CreditNoteImpactTable:** sort column (7 options), sort direction, page, pageSize, search box. Fetcher feeds top 25 by `margin_lost` + aggregates. See [CreditNoteImpactTable.tsx:21-28](../../apps/dashboard/src/components/customer-margin/dashboard/CreditNoteImpactTable.tsx#L21-L28).

### 2.3 Formulas (derived at query time)

| Metric | Formula | Source |
|--------|---------|--------|
| Per-customer Gross Profit | `SUM(iv_revenue + dn_revenue - cn_revenue) - SUM(iv_cost + dn_cost - cn_cost)` grouped by `debtor_code` | `pc_customer_margin` |
| Per-customer Margin % | `(Gross Profit ÷ Revenue) × 100`, `0` if revenue ≤ 0 | `pc_customer_margin` |
| Return Rate % | `(cn_revenue ÷ iv_revenue) × 100`, `0` if iv_revenue ≤ 0 | `pc_customer_margin` |
| `margin_before` (CN impact) | `(iv_revenue - iv_cost) ÷ iv_revenue × 100` — the margin if no credit notes had been issued | [queries.ts:555-557](../../apps/dashboard/src/lib/customer-margin/queries.ts#L555-L557) |
| `margin_after` (CN impact) | `(revenue_net_cn - cogs_net_cn) ÷ revenue_net_cn × 100` — the actual margin after credit notes | [queries.ts:559-561](../../apps/dashboard/src/lib/customer-margin/queries.ts#L559-L561) |
| `margin_lost` (CN impact) | `margin_before - margin_after` — percentage points of margin eroded by credit notes | [queries.ts:563-564](../../apps/dashboard/src/lib/customer-margin/queries.ts#L563-L564) |

### 2.4 Component System Prompts

All prompts inherit the v1 global system prompt (§6.1) and the standard user prompt template (§6.7). Component prompts narrate pre-fetched values only — **no tool access at the component layer**. Tool access is available to the summary only.

#### Top Customers (Chart — horizontal bar)

```
You are analyzing the "Top Customers" chart on the Customer Margin breakdown.

What it shows:
- The pre-fetched data contains TWO ranked lists of the period's top 10 customers:
  (A) Top 10 by Gross Profit (absolute RM contribution)
  (B) Top 10 by Gross Margin % (efficiency, filtered to customers with at least RM 10,000 revenue)
- The UI lets users toggle between these two lenses + a "highest/lowest" direction.
  Your analysis should cover both lenses.

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

#### Customer Margin Table (Paginated Table)

```
You are analyzing the "Customer Margin Table" on the Customer Margin breakdown.

What it shows:
- A sortable, paginated table of all active customers with columns for Code, Name, Type, Net Sales, COGS, Gross Profit, Margin %, Return Rate %.
- The pre-fetched data gives you:
  (A) Top 10 customers by Gross Profit (the best performers)
  (B) Bottom 10 customers by Gross Profit (the worst performers, including loss-makers)
  (C) Aggregate roll-ups: total customers, loss-making customer count, average margin %, top-10 share of total GP.

Performance thresholds:
- Top 10 share of GP > 60% = Bad (over-concentrated)
- Top 10 share of GP 40-60% = Neutral (typical for distribution)
- Top 10 share of GP < 40% = Good (well spread)
- Loss-making customers > 10% of active count = Bad (unhealthy tail)
- Margin spread (best minus worst) > 50 percentage points = Polarized portfolio
- Any bottom-10 customer with meaningful revenue (> RM 100,000) AND negative margin = Critical flag — they are actively destroying margin.

Evaluate:
- Concentration: how much of the profit is in the top few names?
- The bottom tail: who is losing money, and is the problem big (high-revenue loss-makers) or small (many tiny negative-margin accounts)?
- Customer type / sales agent clustering in the bottom 10
- Whether the bottom 10 have unusually high return rates (signal of quality or service problem)

Cite named customers from the pre-fetched top/bottom blocks. Do not invent names.

Provide a concise analysis focused on concentration risk and the at-risk tail.
```

#### Credit Note Impact (Table — top 100 sorted)

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

### 2.5 Data Source + Tool Access

**Primary (already whitelisted in §1):** `pc_customer_margin` — full column list already added to `LOCAL_WHITELIST` in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts) and to `AGGREGATE_LOCAL_TABLES` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts).

**RDS drill-down (already whitelisted for other sections — no new entries needed):**
- `dbo.IV` — invoice-level drill-down for "which invoices drove this customer's margin"
- `dbo.CN` — credit-note drill-down for "why does customer X have margin_lost of 8 points" (what CN types, what amounts, what dates)

The summary for `customer_margin_breakdown` is allowed to issue **up to 2 tool calls** (v1 §12.6) for root-cause investigation — e.g. "investigate the top 3 customers in credit_note_impact by querying dbo.CN for their specific CN records."

**Population label** (emitted by every breakdown fetcher):
`"Population: active customers (is_active = 'T') with at least one row in pc_customer_margin during {period}"`

### 2.6 Fetcher Contracts (per component)

Each fetcher reuses [queries.ts](../../apps/dashboard/src/lib/customer-margin/queries.ts) functions where possible for three-way match with the dashboard.

| Component key | Query functions used | Values whitelisted in `allowed` |
|---|---|---|
| `cm_top_customers` | `getCustomerMargins(filters, 'gross_profit', 'desc', 1, 10)` + `getCustomerMargins(filters, 'margin_pct', 'desc', 1, 50)` (slice top 10 with revenue ≥ RM 10K) + `getMarginKpi(filters)` for totals | RM for every customer's revenue/cogs/GP, % for every margin_pct, RM for period total GP, % for top-1 / top-3 / top-10 share of GP |
| `cm_customer_table` | `getCustomerMargins(filters, 'gross_profit', 'desc', 1, 10)` (top 10) + `getCustomerMargins(filters, 'gross_profit', 'asc', 1, 10)` (bottom 10) + aggregate query on `pc_customer_margin` for loss-maker count and top-10 share | RM/GP/% for each of the 20 customers shown, total active count, loss-maker count, median margin %, top-10 share % |
| `cm_credit_note_impact` | `getCreditNoteImpact(filters)` (returns ≤100 rows) — take top 25 + compute full-list total margin_lost + top-5 share | RM for iv_revenue/cn_revenue per customer, % for return_rate / margin_before / margin_after / margin_lost, RM for total CN applied, count of high-return customers |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in the prompt must be in `allowed`, except dates/years and safe small integers (0, 1, 100).

**Pre-computed roll-up block (required):** per v1 §12.8 `Pre-calculated totals (use these values directly — do not recompute)`. Each fetcher must emit aggregate lines the AI can cite verbatim (top-10 share, loss-maker count, etc.) so the summary doesn't back-solve.

### 2.7 Truth Queries

Live in `_bmad-output/planning-artifacts/truth-queries/customer-margin-breakdown.sql`. Each query must match the fetcher value, the `queries.ts` function output, and the dashboard displayed value (±RM 1 tolerance). See the authored file for full SQL.

**Metrics verified:**

| Truth query | Matches | Component |
|---|---|---|
| T1. Top 10 customers by Gross Profit (full row) | TopCustomersChart "Gross Profit" mode + CustomerMarginTable default sort | `cm_top_customers`, `cm_customer_table` |
| T2. Top 10 customers by Margin % (with revenue ≥ RM 10K filter) | TopCustomersChart "Margin %" mode | `cm_top_customers` |
| T3. Bottom 10 customers by Gross Profit | CustomerMarginTable default sort, last page (approximately) | `cm_customer_table` |
| T4. Loss-maker count (active customers with Gross Profit < 0) | Aggregate used in `cm_customer_table` | `cm_customer_table` |
| T5. Top 10 share of total period Gross Profit | Aggregate used in both `cm_top_customers` and `cm_customer_table` | Both |
| T6. Top 25 customers by margin_lost | CreditNoteImpactTable default sort, page 1 | `cm_credit_note_impact` |
| T7. Total margin_lost across the 100-row impact universe | Aggregate used in `cm_credit_note_impact` | `cm_credit_note_impact` |

### 2.8 Implementation Checklist (v1 §14 playbook, instantiated)

- [x] **Step 1** — Add `'customer_margin_breakdown'` to `SectionKey` union in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [x] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [x] **Step 3** — Add 3 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [x] **Step 4** — Add 3 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §2.6
- [x] **Step 5** — Add `customer_margin_breakdown: 'period'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts)
- [x] **Step 6** — Add `customer_margin_breakdown: 'full'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts). No whitelist changes needed — `pc_customer_margin`, `dbo.IV`, `dbo.CN` are all already wired from section 1 / v1.
- [x] **Step 7** — Mount `<InsightSectionHeader sectionKey="customer_margin_breakdown" />` in [MarginDashboardShell.tsx](../../apps/dashboard/src/components/customer-margin/dashboard/MarginDashboardShell.tsx) above the TopCustomers + Tabs cluster (between the charts grid and the Top 10 Customers full-width chart, around line 41)
- [x] **Step 7b** — Per §2.9, wire per-component `AnalyzeIcon` + add `COMPONENT_INFO` entries
- [x] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/customer-margin-breakdown.sql`
- [x] **Step 9** — `tsc --noEmit` and build clean; Playwright spot-check; commit with message `feat: AI insight v2 — customer margin breakdown section`
- [x] **Step 10 (deferred)** — Live LLM verification pending Anthropic credits

### 2.9 Per-Component Analyze Icons (MANDATORY — per §1.9)

Follow the same pattern documented in §1.9. Three icons to add:

- [x] **§2.9.1** — Add 3 entries to `COMPONENT_INFO` in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts): `cm_top_customers`, `cm_customer_table`, `cm_credit_note_impact` — each with `name`, `whatItMeasures`, optional `indicator`, `about`
- [x] **§2.9.2** — [TopCustomersChart.tsx:58](../../apps/dashboard/src/components/customer-margin/dashboard/TopCustomersChart.tsx#L58): wrap `<CardTitle>` in `flex items-center gap-2`; add `<AnalyzeIcon sectionKey="customer_margin_breakdown" componentKey="cm_top_customers" />`
- [x] **§2.9.3** — [CustomerMarginTable.tsx:215](../../apps/dashboard/src/components/customer-margin/dashboard/CustomerMarginTable.tsx#L215): same pattern; `componentKey="cm_customer_table"`
- [x] **§2.9.4** — [CreditNoteImpactTable.tsx:112](../../apps/dashboard/src/components/customer-margin/dashboard/CreditNoteImpactTable.tsx#L112): same pattern; `componentKey="cm_credit_note_impact"`
- [x] **§2.9.5** — Playwright spot-check: 3 additional icons appear (bringing the page total to 10 = 7 overview + 3 breakdown), dialog opens on click, About section populated

---

## Section 3 — `supplier_margin_overview`

**Page:** Supplier Performance (`/supplier-performance`)
**Scope:** `period` (date-filtered)
**Tool policy:** `aggregate_only`
**Data source:** `pc_supplier_margin`
**AI calls:** 7 parallel component analyses + 1 summary = **8 total**

> **Naming split — important for sections 3 and 4.** The supplier domain uses **two different names** in the codebase:
> - **App routes** live under `/supplier-performance` — the page file is [apps/dashboard/src/app/supplier-performance/page.tsx](../../apps/dashboard/src/app/supplier-performance/page.tsx), API routes are under `/api/supplier-performance/...`, and the `PageKey` for this section is `'supplier-performance'`.
> - **Components and library code** live under `supplier-margin` — [apps/dashboard/src/components/supplier-margin/](../../apps/dashboard/src/components/supplier-margin/), [apps/dashboard/src/lib/supplier-margin/queries.ts](../../apps/dashboard/src/lib/supplier-margin/queries.ts), and the local table is `pc_supplier_margin`.
>
> Both names are load-bearing — do not try to unify them. Section keys use `supplier_margin_*` (matching the component path, not the URL).
>
> **Import name collisions when importing supplier-margin/queries.ts:** `customer-margin/queries.ts` and `supplier-margin/queries.ts` both export `getMarginTrend`, and their `getMarginKpi` / `getMarginSummary` play similar roles. Always alias on import, e.g.:
> ```ts
> import {
>   getMarginSummary as getSupplierMarginSummary,
>   getMarginTrend as getSupplierMarginTrend,
>   getSupplierMarginDistributionV2,
>   getItemMarginDistributionV2,
> } from '../supplier-margin/queries';
> ```
> This is how [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts) handles it today. Section 4 should follow the same pattern.
>
> **`getMarginSummary` prior-period gaps:** the `previous` object from `getMarginSummary(start, end)` only carries `revenue`, `cogs`, `profit`, `margin_pct`. It does NOT carry `active_suppliers` or `items_count`. Fetchers relying on prior-period counts must either emit "prior not available" in the prompt (as `sp_active_suppliers` does) or run a separate query.

### 3.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 31 | Est. Net Sales | KPI | `pc_supplier_margin` | RM N (period total `sales_revenue` on active rows) |
| 32 | Est. Cost of Sales | KPI | `pc_supplier_margin` | RM N (period total `attributed_cogs` on active rows) |
| 33 | Est. Gross Profit | KPI | `pc_supplier_margin` | RM N (Est. Net Sales − Est. Cost of Sales) |
| 34 | Gross Margin % | KPI | `pc_supplier_margin` | % (Est. Gross Profit ÷ Est. Net Sales × 100) |
| 35 | Active Suppliers | KPI | `pc_supplier_margin` | Count (distinct suppliers with `purchase_qty > 0` in period) |
| 36 | Profitability Trend | Chart (ComposedChart — bars + line) | `pc_supplier_margin` | Monthly Est. Gross Profit + Margin % |
| 37 | Margin Distribution | Chart (Bar) | `pc_supplier_margin` | Supplier count OR item count per fixed margin % bucket |

**Component key registry (to be added to [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts) `SECTION_COMPONENTS`):**

```ts
supplier_margin_overview: [
  { key: 'sp_net_sales',           name: 'Est. Net Sales',       type: 'kpi' },
  { key: 'sp_cogs',                name: 'Est. Cost of Sales',   type: 'kpi' },
  { key: 'sp_gross_profit',        name: 'Est. Gross Profit',    type: 'kpi' },
  { key: 'sp_margin_pct',          name: 'Gross Margin %',       type: 'kpi' },
  { key: 'sp_active_suppliers',    name: 'Active Suppliers',     type: 'kpi' },
  { key: 'sp_margin_trend',        name: 'Profitability Trend',  type: 'chart' },
  { key: 'sp_margin_distribution', name: 'Margin Distribution',  type: 'chart' },
],
```

`SECTION_PAGE.supplier_margin_overview = 'Supplier Performance'`
`SECTION_NAMES.supplier_margin_overview = 'Supplier Margin Overview'`

**Two KPIs intentionally dropped as invisible-on-page:**
- Top / Lowest Supplier cards — computed by [queries.ts `fetchTopLowestSupplier`](../../apps/dashboard/src/lib/supplier-margin/queries.ts) and returned as `top_supplier`/`lowest_supplier` in the summary payload, but [KpiCards.tsx](../../apps/dashboard/src/components/supplier-margin/dashboard/KpiCards.tsx) does not render them. v1 contract: narrate only visible state.
- Items Count — also returned in the summary payload as `current.items_count` but not displayed. Same treatment.

### 3.2 Filter Dimensions Available to Prompts

The overview endpoints accept the following filter params (from [useDashboardFilters.ts:9-15](../../apps/dashboard/src/hooks/supplier-margin/useDashboardFilters.ts#L9-L15)):

| Param | Source | Notes |
|-------|--------|-------|
| `date_from`, `date_to` | `DashboardFilters.startDate` / `endDate` | Always required — defines the period |
| `supplier` | `suppliers[]` | Multi-select creditor codes |
| `itemGroup` | `itemGroups[]` | Multi-select product groups |

**Not accepted by overview endpoints:** supplier type. (`supplierTypes` is supported by the V2 breakdown queries but no V2 supplier-type selector exists in the overview filter bar.)

**Prompt dimension rule:** Component prompts may reference date range, supplier concentration, and item group mix as analytical context (the data carries `creditor_code`/`creditor_name` and `item_code`/`item_group` columns surfaced by the fetcher). Prompts must **not** reference supplier-type slicing in this section — the overview filter bar cannot drive it.

**Local component state exposed to the user:** [SupplierMarginDistributionChart.tsx:11-62](../../apps/dashboard/src/components/supplier-margin/dashboard/SupplierMarginDistributionChart.tsx#L11-L62) has an `entity` toggle (Suppliers ↔ Items). The trend chart has **no** granularity selector (fixed monthly). Prompts must not reference granularity toggles; the distribution prompt must analyze **both** supplier and item distributions from the fetched block and contrast them rather than guess which view the user has active. See §3.4 Margin Distribution prompt.

None of the KPI cards expose per-component selectors (verified: [KpiCards.tsx:58-87](../../apps/dashboard/src/components/supplier-margin/dashboard/KpiCards.tsx#L58-L87)). No thresholds, bucket sizing, or metric toggles exist on the overview cluster outside the distribution entity switch.

### 3.3 Formulas (derived at query time)

All formulas operate on `pc_supplier_margin` rows filtered by `month BETWEEN startMonth AND endMonth AND is_active = 'T'`:

| Metric | Formula |
|--------|---------|
| Est. Net Sales | `SUM(sales_revenue)` |
| Est. Cost of Sales | `SUM(attributed_cogs)` |
| Est. Gross Profit | `Est. Net Sales − Est. Cost of Sales` |
| Gross Margin % | `(Est. Gross Profit ÷ Est. Net Sales) × 100` |
| Active Suppliers | `COUNT(DISTINCT creditor_code)` where `purchase_qty > 0` in the period |

**Active Suppliers nuance:** uses `purchase_qty > 0` (not "revenue OR cost nonzero" as §1 does). This is faithful to the on-page [KpiCards.tsx:84](../../apps/dashboard/src/components/supplier-margin/dashboard/KpiCards.tsx#L84) / [queries.ts:216-224](../../apps/dashboard/src/lib/supplier-margin/queries.ts#L216-L224) definition — the "active" test for suppliers is "we purchased from them," not "they produced margin rows."

### 3.4 Component System Prompts

All prompts inherit the v1 global system prompt (§6.1) and the standard user prompt template (§6.7). Component prompts narrate pre-fetched values only — **no tool access**.

Thresholds below share the §1 bands where applicable, but the supplier framing flips two narratives: **rising COGS is not automatically bad** (could be shifting toward a preferred supplier) and **shrinking supplier count is not automatically bad** (consolidation = negotiating leverage). These tunings may be revisited after Phase B.

#### Est. Net Sales (KPI)

```
You are analyzing the "Est. Net Sales" KPI on the Supplier Performance overview.

What it measures: Total sales revenue attributed to items sourced from active
suppliers during the selected period.
Formula: SUM(sales_revenue) from pc_supplier_margin where is_active = 'T'.

Context:
- This is the Supplier Performance view of revenue — it mirrors the Customer
  Margin Net Sales figure when no filters are applied, but may diverge when
  supplier/item-group filters are in play.
- The "Est." prefix is intentional: the number is constructed from the
  supplier-margin pre-compute pipeline and is not the raw invoice figure.

Performance thresholds:
- Month-over-month growth ≥ 5% = Good
- Month-over-month growth 0% to 5% = Neutral
- Month-over-month decline < 0% = Bad
- A drop > 10% in a single period warrants flagging

Evaluate the level and, if prior-period data is included in the pre-fetched
block, the direction. Comment on whether the period is tracking above or
below the trailing baseline.

Provide a concise analysis of this metric.
```

#### Est. Cost of Sales (KPI)

```
You are analyzing the "Est. Cost of Sales" KPI on the Supplier Performance overview.

What it measures: Attributed cost of goods sold, summed across items from
active suppliers for the period.
Formula: SUM(attributed_cogs) from pc_supplier_margin where is_active = 'T'.

Context — supplier page framing:
- On a supplier page, rising COGS is NOT automatically bad. It can mean the
  business is shifting volume toward a preferred supplier whose goods cost
  more but carry better margin, reliability, or commercial terms.
- Always frame COGS against Est. Net Sales and against supplier concentration
  signals in the pre-fetched block, never in isolation.
- Bad signals: COGS rising faster than Est. Net Sales AND margin % falling
  (true cost pressure). Flat revenue + rising COGS = real margin erosion.
- Neutral/Good signal: COGS rising with Est. Net Sales keeping pace, margin %
  stable or up = healthy growth, potentially a beneficial sourcing shift.

Evaluate:
- Period COGS level
- COGS-to-Net-Sales ratio
- Whether the ratio is widening or holding

Do NOT call rising COGS "bad" without checking the Net Sales direction and
the margin % direction in the same pre-fetched block.

Provide a concise analysis of this metric.
```

#### Est. Gross Profit (KPI)

```
You are analyzing the "Est. Gross Profit" KPI on the Supplier Performance overview.

What it measures: Est. Net Sales minus Est. Cost of Sales for the period,
derived from the supplier-margin pre-compute.
Formula: Est. Net Sales − Est. Cost of Sales.

Performance thresholds:
- Gross Profit growing ≥ 5% while Est. Net Sales also grows = Good
- Gross Profit flat while Est. Net Sales grows = Neutral (watch for erosion)
- Gross Profit declining while Est. Net Sales grows = Bad (cost pressure or
  sourcing mix shifting to lower-margin suppliers)
- Gross Profit declining while Est. Net Sales declines = Bad (volume loss)

Evaluate:
- Absolute Gross Profit level
- Direction vs prior period
- Whether Gross Profit is growing faster/slower than Est. Net Sales — the
  most important signal on the supplier page, because it reveals whether
  the current supplier mix is actually delivering margin or just volume

Provide a concise analysis of this metric.
```

#### Gross Margin % (KPI)

```
You are analyzing the "Gross Margin %" KPI on the Supplier Performance overview.

What it measures: Est. Gross Profit as a percentage of Est. Net Sales.
Formula: (Est. Gross Profit ÷ Est. Net Sales) × 100.

Performance thresholds (fruit distribution, supplier-side):
- Margin % ≥ 15% = Good
- Margin % 10% to 15% = Neutral
- Margin % < 10% = Bad
- A drop ≥ 2 percentage points vs the prior period warrants flagging,
  regardless of absolute level

Evaluate:
- Current margin level vs the benchmark bands
- Direction vs prior period (a healthy margin trending down is still worth
  flagging — on a supplier page this usually means upstream price pressure)
- Whether movement is driven by Net Sales change, COGS change, or a
  sourcing mix shift (the pre-fetched block will contain both numerators
  and denominators)

Provide a concise analysis of this metric.
```

#### Active Suppliers (KPI)

```
You are analyzing the "Active Suppliers" KPI on the Supplier Performance overview.

What it measures: Count of distinct suppliers with any purchase quantity
during the selected period (is_active = 'T' AND purchase_qty > 0).
Formula: COUNT(DISTINCT creditor_code) where the supplier had a non-zero
purchase_qty in the period.

Context — supplier page framing:
- Unlike Customer Active count, a shrinking supplier count is NOT
  automatically bad. Consolidation often means the business is concentrating
  volume with better-performing suppliers to gain negotiating leverage or
  simplify logistics.
- Growing supplier count can be good (sourcing diversification, new product
  lines) OR bad (reactive scrambling after a preferred supplier issue).
- Sudden large drops are the one clear flag — they may indicate a supplier
  dropping out, a purchasing freeze, or a data/pipeline problem.

Performance thresholds:
- Month-over-month change within ±5% = Normal (noise)
- Gentle decline (−5% to −10%) = Neutral (possible deliberate consolidation)
- Drop > 10% = Flag (verify whether consolidation or disruption)
- Sudden growth > 15% = Flag (worth asking why — new sourcing initiative or
  emergency substitution?)

Evaluate:
- Direction of change
- Whether the change correlates with Gross Margin % movement (consolidation
  that ALSO improves margin = a good story; consolidation with flat or
  falling margin = concentration risk without the payoff)

Provide a concise analysis of this metric.
```

#### Profitability Trend (ComposedChart — bars + line)

```
You are analyzing the "Profitability Trend" chart on the Supplier Performance overview.

What it shows:
- Bars = Est. Gross Profit (RM, left y-axis) per month
- Line = Gross Margin % (right y-axis) per month
- Granularity is fixed to monthly — this chart has no granularity selector
  on the overview cluster.

The chart answers two questions simultaneously:
- Is the sourcing mix delivering more or less profit in absolute terms?
- Is the business getting more or less efficient at converting purchases
  into profit?

Performance thresholds:
- 3+ consecutive months of Gross Profit growth = Good
- Flat or mixed = Neutral
- 3+ consecutive months of Gross Profit decline = Bad
- Margin % trending down for 2+ consecutive months warrants flagging even
  if Gross Profit is flat (a slow-moving sourcing problem)

Look for:
- Divergence between bars and line (e.g., profit rising while margin % stays
  flat = growth via volume, not pricing leverage)
- Seasonal patterns (fruit distribution has clear festive peaks and lean
  months — don't mistake seasonality for structural movement)
- Any month where Gross Profit and Margin % move in opposite directions —
  always worth calling out on a supplier page, because it usually points
  at a sourcing mix shift

Use the pre-fetched monthly breakdown to cite specific months when making
claims. Do not invent values not present in the data block.

Provide a concise analysis of the profitability trend with evidence.
```

#### Margin Distribution (Bar chart, Supplier ↔ Item toggle)

```
You are analyzing the "Margin Distribution" histogram on the Supplier Performance overview.

What it shows: Count of entities (suppliers OR items) falling into each
Gross Margin % bucket for the selected period. Buckets are fixed:
  < 0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+

IMPORTANT — this chart has an entity toggle (Suppliers ↔ Items). The user
may be viewing either view when they open the analysis. The pre-fetched
block contains BOTH distributions (counts per bucket for suppliers AND for
items). Analyze both and contrast them; do not assume one specific view.

Performance thresholds:
- Entities in < 0% bucket = sourcing at a loss (always flag if > 0)
- Majority clustered in 10–20% band = Healthy (matches overall target)
- Heavy concentration (> 40%) in sub-10% bands = Bad (thin-margin sourcing)
- A meaningful tail (> 15%) in the 20%+ bands = Good (premium sourcing)

Contrast the supplier view vs the item view:
- Supplier view skewed healthy but item view skewed thin = a few premium
  suppliers are carrying a long tail of weak items — procurement ought to
  question the tail
- Item view skewed healthy but supplier view skewed thin = good products
  sourced through mostly weak suppliers — the issue is commercial terms,
  not the product mix
- Both views skewed the same direction = the story is consistent; the
  weak/strong pattern is structural

Evaluate:
- Shape of both distributions (left-skewed, centered, right-skewed, bimodal)
- Proportion below 10% margin in each view
- Presence and size of the loss-making (< 0%) bucket in each view
- Whether the supplier view and item view tell the same story or diverge —
  divergence is the most actionable signal on this chart

Provide a concise analysis focused on distribution shape, concentration,
and the contrast between the supplier and item views.
```

### 3.5 Data Source — `pc_supplier_margin`

Add to v1 §9.2 Tier 1 table list under a new "Supplier Margin Domain" heading:

| Table | Allowed Columns |
|-------|----------------|
| `pc_supplier_margin` | `month, creditor_code, creditor_name, item_code, item_group, is_active, sales_revenue, attributed_cogs, purchase_qty, purchase_value` |

**Population label** (to be emitted by every fetcher in this section):
`"Population: active suppliers with purchase activity in {period}"`

**Tool policy:** `aggregate_only` — summary analysis may drill down into `pc_supplier_margin` itself for root-cause investigation (e.g., "which item groups are compressing the overall margin"), but must not hit RDS tables. Per v1 §12.9.

### 3.6 Fetcher Contracts (per component)

Each fetcher in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts) must return a `FetcherResult` with `prompt` (human-readable markdown with labeled values) and `allowed` (whitelist of every numeric rendered).

Values that MUST appear in the `allowed` whitelist for each component:

| Component key | Values to whitelist |
|--------------|---------------------|
| `sp_net_sales` | period Est. Net Sales RM, prior-period Est. Net Sales RM, MoM delta %, MoM delta RM |
| `sp_cogs` | period Est. COGS RM, COGS-to-Net-Sales ratio %, prior-period COGS RM, COGS delta RM |
| `sp_gross_profit` | period Est. GP RM, prior-period GP RM, GP delta RM, GP delta % |
| `sp_margin_pct` | period margin %, prior-period margin %, margin delta (pp), Est. Net Sales RM, Est. COGS RM |
| `sp_active_suppliers` | period active count, prior-period active count, delta count, delta % |
| `sp_margin_trend` | for each month in range: month label, Est. GP RM, margin %; plus period totals |
| `sp_margin_distribution` | for suppliers: count per bucket (7) + total; for items: count per bucket (7) + total |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in the prompt must be in `allowed`, except dates/years and safe small integers (0, 1, 100).

### 3.7 Truth Queries (per key metric)

Truth queries live in `_bmad-output/planning-artifacts/truth-queries/supplier-margin-overview.sql`. Each must match the fetcher value (within RM 1 tolerance) and the dashboard displayed value.

```sql
-- Parameters (bind before running):
-- :date_from — ISO date (e.g. '2025-01-01')
-- :date_to   — ISO date (e.g. '2025-12-31')
-- No supplier / item-group filters applied (match a clean un-filtered run).
-- startMonth = to_char(:date_from::date, 'YYYY-MM')
-- endMonth   = to_char(:date_to::date,   'YYYY-MM')

-- T1. Est. Net Sales — should match sp_net_sales fetcher + KpiCards "Est. Net Sales" card
SELECT COALESCE(SUM(sales_revenue), 0)::numeric(18,2) AS net_sales
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T';

-- T2. Est. Cost of Sales — should match sp_cogs fetcher + KpiCards "Est. Cost of Sales" card
SELECT COALESCE(SUM(attributed_cogs), 0)::numeric(18,2) AS cogs
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T';

-- T3. Est. Gross Profit — should match sp_gross_profit fetcher + KpiCards "Est. Gross Profit" card
SELECT COALESCE(SUM(sales_revenue) - SUM(attributed_cogs), 0)::numeric(18,2) AS gross_profit
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T';

-- T4. Gross Margin % — should match sp_margin_pct fetcher + KpiCards "Gross Margin %" card
WITH totals AS (
  SELECT
    SUM(sales_revenue)    AS net_sales,
    SUM(attributed_cogs)  AS cogs
  FROM pc_supplier_margin
  WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                  AND to_char(:date_to::date,   'YYYY-MM')
    AND is_active = 'T'
)
SELECT
  CASE WHEN net_sales > 0
    THEN ROUND(((net_sales - cogs) / net_sales * 100)::numeric, 2)
    ELSE 0
  END AS margin_pct
FROM totals;

-- T5. Active Suppliers — should match sp_active_suppliers fetcher + KpiCards "Active Suppliers" card
SELECT COUNT(DISTINCT creditor_code) AS active_suppliers
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T'
  AND purchase_qty > 0;

-- T6. Profitability Trend — monthly breakdown for sp_margin_trend fetcher + MarginTrendChart
SELECT
  month,
  SUM(sales_revenue)::numeric(18,2)                          AS net_sales,
  SUM(attributed_cogs)::numeric(18,2)                        AS cogs,
  (SUM(sales_revenue) - SUM(attributed_cogs))::numeric(18,2) AS gross_profit,
  CASE WHEN SUM(sales_revenue) > 0
    THEN ROUND(
      ((SUM(sales_revenue) - SUM(attributed_cogs))
       / SUM(sales_revenue) * 100)::numeric, 2)
    ELSE 0
  END AS margin_pct
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T'
GROUP BY month
ORDER BY month;

-- T7a. Supplier Margin Distribution — should match sp_margin_distribution (suppliers view)
-- Mirrors getSupplierMarginDistributionV2 bucketing in queries.ts.
-- NOTE: supplier view places rev IS NULL OR rev = 0 into the '< 0%' bucket.
WITH supplier_margin AS (
  SELECT
    creditor_code,
    SUM(sales_revenue)   AS rev,
    SUM(attributed_cogs) AS cost
  FROM pc_supplier_margin
  WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                  AND to_char(:date_to::date,   'YYYY-MM')
    AND is_active = 'T'
  GROUP BY creditor_code
),
bucketed AS (
  SELECT
    CASE
      WHEN rev IS NULL OR rev = 0             THEN '< 0%'
      WHEN (rev - cost) / rev * 100 < 0       THEN '< 0%'
      WHEN (rev - cost) / rev * 100 < 5       THEN '0-5%'
      WHEN (rev - cost) / rev * 100 < 10      THEN '5-10%'
      WHEN (rev - cost) / rev * 100 < 15      THEN '10-15%'
      WHEN (rev - cost) / rev * 100 < 20      THEN '15-20%'
      WHEN (rev - cost) / rev * 100 < 30      THEN '20-30%'
      ELSE '30%+'
    END AS bucket
  FROM supplier_margin
)
SELECT bucket, COUNT(*) AS entity_count
FROM bucketed
GROUP BY bucket
ORDER BY CASE bucket
  WHEN '< 0%'   THEN 1
  WHEN '0-5%'   THEN 2
  WHEN '5-10%'  THEN 3
  WHEN '10-15%' THEN 4
  WHEN '15-20%' THEN 5
  WHEN '20-30%' THEN 6
  WHEN '30%+'   THEN 7
END;

-- T7b. Item Margin Distribution — should match sp_margin_distribution (items view)
-- Mirrors getItemMarginDistributionV2: items with rev <= 0 are EXCLUDED via HAVING.
WITH item_margin AS (
  SELECT
    item_code,
    SUM(sales_revenue)   AS rev,
    SUM(attributed_cogs) AS cost
  FROM pc_supplier_margin
  WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                  AND to_char(:date_to::date,   'YYYY-MM')
    AND is_active = 'T'
  GROUP BY item_code
  HAVING SUM(sales_revenue) > 0
),
bucketed AS (
  SELECT
    CASE
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 0   THEN '< 0%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 5   THEN '0-5%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 10  THEN '5-10%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 15  THEN '10-15%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 20  THEN '15-20%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 30  THEN '20-30%'
      ELSE '30%+'
    END AS bucket
  FROM item_margin
)
SELECT bucket, COUNT(*) AS entity_count
FROM bucketed
GROUP BY bucket
ORDER BY CASE bucket
  WHEN '< 0%'   THEN 1
  WHEN '0-5%'   THEN 2
  WHEN '5-10%'  THEN 3
  WHEN '10-15%' THEN 4
  WHEN '15-20%' THEN 5
  WHEN '20-30%' THEN 6
  WHEN '30%+'   THEN 7
END;
```

**Three-way match required** (per v1 §9.5): fetcher output, truth query output, and dashboard displayed value must all agree.

### 3.8 Implementation Checklist (v1 §14 playbook, instantiated)

- [ ] **Step 1** — Add `'supplier_margin_overview'` to `SectionKey` union in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [ ] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 3** — Add 7 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 4** — Add 7 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §3.6. The `sp_margin_distribution` fetcher must return BOTH supplier and item distributions in one block.
- [ ] **Step 5** — Add `supplier_margin_overview: 'period'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts)
- [ ] **Step 6** — Add `supplier_margin_overview: 'aggregate_only'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts); add `pc_supplier_margin` to `AGGREGATE_LOCAL_TABLES` AND to `LOCAL_WHITELIST` in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts); add the table + column list to the summary prompt's `LOCAL` reference in `prompts.ts`
- [ ] **Step 7** — Mount `<InsightSectionHeader sectionKey="supplier_margin_overview" />` in [DashboardShell.tsx](../../apps/dashboard/src/components/supplier-margin/dashboard/DashboardShell.tsx) above the KpiCards + charts cluster (between `FilterBar` and `KpiCards`)
- [ ] **Step 7b** — Per §3.9, wire per-component `AnalyzeIcon` + add `COMPONENT_INFO` entries. See §3.9.
- [ ] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/supplier-margin-overview.sql`
- [ ] **Step 9** — `npm run build` and `tsc --noEmit` clean; commit with message `feat: add AI insight for supplier margin overview (supplier_margin_overview)`
- [ ] **Step 10 (Phase B)** — Run Appendix C verification with live LLM. Per project feedback (2026-04-14), do NOT call live Anthropic in this session. Defer to Phase B.

### 3.9 Per-Component Analyze Icons (MANDATORY — per §1.9)

Follow the same pattern documented in §1.9. Seven icons to add:

- [ ] **§3.9.1** — Add 7 entries to `COMPONENT_INFO` in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts): `sp_net_sales`, `sp_cogs`, `sp_gross_profit`, `sp_margin_pct`, `sp_active_suppliers`, `sp_margin_trend`, `sp_margin_distribution` — each with `name`, `whatItMeasures`, optional `formula`, optional `indicator`, `about`
- [ ] **§3.9.2** — [KpiCards.tsx](../../apps/dashboard/src/components/supplier-margin/dashboard/KpiCards.tsx): the current `KpiCard` prop shape takes `title`/`value`/`valueColor`/`formula`. Add an optional `componentKey?: string` prop, render `<AnalyzeIcon sectionKey="supplier_margin_overview" componentKey={componentKey} />` inside `<CardHeader>` in a `flex items-center gap-1` wrapper alongside the existing `<CardTitle>`. Pass a componentKey to each of the 5 `KpiCard` usages in the main grid.
- [ ] **§3.9.3** — [MarginTrendChart.tsx](../../apps/dashboard/src/components/supplier-margin/dashboard/MarginTrendChart.tsx): wrap `<CardTitle>` in `flex items-center gap-2`; add icon with `componentKey="sp_margin_trend"`. The existing `CardHeader` also renders a subtitle `<p>` — keep the icon on the title row only.
- [ ] **§3.9.4** — [SupplierMarginDistributionChart.tsx](../../apps/dashboard/src/components/supplier-margin/dashboard/SupplierMarginDistributionChart.tsx): the existing `CardHeader` is `flex flex-row items-center justify-between` (title on the left, entity toggle on the right). Keep that outer structure; wrap the left-side `<CardTitle>` in an inner `flex items-center gap-2` and add the icon there with `componentKey="sp_margin_distribution"`. The entity toggle stays on the right.
- [ ] **§3.9.5** — Playwright spot-check: count 7 icons on the overview cluster (5 KPI + trend + distribution), dialog opens with About populated, AI Analysis section shows placeholder pre-run. Verify the distribution chart icon works in BOTH Suppliers and Items toggle states.

**Page total after §3 ships:** 7 icons (overview only; §4 breakdown not yet in this session).

---

## Section 4 — `supplier_margin_breakdown`

**Page:** Supplier Performance (`/supplier-performance`)
**Scope:** `period` (date-filtered)
**Tool policy:** `full` (matches §2 — breakdown sections may drill RDS for root-cause)
**Data source:** `pc_supplier_margin` (local) + transparent RDS `dbo.IVDTL`/`dbo.CSDTL` for accurate sell-price inside `getItemSellPriceV2` (with fallback to `pc_supplier_margin` when RDS is unavailable)
**AI calls:** 4 parallel component analyses + 1 summary = **5 total**

> **Naming reminder** — same split as §3. Section key is `supplier_margin_breakdown`; component/library path is `supplier-margin`; page route is `/supplier-performance`; `SECTION_PAGE` label is `'Supplier Performance'`. Reuse the §3 import alias pattern.

### 4.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 41 | Top/Bottom Suppliers & Items | Chart (horizontal bar, 2×2 toggle matrix) | `pc_supplier_margin` | Top-10 + Bottom-10 across supplier×profit, supplier×margin%, item×profit, item×margin% |
| 42 | Supplier Analysis Table | Table (all suppliers, sortable, paginated) | `pc_supplier_margin` | Per-supplier revenue, COGS, GP, Margin %, item count |
| 43 | Item Price Comparison | Panel (Supplier Comparison table + Price Trend chart, single anchor item) | `pc_supplier_margin` + `dbo.IVDTL` (via `getItemSellPriceV2`) | Per-supplier avg purchase price + est. margin on the highest-revenue item |
| 44 | Purchase vs Selling Price | Scatter chart | `pc_supplier_margin` | Item-level spread between avg purchase price and avg selling price |

**Component key registry (add to `SECTION_COMPONENTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)):**

```ts
supplier_margin_breakdown: [
  { key: 'sm_top_bottom',      name: 'Top/Bottom Suppliers & Items', type: 'chart' },
  { key: 'sm_supplier_table',  name: 'Supplier Analysis Table',      type: 'table' },
  { key: 'sm_item_pricing',    name: 'Item Price Comparison',        type: 'breakdown' },
  { key: 'sm_price_scatter',   name: 'Purchase vs Selling Price',    type: 'chart' },
],
```

`SECTION_PAGE.supplier_margin_breakdown = 'Supplier Performance'`
`SECTION_NAMES.supplier_margin_breakdown = 'Supplier Margin Breakdown'`

### 4.2 Filter Dimensions Available to Prompts

Breakdown endpoints accept filters from `useDashboardFilters`: `date_from`, `date_to`, `supplier[]`, `itemGroup[]`, `supplierTypes[]`. The AI prompts may reference supplier, supplier-type, and item-group slicing in this section (unlike §3 where supplier-type was excluded).

**Per-component selectors** (local UI state, NOT the filter bar):
- **TopBottomChart:** `entity` (suppliers ↔ items), `metric` (profit ↔ margin %), `direction` (highest ↔ lowest). Fetcher pre-computes **all four lens combinations** (supplier×profit top-10, supplier×margin% top-10, item×profit top-10, item×margin% top-10) plus the bottom-10 counterpart for each — AI reasons across every lens the user may toggle to.
- **SupplierTable:** sort column, direction, pagination (25/50/100), supplier multi-select, 12-month sparklines. Fetcher emits top-10 by revenue + bottom-10 by margin % + aggregates. Sparkline rows are NOT in the fetcher JSON.
- **ItemPricingPanel:** item selector + supplier multi-select + two tabs (Supplier Comparison table, Price Trend chart). Fetcher operates on a **single anchor item** — the highest-revenue item in the filtered period. Summary may drill RDS for additional items.
- **PriceScatterChart:** supplier multi-select + item multi-select + margin-view toggle + pinnable points. Fetcher pre-samples top-50 item-supplier rows by revenue + emits bucketed margin distribution.

### 4.3 Thresholds (used across prompts)

- **Loss-making supplier / item:** margin % `< 0` (flag always)
- **Thin-margin supplier / item:** margin % `< 5` (flag if count meaningful)
- **Concentration risk (suppliers):** top-1 profit share `> 15%` = bad, top-10 profit share `> 60%` = bad, `< 40%` = diversified
- **Top-N cutoff:** 10 (mirrors §2 hardcode)
- **Price scatter sample size:** top-50 by revenue
- **Margin buckets:** `< 0`, `0–5`, `5–10`, `10–20`, `20+` (coarser than §3's 7 buckets — scatter context only needs outlier visibility)

### 4.4 Component System Prompts

All prompts inherit v1 global + user prompt template. Component prompts narrate pre-fetched values only — **no tool access at the component layer**. Tool access is available to the summary only.

#### Top/Bottom Suppliers & Items (Chart)

```
You are analyzing the "Top/Bottom Suppliers & Items" chart on the Supplier Performance breakdown.

What it shows:
- The UI has THREE toggles: Entity (Suppliers ↔ Items), Metric (Profit ↔ Margin %), Direction (Highest ↔ Lowest).
- The pre-fetched data contains ALL four "highest" lens combinations (and the complementary bottom lists):
  (A) Top 10 suppliers by Est. Gross Profit
  (B) Top 10 suppliers by Gross Margin % (min revenue RM 10,000 filter to avoid noise)
  (C) Top 10 items by Est. Gross Profit
  (D) Top 10 items by Gross Margin % (min revenue RM 10,000 filter)
  Plus bottom-10 counterparts (worst performers / loss-makers).
- Your analysis must cover every lens the user can toggle to, not just the default view.

Performance thresholds:
- Top 1 supplier > 15% of period Est. Gross Profit = Bad (supplier concentration risk)
- Top 10 suppliers > 60% of period Est. Gross Profit = Bad (concentrated sourcing)
- Top 10 suppliers < 40% of period Est. Gross Profit = Good (diversified sourcing)
- Any bottom-list supplier with margin % < 0 = Critical (sourcing at a loss)
- Any bottom-list item with margin % < 0 AND meaningful revenue = Flag (product-level loss-maker)
- Any entity appearing on BOTH top-profit AND top-margin lists = Star (supplier or product worth protecting) — name them explicitly.

Evaluate:
- Supplier-side vs item-side concentration (are the top profit suppliers the SAME as top margin suppliers?)
- Loss-makers: which are bigger problems — loss-making suppliers or loss-making items?
- Whether star suppliers / items also appear in the bottom scan at the item or supplier level (inconsistency signals sourcing mix issues)
- Item group or supplier clustering in the bottom lists

Cite named suppliers and items from the pre-fetched data. Do not invent.

Provide a concise analysis focused on concentration, quality of the top contributors, and loss-maker exposure.
```

#### Supplier Analysis Table

```
You are analyzing the "Supplier Analysis Table" on the Supplier Performance breakdown.

What it shows:
- A sortable, paginated table of every active supplier in the period with columns for Code, Name, Type, Items, Revenue, COGS, Gross Profit, Margin %.
- The pre-fetched data gives you:
  (A) Top 10 suppliers by Revenue (biggest sourcing partners)
  (B) Bottom 10 suppliers by Margin % with revenue ≥ RM 10,000 (weak-margin partners that still carry meaningful volume)
  (C) Aggregate roll-ups: total supplier count, loss-making supplier count, top-10 share of revenue, median margin %, avg revenue per supplier, thin-margin (< 5%) supplier count.

Performance thresholds:
- Top 10 share of revenue > 60% = Bad (concentrated sourcing)
- Top 10 share of revenue 40-60% = Neutral (typical for distribution)
- Loss-making suppliers (margin % < 0) > 0 = Always flag; name them
- Thin-margin suppliers (margin % < 5%) > 10% of active count = Portfolio quality concern
- Any bottom-10 supplier with revenue > RM 100,000 AND margin % < 5 = Critical (big volume thin margin)

Evaluate:
- Concentration: how much of the revenue sits with the top few suppliers?
- Bottom-margin tail: is the problem one or two big thin-margin suppliers, or a long tail?
- Supplier type clustering in the bottom 10 (do weak-margin suppliers share a category?)
- Whether the biggest revenue suppliers are also the best margin suppliers — mismatches are the actionable signal.

Cite named suppliers from the pre-fetched top/bottom blocks. Do not invent.

Provide a concise analysis focused on sourcing concentration and the at-risk thin-margin tail.
```

#### Item Price Comparison (Panel — anchor item)

```
You are analyzing the "Item Price Comparison" panel on the Supplier Performance breakdown.

What it shows:
- Per-supplier purchase-price comparison and monthly price trend for a SINGLE anchor item. The UI lets the user pick any item; for this analysis the anchor is the item with the highest purchase_total in the selected period ("{ANCHOR_ITEM_NAME}", code {ANCHOR_ITEM_CODE}).
- The pre-fetched data gives you:
  (A) Top 5 suppliers for the anchor item by purchase volume, with avg purchase price, estimated sell price, and estimated margin %.
  (B) Period totals for the anchor item: total purchased qty, total purchase RM, avg purchase price across all suppliers, min / max purchase price (best / worst supplier on price).
  (C) Cross-supplier margin % spread on the anchor item (best minus worst).

Note: the estimated sell price is the transaction-level average from invoice + cash-sale line items (or the pre-compute fallback when raw tables are unavailable). Margin estimates are therefore anchor-item-specific, not business-wide.

Performance thresholds:
- Margin % spread across suppliers > 10 percentage points = Significant sourcing arbitrage opportunity
- Any supplier's estimated margin % < 0 on the anchor item = Loss-making on that item — flag
- Cheapest supplier also carries > 50% of the item's purchase volume = Procurement already on best price — neutral
- Cheapest supplier carries < 20% of the item's purchase volume = Concentration on a more expensive supplier — flag

Evaluate:
- Whether the volume leader is also the price leader (aligned procurement) or not (arbitrage risk)
- How wide the price spread is across suppliers for the same item — a wide spread is either a quality / grade difference or a procurement failure
- The margin spread across suppliers on this one item — if it is large, procurement could improve overall margin by shifting volume
- Whether the same supplier delivers the best (or worst) estimated margin

Do NOT generalize about the business from a single anchor item. Frame conclusions as "for {ANCHOR_ITEM_NAME} specifically…". The summary layer may drill other items via the tools.

Cite suppliers by name from the pre-fetched block. Do not invent numbers.

Provide a concise analysis focused on price alignment and margin arbitrage on the anchor item.
```

#### Purchase vs Selling Price (Scatter)

```
You are analyzing the "Purchase vs Selling Price" scatter chart on the Supplier Performance breakdown.

What it shows:
- One dot per item: x = avg purchase price, y = avg selling price, size = revenue in the period.
- The UI samples the full universe; the pre-fetched data carries the TOP 50 items by revenue (the items that actually matter financially) plus a bucketed distribution across the full universe.

Pre-fetched data contains:
(A) Top 50 items by revenue: item code, name, suppliers (names), avg purchase price RM, avg selling price RM, margin %, revenue RM
(B) Margin bucket distribution over the FULL item universe (after HAVING SUM(sales_revenue) > 0 filter): count of items with margin % < 0, 0-5, 5-10, 10-20, 20+
(C) Loss-maker count: items with margin % < 0 inside the top-50 AND across the full universe
(D) Universe size: total items in the scatter pool

Performance thresholds:
- Top-50 items with margin % < 0 = Always flag (these are the items that move the P&L)
- More than 20% of universe items in the < 5% bucket = Thin-margin product catalog
- Meaningful tail (> 10% of universe) in the 20+ bucket = Premium product pocket worth protecting
- Any top-50 item with margin % < 0 AND revenue > RM 100,000 = Severe (fixing one item moves the needle)

Evaluate:
- Shape of the bucket distribution (left-skewed loss, centered thin, right-skewed premium, bimodal)
- Price-spread outliers in the top-50: items where purchase price is unusually high or low relative to selling price
- Named loss-making items in the top-50 (call them out with supplier names and the RM loss)
- Whether the same suppliers appear repeatedly in the loss-making items (structural supplier quality issue) or whether it's spread across many suppliers (item-level problem)

Cite items by name from the pre-fetched top-50 block. Do not invent.

Provide a concise analysis focused on loss-making items, price-spread outliers, and the shape of the margin distribution.
```

### 4.5 Data Source + Tool Access

**Local:** `pc_supplier_margin` — already whitelisted from §3. No new entries.
**RDS:** `dbo.IVDTL` / `dbo.CSDTL` are consumed transparently by `getItemSellPriceV2` (supplier-margin/queries.ts:1611). They are NOT added to the AI tool whitelist — the AI cannot directly query them. The summary layer may still drill the existing RDS whitelist (`dbo.IV`, `dbo.CN`, `dbo.ARInvoice`, `dbo.ARPayment`) up to 2 tool calls for root-cause investigation.

**Population label** (every fetcher in this section):
`"Population: active suppliers with purchase activity in {period}"`

**Tool policy:** `'full'` in `SECTION_POLICY`. The section key does NOT need any new whitelist entries in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts).

### 4.6 Fetcher Contracts (per component)

Each fetcher reuses [supplier-margin/queries.ts](../../apps/dashboard/src/lib/supplier-margin/queries.ts) `*V2` functions so the dashboard and the AI see identical numbers.

| Component key | Query functions | Values whitelisted in `allowed` |
|---|---|---|
| `sm_top_bottom` | `getMarginSummaryV2` + `getTopBottomSuppliersV2(sortBy='profit','desc',10)` + `getTopBottomSuppliersV2(sortBy='margin_pct','desc',10)` + `getTopBottomSuppliersV2(sortBy='profit','asc',10)` + `getTopBottomItemsV2(...)` × same four variants | period Est. GP / Net Sales, top-1 / top-3 / top-10 supplier share of GP, loss-maker supplier count, loss-maker item count, per-row revenue / profit / margin % (all 80 rows) |
| `sm_supplier_table` | `getSupplierTableV2(filters)` → sort locally for top-10 by revenue + bottom-10 by margin % (min revenue 10,000 filter applied in JS) + aggregate roll-ups computed in JS | period Est. Net Sales / GP, per-row revenue/COGS/GP/margin % for 20 suppliers, supplier count, loss-maker count, thin-margin count, top-10 revenue share, median margin %, avg revenue per supplier |
| `sm_item_pricing` | `getItemListV2(filters)` → pick highest `total_buy` item as anchor → `getItemSupplierSummaryV2(anchor, ...)` → take top-5 by `total_buy` | anchor item total qty / total buy RM, avg purchase price, min / max purchase price (across suppliers), cross-supplier margin % spread, per-supplier avg price / total qty / total buy / est sales / est margin % for top-5 suppliers |
| `sm_price_scatter` | `getPriceSpread(start, end, suppliers, itemGroups)` → sort by revenue DESC → slice top-50 + compute bucket histogram across FULL result → compute loss-maker counts | top-50 per-row: avg purchase / avg selling / margin % / revenue; bucket counts (`<0`, `0-5`, `5-10`, `10-20`, `20+`); universe size; top-50 loss-maker count; full-universe loss-maker count |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in the prompt must be in `allowed`, except dates/years and safe small integers (0, 1, 100, 5, 10, 15, 20, 50).

**Pre-computed roll-up block (required per v1 §12.8):** each fetcher emits a `Pre-calculated totals (use these values directly — do not recompute)` header with aggregate lines the AI cites verbatim.

### 4.7 Truth Queries (per key metric)

Live in `_bmad-output/planning-artifacts/truth-queries/supplier-margin-breakdown.sql`. Each query must match the fetcher value, the dashboard displayed value, and the `queries.ts` function output (±RM 1 tolerance).

**Metrics verified:**

| Truth query | Matches | Component |
|---|---|---|
| T1. Top 10 suppliers by profit (`pc_supplier_margin` GROUP BY `creditor_code`) | TopBottomChart suppliers/profit/highest | `sm_top_bottom` |
| T2. Top 10 suppliers by margin % (revenue ≥ RM 10K filter) | TopBottomChart suppliers/margin/highest | `sm_top_bottom` |
| T3. Top 10 items by profit | TopBottomChart items/profit/highest | `sm_top_bottom` |
| T4. Top 10 items by margin % (revenue ≥ RM 10K filter) | TopBottomChart items/margin/highest | `sm_top_bottom` |
| T5. Supplier Analysis Table (top 10 by revenue) | SupplierTable default sort | `sm_supplier_table` |
| T6. Loss-making supplier count (margin % < 0) | `sm_supplier_table` aggregate | `sm_supplier_table` |
| T7. Anchor item — top-5 suppliers by purchase volume | ItemPricingPanel "Supplier Comparison" (anchor = highest-revenue item) | `sm_item_pricing` |
| T8. Price scatter — top 50 items by revenue + margin bucket histogram | PriceScatterChart after top-50 sample | `sm_price_scatter` |

### 4.8 Implementation Checklist (v1 §14 playbook, instantiated)

- [ ] **Step 1** — Add `'supplier_margin_breakdown'` to `SectionKey` union in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [ ] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 3** — Add 4 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 4** — Add 4 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §4.6. Reuse the existing `getSupplierMarginSummary` / `getSupplierMarginTrend` import aliases + import `getTopBottomSuppliersV2`, `getTopBottomItemsV2`, `getSupplierTableV2`, `getItemListV2`, `getItemSupplierSummaryV2`, `getPriceSpread` with aliased names if needed.
- [ ] **Step 5** — Add `supplier_margin_breakdown: 'period'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts)
- [ ] **Step 6** — Add `supplier_margin_breakdown: 'full'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts). No whitelist changes.
- [ ] **Step 7** — Mount a second `<InsightSectionHeader sectionKey="supplier_margin_breakdown" />` in [DashboardShell.tsx](../../apps/dashboard/src/components/supplier-margin/dashboard/DashboardShell.tsx) between the `SupplierMarginDistributionChart` row and the `TopBottomChart` (line ~49). Keep the title `"Supplier Margin Breakdown"` and wire `page="supplier-performance"`.
- [ ] **Step 7b** — Per §4.9, wire per-component `AnalyzeIcon` + add `COMPONENT_INFO` entries.
- [ ] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/supplier-margin-breakdown.sql`
- [ ] **Step 9** — `tsc --noEmit` clean; `npm run build` clean; Playwright spot-check in offline mode (no live Anthropic call). Commit with message `feat: AI insight v2 — supplier margin breakdown section`.
- [ ] **Step 10 (deferred)** — Live LLM verification pending Phase B / Anthropic credits.

### 4.9 Per-Component Analyze Icons (MANDATORY — per §1.9)

Four icons to add:

- [ ] **§4.9.1** — Add 4 entries to `COMPONENT_INFO` in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts): `sm_top_bottom`, `sm_supplier_table`, `sm_item_pricing`, `sm_price_scatter` — each with `name`, `whatItMeasures`, optional `indicator`, `about`.
- [ ] **§4.9.2** — [TopBottomChart.tsx:113](../../apps/dashboard/src/components/supplier-margin/dashboard/TopBottomChart.tsx#L113): wrap `<CardTitle>` in a `flex items-center gap-2` div; add `<AnalyzeIcon sectionKey="supplier_margin_breakdown" componentKey="sm_top_bottom" />` beside it. Keep the right-side toggle cluster untouched.
- [ ] **§4.9.3** — [SupplierTable.tsx:247](../../apps/dashboard/src/components/supplier-margin/dashboard/SupplierTable.tsx#L247): wrap the `<CardTitle>Supplier Analysis</CardTitle>` in a `flex items-center gap-2` div; add icon with `componentKey="sm_supplier_table"`.
- [ ] **§4.9.4** — [ItemPricingPanel.tsx:284](../../apps/dashboard/src/components/supplier-margin/dashboard/ItemPricingPanel.tsx#L284): wrap the `"Supplier Comparison"` CardTitle in a `flex items-center gap-2` div; add icon with `componentKey="sm_item_pricing"`. The Price Trend card stays iconless (one icon per logical component per §X.9).
- [ ] **§4.9.5** — [PriceScatterChart.tsx:331](../../apps/dashboard/src/components/supplier-margin/dashboard/PriceScatterChart.tsx#L331): wrap the `<CardTitle>Purchase vs Selling Price</CardTitle>` in a `flex items-center gap-2` div (the existing header already uses a `justify-between` row — keep the right-side controls untouched); add icon with `componentKey="sm_price_scatter"`.
- [ ] **§4.9.6** — Playwright spot-check: 4 additional icons on the breakdown cluster (bringing the Supplier Performance page total to 11 = 7 overview + 4 breakdown), dialog opens on click, About section populated, AI Analysis area shows the pre-run placeholder.

**Page total after §4 ships:** 11 icons on the Supplier Performance page.

---

## Appendix A addendum (section key reference) — updated

| Section Key | Page | Section Name | Date Filtered |
|-------------|------|-------------|---------------|
| `customer_margin_overview` | Customer Margin | Customer Margin Overview | Yes (period) |
| `customer_margin_breakdown` | Customer Margin | Customer Margin Breakdown | Yes (period) |
| `supplier_margin_overview` | Supplier Performance | Supplier Margin Overview | Yes (period) |
| `supplier_margin_breakdown` | Supplier Performance | Supplier Margin Breakdown | Yes (period) |
| `return_trend` | Returns | Return Trends | Yes (period) |
| `expense_overview` | Expenses | Expense Overview | Yes (period) |

---

## Appendix B addendum (estimated cost model) — updated

| Section | Components | Est. Tokens | Est. Cost (Haiku+Sonnet) | Observed |
|---------|-----------|-------------|--------------------------|----------|
| Customer Margin Overview | 7 + summary | ~22,000 | ~$0.10 | Deferred to Phase B |
| Customer Margin Breakdown | 3 + summary | ~18,000 | ~$0.09 | Deferred to Phase B |
| Supplier Margin Overview | 7 + summary | ~23,000 | ~$0.11 | Deferred to Phase B |
| Supplier Margin Breakdown | 4 + summary | ~20,000 | ~$0.10 | Deferred to Phase B |
| Return Trends | 7 + summary | ~16,000 | ~$0.08 | Deferred to Phase B |
| Expense Overview | 7 + summary | ~17,000 | ~$0.08 | Deferred to Phase B |

**Estimation basis for return trends:** 7 component calls at ~1,500 tokens each on Haiku (KPI fetchers carry small roll-up blocks, charts carry month/item tables) + 1 summary call at ~5,500 tokens on Sonnet. Cheapest section so far because return volume is small relative to sales and the pre-computed tables aggregate monthly.

**Estimation basis for supplier breakdown:** 4 component calls at ~2,500 tokens each on Haiku (the top_bottom fetcher carries 4 lens tables so it sits at the high end) + 1 summary call at ~8,000 tokens on Sonnet. Marginally cheaper than the §3 overview because the breakdown has 4 fetchers vs 7, even though each carries more rows.

---

## Section 5 — `return_trend`

**Page:** Returns (`/return`)
**Scope:** `period` (date-filtered)
**Tool policy:** `aggregate_only` (matches §1 / §3 — first section of a page with only local pre-computes behind it)
**Data source:** `pc_return_monthly` (local) + `pc_return_products` (local) + `pc_sales_daily` (local, for return rate % denominator)
**AI calls:** 7 parallel component analyses + 1 summary = **8 total**

> **Naming reminder** — section key is `return_trend`; component prefix is `rt_*`; page route is `/return`; `SECTION_PAGE` label is `'Returns'`; dashboard shell at [DashboardShellV2.tsx](../../apps/dashboard/src/components/return/dashboard-v2/DashboardShellV2.tsx). Layout is hybrid — Section 1 (`return_trend`) is period-filtered, Section 2 (`return_unsettled`, pending) will be snapshot.

> **UI alignment note (2026-04-14)** — the Returns page renders **4 KPI cards** (Total Returns, Settled, Unsettled, Return %), not 5. "Settled" is intentionally a rollup of knocked-off + refunded because the card's narrative is *"how much exposure is resolved"*, and splitting it would lose that story. The component inventory below is 1:1 with the actual UI cards per v1 §4.3 contract. Knocked-off vs refunded is still exposed to the AI inside the `rt_settled` and `rt_settlement_breakdown` prompts and to the user in the SettlementBreakdown chart.

### 5.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 51 | Total Returns | KPI | `pc_return_monthly` | Total return value (RM) + return CN count |
| 52 | Settled | KPI | `pc_return_monthly` | Knocked off + refunded (RM), settled % |
| 53 | Unsettled | KPI | `pc_return_monthly` | Unresolved (RM), reconciliation breakdown |
| 54 | Return % | KPI | `pc_return_monthly` + `pc_sales_daily` | Return value ÷ net sales |
| 55 | Settlement Breakdown | Chart (stacked progress bars) | `pc_return_monthly` | Knock-off / refund / unsettled split |
| 56 | Monthly Return Trend | Chart (area) | `pc_return_monthly` | Monthly return value + unsettled series |
| 57 | Top Returns by Item | Chart (horizontal bar) | `pc_return_products` | Top 10 items by frequency AND value |

**Component key registry (added to `SECTION_COMPONENTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)):**

```ts
return_trend: [
  { key: 'rt_total_returns',        name: 'Total Returns',        type: 'kpi' },
  { key: 'rt_settled',              name: 'Settled',              type: 'kpi' },
  { key: 'rt_unsettled',            name: 'Unsettled',            type: 'kpi' },
  { key: 'rt_return_pct',           name: 'Return %',             type: 'kpi' },
  { key: 'rt_settlement_breakdown', name: 'Settlement Breakdown', type: 'chart' },
  { key: 'rt_monthly_trend',        name: 'Monthly Return Trend', type: 'chart' },
  { key: 'rt_product_bar',          name: 'Top Returns by Item',  type: 'chart' },
],
```

`SECTION_PAGE.return_trend = 'Returns'`
`SECTION_NAMES.return_trend = 'Return Trends'`
`PageKey` union extended with `'return'` in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts).

### 5.2 Filter Dimensions Available to Prompts

Period endpoints accept `startDate` / `endDate` from `useDashboardFiltersV2`. No per-section dimension filters — the ProductBarChart dimension toggle (Item / Product / Variant / Country) and metric toggle (Frequency / Value) are **local UI state**, not global filters. The AI is given the **item dimension only** with **both metric views (frequency + value)**, and is instructed that drill-downs remain user-driven via the toggles.

### 5.3 Thresholds (used across prompts)

- **Return rate %:** < 2% Healthy · 2–5% Watch · > 5% Concern
- **Unsettled % of return value:** < 15% Healthy · 15–30% Watch · > 30% Concern
- **Knock-off % of return value:** > 70% Healthy (cash-efficient settlement)
- **Refund % of return value:** > 30% Concern (cash-draining settlement)
- **MoM return-count growth (first → last month):** > 25% Concern
- **Item concentration:** Top 1 > 15% of return value = Severe · Top 10 > 60% Concentrated · Top 10 < 40% Diversified
- **Settlement mix rule:** knock-off preferred (offsets invoices, no cash out); refund is working-capital drain (only appropriate for ending relationships or customers with no upcoming invoices).

### 5.4 Component System Prompts

All 7 prompts live in `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts) under the `// ─── Return Trend (§5) ───` block. Prompts narrate pre-fetched values only — no component-level tool access. Summary layer inherits the `aggregate_only` policy and may drill `pc_return_monthly` / `pc_return_products` / `pc_sales_daily` up to 2 tool calls for root-cause investigation.

### 5.5 Data Source + Tool Access

**Local tables newly whitelisted in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts):**

- `pc_return_monthly`: `month, cn_count, cn_total, knock_off_total, refund_total, unresolved_total, reconciled_count, partial_count, outstanding_count`
- `pc_return_products`: `month, item_code, item_description, fruit_name, fruit_variant, fruit_country, cn_count, total_qty, total_amount, goods_returned_qty, credit_only_qty`

Both added to `AGGREGATE_LOCAL_TABLES` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts) so the `aggregate_only` policy permits them. `pc_sales_daily` is already whitelisted from v1.

**Population label** (every fetcher in this section):
`"Population: return credit notes issued in {period}"`

**Tool policy:** `'aggregate_only'` in `SECTION_POLICY`.

### 5.6 Fetcher Contracts (per component)

Each fetcher reuses [return/queries.ts](../../apps/dashboard/src/lib/return/queries.ts) functions so the dashboard and the AI see identical numbers — no new SQL was added.

| Component key | Query functions | Values whitelisted in `allowed` |
|---|---|---|
| `rt_total_returns` | `getReturnOverview(start, end)` | total return value, return count, period net sales, return rate %, avg return per CN |
| `rt_settled` | `getReturnOverview` + `getRefundSummary` | total return value, total settled, settled %, knocked off, knock-off %, refunded, refund %, refund count |
| `rt_unsettled` | `getReturnOverview` | total unsettled, unsettled %, total return value, reconciled count, partial count, outstanding count, return count, reconciliation rate |
| `rt_return_pct` | `getReturnOverview` | return rate %, period return value, period net sales, good threshold (2), concern threshold (5) |
| `rt_settlement_breakdown` | `getRefundSummary` | total return value, knocked off, knock-off %, refunded, refund %, unsettled, unsettled %, refund count |
| `rt_monthly_trend` | `getReturnTrend(start, end)` | per-month return value, unsettled, CN count; months in period, peak / lowest / peak-unsettled month, MoM count growth % |
| `rt_product_bar` | `getReturnProducts(..., 'item', 'frequency')` + `getReturnProducts(..., 'item', 'value')` + `getReturnOverview` | period total return value, period total return count, per-item return value, per-item CN count, top 1 / top 10 share of return value, top 10 value sum |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in a prompt must appear in `allowed`, except dates/years and safe small integers (0, 1, 2, 5, 10, 15, 20, 30, 50, 60, 70, 100).

**Pre-computed roll-up block (required per v1 §12.8):** the two chart fetchers (`rt_monthly_trend`, `rt_product_bar`) emit a `Pre-calculated roll-ups (use these values directly — do not recompute)` header with aggregate lines the AI cites verbatim. KPI fetchers carry their roll-ups inline.

### 5.7 Truth Queries (per key metric)

To live in `_bmad-output/planning-artifacts/truth-queries/return-trend.sql` (deferred until Phase B verification). Each query must match the fetcher value, the dashboard displayed value, and `queries.ts` function output (±RM 1 tolerance).

**Metrics to verify:**

| Truth query | Matches | Component |
|---|---|---|
| T1. Total return value + count (`SUM(cn_total)`, `SUM(cn_count)` from `pc_return_monthly`) | Total Returns KPI | `rt_total_returns` |
| T2. Knock-off total, refund total, unresolved total | Settled + Unsettled KPIs, SettlementBreakdown | `rt_settled`, `rt_unsettled`, `rt_settlement_breakdown` |
| T3. Return rate % (return value ÷ net sales from `pc_sales_daily`) | Return % KPI | `rt_return_pct` |
| T4. Monthly trend (month × return_value × unresolved × cn_count) | Monthly Return Trend | `rt_monthly_trend` |
| T5. Top 10 items by frequency (`cn_count DESC`) on `pc_return_products` | ProductBarChart Frequency view | `rt_product_bar` |
| T6. Top 10 items by value (`total_amount DESC`) on `pc_return_products` | ProductBarChart Value view | `rt_product_bar` |

### 5.8 Implementation Checklist (v1 §14 playbook, instantiated) — completed 2026-04-14

- [x] **Step 1** — Add `'return_trend'` to `SectionKey` and `'return'` to `PageKey` in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [x] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [x] **Step 3** — Add 7 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [x] **Step 4** — Add 7 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §5.6. Imports `getReturnOverview`, `getReturnTrend`, `getRefundSummary`, `getReturnProducts` from `../return/queries` — no new SQL.
- [x] **Step 5** — Add `return_trend: 'period'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts)
- [x] **Step 6** — Add `return_trend: 'aggregate_only'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts). Add `pc_return_monthly` and `pc_return_products` to `AGGREGATE_LOCAL_TABLES` and to `LOCAL_WHITELIST` in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts).
- [x] **Step 7** — Replace the bespoke `<SectionHeader>` for Section 1 in [DashboardShellV2.tsx](../../apps/dashboard/src/components/return/dashboard-v2/DashboardShellV2.tsx) with `<InsightSectionHeader page="return" sectionKey="return_trend" ... />`. (The bespoke `<SectionHeader>` is left in place for Section 2 `Unsettled Returns`, which will be wired in §6.)
- [x] **Step 7b** — Per §5.9, wire per-component `AnalyzeIcon` + add 7 `COMPONENT_INFO` entries.
- [ ] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/return-trend.sql` (deferred to Phase B)
- [x] **Step 9** — `tsc --noEmit` clean; Playwright spot-check in debug mode (no live Anthropic call). Commit with message `feat: AI insight v2 — return trend section`.
- [ ] **Step 10 (deferred)** — Live LLM verification pending Phase B / Anthropic credits.

### 5.9 Per-Component Analyze Icons (MANDATORY — per §1.9)

Seven icons to add:

- [x] **§5.9.1** — Add 7 entries to `COMPONENT_INFO` in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts): `rt_total_returns`, `rt_settled`, `rt_unsettled`, `rt_return_pct`, `rt_settlement_breakdown`, `rt_monthly_trend`, `rt_product_bar` — each with `name`, `whatItMeasures`, `formula` where relevant, `indicator`, `about`.
- [x] **§5.9.2** — [KpiCardsV2.tsx](../../apps/dashboard/src/components/return/dashboard-v2/overview/KpiCardsV2.tsx): add `componentKey` prop to `KpiCard` and render `<AnalyzeIcon sectionKey="return_trend" componentKey={componentKey} />` inline with `<CardTitle>` via the existing `flex items-center gap-1` container. Each of the 4 cards passes its component key.
- [x] **§5.9.3** — [SettlementBreakdown.tsx](../../apps/dashboard/src/components/return/dashboard-v2/refunds/SettlementBreakdown.tsx): wrap `<CardTitle>` in `flex items-center gap-2`; add icon with `componentKey="rt_settlement_breakdown"`.
- [x] **§5.9.4** — [MonthlyTrendChart.tsx](../../apps/dashboard/src/components/return/dashboard-v2/overview/MonthlyTrendChart.tsx): wrap `<CardTitle>` in `flex items-center gap-2`; add icon with `componentKey="rt_monthly_trend"`. The subtitle paragraph stays below the title row.
- [x] **§5.9.5** — [ProductBarChart.tsx](../../apps/dashboard/src/components/return/dashboard-v2/products/ProductBarChart.tsx): the header already uses `justify-between`. Wrap `<CardTitle>` in a `flex items-center gap-2` container on the left; add icon with `componentKey="rt_product_bar"`. Right-side metric + dimension toggle clusters stay untouched.
- [x] **§5.9.6** — Playwright spot-check: 7 icons render on the Return Trends cluster, dialog opens on click, About section populated, AI Analysis area shows the pre-run placeholder.

**Page total after §5 ships:** 7 icons on the Returns page (Section 2 `return_unsettled` will add more in §6).

---

## Section 6 — `return_unsettled`

**Page:** Returns (`/return`)
**Scope:** `snapshot` (no date filter)
**Tool policy:** `full` (mirrors v1 `payment_outstanding` — snapshot + customer table = drill-down is the whole point)
**Data sources:** `pc_return_aging` (daily snapshot, 5 buckets — filter to latest `snapshot_date`) + `pc_return_by_customer` (monthly per debtor, cumulative across all months)
**AI calls:** 2 parallel component analyses + 1 summary = **3 total**

> **Scope label** — `"Current state as of latest pc_return_aging snapshot (cumulative position across all months)"`. Both fetchers share this single label. The `buildScopeLabel` helper in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts) is extended to branch per-section — `payment_outstanding` keeps its `pc_ar_customer_snapshot` lookup; `return_unsettled` queries `pc_return_aging`.

> **Data-source reality check** — the Returns v2 kickoff referenced `pc_return_monthly`, but the two UI components actually pull from `pc_return_aging` (aging chart) and `pc_return_by_customer` (debtors table). Both fetchers reuse existing [return/queries.ts](../../apps/dashboard/src/lib/return/queries.ts) functions (`getReturnAging`, `getAllCustomerReturnsAll`) — **zero new SQL**. Both tables are newly whitelisted in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts).

### 6.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 58 | Aging of Unsettled Returns | Chart (horizontal bar) | `pc_return_aging` (latest snapshot) | 5 bucket amounts + counts, % share of unsettled value |
| 59 | Customer Returns | Table | `pc_return_by_customer` (cumulative) | Per-debtor returns, offset, refund, unresolved |

**Component key registry (added to `SECTION_COMPONENTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)):**

```ts
return_unsettled: [
  { key: 'ru_aging_chart',   name: 'Aging of Unsettled Returns', type: 'chart' },
  { key: 'ru_debtors_table', name: 'Customer Returns',            type: 'table' },
],
```

`SECTION_PAGE.return_unsettled = 'Returns'`
`SECTION_NAMES.return_unsettled = 'Unsettled Returns'`

### 6.2 Filter Dimensions Available to Prompts

None — snapshot section. The table's in-UI filter (Unsettled / Resolved / All) is local UI state and does not flow to the AI. Fetchers emit the full cumulative view.

### 6.3 Thresholds

- **Aging concern:** > 25% of unsettled value in 91+ buckets → watch · > 10% in 180+ → write-off risk
- **Concentration:** top-1 debtor > 15% of total unsettled → single-point risk · top-10 > 60% → concentrated book
- **Stale debtors:** `unresolved > 0 AND knock_off_total = 0 AND refund_total = 0` → never actioned (collections team forgot)

### 6.4 Component System Prompts

Two prompts added to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts) under the `// ─── Return Unsettled (§6) ───` block. Both prompts run under `full` policy — component-level tool drilldown is permitted alongside the summary layer.

- **`ru_aging_chart`** — narrates bucket distribution, calls out skew toward 91+ and 180+ buckets, instructs drilldown into `pc_return_aging` history if trend over time is needed.
- **`ru_debtors_table`** — narrates concentration, names top 5 debtors, flags stale debtors and settlement-activity patterns. May drill `pc_return_by_customer` by debtor or `dbo.CN` for credit note detail under `full` policy.

### 6.5 Data Source + Tool Access

**Local tables newly whitelisted in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts):**

- `pc_return_aging`: `snapshot_date, bucket, count, amount`
- `pc_return_by_customer`: `month, debtor_code, company_name, cn_count, cn_total, knock_off_total, refund_total, unresolved, outstanding_count`

Neither is added to `AGGREGATE_LOCAL_TABLES` — tool policy is `full`, so no aggregate-only restriction applies. Previously whitelisted return tables (`pc_return_monthly`, `pc_return_products`) remain accessible under `full`.

**Population label** (both fetchers): `"Population: cumulative unsettled return exposure across all months"`

**Tool policy:** `'full'` in `SECTION_POLICY`.

### 6.6 Fetcher Contracts (per component)

Each fetcher reuses [return/queries.ts](../../apps/dashboard/src/lib/return/queries.ts) — zero new SQL.

| Component key | Query functions | Values whitelisted in `allowed` |
|---|---|---|
| `ru_aging_chart` | `getReturnAging()` | 5 bucket amounts, 5 bucket counts, total unsettled amount, total unsettled count, 0–30 / 31–60 / 61–90 / 91–180 / 180+ share % |
| `ru_debtors_table` | `getAllCustomerReturnsAll()` | total unsettled (sum of `unresolved`), debtors-with-unresolved count, stale-debtor count, top-1 / top-10 share % of unsettled, top 5 debtor names + unresolved + knock-off + refund |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in a prompt appears in `allowed`, except dates/years and safe small integers (0, 1, 2, 5, 10, 15, 20, 25, 30, 50, 60, 70, 100).

**Pre-computed roll-up block (required per v1 §12.8):** both fetchers emit a `Pre-calculated roll-ups (use these values directly — do not recompute)` header.

### 6.7 Truth Queries (per key metric)

To live in `_bmad-output/planning-artifacts/truth-queries/return-unsettled.sql` (deferred to Phase B).

| Truth query | Matches | Component |
|---|---|---|
| T1. 5-bucket amounts + counts from latest `pc_return_aging` snapshot | Aging chart | `ru_aging_chart` |
| T2. Total unsettled across all months (`SUM(unresolved)` on `pc_return_by_customer`) | Debtors table header | `ru_debtors_table` |
| T3. Top 10 debtors by `SUM(unresolved)` | Debtors table body | `ru_debtors_table` |
| T4. Top-1 debtor concentration % of total unsettled | Concentration flag | `ru_debtors_table` |
| T5. Stale-debtor count (`unresolved > 0 AND knock_off_total = 0 AND refund_total = 0`) | Stale debtor flag | `ru_debtors_table` |

### 6.8 Implementation Checklist (v1 §14 playbook)

- [ ] **Step 1** — Add `'return_unsettled'` to `SectionKey` in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [ ] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 3** — Add 2 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 4** — Add 2 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §6.6. Imports `getReturnAging`, `getAllCustomerReturnsAll` from `../return/queries` — no new SQL.
- [ ] **Step 5** — Add `return_unsettled: 'snapshot'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts). Extend `buildScopeLabel` to branch per-section for snapshot label resolution.
- [ ] **Step 6** — Add `return_unsettled: 'full'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts). Add `pc_return_aging` and `pc_return_by_customer` to `LOCAL_WHITELIST` in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts). No `AGGREGATE_LOCAL_TABLES` change.
- [ ] **Step 7** — Replace the bespoke `<SectionHeader title="Unsettled Returns" …>` in [DashboardShellV2.tsx](../../apps/dashboard/src/components/return/dashboard-v2/DashboardShellV2.tsx) with `<InsightSectionHeader page="return" sectionKey="return_unsettled" dateRange={null} subtitle="Accumulated from beginning to now" />`.
- [ ] **Step 7b** — Per §6.9, wire per-component `AnalyzeIcon` + add 2 `COMPONENT_INFO` entries.
- [ ] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/return-unsettled.sql` (deferred to Phase B)
- [ ] **Step 9** — `tsc --noEmit` clean; Playwright spot-check in debug mode (no live Anthropic call). Commit with message `feat: AI insight v2 — return unsettled section`.
- [ ] **Step 10 (deferred)** — Live LLM verification pending Phase B / Anthropic credits.

### 6.9 Per-Component Analyze Icons (MANDATORY — per §1.9)

Two icons to add:

- [ ] **§6.9.1** — Add 2 entries to `COMPONENT_INFO` in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts): `ru_aging_chart`, `ru_debtors_table`.
- [ ] **§6.9.2** — [AgingChart.tsx](../../apps/dashboard/src/components/return/dashboard-v2/overview/AgingChart.tsx): wrap `<CardTitle>` in `flex items-center gap-2`; add icon with `componentKey="ru_aging_chart"`.
- [ ] **§6.9.3** — [TopDebtorsTable.tsx](../../apps/dashboard/src/components/return/dashboard-v2/overview/TopDebtorsTable.tsx): wrap `<CardTitle>Customer Returns</CardTitle>` in `flex items-center gap-2`; add icon with `componentKey="ru_debtors_table"`. Subtitle paragraph stays below.
- [ ] **§6.9.4** — Playwright spot-check: 2 icons render on the Unsettled Returns cluster, dialog opens on click, About section populated.

**Page total after §6 ships:** 7 (from §5) + 2 = **9 icons** on the Returns page.

---

## Section 7 — `expense_overview`

**Page:** Expenses (`/expenses`)
**Scope:** `period` (date-filtered)
**Tool policy:** `aggregate_only` (matches §1 / §3 / §5 — first section of a page with only local pre-computes behind it)
**Data source:** `pc_expense_monthly` (local pre-compute — GL account × month × `acc_type` where `acc_type IN ('CO','EP')`)
**AI calls:** 7 parallel component analyses + 1 summary = **8 total**

> **Naming reminder** — section key is `expense_overview`; component prefix is `ex_*`; page route is `/expenses`; `SECTION_PAGE` label is `'Expenses'`; dashboard shell at [DashboardShell.tsx](../../apps/dashboard/src/components/expenses/dashboard/DashboardShell.tsx). There is no `dashboard-v2` split for Expenses — AI icons are mounted on the existing `components/expenses/dashboard/*` components directly.

> **UI alignment note (2026-04-14)** — the Expenses page renders **4 KPI cards** (Total Costs, Cost of Sales, Operating Costs, vs Last Year). Per the §1.9 / §5.9 contract, every visible KPI gets an icon — the vs-Last-Year card is a first-class KPI (YoY cost-growth signal) and is wired with `ex_yoy_costs`. The component inventory below is 1:1 with the actual UI cards.

### 7.1 Component Inventory

| # | Component | Type | Data Source | Key Metric |
|---|-----------|------|-------------|------------|
| 71 | Total Costs | KPI | `pc_expense_monthly` | COGS + OpEx for the period + split |
| 72 | Cost of Sales | KPI | `pc_expense_monthly` | COGS RM, % of total cost, YoY |
| 73 | Operating Costs | KPI | `pc_expense_monthly` | OpEx RM, % of total cost, YoY |
| 74 | vs Last Year | KPI | `pc_expense_monthly` | YoY % on total cost + COGS YoY + OpEx YoY |
| 75 | Cost Trend | Chart (stacked bars, monthly) | `pc_expense_monthly` | MoM trajectory, peak/low month, MoM growth, YoY overlay |
| 76 | Cost Composition | Chart (donut) | `pc_expense_monthly` | COGS vs OpEx split and YoY composition drift |
| 77 | Top Expenses | Chart (horizontal bar, cost-type toggle) | `pc_expense_monthly` | Top 10 accounts by net cost + concentration |

**Component key registry (added to `SECTION_COMPONENTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)):**

```ts
expense_overview: [
  { key: 'ex_total_costs',      name: 'Total Costs',      type: 'kpi' },
  { key: 'ex_cogs',              name: 'Cost of Sales',    type: 'kpi' },
  { key: 'ex_opex',              name: 'Operating Costs',  type: 'kpi' },
  { key: 'ex_yoy_costs',         name: 'vs Last Year',     type: 'kpi' },
  { key: 'ex_cost_trend',        name: 'Cost Trend',       type: 'chart' },
  { key: 'ex_cost_composition',  name: 'Cost Composition', type: 'chart' },
  { key: 'ex_top_expenses',      name: 'Top Expenses',     type: 'chart' },
],
```

`SECTION_PAGE.expense_overview = 'Expenses'`
`SECTION_NAMES.expense_overview = 'Expense Overview'`
`PageKey` union extended with `'expenses'` in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts).

### 7.2 Filter Dimensions Available to Prompts

Period endpoints accept `startDate` / `endDate` from `useDashboardFilters`. The UI also exposes a `costType` toggle (All / COGS / OpEx) that scopes the CostTrendChart and CostCompositionChart views locally, but the AI is always given the **unfiltered All view** — drill-downs into cost-type remain user-driven via the toggles.

### 7.3 Thresholds (used across prompts)

- **YoY total-cost growth:** < 0% Healthy · 0–5% Watch · 5–10% Concern · > 10% Severe — costs growing faster than typical revenue inflation
- **COGS share of total cost:** 60–80% Typical fruit-distribution mix · > 85% COGS-dominated (margin-pressure risk) · < 50% OpEx-dominated (scaling inefficiency risk)
- **OpEx YoY growth:** > 10% Concern — OpEx is semi-fixed and should grow slower than revenue
- **COGS YoY growth:** tolerable if sales volume also grew; flag if > 15% and sales flat/declining
- **MoM cost growth (first → last month in period):** > 15% Concern · > 25% Severe
- **Expense concentration (Top 1 account share of total cost):** > 30% Severe · 15–30% Concentrated · < 15% Diversified
- **Top 10 share of total cost:** > 75% Concentrated · < 50% Diversified
- **Cost discipline rule:** COGS scales with sales volume (variable — YoY growth acceptable if sales also grew); OpEx grows only with structural decisions (headcount, rent, tooling) — unexplained OpEx jumps warrant investigation.

### 7.4 Component System Prompts

All 7 prompts live in `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts) under the `// ─── Expense Overview (§7) ───` block. Prompts narrate pre-fetched values only — no component-level tool access. Summary layer inherits the `aggregate_only` policy and may drill `pc_expense_monthly` up to 2 tool calls for root-cause investigation.

### 7.5 Data Source + Tool Access

**Local table newly whitelisted in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts):**

- `pc_expense_monthly`: `month, acc_no, account_name, acc_type, net_amount`

Added to `AGGREGATE_LOCAL_TABLES` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts) so the `aggregate_only` policy permits it.

**Population label** (every fetcher in this section):
`"Population: expense GL postings in {period}"`

**Tool policy:** `'aggregate_only'` in `SECTION_POLICY`.

### 7.6 Fetcher Contracts (per component)

Each fetcher reuses [expenses/queries.ts](../../apps/dashboard/src/lib/expenses/queries.ts) functions so the dashboard and the AI see identical numbers — no new SQL was added.

| Component key | Query functions | Values whitelisted in `allowed` |
|---|---|---|
| `ex_total_costs` | `getCostKpisV2` | total cost, COGS, OpEx, COGS %, OpEx %, YoY total, previous total |
| `ex_cogs` | `getCostKpisV2` + `getCogsBreakdown` | COGS RM, COGS % of total, COGS YoY, top 3 COGS accounts + % shares |
| `ex_opex` | `getCostKpisV2` + `getOpexBreakdown` | OpEx RM, OpEx % of total, OpEx YoY, top 3 OpEx accounts + % shares |
| `ex_yoy_costs` | `getCostKpisV2` | YoY % total, YoY % COGS, YoY % OpEx, current vs previous RM amounts |
| `ex_cost_trend` | `getCostTrendV2` | per-month COGS + OpEx, months in period, peak/low month, MoM growth %, prior-year totals |
| `ex_cost_composition` | `getCostCompositionV2` | COGS RM, OpEx RM, total RM, COGS %, OpEx %, prior-year composition |
| `ex_top_expenses` | `getTopExpensesByType(..., 'all', 'desc')` | total cost, top 10 rows (acc_no, account_name, cost_type, net_cost), top 1 share %, top 10 share % |

**Whitelist discipline (v1 §12.10):** every RM amount, percentage, and count printed in a prompt must appear in `allowed`, except dates/years and safe small integers (0, 1, 2, 5, 10, 15, 20, 30, 50, 60, 70, 80, 85, 100).

**Pre-computed roll-up block (required per v1 §12.8):** the trend, composition, and top-expenses fetchers emit a `Pre-calculated roll-ups (use these values directly — do not recompute)` header with aggregate lines the AI cites verbatim. KPI fetchers carry their roll-ups inline.

### 7.7 Truth Queries (per key metric)

To live in `_bmad-output/planning-artifacts/truth-queries/expense-overview.sql` (deferred until Phase B verification). Each query must match the fetcher value, the dashboard displayed value, and `queries.ts` function output (±RM 1 tolerance).

**Metrics to verify:**

| Truth query | Matches | Component |
|---|---|---|
| T1. Total cost, COGS, OpEx (`SUM(net_amount)` grouped by `acc_type`) from `pc_expense_monthly` | Total Costs / COGS / OpEx KPIs | `ex_total_costs`, `ex_cogs`, `ex_opex` |
| T2. YoY total, COGS, OpEx (same query shifted 1 year back) | vs Last Year KPI | `ex_yoy_costs` |
| T3. Monthly trend (month × COGS × OpEx) | CostTrendChart | `ex_cost_trend` |
| T4. Composition (acc_type × `SUM(net_amount)`) | CostCompositionChart | `ex_cost_composition` |
| T5. Top 10 accounts by `SUM(net_amount) DESC` (all cost types) | TopExpensesChart (All view) | `ex_top_expenses` |

### 7.8 Implementation Checklist (v1 §14 playbook, instantiated)

- [ ] **Step 1** — Add `'expense_overview'` to `SectionKey` and `'expenses'` to `PageKey` in [types.ts](../../apps/dashboard/src/lib/ai-insight/types.ts)
- [ ] **Step 2** — Extend `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 3** — Add 7 component prompts to `COMPONENT_PROMPTS` in [prompts.ts](../../apps/dashboard/src/lib/ai-insight/prompts.ts)
- [ ] **Step 4** — Add 7 fetchers to the `fetchers` record in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts); each returns `{ prompt, allowed }` per §7.6. Imports `getCostKpisV2`, `getCostTrendV2`, `getCostCompositionV2`, `getCogsBreakdown`, `getOpexBreakdown`, `getTopExpensesByType` from `../expenses/queries` — no new SQL.
- [ ] **Step 5** — Add `expense_overview: 'period'` to `SECTION_SCOPE` in [data-fetcher.ts](../../apps/dashboard/src/lib/ai-insight/data-fetcher.ts)
- [ ] **Step 6** — Add `expense_overview: 'aggregate_only'` to `SECTION_POLICY` in [tool-policy.ts](../../apps/dashboard/src/lib/ai-insight/tool-policy.ts). Add `pc_expense_monthly` to `AGGREGATE_LOCAL_TABLES` and to `LOCAL_WHITELIST` in [tools.ts](../../apps/dashboard/src/lib/ai-insight/tools.ts).
- [ ] **Step 7** — Insert `<InsightSectionHeader page="expenses" sectionKey="expense_overview" ... />` above the KPI cluster in [DashboardShell.tsx](../../apps/dashboard/src/components/expenses/dashboard/DashboardShell.tsx).
- [ ] **Step 7b** — Per §7.9, wire per-component `AnalyzeIcon` + add 7 `COMPONENT_INFO` entries.
- [ ] **Step 8** — Write truth queries to `_bmad-output/planning-artifacts/truth-queries/expense-overview.sql` (deferred to Phase B)
- [ ] **Step 9** — `tsc --noEmit` clean; Playwright spot-check in debug mode (no live Anthropic call). Commit with message `feat: AI insight v2 — expense overview section`.
- [ ] **Step 10 (deferred)** — Live LLM verification pending Phase B / Anthropic credits.

### 7.9 Per-Component Analyze Icons (MANDATORY — per §1.9)

Seven icons to add:

- [ ] **§7.9.1** — Add 7 entries to `COMPONENT_INFO` in [component-info.ts](../../apps/dashboard/src/lib/ai-insight/component-info.ts): `ex_total_costs`, `ex_cogs`, `ex_opex`, `ex_yoy_costs`, `ex_cost_trend`, `ex_cost_composition`, `ex_top_expenses` — each with `name`, `whatItMeasures`, `formula` where relevant, `indicator`, `about`.
- [ ] **§7.9.2** — [KpiCards.tsx](../../apps/dashboard/src/components/expenses/dashboard/KpiCards.tsx): add `componentKey` prop to `KpiCard` and render `<AnalyzeIcon sectionKey="expense_overview" componentKey={componentKey} />` inline with `<CardTitle>` via a `flex items-center gap-1` container. Each of the 4 cards passes its component key.
- [ ] **§7.9.3** — [CostTrendChart.tsx](../../apps/dashboard/src/components/expenses/dashboard/CostTrendChart.tsx): the chart uses a bare `<div class="font-semibold text-sm">` title, not a Card. Wrap that div in `flex items-center gap-2` and add icon with `componentKey="ex_cost_trend"`.
- [ ] **§7.9.4** — [CostCompositionChart.tsx](../../apps/dashboard/src/components/expenses/dashboard/CostCompositionChart.tsx): same bare-title pattern — wrap in `flex items-center gap-2` and add icon with `componentKey="ex_cost_composition"`.
- [ ] **§7.9.5** — [TopExpensesChart.tsx](../../apps/dashboard/src/components/expenses/dashboard/TopExpensesChart.tsx): header already uses `justify-between` with Card/CardHeader/CardTitle. Wrap `<CardTitle>` in a `flex items-center gap-2` container on the left; add icon with `componentKey="ex_top_expenses"`. The subtitle paragraph and right-side toggle clusters stay untouched.
- [ ] **§7.9.6** — Playwright spot-check: 7 icons render on the Expense Overview cluster, dialog opens on click, About section populated, AI Analysis area shows the pre-run placeholder.

**Page total after §7 ships:** 7 icons on the Expenses page (Section 2 `expense_breakdown` will add more in §8).

---

## Sections 6, 8–11

To be authored after Section 5 is signed off, implemented, and committed. Each subsequent section follows the same template as Sections 1–5 above — with the mandatory §X.9 per-component icons subsection.

**Pending spec authoring:**
- Section 6 — `return_unsettled`
- Section 8 — `expense_breakdown`
- Section 9 — `financial_overview` (introduces `fiscal_period` scope)
- Section 10 — `financial_pnl`
- Section 11 — `financial_balance_sheet`


See [ai-insight-v2-rollout-plan.md](./ai-insight-v2-rollout-plan.md) for the section tracker.
