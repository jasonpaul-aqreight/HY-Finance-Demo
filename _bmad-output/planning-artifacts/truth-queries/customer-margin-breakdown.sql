-- Truth queries for section: customer_margin_breakdown
-- Quality gate (v1 §9.5): each query must match BOTH (a) the corresponding
-- data-fetcher value and (b) the dashboard displayed value (±RM 1 tolerance).
--
-- Population: `is_active = 'T'` is applied by buildMarginFilter in queries.ts
-- and mirrored here. NO customer/type/agent filters applied — run them against
-- an un-filtered view.
--
-- Parameters (bind before running):
--   :date_from -- ISO date, e.g. '2025-01-01'
--   :date_to   -- ISO date, e.g. '2025-12-31'
-- Both are converted to YYYY-MM internally to match pc_customer_margin.month (text column).

-- ─────────────────────────────────────────────────────────────────────────────
-- T1. Top 10 customers by Gross Profit
-- Should match: cm_top_customers fetcher (profit list) + cm_customer_table
-- top rows + TopCustomersChart "Top / Gross Profit" mode + CustomerMarginTable
-- default sort, page 1 (sorted by gross_profit desc).
-- Dashboard source: getCustomerMargins(filters, 'gross_profit', 'desc', 1, 10)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.debtor_code,
  c.company_name,
  c.debtor_type,
  c.sales_agent,
  ROUND(c.revenue::numeric, 2)      AS revenue,
  ROUND(c.cogs::numeric, 2)         AS cogs,
  ROUND((c.revenue - c.cogs)::numeric, 2) AS gross_profit,
  CASE WHEN c.revenue > 0
       THEN ROUND(((c.revenue - c.cogs) / c.revenue * 100)::numeric, 2)
       ELSE 0 END AS margin_pct,
  CASE WHEN c.iv_rev > 0
       THEN ROUND((c.cn_rev / c.iv_rev * 100)::numeric, 2)
       ELSE 0 END AS return_rate_pct
FROM (
  SELECT
    m.debtor_code,
    MAX(m.company_name) AS company_name,
    COALESCE(MAX(m.debtor_type), 'Unassigned') AS debtor_type,
    MAX(m.sales_agent) AS sales_agent,
    SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) AS revenue,
    SUM(m.iv_cost + m.dn_cost - m.cn_cost) AS cogs,
    COALESCE(SUM(m.iv_revenue), 0) AS iv_rev,
    COALESCE(SUM(m.cn_revenue), 0) AS cn_rev
  FROM pc_customer_margin m
  WHERE m.is_active = 'T'
    AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                    AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY m.debtor_code
) c
ORDER BY gross_profit DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- T2. Top 10 customers by Gross Margin % (revenue >= RM 10,000 floor)
-- Should match: cm_top_customers fetcher (margin list) + TopCustomersChart
-- "Margin %" mode. Uses a 10K revenue floor to match chart logic.
-- Dashboard source: getCustomerMargins(filters, 'margin_pct', 'desc', 1, 50)
--                   filtered in JS to revenue >= 10000, sliced to 10.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.debtor_code,
  c.company_name,
  ROUND(c.revenue::numeric, 2)      AS revenue,
  ROUND((c.revenue - c.cogs)::numeric, 2) AS gross_profit,
  CASE WHEN c.revenue > 0
       THEN ROUND(((c.revenue - c.cogs) / c.revenue * 100)::numeric, 2)
       ELSE 0 END AS margin_pct
FROM (
  SELECT
    m.debtor_code,
    MAX(m.company_name) AS company_name,
    SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) AS revenue,
    SUM(m.iv_cost + m.dn_cost - m.cn_cost) AS cogs
  FROM pc_customer_margin m
  WHERE m.is_active = 'T'
    AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                    AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY m.debtor_code
) c
WHERE c.revenue >= 10000
ORDER BY margin_pct DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- T3. Bottom 10 customers by Gross Profit
-- Should match: cm_customer_table fetcher (bottom rows) + CustomerMarginTable
-- default sort asc (last page approximately).
-- Dashboard source: getCustomerMargins(filters, 'gross_profit', 'asc', 1, 10)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.debtor_code,
  c.company_name,
  c.debtor_type,
  c.sales_agent,
  ROUND(c.revenue::numeric, 2)      AS revenue,
  ROUND((c.revenue - c.cogs)::numeric, 2) AS gross_profit,
  CASE WHEN c.revenue > 0
       THEN ROUND(((c.revenue - c.cogs) / c.revenue * 100)::numeric, 2)
       ELSE 0 END AS margin_pct
FROM (
  SELECT
    m.debtor_code,
    MAX(m.company_name) AS company_name,
    COALESCE(MAX(m.debtor_type), 'Unassigned') AS debtor_type,
    MAX(m.sales_agent) AS sales_agent,
    SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) AS revenue,
    SUM(m.iv_cost + m.dn_cost - m.cn_cost) AS cogs
  FROM pc_customer_margin m
  WHERE m.is_active = 'T'
    AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                    AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY m.debtor_code
) c
ORDER BY gross_profit ASC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- T4. Loss-maker count (active customers with Gross Profit < 0)
-- Should match: cm_customer_table fetcher aggregate "loss-making customers".
-- Dashboard source: derived from getMarginDistribution() "< 0%" bucket.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS loss_maker_count
FROM (
  SELECT
    m.debtor_code,
    SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue) AS revenue,
    SUM(m.iv_cost + m.dn_cost - m.cn_cost) AS cogs
  FROM pc_customer_margin m
  WHERE m.is_active = 'T'
    AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                    AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY m.debtor_code
) c
WHERE (c.revenue - c.cogs) < 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- T5. Top 10 share of total period Gross Profit
-- Should match: cm_top_customers and cm_customer_table aggregate
-- "Top 10 share of GP".
-- ─────────────────────────────────────────────────────────────────────────────
WITH customer_gp AS (
  SELECT
    m.debtor_code,
    SUM(m.iv_revenue + m.dn_revenue - m.cn_revenue)
      - SUM(m.iv_cost + m.dn_cost - m.cn_cost) AS gross_profit
  FROM pc_customer_margin m
  WHERE m.is_active = 'T'
    AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                    AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY m.debtor_code
),
top10 AS (
  SELECT gross_profit FROM customer_gp ORDER BY gross_profit DESC LIMIT 10
),
totals AS (
  SELECT SUM(gross_profit) AS period_gp FROM customer_gp
)
SELECT
  (SELECT SUM(gross_profit) FROM top10) AS top10_gp,
  (SELECT period_gp FROM totals)        AS period_gp,
  ROUND(
    ((SELECT SUM(gross_profit) FROM top10) / NULLIF((SELECT period_gp FROM totals), 0) * 100)::numeric,
    2
  ) AS top10_share_pct;

-- ─────────────────────────────────────────────────────────────────────────────
-- T6. Top 25 customers by margin_lost (credit note impact)
-- Should match: cm_credit_note_impact fetcher top 25 rows.
-- Dashboard source: getCreditNoteImpact() — returns up to 100 rows ordered by
-- return_rate_pct DESC in SQL, then JS sorts by margin_lost and slices top 25.
-- This query reproduces the margin_lost ranking directly.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.debtor_code,
  c.company_name,
  ROUND(c.iv_revenue::numeric, 2)   AS iv_revenue,
  ROUND(c.cn_revenue::numeric, 2)   AS cn_revenue,
  CASE WHEN c.iv_revenue > 0
       THEN ROUND((c.cn_revenue / c.iv_revenue * 100)::numeric, 2)
       ELSE 0 END AS return_rate_pct,
  CASE WHEN c.iv_revenue > 0
       THEN ROUND(((c.iv_revenue - c.iv_cost) / c.iv_revenue * 100)::numeric, 2)
       ELSE 0 END AS margin_before,
  CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
       THEN ROUND((((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost))
                   / (c.iv_revenue - c.cn_revenue) * 100)::numeric, 2)
       ELSE 0 END AS margin_after,
  CASE WHEN c.iv_revenue > 0
       THEN ROUND(
              ((c.iv_revenue - c.iv_cost) / c.iv_revenue * 100
               - CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
                      THEN ((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost))
                           / (c.iv_revenue - c.cn_revenue) * 100
                      ELSE 0 END)::numeric,
              2)
       ELSE 0 END AS margin_lost
FROM (
  SELECT
    m.debtor_code,
    MAX(m.company_name) AS company_name,
    COALESCE(SUM(m.iv_revenue), 0) AS iv_revenue,
    COALESCE(SUM(m.iv_cost),    0) AS iv_cost,
    COALESCE(SUM(m.cn_revenue), 0) AS cn_revenue,
    COALESCE(SUM(m.cn_cost),    0) AS cn_cost
  FROM pc_customer_margin m
  WHERE m.is_active = 'T'
    AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                    AND substring(:date_to::text   FROM 1 FOR 7)
  GROUP BY m.debtor_code
) c
WHERE c.cn_revenue > 0
ORDER BY margin_lost DESC
LIMIT 25;

-- ─────────────────────────────────────────────────────────────────────────────
-- T7. Total margin_lost across the 100-row impact universe
-- Should match: cm_credit_note_impact fetcher aggregate "total margin lost".
-- The fetcher sums margin_lost over up to 100 rows (the universe returned by
-- getCreditNoteImpact). This query reproduces that sum.
-- ─────────────────────────────────────────────────────────────────────────────
WITH impact AS (
  SELECT
    c.debtor_code,
    CASE WHEN c.iv_revenue > 0
         THEN ((c.iv_revenue - c.iv_cost) / c.iv_revenue * 100
               - CASE WHEN (c.iv_revenue - c.cn_revenue) > 0
                      THEN ((c.iv_revenue - c.cn_revenue) - (c.iv_cost - c.cn_cost))
                           / (c.iv_revenue - c.cn_revenue) * 100
                      ELSE 0 END)
         ELSE 0 END AS margin_lost,
    CASE WHEN c.iv_revenue > 0
         THEN (c.cn_revenue / c.iv_revenue * 100)
         ELSE 0 END AS return_rate_pct
  FROM (
    SELECT
      m.debtor_code,
      COALESCE(SUM(m.iv_revenue), 0) AS iv_revenue,
      COALESCE(SUM(m.iv_cost),    0) AS iv_cost,
      COALESCE(SUM(m.cn_revenue), 0) AS cn_revenue,
      COALESCE(SUM(m.cn_cost),    0) AS cn_cost
    FROM pc_customer_margin m
    WHERE m.is_active = 'T'
      AND m.month BETWEEN substring(:date_from::text FROM 1 FOR 7)
                      AND substring(:date_to::text   FROM 1 FOR 7)
    GROUP BY m.debtor_code
  ) c
  WHERE c.cn_revenue > 0
  ORDER BY return_rate_pct DESC
  LIMIT 100
)
SELECT
  ROUND(SUM(margin_lost)::numeric, 2)                             AS total_margin_lost_pp,
  ROUND(AVG(margin_lost)::numeric, 2)                             AS avg_margin_lost_pp,
  COUNT(*) FILTER (WHERE return_rate_pct > 5)                     AS high_return_count,
  COUNT(*)                                                        AS universe_size
FROM impact;
