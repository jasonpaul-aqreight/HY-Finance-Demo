# SQL Query Audit — Findings Report

**Audit Period:** 2026-04-03 (5 sessions)
**Scope:** 11 modules, ~119 function pairs — old raw-table queries vs new pre-computed `pc_*` queries
**Auditor:** Mary (Strategic Business Analyst) + manual verification against RDS

---

## Executive Summary

The audit compared every query function between the old Finance codebase and the new dashboard codebase. Out of ~119 function pairs across 11 modules:

- **1 CRITICAL finding** — resolved (commit `c2af3eb`)
- **8 MEDIUM findings** — all resolved or accepted (see details)
- **1 LOW finding** — accepted (dormant code path)
- **8 improvements** identified in the new codebase over old
- **~100 function pairs** cleared as structurally equivalent

**Conclusion:** The new codebase is production-ready. All critical and actionable findings have been fixed. Remaining medium findings are either dormant (unreachable code paths), informational (known trade-offs), or improvements over the old system.

---

## Findings Detail

### CRITICAL (data accuracy — changes numbers)

| ID | Module | Function | Finding | Status |
|----|--------|----------|---------|--------|
| C1 | Supplier Margin v2 | `getItemSellPriceV2` | **Fallback path** (pre-computed table) returned weighted avg for min/max sell price instead of true transaction-level values. 44% of items affected, RM 4-90 ranges collapsed to single value. | **RESOLVED** — `c2af3eb`: fallback now returns NULL for min/max instead of fake values. Primary path (RDS raw tables) always returned correct min/max. |

### MEDIUM (structural differences — could affect results)

| ID | Module | Function | Finding | Risk | Status |
|----|--------|----------|---------|------|--------|
| M1 | Customer Margin | `buildProductFilter` | Missing `is_active='T'` filter — `getMarginByProductGroup` and `getProductCustomerMatrix` included 209 inactive debtors (RM 25.6M lifetime, ~RM 330K in 2025). | Active | **FIXED** — `6a3f30f`: added always-on `is_active='T'` subquery. Verified: inactive customer 300-S030 (RM 167K) correctly excluded. |
| M2 | Payment v1 | `getAgingBuckets` | Combined filter (type+agent) fallback uses customer-level `max_overdue_days` bucketing instead of invoice-level. | Dormant | **ACCEPTED** — V2 dashboard (sole UI) never calls this endpoint with combined filters. No user impact unless V1 endpoints are re-exposed. |
| M3 | Payment v1 | `getCollectionTrend` | Aggregate path ignores dimension filters (type/agent). | Dormant | **ACCEPTED** — Same as M2. V2 dashboard uses V2 endpoint which handles filters correctly. |
| M4 | Payment v1 | `getCreditHealthTable` | Approximates component scores and hardcodes `cn_frequency=50`. V2 recalculates correctly. | Informational | **ACCEPTED** — V1 endpoint is superseded by V2. No UI calls V1 version. |
| M5 | Supplier Margin v2 | `getItemPriceWeeklyV2` | Weekly granularity lost — `pc_supplier_margin` stores monthly grain only. Old system had weekly breakdown from raw tables. | Informational | **ACCEPTED** — Known trade-off of pre-computed architecture. Monthly granularity sufficient for current business needs. Weekly data still available via RDS primary path. |
| M6 | Supplier Margin v2 | weighted avg methodology | New pre-computed tables use weighted average (revenue/qty) vs old simple average. | Informational | **ACCEPTED** — Weighted average is more accurate for volume-weighted pricing analysis. This is an improvement. |
| M7 | Return v2 | `getCustomerReturnDetailsAll` / `getCustomerReturnDetails` | Reversed join direction — queries CN→ARCN instead of ARCN→CN; `net_total` sourced from CN instead of ARCN. | Informational | **ACCEPTED** — 1:1 correspondence between CN and ARCN return records. CN-as-source is more correct (it's the authoritative document). No data impact. |
| M8 | Expenses | `getCostTrendByType` | Accepts daily/weekly granularity parameter but silently returns monthly data (limited by `pc_expense_monthly` table grain). | Informational | **ACCEPTED** — No UI currently passes daily/weekly granularity. Monthly is the only used resolution. Would need a new `pc_expense_daily` table if finer grain is needed in future. |

### LOW (minor / cosmetic)

| ID | Module | Function | Finding | Status |
|----|--------|----------|---------|--------|
| L1 | Payment v1 | `getCreditUtilization` | Missing `is_active IS NULL` fallback for edge cases. V2 version handles this correctly. | **ACCEPTED** — V1 endpoint dormant. V2 is active and correct. |

---

## Improvements in New Codebase

These are cases where the new code is **better** than the old — no action needed.

| Module | Improvement |
|--------|-------------|
| Customer Margin | `getCustomerProducts` now includes DN+CN documents (old was IV-only); pagination added |
| Payment | CASH-type customers correctly excluded across all payment queries |
| Return | Broader non-product exclusion filters (ZZ%, XX%, RE%) vs old (ZZ% only) |
| Return | Customer trend now date-range-scoped (old hardcoded last 12 months) |
| Expenses | 6 V1 queries now correctly filter `acc_type IN ('CO','EP')` — old included ALL GL account types, inflating denominators for COGS%/OPEX% calculations |
| PnL | `getV2Health` replaced hardcoded `PeriodNo BETWEEN 24255 AND ?` with dynamic `MIN(period_no)` — eliminates magic number |
| Supplier Margin | Weighted average pricing is more accurate than simple average for volume analysis |
| Supplier Margin | `getItemSellPriceV2` primary path now queries RDS raw tables for true transaction-level min/max |

---

## Risk Pattern Checklist — All Verified

| Pattern | Result |
|---------|--------|
| `is_active = 'T'` filter | Checked all 11 modules. Fixed in Customer Margin (M1). |
| `Cancelled = 'F'` on IV/CS/CN | Verified present across all modules. |
| UTC +8 date handling | Verified. Pre-computed tables handle timezone at sync time. |
| Revenue formula (IV + CS - CN) | Verified in Sales and PnL modules. |
| `LocalNetTotal` for SGD edge cases | Verified in Return and Sales modules. |
| ZZ-ZZ% non-product exclusion | Verified. Return module has broader exclusion (improvement). |

---

## Commits from Audit

| Commit | Description |
|--------|-------------|
| `b87a7c8` | Fix supplier profile data consistency: add `is_active` filter |
| `6a3f30f` | Fix customer margin: exclude inactive customers from product group analysis |
| `44c39ba` | Fix return unresolved calculation: use ARCN amount for settlement math |
| `c362749` | Fix item sell price accuracy: query RDS raw data instead of pre-computed table |
| `c2af3eb` | Fix item sell price fallback: return null instead of fake min/max |

---

## Conclusion

The new pre-computed table architecture is production-ready. The audit found 1 critical and 1 actionable medium issue — both fixed and verified. The remaining findings are dormant V1 code paths (superseded by V2) or known trade-offs that were deliberate design decisions.

**Recommendation:** Proceed with production deployment. Optionally, Phase 4 (query file consolidation) can clean up the dormant V1 code to reduce future confusion.
