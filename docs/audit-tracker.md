# SQL Query Audit Tracker

**Purpose:** Systematic comparison of old raw-table queries vs new pre-computed `pc_*` table queries before production deployment.
**Created:** 2026-04-03
**Method:** Code-level SQL diff — compare WHERE clauses, JOINs, GROUP BYs, aggregations, date handling, filters.

---

## Phase 1: Inventory & Pairing (this document)

- [x] Catalog all query functions in both codebases
- [x] Estimate scope and plan sessions

## Phase 2: Module-by-Module Audit

Each module is one session. Compare old vs new query-by-query, document findings inline.

| # | Module | Old File | New File | Functions | Status | Findings |
|---|--------|----------|----------|-----------|--------|----------|
| 1 | Supplier Margin (v1) | `old_Finance/.../supplier-margin/queries.ts` (18 fn) | `dashboard/.../supplier-margin/queries.ts` (18 fn) | 18 | DONE | 1C, 2M |
| 2 | Supplier Margin (v2) | `old_Finance/.../supplier-margin/queries-v2.ts` (16 fn) | `dashboard/.../supplier-margin/queries-v2.ts` (16 fn) | 16 | DONE | (same findings — shared code) |
| 3 | Customer Margin | `old_Finance/.../customer-margin/queries.ts` (16 fn) | `dashboard/.../customer-margin/queries.ts` (16 fn) | 16 | DONE | 1M |
| 4 | Payment (v1) | `old_Finance/.../payment/queries.ts` (10 fn) | `dashboard/.../payment/queries.ts` (10 fn) | 10 | DONE | 2M (dormant), 1M (info), 1L |
| 5 | Payment (v2) | `old_Finance/.../payment/queries-v2.ts` (5 fn) | `dashboard/.../payment/queries-v2.ts` (5 fn) | 5 | DONE | (all cleared — improvements only) |
| 6 | PnL (v1) | `old_Finance/.../pnl/queries.ts` (10 fn) | `dashboard/.../pnl/queries.ts` (10 fn) | 10 | DONE | (all cleared) |
| 7 | PnL (v2) | `old_Finance/.../pnl/queries-v2.ts` (9 fn) | `dashboard/.../pnl/queries-v2.ts` (9 fn) | 9 | DONE | (all cleared — 1 improvement) |
| 8 | PnL (v3) | `old_Finance/.../pnl/queries-v3.ts` (4 fn) | `dashboard/.../pnl/queries-v3.ts` (4 fn) | 4 | DONE | (all cleared) |
| 9 | Return (v2) | `old_Finance/.../return/queries-v2.ts` (13 fn) | `dashboard/.../return/queries-v2.ts` (13 fn) | 13 | DONE | 1M (info) |
| 10 | Sales (v2) | `old_Finance/.../sales/queries-v2.ts` (3 fn) | `dashboard/.../sales/queries-v2.ts` (3 fn) | 3 | DONE | (all cleared) |
| 11 | Expenses | `old_Finance/.../expenses/queries.ts` (15 fn) | `dashboard/.../expenses/queries.ts` (15 fn) | 15 | DONE | 1M (info), 6 improvements |

**Total: 11 modules, ~119 function pairs**

## Phase 3: Risk-Rated Findings Report — DONE

**Report:** [`docs/audit-findings-report.md`](audit-findings-report.md)
**Completed:** 2026-04-04

Summary: 1 CRITICAL (resolved), 8 MEDIUM (all resolved/accepted), 1 LOW (accepted), 8 improvements noted. **Production-ready.**

## Phase 4: Query File Consolidation (post-audit)

**Prerequisite:** All 5 audit sessions complete and findings resolved. (**Done**)

**Goal:** Merge v1/v2/v3 query files into a single `queries.ts` per module + rewire API routes.

| # | Module | Current Files | Target | Complexity | Import Updates | Status |
|---|--------|--------------|--------|------------|----------------|--------|
| 1 | Return | ~~queries-v2.ts~~ → queries.ts | Rename | Trivial | 13 files | DONE (2026-04-04) |
| 2 | Sales | ~~queries-v2.ts~~ → queries.ts | Rename | Trivial | 2 files | DONE (2026-04-04) |
| 3 | Payment | ~~queries-v2.ts~~ merged into queries.ts | Single queries.ts | Low | 6 files | DONE (2026-04-04) |
| 4 | Supplier Margin | ~~queries-v2.ts~~ merged into queries.ts | Single queries.ts | Moderate | 9 files (2 had dual imports merged) | DONE (2026-04-04) |
| 5 | PnL | ~~queries-v2.ts~~ + ~~queries-v3.ts~~ merged into queries.ts | Single queries.ts | High | 7 files (v3→queries) | DONE (2026-04-04) |

### Consolidation Notes

All 3 remaining modules consolidated in one session (2026-04-04):
- **Payment:** v2 content appended to v1, cross-dependency on `getRefDate` resolved naturally. 6 import updates, 2 dual-import merges.
- **Supplier Margin:** v2 content appended to v1, duplicate `Granularity`/`periodExpr` kept only in v1 section, v2 filter helpers added. `getRdsPool` import added. 9 import updates.
- **PnL:** Most complex — v2 private helpers renamed (`queryPLRawV2`, `aggregatePLV2`) to avoid conflicts with v1's PascalCase versions. V3 functions inlined directly (cross-file refs resolved to local calls). 7 import updates. `types/pnl-v2.ts` kept as external type file (unchanged).

## Known Risk Patterns to Check Every Query

- [x] `is_active = 'T'` filter present where needed (caused 2 bugs already) — **Checked all modules. Fixed in Customer Margin (Session 2).**
- [x] `Cancelled = 'F'` filter present on IV/CS/CN queries — **Verified across all 11 modules.**
- [x] Date handling: UTC +8 for MYT (`DocDate + INTERVAL '8 hours'`) — **Verified. Pre-computed tables handle this at sync time.**
- [x] Revenue formula: SUM(IV.NetTotal) + SUM(CS.NetTotal) - SUM(CN.NetTotal) — **Verified in Sales and PnL modules.**
- [x] `LocalNetTotal` used for SGD edge cases — **Verified in Return and Sales modules.**
- [x] ZZ-ZZ% exclusion for non-product items in supplier margin — **Verified. Return module has broader exclusion (improvement).**

---

## Session Log

| Session | Date | Modules Covered | Key Findings |
|---------|------|-----------------|--------------|
| 1 | 2026-04-03 | Supplier Margin v1 + v2 (34 fn) | **1 CRITICAL**: C1 — `getItemSellPriceV2` min/max sell price returns weighted avg instead of true transaction-level min/max (44% of items affected, RM 4-90 range collapsed to 49.94). **2 MEDIUM (informational)**: M3/M4 — weighted avg is improvement over old; M5 — weekly granularity lost (known trade-off). **5 cleared**: ZZ-ZZ% filter, supplier count, supplier_type isactive, creditor_type column, margin methodology — all verified correct against RDS data. |
| 2 | 2026-04-03 | Customer Margin (16 fn) | **1 MEDIUM (FIXED)**: M1 — `buildProductFilter` missing `is_active='T'` filter — `getMarginByProductGroup` and `getProductCustomerMatrix` included inactive customers (209 debtors, RM 25.6M lifetime, ~RM 330K in 2025). Fixed by adding always-on `is_active='T'` subquery against `pc_customer_margin` in `buildProductFilter`. Verified via API: inactive customer 300-S030 (RM 167K) correctly excluded. **2 cleared (improvements)**: `getCustomerProducts` now includes DN+CN (old was IV-only); pagination added. **13 cleared**: KPI, trend, customer list, monthly, type breakdown, CN impact, distribution, 4 filter lookups, data quality, date bounds — all structurally equivalent. |
| 3 | 2026-04-03 | Payment v1 + v2 (15 fn) | **0 CRITICAL. 2 MEDIUM (dormant)**: M1 — `getAgingBuckets` combined filter (type+agent) fallback uses customer-level `max_overdue_days` bucketing instead of invoice-level; M2 — `getCollectionTrend` aggregate path ignores dimension filters. Both dormant: V2 dashboard (sole UI) calls these endpoints without filters. **1 MEDIUM (informational)**: M3 — V1 `getCreditHealthTable` approximates component scores, hardcodes cn_frequency=50. V2 recalculates correctly. **1 LOW**: L1 — V1 `getCreditUtilization` missing `is_active IS NULL` fallback. **11 cleared**: getRefDate, getDimensions, getAgingBucketsByDimension, getDsoTrend (v1+v2), getKpis (v1+v2), getCreditUtilizationV2, getCreditHealthTableV2, getCustomerInvoices, getCustomerProfile — all structurally equivalent with CASH exclusion improvements. |
| 4 | 2026-04-03 | PnL v1 + v2 + v3 (23 fn) | **0 CRITICAL. 0 MEDIUM. 0 LOW.** Cleanest module — all 23 functions structurally equivalent. Migration from SQLite raw tables (`pbalance`/`gl_mast`/`obalance`) to PostgreSQL pre-computed tables (`pc_pnl_period`/`pc_opening_balance`/`gl_account`) executed with high fidelity. **1 improvement noted**: `getV2Health` replaced hardcoded `PeriodNo BETWEEN 24255 AND ?` with dynamic `MIN(period_no)` query — eliminates magic number. SQL dialect differences (strftime→EXTRACT, `?`→`$N`, additional GROUP BY columns for PG strict mode) verified as non-impactful. P&L formula (SL+SA−CO±OI−EP−TX), CreditAsPositive sign logic, BS snapshot aggregation, expense category grouping, YoY growth%, and all derived calculations match exactly. |
| 5 | 2026-04-03 | Return v2 + Sales v2 + Expenses (31 fn) |
| 6 | 2026-04-04 | Phase 3 report + Phase 4 trivial renames | Phase 3 findings report generated (`docs/audit-findings-report.md`). Return + Sales renamed from queries-v2.ts → queries.ts + 15 import updates. TypeScript clean. | **0 CRITICAL. 2 MEDIUM (informational). 0 LOW.**
| 7 | 2026-04-04 | Phase 4 consolidation (Payment + Supplier Margin + PnL) | All 3 remaining modules consolidated: queries-v2.ts (and queries-v3.ts for PnL) merged into single queries.ts per module. 22 import updates across API routes, hooks, and components. `tsc --noEmit` clean. | No findings — consolidation only (no query logic changes). M1: Return `getCustomerReturnDetailsAll`/`getCustomerReturnDetails` reversed join direction — queries CN→ARCN instead of ARCN→CN; net_total sourced from CN instead of ARCN; no data impact (1:1 RETURN correspondence), CN-as-source is more correct. M2: Expenses `getCostTrendByType` accepts daily/weekly granularity but silently returns monthly data (pc_expense_monthly limitation). **8 improvements noted**: Return — broader ZZ/XX/RE non-product exclusion filters, date-range-scoped customer trend (was hardcoded last 12 months). Expenses — 6 V1 queries now correctly filter `acc_type IN ('CO','EP')` (old included ALL GL account types in total_costs, inflating denominators for COGS%/OPEX% calculations). Sales v2 cleanest — all 7 query functions (3 exported + 4 private) structurally equivalent. |

---

## Status

**All phases complete.** The audit (Phases 1–3) and consolidation (Phase 4) are done. Every module now has a single `queries.ts` file. The codebase passes `tsc --noEmit` with zero errors.
