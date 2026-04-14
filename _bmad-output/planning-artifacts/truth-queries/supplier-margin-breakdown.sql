-- Truth queries for AI Insight v2 §4 — supplier_margin_breakdown
--
-- Parameters (bind before running):
--   :date_from — ISO date (e.g. '2025-01-01')
--   :date_to   — ISO date (e.g. '2025-12-31')
-- startMonth = to_char(:date_from::date, 'YYYY-MM')
-- endMonth   = to_char(:date_to::date,   'YYYY-MM')
--
-- Every query below must match:
--   (a) the corresponding fetcher output in apps/dashboard/src/lib/ai-insight/data-fetcher.ts,
--   (b) the on-page dashboard value (within ±RM 1 tolerance),
--   (c) the supplier-margin V2 query function output in apps/dashboard/src/lib/supplier-margin/queries.ts.

-- ─── T1. Top 10 suppliers by Est. Gross Profit ──────────────────────────────
-- Matches: sm_top_bottom (suppliers × profit × highest) + TopBottomChart default
SELECT
  m.creditor_code,
  m.creditor_name,
  ROUND(SUM(m.sales_revenue)::numeric, 2) AS revenue,
  ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2) AS profit,
  ROUND(
    ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
     / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
  ) AS margin_pct
FROM pc_supplier_margin m
WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                 AND to_char(:date_to::date,   'YYYY-MM')
  AND m.is_active = 'T'
GROUP BY m.creditor_code, m.creditor_name
ORDER BY profit DESC NULLS LAST
LIMIT 10;

-- ─── T2. Top 10 suppliers by Margin % (revenue floor RM 10,000) ─────────────
-- Matches: sm_top_bottom (suppliers × margin% × highest) post-fetcher filter
SELECT
  m.creditor_code,
  m.creditor_name,
  ROUND(SUM(m.sales_revenue)::numeric, 2) AS revenue,
  ROUND(
    ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
     / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
  ) AS margin_pct
FROM pc_supplier_margin m
WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                 AND to_char(:date_to::date,   'YYYY-MM')
  AND m.is_active = 'T'
GROUP BY m.creditor_code, m.creditor_name
HAVING SUM(m.sales_revenue) >= 10000
ORDER BY margin_pct DESC NULLS LAST
LIMIT 10;

-- ─── T3. Top 10 items by Est. Gross Profit ─────────────────────────────────
-- Matches: sm_top_bottom (items × profit × highest)
SELECT
  m.item_code,
  MIN(m.item_description) AS item_name,
  m.item_group,
  ROUND(SUM(m.sales_revenue)::numeric, 2) AS revenue,
  ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2) AS profit,
  ROUND(
    ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
     / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
  ) AS margin_pct
FROM pc_supplier_margin m
WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                 AND to_char(:date_to::date,   'YYYY-MM')
  AND m.is_active = 'T'
GROUP BY m.item_code, m.item_group
ORDER BY profit DESC NULLS LAST
LIMIT 10;

-- ─── T4. Top 10 items by Margin % (revenue floor RM 10,000) ─────────────────
-- Matches: sm_top_bottom (items × margin% × highest)
SELECT
  m.item_code,
  MIN(m.item_description) AS item_name,
  m.item_group,
  ROUND(SUM(m.sales_revenue)::numeric, 2) AS revenue,
  ROUND(
    ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
     / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
  ) AS margin_pct
FROM pc_supplier_margin m
WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                 AND to_char(:date_to::date,   'YYYY-MM')
  AND m.is_active = 'T'
GROUP BY m.item_code, m.item_group
HAVING SUM(m.sales_revenue) >= 10000
ORDER BY margin_pct DESC NULLS LAST
LIMIT 10;

-- ─── T5. Supplier Analysis Table — top 10 by Revenue ───────────────────────
-- Matches: sm_supplier_table (A) + SupplierTable default sort
SELECT
  m.creditor_code,
  m.creditor_name   AS company_name,
  m.creditor_type   AS supplier_type,
  COUNT(DISTINCT m.item_code)::int AS item_count,
  ROUND(SUM(m.sales_revenue)::numeric, 2) AS revenue,
  ROUND(SUM(m.attributed_cogs)::numeric, 2) AS cogs,
  ROUND((SUM(m.sales_revenue) - SUM(m.attributed_cogs))::numeric, 2) AS gross_profit,
  ROUND(
    ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
     / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
  ) AS margin_pct
FROM pc_supplier_margin m
WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                 AND to_char(:date_to::date,   'YYYY-MM')
  AND m.is_active = 'T'
GROUP BY m.creditor_code, m.creditor_name, m.creditor_type
ORDER BY revenue DESC
LIMIT 10;

-- ─── T6. Loss-making supplier count ────────────────────────────────────────
-- Matches: sm_supplier_table aggregate `loss-making suppliers`
WITH supplier_agg AS (
  SELECT
    m.creditor_code,
    (SUM(m.sales_revenue) - SUM(m.attributed_cogs))
      / NULLIF(SUM(m.sales_revenue), 0) * 100 AS margin_pct
  FROM pc_supplier_margin m
  WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                   AND to_char(:date_to::date,   'YYYY-MM')
    AND m.is_active = 'T'
  GROUP BY m.creditor_code
)
SELECT COUNT(*) AS loss_supplier_count
FROM supplier_agg
WHERE margin_pct IS NOT NULL AND margin_pct < 0;

-- ─── T7. Anchor item — top-5 suppliers by purchase volume ──────────────────
-- :anchor_item_code derived as the item with the highest SUM(purchase_total) in period
-- (equivalent to the first row returned by getItemListV2, which ORDER BYs total_buy DESC).
-- For this SQL, first resolve the anchor:
WITH anchor AS (
  SELECT m.item_code
  FROM pc_supplier_margin m
  WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                   AND to_char(:date_to::date,   'YYYY-MM')
    AND m.is_active = 'T'
    AND m.purchase_qty > 0
  GROUP BY m.item_code
  ORDER BY SUM(m.purchase_total) DESC
  LIMIT 1
)
SELECT
  m.creditor_code,
  m.creditor_name,
  ROUND(MIN(m.min_unit_price)::numeric, 2) AS min_price,
  ROUND(MAX(m.max_unit_price)::numeric, 2) AS max_price,
  ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2) AS avg_price,
  ROUND(SUM(m.purchase_qty)::numeric, 2) AS total_qty,
  ROUND(SUM(m.purchase_total)::numeric, 2) AS total_buy
FROM pc_supplier_margin m
JOIN anchor a ON m.item_code = a.item_code
WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                 AND to_char(:date_to::date,   'YYYY-MM')
  AND m.is_active = 'T'
  AND m.purchase_qty > 0
GROUP BY m.creditor_code, m.creditor_name
ORDER BY total_buy DESC
LIMIT 5;

-- Note: The AI fetcher's `est_margin_pct` column uses a raw-invoice-derived sell price
-- from dbo.IVDTL + dbo.CSDTL (via getItemSellPriceV2) that is NOT reproducible in pure
-- SQL against pc_supplier_margin. Validate margin % separately by comparing the
-- dashboard's "Est. Margin %" column in ItemPricingPanel → Supplier Comparison to the
-- fetcher output for the same anchor item and period.

-- ─── T8. Price scatter — top-50 items by revenue + bucket distribution ─────
-- Matches: sm_price_scatter (top-50 table + full-universe bucket histogram)

-- T8a. Top 50 items by revenue (the items the scatter fetcher sends to the AI)
WITH item_stats AS (
  SELECT
    m.item_code,
    MIN(m.item_description) AS item_name,
    ROUND((SUM(m.purchase_total) / NULLIF(SUM(m.purchase_qty), 0))::numeric, 2) AS avg_purchase_price,
    ROUND((SUM(m.sales_revenue)  / NULLIF(SUM(m.sales_qty),    0))::numeric, 2) AS avg_selling_price,
    ROUND(
      ((SUM(m.sales_revenue) - SUM(m.attributed_cogs))
       / NULLIF(SUM(m.sales_revenue), 0) * 100)::numeric, 2
    ) AS margin_pct,
    ROUND(SUM(m.sales_revenue)::numeric, 2) AS revenue,
    STRING_AGG(DISTINCT m.creditor_name, ',') AS supplier_names
  FROM pc_supplier_margin m
  WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                   AND to_char(:date_to::date,   'YYYY-MM')
    AND m.is_active = 'T'
  GROUP BY m.item_code
  HAVING SUM(m.sales_revenue) > 0
)
SELECT item_code, item_name, avg_purchase_price, avg_selling_price, margin_pct, revenue, supplier_names
FROM item_stats
ORDER BY revenue DESC
LIMIT 50;

-- T8b. Margin bucket histogram across the full universe
WITH item_stats AS (
  SELECT
    m.item_code,
    (SUM(m.sales_revenue) - SUM(m.attributed_cogs))
      / NULLIF(SUM(m.sales_revenue), 0) * 100 AS margin_pct
  FROM pc_supplier_margin m
  WHERE m.month BETWEEN to_char(:date_from::date, 'YYYY-MM')
                   AND to_char(:date_to::date,   'YYYY-MM')
    AND m.is_active = 'T'
  GROUP BY m.item_code
  HAVING SUM(m.sales_revenue) > 0
),
bucketed AS (
  SELECT
    CASE
      WHEN margin_pct IS NULL THEN 'null'
      WHEN margin_pct < 0     THEN '< 0%'
      WHEN margin_pct < 5     THEN '0-5%'
      WHEN margin_pct < 10    THEN '5-10%'
      WHEN margin_pct < 20    THEN '10-20%'
      ELSE '20%+'
    END AS bucket
  FROM item_stats
)
SELECT bucket, COUNT(*) AS item_count
FROM bucketed
GROUP BY bucket
ORDER BY CASE bucket
  WHEN '< 0%'   THEN 1
  WHEN '0-5%'   THEN 2
  WHEN '5-10%'  THEN 3
  WHEN '10-20%' THEN 4
  WHEN '20%+'   THEN 5
  ELSE 6
END;
