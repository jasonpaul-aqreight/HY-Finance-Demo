-- Truth queries for section: customer_margin_overview
-- Quality gate (v1 §9.5): each query must match BOTH (a) the corresponding
-- data-fetcher value and (b) the dashboard displayed value (±RM 1 tolerance).
--
-- Population: `is_active = 'T'` is applied by buildMarginFilter in queries.ts.
-- All these truth queries mirror that filter to match the dashboard exactly.
-- NO customer/type/agent filters applied — run them against an un-filtered view.
--
-- Parameters (bind before running):
--   :date_from -- ISO date, e.g. '2025-01-01'
--   :date_to   -- ISO date, e.g. '2025-12-31'
-- Both are converted to YYYY-MM internally to match pc_customer_margin.month (text column).

-- ─────────────────────────────────────────────────────────────────────────────
-- T1. Net Sales
-- Should match: cm_net_sales fetcher + KpiCards "Net Sales" card
-- Dashboard source: getMarginKpi() in customer-margin/queries.ts
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COALESCE(SUM(iv_revenue + dn_revenue - cn_revenue), 0)::numeric(18, 2) AS net_sales
FROM pc_customer_margin
WHERE is_active = 'T'
  AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                AND substring(:date_to::text   FROM 1 FOR 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- T2. COGS (Cost of Sales)
-- Should match: cm_cogs fetcher + KpiCards "Cost of Sales" card
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COALESCE(SUM(iv_cost + dn_cost - cn_cost), 0)::numeric(18, 2) AS cogs
FROM pc_customer_margin
WHERE is_active = 'T'
  AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                AND substring(:date_to::text   FROM 1 FOR 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- T3. Gross Profit
-- Should match: cm_gross_profit fetcher + KpiCards "Gross Profit" card
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COALESCE(
         SUM(iv_revenue + dn_revenue - cn_revenue)
         - SUM(iv_cost + dn_cost - cn_cost),
         0
       )::numeric(18, 2) AS gross_profit
FROM pc_customer_margin
WHERE is_active = 'T'
  AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                AND substring(:date_to::text   FROM 1 FOR 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- T4. Gross Margin %
-- Should match: cm_margin_pct fetcher + KpiCards "Gross Margin %" card
-- Formula: (Gross Profit / Net Sales) × 100, rounded to 2 decimal places
-- ─────────────────────────────────────────────────────────────────────────────
WITH totals AS (
  SELECT
    SUM(iv_revenue + dn_revenue - cn_revenue) AS net_sales,
    SUM(iv_cost + dn_cost - cn_cost)          AS cogs
  FROM pc_customer_margin
  WHERE is_active = 'T'
    AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                  AND substring(:date_to::text   FROM 1 FOR 7)
)
SELECT
  CASE WHEN net_sales > 0
       THEN ROUND(((net_sales - cogs) / net_sales * 100)::numeric, 2)
       ELSE 0
  END AS margin_pct
FROM totals;

-- ─────────────────────────────────────────────────────────────────────────────
-- T5. Active Customers
-- Should match: cm_active_customers fetcher + KpiCards "Active Customers" card
-- Dashboard uses COUNT(DISTINCT debtor_code) with is_active='T' applied by
-- buildMarginFilter. Any customer that has at least one row in the period
-- counts — non-zero revenue is NOT required (this matches getMarginKpi).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COUNT(DISTINCT debtor_code) AS active_customers
FROM pc_customer_margin
WHERE is_active = 'T'
  AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                AND substring(:date_to::text   FROM 1 FOR 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- T6. Margin Trend (monthly breakdown)
-- Should match: cm_margin_trend fetcher + MarginTrendChart bars/line
-- Dashboard source: getMarginTrend() in customer-margin/queries.ts
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  month AS period,
  ROUND(SUM(iv_revenue + dn_revenue - cn_revenue)::numeric, 2)::float AS revenue,
  ROUND(SUM(iv_cost + dn_cost - cn_cost)::numeric, 2)::float          AS cogs,
  ROUND(
    (SUM(iv_revenue + dn_revenue - cn_revenue)
     - SUM(iv_cost + dn_cost - cn_cost))::numeric, 2
  )::float AS gross_profit,
  CASE WHEN SUM(iv_revenue + dn_revenue - cn_revenue) > 0
       THEN ROUND(
              ((SUM(iv_revenue + dn_revenue - cn_revenue)
                - SUM(iv_cost + dn_cost - cn_cost))
               / SUM(iv_revenue + dn_revenue - cn_revenue) * 100)::numeric, 2
            )::float
       ELSE 0
  END AS margin_pct
FROM pc_customer_margin
WHERE is_active = 'T'
  AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                AND substring(:date_to::text   FROM 1 FOR 7)
GROUP BY month
ORDER BY month;

-- ─────────────────────────────────────────────────────────────────────────────
-- T7. Margin Distribution (customer count per bucket)
-- Should match: cm_margin_distribution fetcher + MarginDistributionChart bars
-- Dashboard source: getMarginDistribution() in customer-margin/queries.ts
-- IMPORTANT: The distribution excludes customers with ≤ RM 1,000 of revenue
-- in the period (HAVING clause). This matches the dashboard population.
-- Buckets are the exact 7 hardcoded ranges used by MarginDistributionChart.tsx.
-- ─────────────────────────────────────────────────────────────────────────────
WITH per_customer AS (
  SELECT
    debtor_code,
    CASE WHEN SUM(iv_revenue + dn_revenue - cn_revenue) > 0
         THEN (SUM(iv_revenue + dn_revenue - cn_revenue)
               - SUM(iv_cost + dn_cost - cn_cost))
              / SUM(iv_revenue + dn_revenue - cn_revenue) * 100
         ELSE -999
    END AS margin_pct
  FROM pc_customer_margin
  WHERE is_active = 'T'
    AND month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                  AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY debtor_code
  HAVING SUM(iv_revenue + dn_revenue - cn_revenue) > 1000
)
SELECT
  CASE
    WHEN margin_pct < 0  THEN '< 0%'
    WHEN margin_pct < 5  THEN '0-5%'
    WHEN margin_pct < 10 THEN '5-10%'
    WHEN margin_pct < 15 THEN '10-15%'
    WHEN margin_pct < 20 THEN '15-20%'
    WHEN margin_pct < 30 THEN '20-30%'
    ELSE                       '30%+'
  END AS bucket,
  COUNT(*) AS customer_count
FROM per_customer
GROUP BY bucket
ORDER BY CASE
  WHEN margin_pct < 0  THEN 1
  WHEN margin_pct < 5  THEN 2
  WHEN margin_pct < 10 THEN 3
  WHEN margin_pct < 15 THEN 4
  WHEN margin_pct < 20 THEN 5
  WHEN margin_pct < 30 THEN 6
  ELSE                      7
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- Three-way match protocol (v1 §9.5):
--   Fetcher value ↔ truth query value ↔ dashboard displayed value
-- If all three agree (within RM 1 rounding) for every query above, the
-- section passes. If any two agree and the third differs, the third has a bug.
-- ─────────────────────────────────────────────────────────────────────────────
