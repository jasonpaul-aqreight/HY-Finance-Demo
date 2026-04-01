# Migration Gap Fix Plan

> Generated: 2026-04-01 from full audit comparing old SQLite codebase (`/Users/aqreight/Documents/old_Finance/finalize/`) against new PostgreSQL codebase (`apps/dashboard/` + `apps/sync-service/`).

## Pre-Requisites

- Old codebase available at `/Users/aqreight/Documents/old_Finance/finalize/` for reference
- After all builder fixes, re-run sync to rebuild ALL `pc_*` tables
- Verify each fix with Playwright browser testing

---

## Phase 1: Critical Builder Fixes — ✅ ALL 9 COMPLETE (2026-04-01)

These require fixing the SQL in builders.ts then re-syncing data.

### 1.1 CRITICAL — Return: Missing CNType='RETURN' Filter

**Problem:** All 4 return builders query CN table without `CNType = 'RETURN'`, so the entire Return module includes ALL credit notes (adjustments, price differences, etc.) — not just goods returns. Everything is inflated.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — functions: `buildReturnMonthly` (~line 492), `buildReturnByCustomer` (~line 516), `buildReturnProducts` (~line 546), `buildReturnAging` (~line 570)

**Fix:** Add `AND cn."CNType" = 'RETURN'` (or equivalent from ARCN table) to the WHERE clause of every CN query in all 4 return builders.

**Reference (old code):**
- `old_Finance/finalize/src/lib/return/queries-v2.ts:89` — shows exact filter: `a.CNType = 'RETURN'`

---

### 1.2 CRITICAL — Supplier Margin: LocalSubTotal vs LocalSubTotalExTax

**Problem:** Builder uses `d."LocalSubTotal"` for IV/CS sales revenue, which INCLUDES tax. Old code used `LocalSubTotalExTax`. All supplier margin percentages are deflated (wrong).

**Files to fix:**
- `apps/sync-service/src/builders.ts` — function `buildSupplierMargin` (~lines 766, 778)

**Fix:** Change `d."LocalSubTotal"` to `d."LocalSubTotalExTax"` for IVDTL and CSDTL sales revenue columns.

**Reference (old code):**
- `old_Finance/finalize/src/lib/supplier-margin/queries.ts:168,176` — uses `ivd.LocalSubTotalExTax`

---

### 1.3 CRITICAL — Sales Fruit: Missing Credit Note Lines

**Problem:** `buildSalesByFruit` only includes IV + CS line items. CN detail lines (CNDTL) are absent, so fruit-level sales are overstated (returns not subtracted).

**Files to fix:**
- `apps/sync-service/src/builders.ts` — function `buildSalesByFruit` (~lines 186-217)

**Fix:** Add a third UNION ALL for CNDTL joined to CN, with subtotal negated (`-d."LocalSubTotal"`). Match the old code pattern.

**Reference (old code):**
- `old_Finance/finalize/src/lib/sales/queries-v2.ts:154` — `SELECT 'CN'...FROM sales_credit_note` with negated subtotal

---

### 1.4 CRITICAL — Sales Agent: Document Header vs Debtor Master

**Problem:** `buildSalesByOutlet` (the outlet dimension builder that also handles agents) reads `SalesAgent` from the Debtor master table (current assignment). Old code read from document headers (agent at time of sale).

**Files to fix:**
- `apps/sync-service/src/builders.ts` — function `buildSalesByOutlet`, specifically the agent dimension section (~lines 140-155)

**Fix:** Include `"SalesAgent"` from IV/CS/CN document headers in the `sales` CTE (similar to how SalesLocation was already fixed), then use `s."SalesAgent"` instead of `d."SalesAgent"` for the agent dimension.

**Reference (old code):**
- `old_Finance/finalize/src/lib/sales/queries-v2.ts:91` — reads `iv.SalesAgent`, `cs.SalesAgent`, `cn.SalesAgent` from document headers

---

### 1.5 CRITICAL — Customer Margin: Inactive Customer Filtering

**Problem:** New code does not filter inactive customers from any margin query. Old code consistently filtered `IsActive = 'T'` via Debtor JOIN. This inflates totals.

**Files to fix (two options):**

**Option A (builder-level):** Add `IsActive` flag to `pc_customer_margin` table and builder, then filter in dashboard queries.
- `migrations/003_precomputed_tables.sql` — add `is_active TEXT` column to `pc_customer_margin`
- `apps/sync-service/src/builders.ts` — `buildCustomerMargin` function, include `d."IsActive"` from Debtor table
- `apps/dashboard/src/lib/customer-margin/queries.ts` — add `AND m.is_active = 'T'` to `buildMarginFilter` helper (~line 133)

**Option B (query-level):** JOIN to `customer` lookup table and filter in dashboard queries.
- `apps/dashboard/src/lib/customer-margin/queries.ts` — in each query function, add `JOIN customer c ON m.debtor_code = c.debtorcode WHERE c.isactive = 'T'`

**Reference (old code):**
- `old_Finance/finalize/src/lib/customer-margin/queries.ts:162,206,219,290,501` — all have `IsActive = 'T'`

---

### 1.6 CRITICAL — Customer Margin: Product Group Missing CN/DN

**Problem:** `buildCustomerMarginByProduct` includes IV + CS but not CN or DN. Old code included IV + CN + DN. Product group revenue is wrong.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — function `buildCustomerMarginByProduct` (~lines 689-737)

**Fix:** Add CNDTL (subtracted) and DNDTL (added) to the UNION ALL, matching old logic.

**Reference (old code):**
- `old_Finance/finalize/src/lib/customer-margin/queries.ts:558-594` — unions IVDTL, CNDTL, DNDTL

---

### 1.7 MEDIUM — Customer Margin: DN Cancelled NULL Handling

**Problem:** New builder filters `WHERE h."Cancelled" = 'F'` for DN, excluding rows where Cancelled IS NULL. Old code accepted both.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — DN sections in `buildCustomerMargin` (~line 651) and `buildCustomerMarginByProduct`

**Fix:** Change to `WHERE (h."Cancelled" = 'F' OR h."Cancelled" IS NULL)`.

**Reference (old code):**
- `old_Finance/finalize/src/lib/customer-margin/queries.ts:196` — `(Cancelled='F' OR Cancelled IS NULL)`

---

### 1.8 MEDIUM — Customer Margin: Negative Cost Filtering

**Problem:** New builder uses raw `SUM(d."LocalTotalCost")` without filtering negatives. Old code used `CASE WHEN LocalTotalCost >= 0 THEN LocalTotalCost ELSE 0 END`.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — `buildCustomerMargin` (~line 623) and `buildCustomerMarginByProduct`

**Fix:** Wrap cost in `SUM(CASE WHEN d."LocalTotalCost" >= 0 THEN d."LocalTotalCost" ELSE 0 END)`.

**Reference (old code):**
- `old_Finance/finalize/src/lib/customer-margin/queries.ts:189`

---

### 1.9 MEDIUM — Sales Fruit: Items Without UDF_BoC Excluded

**Problem:** Builder requires `UDF_BoC IS NOT NULL AND UDF_BoC LIKE '%->%'`. Old code included all items, grouping null fruit names under 'OTHERS'.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — `buildSalesByFruit` (~line 209)

**Fix:** Remove the `LIKE '%->%'` requirement. Use `COALESCE` to handle items without UDF_BoC, grouping them under '(Unknown)' or 'OTHERS' to match old behavior.

**Reference (old code):**
- `old_Finance/finalize/src/lib/sales/queries-v2.ts:139` — `COALESCE(FruitName, 'OTHERS')`

---

## Phase 2: Critical Dashboard Query Fixes — ✅ ALL 7 COMPLETE (2026-04-01)

These fix logic in the dashboard app without needing a re-sync (unless noted).

### 2.1 CRITICAL — Payment: Aging Buckets Ignore Filters

**Problem:** `getAgingBuckets()` and `getAgingBucketsByDimension()` accept filter parameters but never apply them. Always returns aggregate data regardless of selected filters.

**Files to fix:**
- `apps/dashboard/src/lib/payment/queries.ts` — `getAgingBuckets` (~line 151) and `getAgingBucketsByDimension` (~line 182)

**Fix:** Apply filters to the `pc_ar_aging_history` query. May need to add filter dimensions to the pre-computed table or query RDS for filtered aging data.

**Reference (old code):**
- `old_Finance/finalize/src/lib/payment/queries.ts:145-170` — uses `buildFilterClauses` to filter aging

---

### 2.2 CRITICAL — Payment: Credit Score Algorithm Mismatch

**Problem:** Builder uses linear interpolation for timeliness/overdue scoring. Old code used step-ladder thresholds. Produces different scores.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — `buildArCustomerSnapshot` credit score computation (~lines 380-406)

**Fix:** Import and use the existing `computeCreditScoreV2()` function from `apps/dashboard/src/lib/payment/credit-score-v2.ts` (which is identical to the old code), or replicate the step-ladder logic in the builder SQL.

**Reference (old code):**
- `old_Finance/finalize/src/lib/payment/credit-score-v2.ts:46-76` — step ladder thresholds

**Also fix:** Default weight mismatch.
- `credit-score-v2.ts:33-38` has `utilization: 40, doubleBreach: 10`
- `builders.ts:369-370` has `utilization: 30, doubleBreach: 20`
- `migrations/005_app_settings.sql` has `utilization: 30, doubleBreach: 20`
- Decide which is correct and align all three.

---

### 2.3 MEDIUM — Payment: Collection Trend Counts Always Zero

**Problem:** `payment_count` and `invoice_count` always set to 0 in collection trend.

**Files to fix:**
- `apps/dashboard/src/lib/payment/queries.ts` — `getCollectionTrend` (~lines 273-274, 304-305)

**Fix:** Query actual counts from `pc_ar_monthly` or derive from existing columns.

---

### 2.4 MEDIUM — Payment: cn_frequency_score Hardcoded to 50

**Problem:** V1 credit health table hardcodes `cn_frequency_score: 50` instead of computing it.

**Files to fix:**
- `apps/dashboard/src/lib/payment/queries.ts` (~line 516)

**Fix:** Compute from snapshot data or add CN frequency data to the snapshot table.

---

### 2.5 MEDIUM — Payment: DueDate Not MYT-Adjusted

**Problem:** Customer invoices RDS query returns raw `DueDate::text` without +8 hours MYT conversion.

**Files to fix:**
- `apps/dashboard/src/lib/payment/queries.ts` (~line 568)

**Fix:** Change to `(a."DueDate" + INTERVAL '8 hours')::date::text AS due_date`.

---

### 2.6 MEDIUM — Supplier Margin: IsActive Filter Missing

**Problem:** Inactive suppliers appear in all dropdowns, counts, and data throughout supplier-margin queries.

**Files to fix:**
- `apps/dashboard/src/lib/supplier-margin/queries.ts` — dimension queries, supplier list queries
- `apps/dashboard/src/lib/supplier-margin/queries-v2.ts` — `buildSupplierTypeFilter`, dimensions query

**Fix:** Add `JOIN supplier s ON m.creditor_code = s.creditorcode WHERE s.isactive = 'T'` where appropriate. Or add `is_active` to `pc_supplier_margin` at builder level.

**Reference (old code):**
- `old_Finance/finalize/src/lib/supplier-margin/queries.ts:128-136` — `c.IsActive = 'T'`

---

### 2.7 MEDIUM — Customer Margin: Label Mismatch

**Problem:** Builder uses `'(None)'` for missing item groups; old code used `'Unclassified'`. Filter dropdown still appends `'Unclassified'`.

**Files to fix:**
- `apps/sync-service/src/builders.ts` — `buildCustomerMarginByProduct` (~lines 695, 711)
- OR `apps/dashboard/src/lib/customer-margin/queries.ts` — `getFilterProductGroups` (~line 603)

**Fix:** Align label. Also change builder to use `COALESCE(NULLIF(i."ItemGroup", ''), 'Unclassified')` to handle empty strings.

---

## Phase 3: Missing Reference Data — ✅ VALIDATED (2026-04-01)

### 3.1 Fruit Lookup Tables — NOT APPLICABLE

**Problem:** Three reference tables documented in data dictionary but never created in migrations.

**Validation result:** These tables were aspirational schema documented in `data_dictionary.md` but **never implemented or consumed** in the old codebase. Evidence:
- No SQLite databases or seed data files exist in `old_Finance/` or `old_Finance/others/`
- `ref_fruits`, `ref_countries`, `ref_fruit_aliases` appear only in documentation — zero queries, zero JOINs, zero imports in either old or new code
- The system handles fruit standardization via `UDF_BoC` parsing: `transforms.ts` populates `FruitName`/`FruitCountry`/`FruitVariant` on the `product` table, and `buildSalesByFruit` uses `SPLIT_PART` directly
- No action needed. Can be revisited if fruit name standardization becomes a requirement.

---

### 3.2 Expense Category Mapping — ✅ VERIFIED IDENTICAL

**Validation result:** `apps/dashboard/src/lib/shared/expense-categories.ts` exists and is **byte-for-byte identical** to `old_Finance/finalize/src/lib/shared/expense-categories.ts`. All 74 GL account mappings, 13 category groups, `CATEGORY_ORDER`, `getExpenseCategory()`, and `buildCategoryCaseSQL()` match exactly.

---

## Phase 4: Granularity Losses — ✅ DOCUMENTED (2026-04-01)

These are inherent to the pre-computed table architecture. Accepted trade-offs — none are user-visible because the dashboard UI has always operated at month-grain via `MonthYearPicker`.

| # | Module | Old System | New System | UI Visible? |
|---|--------|-----------|-----------|:-----------:|
| 4.1 | Expenses | Daily/weekly/monthly queries on raw `gldtl` | Monthly only via `pc_expense_monthly` (silent fallback) | No |
| 4.2 | Supplier | Weekly price drill-down on raw `pi`/`pidtl` | Monthly only via `pc_supplier_margin` (pass-through to monthly) | No |
| 4.3 | All modules | Day-precision dates accepted by queries | Month-grain filtering enforced via `toMonth()` helper | No |
| 4.4 | All modules | Exact min/max dates (e.g. Jan 15–Dec 28) | Month-start dates only (`month \|\| '-01'`) | No |

### 4.1 Expenses: Daily/Weekly → Monthly

- **Old:** `getCostTrendByType()` accepted `granularity: 'daily' | 'weekly' | 'monthly'`, querying raw `gldtl` with `DATE(TransDate, '+8 hours')` or `strftime('%G-W%V', ...)`
- **New:** Same function signature exists but explicitly falls back: *"pc_expense_monthly only supports monthly granularity; daily/weekly fall back to monthly since the pre-computed table is month-level"*
- **Why acceptable:** Dashboard date picker (`MonthYearPicker`) only offers month selection with presets '3M', '6M', '12M', 'YTD'. No UI path to request daily/weekly.

### 4.2 Supplier: Weekly Price Drill-Down → Monthly

- **Old:** `getItemPriceWeeklyV2()` queried purchase invoice details grouped by `strftime('%Y-W%W', DocDate)`, returning per-week `AVG(UnitPrice)` and `SUM(Qty)`
- **New:** `getItemPriceWeeklyV2()` is a pass-through: `return getItemPriceMonthlyV2(...)`. Returns monthly data with `year_month` in YYYY-MM format.
- **Why acceptable:** Same `MonthYearPicker` UI — no weekly selection available. Silent degradation with no user-facing indicator.

### 4.3 Group-By Date Filtering: Day-Grain → Month-Grain

- **Old:** Queries accepted day-precision dates (e.g. `DATE(...) BETWEEN ? AND ?`), allowing theoretical intra-month filtering
- **New:** All WHERE clauses use `month BETWEEN $1 AND $2` after stripping dates to YYYY-MM via `toMonth()` helper
- **Why acceptable:** `MonthYearPicker` snaps selections to `startOfMonth()`/`endOfMonth()` — users never submit day-level filters.

### 4.4 Date Bounds: Exact Dates → Month-Start

- **Old:** `MIN(DATE(TransDate, '+8 hours'))` / `MAX(...)` returned exact first and last transaction dates
- **New:** `MIN(month) || '-01'` / `MAX(month) || '-01'` always returns the 1st of the month
- **Why acceptable:** `MonthYearPicker.handleSelect()` already snaps to month boundaries. The picker cannot represent mid-month boundaries anyway.

---

## Fix Order — ALL PHASES COMPLETE

1. ✅ **Phase 1 builder fixes** (1.1-1.9) — all 9 done
2. ✅ **Phase 2 dashboard fixes** (2.1-2.7) — all 7 done
3. ✅ **Phase 3 reference data** (3.1 not applicable, 3.2 verified identical)
4. ✅ **Phase 4 granularity trade-offs** — documented above

### Remaining: Deploy & Verify
1. Run migration `006_migration_gap_fixes.sql` (adds `is_active` to `pc_customer_margin`)
2. Re-sync ALL `pc_*` tables to rebuild with corrected builder logic
3. Verify each module per checklist below using Playwright

## Verification After Fixes

After re-sync, verify each module using Playwright:
- [ ] Sales: Check all 4 group-by dimensions + filters, verify Cash Sales column has values
- [ ] Sales: Verify Outlet shows actual locations (not all Unassigned)
- [ ] Payment: Apply filters on aging chart, confirm data changes
- [ ] Payment: Compare credit scores with manual calculation
- [ ] Return: Verify return amounts match expectations (not inflated by non-return CNs)
- [ ] Supplier: Verify margin % are reasonable (not deflated by tax inclusion)
- [ ] Customer Margin: Verify inactive customers are excluded
- [ ] Customer Margin: Verify product group totals include CN/DN
- [ ] Expenses: Spot check category breakdowns
- [ ] P&L: Cross-reference with known financial statements

## Already Fixed (This Session)

- [x] Cash Sales RM 0 — column ordering bug in `table-sync.ts` (Object.keys → explicit columns from pg fields)
- [x] Outlet Unassigned — changed from `AreaCode` to `SalesLocation` in `buildSalesByOutlet`
