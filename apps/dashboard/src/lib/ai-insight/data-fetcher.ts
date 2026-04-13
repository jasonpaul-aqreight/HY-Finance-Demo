import { getPool } from '../postgres';
import type { SectionKey, DateRange } from './types';

// Convert YYYY-MM-DD to YYYY-MM to match pc_ar_monthly.month column format
function toMonth(date: string): string {
  return date.substring(0, 7);
}

// ─── Data fetchers per component ─────────────────────────────────────────────
// Each returns a formatted string for the user prompt's "Current Values" block.

type DataFetcher = (dateRange: DateRange | null) => Promise<string>;

const fetchers: Record<string, DataFetcher> = {
  // Payment Section 1
  async avg_collection_days(dr) {
    const pool = getPool();
    const startMonth = toMonth(dr!.start);
    const endMonth = toMonth(dr!.end);
    const { rows } = await pool.query(
      `SELECT month,
              CASE WHEN invoiced > 0
                THEN ROUND((total_outstanding::numeric / invoiced) * 30, 1)
                ELSE NULL END AS dso
       FROM pc_ar_monthly
       WHERE month BETWEEN $1 AND $2
       ORDER BY month`,
      [startMonth, endMonth],
    );
    if (rows.length === 0) return 'No data available for selected period.';

    const valid = rows.filter((r: { dso: number | null }) => r.dso !== null);
    const avg = valid.length > 0
      ? (valid.reduce((s: number, r: { dso: number }) => s + Number(r.dso), 0) / valid.length).toFixed(1)
      : '--';

    const dsoNum = parseFloat(avg);
    const color = isNaN(dsoNum) ? 'No data' : dsoNum <= 30 ? 'Green (Good)' : dsoNum <= 60 ? 'Yellow (Warning)' : 'Red (Critical)';

    // Rule C — pre-computed arithmetic (no LLM math)
    const daysAboveGood = isNaN(dsoNum) ? null : +(dsoNum - 30).toFixed(1);
    const daysAboveWarning = isNaN(dsoNum) ? null : +(dsoNum - 60).toFixed(1);
    const dsoValues = valid.map((r: { dso: number }) => Number(r.dso));
    const minDso = dsoValues.length ? Math.min(...dsoValues) : null;
    const maxDso = dsoValues.length ? Math.max(...dsoValues) : null;
    const minRow = valid.find((r: { dso: number }) => Number(r.dso) === minDso);
    const maxRow = valid.find((r: { dso: number }) => Number(r.dso) === maxDso);
    const monthsAbove60 = dsoValues.filter((d: number) => d > 60).length;
    const monthsAbove30 = dsoValues.filter((d: number) => d > 30).length;

    let table = '| Month | Collection Days |\n|-------|----------------|\n';
    for (const r of rows) {
      table += `| ${r.month} | ${r.dso != null ? r.dso + ' days' : 'N/A'} |\n`;
    }
    const preCalc =
      `Pre-calculated gaps (use these values directly — do not recompute):\n` +
      `- Period average: ${avg} days\n` +
      (daysAboveGood !== null ? `- Days above 30-day (Good) benchmark: ${daysAboveGood > 0 ? '+' : ''}${daysAboveGood} days\n` : '') +
      (daysAboveWarning !== null ? `- Days above 60-day (Warning) benchmark: ${daysAboveWarning > 0 ? '+' : ''}${daysAboveWarning} days\n` : '') +
      (minRow ? `- Best month: ${minRow.month} at ${minDso} days\n` : '') +
      (maxRow ? `- Worst month: ${maxRow.month} at ${maxDso} days\n` : '') +
      `- Months above 30-day benchmark: ${monthsAbove30} of ${dsoValues.length}\n` +
      `- Months above 60-day benchmark: ${monthsAbove60} of ${dsoValues.length}\n`;
    return `Value: ${avg} days\nColor: ${color}\n\n${preCalc}\nMonthly breakdown:\n${table}`;
  },

  async collection_rate(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(collected), 0) AS total_collected,
              COALESCE(SUM(invoiced), 0) AS total_invoiced
       FROM pc_ar_monthly
       WHERE month BETWEEN $1 AND $2`,
      [toMonth(dr!.start), toMonth(dr!.end)],
    );
    const { total_collected, total_invoiced } = rows[0];
    const rate = total_invoiced > 0 ? ((total_collected / total_invoiced) * 100).toFixed(1) : '--';
    const rateNum = parseFloat(rate);
    const color = isNaN(rateNum) ? 'No data' : rateNum >= 80 ? 'Green (Good)' : rateNum >= 50 ? 'Yellow (Warning)' : 'Red (Critical)';

    return `Value: ${rate}%\nColor: ${color}\nTotal Collected: RM ${Number(total_collected).toLocaleString('en-MY')}\nTotal Invoiced: RM ${Number(total_invoiced).toLocaleString('en-MY')}`;
  },

  async avg_monthly_collection(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS months, COALESCE(SUM(collected), 0) AS total_collected
       FROM pc_ar_monthly
       WHERE month BETWEEN $1 AND $2`,
      [toMonth(dr!.start), toMonth(dr!.end)],
    );
    const { months, total_collected } = rows[0];
    const avg = months > 0 ? (total_collected / months) : 0;

    return `Value: RM ${Math.round(avg).toLocaleString('en-MY')}\nMonths in range: ${months}\nTotal Collected: RM ${Number(total_collected).toLocaleString('en-MY')}`;
  },

  async collection_days_trend(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT month,
              CASE WHEN invoiced > 0
                THEN ROUND((total_outstanding::numeric / invoiced) * 30, 1)
                ELSE NULL END AS dso
       FROM pc_ar_monthly
       WHERE month BETWEEN $1 AND $2
       ORDER BY month`,
      [toMonth(dr!.start), toMonth(dr!.end)],
    );
    const valid = rows.filter((r: { dso: number | null }) => r.dso !== null);
    const avg = valid.length > 0
      ? (valid.reduce((s: number, r: { dso: number }) => s + Number(r.dso), 0) / valid.length).toFixed(1)
      : '--';

    let table = '| Month | Collection Days |\n|-------|----------------|\n';
    for (const r of rows) {
      table += `| ${r.month} | ${r.dso != null ? r.dso + ' days' : 'N/A'} |\n`;
    }
    return `Data points:\n${table}\nAverage: ${avg} days`;
  },

  async invoiced_vs_collected(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT month, invoiced, collected
       FROM pc_ar_monthly
       WHERE month BETWEEN $1 AND $2
       ORDER BY month`,
      [toMonth(dr!.start), toMonth(dr!.end)],
    );
    const totalInv = rows.reduce((s: number, r: { invoiced: number }) => s + Number(r.invoiced), 0);
    const totalCol = rows.reduce((s: number, r: { collected: number }) => s + Number(r.collected), 0);
    const avgCol = rows.length > 0 ? totalCol / rows.length : 0;

    // Rule C — pre-computed per-month gap array + min/max/worst
    type GapRow = { month: string; invoiced: number; collected: number; gap: number };
    const gapRows: GapRow[] = rows.map((r: { month: string; invoiced: number; collected: number }) => ({
      month: r.month,
      invoiced: Number(r.invoiced),
      collected: Number(r.collected),
      gap: Number(r.collected) - Number(r.invoiced),
    }));
    const negMonths = gapRows.filter((r) => r.gap < 0);
    const posMonths = gapRows.filter((r) => r.gap >= 0);
    const worst = negMonths.length
      ? negMonths.reduce((a, b) => (a.gap < b.gap ? a : b))
      : null;
    const secondWorst = negMonths.length > 1
      ? negMonths.filter((r) => r !== worst).reduce((a, b) => (a.gap < b.gap ? a : b))
      : null;
    const best = posMonths.length
      ? posMonths.reduce((a, b) => (a.gap > b.gap ? a : b))
      : null;
    const negSum = negMonths.reduce((s, r) => s + r.gap, 0);
    const worstTwoPct =
      worst && secondWorst && negSum < 0
        ? (((worst.gap + secondWorst.gap) / negSum) * 100).toFixed(1)
        : null;

    // Rule C — pre-computed half-period averages (prevents the LLM from
    // inventing sub-period averages or cherry-picking month ranges).
    // Split the period into two equal halves by month count; for odd N, H2 gets the extra month.
    const halfIdx = Math.floor(gapRows.length / 2);
    const h1Rows = gapRows.slice(0, halfIdx);
    const h2Rows = gapRows.slice(halfIdx);
    const avgOf = (rs: GapRow[]) => rs.length ? rs.reduce((s, r) => s + r.gap, 0) / rs.length : 0;
    const h1Avg = avgOf(h1Rows);
    const h2Avg = avgOf(h2Rows);
    const h1Min = h1Rows.length ? h1Rows.reduce((a, b) => (a.gap < b.gap ? a : b)) : null;
    const h1Max = h1Rows.length ? h1Rows.reduce((a, b) => (a.gap > b.gap ? a : b)) : null;
    const h2Min = h2Rows.length ? h2Rows.reduce((a, b) => (a.gap < b.gap ? a : b)) : null;
    const h2Max = h2Rows.length ? h2Rows.reduce((a, b) => (a.gap > b.gap ? a : b)) : null;
    const fmtSigned = (n: number) =>
      `${n >= 0 ? '+' : ''}RM ${n.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;
    const h1MonthList = h1Rows.map(r => r.month).join(', ');
    const h2MonthList = h2Rows.map(r => r.month).join(', ');
    const direction =
      h1Rows.length && h2Rows.length
        ? (Math.abs(h2Avg) < Math.abs(h1Avg) ? 'narrowing' : Math.abs(h2Avg) > Math.abs(h1Avg) ? 'widening' : 'flat')
        : 'n/a';

    let table = '| Month | Invoiced | Collected | Gap |\n|-------|----------|-----------|-----|\n';
    for (const r of gapRows) {
      table += `| ${r.month} | RM ${r.invoiced.toLocaleString('en-MY')} | RM ${r.collected.toLocaleString('en-MY')} | ${r.gap >= 0 ? '+' : ''}RM ${r.gap.toLocaleString('en-MY')} |\n`;
    }
    const gap = totalCol - totalInv;

    const preCalc =
      `Pre-calculated monthly gap analysis (use these values directly — do not cherry-pick a rosy sub-range):\n` +
      `- Months with negative gap (collected < invoiced): ${negMonths.length} of ${gapRows.length}\n` +
      `- Months with positive gap (collected >= invoiced): ${posMonths.length} of ${gapRows.length}\n` +
      (worst ? `- Worst single month: ${worst.month} at ${worst.gap >= 0 ? '+' : ''}RM ${worst.gap.toLocaleString('en-MY')}\n` : '') +
      (secondWorst ? `- Second-worst month: ${secondWorst.month} at ${secondWorst.gap >= 0 ? '+' : ''}RM ${secondWorst.gap.toLocaleString('en-MY')}\n` : '') +
      (best ? `- Best month: ${best.month} at ${best.gap >= 0 ? '+' : ''}RM ${best.gap.toLocaleString('en-MY')}\n` : '') +
      (worstTwoPct ? `- Worst two months combined = ${worstTwoPct}% of the full-period negative gap\n` : '') +
      `- Period total negative gap: RM ${negSum.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\n` +
      `\nPre-calculated half-period averages (use these ONLY — do NOT compute your own H1/H2/"first half"/"last 4 months" or any other sub-period averages):\n` +
      (h1Rows.length ? `- H1 months (${h1Rows.length}): ${h1MonthList}\n` : '') +
      (h1Rows.length ? `- H1 avg gap: ${fmtSigned(h1Avg)}/month\n` : '') +
      (h1Min && h1Max ? `- H1 gap range: ${fmtSigned(h1Min.gap)} (${h1Min.month}) .. ${fmtSigned(h1Max.gap)} (${h1Max.month})\n` : '') +
      (h2Rows.length ? `- H2 months (${h2Rows.length}): ${h2MonthList}\n` : '') +
      (h2Rows.length ? `- H2 avg gap: ${fmtSigned(h2Avg)}/month\n` : '') +
      (h2Min && h2Max ? `- H2 gap range: ${fmtSigned(h2Min.gap)} (${h2Min.month}) .. ${fmtSigned(h2Max.gap)} (${h2Max.month})\n` : '') +
      `- H1→H2 direction: ${direction} (based on |H2 avg| vs |H1 avg|)\n`;

    return `Period totals:\nTotal Invoiced: RM ${totalInv.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\nTotal Collected: RM ${totalCol.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\nCumulative Gap: ${gap >= 0 ? '+' : ''}RM ${gap.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\nAvg Monthly Collection: RM ${Math.round(avgCol).toLocaleString('en-MY')}\n\n${preCalc}\nMonthly breakdown:\n${table}`;
  },

  // Payment Section 2 (Snapshot — always uses latest snapshot_date)
  async total_outstanding() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return 'No snapshot data available.';
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(total_outstanding), 0) AS total
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND total_outstanding > 0
         AND company_name NOT ILIKE 'CASH SALES%'`,
      [latest.d],
    );
    const total = Number(rows[0].total);

    const { rows: top5 } = await pool.query(
      `SELECT company_name, total_outstanding
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND total_outstanding > 0
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY total_outstanding DESC
       LIMIT 5`,
      [latest.d],
    );

    let top5Share = 0;
    let topTable = '| Rank | Customer | Outstanding | % of Total |\n|------|----------|-------------|------------|\n';
    top5.forEach((r: { company_name: string; total_outstanding: number }, i: number) => {
      const amt = Number(r.total_outstanding);
      const pct = total > 0 ? (amt / total) * 100 : 0;
      top5Share += pct;
      topTable += `| ${i + 1} | ${r.company_name} | RM ${amt.toLocaleString('en-MY')} | ${pct.toFixed(1)}% |\n`;
    });

    return `Value: RM ${total.toLocaleString('en-MY')}\n\nTop 5 contributors (${top5Share.toFixed(1)}% of total):\n${topTable}`;
  },

  async overdue_amount() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return 'No snapshot data available.';
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(total_outstanding), 0) AS total,
              COALESCE(SUM(overdue_amount), 0) AS overdue,
              COUNT(*) FILTER (WHERE overdue_amount > 0) AS overdue_customers,
              COUNT(*) AS total_customers
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND total_outstanding > 0
         AND company_name NOT ILIKE 'CASH SALES%'`,
      [latest.d],
    );
    const { total, overdue, overdue_customers, total_customers } = rows[0];
    const pct = total > 0 ? ((overdue / total) * 100).toFixed(1) : '0';

    const { rows: top5 } = await pool.query(
      `SELECT company_name, overdue_amount, max_overdue_days
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND overdue_amount > 0
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY overdue_amount DESC
       LIMIT 5`,
      [latest.d],
    );

    const overdueTotal = Number(overdue);
    let topTable = '| Rank | Customer | Overdue Amount | Max Overdue Days | % of Overdue |\n|------|----------|----------------|-------------------|--------------|\n';
    top5.forEach((r: { company_name: string; overdue_amount: number; max_overdue_days: number | null }, i: number) => {
      const amt = Number(r.overdue_amount);
      const sharePct = overdueTotal > 0 ? ((amt / overdueTotal) * 100).toFixed(1) : '0';
      const days = r.max_overdue_days != null ? `${r.max_overdue_days} days` : 'N/A';
      topTable += `| ${i + 1} | ${r.company_name} | RM ${amt.toLocaleString('en-MY')} | ${days} | ${sharePct}% |\n`;
    });

    return `Value: RM ${Number(overdue).toLocaleString('en-MY')}\nPercentage of total: ${pct}%\nOverdue customers: ${overdue_customers}\nTotal customers: ${total_customers}\n\nTop 5 overdue customers:\n${topTable}`;
  },

  async credit_limit_breaches() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return 'No snapshot data available.';
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS breach_count
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND credit_limit > 0 AND total_outstanding > credit_limit
         AND is_active = 'T'
         AND company_name NOT ILIKE 'CASH SALES%'`,
      [latest.d],
    );
    const count = parseInt(rows[0].breach_count);
    const color = count === 0 ? 'Green (Good)' : 'Red (Concern)';

    if (count === 0) {
      return `Value: ${count} customers\nColor: ${color}`;
    }

    const { rows: breaches } = await pool.query(
      `SELECT company_name, credit_limit, total_outstanding, utilization_pct
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND credit_limit > 0 AND total_outstanding > credit_limit
         AND is_active = 'T'
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY utilization_pct DESC NULLS LAST
       LIMIT 10`,
      [latest.d],
    );

    let breachTable = '| Rank | Customer | Credit Limit | Outstanding | Utilization |\n|------|----------|--------------|-------------|-------------|\n';
    breaches.forEach((r: { company_name: string; credit_limit: number; total_outstanding: number; utilization_pct: number | null }, i: number) => {
      const util = r.utilization_pct != null ? `${Number(r.utilization_pct).toFixed(0)}%` : 'N/A';
      breachTable += `| ${i + 1} | ${r.company_name} | RM ${Number(r.credit_limit).toLocaleString('en-MY')} | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${util} |\n`;
    });

    const showing = Math.min(count, 10);
    const heading = count > 10 ? `Top ${showing} breaching customers (of ${count}) by utilization:` : `Breaching customers (${count}) by utilization:`;
    return `Value: ${count} customers\nColor: ${color}\n\n${heading}\n${breachTable}`;
  },

  async aging_analysis() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_aging_history`);
    if (!latest?.d) return 'No aging data available.';
    const { rows } = await pool.query(
      `SELECT bucket, SUM(invoice_count) AS invoices, SUM(total_outstanding) AS amount
       FROM pc_ar_aging_history
       WHERE snapshot_date = $1 AND dimension = 'all'
       GROUP BY bucket
       ORDER BY CASE bucket
         WHEN 'Not Yet Due' THEN 0
         WHEN '1-30' THEN 1
         WHEN '31-60' THEN 2
         WHEN '61-90' THEN 3
         WHEN '91-120' THEN 4
         WHEN '120+' THEN 5
       END`,
      [latest.d],
    );
    const total = rows.reduce((s: number, r: { amount: number }) => s + r.amount, 0);

    let table = '| Bucket | Amount | % of Total | Invoices |\n|--------|--------|-----------|----------|\n';
    for (const r of rows) {
      const pct = total > 0 ? ((r.amount / total) * 100).toFixed(1) : '0';
      table += `| ${r.bucket} | RM ${Number(r.amount).toLocaleString('en-MY')} | ${pct}% | ${r.invoices} |\n`;
    }
    return `Data:\n${table}\nTotal Outstanding: RM ${Number(total).toLocaleString('en-MY')}`;
  },

  async credit_usage_distribution() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return 'No snapshot data available.';
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE credit_limit > 0 AND utilization_pct < 80) AS within_limit,
         COUNT(*) FILTER (WHERE credit_limit > 0 AND utilization_pct >= 80 AND utilization_pct < 100) AS near_limit,
         COUNT(*) FILTER (WHERE credit_limit > 0 AND utilization_pct >= 100) AS over_limit,
         COUNT(*) FILTER (WHERE credit_limit = 0 OR credit_limit IS NULL) AS no_limit,
         COUNT(*) AS total
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND (is_active = 'T' OR is_active IS NULL)
         AND company_name NOT ILIKE 'CASH SALES%'`,
      [latest.d],
    );
    const r = rows[0];
    return `Categories:\n- Within Limit (< 80%): ${r.within_limit} customers\n- Near Limit (80-99%): ${r.near_limit} customers\n- Over Limit (>= 100%): ${r.over_limit} customers\n- No Limit Set: ${r.no_limit} customers\nTotal: ${r.total} customers`;
  },

  async customer_credit_health() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return 'No snapshot data available.';
    const { rows: summary } = await pool.query(
      `SELECT risk_tier, COUNT(*) AS count, SUM(total_outstanding) AS total_outstanding
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND (is_active = 'T' OR total_outstanding > 0)
         AND company_name NOT ILIKE 'CASH SALES%'
       GROUP BY risk_tier
       ORDER BY CASE risk_tier WHEN 'High' THEN 0 WHEN 'Moderate' THEN 1 WHEN 'Low' THEN 2 END`,
      [latest.d],
    );
    const { rows: topByOutstanding } = await pool.query(
      `SELECT company_name, total_outstanding, credit_score, risk_tier
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND total_outstanding > 0
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY total_outstanding DESC
       LIMIT 5`,
      [latest.d],
    );
    const { rows: topByOverdueDays } = await pool.query(
      `SELECT company_name, max_overdue_days, total_outstanding, risk_tier
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND total_outstanding > 0
         AND max_overdue_days IS NOT NULL
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY max_overdue_days DESC
       LIMIT 5`,
      [latest.d],
    );
    const { rows: topByUtilization } = await pool.query(
      `SELECT company_name, utilization_pct, credit_limit, total_outstanding, risk_tier
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND credit_limit > 0 AND total_outstanding > 0
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY utilization_pct DESC NULLS LAST
       LIMIT 5`,
      [latest.d],
    );
    const totalCustomers = summary.reduce((s: number, r: { count: string }) => s + parseInt(r.count), 0);
    const totalOutstanding = summary.reduce((s: number, r: { total_outstanding: number }) => s + Number(r.total_outstanding), 0);

    let riskTable = '| Risk Tier | Count | % of Customers | Outstanding | % of Outstanding |\n|-----------|-------|----------------|-------------|------------------|\n';
    for (const r of summary) {
      const custPct = ((parseInt(r.count) / totalCustomers) * 100).toFixed(0);
      const outPct = totalOutstanding > 0 ? ((Number(r.total_outstanding) / totalOutstanding) * 100).toFixed(1) : '0';
      riskTable += `| ${r.risk_tier} | ${r.count} | ${custPct}% | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${outPct}% |\n`;
    }

    let outstandingTable = '| Customer | Outstanding | Score | Risk |\n|----------|-------------|-------|------|\n';
    for (const r of topByOutstanding) {
      outstandingTable += `| ${r.company_name} | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${r.credit_score} | ${r.risk_tier} |\n`;
    }

    let overdueTable = '| Customer | Max Overdue Days | Outstanding | Risk |\n|----------|-------------------|-------------|------|\n';
    for (const r of topByOverdueDays) {
      overdueTable += `| ${r.company_name} | ${r.max_overdue_days} days | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${r.risk_tier} |\n`;
    }

    let utilTable = '| Customer | Utilization | Credit Limit | Outstanding | Risk |\n|----------|-------------|--------------|-------------|------|\n';
    for (const r of topByUtilization) {
      const util = r.utilization_pct != null ? `${Number(r.utilization_pct).toFixed(0)}%` : 'N/A';
      utilTable += `| ${r.company_name} | ${util} | RM ${Number(r.credit_limit).toLocaleString('en-MY')} | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${r.risk_tier} |\n`;
    }

    return `Summary:\n- Total customers: ${totalCustomers}\n\nRisk distribution:\n${riskTable}\nTop 5 by outstanding amount:\n${outstandingTable}\nTop 5 by max overdue days (most delinquent):\n${overdueTable}\nTop 5 by utilization % (most over credit limit):\n${utilTable}`;
  },

  // Sales Section 3
  async net_sales(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(invoice_total), 0) AS invoice_sales,
              COALESCE(SUM(cash_total), 0) AS cash_sales,
              COALESCE(SUM(cn_total), 0) AS credit_notes,
              COALESCE(SUM(net_revenue), 0) AS net_sales
       FROM pc_sales_daily
       WHERE doc_date BETWEEN $1 AND $2`,
      [dr!.start, dr!.end],
    );
    const r = rows[0];
    return `Value: RM ${Number(r.net_sales).toLocaleString('en-MY')}\nInvoice Sales: RM ${Number(r.invoice_sales).toLocaleString('en-MY')}\nCash Sales: RM ${Number(r.cash_sales).toLocaleString('en-MY')}\nCredit Notes: -RM ${Number(Math.abs(r.credit_notes)).toLocaleString('en-MY')}`;
  },

  async invoice_sales(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(invoice_total), 0) AS invoice_sales,
              COALESCE(SUM(net_revenue), 0) AS net_sales
       FROM pc_sales_daily
       WHERE doc_date BETWEEN $1 AND $2`,
      [dr!.start, dr!.end],
    );
    const r = rows[0];
    const pct = r.net_sales > 0 ? ((r.invoice_sales / r.net_sales) * 100).toFixed(1) : '0';
    return `Value: RM ${Number(r.invoice_sales).toLocaleString('en-MY')}\nAs % of net sales: ${pct}%`;
  },

  async cash_sales(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(cash_total), 0) AS cash_sales,
              COALESCE(SUM(net_revenue), 0) AS net_sales
       FROM pc_sales_daily
       WHERE doc_date BETWEEN $1 AND $2`,
      [dr!.start, dr!.end],
    );
    const r = rows[0];
    const pct = r.net_sales > 0 ? ((r.cash_sales / r.net_sales) * 100).toFixed(1) : '0';
    return `Value: RM ${Number(r.cash_sales).toLocaleString('en-MY')}\nAs % of net sales: ${pct}%`;
  },

  async credit_notes(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(cn_total), 0) AS credit_notes,
              COALESCE(SUM(invoice_total + cash_total), 0) AS gross_sales
       FROM pc_sales_daily
       WHERE doc_date BETWEEN $1 AND $2`,
      [dr!.start, dr!.end],
    );
    const r = rows[0];
    const cnAbs = Math.abs(r.credit_notes);
    const pct = r.gross_sales > 0 ? ((cnAbs / r.gross_sales) * 100).toFixed(2) : '0';
    const color = parseFloat(pct) <= 1 ? 'Green (Good)' : parseFloat(pct) <= 3 ? 'Yellow (Monitor)' : 'Red (Concern)';

    return `Value: -RM ${cnAbs.toLocaleString('en-MY')}\nAs % of gross sales: ${pct}%\nColor: ${color}`;
  },

  async net_sales_trend(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT to_char(doc_date, 'YYYY-MM') AS month,
              COALESCE(SUM(invoice_total), 0) AS invoice_sales,
              COALESCE(SUM(cash_total), 0) AS cash_sales,
              COALESCE(SUM(cn_total), 0) AS credit_notes,
              COALESCE(SUM(net_revenue), 0) AS net_sales
       FROM pc_sales_daily
       WHERE doc_date BETWEEN $1 AND $2
       GROUP BY to_char(doc_date, 'YYYY-MM')
       ORDER BY month`,
      [dr!.start, dr!.end],
    );
    let table = '| Month | Invoice Sales | Cash Sales | Credit Notes | Net Sales |\n|-------|-------------|-----------|-------------|----------|\n';
    for (const r of rows) {
      table += `| ${r.month} | RM ${Number(r.invoice_sales).toLocaleString('en-MY')} | RM ${Number(r.cash_sales).toLocaleString('en-MY')} | -RM ${Number(Math.abs(r.credit_notes)).toLocaleString('en-MY')} | RM ${Number(r.net_sales).toLocaleString('en-MY')} |\n`;
    }
    return `Data points:\n${table}`;
  },

  // Sales Section 4: Breakdown
  async by_customer(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT debtor_code, company_name, debtor_type,
              SUM(total_sales) AS net_sales,
              SUM(invoice_sales) AS invoice_sales,
              SUM(cash_sales) AS cash_sales,
              SUM(credit_notes) AS credit_notes
       FROM pc_sales_by_customer
       WHERE doc_date BETWEEN $1 AND $2
       GROUP BY debtor_code, company_name, debtor_type
       ORDER BY SUM(total_sales) DESC
       LIMIT 15`,
      [dr!.start, dr!.end],
    );
    const { rows: totals } = await pool.query(
      `SELECT SUM(total_sales) AS total_net,
              COUNT(DISTINCT debtor_code) AS customer_count
       FROM pc_sales_by_customer
       WHERE doc_date BETWEEN $1 AND $2`,
      [dr!.start, dr!.end],
    );
    const totalNet = Number(totals[0]?.total_net ?? 0);
    const customerCount = Number(totals[0]?.customer_count ?? 0);

    const { rows: typeMix } = await pool.query(
      `SELECT COALESCE(NULLIF(debtor_type, ''), '(Unknown)') AS debtor_type,
              COUNT(DISTINCT debtor_code) AS cust_count,
              SUM(total_sales) AS net_sales
       FROM pc_sales_by_customer
       WHERE doc_date BETWEEN $1 AND $2
       GROUP BY COALESCE(NULLIF(debtor_type, ''), '(Unknown)')
       ORDER BY SUM(total_sales) DESC`,
      [dr!.start, dr!.end],
    );

    let table = '| Rank | Customer | Type | Net Sales | % of Total |\n|------|----------|------|-----------|------------|\n';
    let top5Share = 0;
    let top10Share = 0;
    rows.forEach((r: Record<string, unknown>, i: number) => {
      const pct = totalNet > 0 ? (Number(r.net_sales) / totalNet) * 100 : 0;
      if (i < 5) top5Share += pct;
      if (i < 10) top10Share += pct;
      table += `| ${i + 1} | ${r.company_name} | ${r.debtor_type || '(Unknown)'} | RM ${Number(r.net_sales).toLocaleString('en-MY')} | ${pct.toFixed(1)}% |\n`;
    });

    let typeTable = '| Type | Customers | Net Sales | % of Total |\n|------|-----------|-----------|------------|\n';
    for (const t of typeMix) {
      const pct = totalNet > 0 ? ((Number(t.net_sales) / totalNet) * 100).toFixed(1) : '0';
      typeTable += `| ${t.debtor_type} | ${t.cust_count} | RM ${Number(t.net_sales).toLocaleString('en-MY')} | ${pct}% |\n`;
    }

    return `Dimension: Customer\nTotal net sales: RM ${totalNet.toLocaleString('en-MY')}\nActive customers in period: ${customerCount}\n\nConcentration risk (pre-calculated):\n- Top 5 customers: ${top5Share.toFixed(1)}% of total revenue\n- Top 10 customers: ${top10Share.toFixed(1)}% of total revenue\n\nTop 15 by net sales:\n${table}\nCustomer type mix:\n${typeTable}`;
  },

  async by_product(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT fruit_name, fruit_country, fruit_variant,
              SUM(total_sales) AS net_sales, SUM(total_qty) AS qty
       FROM pc_sales_by_fruit
       WHERE doc_date BETWEEN $1 AND $2
       GROUP BY fruit_name, fruit_country, fruit_variant
       ORDER BY SUM(total_sales) DESC
       LIMIT 15`,
      [dr!.start, dr!.end],
    );
    const { rows: totals } = await pool.query(
      `SELECT SUM(total_sales) AS total_net FROM pc_sales_by_fruit WHERE doc_date BETWEEN $1 AND $2`,
      [dr!.start, dr!.end],
    );
    const totalNet = totals[0]?.total_net ?? 0;

    let table = '| Rank | Product | Country | Net Sales | % | Qty |\n|------|---------|---------|-----------|---|-----|\n';
    rows.forEach((r: Record<string, unknown>, i: number) => {
      const pct = totalNet > 0 ? ((Number(r.net_sales) / totalNet) * 100).toFixed(1) : '0';
      table += `| ${i + 1} | ${r.fruit_name} | ${r.fruit_country || '-'} | RM ${Number(r.net_sales).toLocaleString('en-MY')} | ${pct}% | ${Number(r.qty).toLocaleString('en-MY')} |\n`;
    });

    return `Dimension: Product\nTotal net sales: RM ${Number(totalNet).toLocaleString('en-MY')}\n\nTop 15 by net sales:\n${table}`;
  },

  async by_agent(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT dimension_key AS agent_name, MAX(is_active::text) AS is_active,
              SUM(invoice_sales) AS invoice_sales, SUM(cash_sales) AS cash_sales,
              SUM(total_sales) AS net_sales, SUM(customer_count) AS customer_count
       FROM pc_sales_by_outlet
       WHERE dimension = 'agent' AND doc_date BETWEEN $1 AND $2
       GROUP BY dimension_key
       ORDER BY SUM(total_sales) DESC`,
      [dr!.start, dr!.end],
    );
    const total = rows.reduce((s: number, r: { net_sales: number }) => s + Number(r.net_sales), 0);

    let table = '| Agent | Active | Net Sales | % of Total | Invoice | Cash | Customers |\n|-------|--------|-----------|-----------|---------|------|-----------|\n';
    for (const r of rows) {
      const pct = total > 0 ? ((Number(r.net_sales) / total) * 100).toFixed(1) : '0';
      table += `| ${r.agent_name} | ${r.is_active} | RM ${Number(r.net_sales).toLocaleString('en-MY')} | ${pct}% | RM ${Number(r.invoice_sales).toLocaleString('en-MY')} | RM ${Number(r.cash_sales).toLocaleString('en-MY')} | ${r.customer_count} |\n`;
    }
    return `Dimension: Sales Agent\nTotal net sales: RM ${Number(total).toLocaleString('en-MY')}\n\n${table}`;
  },

  async by_outlet(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT dimension_key AS outlet,
              SUM(invoice_sales) AS invoice_sales, SUM(cash_sales) AS cash_sales,
              SUM(credit_notes) AS credit_notes, SUM(total_sales) AS net_sales
       FROM pc_sales_by_outlet
       WHERE dimension = 'location' AND doc_date BETWEEN $1 AND $2
       GROUP BY dimension_key
       ORDER BY SUM(total_sales) DESC`,
      [dr!.start, dr!.end],
    );
    const total = rows.reduce((s: number, r: { net_sales: number }) => s + r.net_sales, 0);

    let table = '| Outlet | Net Sales | % | Invoice | Cash | Credit Notes |\n|--------|-----------|---|---------|------|--------------|\n';
    for (const r of rows) {
      const pct = total > 0 ? ((r.net_sales / total) * 100).toFixed(1) : '0';
      table += `| ${r.outlet} | RM ${Number(r.net_sales).toLocaleString('en-MY')} | ${pct}% | RM ${Number(r.invoice_sales).toLocaleString('en-MY')} | RM ${Number(r.cash_sales).toLocaleString('en-MY')} | -RM ${Number(Math.abs(r.credit_notes)).toLocaleString('en-MY')} |\n`;
    }
    return `Dimension: Outlet\nTotal net sales: RM ${Number(total).toLocaleString('en-MY')}\n\n${table}`;
  },
};

// ─── Scope classification ────────────────────────────────────────────────────
// Every component is either period-based (filtered by date range) or snapshot-based
// (current state, not time-filtered). The scope label is prepended to all fetcher
// output so the LLM cannot conflate period metrics with snapshot metrics.

type ScopeType = 'period' | 'snapshot';

const SECTION_SCOPE: Record<SectionKey, ScopeType> = {
  payment_collection_trend: 'period',
  payment_outstanding: 'snapshot',
  sales_trend: 'period',
  sales_breakdown: 'period',
};

async function buildScopeLabel(scope: ScopeType, dateRange: DateRange | null): Promise<string> {
  if (scope === 'period') {
    if (!dateRange) return 'Scope: Period-based metric (no date range provided).';
    return `Scope: PERIOD-BASED metric — filtered to ${dateRange.start} through ${dateRange.end}. All figures reflect activity WITHIN this date range only. Do NOT describe these numbers as "outstanding balance" or "total receivables" — they are period flows, not point-in-time balances.`;
  }
  // Snapshot: fetch latest snapshot_date once for the label
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    const d = rows[0]?.d ? new Date(rows[0].d).toISOString().slice(0, 10) : 'unknown';
    return `Scope: SNAPSHOT metric — current state as of ${d}. These are point-in-time balances NOT filtered by any date range. Do NOT describe these numbers as "period collection" or "invoiced in the period" — they are cumulative balances. Do NOT apply any date-range context to these numbers.`;
  } catch {
    return 'Scope: SNAPSHOT metric — current state. Point-in-time balances, not filtered by date range.';
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchComponentData(
  componentKey: string,
  sectionKey: SectionKey,
  dateRange: DateRange | null,
): Promise<string> {
  const fetcher = fetchers[componentKey];
  if (!fetcher) return `No data fetcher defined for component: ${componentKey}`;

  try {
    const body = await fetcher(dateRange);
    const scopeLabel = await buildScopeLabel(SECTION_SCOPE[sectionKey], dateRange);
    return `${scopeLabel}\n\n${body}`;
  } catch (err) {
    console.error(`Data fetch error for ${componentKey}:`, err);
    return `Error fetching data: ${err instanceof Error ? err.message : String(err)}`;
  }
}
