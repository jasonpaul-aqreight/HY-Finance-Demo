# DB Snapshot — financial_variance baseline (2026-05-07)

> Captured at the time the financial_variance baseline was run.
> The eval set in this folder is keyed to this DB state. If pipelines refresh and these numbers change, re-capture before resuming the study.

## Source Tables

`financial_variance` reads from **`pc_pnl_period`** (precomputed P&L by period_no + acc_no). Period_no is an integer encoding (e.g., `24254 = Mar 2024`); the data fetcher's `getFiscalSlice('FY2025', 'fy')` translates fiscalYear → period_no range.

Fiscal year mapping:
- FY2025 = period_no covering March 2024 → February 2025 (Hoi-Yong fiscal calendar)
- Prior YTD = same window in FY2024 (March 2023 → February 2024)

## DB Shape Verification (2026-05-07 22:04)

```
pc_pnl_period
  min_period_no: 24254
  max_period_no: 24313
  distinct periods: 60
  distinct accounts: 1398
  distinct acc_types: 13 (CA, CL, CO, CP, EP, FA, LL, OI, OL, RE, SA, SL, TX)
```

Net movement totals (all periods, sanity check that data is non-empty):

| acc_type | rows  | net_movement (RM)  |
|----------|-------|--------------------|
| SL       |   175 |  -452,517,062     |
| CO       |   594 |   402,538,547     |
| EP       | 4,315 |    35,097,851     |
| CA       |15,116 |    15,680,581     |
| FA       |   461 |    12,393,193     |
| SA       |   181 |    12,409,375     |
| TX       |    15 |     1,394,448     |
| OL       |     5 |      -110,205     |
| LL       |   118 |    -3,540,947     |
| RE       |    19 |      -558,021     |
| OI       |   311 |    -2,893,291     |
| CP       |     1 |      -310,002     |
| CL       | 6,705 |   -19,584,468     |

(SL and OI are credit-natured so net_movement is negative; that's normal accounting double-entry.)

## Key FY2025 Values (sanity check vs UI dashboard)

These match what shows in the UI's "Profit & Loss Statement" table on `/financial`:

| Line Item                 | FY2025          | Prior YTD       | Variance        | Var %    |
|---------------------------|-----------------|-----------------|-----------------|----------|
| Sales (gross)             | RM 84,153,027   | RM 82,236,513   | RM 1,916,514    | +2.3%    |
| Sales Adjustments         | RM -2,632,841   | RM -2,342,203   | RM -290,638     | -12.4%   |
| Cost of Goods Sold        | RM 75,888,549   | RM 72,073,433   | RM 3,815,116    | +5.3%    |
| Gross Profit              | RM 5,631,637    | RM 7,820,877    | RM -2,189,240   | -28.0%   |
| Other Incomes             | RM 1,458,104    | RM 118,187      | RM 1,339,917    | +1133.7% |
| Operating Costs           | RM 9,050,916    | RM 6,559,078    | RM 2,491,838    | +38.0%   |
| Net Profit (pre-tax)      | RM -1,961,176   | RM 1,379,986    | RM -3,341,162   | -242.1%  |
| Taxation                  | RM 0            | RM 222,171      | RM -222,171     | -100.0%  |

## Approved Budget Status

A formal FY2025 budget was approved on **2026-04-19** (post-period). The approved budget equals FY2025 actuals to within RM 4 on every line, so all budget variances are essentially zero. The summary should flag this as a "descriptive / retrospective budget, not a forward target."

## How to Re-Verify

```bash
# Total counts
PGPASSWORD=hoiyong_dev_2026 psql -h localhost -p 5433 -U hoiyong -d hoiyong -t -c "
SELECT MIN(period_no), MAX(period_no), COUNT(DISTINCT period_no), COUNT(DISTINCT acc_no), COUNT(DISTINCT acc_type)
FROM pc_pnl_period;"
# Expected: 24254 | 24313 | 60 | 1398 | 13

# acc_type movements
PGPASSWORD=hoiyong_dev_2026 psql -h localhost -p 5433 -U hoiyong -d hoiyong -c "
SELECT acc_type, COUNT(*) AS rows, ROUND(SUM(home_dr - home_cr)::numeric, 0) AS net_movement
FROM pc_pnl_period GROUP BY acc_type ORDER BY acc_type;"
```

If any of these numbers drift, re-capture `expected_values.json` from a fresh data block.
