# Changelog: Named Cash Debtor Account Visibility

**Date:** 2026-04-05
**Scope:** Return, Customer Margin, and Payment/AR modules
**Impact:** 49 named cash debtor accounts now visible in analytics (previously excluded)

---

## Background

The dashboard originally treated ALL accounts with names starting with "CASH DEBT%" or "CASH SALES%" as anonymous walk-in customers and excluded them from return analysis, customer margin, and payment/AR modules.

Investigation revealed this is incorrect. There are two distinct categories:

| Category | Account | Nature |
|----------|---------|--------|
| **Generic bucket** | 300-C016 "CASH SALES" | Anonymous POS catch-all, no real identity |
| **Named accounts** | 49 "CASH DEBTOR-xxx" / "CASH DEBT - xxx" accounts | Real people/businesses with names, credit limits, payment terms, and repeat transactions |

Named cash debtor accounts have real credit limits (up to RM 100K), payment terms (3–30 days), and carry outstanding balances totalling RM 44,710. The word "CASH" in their name is an accounting artifact — they operate as credit customers.

## Key Data Points

- **PS GROCER** (300-C051): RM 670K annual revenue, 282 returns — was #3 top returner but invisible
- **FRUITS ET JUS** (300-C078): RM 11,389 outstanding, 47 invoices, **616 days overdue** — completely hidden from AR
- **LIN YORK PING** (300-L031): RM 18,995 outstanding — largest hidden balance
- **19 active named accounts** represent RM 2.36M in annual revenue (0.63% of total)

## Changes Made

### Rule Change

| Analysis Type | Generic "CASH SALES" (300-C016) | Named "CASH DEBTOR-xxx" (49 accounts) |
|---|---|---|
| Sales Revenue | Include (unchanged) | Include (unchanged) |
| Payment/AR | Exclude (unchanged) | **Now included** |
| Return (customer-level) | Exclude (unchanged) | **Now included** |
| Customer Margin | Exclude (unchanged) | **Now included** |

### Files Modified

#### `apps/sync-service/src/builders.ts`

8 builders affected — removed `CASH DEBT%` from exclusion filters while keeping `CASH SALES%` excluded:

| Builder Function | Table | Change |
|---|---|---|
| `buildArMonthly` | `pc_ar_monthly` | `non_customer` CTE: removed `CASH DEBT%` from exclusion |
| `buildArCustomerSnapshot` | `pc_ar_customer_snapshot` | `non_customer` CTE: removed `CASH DEBT%` from exclusion |
| `buildArAgingHistory` | `pc_ar_aging_history` | Removed `NOT ILIKE 'CASH DEBT%'` WHERE clause |
| `buildReturnMonthly` | `pc_return_monthly` | Removed `NOT ILIKE 'CASH DEBT%'` WHERE clause |
| `buildReturnByCustomer` | `pc_return_by_customer` | Removed `NOT ILIKE 'CASH DEBT%'` WHERE clause |
| `buildCustomerMargin` | `pc_customer_margin` | Changed from two-line exclusion to single `NOT ILIKE 'CASH SALES%'` |
| `buildCustomerMarginByProduct` | `pc_customer_margin_by_product` | Same as above |

#### `apps/dashboard/src/lib/payment/queries.ts`

9 query locations changed — removed `NOT ILIKE 'CASH DEBT%'` filter from:

- `getCreditUtilization` (line 427)
- `getKpis` — Total Outstanding (line 455)
- `getKpis` — Credit Limit Breaches (line 466)
- `getCreditHealthTable` (line 553)
- `getKpisV2` — Total Outstanding (line 717)
- `getKpisV2` — Overdue Customers (line 727)
- `getKpisV2` — Credit Limit Breaches (line 761)
- `getCreditUtilizationV2` (line 803)
- `getCreditHealthTableV2` (line 876)

#### `apps/dashboard/src/lib/return/queries.ts`

2 query locations changed — removed `NOT ILIKE 'CASH DEBT%'` filter from:

- `getCustomerReturnDetailsAll` (line 250)
- `getCustomerReturnDetails` (line 275)

### No changes needed

- **Customer Margin dashboard queries** (`customer-margin/queries.ts`): No filters existed — the pre-computed table was the only filter point, which was fixed in the builder.
- **Sales queries**: Already included all accounts (no change needed).
- **Supplier Margin**: Not affected — filters by supplier, not customer.

## Verification

### Pre-computed table row counts (before → after)

| Table | Before | After | Delta |
|---|---|---|---|
| `pc_ar_customer_snapshot` (latest date) | 541 | 583 | +42 named cash debtors |
| `pc_return_by_customer` | no cash debtors | 16 accounts with returns | +16 |
| `pc_customer_margin` | no cash debtors | 42 accounts with margin data | +42 |

### KPI changes (Payment page)

| Metric | Before | After | Delta |
|---|---|---|---|
| Total Outstanding | RM 11,305,152 | RM 11,349,863 | +RM 44,711 |
| Customers with outstanding | 217 | 227 | +10 |
| Credit Limit Breaches | 21 | 21 | unchanged |

### Browser verification (Playwright)

- **Returns page**: Searched "CASH" — 4 named cash debtors visible (PS GROCER: 282 returns, W J: 7, FRUITS ET JUS: 30, RAMAI FOOD: 85). Generic CASH SALES absent.
- **Payment page**: Searched "CASH DEBT" — 18 named cash debtors visible with correct outstanding balances, credit limits, aging counts, and risk levels. Generic CASH SALES absent.
- **Customer Margin**: Pre-computed table confirmed 42 cash debtor accounts with margin data. FRUITS ET JUS showing -157.94% margin (actionable finding).

## Bug Found and Fixed

The initial implementation (by another AI agent) modified the dashboard query layer for Payment/AR but missed the 3 AR builder functions in the sync service (`buildArMonthly`, `buildArCustomerSnapshot`, `buildArAgingHistory`). This created a silent mismatch — the dashboard was ready to display cash debtors, but the pre-computed tables they query never included them. The fix was applying the same filter change to all 3 AR builders.
