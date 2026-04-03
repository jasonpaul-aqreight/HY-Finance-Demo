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
| 4 | Payment (v1) | `old_Finance/.../payment/queries.ts` (10 fn) | `dashboard/.../payment/queries.ts` (10 fn) | 10 | NOT STARTED | — |
| 5 | Payment (v2) | `old_Finance/.../payment/queries-v2.ts` (5 fn) | `dashboard/.../payment/queries-v2.ts` (5 fn) | 5 | NOT STARTED | — |
| 6 | PnL (v1) | `old_Finance/.../pnl/queries.ts` (10 fn) | `dashboard/.../pnl/queries.ts` (10 fn) | 10 | NOT STARTED | — |
| 7 | PnL (v2) | `old_Finance/.../pnl/queries-v2.ts` (9 fn) | `dashboard/.../pnl/queries-v2.ts` (9 fn) | 9 | NOT STARTED | — |
| 8 | PnL (v3) | `old_Finance/.../pnl/queries-v3.ts` (4 fn) | `dashboard/.../pnl/queries-v3.ts` (4 fn) | 4 | NOT STARTED | — |
| 9 | Return (v2) | `old_Finance/.../return/queries-v2.ts` (13 fn) | `dashboard/.../return/queries-v2.ts` (13 fn) | 13 | NOT STARTED | — |
| 10 | Sales (v2) | `old_Finance/.../sales/queries-v2.ts` (3 fn) | `dashboard/.../sales/queries-v2.ts` (3 fn) | 3 | NOT STARTED | — |
| 11 | Expenses | `old_Finance/.../expenses/queries.ts` (15 fn) | `dashboard/.../expenses/queries.ts` (15 fn) | 15 | NOT STARTED | — |

**Total: 11 modules, ~119 function pairs**

## Phase 3: Risk-Rated Findings Report

Generated after all modules are audited. Categories:
- **CRITICAL** — Missing filter or wrong aggregation (changes numbers)
- **MEDIUM** — Structural difference that could affect results
- **LOW** — Cosmetic / naming only

## Phase 4: Query File Consolidation (post-audit)

**Prerequisite:** All 5 audit sessions complete and findings resolved.

**Goal:** Merge v1/v2/v3 query files into a single `queries.ts` per module + rewire API routes.

| Module | Current Files | Target | Complexity |
|--------|--------------|--------|------------|
| Supplier Margin | queries.ts (v1) + queries-v2.ts | Single queries.ts | High — UI calls both v1 (11 endpoints) and v2 (2 endpoints) |
| Payment | queries.ts (v1) + queries-v2.ts | Single queries.ts | High — UI calls both v1 (aging, collection) and v2 (KPIs, credit) |
| PnL | queries.ts (v1) + queries-v2.ts + queries-v3.ts | Single queries.ts | Medium — v3 is primary, v1 only used for types |
| Return | queries-v2.ts only | Rename to queries.ts | Low — no v1 exists |
| Sales | queries-v2.ts only | Rename to queries.ts | Low — single file already |

**Status:** NOT STARTED — begins after Phase 3

## Known Risk Patterns to Check Every Query

- [ ] `is_active = 'T'` filter present where needed (caused 2 bugs already)
- [ ] `Cancelled = 'F'` filter present on IV/CS/CN queries
- [ ] Date handling: UTC +8 for MYT (`DocDate + INTERVAL '8 hours'`)
- [ ] Revenue formula: SUM(IV.NetTotal) + SUM(CS.NetTotal) - SUM(CN.NetTotal)
- [ ] `LocalNetTotal` used for SGD edge cases
- [ ] ZZ-ZZ% exclusion for non-product items in supplier margin

---

## Session Log

| Session | Date | Modules Covered | Key Findings |
|---------|------|-----------------|--------------|
| 1 | 2026-04-03 | Supplier Margin v1 + v2 (34 fn) | **1 CRITICAL**: C1 — `getItemSellPriceV2` min/max sell price returns weighted avg instead of true transaction-level min/max (44% of items affected, RM 4-90 range collapsed to 49.94). **2 MEDIUM (informational)**: M3/M4 — weighted avg is improvement over old; M5 — weekly granularity lost (known trade-off). **5 cleared**: ZZ-ZZ% filter, supplier count, supplier_type isactive, creditor_type column, margin methodology — all verified correct against RDS data. |
| 2 | 2026-04-03 | Customer Margin (16 fn) | **1 MEDIUM (FIXED)**: M1 — `buildProductFilter` missing `is_active='T'` filter — `getMarginByProductGroup` and `getProductCustomerMatrix` included inactive customers (209 debtors, RM 25.6M lifetime, ~RM 330K in 2025). Fixed by adding always-on `is_active='T'` subquery against `pc_customer_margin` in `buildProductFilter`. Verified via API: inactive customer 300-S030 (RM 167K) correctly excluded. **2 cleared (improvements)**: `getCustomerProducts` now includes DN+CN (old was IV-only); pagination added. **13 cleared**: KPI, trend, customer list, monthly, type breakdown, CN impact, distribution, 4 filter lookups, data quality, date bounds — all structurally equivalent. |

---

## How to Resume

1. Load `/bmad-agent-analyst` (Mary)
2. Say: "Resume audit — load `docs/audit-tracker.md`"
3. Mary picks up the next NOT STARTED module
