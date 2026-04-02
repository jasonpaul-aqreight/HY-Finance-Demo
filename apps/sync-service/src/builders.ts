/**
 * Pre-computed table builders.
 *
 * Each builder runs an aggregation query against the RDS source (AutoCount)
 * and returns rows ready to insert into the corresponding local pc_* table.
 *
 * Conventions:
 *   - RDS tables: dbo."TableName" with "PascalCase" column names
 *   - MYT timezone: DocDate + INTERVAL '8 hours' (AutoCount stores UTC)
 *   - Month format: YYYY-MM
 *   - Monetary amounts: LocalNetTotal / LocalSubTotal (always MYR)
 *   - Active filter: "Cancelled" = 'F'
 */

import { Pool, PoolClient } from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────

export interface BuildResult {
  rows: Record<string, unknown>[];
  /** Explicit column order — used to guarantee INSERT column/value alignment. */
  columns: string[];
}

export interface PcBuilder {
  table: string;
  /** 'swap' = full rebuild with staging rename; 'snapshot' = upsert by date */
  mode: 'swap' | 'snapshot';
  build: (source: Pool, ctx: BuilderContext) => Promise<BuildResult>;
}

export interface BuilderContext {
  /** MYT date string YYYY-MM-DD for snapshot tables */
  snapshotDate: string;
  /** Credit score v2 config from app_settings */
  creditScoreConfig?: {
    weights: { utilization: number; overdueDays: number; timeliness: number; doubleBreach: number };
    thresholds: { low: number; high: number };
  };
  /** Local DB client — used by builders that need local lookup data (e.g. product fruit columns) */
  targetClient?: PoolClient;
}

// ── Helper ────────────────────────────────────────────────────────────────

const MYT_MONTH = `TO_CHAR("DocDate" + INTERVAL '8 hours', 'YYYY-MM')`;
const MYT_DATE = `("DocDate" + INTERVAL '8 hours')::date`;

function mytMonth(alias: string, col = 'DocDate') {
  return `TO_CHAR(${alias}."${col}" + INTERVAL '8 hours', 'YYYY-MM')`;
}

// ════════════════════════════════════════════════════════════════════════════
// SALES (4 builders)
// ════════════════════════════════════════════════════════════════════════════

async function buildSalesDaily(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    WITH combined AS (
      SELECT 'IV' AS src, "DocDate", "LocalNetTotal" FROM dbo."IV" WHERE "Cancelled" = 'F'
      UNION ALL
      SELECT 'CS' AS src, "DocDate", "LocalNetTotal" FROM dbo."CS" WHERE "Cancelled" = 'F'
      UNION ALL
      SELECT 'CN' AS src, "DocDate", "LocalNetTotal" FROM dbo."CN" WHERE "Cancelled" = 'F'
    )
    SELECT
      ${MYT_DATE} AS doc_date,
      COALESCE(SUM(CASE WHEN src = 'IV' THEN "LocalNetTotal" END), 0) AS invoice_total,
      COALESCE(SUM(CASE WHEN src = 'CS' THEN "LocalNetTotal" END), 0) AS cash_total,
      COALESCE(SUM(CASE WHEN src = 'CN' THEN "LocalNetTotal" END), 0) AS cn_total,
      COALESCE(SUM(CASE WHEN src IN ('IV','CS') THEN "LocalNetTotal"
                        WHEN src = 'CN' THEN -"LocalNetTotal" END), 0) AS net_revenue,
      COUNT(*) AS doc_count
    FROM combined
    GROUP BY ${MYT_DATE}
    ORDER BY doc_date
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildSalesByCustomer(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    WITH combined AS (
      SELECT 'IV' AS src, "DocDate", "DebtorCode", "LocalNetTotal" FROM dbo."IV" WHERE "Cancelled" = 'F'
      UNION ALL
      SELECT 'CS' AS src, "DocDate", "DebtorCode", "LocalNetTotal" FROM dbo."CS" WHERE "Cancelled" = 'F'
      UNION ALL
      SELECT 'CN' AS src, "DocDate", "DebtorCode", "LocalNetTotal" FROM dbo."CN" WHERE "Cancelled" = 'F'
    )
    SELECT
      ${MYT_DATE} AS doc_date,
      c."DebtorCode" AS debtor_code,
      d."CompanyName" AS company_name,
      d."DebtorType" AS debtor_type,
      d."SalesAgent" AS sales_agent,
      COALESCE(SUM(CASE WHEN c.src = 'IV' THEN c."LocalNetTotal" END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN c.src = 'CS' THEN c."LocalNetTotal" END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN c.src = 'CN' THEN c."LocalNetTotal" END), 0) AS credit_notes,
      COALESCE(SUM(CASE WHEN c.src IN ('IV','CS') THEN c."LocalNetTotal"
                        WHEN c.src = 'CN' THEN -c."LocalNetTotal" END), 0) AS total_sales,
      COUNT(*) AS doc_count
    FROM combined c
    LEFT JOIN dbo."Debtor" d ON c."DebtorCode" = d."AccNo"
    GROUP BY ${MYT_DATE}, c."DebtorCode", d."CompanyName", d."DebtorType", d."SalesAgent"
    ORDER BY doc_date, debtor_code
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildSalesByOutlet(source: Pool): Promise<BuildResult> {
  // Three separate aggregations UNIONed: by DebtorType, SalesAgent, SalesLocation
  const result = await source.query(`
    WITH sales AS (
      SELECT 'IV' AS src, "DocDate", "DebtorCode", "LocalNetTotal", "SalesLocation", "SalesAgent" FROM dbo."IV" WHERE "Cancelled" = 'F'
      UNION ALL
      SELECT 'CS' AS src, "DocDate", "DebtorCode", "LocalNetTotal", "SalesLocation", "SalesAgent" FROM dbo."CS" WHERE "Cancelled" = 'F'
      UNION ALL
      SELECT 'CN' AS src, "DocDate", "DebtorCode", "LocalNetTotal", "SalesLocation", "SalesAgent" FROM dbo."CN" WHERE "Cancelled" = 'F'
    ),
    enriched AS (
      SELECT s.*, d."DebtorType"
      FROM sales s
      LEFT JOIN dbo."Debtor" d ON s."DebtorCode" = d."AccNo"
    )

    -- By DebtorType
    SELECT
      ${MYT_DATE} AS doc_date,
      'type' AS dimension,
      COALESCE(e."DebtorType", '(Uncategorized)') AS dimension_key,
      dt."Description" AS dimension_label,
      dt."IsActive" AS is_active,
      COALESCE(SUM(CASE WHEN e.src = 'IV' THEN e."LocalNetTotal" END), 0) AS invoice_sales,
      COALESCE(SUM(CASE WHEN e.src = 'CS' THEN e."LocalNetTotal" END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN e.src = 'CN' THEN e."LocalNetTotal" END), 0) AS credit_notes,
      COALESCE(SUM(CASE WHEN e.src IN ('IV','CS') THEN e."LocalNetTotal"
                        WHEN e.src = 'CN' THEN -e."LocalNetTotal" END), 0) AS total_sales,
      COUNT(*) AS doc_count,
      COUNT(DISTINCT e."DebtorCode") AS customer_count
    FROM enriched e
    LEFT JOIN dbo."DebtorType" dt ON e."DebtorType" = dt."DebtorType"
    GROUP BY ${MYT_DATE}, e."DebtorType", dt."Description", dt."IsActive"

    UNION ALL

    -- By SalesAgent
    SELECT
      ${MYT_DATE} AS doc_date,
      'agent' AS dimension,
      COALESCE(e."SalesAgent", '(Unassigned)') AS dimension_key,
      sa."Description" AS dimension_label,
      sa."IsActive" AS is_active,
      COALESCE(SUM(CASE WHEN e.src = 'IV' THEN e."LocalNetTotal" END), 0),
      COALESCE(SUM(CASE WHEN e.src = 'CS' THEN e."LocalNetTotal" END), 0),
      COALESCE(SUM(CASE WHEN e.src = 'CN' THEN e."LocalNetTotal" END), 0),
      COALESCE(SUM(CASE WHEN e.src IN ('IV','CS') THEN e."LocalNetTotal"
                        WHEN e.src = 'CN' THEN -e."LocalNetTotal" END), 0),
      COUNT(*),
      COUNT(DISTINCT e."DebtorCode")
    FROM enriched e
    LEFT JOIN dbo."SalesAgent" sa ON e."SalesAgent" = sa."SalesAgent"
    GROUP BY ${MYT_DATE}, e."SalesAgent", sa."Description", sa."IsActive"

    UNION ALL

    -- By SalesLocation (location)
    SELECT
      ${MYT_DATE} AS doc_date,
      'location' AS dimension,
      COALESCE(e."SalesLocation", '(Unassigned)') AS dimension_key,
      COALESCE(e."SalesLocation", '(Unassigned)') AS dimension_label,
      NULL AS is_active,
      COALESCE(SUM(CASE WHEN e.src = 'IV' THEN e."LocalNetTotal" END), 0),
      COALESCE(SUM(CASE WHEN e.src = 'CS' THEN e."LocalNetTotal" END), 0),
      COALESCE(SUM(CASE WHEN e.src = 'CN' THEN e."LocalNetTotal" END), 0),
      COALESCE(SUM(CASE WHEN e.src IN ('IV','CS') THEN e."LocalNetTotal"
                        WHEN e.src = 'CN' THEN -e."LocalNetTotal" END), 0),
      COUNT(*),
      COUNT(DISTINCT e."DebtorCode")
    FROM enriched e
    GROUP BY ${MYT_DATE}, e."SalesLocation"

    ORDER BY doc_date, dimension, dimension_key
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildSalesByFruit(source: Pool, ctx: BuilderContext): Promise<BuildResult> {
  if (!ctx.targetClient) throw new Error('buildSalesByFruit requires targetClient in context');

  // Step 1: Load fruit mapping from local product table (already parsed by transformProducts)
  const { rows: products } = await ctx.targetClient.query(
    `SELECT itemcode, fruitname, fruitcountry, fruitvariant FROM product`
  );
  const fruitMap = new Map<string, { name: string; country: string; variant: string }>();
  for (const p of products) {
    fruitMap.set(p.itemcode, {
      name: p.fruitname || '(Unknown)',
      country: p.fruitcountry || '(Unknown)',
      variant: p.fruitvariant || '(Unknown)',
    });
  }

  // Step 2: Query RDS for raw line items with src type for invoice/cash/cn breakdown
  // Exclude: empty ItemCode with zero amount (comment lines), rental items, packing materials
  const result = await source.query(`
    WITH sales_lines AS (
      SELECT 'IV' AS src, d."ItemCode", d."LocalSubTotal" AS subtotal, d."Qty", h."DocDate"
      FROM dbo."IVDTL" d
      JOIN dbo."IV" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
        AND NOT (COALESCE(d."ItemCode", '') = '' AND COALESCE(d."LocalSubTotal", 0) = 0)
      UNION ALL
      SELECT 'CS' AS src, d."ItemCode", d."LocalSubTotal", d."Qty", h."DocDate"
      FROM dbo."CSDTL" d
      JOIN dbo."CS" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
        AND NOT (COALESCE(d."ItemCode", '') = '' AND COALESCE(d."LocalSubTotal", 0) = 0)
      UNION ALL
      SELECT 'CN' AS src, d."ItemCode", d."LocalSubTotal", d."Qty", h."DocDate"
      FROM dbo."CNDTL" d
      JOIN dbo."CN" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
        AND NOT (COALESCE(d."ItemCode", '') = '' AND COALESCE(d."LocalSubTotal", 0) = 0)
    )
    SELECT
      src,
      "ItemCode" AS item_code,
      ("DocDate" + INTERVAL '8 hours')::date AS doc_date,
      subtotal,
      "Qty" AS qty
    FROM sales_lines
  `);

  // Step 3: Aggregate in memory using local fruit mapping
  const aggKey = (docDate: string, name: string, country: string, variant: string) =>
    `${docDate}|${name}|${country}|${variant}`;

  const agg = new Map<string, {
    doc_date: string; fruit_name: string; fruit_country: string; fruit_variant: string;
    invoice_sales: number; cash_sales: number; credit_notes: number;
    total_sales: number; total_qty: number; doc_count: number;
  }>();

  for (const row of result.rows) {
    const code = row.item_code || '';
    // Skip packing materials and misc non-product items
    if (code.startsWith('XX-') || code.startsWith('ZZ-')) continue;
    // Skip rental items
    if (code.startsWith('RE-')) continue;

    // Items with no ItemCode but have a monetary amount → UNCATEGORIZED
    let fruit: { name: string; country: string; variant: string };
    if (!code) {
      fruit = { name: 'UNCATEGORIZED', country: 'UNCATEGORIZED', variant: 'UNCATEGORIZED' };
    } else {
      fruit = fruitMap.get(code) ?? { name: '(Unknown)', country: '(Unknown)', variant: '(Unknown)' };
    }
    // doc_date comes back as a Date object from pg — format to YYYY-MM-DD string
    const docDateStr = row.doc_date instanceof Date
      ? row.doc_date.toISOString().slice(0, 10)
      : String(row.doc_date);
    const key = aggKey(docDateStr, fruit.name, fruit.country, fruit.variant);

    let bucket = agg.get(key);
    if (!bucket) {
      bucket = {
        doc_date: docDateStr, fruit_name: fruit.name, fruit_country: fruit.country, fruit_variant: fruit.variant,
        invoice_sales: 0, cash_sales: 0, credit_notes: 0,
        total_sales: 0, total_qty: 0, doc_count: 0,
      };
      agg.set(key, bucket);
    }

    const amt = Number(row.subtotal) || 0;
    const qty = Number(row.qty) || 0;

    if (row.src === 'IV') {
      bucket.invoice_sales += amt;
      bucket.total_sales += amt;
      bucket.total_qty += Math.abs(qty);
    } else if (row.src === 'CS') {
      bucket.cash_sales += amt;
      bucket.total_sales += amt;
      bucket.total_qty += Math.abs(qty);
    } else {
      // CN — credit note: subtract from total, track separately
      bucket.credit_notes += amt;
      bucket.total_sales -= amt;
    }
    bucket.doc_count++;
  }

  const rows = Array.from(agg.values()).sort((a, b) =>
    a.doc_date.localeCompare(b.doc_date) || a.fruit_name.localeCompare(b.fruit_name)
  );

  const columns = [
    'doc_date', 'fruit_name', 'fruit_country', 'fruit_variant',
    'invoice_sales', 'cash_sales', 'credit_notes',
    'total_sales', 'total_qty', 'doc_count',
  ];

  return { rows, columns };
}


// ════════════════════════════════════════════════════════════════════════════
// PAYMENT / AR (3 builders)
// ════════════════════════════════════════════════════════════════════════════

async function buildArMonthly(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    WITH non_customer AS (
      SELECT "AccNo" FROM dbo."Debtor"
      WHERE "CompanyName" ILIKE 'CASH DEBT%' OR "CompanyName" ILIKE 'CASH SALES%'
    ),
    monthly AS (
      SELECT
        ${mytMonth('a')} AS month,
        SUM(a."LocalNetTotal") AS invoiced,
        0::numeric AS collected,
        0::numeric AS cn_applied,
        0::numeric AS refunded,
        0::numeric AS contra,
        COUNT(DISTINCT a."DebtorCode") AS customer_count,
        COUNT(*)::int AS invoice_count,
        0 AS payment_count
      FROM dbo."ARInvoice" a
      WHERE a."Cancelled" = 'F'
        AND a."DebtorCode" NOT IN (SELECT "AccNo" FROM non_customer)
      GROUP BY ${mytMonth('a')}

      UNION ALL

      SELECT
        ${mytMonth('p')} AS month,
        0, SUM(p."LocalPaymentAmt"), 0, 0, 0, 0,
        0, COUNT(*)::int
      FROM dbo."ARPayment" p
      WHERE p."Cancelled" = 'F'
        AND p."DebtorCode" NOT IN (SELECT "AccNo" FROM non_customer)
      GROUP BY ${mytMonth('p')}

      UNION ALL

      SELECT
        ${mytMonth('c')} AS month,
        0, 0, SUM(c."LocalNetTotal"), 0, 0, 0,
        0, 0
      FROM dbo."ARCN" c
      WHERE c."Cancelled" = 'F'
        AND c."DebtorCode" NOT IN (SELECT "AccNo" FROM non_customer)
      GROUP BY ${mytMonth('c')}

      UNION ALL

      SELECT
        ${mytMonth('r')} AS month,
        0, 0, 0, SUM(r."LocalPaymentAmt"), 0, 0,
        0, 0
      FROM dbo."ARRefund" r
      WHERE r."Cancelled" = 'F'
        AND r."DebtorCode" NOT IN (SELECT "AccNo" FROM non_customer)
      GROUP BY ${mytMonth('r')}

      UNION ALL

      SELECT
        TO_CHAR(ko."GainLossDate", 'YYYY-MM') AS month,
        0, 0, 0, 0, SUM(ko."Amount"), 0,
        0, 0
      FROM dbo."ARContraKnockOff" ko
      WHERE ko."GainLossDate" IS NOT NULL
      GROUP BY TO_CHAR(ko."GainLossDate", 'YYYY-MM')
    ),
    agg AS (
      SELECT
        month,
        SUM(invoiced) AS invoiced,
        SUM(collected) AS collected,
        SUM(cn_applied) AS cn_applied,
        SUM(refunded) AS refunded,
        SUM(contra) AS contra,
        GREATEST(MAX(customer_count), 0) AS customer_count,
        SUM(invoice_count) AS invoice_count,
        SUM(payment_count) AS payment_count
      FROM monthly
      GROUP BY month
    )
    SELECT
      month,
      COALESCE(invoiced, 0) AS invoiced,
      COALESCE(collected, 0) AS collected,
      COALESCE(cn_applied, 0) AS cn_applied,
      COALESCE(refunded, 0) AS refunded,
      COALESCE(contra, 0) AS contra,
      COALESCE(SUM(invoiced - collected - cn_applied - refunded - contra) OVER (ORDER BY month), 0) AS total_outstanding,
      COALESCE(SUM(invoiced) OVER (ORDER BY month), 0) AS total_billed,
      customer_count,
      invoice_count,
      payment_count
    FROM agg
    ORDER BY month
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildArCustomerSnapshot(source: Pool, ctx: BuilderContext): Promise<BuildResult> {
  const snapshotDate = ctx.snapshotDate;

  // Step 1: Get raw per-customer AR metrics from RDS
  const rawResult = await source.query(`
    WITH non_customer AS (
      SELECT "AccNo" FROM dbo."Debtor"
      WHERE "CompanyName" ILIKE 'CASH DEBT%' OR "CompanyName" ILIKE 'CASH SALES%'
    ),
    open_invoices AS (
      SELECT
        a."DebtorCode",
        a."DocKey",
        a."DocDate",
        a."DueDate",
        a."Outstanding",
        a."LocalNetTotal",
        a."DisplayTerm",
        a."SalesAgent"
      FROM dbo."ARInvoice" a
      WHERE a."Cancelled" = 'F'
        AND a."DebtorCode" NOT IN (SELECT "AccNo" FROM non_customer)
    ),
    customer_ar AS (
      SELECT
        oi."DebtorCode",
        SUM(oi."Outstanding") AS total_outstanding,
        SUM(CASE WHEN oi."DueDate"::date < $1::date THEN oi."Outstanding" ELSE 0 END) AS overdue_amount,
        MIN(CASE WHEN oi."Outstanding" > 0 THEN oi."DueDate" END) AS oldest_due_date,
        MAX(CASE WHEN oi."Outstanding" > 0 AND oi."DueDate"::date < $1::date
              THEN ($1::date - oi."DueDate"::date) ELSE 0 END) AS max_overdue_days,
        COUNT(CASE WHEN oi."Outstanding" > 0 THEN 1 END) AS invoice_count
      FROM open_invoices oi
      GROUP BY oi."DebtorCode"
    ),
    payment_speed AS (
      SELECT
        inv."DebtorCode",
        AVG(pay."DocDate"::date - inv."DocDate"::date) AS avg_payment_days,
        COALESCE(
          AVG(CASE WHEN pay."DocDate" >= (NOW() - INTERVAL '12 months')
                THEN pay."DocDate"::date - inv."DueDate"::date END),
          AVG(pay."DocDate"::date - inv."DueDate"::date)
        ) AS avg_days_late
      FROM dbo."ARInvoice" inv
      JOIN dbo."ARPaymentKnockOff" ko
        ON ko."KnockOffDocKey" = inv."DocKey" AND ko."KnockOffDocType" = 'RI'
      JOIN dbo."ARPayment" pay ON ko."DocKey" = pay."DocKey"
      WHERE inv."Cancelled" = 'F' AND pay."Cancelled" = 'F'
        AND inv."DebtorCode" NOT IN (SELECT "AccNo" FROM non_customer)
      GROUP BY inv."DebtorCode"
    )
    SELECT
      car."DebtorCode" AS debtor_code,
      d."CompanyName" AS company_name,
      d."DebtorType" AS debtor_type,
      d."SalesAgent" AS sales_agent,
      d."DisplayTerm" AS display_term,
      COALESCE(d."CreditLimit", 0) AS credit_limit,
      COALESCE(d."OverdueLimit", 0) AS overdue_limit,
      d."IsActive" AS is_active,
      COALESCE(car.total_outstanding, 0) AS total_outstanding,
      COALESCE(car.overdue_amount, 0) AS overdue_amount,
      car.oldest_due_date,
      COALESCE(car.max_overdue_days, 0) AS max_overdue_days,
      COALESCE(car.invoice_count, 0) AS invoice_count,
      CASE WHEN COALESCE(d."CreditLimit", 0) > 0
        THEN ROUND((COALESCE(car.total_outstanding, 0) / d."CreditLimit" * 100)::numeric, 2)
        ELSE NULL END AS utilization_pct,
      ps.avg_payment_days,
      ps.avg_days_late,
      d."Attention" AS attention,
      COALESCE(d."Phone1", '') AS phone1,
      COALESCE(d."Mobile", '') AS mobile,
      COALESCE(d."EmailAddress", '') AS email_address,
      COALESCE(d."AreaCode", '') AS area_code,
      COALESCE(d."CurrencyCode", 'MYR') AS currency_code,
      d."CreatedTimeStamp" AS created_timestamp
    FROM customer_ar car
    JOIN dbo."Debtor" d ON car."DebtorCode" = d."AccNo"
    LEFT JOIN payment_speed ps ON car."DebtorCode" = ps."DebtorCode"
  `, [snapshotDate]);

  const rawRows = rawResult.rows;
  const queryColumns = rawResult.fields.map(f => f.name);

  // Step 2: Compute credit score and risk tier in JS (step-ladder, matching credit-score-v2.ts)
  const config = ctx.creditScoreConfig;
  const w = config?.weights ?? { utilization: 40, overdueDays: 30, timeliness: 20, doubleBreach: 10 };
  const t = config?.thresholds ?? { low: 75, high: 30 };

  const rows = rawRows.map((row: Record<string, unknown>) => {
    const outstanding = Number(row.total_outstanding) || 0;
    const creditLimit = Number(row.credit_limit) || 0;
    const overdueLimit = Number(row.overdue_limit) || 0;
    const overdueAmt = Number(row.overdue_amount) || 0;
    const maxOverdueDays = Number(row.max_overdue_days) || 0;
    const avgPayDays = row.avg_payment_days != null ? Number(row.avg_payment_days) : null;
    const avgDaysLate = row.avg_days_late != null ? Number(row.avg_days_late) : null;

    // Utilization score: max(0, 100 - utilization%)
    // No credit limit set → neutral score (50), not punished for admin gap
    const utilPct = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;
    const utilScore = creditLimit > 0 ? Math.max(0, Math.round(100 - utilPct)) : 50;

    // Overdue days score: step-ladder thresholds
    const odScore = maxOverdueDays <= 0 ? 100
      : maxOverdueDays <= 30 ? 80
      : maxOverdueDays <= 60 ? 60
      : maxOverdueDays <= 90 ? 40
      : maxOverdueDays <= 120 ? 20
      : 0;

    // Timeliness score: step-ladder based on avg days late (payment_date - due_date)
    // NULL means no payment history at all → neutral score (50)
    const timeScore = avgDaysLate == null ? 50
      : avgDaysLate <= 0 ? 100
      : avgDaysLate <= 7 ? 80
      : avgDaysLate <= 14 ? 60
      : avgDaysLate <= 30 ? 40
      : avgDaysLate <= 60 ? 20
      : 0;

    // Double breach: both over credit AND overdue
    const overCredit = creditLimit > 0 && outstanding > creditLimit;
    const overOverdue = overdueLimit > 0 && overdueAmt > overdueLimit;
    const dbScore = overCredit && overOverdue ? 0 : 100;

    const creditScore = Math.round(
      (utilScore * w.utilization +
        odScore * w.overdueDays +
        timeScore * w.timeliness +
        dbScore * w.doubleBreach) / 100
    );

    const riskTier = creditScore >= t.low ? 'Low'
      : creditScore <= t.high ? 'High'
      : 'Moderate';

    return {
      snapshot_date: snapshotDate,
      ...row,
      credit_score: creditScore,
      risk_tier: riskTier,
    };
  });

  // Column order: snapshot_date prepended, credit_score + risk_tier appended
  return { rows, columns: ['snapshot_date', ...queryColumns, 'credit_score', 'risk_tier'] };
}

async function buildArAgingHistory(source: Pool, ctx: BuilderContext): Promise<BuildResult> {
  const snapshotDate = ctx.snapshotDate;

  const result = await source.query(`
    WITH open_inv AS (
      SELECT
        a."DebtorCode",
        a."DueDate",
        a."Outstanding",
        d."DebtorType",
        d."SalesAgent"
      FROM dbo."ARInvoice" a
      LEFT JOIN dbo."Debtor" d ON a."DebtorCode" = d."AccNo"
      WHERE a."Cancelled" = 'F' AND a."Outstanding" > 0
        AND d."CompanyName" NOT ILIKE 'CASH DEBT%'
        AND d."CompanyName" NOT ILIKE 'CASH SALES%'
    ),
    bucketed AS (
      SELECT *,
        CASE
          WHEN "DueDate"::date >= $1::date THEN 'Not Yet Due'
          WHEN ($1::date - "DueDate"::date) <= 30 THEN '1-30'
          WHEN ($1::date - "DueDate"::date) <= 60 THEN '31-60'
          WHEN ($1::date - "DueDate"::date) <= 90 THEN '61-90'
          WHEN ($1::date - "DueDate"::date) <= 120 THEN '91-120'
          ELSE '120+'
        END AS bucket
      FROM open_inv
    )

    -- Overall totals
    SELECT
      bucket,
      'all' AS dimension,
      COUNT(*)::integer AS invoice_count,
      COALESCE(SUM("Outstanding"), 0) AS total_outstanding
    FROM bucketed
    GROUP BY bucket

    UNION ALL

    -- By debtor type
    SELECT
      bucket,
      'type:' || COALESCE("DebtorType", 'Unknown') AS dimension,
      COUNT(*)::integer,
      COALESCE(SUM("Outstanding"), 0)
    FROM bucketed
    GROUP BY bucket, "DebtorType"

    UNION ALL

    -- By sales agent
    SELECT
      bucket,
      'agent:' || COALESCE("SalesAgent", 'Unknown') AS dimension,
      COUNT(*)::integer,
      COALESCE(SUM("Outstanding"), 0)
    FROM bucketed
    GROUP BY bucket, "SalesAgent"
  `, [snapshotDate]);

  const queryColumns = result.fields.map(f => f.name);
  return {
    rows: result.rows.map(r => ({ snapshot_date: snapshotDate, ...r })),
    columns: ['snapshot_date', ...queryColumns],
  };
}


// ════════════════════════════════════════════════════════════════════════════
// RETURN / CREDIT NOTE (4 builders)
// ════════════════════════════════════════════════════════════════════════════

async function buildReturnMonthly(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    SELECT
      ${mytMonth('cn')} AS month,
      COUNT(*) AS cn_count,
      COALESCE(SUM(cn."LocalNetTotal"), 0) AS cn_total,
      COALESCE(SUM(arcn."KnockOffAmt"), 0) AS knock_off_total,
      COALESCE(SUM(arcn."RefundAmt"), 0) AS refund_total,
      COALESCE(SUM(
        cn."LocalNetTotal" - COALESCE(arcn."KnockOffAmt", 0) - COALESCE(arcn."RefundAmt", 0)
      ), 0) AS unresolved_total,
      COUNT(CASE WHEN COALESCE(arcn."KnockOffAmt", 0) + COALESCE(arcn."RefundAmt", 0)
                      >= cn."LocalNetTotal" THEN 1 END) AS reconciled_count,
      COUNT(CASE WHEN COALESCE(arcn."KnockOffAmt", 0) + COALESCE(arcn."RefundAmt", 0) > 0
                  AND COALESCE(arcn."KnockOffAmt", 0) + COALESCE(arcn."RefundAmt", 0)
                      < cn."LocalNetTotal" THEN 1 END) AS partial_count,
      COUNT(CASE WHEN COALESCE(arcn."KnockOffAmt", 0) + COALESCE(arcn."RefundAmt", 0)
                      = 0 THEN 1 END) AS outstanding_count
    FROM dbo."CN" cn
    LEFT JOIN dbo."ARCN" arcn
      ON arcn."SourceKey" = cn."DocKey" AND arcn."SourceType" = 'CN' AND arcn."Cancelled" = 'F'
    LEFT JOIN dbo."Debtor" d ON cn."DebtorCode" = d."AccNo"
    WHERE (cn."Cancelled" = 'F' OR cn."Cancelled" IS NULL)
      AND cn."CNType" = 'RETURN'
      AND d."CompanyName" NOT ILIKE 'CASH DEBT%'
      AND d."CompanyName" NOT ILIKE 'CASH SALES%'
    GROUP BY ${mytMonth('cn')}
    ORDER BY month
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildReturnByCustomer(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    SELECT
      ${mytMonth('cn')} AS month,
      cn."DebtorCode" AS debtor_code,
      d."CompanyName" AS company_name,
      COUNT(*) AS cn_count,
      COALESCE(SUM(cn."LocalNetTotal"), 0) AS cn_total,
      COALESCE(SUM(arcn."KnockOffAmt"), 0) AS knock_off_total,
      COALESCE(SUM(arcn."RefundAmt"), 0) AS refund_total,
      COALESCE(SUM(
        cn."LocalNetTotal" - COALESCE(arcn."KnockOffAmt", 0) - COALESCE(arcn."RefundAmt", 0)
      ), 0) AS unresolved,
      COUNT(CASE WHEN COALESCE(arcn."KnockOffAmt", 0) + COALESCE(arcn."RefundAmt", 0)
                      = 0 THEN 1 END) AS outstanding_count
    FROM dbo."CN" cn
    LEFT JOIN dbo."ARCN" arcn
      ON arcn."SourceKey" = cn."DocKey" AND arcn."SourceType" = 'CN' AND arcn."Cancelled" = 'F'
    LEFT JOIN dbo."Debtor" d ON cn."DebtorCode" = d."AccNo"
    WHERE (cn."Cancelled" = 'F' OR cn."Cancelled" IS NULL)
      AND cn."CNType" = 'RETURN'
      AND d."CompanyName" NOT ILIKE 'CASH DEBT%'
      AND d."CompanyName" NOT ILIKE 'CASH SALES%'
    GROUP BY ${mytMonth('cn')}, cn."DebtorCode", d."CompanyName"
    ORDER BY month, debtor_code
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildReturnProducts(source: Pool, ctx: BuilderContext): Promise<BuildResult> {
  if (!ctx.targetClient) throw new Error('buildReturnProducts requires targetClient in context');

  // Load fruit mapping from local product table (benefits from Tier-2 description parsing)
  const { rows: products } = await ctx.targetClient.query(
    `SELECT itemcode, fruitname, fruitcountry, fruitvariant FROM product`
  );
  const fruitMap = new Map<string, { name: string | null; country: string | null; variant: string | null }>();
  for (const p of products) {
    fruitMap.set(p.itemcode, {
      name: p.fruitname || null,
      country: p.fruitcountry || null,
      variant: p.fruitvariant || null,
    });
  }

  const result = await source.query(`
    SELECT
      ${mytMonth('cn')} AS month,
      dtl."ItemCode" AS item_code,
      dtl."Description" AS item_description,
      COUNT(DISTINCT dtl."DocKey") AS cn_count,
      COALESCE(SUM(dtl."Qty"), 0) AS total_qty,
      COALESCE(SUM(dtl."LocalSubTotal"), 0) AS total_amount,
      COALESCE(SUM(CASE WHEN dtl."GoodsReturn" = 'T' THEN dtl."Qty" ELSE 0 END), 0) AS goods_returned_qty,
      COALESCE(SUM(CASE WHEN COALESCE(dtl."GoodsReturn", 'F') = 'F' THEN dtl."Qty" ELSE 0 END), 0) AS credit_only_qty
    FROM dbo."CNDTL" dtl
    JOIN dbo."CN" cn ON dtl."DocKey" = cn."DocKey"
    WHERE (cn."Cancelled" = 'F' OR cn."Cancelled" IS NULL)
      AND cn."CNType" = 'RETURN'
      AND dtl."ItemCode" IS NOT NULL AND dtl."ItemCode" != ''
      AND dtl."ItemCode" NOT LIKE 'ZZ-ZZ-ZBKT%'
      AND dtl."ItemCode" NOT LIKE 'ZZ-ZZ-ZZPL%'
    GROUP BY ${mytMonth('cn')}, dtl."ItemCode", dtl."Description"
    ORDER BY month, item_code
  `);

  // Enrich with fruit columns from local product table
  const enrichedRows = result.rows.map(row => {
    const fruit = fruitMap.get(row.item_code as string);
    return {
      ...row,
      fruit_name: fruit?.name || null,
      fruit_country: fruit?.country || null,
      fruit_variant: fruit?.variant || null,
    };
  });

  const columns = [
    'month', 'item_code', 'item_description',
    'fruit_name', 'fruit_country', 'fruit_variant',
    'cn_count', 'total_qty', 'total_amount',
    'goods_returned_qty', 'credit_only_qty',
  ];

  return { rows: enrichedRows, columns };
}

async function buildReturnAging(source: Pool, ctx: BuilderContext): Promise<BuildResult> {
  const snapshotDate = ctx.snapshotDate;

  const result = await source.query(`
    WITH unresolved AS (
      SELECT
        cn."DocDate",
        cn."LocalNetTotal",
        COALESCE(arcn."KnockOffAmt", 0) + COALESCE(arcn."RefundAmt", 0) AS resolved_amt
      FROM dbo."CN" cn
      LEFT JOIN dbo."ARCN" arcn
        ON arcn."SourceKey" = cn."DocKey" AND arcn."SourceType" = 'CN' AND arcn."Cancelled" = 'F'
      WHERE (cn."Cancelled" = 'F' OR cn."Cancelled" IS NULL)
        AND cn."CNType" = 'RETURN'
    ),
    open_cn AS (
      SELECT "DocDate", "LocalNetTotal" - resolved_amt AS outstanding
      FROM unresolved
      WHERE "LocalNetTotal" - resolved_amt > 0.01
    )
    SELECT
      CASE
        WHEN ($1::date - ("DocDate" + INTERVAL '8 hours')::date) <= 30 THEN '0-30 days'
        WHEN ($1::date - ("DocDate" + INTERVAL '8 hours')::date) <= 60 THEN '31-60 days'
        WHEN ($1::date - ("DocDate" + INTERVAL '8 hours')::date) <= 90 THEN '61-90 days'
        WHEN ($1::date - ("DocDate" + INTERVAL '8 hours')::date) <= 180 THEN '91-180 days'
        ELSE '180+ days'
      END AS bucket,
      COUNT(*) AS count,
      COALESCE(SUM(outstanding), 0) AS amount
    FROM open_cn
    GROUP BY bucket
  `, [snapshotDate]);

  const queryColumns = result.fields.map(f => f.name);
  return {
    rows: result.rows.map(r => ({ snapshot_date: snapshotDate, ...r })),
    columns: ['snapshot_date', ...queryColumns],
  };
}


// ════════════════════════════════════════════════════════════════════════════
// CUSTOMER MARGIN (2 builders)
// ════════════════════════════════════════════════════════════════════════════

async function buildCustomerMargin(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    WITH iv_agg AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."DebtorCode" AS debtor_code,
        SUM(d."LocalSubTotal") AS iv_revenue,
        SUM(CASE WHEN d."LocalTotalCost" >= 0 THEN d."LocalTotalCost" ELSE 0 END) AS iv_cost,
        COUNT(DISTINCT h."DocKey") AS iv_count
      FROM dbo."IVDTL" d
      JOIN dbo."IV" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
      GROUP BY ${mytMonth('h')}, h."DebtorCode"
    ),
    cn_agg AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."DebtorCode" AS debtor_code,
        SUM(d."LocalSubTotal") AS cn_revenue,
        SUM(d."Qty" * COALESCE(d."UnitCost", 0)) AS cn_cost,
        COUNT(DISTINCT h."DocKey") AS cn_count
      FROM dbo."CNDTL" d
      JOIN dbo."CN" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
      GROUP BY ${mytMonth('h')}, h."DebtorCode"
    ),
    dn_agg AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."DebtorCode" AS debtor_code,
        SUM(d."LocalSubTotal") AS dn_revenue,
        SUM(CASE WHEN d."LocalTotalCost" >= 0 THEN d."LocalTotalCost" ELSE 0 END) AS dn_cost,
        COUNT(DISTINCT h."DocKey") AS dn_count
      FROM dbo."DNDTL" d
      JOIN dbo."DN" h ON d."DocKey" = h."DocKey"
      WHERE (h."Cancelled" = 'F' OR h."Cancelled" IS NULL)
      GROUP BY ${mytMonth('h')}, h."DebtorCode"
    ),
    combined AS (
      SELECT month, debtor_code, iv_revenue, iv_cost, iv_count,
             0::numeric AS cn_revenue, 0::numeric AS cn_cost, 0 AS cn_count,
             0::numeric AS dn_revenue, 0::numeric AS dn_cost, 0 AS dn_count
      FROM iv_agg
      UNION ALL
      SELECT month, debtor_code, 0, 0, 0, cn_revenue, cn_cost, cn_count, 0, 0, 0
      FROM cn_agg
      UNION ALL
      SELECT month, debtor_code, 0, 0, 0, 0, 0, 0, dn_revenue, dn_cost, dn_count
      FROM dn_agg
    )
    SELECT
      c.month,
      c.debtor_code,
      d."CompanyName" AS company_name,
      d."DebtorType" AS debtor_type,
      d."SalesAgent" AS sales_agent,
      d."IsActive" AS is_active,
      COALESCE(SUM(c.iv_revenue), 0) AS iv_revenue,
      COALESCE(SUM(c.iv_cost), 0) AS iv_cost,
      COALESCE(SUM(c.cn_revenue), 0) AS cn_revenue,
      COALESCE(SUM(c.cn_cost), 0) AS cn_cost,
      COALESCE(SUM(c.dn_revenue), 0) AS dn_revenue,
      COALESCE(SUM(c.dn_cost), 0) AS dn_cost,
      MAX(c.iv_count) AS iv_count,
      MAX(c.cn_count) AS cn_count,
      MAX(c.dn_count) AS dn_count
    FROM combined c
    LEFT JOIN dbo."Debtor" d ON c.debtor_code = d."AccNo"
    WHERE d."CompanyName" NOT ILIKE 'CASH DEBT%'
      AND d."CompanyName" NOT ILIKE 'CASH SALES%'
    GROUP BY c.month, c.debtor_code, d."CompanyName", d."DebtorType", d."SalesAgent", d."IsActive"
    ORDER BY month, debtor_code
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildCustomerMarginByProduct(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    WITH iv_lines AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."DebtorCode" AS debtor_code,
        COALESCE(NULLIF(i."ItemGroup", ''), 'Unclassified') AS item_group,
        ig."Description" AS item_group_desc,
        SUM(d."LocalSubTotal") AS revenue,
        SUM(d."LocalTotalCost") AS cogs,
        SUM(d."Qty") AS qty_sold
      FROM dbo."IVDTL" d
      JOIN dbo."IV" h ON d."DocKey" = h."DocKey"
      LEFT JOIN dbo."Item" i ON d."ItemCode" = i."ItemCode"
      LEFT JOIN dbo."ItemGroup" ig ON i."ItemGroup" = ig."ItemGroup"
      WHERE h."Cancelled" = 'F'
        AND d."ItemCode" IS NOT NULL AND d."ItemCode" != ''
      GROUP BY ${mytMonth('h')}, h."DebtorCode", i."ItemGroup", ig."Description"
    ),
    cn_lines AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."DebtorCode" AS debtor_code,
        COALESCE(NULLIF(i."ItemGroup", ''), 'Unclassified') AS item_group,
        ig."Description" AS item_group_desc,
        -SUM(d."LocalSubTotal") AS revenue,
        -SUM(d."UnitCost" * d."Qty") AS cogs,
        -SUM(d."Qty") AS qty_sold
      FROM dbo."CNDTL" d
      JOIN dbo."CN" h ON d."DocKey" = h."DocKey"
      LEFT JOIN dbo."Item" i ON d."ItemCode" = i."ItemCode"
      LEFT JOIN dbo."ItemGroup" ig ON i."ItemGroup" = ig."ItemGroup"
      WHERE h."Cancelled" = 'F'
        AND d."ItemCode" IS NOT NULL AND d."ItemCode" != ''
      GROUP BY ${mytMonth('h')}, h."DebtorCode", i."ItemGroup", ig."Description"
    ),
    dn_lines AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."DebtorCode" AS debtor_code,
        COALESCE(NULLIF(i."ItemGroup", ''), 'Unclassified') AS item_group,
        ig."Description" AS item_group_desc,
        SUM(d."LocalSubTotal") AS revenue,
        SUM(CASE WHEN d."LocalTotalCost" >= 0 THEN d."LocalTotalCost" ELSE 0 END) AS cogs,
        SUM(d."Qty") AS qty_sold
      FROM dbo."DNDTL" d
      JOIN dbo."DN" h ON d."DocKey" = h."DocKey"
      LEFT JOIN dbo."Item" i ON d."ItemCode" = i."ItemCode"
      LEFT JOIN dbo."ItemGroup" ig ON i."ItemGroup" = ig."ItemGroup"
      WHERE (h."Cancelled" = 'F' OR h."Cancelled" IS NULL)
        AND d."ItemCode" IS NOT NULL AND d."ItemCode" != ''
      GROUP BY ${mytMonth('h')}, h."DebtorCode", i."ItemGroup", ig."Description"
    ),
    combined AS (
      SELECT * FROM iv_lines
      UNION ALL
      SELECT * FROM cn_lines
      UNION ALL
      SELECT * FROM dn_lines
    )
    SELECT
      month, c.debtor_code, item_group,
      MAX(item_group_desc) AS item_group_desc,
      COALESCE(SUM(revenue), 0) AS revenue,
      COALESCE(SUM(cogs), 0) AS cogs,
      COALESCE(SUM(qty_sold), 0) AS qty_sold
    FROM combined c
    JOIN dbo."Debtor" d ON c.debtor_code = d."AccNo"
    WHERE d."CompanyName" NOT ILIKE 'CASH DEBT%'
      AND d."CompanyName" NOT ILIKE 'CASH SALES%'
    GROUP BY month, c.debtor_code, item_group
    ORDER BY month, c.debtor_code, item_group
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}


// ════════════════════════════════════════════════════════════════════════════
// SUPPLIER MARGIN (1 builder)
// ════════════════════════════════════════════════════════════════════════════

async function buildSupplierMargin(source: Pool, ctx: BuilderContext): Promise<BuildResult> {
  if (!ctx.targetClient) throw new Error('buildSupplierMargin requires targetClient in context');

  // Load fruit mapping from local product table (benefits from Tier-2 description parsing)
  const { rows: products } = await ctx.targetClient.query(
    `SELECT itemcode, fruitname FROM product`
  );
  const fruitMap = new Map<string, string | null>();
  for (const p of products) {
    fruitMap.set(p.itemcode, p.fruitname || null);
  }

  const result = await source.query(`
    WITH purchase AS (
      SELECT
        ${mytMonth('h')} AS month,
        h."CreditorCode" AS creditor_code,
        d."ItemCode" AS item_code,
        SUM(d."Qty") AS purchase_qty,
        SUM(d."LocalSubTotal") AS purchase_total
      FROM dbo."PIDTL" d
      JOIN dbo."PI" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
        AND d."ItemCode" IS NOT NULL AND d."ItemCode" != ''
      GROUP BY ${mytMonth('h')}, h."CreditorCode", d."ItemCode"
    ),
    sales AS (
      SELECT
        TO_CHAR(h."DocDate" + INTERVAL '8 hours', 'YYYY-MM') AS month,
        d."ItemCode" AS item_code,
        SUM(d."Qty") AS sales_qty,
        SUM(d."LocalSubTotalExTax") AS sales_revenue
      FROM dbo."IVDTL" d
      JOIN dbo."IV" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
      GROUP BY TO_CHAR(h."DocDate" + INTERVAL '8 hours', 'YYYY-MM'), d."ItemCode"

      UNION ALL

      SELECT
        TO_CHAR(h."DocDate" + INTERVAL '8 hours', 'YYYY-MM') AS month,
        d."ItemCode",
        SUM(d."Qty"),
        SUM(d."LocalSubTotalExTax")
      FROM dbo."CSDTL" d
      JOIN dbo."CS" h ON d."DocKey" = h."DocKey"
      WHERE h."Cancelled" = 'F'
      GROUP BY TO_CHAR(h."DocDate" + INTERVAL '8 hours', 'YYYY-MM'), d."ItemCode"
    ),
    sales_agg AS (
      SELECT month, item_code, SUM(sales_qty) AS sales_qty, SUM(sales_revenue) AS sales_revenue
      FROM sales
      GROUP BY month, item_code
    ),
    -- Per-month purchase totals per item (attribution denominator)
    item_total_purchase AS (
      SELECT month, item_code, SUM(purchase_qty) AS total_purchase_qty
      FROM purchase
      GROUP BY month, item_code
    )
    SELECT
      p.month,
      p.creditor_code,
      cr."CompanyName" AS creditor_name,
      cr."CreditorType" AS creditor_type,
      COALESCE(cr."IsActive", 'T') AS is_active,
      p.item_code,
      i."Description" AS item_description,
      i."ItemGroup" AS item_group,
      COALESCE(p.purchase_qty, 0) AS purchase_qty,
      COALESCE(p.purchase_total, 0) AS purchase_total,
      CASE WHEN COALESCE(p.purchase_qty, 0) > 0
        THEN ROUND((p.purchase_total / p.purchase_qty)::numeric, 4)
        ELSE 0 END AS avg_unit_cost,
      -- Attributed sales: weighted by supplier's share of item purchases
      COALESCE(sa.sales_qty * p.purchase_qty / NULLIF(itp.total_purchase_qty, 0), 0) AS sales_qty,
      COALESCE(sa.sales_revenue * p.purchase_qty / NULLIF(itp.total_purchase_qty, 0), 0) AS sales_revenue,
      -- Attributed COGS: supplier's purchase cost scaled by sold/purchased ratio
      COALESCE(p.purchase_total * sa.sales_qty / NULLIF(itp.total_purchase_qty, 0), 0) AS attributed_cogs
    FROM purchase p
    LEFT JOIN sales_agg sa ON p.item_code = sa.item_code AND p.month = sa.month
    LEFT JOIN item_total_purchase itp ON p.item_code = itp.item_code AND p.month = itp.month
    LEFT JOIN dbo."Creditor" cr ON p.creditor_code = cr."AccNo"
    LEFT JOIN dbo."Item" i ON p.item_code = i."ItemCode"
    ORDER BY p.month, p.creditor_code, p.item_code
  `);

  // Enrich with fruit_name from local product table
  const enrichedRows = result.rows.map(row => ({
    ...row,
    fruit_name: fruitMap.get(row.item_code as string) ?? null,
  }));

  const columns = [
    'month', 'creditor_code', 'creditor_name', 'creditor_type', 'is_active',
    'item_code', 'item_description', 'item_group', 'fruit_name',
    'purchase_qty', 'purchase_total', 'avg_unit_cost',
    'sales_qty', 'sales_revenue', 'attributed_cogs',
  ];

  return { rows: enrichedRows, columns };
}


// ════════════════════════════════════════════════════════════════════════════
// P&L (2 builders)
// ════════════════════════════════════════════════════════════════════════════

async function buildPnlPeriod(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    SELECT
      pb."PeriodNo" AS period_no,
      pb."AccNo" AS acc_no,
      COALESCE(pb."ProjNo", '') AS proj_no,
      gl."Description" AS account_name,
      gl."AccType" AS acc_type,
      gl."ParentAccNo" AS parent_acc_no,
      COALESCE(SUM(pb."HomeDR"), 0) AS home_dr,
      COALESCE(SUM(pb."HomeCR"), 0) AS home_cr
    FROM dbo."PBalance" pb
    LEFT JOIN dbo."GLMast" gl ON pb."AccNo" = gl."AccNo"
    GROUP BY pb."PeriodNo", pb."AccNo", pb."ProjNo", gl."Description", gl."AccType", gl."ParentAccNo"
    ORDER BY period_no, acc_no, proj_no
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}

async function buildOpeningBalance(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    SELECT
      ob."PeriodNo" AS period_no,
      ob."AccNo" AS acc_no,
      COALESCE(ob."ProjNo", '') AS proj_no,
      COALESCE(SUM(ob."HomeDR"), 0) AS home_dr,
      COALESCE(SUM(ob."HomeCR"), 0) AS home_cr
    FROM dbo."OBalance" ob
    GROUP BY ob."PeriodNo", ob."AccNo", ob."ProjNo"
    ORDER BY period_no, acc_no, proj_no
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}


// ════════════════════════════════════════════════════════════════════════════
// EXPENSES (1 builder)
// ════════════════════════════════════════════════════════════════════════════

async function buildExpenseMonthly(source: Pool): Promise<BuildResult> {
  const result = await source.query(`
    SELECT
      TO_CHAR(g."TransDate" + INTERVAL '8 hours', 'YYYY-MM') AS month,
      g."AccNo" AS acc_no,
      gl."Description" AS account_name,
      gl."ParentAccNo" AS parent_acc_no,
      gl."AccType" AS acc_type,
      COALESCE(SUM(g."HomeDR"), 0) AS total_dr,
      COALESCE(SUM(g."HomeCR"), 0) AS total_cr,
      COALESCE(SUM(g."HomeDR"), 0) - COALESCE(SUM(g."HomeCR"), 0) AS net_amount
    FROM dbo."GLDTL" g
    JOIN dbo."GLMast" gl ON g."AccNo" = gl."AccNo"
    WHERE gl."AccType" IN ('CO', 'EP')
    GROUP BY TO_CHAR(g."TransDate" + INTERVAL '8 hours', 'YYYY-MM'), g."AccNo",
             gl."Description", gl."ParentAccNo", gl."AccType"
    ORDER BY month, acc_no
  `);
  return { rows: result.rows, columns: result.fields.map(f => f.name) };
}


// ════════════════════════════════════════════════════════════════════════════
// EXPORT ALL BUILDERS
// ════════════════════════════════════════════════════════════════════════════

export const PC_BUILDERS: PcBuilder[] = [
  // Sales (4)
  { table: 'pc_sales_daily', mode: 'swap', build: buildSalesDaily },
  { table: 'pc_sales_by_customer', mode: 'swap', build: buildSalesByCustomer },
  { table: 'pc_sales_by_outlet', mode: 'swap', build: buildSalesByOutlet },
  { table: 'pc_sales_by_fruit', mode: 'swap', build: buildSalesByFruit },
  // Payment / AR (3)
  { table: 'pc_ar_monthly', mode: 'swap', build: buildArMonthly },
  { table: 'pc_ar_customer_snapshot', mode: 'snapshot', build: buildArCustomerSnapshot },
  { table: 'pc_ar_aging_history', mode: 'snapshot', build: buildArAgingHistory },
  // Return (4)
  { table: 'pc_return_monthly', mode: 'swap', build: buildReturnMonthly },
  { table: 'pc_return_by_customer', mode: 'swap', build: buildReturnByCustomer },
  { table: 'pc_return_products', mode: 'swap', build: buildReturnProducts },
  { table: 'pc_return_aging', mode: 'snapshot', build: buildReturnAging },
  // Customer Margin (2)
  { table: 'pc_customer_margin', mode: 'swap', build: buildCustomerMargin },
  { table: 'pc_customer_margin_by_product', mode: 'swap', build: buildCustomerMarginByProduct },
  // Supplier (1)
  { table: 'pc_supplier_margin', mode: 'swap', build: buildSupplierMargin },
  // P&L (2)
  { table: 'pc_pnl_period', mode: 'swap', build: buildPnlPeriod },
  { table: 'pc_opening_balance', mode: 'swap', build: buildOpeningBalance },
  // Expenses (1)
  { table: 'pc_expense_monthly', mode: 'swap', build: buildExpenseMonthly },
];
