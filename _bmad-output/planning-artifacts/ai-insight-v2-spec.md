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

## Appendix A addendum (section key reference) — updated

| Section Key | Page | Section Name | Date Filtered |
|-------------|------|-------------|---------------|
| `customer_margin_overview` | Customer Margin | Customer Margin Overview | Yes (period) |
| `customer_margin_breakdown` | Customer Margin | Customer Margin Breakdown | Yes (period) |

---

## Appendix B addendum (estimated cost model) — updated

| Section | Components | Est. Tokens | Est. Cost (Haiku+Sonnet) | Observed |
|---------|-----------|-------------|--------------------------|----------|
| Customer Margin Overview | 7 + summary | ~22,000 | ~$0.10 | Deferred to Phase B |
| Customer Margin Breakdown | 3 + summary | ~18,000 | ~$0.09 | Deferred to Phase B |

**Estimation basis for breakdown:** 3 component calls at ~3,000 tokens each (richer prompts with 20-row top/bottom tables per component) + 1 summary call at ~9,000 tokens (Sonnet, with up to 2 tool calls for RDS drill-down). Pattern scales from v1 Sales Breakdown (4 × ~16,000 tokens, $0.07 estimated).

---

## Sections 3–11

To be authored after Section 2 is signed off, implemented, and committed. Each subsequent section follows the same template as Sections 1 and 2 above — with the mandatory §X.9 per-component icons subsection.

**Pending spec authoring:**
- Section 3 — `supplier_margin_overview`
- Section 4 — `supplier_margin_breakdown`
- Section 5 — `return_trend`
- Section 6 — `return_unsettled`
- Section 7 — `expense_overview`
- Section 8 — `expense_breakdown`
- Section 9 — `financial_overview` (introduces `fiscal_period` scope)
- Section 10 — `financial_pnl`
- Section 11 — `financial_balance_sheet`

See [ai-insight-v2-rollout-plan.md](./ai-insight-v2-rollout-plan.md) for the section tracker.
