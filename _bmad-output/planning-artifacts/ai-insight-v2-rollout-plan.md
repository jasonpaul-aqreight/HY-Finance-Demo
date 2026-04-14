# AI Insight Engine v2 — Roll-Out Plan

**Status:** Active
**Mode:** Phase A only (no live API calls — offline-verifiable work)
**Approach:** Spec-first, section-by-section. No PR batching.
**Quality bar:** [ai-insight-engine-spec.md](./ai-insight-engine-spec.md) (v1 spec — do not modify)

---

## Ground rules

1. **Author spec before code.** Each section gets a full v1-rigor spec entry (component inventory, prompts, data sources, column whitelists, thresholds, Appendix A/B rows) **before** any code is written.
2. **One section at a time.** User reviews and signs off on each section individually. No bundling.
3. **Spec → Implement → Commit → Next section.** Interleaved, not all-specs-first.
4. **Phase A only.** No live Anthropic calls. No "Analyze" button click-testing. No numeric-guard validation against real LLM output. Offline-verifiable work only:
   - Fetcher SQL runs cleanly
   - Truth queries documented
   - Prompts written blind (against the spec, not against a model)
   - Build/lint clean
5. **v1 implementation pattern = source of truth.** Mirror v1 §2 (inventory), §6 (prompts), §9 (data sources), §14 (playbook), Appendix A/B.

---

## Section tracker (11 sections)

Legend: ⬜ Not started · 🟡 Spec in progress · 🔵 Spec signed off · 🟢 Implemented · ✅ Committed

| # | Section Key | Page | Scope | Tool Policy | Status |
|---|-------------|------|-------|-------------|--------|
| 1 | `customer_margin_overview` | Customer Margin | period | aggregate_only | ✅ Shipped (offline verified — live LLM run deferred) |
| 2 | `customer_margin_breakdown` | Customer Margin | period | full | 🟡 Spec drafted — awaiting sign-off |
| 3 | `supplier_margin_overview` | Supplier Performance | period | aggregate_only | ⬜ |
| 4 | `supplier_margin_breakdown` | Supplier Performance | period | full | ⬜ |
| 5 | `return_trend` | Returns | period | aggregate_only | ⬜ |
| 6 | `return_unsettled` | Returns | snapshot | full | ⬜ |
| 7 | `expense_overview` | Expenses | period | aggregate_only | ⬜ |
| 8 | `expense_breakdown` | Expenses | period | full | ⬜ |
| 9 | `financial_overview` | Financial | **fiscal_period** (new) | aggregate_only | ⬜ |
| 10 | `financial_pnl` | Financial | **fiscal_period** | aggregate_only | ⬜ |
| 11 | `financial_balance_sheet` | Financial | **fiscal_period** | aggregate_only | ⬜ |

---

## Page notes

### Customer Margin (sections 1–2)
- **Components (10):** 5 KPIs (Net Sales, COGS, Gross Profit, Margin %, Active Customers), 3 charts (MarginTrendChart, MarginDistributionChart, TopCustomersChart), 2 tables (CustomerMarginTable, CreditNoteImpactTable)
- **Data source:** `pc_customer_margin`
- **Filters:** date range, customer, type, agent, product group
- **Known upstream anomaly:** `iv_cost` field has a flagged data-quality issue. **Do not fix — document** in the spec and in the prompt as a caveat.

### Supplier Performance (sections 3–4)
- **Components (11):** 5 KPIs (Revenue, COGS, Profit, Margin %, Top Supplier KPI), 4 charts (MarginTrendChart, SupplierMarginDistributionChart, TopBottomChart, PriceScatterChart), 2 tables (SupplierTable, ItemPricingPanel)
- **Data source:** `pc_supplier_margin`
- **Filters:** date range, supplier, product group, buyer
- **Open question before spec:** previous session dropped `sp_top_supplier_kpi` as "invisible." New session must verify whether that KPI is visible and load-bearing before deciding to include/exclude it in the spec.

### Returns (sections 5–6) — hybrid, mirrors Payment v1 pattern
- **Section 5 (period-filtered, 8 components):** 5 KPIs (Total Value, Count, Knocked Off, Refunded, Unresolved) + 3 charts (SettlementBreakdown, MonthlyTrendChart, ProductBarChart)
- **Section 6 (snapshot, 2 components):** AgingChart + TopDebtorsTable
- **Data sources:** `pc_return_monthly` + `pc_sales_daily`

### Expenses (sections 7–8)
- **Components (8):** 3 KPIs (Total Costs, COGS, OpEx), 3 charts (CostTrendChart, CostCompositionChart, TopExpensesChart w/ cost-type toggle), 2 tables (CogsBreakdownTable, OpexBreakdownTable, tabbed)
- **Data source:** `gl_account_balance` (expense categories)
- **Filters:** date range, cost type toggle

### Financial (sections 9–11) — introduces `fiscal_period` scope
- **Section 9 — Overview:** 6 KPI cards + MonthlyPLTrendV3
- **Section 10 — P&L:** PLStatementTableV3 + YoYComparisonV3
- **Section 11 — Balance Sheet:** BSTrendChartV3 + BSStatementTableV3
- **Data source:** `pc_pnl_period`
- **Scope: `fiscal_period` (NEW)** — uses `fiscalYear` + optional month range, not `{start, end}`. Requires small core edits in `types.ts` + `data-fetcher.ts` scope label.
- **Reference implementation:** [DashboardShellV3.tsx:23,48,51,55,59,64-65](../../apps/dashboard/src/components/pnl/dashboard-v3/DashboardShellV3.tsx)

---

## Spec authoring target

**Decided:** new file [ai-insight-v2-spec.md](./ai-insight-v2-spec.md) sits alongside the v1 spec. v1 remains pristine as the quality bar. v2 inherits all cross-cutting concerns (see v2 §0) and only specifies what is section-specific.

---

## Session constraints (enforce every section)

- **Simple English, short and brief**
- **Confirm before implementing**
- **Ask about commit after each section**
- **No API budget** — no live Anthropic calls suggested, ever
- **Section-by-section** — user follows along step by step

---

## Progress log

| Date | Section | Event |
|------|---------|-------|
| 2026-04-14 | — | Rollout plan initialized. Reset from previous code-first session. 7 files reverted. |
| 2026-04-14 | — | Spec target decided: new file `ai-insight-v2-spec.md` (Option B). |
| 2026-04-14 | 1 | Section 1 (`customer_margin_overview`) spec drafted at v1 rigor. Awaiting user sign-off. |
| 2026-04-14 | 1 | Section 1 spec approved. Implementation complete: 9-step playbook applied. Build + tsc clean. Awaiting commit. |
| 2026-04-14 | 1 | First Playwright test revealed missing per-component analyze icons (§4.3 of v1 spec). Spec §1.9 added to document the pattern so sections 2–11 inherit it. |
| 2026-04-14 | 1 | Added 7 `COMPONENT_INFO` entries; wired `AnalyzeIcon` into `KpiCards.tsx`, `MarginTrendChart.tsx`, `MarginDistributionChart.tsx`. tsc clean. |
| 2026-04-14 | 1 | Playwright re-verified: 7 icons at expected positions, ComponentInsightDialog opens with About section populated, Analyze click reaches Anthropic API through full orchestration pipeline. Live LLM run blocked on `400 — credit balance too low` (request_id `req_011Ca2xts2A1d56NVyGfVRBF`). |
| 2026-04-14 | 1 | Section 1 shipped. Status → ✅. Live LLM verification deferred until API credits are available. |
| 2026-04-14 | 2 | Section 2 (`customer_margin_breakdown`) spec drafted at v1 rigor with §2.9 per-component icons checklist. 3 components. Tool policy `full`. Awaiting user sign-off. |
