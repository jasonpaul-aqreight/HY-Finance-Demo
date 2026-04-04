# PRD Docs — Audit & Update Tracker

> **Goal:** Verify each PRD doc against the current (post-audit, post-consolidation) codebase. Fix any sections that are outdated or wrong. Mark each doc as verified.
>
> **Context:** The original PRD docs were written before a SQL audit that produced 5 bug-fix commits and a Phase 4 query consolidation. The code has changed — the docs may not reflect reality.
>
> **Created:** 2026-04-04
> **Last Updated:** 2026-04-04 (Session 10 — Final)

---

## Method

For each doc:
1. Read the existing PRD doc section by section
2. Read the corresponding current code (components, API routes, queries)
3. Flag every discrepancy (wrong formula, missing feature, changed layout, etc.)
4. Fix the doc from the live code
5. List all changes made (for user review)
6. Mark as verified

---

## Session Plan & Progress

### Session 1: Business Domain & Rules (Doc 00)
- **File:** `docs/prd/00-business-domain.md`
- **Check against:** Sync service builders, query files, app navigation, shared components
- **Focus areas:** Revenue formula, margin calc, credit scoring algorithm, supplier attribution, expense categories, data sync process, cancelled record handling
- **Note:** User already manually updated Sections 4.2, 4.3, 6.2, 6.12 — verify those plus all remaining sections
- **Status:** ✅ Verified (2026-04-04)

### Session 2: Sales Report (Doc 01)
- **File:** `docs/prd/01-sales.md`
- **Check against:** `apps/dashboard/src/app/sales/`, `src/lib/sales/`, sales API routes
- **Focus areas:** KPI formulas, group-by dimensions, chart types, table columns, filters, pagination
- **Status:** ✅ Verified (2026-04-04)

### Session 3: Payment Collection (Doc 02)
- **File:** `docs/prd/02-payment.md`
- **Check against:** `apps/dashboard/src/app/payment/`, `src/lib/payment/`, payment API routes
- **Focus areas:** Credit scoring V2 algorithm (weights, tiers), KPI formulas, DSO calculation, aging buckets, credit utilization categories, settings dialog
- **Audit findings to verify:** M2/M3/M4 (dormant V1 code — confirm V2 is documented, not V1)
- **Status:** ✅ Verified (2026-04-04)

### Session 4: Return / Credit Note (Doc 03)
- **File:** `docs/prd/03-return.md`
- **Check against:** `apps/dashboard/src/app/return/`, `src/lib/return/`, return API routes
- **Focus areas:** Reconciliation states, aging buckets, product exclusion filters, settlement logic
- **Audit findings to verify:** M7 (join direction change — verify doc describes correct behavior)
- **Status:** ✅ Verified (2026-04-04)

### Session 5: Financial Statements (Doc 04)
- **File:** `docs/prd/04-financial-statements.md`
- **Check against:** `apps/dashboard/src/app/financial/`, `src/lib/pnl/`, pnl API routes
- **Focus areas:** P&L hierarchy, fiscal year convention, KPI calculations, BS snapshot logic, multi-year comparison
- **Audit findings to verify:** PnL cleanest module — likely minimal changes needed
- **Status:** ✅ Verified (2026-04-04)

### Session 6: Expenses (Doc 05)
- **File:** `docs/prd/05-expenses.md`
- **Check against:** `apps/dashboard/src/app/expenses/`, `src/lib/expenses/`, expenses API routes
- **Focus areas:** OPEX 13 categories, COGS breakdown, trend granularity (monthly only), account hierarchy
- **Audit findings to verify:** M8 (silently returns monthly), 6 improvements in acc_type filtering
- **Status:** ✅ Verified (2026-04-04)

### Session 7: Customer Margin (Doc 06)
- **File:** `docs/prd/06-customer-margin.md`
- **Check against:** `apps/dashboard/src/app/customer-margin/`, `src/lib/customer-margin/`, margin API routes
- **Focus areas:** Margin formula (IV+DN-CN), credit note impact calculation, distribution buckets, filter dimensions
- **Audit findings to verify:** M1 (inactive customer filter fix — doc should reflect active-only behavior)
- **Status:** ✅ Verified (2026-04-04)

### Session 8: Supplier Performance (Doc 07)
- **File:** `docs/prd/07-supplier-margin.md`
- **Check against:** `apps/dashboard/src/app/supplier-performance/`, `src/lib/supplier-margin/`, supplier API routes
- **Focus areas:** COGS attribution model, price comparison (min/max/avg), sparklines, item pricing panel, single-supplier-risk
- **Audit findings to verify:** C1 (min/max sell price fix), M5 (weekly→monthly granularity), M6 (weighted avg methodology)
- **Status:** ✅ Verified (2026-04-04)

### Session 9: Settings & Profiles (Doc 08)
- **File:** `docs/prd/08-settings-and-profiles.md`
- **Check against:** Payment settings components, customer/supplier profile modal components
- **Focus areas:** Credit score settings form, weight sliders, tier thresholds, profile modal tabs and layout
- **Note:** User already updated profile modals in Doc 00 — verify Doc 08 is consistent with those updates
- **Status:** ✅ Verified (2026-04-04)

### Session 10: Design Standards (Doc 09)
- **File:** `docs/prd/09-design-standards.md`
- **Check against:** All component files, shared components, layout components, memory feedback items
- **Focus areas:** Table standards, readability rules, color system, loading/empty states, responsive patterns
- **Status:** ✅ Verified (2026-04-04)

---

## How to Resume

When starting a new session:

1. Read this file to find the next unchecked session
2. Read the PRD doc listed for that session
3. Read the current code listed under "Check against"
4. Compare section by section, fix discrepancies
5. List all changes in this tracker under the session
6. Mark session as completed with date

---

## Change Log

### Session 10 (2026-04-04) — Final

**Doc:** `docs/prd/09-design-standards.md`
**Sections checked:** All (1–16)

**11 fixes applied:**

1. **Section 1.2 (Sidebar navigation labels)** — Changed 4 labels to match code: "Sales Report" → "Sales", "Payment Collection" → "Payment", "Credit Note / Return" → "Return", "Financial Statements" → "Financials", "Sync Admin" → "Data Sync".
2. **Section 6.3 (Chart grid lines)** — Changed blanket "Horizontal grid lines only / No vertical grid lines" to a table describing the actual pattern: vertical bar/line charts use horizontal-only, horizontal bar charts use vertical-only, combo/trend charts show both. All grid lines are dashed, light grey.
3. **Section 6.4 (Chart heights)** — Updated height ranges: full-width primary trend charts are 360–380 px (not flat 360), added scatter/bubble at 600 px, dynamic horizontal bars grow ~45–48 px per entry with min 400 px (not ~45 px with no minimum). Renamed categories to match actual usage ("Distribution / comparative" at 320 px).
4. **Section 6.5 (Legend interaction)** — Changed "Clicking a legend item toggles that series on/off" to "Display-only — legends do not toggle series visibility on click". No chart in the codebase implements interactive legend toggling.
5. **Section 7.1 (Table column alignment)** — Changed "ALL columns left-aligned — including numbers and currency. No right-aligned data." to a split description: primary analysis tables (Payment Customers, Customer Margin, Sales Group-By, Supplier Analysis) keep all columns left-aligned; financial/detail tables (P&L, Balance Sheet, COGS, OPEX, Credit Note Impact, Supplier Comparison, Return Top Debtors) right-align numeric columns with monospace digits.
6. **Section 7.1 (Pagination page size options)** — Removed "(some tables also offer 100)". No table in the codebase offers a 100-row option; all use [10, 25, 50].
7. **Section 7.1 (Alternating row striping)** — Added note that striping is not applied on all tables consistently. Named the tables that do implement it (Sales Group-By, Supplier Analysis, COGS, Supplier Comparison).
8. **Section 8.2 (Fiscal Year selector range)** — Changed "±3 years around the selected FY" to "Selected FY plus 3 prior years (up to 4 years total)". Consistent with the Session 5 fix applied to Doc 04.
9. **Section 9.5 (Settings Dialog width)** — Changed "~480 px wide" to "~900 px max width". Code uses `sm:max-w-[900px]` to accommodate the 4-column weight grid and 2-column threshold layout.
10. **Section 9.6 (Supplier modal backdrop close)** — Added exception: Supplier modal uses a custom overlay where backdrop click does not close the modal (close via X button only). Customer modal and Settings dialog do support backdrop dismissal.
11. **Section 16 (Anti-pattern: right-aligning numerics)** — Changed blanket "Right-aligning numeric columns / All data left-aligned" to a nuanced rule: primary analysis tables keep all columns left-aligned; financial/detail tables right-align numeric columns for decimal alignment. Lists both table categories explicitly.

**Sections verified with no changes needed:**
- Section 1.1 (Page Shell): Sidebar widths (224 px / 64 px), content max-width (1600 px), content padding (24 px), collapse toggle with localStorage persistence all correct.
- Section 1.3 (Page Banner): Background, padding (24 px horizontal, 16 px vertical), inner max-width (1600 px), title 18 px semi-bold, description 16 px muted all correct.
- Section 1.4 (Standard Page Structure): Vertical sequence and 24 px spacing all correct.
- Section 2 (Responsive Behaviour): Breakpoints and grid rules match Tailwind classes used.
- Section 3 (Colour System): All hex values verified in code — semantic colours, revenue/cost series, risk levels, aging buckets, margin distribution (7-band), OPEX 13 categories, utilisation bands, status indicators all correct.
- Section 4 (Typography): Font families, type scale, readability rules all correct.
- Section 5 (KPI Cards): Card anatomy, container styling, conditional colouring rules, loading skeleton all correct.
- Section 6.1–6.2 (Chart types, axis formatting): Chart type inventory and axis format patterns all correct.
- Section 6.6–6.7 (Tooltips, toggle controls): Tooltip formatting and segmented button group patterns all correct.
- Section 7.2–7.5 (Table header controls, column specs, sort behaviour, hierarchical tables): All correct.
- Section 8.1, 8.3–8.6 (Date range filter, dropdowns, filter logic, toggles, search): All correct.
- Section 9.1–9.4 (Profile modals structure, views, default views, section-level loading): Dimensions (90vw × 90vh), view-switching pattern, default view by calling page, independent section loading all correct.
- Section 10 (Data Formatting): Currency, percentages, dates, numbers, null/empty handling, text truncation all correct.
- Section 11 (Loading, Empty, Error States): Skeleton patterns, empty-state messaging, per-section error handling all correct.
- Section 12 (Interactive Patterns): Buttons, tooltips, popovers, dropdowns, collapsible sections, tabs, sparklines all correct.
- Section 13 (Accessibility): Keyboard navigation, touch targets, contrast requirements all correct.
- Section 14 (Export Standards): .xlsx format, ExcelJS client-side generation, header styling (#F2F2F2), column widths all correct.
- Section 15 (Cross-Page Consistency): Consistency rules and intentional variations all correct.

---

### Session 9 (2026-04-04)

**Doc:** `docs/prd/08-settings-and-profiles.md`
**Sections checked:** All (1–7), including Drift from Legacy table

**5 fixes applied:**

1. **Section 2.2 / 4.1 (Customer Profile — Default View from Return page)** — Changed default view from "Profile" to "Returns" in both the Section 2.2 table and the Section 4.1 Modal Usage Matrix. Code passes `defaultTab="returns"` when opening from the Credit Note / Return page's Top Debtors Table.
2. **Section 2.5C (Trend Charts layout)** — Changed "2×2 Grid" with 4 charts to "2-Column Grid" with 3 charts. Removed the non-existent 4th "Sales Margin" chart. The actual implementation has 3 trend charts (Sales & Margin, Payment, Returns) in a `grid-cols-2` layout where the Returns chart occupies the left column of the second row. Also corrected Returns chart line color from "orange" to "amber".
3. **Section 3.6 (Supplier Items Table — default sort)** — Changed "Default sort: Revenue, descending" to "Default sort: Margin %, descending". Code initializes `sortKey` state to `'margin_pct'` with `sortAsc: false`.
4. **Section 3.6 (Supplier Items Table — column names)** — Changed "Revenue" to "Est. Revenue" and "Purchase Cost" to "Est. Cost of Sales" to match actual table headers. These columns use the "Est." prefix consistent with the attribution-based costing methodology documented in Section 5.5.
5. **Section 3.6 (Sole Supplier Toggle label)** — Changed "Sole Supplier Only" to "Sole Source Only" to match code. Also updated the tooltip description from generic to the exact info text: "Sole source — no other supplier supplies these fruit varieties. Dependency is assessed by fruit type, not individual SKU."

**Also corrected in Drift table (Section 6):**
- Changed "4 trend charts" to "3 trend charts in 2-column grid" to match the fix in Section 2.5C.

**Sections verified with no changes needed:**
- Section 1 (Credit Health Score Settings): All 4 sections (Header, Weights Card, Thresholds Card, How It Works accordion) fully match code — default weights (40/30/20/10), thresholds (75/30), validation logic, Reset buttons, admin/non-admin behavior, footer buttons, scoring algorithm formulas, sub-score step ladders, worked example.
- Section 2.3–2.4 (Customer Modal structure/header): 90vw × 90vh sizing, CUSTOMER badge in blue, active/inactive status chips with pulsing dot, company name + debtor code layout all correct.
- Section 2.5A–B (Customer Details + Statistics): 3-column detail grid (General/Contact/Financial), 3 log navigation buttons with correct badge colors, 4 statistics cards (Credit Health Gauge, Credit Utilization Donut, Outstanding Aging Bar, Returns Donut) all match.
- Section 2.6–2.8 (Outstanding Invoices, Return Records, Sales Transactions views): Column names, alignment, sort defaults, color coding, footer text, search fields, export button, pagination, date range inheritance all correct.
- Section 3.1–3.5 (Supplier Modal structure/Profile view): Header with SUPPLIER badge in indigo, 3-column details grid, Margin Gauge (0-50% scale), Supply Dependency bar, Purchase Cost & Margin chart, Top 5 Items toggle all correct.
- Section 3.6 (Sparkline interaction): 100×28px default, green/red color logic, click-to-popover with expanded chart + monthly data table all correct.
- Section 4–5 (Cross-Page Integration, Business Rules): All data source tables, formatting conventions, "Est." label convention, date range inheritance rules, settings integration all correct.

---

### Session 8 (2026-04-04)

**Doc:** `docs/prd/07-supplier-margin.md`
**Sections checked:** All (1–12), including Drift from Legacy table

**1 fix applied:**

1. **Section 12 (Drift table — alignment claim)** — Changed blanket "All data left-justified per project-wide standard" to a split description: Supplier Analysis table is fully left-justified; Supplier Comparison table has left-aligned text columns and right-aligned numeric columns (Avg Price, Latest, Min, Max, Qty) via `text-right font-mono` class.

**Audit findings verified:**
- C1 (min/max sell price fix): Confirmed — `getItemSellPriceV2` returns `null` when no data exists. The sell price data (`ProcurementSummaryResponse.sellPrice`) is fetched but not rendered in the Price Comparison panel UI. No PRD impact.
- M5 (weekly→monthly granularity): Confirmed — `Granularity` type is `'monthly' | 'quarterly' | 'yearly'` (no weekly option). `MarginTrendChart` hardcodes `granularity: 'monthly'`. PRD Section 3.4 already correctly documents "monthly only."
- M6 (weighted avg methodology): Confirmed — avg purchase price uses `SUM(purchase_total) / NULLIF(SUM(purchase_qty), 0)`, a quantity-weighted average across the full date range. PRD Section 8.3 correctly describes this methodology.

---

### Session 7 (2026-04-04)

**Doc:** `docs/prd/06-customer-margin.md`
**Sections checked:** All (1–12), including Drift from Legacy table

**3 fixes applied:**

1. **Section 6.1 (Sparkline color threshold — `>` vs `>=`)** — Changed "Green if ending margin > starting margin, Red otherwise" to "Green if ending margin ≥ starting margin, Red if ending margin < starting margin". Code uses `last >= first` (greater-or-equal), not strict greater-than. When ending margin exactly equals starting margin, the sparkline renders green.
2. **Section 7.2 (Active customer record filter)** — Added "Only active customer records are included (`is_active = 'T'` filter applied on all queries)". All queries in `buildMarginFilter()` always apply `is_active = 'T'` on `pc_customer_margin`. The doc previously only mentioned "non-cancelled documents" (which refers to document-level `Cancelled='F'`), but the active-record filter is a separate concern added by the M1 audit fix.
3. **Section 12 (Drift table — alignment claim)** — Changed "All data left-justified per project-wide standard" to a split description: Customer Analysis table is fully left-aligned; Credit Note Impact table has left-aligned text columns and right-aligned numeric columns (IV Revenue, CN Amount, Return Rate, Margin Before, Margin After, Margin Lost) via `text-right` class.

**Audit findings verified:**
- M1 (inactive customer filter fix): Confirmed — `buildMarginFilter()` always includes `is_active = 'T'` as the first WHERE clause (line 139 in queries.ts). The `buildProductFilter()` variant also applies `is_active = 'T'` in its subquery (line 182). Doc now reflects this active-only behavior.

---

### Session 6 (2026-04-04)

**Doc:** `docs/prd/05-expenses.md`
**Sections checked:** All (1–12), including Drift from Legacy table

**5 fixes applied:**

1. **Section 6.1 (COGS table "% of COGS" sortability)** — Changed from "Yes" (sortable) to "No". Code renders a plain `<TableHead>` for this column, not a `<SortHeader>`. The column is not clickable-sortable. (The other 3 columns — Account No, Account Name, Net Cost — are correctly documented as sortable.)
2. **Section 6.2 (OPEX table default collapse state)** — Changed "All categories are expanded by default" to "All categories are collapsed by default". Code initializes `collapsed` state with `new Set(CATEGORY_ORDER)`, placing all 13 categories in the collapsed set on mount.
3. **Section 8.5 (Currency formatting — table decimals)** — Split the single "Currency values" row into two rows: KPI cards use 0 decimals (unchanged), breakdown tables use 2 decimal places via `formatRM(value, 2)`. The original blanket "no decimals" rule was only accurate for KPI cards.
4. **Section 12 (Drift table — alignment claim)** — Changed "All data left-justified per project-wide standard" to "Left-aligned for text columns, right-aligned for numeric columns (Net Cost, %)". Both COGS and OPEX tables apply `text-right` class to Net Cost (RM) and percentage columns.
5. **Section 12 (Drift table — OPEX default state)** — Changed "All categories expanded by default" to "All categories collapsed by default (unchanged from legacy)". The drift entry had incorrectly claimed the implementation changed from collapsed to expanded; the code retains the collapsed default.

**Audit findings verified:**
- M8 (silently returns monthly): Confirmed — `getCostTrendByType` accepts a `granularity` parameter but the comment at line 197–198 documents that `pc_expense_monthly` only supports monthly grain; daily/weekly fall back to monthly. The UI never exposes a granularity toggle, so this is transparent to users. PRD Section 3.3 already correctly documents "monthly data only."
- 6 improvements in acc_type filtering: Confirmed — all queries correctly filter `acc_type IN ('CO', 'EP')` for combined views, `acc_type = 'CO'` for COGS-only, and `acc_type = 'EP'` for OPEX-only. The `COST_CATEGORY_CASE` and `OPEX_CATEGORY_CASE` SQL expressions use `COALESCE(parent_acc_no, acc_no)` for parent-child inheritance. No doc changes needed.

---

### Session 5 (2026-04-04)

**Doc:** `docs/prd/04-financial-statements.md`
**Sections checked:** All (1–9), including Appendix

**5 fixes applied:**

1. **Section 3 (KPI Color Rules)** — Changed alarm state cards from "Cards 3, 5, 6, and 8" to "Cards 5, 6, and 8". Card 3 (Gross Profit) uses color-coded text only (green/red) — no alarm ring or background tint. Added explicit note documenting this distinction.
2. **Section 4.2 / 8 (Multi-Year Data Scope)** — Changed "±3 fiscal years around the selected fiscal year (up to 7 years total)" to "selected fiscal year plus 3 prior years (up to 4 years total)". Code filters `fyNum - 3` to `fyNum`, not `fyNum ± 3`.
3. **Section 5.1 (P&L Table column alignment)** — Changed columns Month, YTD, Prior YTD, and YoY % from "Left" to "Right" alignment. Code sets `text-right` on all numeric columns.
4. **Section 5.2 (Multi-Year Comparison Table column alignment)** — Changed FY columns from "Left" to "Right" alignment. Code sets `text-right` on FY value columns.
5. **Section 5.3 (Balance Sheet Table column alignment)** — Changed columns Current, Prior, Change, and % from "Left" to "Right" alignment. Code sets `text-right` on all numeric columns.

**Audit findings verified:**
- PnL cleanest module: Confirmed — no formula errors, no missing features. All 5 discrepancies were presentational (alarm styling scope and column alignment), not logical.

---

### Session 4 (2026-04-04)

**Doc:** `docs/prd/03-return.md`
**Sections checked:** All (1–9), including Appendix

**6 fixes applied:**

1. **Section 2 / 5.1 (Chart row layout)** — Changed Settlement Breakdown + Monthly Trend layout from "~35% / ~65% width" to "equal-width side-by-side (50/50)". Code uses `grid-cols-2` equal columns.
2. **Section 4.4 (Return % subtitle)** — Changed "return value / total sales" to "return value ÷ total sales". Code uses the ÷ division symbol.
3. **Section 5.2 (Monthly Trend X-axis format)** — Changed "M/YY (e.g., '1/25')" to "MM/YY (e.g., '01/25')". Code retains leading zeros on month via `${m}/${y.slice(2)}` split.
4. **Section 6.1 (Table column alignment)** — Changed columns 3–7 (Returns, Total Value, Knocked Off, Refunded, Unresolved) from "Left" to "Right" alignment. Code sets `align: 'right'` and `text-right` on all numeric columns.
5. **Section 6.1 (Table subtitle format)** — Changed from `"{N} of {M} total customers"` to `"{N} customers"` when showing all, `"{N} customers of {M} total"` when a status filter is active. Code conditionally appends the total count.
6. **Appendix (Table alignment row)** — Corrected from "All columns left-aligned" to "Left-aligned for text columns, right-aligned for numeric columns". The original Appendix entry was inaccurate.

**Audit findings verified:**
- M7 (join direction change): Confirmed — PRD correctly documents the CN→ARCN LEFT JOIN pattern. CN is the authoritative source; ARCN provides settlement data. No doc change needed.

---

### Session 3 (2026-04-04)

**Doc:** `docs/prd/02-payment.md`
**Sections checked:** All (1–10)

**6 fixes applied:**

1. **Section 5.1 (Table column headers)** — Changed column 10 from "Score" to "Credit Health Score" and column 11 from "Risk" to "Risk Level". Code renders the full names in the table header.
2. **Section 5.1 (Settings button label)** — Changed "Score & Risk Settings" to "Score & Risk". Code omits "Settings" from the button text.
3. **Section 7.1 Factor 1 (Credit Utilization formula)** — Changed `max(0, 100 − Utilization %)` to `max(0, round(100 − Utilization %))`. Code applies `Math.round()` before clamping to zero.
4. **Section 7.1 Factor 3 (Lookback period)** — Added "(default: 12 months)" to the lookback period description. Code uses a 12-month default (backend-configurable, not exposed in UI).
5. **Section 7.4 (Reset to Defaults buttons)** — Changed from singular "Reset to Defaults button" to two separate buttons — one for the weights section, one for the thresholds section. Each resets only its own section.

**Audit findings verified:**
- M2/M3/M4 (dormant V1 code): Confirmed — PRD documents only V2 algorithm. No V1 references remain in the doc.

---

### Session 2 (2026-04-04)

**Doc:** `docs/prd/01-sales.md`
**Sections checked:** All (1–9)

**5 fixes applied:**

1. **Section 5.1 (Fruit table columns)** — Removed Invoice Sales, Cash Sales, Credit Note columns from Fruit dimension table. Code only displays: Fruit, Country, Variant, Total Sales, Qty Sold. (Query returns the extra fields but the UI component does not render them.)
2. **Section 6.3 (Fruit dimension filters)** — Added search input documentation ("Search by fruit name"). Code renders a text search input for all dimensions including Fruit; PRD only documented the three cascading dropdowns.
3. **Section 6.2 (Group By control type)** — Changed "Toggle buttons" to "Dropdown select". Code uses `<Select>` component, not toggle buttons.
4. **Section 4.2 (Breakdown chart grid)** — Changed "Horizontal dashed lines only" to "Vertical dashed lines only". Code sets `horizontal={false}` on CartesianGrid — vertical lines are the correct reference lines for a horizontal bar chart.
5. **Section 4.1 (Trend chart grid)** — Changed "Horizontal dashed lines only" to "Dashed grid lines (horizontal and vertical)". Code's CartesianGrid has no `vertical={false}` prop, so both directions render.

---

### Session 1 (2026-04-04)

**Doc:** `docs/prd/00-business-domain.md`
**Sections checked:** All (1–9), including user's prior manual updates to 4.2, 4.3, 6.2, 6.12

**3 fixes applied:**

1. **Section 6.2 (Cancelled Records)** — Edge case originally cited only "credit note records" with null cancellation flag. Updated to cite **both CN and DN**, with scope details (CN in sync builders, DN in both sync builders and dashboard queries).
2. **Section 7 (Sync Schedule)** — Default was "every 6 hours". Updated to **"daily at 6 AM MYT"** (matching code: `0 6 * * *`). Added "environment variable" as a configuration method alongside admin page.
3. **Section 4.3 (Supplier Profile Modal)** — Added **context-sensitive default view** table: Supplier Performance table opens directly to Items view; all other contexts open Profile view.
