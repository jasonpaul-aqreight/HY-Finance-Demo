# Snapshot State — Eval Set Baseline

> Check these values before each iteration. If they changed, re-capture expected_values.json.

**Captured:** 2026-04-18 | **Re-verified:** 2026-04-18 (post RDS migration)

## pc_ar_customer_snapshot

| Field | Value |
|-------|-------|
| snapshot_date | 2026-04-23 (was 2026-04-05 pre-migration; row count and total unchanged) |
| Total rows | 583 |
| Active rows (outstanding > 0, excl. CASH SALES) | 227 |
| Total outstanding | RM 11,349,862.52 |
| Total overdue | RM 11,349,862.52 |
| Credit limit breaches | 21 |

## pc_ar_aging_history

| Field | Value |
|-------|-------|
| snapshot_date | 2026-04-05 |
| Buckets populated | 120+ only |
| Total invoices | 3,376 |
| Total amount | RM 11,349,862.52 |

Note: All receivables are in the 120+ aging bucket. This is an unusual data state — all invoices are severely overdue.

## Credit usage distribution

| Category | Count |
|----------|-------|
| Within Limit (< 80%) | 300 |
| Near Limit (80-99%) | 10 |
| Over Limit (>= 100%) | 21 |
| No Limit Set | 34 |
| Total | 365 |

## Risk tier distribution

| Risk Tier | Count | Outstanding |
|-----------|-------|-------------|
| High | 29 | RM 6,587,822.96 |
| Moderate | 139 | RM 4,413,431.32 |
| Low | 207 | RM 348,608.24 |

## Verification query

```sql
SELECT MAX(snapshot_date) AS d, COUNT(*) AS rows,
       ROUND(SUM(total_outstanding)::numeric, 2) AS total
FROM pc_ar_customer_snapshot
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pc_ar_customer_snapshot)
  AND total_outstanding > 0 AND company_name NOT ILIKE 'CASH SALES%';
-- Expected: d=2026-04-05, rows=227, total=11349862.52
```
