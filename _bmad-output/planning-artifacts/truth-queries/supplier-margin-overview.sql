-- Truth queries for Section 3: supplier_margin_overview
-- Each query should match its fetcher output AND the dashboard KpiCards / chart
-- displayed value within RM 1 tolerance.
--
-- Parameters (bind before running):
--   :date_from — ISO date (e.g. '2025-01-01')
--   :date_to   — ISO date (e.g. '2025-12-31')
-- No supplier / item-group filters applied (match a clean un-filtered run).

-- T1. Est. Net Sales — should match sp_net_sales fetcher + KpiCards "Est. Net Sales"
SELECT COALESCE(SUM(sales_revenue), 0)::numeric(18,2) AS net_sales
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T';

-- T2. Est. Cost of Sales — should match sp_cogs fetcher + KpiCards "Est. Cost of Sales"
SELECT COALESCE(SUM(attributed_cogs), 0)::numeric(18,2) AS cogs
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T';

-- T3. Est. Gross Profit — should match sp_gross_profit fetcher + KpiCards "Est. Gross Profit"
SELECT COALESCE(SUM(sales_revenue) - SUM(attributed_cogs), 0)::numeric(18,2) AS gross_profit
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T';

-- T4. Gross Margin % — should match sp_margin_pct fetcher + KpiCards "Gross Margin %"
WITH totals AS (
  SELECT
    SUM(sales_revenue)   AS net_sales,
    SUM(attributed_cogs) AS cogs
  FROM pc_supplier_margin
  WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                  AND to_char(:date_to::date,   'YYYY-MM')
    AND is_active = 'T'
)
SELECT
  CASE WHEN net_sales > 0
    THEN ROUND(((net_sales - cogs) / net_sales * 100)::numeric, 2)
    ELSE 0
  END AS margin_pct
FROM totals;

-- T5. Active Suppliers — should match sp_active_suppliers fetcher + KpiCards "Active Suppliers"
SELECT COUNT(DISTINCT creditor_code) AS active_suppliers
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T'
  AND purchase_qty > 0;

-- T6. Profitability Trend — monthly breakdown for sp_margin_trend fetcher + MarginTrendChart
SELECT
  month,
  SUM(sales_revenue)::numeric(18,2)                          AS net_sales,
  SUM(attributed_cogs)::numeric(18,2)                        AS cogs,
  (SUM(sales_revenue) - SUM(attributed_cogs))::numeric(18,2) AS gross_profit,
  CASE WHEN SUM(sales_revenue) > 0
    THEN ROUND(
      ((SUM(sales_revenue) - SUM(attributed_cogs))
       / SUM(sales_revenue) * 100)::numeric, 2)
    ELSE 0
  END AS margin_pct
FROM pc_supplier_margin
WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                AND to_char(:date_to::date,   'YYYY-MM')
  AND is_active = 'T'
GROUP BY month
ORDER BY month;

-- T7a. Supplier Margin Distribution — Suppliers view
-- Mirrors getSupplierMarginDistributionV2 bucketing (suppliers with rev IS NULL OR rev = 0 go to '< 0%').
WITH supplier_margin AS (
  SELECT
    creditor_code,
    SUM(sales_revenue)   AS rev,
    SUM(attributed_cogs) AS cost
  FROM pc_supplier_margin
  WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                  AND to_char(:date_to::date,   'YYYY-MM')
    AND is_active = 'T'
  GROUP BY creditor_code
),
bucketed AS (
  SELECT
    CASE
      WHEN rev IS NULL OR rev = 0             THEN '< 0%'
      WHEN (rev - cost) / rev * 100 < 0       THEN '< 0%'
      WHEN (rev - cost) / rev * 100 < 5       THEN '0-5%'
      WHEN (rev - cost) / rev * 100 < 10      THEN '5-10%'
      WHEN (rev - cost) / rev * 100 < 15      THEN '10-15%'
      WHEN (rev - cost) / rev * 100 < 20      THEN '15-20%'
      WHEN (rev - cost) / rev * 100 < 30      THEN '20-30%'
      ELSE '30%+'
    END AS bucket
  FROM supplier_margin
)
SELECT bucket, COUNT(*) AS entity_count
FROM bucketed
GROUP BY bucket
ORDER BY CASE bucket
  WHEN '< 0%'   THEN 1
  WHEN '0-5%'   THEN 2
  WHEN '5-10%'  THEN 3
  WHEN '10-15%' THEN 4
  WHEN '15-20%' THEN 5
  WHEN '20-30%' THEN 6
  WHEN '30%+'   THEN 7
END;

-- T7b. Item Margin Distribution — Items view
-- Mirrors getItemMarginDistributionV2 (items with rev <= 0 are EXCLUDED via HAVING).
WITH item_margin AS (
  SELECT
    item_code,
    SUM(sales_revenue)   AS rev,
    SUM(attributed_cogs) AS cost
  FROM pc_supplier_margin
  WHERE month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                  AND to_char(:date_to::date,   'YYYY-MM')
    AND is_active = 'T'
  GROUP BY item_code
  HAVING SUM(sales_revenue) > 0
),
bucketed AS (
  SELECT
    CASE
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 0   THEN '< 0%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 5   THEN '0-5%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 10  THEN '5-10%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 15  THEN '10-15%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 20  THEN '15-20%'
      WHEN (rev - cost) / NULLIF(rev, 0) * 100 < 30  THEN '20-30%'
      ELSE '30%+'
    END AS bucket
  FROM item_margin
)
SELECT bucket, COUNT(*) AS entity_count
FROM bucketed
GROUP BY bucket
ORDER BY CASE bucket
  WHEN '< 0%'   THEN 1
  WHEN '0-5%'   THEN 2
  WHEN '5-10%'  THEN 3
  WHEN '10-15%' THEN 4
  WHEN '15-20%' THEN 5
  WHEN '20-30%' THEN 6
  WHEN '30%+'   THEN 7
END;
