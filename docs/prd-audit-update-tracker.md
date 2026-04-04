# PRD Docs — Audit & Update Tracker

> **Goal:** Verify each PRD doc against the current (post-audit, post-consolidation) codebase. Fix any sections that are outdated or wrong. Mark each doc as verified.
>
> **Context:** The original PRD docs were written before a SQL audit that produced 5 bug-fix commits and a Phase 4 query consolidation. The code has changed — the docs may not reflect reality.
>
> **Created:** 2026-04-04
> **Last Updated:** 2026-04-04

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
- **Status:** Not Started

### Session 3: Payment Collection (Doc 02)
- **File:** `docs/prd/02-payment.md`
- **Check against:** `apps/dashboard/src/app/payment/`, `src/lib/payment/`, payment API routes
- **Focus areas:** Credit scoring V2 algorithm (weights, tiers), KPI formulas, DSO calculation, aging buckets, credit utilization categories, settings dialog
- **Audit findings to verify:** M2/M3/M4 (dormant V1 code — confirm V2 is documented, not V1)
- **Status:** Not Started

### Session 4: Return / Credit Note (Doc 03)
- **File:** `docs/prd/03-return.md`
- **Check against:** `apps/dashboard/src/app/return/`, `src/lib/return/`, return API routes
- **Focus areas:** Reconciliation states, aging buckets, product exclusion filters, settlement logic
- **Audit findings to verify:** M7 (join direction change — verify doc describes correct behavior)
- **Status:** Not Started

### Session 5: Financial Statements (Doc 04)
- **File:** `docs/prd/04-financial-statements.md`
- **Check against:** `apps/dashboard/src/app/financial/`, `src/lib/pnl/`, pnl API routes
- **Focus areas:** P&L hierarchy, fiscal year convention, KPI calculations, BS snapshot logic, multi-year comparison
- **Audit findings to verify:** PnL cleanest module — likely minimal changes needed
- **Status:** Not Started

### Session 6: Expenses (Doc 05)
- **File:** `docs/prd/05-expenses.md`
- **Check against:** `apps/dashboard/src/app/expenses/`, `src/lib/expenses/`, expenses API routes
- **Focus areas:** OPEX 13 categories, COGS breakdown, trend granularity (monthly only), account hierarchy
- **Audit findings to verify:** M8 (silently returns monthly), 6 improvements in acc_type filtering
- **Status:** Not Started

### Session 7: Customer Margin (Doc 06)
- **File:** `docs/prd/06-customer-margin.md`
- **Check against:** `apps/dashboard/src/app/customer-margin/`, `src/lib/customer-margin/`, margin API routes
- **Focus areas:** Margin formula (IV+DN-CN), credit note impact calculation, distribution buckets, filter dimensions
- **Audit findings to verify:** M1 (inactive customer filter fix — doc should reflect active-only behavior)
- **Status:** Not Started

### Session 8: Supplier Performance (Doc 07)
- **File:** `docs/prd/07-supplier-margin.md`
- **Check against:** `apps/dashboard/src/app/supplier-performance/`, `src/lib/supplier-margin/`, supplier API routes
- **Focus areas:** COGS attribution model, price comparison (min/max/avg), sparklines, item pricing panel, single-supplier-risk
- **Audit findings to verify:** C1 (min/max sell price fix), M5 (weekly→monthly granularity), M6 (weighted avg methodology)
- **Status:** Not Started

### Session 9: Settings & Profiles (Doc 08)
- **File:** `docs/prd/08-settings-and-profiles.md`
- **Check against:** Payment settings components, customer/supplier profile modal components
- **Focus areas:** Credit score settings form, weight sliders, tier thresholds, profile modal tabs and layout
- **Note:** User already updated profile modals in Doc 00 — verify Doc 08 is consistent with those updates
- **Status:** Not Started

### Session 10: Design Standards (Doc 09)
- **File:** `docs/prd/09-design-standards.md`
- **Check against:** All component files, shared components, layout components, memory feedback items
- **Focus areas:** Table standards, readability rules, color system, loading/empty states, responsive patterns
- **Status:** Not Started

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

### Session 1 (2026-04-04)

**Doc:** `docs/prd/00-business-domain.md`
**Sections checked:** All (1–9), including user's prior manual updates to 4.2, 4.3, 6.2, 6.12

**3 fixes applied:**

1. **Section 6.2 (Cancelled Records)** — Edge case originally cited only "credit note records" with null cancellation flag. Updated to cite **both CN and DN**, with scope details (CN in sync builders, DN in both sync builders and dashboard queries).
2. **Section 7 (Sync Schedule)** — Default was "every 6 hours". Updated to **"daily at 6 AM MYT"** (matching code: `0 6 * * *`). Added "environment variable" as a configuration method alongside admin page.
3. **Section 4.3 (Supplier Profile Modal)** — Added **context-sensitive default view** table: Supplier Performance table opens directly to Items view; all other contexts open Profile view.
