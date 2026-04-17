# AI Insight Engine v2 — Roll-Out Plan

**Status:** ✅ COMPLETE (2026-04-15) — all 11 sections shipped under Phase A
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

Legend: ⬜ Not started · 🟡 Spec in progress · 🔵 Spec signed off · 🟢 Implemented · ✅ Done (committed; live LLM run deferred Phase B)

| # | Section Key | Page | Scope | Tool Policy | Status |
|---|-------------|------|-------|-------------|--------|
| 1 | `customer_margin_overview` | Customer Margin | period | aggregate_only | ✅ Done |
| 2 | `customer_margin_breakdown` | Customer Margin | period | full | ✅ Done |
| 3 | `supplier_margin_overview` | Supplier Performance | period | aggregate_only | ✅ Done |
| 4 | `supplier_margin_breakdown` | Supplier Performance | period | full | ✅ Done |
| 5 | `return_trend` | Returns | period | aggregate_only | ✅ Done |
| 6 | `return_unsettled` | Returns | snapshot | full | ✅ Done |
| 7 | `expense_overview` | Expenses | period | aggregate_only | ✅ Done |
| 8 | `expense_breakdown` | Expenses | period | full | ✅ Done |
| 9 | `financial_overview` | Financial | **fiscal_period** (new) | aggregate_only | ✅ Done |
| 10 | `financial_pnl` | Financial | **fiscal_period** | aggregate_only | ✅ Done |
| 11 | `financial_balance_sheet` | Financial | **fiscal_period** | aggregate_only | ✅ Done |

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
| 2026-04-14 | 2 | Section 2 sign-off received (dual-lens Option A for `cm_top_customers`). 9-step playbook executed: types → prompts (registries + 3 component prompts) → 3 fetchers (zero new SQL — all reuse `getCustomerMargins` / `getCreditNoteImpact` / `getMarginKpi` / `getMarginDistribution`) → scope `period` → policy `full` → `InsightSectionHeader` mounted above `TopCustomersChart` in `MarginDashboardShell.tsx` → `COMPONENT_INFO` + 3 `AnalyzeIcon` wirings (`TopCustomersChart`, `CustomerMarginTable`, `CreditNoteImpactTable`). Truth queries written (7 queries, T1–T7). `tsc --noEmit` clean. |
| 2026-04-14 | 2 | Playwright offline verify: breakdown section header renders, `cm_top_customers` + `cm_customer_table` + `cm_credit_note_impact` icons all present, ComponentInsightDialog opens with About section populated (verified on `cm_customer_table`). Page shows 9 icons per tab (not 10) because `CustomerMarginTable` and `CreditNoteImpactTable` share a `<Tabs>` container — only one table mounts at a time. 7 overview + TopCustomers + active-tab table = 9. All 3 breakdown icons present across tabs. No new JS errors. Live LLM run still blocked on credit balance. |
| 2026-04-14 | 2 | Section 2 shipped. Status → ✅. Committed as `ef9d259` (feat: AI insight v2 — customer margin breakdown section). Live LLM verification deferred until API credits are available. |
| 2026-04-14 | 3 | Section 3 (`supplier_margin_overview`) spec drafted + implemented (7 components: 5 KPIs + trend + dual-entity distribution). 9-step playbook executed. Shipped as commit `72218fe` (feat: AI insight v2 — supplier margin overview section). |
| 2026-04-14 | 4 | Section 4 (`supplier_margin_breakdown`) spec drafted with §4.9 per-component icons checklist. 4 components: TopBottomChart (2×2 lens matrix), SupplierTable, ItemPricingPanel (anchor-item anchor = highest-revenue item), PriceScatterChart (top-50 sample + 5-bucket distribution). Tool policy `full` (mirrors §2). User accepted all proposal recommendations verbatim. |
| 2026-04-14 | 4 | Section 4 implementation: types → prompts (SECTION_COMPONENTS/PAGE/NAMES + 4 component prompts) → 4 fetchers (all reuse `getTopBottomSuppliersV2` / `getTopBottomItemsV2` / `getSupplierTableV2` / `getItemListV2` / `getItemSupplierSummaryV2` / `getPriceSpread` — zero new SQL) → scope `period` → policy `full` (no whitelist changes) → second `InsightSectionHeader` mounted above `TopBottomChart` in `DashboardShell.tsx` → `COMPONENT_INFO` + 4 `AnalyzeIcon` wirings (`TopBottomChart`, `SupplierTable`, `ItemPricingPanel` on Supplier Comparison card, `PriceScatterChart`). Truth queries written (8 queries, T1–T8). `tsc --noEmit` clean. `npm run build` clean. |
| 2026-04-14 | 4 | Playwright offline verify: "Supplier Margin Breakdown" section header renders with Get Insight button, 3 immediately-visible breakdown icons present (top_bottom, supplier_table, price_scatter), dialog opens with correct About section on `sm_supplier_table` click (dialog heading "Supplier Analysis Table"). `sm_item_pricing` icon lives inside the Price Comparison tab's Supplier Comparison card and only renders once a user selects an item — wiring verified in source. Only pre-existing console errors; no new JS errors introduced. Live LLM run still deferred on credit balance. |
| 2026-04-15 | 5–10 | Tracker backfill: sections 5 (`return_trend`), 6 (`return_unsettled`), 7 (`expense_overview`), 8 (`expense_breakdown`), 9 (`financial_overview`), 10 (`financial_pnl`) all shipped between 2026-04-14 and 2026-04-15 (commits `24795ce`, prior returns unsettled commit, `6574677`, `45ae773`, `575b079`, `11f99f0`). Status rows updated to ✅ Done to match git truth. |
| 2026-04-15 | 11 | Section 11 (`financial_balance_sheet`) implemented — final section of v2 rollout. 2 components: `bs_trend` (BSTrendChartV3) + `bs_statement` (BSStatementTableV3). Tool policy `aggregate_only` (no new tables — `pc_pnl_period` already allowlisted). Scope `fiscal_period`, `filters.range` passed through (not hard-coded `fy` like §10 — BS trend is range-aware, BS statement is range-insensitive so it doesn't care either way). Thresholds: Asset trajectory bands + equity decline streak + gearing drift + negative-equity month flag (trend); Current Ratio / Debt-to-Equity / Equity Ratio bands + NCA and Total Equity sign flips + top-3 movers across 8 line items (statement). 9-step playbook executed: types → tool-policy → data-fetcher (2 fiscal fetchers reusing `getV3BSTrend` / `getV3BSComparison` — zero new SQL) → prompts (registries + 2 component prompts) → component-info (2 About entries) → `InsightSectionHeader` replacing plain `SectionHeader` in `DashboardShellV3.tsx` (removed now-orphaned helper) → `COMPONENT_INFO` + 2 `AnalyzeIcon` wirings (BSTrendChartV3 beside the existing `<h3>`, BSStatementTableV3 got a new `<h3>Balance Sheet Statement</h3>` in its CardHeader since the card had only an Export button before). `tsc --noEmit` clean. `npm run build` clean. |
| 2026-04-15 | 11 | Playwright offline verify: Financial page renders 11 analyze icons total (6 KPIs + Monthly P&L Trend + P&L Statement + Multi-Year + bs_trend + bs_statement). Both §11 icons at expected headings. `ComponentInsightDialog` opens on `bs_statement` click with full About section populated (verified dialog text includes "balance sheet in full detail", ratios narrative, top-3 movers mention). Console: 7 errors, all pre-existing 404s on `/api/ai-insight/section/{financial_overview,financial_pnl,financial_balance_sheet}` — expected Phase A baseline (no saved insights, live LLM blocked on credit balance). No new regressions. |
| 2026-04-15 | — | **v2 rollout ✅ COMPLETE.** All 11 sections shipped under Phase A across Customer Margin, Supplier Performance, Returns, Expenses, and Financial pages. Retro: (1) The 9-step playbook scaled cleanly from §1 to §11 — zero rework, each section ~1 commit. (2) The `fiscal_period` scope introduced for §9–§11 was the only non-trivial core edit of the rollout and paid for itself three times. (3) `aggregate_only` tool policy held up — every Financial section reused `pc_pnl_period` with zero new allowlist entries. (4) The "pre-computed roll-ups + top-N movers + hard rule against inventing names" pattern from §10 transferred directly to §11 with no modification. (5) Tracker drift (sections 5–10 were shipped without ticking the status column) was the one process miss — captured in the backfill above. (6) Live LLM verification remains deferred Phase B pending API credit top-up — all component prompts, allowed-value whitelists, and offline dialog plumbing are ready to run as soon as credits are available. |
