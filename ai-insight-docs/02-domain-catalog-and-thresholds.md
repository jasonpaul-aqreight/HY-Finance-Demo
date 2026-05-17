# 02 — Domain Catalog & Thresholds

> **Classification:** Domain Pack
> **Enables:** The page→section→component catalog plus the threshold registry, token dictionary, and renderer.
> **Read after:** 00, 01

---

## 1. Purpose

This layer is the **Domain Pack's static knowledge**: the complete catalog of what the engine analyses (pages → sections → components, with each component's human-readable metadata), and the **threshold system** that makes the numeric judgement boundaries editable without touching prompt prose.

It owns two things:

1. **The catalog** — every page, the sections on it, the components in each section, and per-component descriptive metadata (name, what it measures, formula, indicator bands, "about" text).
2. **The threshold system** — a *registry* declaring every configurable numeric token (type, range, default, monotonic grouping), a *token dictionary* binding those tokens to their persisted values, and a *renderer* that substitutes `{{component_key.token}}` placeholders in any text with the live value.

After this document you can build the finance catalog and the full threshold registry/renderer, and a developer writing the prompts (doc 04) can rely on every token defined here.

## 2. Prerequisites

- **Doc 00** — vocabulary (Page, Section, Component, Scope, Threshold token, Domain Pack); the ENV rows `AI_INSIGHT_THRESHOLDS_USE_DEFAULTS`, `AI_INSIGHT_THRESHOLD_TEST_OVERRIDES`, `NODE_ENV`.
- **Doc 01** — the engine-owned database and its pool. The threshold values table lives in that same engine-owned store; this document owns its schema.

This is a **Domain Pack** document: §5 onward is finance-specific by design and is the worked example doc 10 generalises. The *mechanism* in §3 is domain-neutral and reusable.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the catalog + threshold idea.*

A Domain Pack contributes two static artefacts to the generic engine:

**A. The catalog** — a pure declaration, no behavior:

- A set of **pages**. Each page owns an ordered set of **sections**. Each section owns an ordered set of **components**. Each component has a stable `key`, a display `name`, and a `type` from a fixed enum (`kpi | chart | table | breakdown`).
- Per-component **metadata**: what it measures, its formula, its indicator bands, and a longer "about" description. Metadata text may embed **threshold tokens**.
- The catalog is the domain's contract with the engine: the engine iterates it; it does not know finance.

**B. The threshold system**

- **Registry** — for each component, a list of **groups**; each group is an ordered list of **tokens**. A token declares: a name, a label, a `unit`, a `valueType` (`int` or `decimal(p)`), a `defaultValue`, and a `[min, max]`. A group declares a `direction` (`ascending` / `descending`) and whether its tokens must stay **monotonic**.
- **Token dictionary** — the resolved value for every `component.token`, produced by overlaying, in order: (1) registry defaults, (2) persisted overrides, (3) test overrides. Cached with a short TTL.
- **Renderer** — given any text, replace every `{{component_key.token}}` occurrence with the token's *formatted* live value. Unknown placeholders are left untouched.

**Invariants**

1. **Prose is fixed; only tokens vary.** Editing a threshold value must never require editing prompt or metadata text.
2. **Registry defaults equal seed values.** The hardcoded `defaultValue` for a token and its persisted seed row must be identical, so "no overrides" and "fresh database" are indistinguishable.
3. **A token has exactly one definition.** Identified globally by `component_key.token`.
4. **Resolution never throws.** A missing values table, a bad override blob, or an absent row degrades to the registry default — never an error into a caller.
5. **Monotonic groups stay ordered.** A save that would break a group's declared ordering is rejected before persistence.
6. **Only declared numbers are configurable.** Anything not a registry token — qualitative direction, bucket definitions, formulas, prompt structure, scope windows — is *not* tunable through this system (see §6).

**Boundary:** the catalog is consumed by generation (doc 04, which writes the prompts) and the frontend/admin (docs 07/08). The renderer is consumed wherever tokenised text is surfaced. The values table is persisted in the engine store (doc 01) but its schema is owned here.

## 4. Data contracts

### 4.1 Owned — the catalog shape

```
ComponentType = 'kpi' | 'chart' | 'table' | 'breakdown'

SECTION_COMPONENTS : Record<SectionKey, { key: string; name: string; type: ComponentType }[]>
SECTION_PAGE       : Record<SectionKey, string>   // human page label, e.g. "Customer Margin"
SECTION_NAMES      : Record<SectionKey, string>   // human section label

ComponentInfo = {
  name:           string
  whatItMeasures: string            // may contain {{component.token}}
  formula?:       string            // may contain {{component.token}}
  indicator?:     string            // may contain {{component.token}}
  about?:         string            // may contain {{component.token}}
}
COMPONENT_INFO_SOURCE : Record<componentKey, ComponentInfo>   // pre-substitution source
```

> `SECTION_PAGE` carries a **human page label** (`"Customer Margin"`, `"Supplier Performance"`, `"Returns"`), *not* the machine `PageKey` from doc 01's types. They are deliberately different surfaces — never use one where the other is expected.

### 4.2 Owned — the threshold registry types

```
ThresholdUnit      = 'days' | 'pct' | 'RM' | 'count' | 'ratio'
ThresholdDirection = 'ascending' | 'descending'
ThresholdValueType = 'int' | `decimal(${number})`

ThresholdTokenDefinition = {
  token: string                 // bare name, unique within its component
  label: string                 // admin-facing label
  unit: ThresholdUnit
  valueType: ThresholdValueType
  defaultValue: number          // MUST equal the seed row value
  min: number
  max: number
  allowPctAbove100?: boolean    // pct tokens otherwise clamp 0..100
  description?: string
}
ThresholdGroupDefinition = {
  id: string
  label: string
  direction: ThresholdDirection
  tokens: ThresholdTokenDefinition[]
  enforceMonotonic?: boolean     // default true
  description?: string
}
ThresholdComponentDefinition = { componentKey: string; groups: ThresholdGroupDefinition[] }

THRESHOLD_REGISTRY : ThresholdComponentDefinition[]
```

A token's **global identity** is `snapshotKey = `${componentKey}.${token}``. That is also the placeholder spelling: `{{componentKey.token}}`.

### 4.3 Owned — the threshold values table (engine-owned store)

```sql
CREATE TABLE IF NOT EXISTS ai_insight_thresholds (
  component_key TEXT NOT NULL,
  token         TEXT NOT NULL,
  value         NUMERIC NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    TEXT,
  PRIMARY KEY (component_key, token)
);
```

Seed rows are inserted `ON CONFLICT (component_key, token) DO NOTHING`; the seed values **are** the registry defaults (invariant 2). The canonical seed list is in §7.

### 4.4 Consumed

- `SectionKey`, `PageKey`, `AllowedValue`, `AllowedValueUnit` — defined in doc 01's shared types.
- The engine pool (`getPool`) — doc 01.

### 4.5 Produced for other layers

- `getThresholdValues(componentKey) → Record<token, number>` and `renderThresholdText(text, _) → string` — consumed by generation (doc 04) and the rendered-metadata path.
- `allowedThresholds(componentKey) → AllowedValue[]` — consumed by doc 04's numeric guard.
- `getThresholdGroups` / `validateThresholdValues` / `saveThresholdValues` — consumed by the admin surface (doc 08).
- `listThresholdSeedRows()` — flattened registry defaults, used to seed/repair the table.

## 5. Behavior & flow

> Finance-specific from here. `[VERSION-SENSITIVE]` flags stack assumptions.

### 5.1 The finance catalog (shape and size)

The catalog declares **7 finance pages** and **16 batch-active sections** holding **69 components**. The sections, in catalog order, with scope kind (scope columns specified in doc 01 §5.6):

| Page (label) | Section key | Components | Scope kind |
|---|---|---|---|
| Sales | `sales_trend` | 5 | range |
| Sales | `sales_breakdown` | 4 | range |
| Payment | `payment_collection_trend` | 5 | range |
| Payment | `payment_outstanding` | 6 | snapshot |
| Financial | `financial_overview` | 2 | fiscal |
| Financial | `financial_variance` | 4 | fiscal |
| Financial | `financial_balance_sheet` | 2 | fiscal |
| Financial | `financial_pnl` | 2 | fiscal |
| Customer Margin | `customer_margin_overview` | 7 | range |
| Customer Margin | `customer_margin_breakdown` | 3 | range |
| Supplier Performance | `supplier_margin_overview` | 7 | range |
| Supplier Performance | `supplier_margin_breakdown` | 4 | range |
| Returns | `return_trend` | 7 | range |
| Returns | `return_unsettled` | 2 | snapshot |
| Expenses | `expense_overview` | 7 | range |
| Expenses | `expense_breakdown` | 2 | range |

Five HR sections (`employee_demographics`, `attendance_leave`, `overtime_work_hours`, `payroll_compensation`, `performance_talent`) exist in the type system as **empty scaffolds** — no components, not in the batch set, not generated. They are the seam doc 10 uses to add a domain.

Component types observed: `kpi` (single number with a band), `chart` (trend/distribution), `table` (row-level detail), `breakdown` (dimensional split). The type drives nothing in this layer except display; generation (doc 04) keys prompts off the component `key`.

### 5.2 Per-component metadata

`COMPONENT_INFO_SOURCE[componentKey]` is the *source* (token-bearing) metadata. Worked example:

```
avg_collection_days:
  name:           'Average Collection Days'
  whatItMeasures: 'The average number of days it takes to collect payment after invoicing.'
  formula:        '(AR Outstanding at month-end ÷ Monthly Credit Sales) × Days in that month …'
  indicator:      '≤{{avg_collection_days.good_days}} days = Good (green)\n
                   ≤{{avg_collection_days.warning_days}} days = Warning (yellow)\n
                   >{{avg_collection_days.warning_days}} days = Critical (red)'
  about:          '… ≤{{avg_collection_days.good_days}} days = Good ·
                   ≤{{avg_collection_days.warning_days}} days = Warning ·
                   >{{avg_collection_days.warning_days}} days = Critical'
```

Only the numeric band edges are tokens. The *words* ("Good", "Warning", the direction of the comparison) are fixed prose (invariant 1, exclusion §6).

`getRenderedComponentInfo(componentKey)` returns the same shape with `whatItMeasures`, `formula`, `indicator`, `about` each passed through the renderer; `whatItMeasures` falls back to its raw value if rendering yields empty. A component absent from the source map returns `null`.

### 5.3 Threshold value resolution

A single in-memory **snapshot** (`Map<"component.token", number>`) is produced by `loadSnapshot()`:

```
1. base ← every registry token's defaultValue                    (defaults layer)
2. if ENV AI_INSIGHT_THRESHOLDS_USE_DEFAULTS == '1':
       applyTestOverrides(base); return base                     (DB bypassed)
3. try:
       rows ← SELECT component_key, token, value::text
                FROM ai_insight_thresholds                        (engine pool)
       for each row mapping to a known token:
           base[component.token] ← coerce(row.value)              (persisted layer)
   catch e:
       if e.code != '42P01' (undefined_table): warn               (missing table is silent)
       (keep defaults)
4. applyTestOverrides(base)                                        (test layer)
5. return base
```

`applyTestOverrides` runs **only** when `NODE_ENV === 'test'` *or* `AI_INSIGHT_THRESHOLDS_USE_DEFAULTS === '1'`; it parses `AI_INSIGHT_THRESHOLD_TEST_OVERRIDES` as JSON `{ componentKey: { token: value } }` and overlays known tokens; an unparseable blob is warned and ignored. `coerce`: non-finite → the token's default; `int` → `Math.trunc`; `decimal(p)` → `toFixed(p)` as number.

**Caching:** the snapshot has a **30 000 ms TTL** and is loaded **single-flight** (concurrent callers share one in-flight promise). `invalidateThresholdCache()` drops it immediately and is called after any save. `[VERSION-SENSITIVE]` — reference uses a module-level singleton in a long-lived Node server; a serverless/multi-process runtime must give each process its own short-lived cache (correctness holds; only cache-hit rate differs).

### 5.4 The renderer

`renderThresholdText(text, componentKey)` — **the `componentKey` argument is intentionally ignored**; substitution is global:

```
snapshot ← getSnapshot()
rendered ← text
for each component C in THRESHOLD_REGISTRY:
  for each group G in C.groups:
    for each token T in G.tokens:
      v ← snapshot["C.componentKey.T.token"]  (or T.defaultValue)
      rendered ← rendered.replaceAll("{{C.componentKey.T.token}}",
                                     formatThresholdValue(T, v))
return rendered
```

`formatThresholdValue`: `int` → `String(Math.trunc(v))`; `decimal(p)` → `v.toFixed(p)`. A placeholder whose `component.token` is not in the registry is left verbatim (no throw, no blanking) — this is the safety net for typos and forward references.

### 5.5 Reads, validation, save

- `getThresholdGroups(componentKey)` → groups with each token's live `value` + `formattedValue` (admin/UI view).
- `getThresholdValues(componentKey)` → `{ token: value }` (generation input).
- `allowedThresholds(componentKey)` → `AllowedValue[]` (`label = "component.token"`, `value`, `unit`) for doc 04's numeric guard.
- `classifyThresholdValue(componentKey, groupId, value)` → which band a runtime value falls into, honouring the group's `direction`.
- `validateThresholdValues(componentKey, incoming)` → `{ ok, errors[], values }`:
  - unknown component or unknown token → error;
  - per token: numeric; integer if `int`; `pct` within `0..100` unless `allowPctAbove100`; within `[min,max]`;
  - **monotonic check** per group with ≥2 tokens and `enforceMonotonic !== false`: `ascending` ⇒ each token strictly greater than the next; `descending` ⇒ strictly less than the next; presentation constraints may override the relation/message;
  - missing incoming tokens are filled from the current snapshot/defaults before checking.
- `saveThresholdValues(componentKey, incoming, updatedBy)` → validate; if ok, one `INSERT … VALUES … ON CONFLICT (component_key, token) DO UPDATE SET value, updated_by, updated_at = NOW()` for **all** of the component's tokens, then `invalidateThresholdCache()`.

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Token referenced in text but absent from registry | Leave `{{…}}` verbatim; never throw or blank | Tolerate typos/forward refs; a broken band edge must not corrupt prose. |
| 2 | `ai_insight_thresholds` table missing (`42P01`) | Silently use registry defaults | Defaults == seeds; a fresh DB must behave identically to a seeded one. |
| 3 | Any other DB error during load | Warn once, use defaults | Resolution never throws (invariant 4). |
| 4 | Invalid `AI_INSIGHT_THRESHOLD_TEST_OVERRIDES` JSON | Warn, ignore the blob entirely | A bad test fixture must not poison production-shaped resolution. |
| 5 | Override JSON references an unknown `component.token` | Skip that entry | Registry is the single source of valid identities. |
| 6 | Save would break a group's monotonic ordering | Reject with a specific error; persist nothing | Invariant 5 — bands that cross over make classification meaningless. |
| 7 | `pct` token, `allowPctAbove100` unset, value <0 or >100 | Validation error | Percentages are bounded unless explicitly declared otherwise (e.g. credit-usage "over limit"). |
| 8 | Registry `defaultValue` ≠ seed row value | **Build error** — they must be reconciled | Invariant 2; divergence makes "no override" ambiguous. |
| 9 | Concurrent first reads after cache expiry | One shared in-flight load; all callers get the same snapshot | Avoid a thundering-herd of identical DB reads. |
| 10 | Value edited via admin | Cache invalidated immediately so the next render is fresh | Stale bands would contradict the just-saved config. |
| 11 | HR (empty) section encountered | No components, nothing to render or seed | Scaffold only; activated by a future Domain Pack (doc 10). |

### 6.1 Hard-exclusion list — what is **not** configurable

These are intentionally **fixed in code/prose** and have no token. A production rebuild must not "helpfully" tokenise them:

- **Qualitative direction & verdict words** — "Rising trend = bad", "Most customers within limit = healthy", the labels "Good/Warning/Critical". Only the numeric edge is a token.
- **Bucket / band *structure*** — e.g. the six AR aging buckets (Not Yet Due, 1–30, 31–60, 61–90, 91–120, 120+); the *boundaries* of these buckets are fixed.
- **Formulas** — the arithmetic in `formula`/`whatItMeasures` is descriptive prose, not a tunable.
- **Catalog topology** — which pages/sections/components exist and their `type`.
- **Prompt structure** — system prompts, assembly, tool budget (doc 04).
- **Scope windows** — trailing-12-month month alignment, fiscal-year selection (doc 01 §5.6 / batch scope).
- **Components with no registry entry** (e.g. pure narrative tables) — no tokens, evaluated qualitatively by the model.

### 6.2 External data dependencies (read-only, not owned by AI Insight)

The threshold registry above covers **prompt-side numeric tokens** the engine owns and the admin edits inline. Two other categories of configuration flow into AI Insight differently — they arrive in the **fetcher's data block**, not via `renderThresholdText`. The engine reads them; it does not own their UI, table, or CRUD. A dev rebuilding AI Insight must not re-implement these as thresholds.

| Category | Source | Consumed by | Ownership |
|---|---|---|---|
| **Credit-score formula + risk-tier thresholds** | `app_settings` row with `key = 'credit_score_v2'` (JSONB: `{ creditScoreWeights:{utilization,overdueDays,timeliness,doubleBreach}, riskThresholds:{low,high} }`) | The precompute job that maintains `pc_ar_customer_snapshot.credit_score` / `risk_tier`. AI Insight reads the already-resolved tier/score as authoritative. | Built upstream (already in production). AI Insight rebuilds **must not** re-implement the formula and **must not** ship a new editor. |
| **Annual budget + tolerance per P&L line** | `budget_global` table (`line_item PK, monthly_budget, annual_budget, tolerance_pct, approved_by, note, updated_at`) | `financial_variance` fetchers (`fv_variance_summary`, `fv_budget_suggestions`, `fv_trend_forecast`); also the Variance KPI surface. | A Domain Pack settings UI — specced in **doc 12** for the production build (not yet in prod). |

**Implication for prompt authors (doc 04a).** When a fetcher emits a value derived from one of these external configs, treat it as **evidence data**, not a tunable threshold. Specifically:

- Do **not** add `credit_score_v2` weights or `risk_tier` cutoffs to the threshold registry. The `customer_credit_health` component prompt already says *"treat resolved `risk_tier`/`credit_score` as authoritative — do not reverse-engineer the formula"* (see [04a §5](04a-prompt-catalog.md#5-catalog-entries)).
- Do **not** add per-line budget values or per-line tolerance % to the threshold registry. They live in `budget_global`, are edited via the Budget Setting dialog (doc 12), and arrive in the prompt as part of the variance fetchers' raw data block. The token system has no way to express *"tolerance per line item"* — that is a per-row attribute, not a global constant.

**Distinction in one line.** Threshold tokens are *global numeric judgement boundaries the AI Insight admin edits inline*; external dependencies are *upstream business data with their own editors* whose values flow in as part of the prompt's evidence, not its rubric.

## 7. Reference Implementation

Source paths are evidence for the spec above, not a replacement.

- **Catalog — `apps/dashboard/src/lib/ai-insight/prompts.ts`**: `SECTION_COMPONENTS`, `SECTION_PAGE`, `SECTION_NAMES`.
- **Component metadata — `apps/dashboard/src/lib/ai-insight/component-info.ts`**: `interface ComponentInfo`, `COMPONENT_INFO_SOURCE` (pre-substitution source map).
- **Rendered metadata — `apps/dashboard/src/lib/ai-insight/component-info-renderer.ts`**: `getRenderedComponentInfo(componentKey)`.
- **Threshold system — `apps/dashboard/src/lib/ai-insight/threshold-config.ts`**: types (`ThresholdTokenDefinition`, `ThresholdGroupDefinition`, `ThresholdComponentDefinition`, the `*View` types); `THRESHOLD_REGISTRY`; helpers `snapshotKey`, `coerceThresholdValue`, `formatThresholdValue`, `defaultSnapshot`, `loadSnapshot`, `applyTestOverrides`, `getSnapshot` (30 s TTL, single-flight), `invalidateThresholdCache`; public `getThresholdComponent`, `getThresholdPresentation`, `listThresholdSeedRows`, `getThresholdGroups`, `getThresholdValues`, `renderThresholdText`, `allowedThresholds`, `classifyThresholdValue`, `validateThresholdValues`, `saveThresholdValues`.
- **Values table + seed — `migrations/025_ai_insight_thresholds.sql`**: the `ai_insight_thresholds` DDL (§4.3) and the canonical seed list below.

Registry construction pattern (factory helpers keep defaults and metadata co-located):

```ts
component('avg_collection_days', [
  group('collection_days_band', 'Collection days band', 'descending', [
    intToken('good_days',    'Good at or below',    'days', 30, 0, 365),
    intToken('warning_days', 'Warning at or below', 'days', 60, 1, 365),
  ]),
]),
component('collection_rate', [
  group('collection_rate_band', 'Collection rate band', 'ascending', [
    intToken('good_pct',    'Good at or above',    'pct', 80, 0, 100),
    intToken('warning_pct', 'Warning at or above', 'pct', 50, 0, 100),
  ]),
]),
```

**Canonical token dictionary (authoritative `component_key · token · default`).** Registry `defaultValue`s must equal these exactly (invariant 2). Units/ranges come from the registry token definitions:

```
avg_collection_days.good_days=30  warning_days=60
collection_rate.good_pct=80  warning_pct=50
collection_days_trend.critical_spike_days=60
overdue_amount.acceptable_pct=20  critical_pct=40
credit_limit_breaches.good_count=0
aging_analysis.old_120_share_pct=30
credit_usage_distribution.within_limit_pct=80  over_limit_pct=100
net_sales.invoice_share_normal_pct=90  credit_note_good_pct=1  credit_note_monitor_pct=3
invoice_sales.normal_share_pct=90
credit_notes.good_pct=1  monitor_pct=3
net_sales_trend.consecutive_months=3  period_average_variance_pct=20
by_customer.good_pct=15  neutral_pct=25  peak_season_bad_pct=30
by_product.good_pct=20  neutral_pct=35
by_agent.decline_flag_pct=10
by_outlet.good_pct=50
cm_net_sales.good_growth_pct=5  flag_decline_pct=10
cm_cogs.typical_min_pct=80  typical_max_pct=90
cm_margin_pct.good_pct=15  neutral_pct=10
cm_margin_trend.growth_months=3  profit_decline_months=3  margin_decline_months=2
cm_margin_distribution.sub_10_bad_pct=40  premium_good_pct=15
cm_top_customers.top_1_bad_pct=15  top_10_bad_pct=60  top_10_good_pct=40  thin_margin_pct=10  top_margin_revenue_floor_rm=10000  niche_premium_revenue_rm=50000
cm_customer_table.loss_makers_bad_pct=10  critical_revenue_rm=100000  thin_bucket_pct=10
cm_credit_note_impact.top_5_margin_lost_bad_pct=50  return_rate_bad_pct=10  margin_lost_severe_pp=10  acceptable_margin_lost_pp=2  normal_return_rate_pct=3  systemic_return_rate_pct=5
sp_net_sales.good_growth_pct=5  flag_drop_pct=10
sp_margin_pct.good_pct=15  neutral_pct=10  investigate_drop_pp=2
sp_active_suppliers.normal_change_pct=5  drop_flag_pct=10  growth_flag_pct=15
sp_margin_trend.growth_months=3  profit_decline_months=3  margin_decline_months=2
sp_margin_distribution.sub_10_bad_pct=40  premium_good_pct=15
sm_top_bottom.top_1_bad_pct=15  top_10_bad_pct=60  top_10_good_pct=40  loss_profit_rm=0
sm_supplier_table.top_10_bad_pct=60  top_10_neutral_pct=40  loss_margin_pct=0  thin_margin_pct=5  thin_active_bad_pct=10  critical_revenue_rm=100000
sm_item_pricing.arbitrage_spread_pp=10  loss_margin_pct=0  best_price_volume_good_pct=50  best_price_volume_flag_pct=20
sm_price_scatter.loss_margin_pct=0  thin_universe_bad_pct=20  premium_universe_good_pct=10  severe_revenue_rm=100000
rt_total_returns.healthy_pct=2  concern_pct=5
rt_settled.knock_off_healthy_pct=70  refund_concern_pct=30
rt_unsettled.healthy_pct=15  concern_pct=30
rt_return_pct.healthy_pct=2  concern_pct=5
rt_settlement_breakdown.knock_off_healthy_pct=70  refund_concern_pct=30  unsettled_concern_pct=30  knock_off_low_pct=50
rt_monthly_trend.mom_concern_pct=25
rt_product_bar.top_1_severe_pct=15  top_10_concentrated_pct=60  top_10_diversified_pct=40
ru_aging_chart.old_91_watch_pct=25  old_180_writeoff_pct=10
ru_debtors_table.top_1_risk_pct=15  top_10_concentrated_pct=60
ex_total_costs.healthy_below_pct=0  watch_pct=5  concern_pct=10  cogs_typical_min_pct=60  cogs_typical_max_pct=80  cogs_dominated_pct=85  opex_dominated_pct=50
ex_cogs.typical_min_pct=60  typical_max_pct=80  margin_pressure_pct=85  concern_pct=15
ex_opex.concern_pct=10  healthy_below_pct=0  opex_dominated_pct=50
ex_yoy_costs.healthy_below_pct=0  watch_pct=5  concern_pct=10
ex_cost_trend.mom_concern_pct=15  mom_severe_pct=25  period_yoy_severe_pct=10
ex_cost_composition.typical_min_pct=60  typical_max_pct=80  cogs_dominated_pct=85  opex_dominated_pct=50  material_drift_pp=3
ex_top_expenses.top_1_severe_pct=30  top_1_concentrated_pct=15  top_10_concentrated_pct=75  top_10_diversified_pct=50
ex_cogs_table.top_1_severe_pct=50  top_1_concentrated_pct=30  top_1_diversified_pct=15  top_3_concentrated_pct=80  top_3_diversified_pct=55  thin_account_count=5
ex_opex_table.top_category_dominant_pct=50  top_category_typical_pct=30  top_category_diversified_pct=20  top_1_account_risk_pct=20  top_3_accounts_concentrated_pct=50
fin_pnl_summary.gross_typical_below_pct=25  gross_watch_below_pct=20  gross_severe_below_pct=15  opex_lean_below_pct=10  opex_typical_below_pct=18  opex_elevated_below_pct=25  operating_healthy_below_pct=10  operating_thin_below_pct=5  operating_severe_below_pct=0  net_healthy_below_pct=7  net_thin_below_pct=3  net_severe_below_pct=0  typical_min_pct=60  typical_max_pct=80  margin_pressure_pct=85
fin_monthly_trend.concern_pct=30  severe_pct=25
fin_pl_statement.flat_pct=5  material_pct=15  gross_material_pp=3  gross_severe_pp=5  net_material_pp=2  net_severe_pp=3
fin_yoy_comparison.growing_upper_pct=15  flat_upper_pct=5  declining_below_pct=-5  streak_years=3  gross_material_pp=3  net_material_pp=2
bs_trend.growing_upper_pct=15  flat_upper_pct=5  shrinking_below_pct=-5  material_pct=10  severe_pct=20  material_pp=3  severe_pp=5  severe_months=3
bs_statement.flat_pct=5  material_pct=15  healthy_below_ratio=2  thin_below_ratio=1.2  severe_below_ratio=1  current_ratio_drift_material_ratio=0.3  conservative_below_ratio=0.5  typical_below_ratio=1  leveraged_below_ratio=2  debt_to_equity_drift_material_ratio=0.3  healthy_below_pct=60  thin_below_pct=40  severe_below_pct=20  drift_material_pp=5
```

(`pp` = percentage points, `rm` = ringgit, `ratio` = decimal ratio; these map to registry `unit`/`valueType` — e.g. `bs_statement.thin_below_ratio` is `decimal(1)`, most others `int`.)

## 8. Verification checkpoint

**Setup.** Apply doc 01's schema, then `psql "$DATABASE_URL" -f migrations/025_ai_insight_thresholds.sql`. Confirm `ai_insight_thresholds` has one row per token in §7 and every value matches.

**Check A — defaults == seeds.** Build `listThresholdSeedRows()` from the registry and full-join it to `SELECT component_key, token, value FROM ai_insight_thresholds`. Expect a perfect 1:1 match on `(component_key, token, value)` — zero rows only on one side, zero value mismatches (invariant 2 / rule 8).

**Check B — render substitution.** Call `renderThresholdText('≤{{avg_collection_days.good_days}} days = Good · ≤{{avg_collection_days.warning_days}} days = Warning', 'anything')`. Expect `≤30 days = Good · ≤60 days = Warning`. Pass a deliberately wrong placeholder `{{avg_collection_days.nope}}` → it survives verbatim (rule 1).

**Check C — resolution precedence & fail-soft.** With `AI_INSIGHT_THRESHOLDS_USE_DEFAULTS=1` and `AI_INSIGHT_THRESHOLD_TEST_OVERRIDES={"avg_collection_days":{"good_days":25}}`, `getThresholdValues('avg_collection_days')` → `{ good_days: 25, warning_days: 60 }`. Drop the table and repeat without the env vars → values fall back to registry defaults with no thrown error (rules 2–3).

**Check D — validation.** `validateThresholdValues('collection_rate', { good_pct: 40, warning_pct: 50 })` → `ok:false` (ascending group requires `good_pct` > `warning_pct`; rule 6). `validateThresholdValues('collection_rate', { good_pct: 130 })` → `ok:false` (pct bound; rule 7). A valid pair → `ok:true` and `saveThresholdValues` persists all the component's tokens and invalidates the cache (the next `getThresholdValues` reflects the change within one call, not 30 s later — rule 10).

**Check E — catalog integrity.** Every `componentKey` appearing in `THRESHOLD_REGISTRY` exists in some `SECTION_COMPONENTS` entry; every HR section resolves to an empty component list and contributes no tokens (rule 11).

**Definition of Done:** a developer who has read only docs `00`–`02`, with no access to this repository's source, can build the finance catalog, the threshold registry/renderer/values table, and pass Checks A–E.
