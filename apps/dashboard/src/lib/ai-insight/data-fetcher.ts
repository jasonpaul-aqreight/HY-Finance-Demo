import { getPool } from '../postgres';
import {
  getMarginKpi,
  getMarginTrend,
  getMarginDistribution,
  getCustomerMargins,
  getCreditNoteImpact,
  type MarginFilters,
} from '../customer-margin/queries';
import {
  getMarginSummary as getSupplierMarginSummary,
  getMarginTrend as getSupplierMarginTrend,
  getSupplierMarginDistributionV2,
  getItemMarginDistributionV2,
  getTopBottomSuppliersV2,
  getTopBottomItemsV2,
  getSupplierTableV2,
  getItemListV2,
  getItemSupplierSummaryV2,
  getPriceSpread,
} from '../supplier-margin/queries';
import {
  getReturnOverview,
  getReturnTrend,
  getRefundSummary,
  getReturnProducts,
  getReturnAging,
  getAllCustomerReturnsAll,
} from '../return/queries';
import {
  getCostKpisV2,
  getCostTrendV2,
  getCostCompositionV2,
  getCogsBreakdown,
  getOpexBreakdown,
  getTopExpensesByType,
} from '../expenses/queries';
import type { SectionKey, DateRange, AllowedValue, FetcherResult } from './types';

// Convert YYYY-MM-DD to YYYY-MM to match pc_ar_monthly.month column format
function toMonth(date: string): string {
  return date.substring(0, 7);
}

// ─── Allowed-value helpers (mechanical whitelisting for the numeric guard) ──

const rm = (label: string, value: number): AllowedValue => ({ label, value, unit: 'RM' });
const pct = (label: string, value: number): AllowedValue => ({ label, value, unit: 'pct' });
const days = (label: string, value: number): AllowedValue => ({ label, value, unit: 'days' });
const cnt = (label: string, value: number): AllowedValue => ({ label, value, unit: 'count' });

// ─── Data fetchers per component ─────────────────────────────────────────────
// Each returns the formatted prompt block AND an `allowed` whitelist of every
// numeric value that legally appears in (or could be derived from) the prompt.

type DataFetcher = (dateRange: DateRange | null) => Promise<FetcherResult>;

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
    if (rows.length === 0) {
      return { prompt: 'No data available for selected period.', allowed: [] };
    }

    const valid = rows.filter((r: { dso: number | null }) => r.dso !== null);
    const avg = valid.length > 0
      ? (valid.reduce((s: number, r: { dso: number }) => s + Number(r.dso), 0) / valid.length).toFixed(1)
      : '--';

    const dsoNum = parseFloat(avg);
    const color = isNaN(dsoNum) ? 'No data' : dsoNum <= 30 ? 'Green (Good)' : dsoNum <= 60 ? 'Yellow (Warning)' : 'Red (Critical)';

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

    const allowed: AllowedValue[] = [];
    allowed.push(days('30-day benchmark', 30));
    allowed.push(days('60-day benchmark', 60));
    if (!isNaN(dsoNum)) allowed.push(days('period avg collection days', dsoNum));
    if (daysAboveGood !== null) allowed.push(days('days above 30-day benchmark', daysAboveGood));
    if (daysAboveWarning !== null) allowed.push(days('days above 60-day benchmark', daysAboveWarning));
    if (minDso !== null) allowed.push(days('best month days', minDso));
    if (maxDso !== null) allowed.push(days('worst month days', maxDso));
    allowed.push(cnt('months above 30-day benchmark', monthsAbove30));
    allowed.push(cnt('months above 60-day benchmark', monthsAbove60));
    allowed.push(cnt('total months in period', dsoValues.length));
    for (const r of rows) {
      if (r.dso != null) allowed.push(days(`${r.month} dso`, Number(r.dso)));
    }

    return {
      prompt: `Value: ${avg} days\nColor: ${color}\n\n${preCalc}\nMonthly breakdown:\n${table}`,
      allowed,
    };
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
    const total_collected = Number(rows[0].total_collected);
    const total_invoiced = Number(rows[0].total_invoiced);
    const rate = total_invoiced > 0 ? ((total_collected / total_invoiced) * 100).toFixed(1) : '--';
    const rateNum = parseFloat(rate);
    const color = isNaN(rateNum) ? 'No data' : rateNum >= 80 ? 'Green (Good)' : rateNum >= 50 ? 'Yellow (Warning)' : 'Red (Critical)';

    const allowed: AllowedValue[] = [
      pct('collection rate', isNaN(rateNum) ? 0 : rateNum),
      pct('good threshold', 80),
      pct('warning threshold', 50),
      rm('total collected', total_collected),
      rm('total invoiced', total_invoiced),
    ];

    return {
      prompt: `Value: ${rate}%\nColor: ${color}\nTotal Collected: RM ${total_collected.toLocaleString('en-MY')}\nTotal Invoiced: RM ${total_invoiced.toLocaleString('en-MY')}`,
      allowed,
    };
  },

  async avg_monthly_collection(dr) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS months, COALESCE(SUM(collected), 0) AS total_collected
       FROM pc_ar_monthly
       WHERE month BETWEEN $1 AND $2`,
      [toMonth(dr!.start), toMonth(dr!.end)],
    );
    const months = Number(rows[0].months);
    const total_collected = Number(rows[0].total_collected);
    const avg = months > 0 ? (total_collected / months) : 0;

    const allowed: AllowedValue[] = [
      rm('avg monthly collection', Math.round(avg)),
      cnt('months in range', months),
      rm('total collected', total_collected),
    ];

    return {
      prompt: `Value: RM ${Math.round(avg).toLocaleString('en-MY')}\nMonths in range: ${months}\nTotal Collected: RM ${total_collected.toLocaleString('en-MY')}`,
      allowed,
    };
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
    const avgNum = valid.length > 0
      ? valid.reduce((s: number, r: { dso: number }) => s + Number(r.dso), 0) / valid.length
      : NaN;
    const avg = isNaN(avgNum) ? '--' : avgNum.toFixed(1);

    let table = '| Month | Collection Days |\n|-------|----------------|\n';
    for (const r of rows) {
      table += `| ${r.month} | ${r.dso != null ? r.dso + ' days' : 'N/A'} |\n`;
    }

    const allowed: AllowedValue[] = [];
    if (!isNaN(avgNum)) allowed.push(days('period avg collection days', avgNum));
    for (const r of rows) {
      if (r.dso != null) allowed.push(days(`${r.month} dso`, Number(r.dso)));
    }

    return { prompt: `Data points:\n${table}\nAverage: ${avg} days`, allowed };
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
    const worstTwoPctNum =
      worst && secondWorst && negSum < 0
        ? ((worst.gap + secondWorst.gap) / negSum) * 100
        : null;
    const worstTwoPct = worstTwoPctNum != null ? worstTwoPctNum.toFixed(1) : null;

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

    const allowed: AllowedValue[] = [];
    allowed.push(rm('total invoiced', totalInv));
    allowed.push(rm('total collected', totalCol));
    allowed.push(rm('cumulative gap', gap));
    allowed.push(rm('avg monthly collection', Math.round(avgCol)));
    allowed.push(rm('avg monthly collection (raw)', avgCol));
    allowed.push(cnt('months with negative gap', negMonths.length));
    allowed.push(cnt('months with positive gap', posMonths.length));
    allowed.push(cnt('total months', gapRows.length));
    if (worst) allowed.push(rm(`worst month gap (${worst.month})`, worst.gap));
    if (secondWorst) allowed.push(rm(`second-worst month gap (${secondWorst.month})`, secondWorst.gap));
    if (best) allowed.push(rm(`best month gap (${best.month})`, best.gap));
    if (worstTwoPctNum != null) allowed.push(pct('worst two months share of negative gap', worstTwoPctNum));
    allowed.push(rm('period total negative gap', negSum));
    if (h1Rows.length) {
      allowed.push(rm('H1 avg gap', h1Avg));
      allowed.push(cnt('H1 month count', h1Rows.length));
    }
    if (h2Rows.length) {
      allowed.push(rm('H2 avg gap', h2Avg));
      allowed.push(cnt('H2 month count', h2Rows.length));
    }
    if (h1Min) allowed.push(rm(`H1 min gap (${h1Min.month})`, h1Min.gap));
    if (h1Max) allowed.push(rm(`H1 max gap (${h1Max.month})`, h1Max.gap));
    if (h2Min) allowed.push(rm(`H2 min gap (${h2Min.month})`, h2Min.gap));
    if (h2Max) allowed.push(rm(`H2 max gap (${h2Max.month})`, h2Max.gap));
    for (const r of gapRows) {
      allowed.push(rm(`${r.month} invoiced`, r.invoiced));
      allowed.push(rm(`${r.month} collected`, r.collected));
      allowed.push(rm(`${r.month} gap`, r.gap));
    }

    return {
      prompt: `Period totals:\nTotal Invoiced: RM ${totalInv.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\nTotal Collected: RM ${totalCol.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\nCumulative Gap: ${gap >= 0 ? '+' : ''}RM ${gap.toLocaleString('en-MY', { minimumFractionDigits: 2 })}\nAvg Monthly Collection: RM ${Math.round(avgCol).toLocaleString('en-MY')}\n\n${preCalc}\nMonthly breakdown:\n${table}`,
      allowed,
    };
  },

  // Payment Section 2 (Snapshot — always uses latest snapshot_date)
  async total_outstanding() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return { prompt: 'No snapshot data available.', allowed: [] };
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

    const allowed: AllowedValue[] = [rm('total outstanding', total)];
    let top5Share = 0;
    let topTable = '| Rank | Customer | Outstanding | % of Total |\n|------|----------|-------------|------------|\n';
    top5.forEach((r: { company_name: string; total_outstanding: number }, i: number) => {
      const amt = Number(r.total_outstanding);
      const sharePct = total > 0 ? (amt / total) * 100 : 0;
      top5Share += sharePct;
      topTable += `| ${i + 1} | ${r.company_name} | RM ${amt.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% |\n`;
      allowed.push(rm(`${r.company_name} outstanding`, amt));
      allowed.push(pct(`${r.company_name} share of total`, sharePct));
    });
    allowed.push(pct('top 5 share of total', top5Share));

    return {
      prompt: `Value: RM ${total.toLocaleString('en-MY')}\n\nTop 5 contributors (${top5Share.toFixed(1)}% of total):\n${topTable}`,
      allowed,
    };
  },

  async overdue_amount() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return { prompt: 'No snapshot data available.', allowed: [] };
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
    const total = Number(rows[0].total);
    const overdue = Number(rows[0].overdue);
    const overdue_customers = Number(rows[0].overdue_customers);
    const total_customers = Number(rows[0].total_customers);
    const pctNum = total > 0 ? (overdue / total) * 100 : 0;
    const pctStr = total > 0 ? pctNum.toFixed(1) : '0';

    const { rows: top5 } = await pool.query(
      `SELECT company_name, overdue_amount, max_overdue_days
       FROM pc_ar_customer_snapshot
       WHERE snapshot_date = $1 AND overdue_amount > 0
         AND company_name NOT ILIKE 'CASH SALES%'
       ORDER BY overdue_amount DESC
       LIMIT 5`,
      [latest.d],
    );

    const allowed: AllowedValue[] = [
      rm('total outstanding', total),
      rm('total overdue', overdue),
      pct('overdue % of outstanding', pctNum),
      cnt('overdue customers', overdue_customers),
      cnt('total customers', total_customers),
    ];

    let topTable = '| Rank | Customer | Overdue Amount | Max Overdue Days | % of Overdue |\n|------|----------|----------------|-------------------|--------------|\n';
    top5.forEach((r: { company_name: string; overdue_amount: number; max_overdue_days: number | null }, i: number) => {
      const amt = Number(r.overdue_amount);
      const sharePct = overdue > 0 ? (amt / overdue) * 100 : 0;
      const days_ = r.max_overdue_days != null ? `${r.max_overdue_days} days` : 'N/A';
      topTable += `| ${i + 1} | ${r.company_name} | RM ${amt.toLocaleString('en-MY')} | ${days_} | ${sharePct.toFixed(1)}% |\n`;
      allowed.push(rm(`${r.company_name} overdue`, amt));
      allowed.push(pct(`${r.company_name} share of overdue`, sharePct));
      if (r.max_overdue_days != null) allowed.push(days(`${r.company_name} max overdue days`, Number(r.max_overdue_days)));
    });

    return {
      prompt: `Value: RM ${overdue.toLocaleString('en-MY')}\nPercentage of total: ${pctStr}%\nOverdue customers: ${overdue_customers}\nTotal customers: ${total_customers}\n\nTop 5 overdue customers:\n${topTable}`,
      allowed,
    };
  },

  async credit_limit_breaches() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return { prompt: 'No snapshot data available.', allowed: [] };
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

    const allowed: AllowedValue[] = [cnt('breach count', count)];

    if (count === 0) {
      return { prompt: `Value: ${count} customers\nColor: ${color}`, allowed };
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
      const utilNum = r.utilization_pct != null ? Number(r.utilization_pct) : null;
      const util = utilNum != null ? `${utilNum.toFixed(0)}%` : 'N/A';
      breachTable += `| ${i + 1} | ${r.company_name} | RM ${Number(r.credit_limit).toLocaleString('en-MY')} | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${util} |\n`;
      allowed.push(rm(`${r.company_name} credit limit`, Number(r.credit_limit)));
      allowed.push(rm(`${r.company_name} outstanding`, Number(r.total_outstanding)));
      if (utilNum != null) allowed.push(pct(`${r.company_name} utilization`, utilNum));
    });

    const showing = Math.min(count, 10);
    const heading = count > 10 ? `Top ${showing} breaching customers (of ${count}) by utilization:` : `Breaching customers (${count}) by utilization:`;
    allowed.push(cnt('breaches shown', showing));
    return {
      prompt: `Value: ${count} customers\nColor: ${color}\n\n${heading}\n${breachTable}`,
      allowed,
    };
  },

  async aging_analysis() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_aging_history`);
    if (!latest?.d) return { prompt: 'No aging data available.', allowed: [] };
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
    const total = rows.reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);

    const allowed: AllowedValue[] = [rm('total outstanding (aging)', total)];
    let table = '| Bucket | Amount | % of Total | Invoices |\n|--------|--------|-----------|----------|\n';
    for (const r of rows) {
      const amt = Number(r.amount);
      const sharePct = total > 0 ? (amt / total) * 100 : 0;
      table += `| ${r.bucket} | RM ${amt.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% | ${r.invoices} |\n`;
      allowed.push(rm(`${r.bucket} amount`, amt));
      allowed.push(pct(`${r.bucket} share`, sharePct));
      allowed.push(cnt(`${r.bucket} invoices`, Number(r.invoices)));
    }
    return {
      prompt: `Data:\n${table}\nTotal Outstanding: RM ${total.toLocaleString('en-MY')}`,
      allowed,
    };
  },

  async credit_usage_distribution() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return { prompt: 'No snapshot data available.', allowed: [] };
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
    const allowed: AllowedValue[] = [
      cnt('within limit customers', Number(r.within_limit)),
      cnt('near limit customers', Number(r.near_limit)),
      cnt('over limit customers', Number(r.over_limit)),
      cnt('no limit customers', Number(r.no_limit)),
      cnt('total customers', Number(r.total)),
    ];
    return {
      prompt: `Categories:\n- Within Limit (< 80%): ${r.within_limit} customers\n- Near Limit (80-99%): ${r.near_limit} customers\n- Over Limit (>= 100%): ${r.over_limit} customers\n- No Limit Set: ${r.no_limit} customers\nTotal: ${r.total} customers`,
      allowed,
    };
  },

  async customer_credit_health() {
    const pool = getPool();
    const { rows: [latest] } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`);
    if (!latest?.d) return { prompt: 'No snapshot data available.', allowed: [] };
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

    const allowed: AllowedValue[] = [
      cnt('total customers', totalCustomers),
      rm('total outstanding', totalOutstanding),
    ];

    let riskTable = '| Risk Tier | Count | % of Customers | Outstanding | % of Outstanding |\n|-----------|-------|----------------|-------------|------------------|\n';
    for (const r of summary) {
      const c = parseInt(r.count);
      const out = Number(r.total_outstanding);
      const custPct = totalCustomers > 0 ? (c / totalCustomers) * 100 : 0;
      const outPct = totalOutstanding > 0 ? (out / totalOutstanding) * 100 : 0;
      riskTable += `| ${r.risk_tier} | ${c} | ${custPct.toFixed(0)}% | RM ${out.toLocaleString('en-MY')} | ${outPct.toFixed(1)}% |\n`;
      allowed.push(cnt(`${r.risk_tier} risk count`, c));
      allowed.push(pct(`${r.risk_tier} risk customer share`, custPct));
      allowed.push(rm(`${r.risk_tier} risk outstanding`, out));
      allowed.push(pct(`${r.risk_tier} risk outstanding share`, outPct));
    }

    let outstandingTable = '| Customer | Outstanding | Score | Risk |\n|----------|-------------|-------|------|\n';
    for (const r of topByOutstanding) {
      outstandingTable += `| ${r.company_name} | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${r.credit_score} | ${r.risk_tier} |\n`;
      allowed.push(rm(`${r.company_name} outstanding`, Number(r.total_outstanding)));
      if (r.credit_score != null) allowed.push(cnt(`${r.company_name} credit score`, Number(r.credit_score)));
    }

    let overdueTable = '| Customer | Max Overdue Days | Outstanding | Risk |\n|----------|-------------------|-------------|------|\n';
    for (const r of topByOverdueDays) {
      overdueTable += `| ${r.company_name} | ${r.max_overdue_days} days | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${r.risk_tier} |\n`;
      allowed.push(days(`${r.company_name} max overdue days`, Number(r.max_overdue_days)));
      allowed.push(rm(`${r.company_name} outstanding`, Number(r.total_outstanding)));
    }

    let utilTable = '| Customer | Utilization | Credit Limit | Outstanding | Risk |\n|----------|-------------|--------------|-------------|------|\n';
    for (const r of topByUtilization) {
      const utilNum = r.utilization_pct != null ? Number(r.utilization_pct) : null;
      const util = utilNum != null ? `${utilNum.toFixed(0)}%` : 'N/A';
      utilTable += `| ${r.company_name} | ${util} | RM ${Number(r.credit_limit).toLocaleString('en-MY')} | RM ${Number(r.total_outstanding).toLocaleString('en-MY')} | ${r.risk_tier} |\n`;
      if (utilNum != null) allowed.push(pct(`${r.company_name} utilization`, utilNum));
      allowed.push(rm(`${r.company_name} credit limit`, Number(r.credit_limit)));
      allowed.push(rm(`${r.company_name} outstanding`, Number(r.total_outstanding)));
    }

    return {
      prompt: `Summary:\n- Total customers: ${totalCustomers}\n\nRisk distribution:\n${riskTable}\nTop 5 by outstanding amount:\n${outstandingTable}\nTop 5 by max overdue days (most delinquent):\n${overdueTable}\nTop 5 by utilization % (most over credit limit):\n${utilTable}`,
      allowed,
    };
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
    const inv = Number(r.invoice_sales);
    const cash = Number(r.cash_sales);
    const cn = Number(r.credit_notes);
    const net = Number(r.net_sales);
    const allowed: AllowedValue[] = [
      rm('net sales', net),
      rm('invoice sales', inv),
      rm('cash sales', cash),
      rm('credit notes', Math.abs(cn)),
    ];
    return {
      prompt: `Value: RM ${net.toLocaleString('en-MY')}\nInvoice Sales: RM ${inv.toLocaleString('en-MY')}\nCash Sales: RM ${cash.toLocaleString('en-MY')}\nCredit Notes: -RM ${Math.abs(cn).toLocaleString('en-MY')}`,
      allowed,
    };
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
    const inv = Number(r.invoice_sales);
    const net = Number(r.net_sales);
    const sharePct = net > 0 ? (inv / net) * 100 : 0;
    return {
      prompt: `Value: RM ${inv.toLocaleString('en-MY')}\nAs % of net sales: ${sharePct.toFixed(1)}%`,
      allowed: [rm('invoice sales', inv), rm('net sales', net), pct('invoice share of net', sharePct)],
    };
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
    const cash = Number(r.cash_sales);
    const net = Number(r.net_sales);
    const sharePct = net > 0 ? (cash / net) * 100 : 0;
    return {
      prompt: `Value: RM ${cash.toLocaleString('en-MY')}\nAs % of net sales: ${sharePct.toFixed(1)}%`,
      allowed: [rm('cash sales', cash), rm('net sales', net), pct('cash share of net', sharePct)],
    };
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
    const cnAbs = Math.abs(Number(r.credit_notes));
    const gross = Number(r.gross_sales);
    const sharePct = gross > 0 ? (cnAbs / gross) * 100 : 0;
    const color = sharePct <= 1 ? 'Green (Good)' : sharePct <= 3 ? 'Yellow (Monitor)' : 'Red (Concern)';

    return {
      prompt: `Value: -RM ${cnAbs.toLocaleString('en-MY')}\nAs % of gross sales: ${sharePct.toFixed(2)}%\nColor: ${color}`,
      allowed: [rm('credit notes', cnAbs), rm('gross sales', gross), pct('cn share of gross', sharePct)],
    };
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
    const allowed: AllowedValue[] = [];
    let table = '| Month | Invoice Sales | Cash Sales | Credit Notes | Net Sales |\n|-------|-------------|-----------|-------------|----------|\n';
    for (const r of rows) {
      const inv = Number(r.invoice_sales);
      const cash = Number(r.cash_sales);
      const cn = Number(r.credit_notes);
      const net = Number(r.net_sales);
      table += `| ${r.month} | RM ${inv.toLocaleString('en-MY')} | RM ${cash.toLocaleString('en-MY')} | -RM ${Math.abs(cn).toLocaleString('en-MY')} | RM ${net.toLocaleString('en-MY')} |\n`;
      allowed.push(rm(`${r.month} invoice sales`, inv));
      allowed.push(rm(`${r.month} cash sales`, cash));
      allowed.push(rm(`${r.month} credit notes`, Math.abs(cn)));
      allowed.push(rm(`${r.month} net sales`, net));
    }
    return { prompt: `Data points:\n${table}`, allowed };
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

    const allowed: AllowedValue[] = [
      rm('total net sales', totalNet),
      cnt('customer count', customerCount),
    ];
    let table = '| Rank | Customer | Type | Net Sales | % of Total |\n|------|----------|------|-----------|------------|\n';
    let top5Share = 0;
    let top10Share = 0;
    rows.forEach((r: Record<string, unknown>, i: number) => {
      const ns = Number(r.net_sales);
      const sharePct = totalNet > 0 ? (ns / totalNet) * 100 : 0;
      if (i < 5) top5Share += sharePct;
      if (i < 10) top10Share += sharePct;
      table += `| ${i + 1} | ${r.company_name} | ${r.debtor_type || '(Unknown)'} | RM ${ns.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% |\n`;
      allowed.push(rm(`${r.company_name} net sales`, ns));
      allowed.push(pct(`${r.company_name} share of total`, sharePct));
    });
    allowed.push(pct('top 5 customer share', top5Share));
    allowed.push(pct('top 10 customer share', top10Share));

    let typeTable = '| Type | Customers | Net Sales | % of Total |\n|------|-----------|-----------|------------|\n';
    for (const t of typeMix) {
      const ns = Number(t.net_sales);
      const sharePct = totalNet > 0 ? (ns / totalNet) * 100 : 0;
      typeTable += `| ${t.debtor_type} | ${t.cust_count} | RM ${ns.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% |\n`;
      allowed.push(rm(`${t.debtor_type} type net sales`, ns));
      allowed.push(pct(`${t.debtor_type} type share`, sharePct));
      allowed.push(cnt(`${t.debtor_type} type customer count`, Number(t.cust_count)));
    }

    return {
      prompt: `Dimension: Customer\nTotal net sales: RM ${totalNet.toLocaleString('en-MY')}\nActive customers in period: ${customerCount}\n\nConcentration risk (pre-calculated):\n- Top 5 customers: ${top5Share.toFixed(1)}% of total revenue\n- Top 10 customers: ${top10Share.toFixed(1)}% of total revenue\n\nTop 15 by net sales:\n${table}\nCustomer type mix:\n${typeTable}`,
      allowed,
    };
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
    const totalNet = Number(totals[0]?.total_net ?? 0);

    const allowed: AllowedValue[] = [rm('total net sales', totalNet)];
    let table = '| Rank | Product | Country | Net Sales | % | Qty |\n|------|---------|---------|-----------|---|-----|\n';
    rows.forEach((r: Record<string, unknown>, i: number) => {
      const ns = Number(r.net_sales);
      const qty = Number(r.qty);
      const sharePct = totalNet > 0 ? (ns / totalNet) * 100 : 0;
      table += `| ${i + 1} | ${r.fruit_name} | ${r.fruit_country || '-'} | RM ${ns.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% | ${qty.toLocaleString('en-MY')} |\n`;
      allowed.push(rm(`${r.fruit_name} net sales`, ns));
      allowed.push(pct(`${r.fruit_name} share`, sharePct));
      allowed.push(cnt(`${r.fruit_name} qty`, qty));
    });

    return {
      prompt: `Dimension: Product\nTotal net sales: RM ${totalNet.toLocaleString('en-MY')}\n\nTop 15 by net sales:\n${table}`,
      allowed,
    };
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

    const allowed: AllowedValue[] = [rm('total net sales', total)];
    let table = '| Agent | Active | Net Sales | % of Total | Invoice | Cash | Customers |\n|-------|--------|-----------|-----------|---------|------|-----------|\n';
    for (const r of rows) {
      const ns = Number(r.net_sales);
      const inv = Number(r.invoice_sales);
      const cash = Number(r.cash_sales);
      const custCount = Number(r.customer_count);
      const sharePct = total > 0 ? (ns / total) * 100 : 0;
      table += `| ${r.agent_name} | ${r.is_active} | RM ${ns.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% | RM ${inv.toLocaleString('en-MY')} | RM ${cash.toLocaleString('en-MY')} | ${custCount} |\n`;
      allowed.push(rm(`${r.agent_name} net sales`, ns));
      allowed.push(pct(`${r.agent_name} share`, sharePct));
      allowed.push(rm(`${r.agent_name} invoice sales`, inv));
      allowed.push(rm(`${r.agent_name} cash sales`, cash));
      allowed.push(cnt(`${r.agent_name} customer count`, custCount));
    }
    return {
      prompt: `Dimension: Sales Agent\nTotal net sales: RM ${total.toLocaleString('en-MY')}\n\n${table}`,
      allowed,
    };
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
    const total = rows.reduce((s: number, r: { net_sales: number }) => s + Number(r.net_sales), 0);

    const allowed: AllowedValue[] = [rm('total net sales', total)];
    let table = '| Outlet | Net Sales | % | Invoice | Cash | Credit Notes |\n|--------|-----------|---|---------|------|--------------|\n';
    for (const r of rows) {
      const ns = Number(r.net_sales);
      const inv = Number(r.invoice_sales);
      const cash = Number(r.cash_sales);
      const cn = Number(r.credit_notes);
      const sharePct = total > 0 ? (ns / total) * 100 : 0;
      table += `| ${r.outlet} | RM ${ns.toLocaleString('en-MY')} | ${sharePct.toFixed(1)}% | RM ${inv.toLocaleString('en-MY')} | RM ${cash.toLocaleString('en-MY')} | -RM ${Math.abs(cn).toLocaleString('en-MY')} |\n`;
      allowed.push(rm(`${r.outlet} net sales`, ns));
      allowed.push(pct(`${r.outlet} share`, sharePct));
      allowed.push(rm(`${r.outlet} invoice sales`, inv));
      allowed.push(rm(`${r.outlet} cash sales`, cash));
      allowed.push(rm(`${r.outlet} credit notes`, Math.abs(cn)));
    }
    return {
      prompt: `Dimension: Outlet\nTotal net sales: RM ${total.toLocaleString('en-MY')}\n\n${table}`,
      allowed,
    };
  },

  // ─── Customer Margin Section: Overview ────────────────────────────────────
  // All fetchers in this section reuse customer-margin/queries.ts so the
  // dashboard and the AI see identical numbers (three-way match guaranteed).

  async cm_net_sales(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const kpi = await getMarginKpi(filters);
    const net = Number(kpi.total_revenue);
    const cogs = Number(kpi.total_cogs);
    const gp = Number(kpi.gross_profit);

    return {
      prompt:
        `Value: RM ${net.toLocaleString('en-MY')}\n` +
        `Period COGS: RM ${cogs.toLocaleString('en-MY')}\n` +
        `Period Gross Profit: RM ${gp.toLocaleString('en-MY')}`,
      allowed: [
        rm('net sales', net),
        rm('cogs', cogs),
        rm('gross profit', gp),
      ],
    };
  },

  async cm_cogs(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const kpi = await getMarginKpi(filters);
    const net = Number(kpi.total_revenue);
    const cogs = Number(kpi.total_cogs);
    const cogsRatio = net > 0 ? (cogs / net) * 100 : 0;

    return {
      prompt:
        `Value: RM ${cogs.toLocaleString('en-MY')}\n` +
        `Period Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `COGS as % of Net Sales: ${cogsRatio.toFixed(1)}%`,
      allowed: [
        rm('cogs', cogs),
        rm('net sales', net),
        pct('cogs share of net sales', cogsRatio),
      ],
    };
  },

  async cm_gross_profit(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const kpi = await getMarginKpi(filters);
    const net = Number(kpi.total_revenue);
    const cogs = Number(kpi.total_cogs);
    const gp = Number(kpi.gross_profit);
    const marginPct = Number(kpi.margin_pct);

    return {
      prompt:
        `Value: RM ${gp.toLocaleString('en-MY')}\n` +
        `Period Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `Period COGS: RM ${cogs.toLocaleString('en-MY')}\n` +
        `Implied Margin %: ${marginPct.toFixed(2)}%`,
      allowed: [
        rm('gross profit', gp),
        rm('net sales', net),
        rm('cogs', cogs),
        pct('margin pct', marginPct),
      ],
    };
  },

  async cm_margin_pct(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const kpi = await getMarginKpi(filters);
    const marginPct = Number(kpi.margin_pct);
    const net = Number(kpi.total_revenue);
    const cogs = Number(kpi.total_cogs);
    const gp = Number(kpi.gross_profit);
    const color =
      marginPct >= 15 ? 'Green (Good)' :
      marginPct >= 10 ? 'Yellow (Neutral)' :
      'Red (Bad)';

    return {
      prompt:
        `Value: ${marginPct.toFixed(2)}%\n` +
        `Color: ${color}\n` +
        `Good threshold: >= 15%\n` +
        `Neutral threshold: 10% to 15%\n` +
        `Bad threshold: < 10%\n` +
        `Period Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `Period COGS: RM ${cogs.toLocaleString('en-MY')}\n` +
        `Period Gross Profit: RM ${gp.toLocaleString('en-MY')}`,
      allowed: [
        pct('margin pct', marginPct),
        pct('good threshold', 15),
        pct('neutral threshold', 10),
        rm('net sales', net),
        rm('cogs', cogs),
        rm('gross profit', gp),
      ],
    };
  },

  async cm_active_customers(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const kpi = await getMarginKpi(filters);
    const activeCustomers = Number(kpi.active_customers);
    const net = Number(kpi.total_revenue);
    const avgPerCustomer = activeCustomers > 0 ? net / activeCustomers : 0;

    return {
      prompt:
        `Value: ${activeCustomers.toLocaleString('en-MY')}\n` +
        `Period Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `Avg Net Sales per active customer: RM ${Math.round(avgPerCustomer).toLocaleString('en-MY')}`,
      allowed: [
        cnt('active customers', activeCustomers),
        rm('net sales', net),
        rm('avg net sales per customer', Math.round(avgPerCustomer)),
      ],
    };
  },

  async cm_margin_trend(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const trend = await getMarginTrend(filters);
    if (trend.length === 0) {
      return { prompt: 'No margin trend data available for selected period.', allowed: [] };
    }

    const allowed: AllowedValue[] = [];
    let table =
      '| Month | Net Sales | COGS | Gross Profit | Margin % |\n' +
      '|-------|-----------|------|--------------|----------|\n';
    let gpSum = 0;
    let revSum = 0;
    let cogsSum = 0;
    const marginPcts: number[] = [];
    for (const r of trend) {
      const rev = Number(r.revenue);
      const cogs = Number(r.cogs);
      const gp = Number(r.gross_profit);
      const mp = Number(r.margin_pct);
      revSum += rev;
      cogsSum += cogs;
      gpSum += gp;
      marginPcts.push(mp);
      table +=
        `| ${r.period} ` +
        `| RM ${rev.toLocaleString('en-MY')} ` +
        `| RM ${cogs.toLocaleString('en-MY')} ` +
        `| RM ${gp.toLocaleString('en-MY')} ` +
        `| ${mp.toFixed(2)}% |\n`;
      allowed.push(rm(`${r.period} net sales`, rev));
      allowed.push(rm(`${r.period} cogs`, cogs));
      allowed.push(rm(`${r.period} gross profit`, gp));
      allowed.push(pct(`${r.period} margin pct`, mp));
    }

    const avgMargin = marginPcts.length > 0
      ? marginPcts.reduce((s, v) => s + v, 0) / marginPcts.length
      : 0;
    const periodMarginPct = revSum > 0 ? ((revSum - cogsSum) / revSum) * 100 : 0;
    const minMargin = marginPcts.length ? Math.min(...marginPcts) : 0;
    const maxMargin = marginPcts.length ? Math.max(...marginPcts) : 0;
    const minRow = trend.find(r => Number(r.margin_pct) === minMargin);
    const maxRow = trend.find(r => Number(r.margin_pct) === maxMargin);

    const preCalc =
      `Pre-calculated totals (use these values directly — do not recompute):\n` +
      `- Period Net Sales: RM ${revSum.toLocaleString('en-MY')}\n` +
      `- Period COGS: RM ${cogsSum.toLocaleString('en-MY')}\n` +
      `- Period Gross Profit: RM ${gpSum.toLocaleString('en-MY')}\n` +
      `- Period Margin %: ${periodMarginPct.toFixed(2)}%\n` +
      `- Average Monthly Margin %: ${avgMargin.toFixed(2)}%\n` +
      (minRow ? `- Lowest margin month: ${minRow.period} at ${minMargin.toFixed(2)}%\n` : '') +
      (maxRow ? `- Highest margin month: ${maxRow.period} at ${maxMargin.toFixed(2)}%\n` : '') +
      `- Months in period: ${trend.length}\n`;

    allowed.push(rm('period net sales', revSum));
    allowed.push(rm('period cogs', cogsSum));
    allowed.push(rm('period gross profit', gpSum));
    allowed.push(pct('period margin pct', periodMarginPct));
    allowed.push(pct('avg monthly margin pct', avgMargin));
    allowed.push(pct('lowest monthly margin pct', minMargin));
    allowed.push(pct('highest monthly margin pct', maxMargin));
    allowed.push(cnt('months in period', trend.length));

    return {
      prompt: `${preCalc}\nMonthly breakdown:\n${table}`,
      allowed,
    };
  },

  async cm_margin_distribution(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const buckets = await getMarginDistribution(filters);
    if (buckets.length === 0) {
      return { prompt: 'No margin distribution data available for selected period.', allowed: [] };
    }

    const allowed: AllowedValue[] = [];
    const total = buckets.reduce((s, b) => s + Number(b.count), 0);

    let table =
      '| Margin % Bucket | Customer Count | % of Total |\n' +
      '|-----------------|----------------|------------|\n';
    for (const b of buckets) {
      const count = Number(b.count);
      const pctOfTotal = total > 0 ? (count / total) * 100 : 0;
      table += `| ${b.bucket} | ${count} | ${pctOfTotal.toFixed(1)}% |\n`;
      allowed.push(cnt(`bucket ${b.bucket} count`, count));
      allowed.push(pct(`bucket ${b.bucket} share`, pctOfTotal));
    }

    const lossBucket = buckets.find(b => b.bucket === '< 0%');
    const lossCount = lossBucket ? Number(lossBucket.count) : 0;
    const subTenCount = buckets
      .filter(b => b.bucket === '< 0%' || b.bucket === '0-5%' || b.bucket === '5-10%')
      .reduce((s, b) => s + Number(b.count), 0);
    const healthyCount = buckets
      .filter(b => b.bucket === '10-15%' || b.bucket === '15-20%')
      .reduce((s, b) => s + Number(b.count), 0);
    const premiumCount = buckets
      .filter(b => b.bucket === '20-30%' || b.bucket === '30%+')
      .reduce((s, b) => s + Number(b.count), 0);

    const lossShare = total > 0 ? (lossCount / total) * 100 : 0;
    const subTenShare = total > 0 ? (subTenCount / total) * 100 : 0;
    const healthyShare = total > 0 ? (healthyCount / total) * 100 : 0;
    const premiumShare = total > 0 ? (premiumCount / total) * 100 : 0;

    const preCalc =
      `Population: customers with > RM 1,000 of total revenue in the period (small-volume customers excluded upstream).\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total customers in distribution: ${total}\n` +
      `- Loss-making (< 0%): ${lossCount} customers (${lossShare.toFixed(1)}% of total)\n` +
      `- Sub-10% margin (< 0% + 0-5% + 5-10%): ${subTenCount} customers (${subTenShare.toFixed(1)}%)\n` +
      `- Healthy band (10-15% + 15-20%): ${healthyCount} customers (${healthyShare.toFixed(1)}%)\n` +
      `- Premium band (20-30% + 30%+): ${premiumCount} customers (${premiumShare.toFixed(1)}%)\n`;

    allowed.push(cnt('total customers in distribution', total));
    allowed.push(cnt('loss making customers', lossCount));
    allowed.push(cnt('sub ten customers', subTenCount));
    allowed.push(cnt('healthy band customers', healthyCount));
    allowed.push(cnt('premium band customers', premiumCount));
    allowed.push(pct('loss making share', lossShare));
    allowed.push(pct('sub ten share', subTenShare));
    allowed.push(pct('healthy band share', healthyShare));
    allowed.push(pct('premium band share', premiumShare));

    return {
      prompt: `${preCalc}\nBucket breakdown:\n${table}`,
      allowed,
    };
  },

  // ─── Customer Margin Section 2: Customer Margin Breakdown ──────────────────

  async cm_top_customers(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const [kpi, topByProfit, topByMarginPool] = await Promise.all([
      getMarginKpi(filters),
      getCustomerMargins(filters, 'gross_profit', 'desc', 1, 10),
      getCustomerMargins(filters, 'margin_pct', 'desc', 1, 50),
    ]);

    const periodGp = Number(kpi.gross_profit);
    const periodRev = Number(kpi.total_revenue);

    const profitRows = topByProfit.rows;
    const marginRows = topByMarginPool.rows
      .filter(r => Number(r.revenue) >= 10000)
      .slice(0, 10);

    const allowed: AllowedValue[] = [
      rm('period gross profit', periodGp),
      rm('period net sales', periodRev),
      rm('revenue floor', 10000),
    ];

    let profitTable =
      '| # | Code | Customer | Type | Agent | Revenue | GP | Margin % | Share of GP % |\n' +
      '|---|------|----------|------|-------|---------|----|---------:|--------------:|\n';
    let top1GpShare = 0;
    let top3GpShare = 0;
    let top10GpShare = 0;
    profitRows.forEach((r, i) => {
      const rev = Number(r.revenue);
      const gp = Number(r.gross_profit);
      const mp = Number(r.margin_pct);
      const share = periodGp > 0 ? (gp / periodGp) * 100 : 0;
      if (i === 0) top1GpShare = share;
      if (i < 3) top3GpShare += share;
      top10GpShare += share;
      profitTable +=
        `| ${i + 1} | ${r.debtor_code} | ${r.company_name ?? r.debtor_code} | ${r.debtor_type ?? 'Unassigned'} | ${r.sales_agent ?? '-'} ` +
        `| RM ${rev.toLocaleString('en-MY')} | RM ${gp.toLocaleString('en-MY')} | ${mp.toFixed(2)}% | ${share.toFixed(2)}% |\n`;
      allowed.push(rm(`${r.debtor_code} revenue`, rev));
      allowed.push(rm(`${r.debtor_code} gross profit`, gp));
      allowed.push(pct(`${r.debtor_code} margin pct`, mp));
      allowed.push(pct(`${r.debtor_code} share of gp`, share));
    });

    let marginTable =
      '| # | Code | Customer | Type | Agent | Revenue | GP | Margin % |\n' +
      '|---|------|----------|------|-------|---------|----|---------:|\n';
    marginRows.forEach((r, i) => {
      const rev = Number(r.revenue);
      const gp = Number(r.gross_profit);
      const mp = Number(r.margin_pct);
      marginTable +=
        `| ${i + 1} | ${r.debtor_code} | ${r.company_name ?? r.debtor_code} | ${r.debtor_type ?? 'Unassigned'} | ${r.sales_agent ?? '-'} ` +
        `| RM ${rev.toLocaleString('en-MY')} | RM ${gp.toLocaleString('en-MY')} | ${mp.toFixed(2)}% |\n`;
      allowed.push(rm(`${r.debtor_code} revenue`, rev));
      allowed.push(rm(`${r.debtor_code} gross profit`, gp));
      allowed.push(pct(`${r.debtor_code} margin pct`, mp));
    });

    const profitCodes = new Set(profitRows.map(r => r.debtor_code));
    const stars = marginRows.filter(r => profitCodes.has(r.debtor_code));

    allowed.push(pct('top 1 share of gp', top1GpShare));
    allowed.push(pct('top 3 share of gp', top3GpShare));
    allowed.push(pct('top 10 share of gp', top10GpShare));
    allowed.push(cnt('star customers on both lists', stars.length));

    const preCalc =
      `Population: active customers with revenue during ${dr!.start} to ${dr!.end}.\n\n` +
      `Pre-calculated totals (use these values directly — do not recompute):\n` +
      `- Period Net Sales: RM ${periodRev.toLocaleString('en-MY')}\n` +
      `- Period Gross Profit: RM ${periodGp.toLocaleString('en-MY')}\n` +
      `- Top 1 customer share of GP: ${top1GpShare.toFixed(2)}%\n` +
      `- Top 3 customers share of GP: ${top3GpShare.toFixed(2)}%\n` +
      `- Top 10 customers share of GP: ${top10GpShare.toFixed(2)}%\n` +
      `- Margin-% list revenue floor: RM 10,000\n` +
      `- Customers on BOTH top-10 lists (star accounts): ${stars.length}` +
      (stars.length > 0 ? ` (${stars.map(s => s.company_name ?? s.debtor_code).join(', ')})` : '') +
      `\n`;

    return {
      prompt:
        `${preCalc}\n(A) Top 10 customers by Gross Profit:\n${profitTable}\n` +
        `(B) Top 10 customers by Gross Margin % (revenue >= RM 10,000):\n${marginTable}`,
      allowed,
    };
  },

  async cm_customer_table(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const [kpi, top10, bottom10, distribution] = await Promise.all([
      getMarginKpi(filters),
      getCustomerMargins(filters, 'gross_profit', 'desc', 1, 10),
      getCustomerMargins(filters, 'gross_profit', 'asc', 1, 10),
      getMarginDistribution(filters),
    ]);

    const periodGp = Number(kpi.gross_profit);
    const activeCustomers = Number(kpi.active_customers);
    const totalInTable = Number(top10.total);

    const lossBucket = distribution.find(b => b.bucket === '< 0%');
    const lossCount = lossBucket ? Number(lossBucket.count) : 0;
    const lossShare = activeCustomers > 0 ? (lossCount / activeCustomers) * 100 : 0;

    const top10GpSum = top10.rows.reduce((s, r) => s + Number(r.gross_profit), 0);
    const top10Share = periodGp > 0 ? (top10GpSum / periodGp) * 100 : 0;

    const marginPcts = [...top10.rows, ...bottom10.rows].map(r => Number(r.margin_pct));
    const avgMarginSample = marginPcts.length > 0
      ? marginPcts.reduce((s, v) => s + v, 0) / marginPcts.length
      : 0;
    const marginSpread = marginPcts.length > 0
      ? Math.max(...marginPcts) - Math.min(...marginPcts)
      : 0;

    const allowed: AllowedValue[] = [
      rm('period gross profit', periodGp),
      rm('top 10 gp sum', top10GpSum),
      pct('top 10 share of gp', top10Share),
      cnt('active customers', activeCustomers),
      cnt('loss making customers', lossCount),
      pct('loss maker share of active', lossShare),
      cnt('customers in table (unpaginated)', totalInTable),
      pct('avg margin (top+bottom sample)', avgMarginSample),
      pct('margin spread (top-bottom sample)', marginSpread),
    ];

    const renderRow = (r: typeof top10.rows[0], i: number) => {
      const rev = Number(r.revenue);
      const cogs = Number(r.cogs);
      const gp = Number(r.gross_profit);
      const mp = Number(r.margin_pct);
      const rr = Number(r.return_rate_pct);
      allowed.push(rm(`${r.debtor_code} revenue`, rev));
      allowed.push(rm(`${r.debtor_code} cogs`, cogs));
      allowed.push(rm(`${r.debtor_code} gross profit`, gp));
      allowed.push(pct(`${r.debtor_code} margin pct`, mp));
      allowed.push(pct(`${r.debtor_code} return rate`, rr));
      return (
        `| ${i + 1} | ${r.debtor_code} | ${r.company_name ?? r.debtor_code} | ${r.debtor_type ?? 'Unassigned'} | ${r.sales_agent ?? '-'} ` +
        `| RM ${rev.toLocaleString('en-MY')} | RM ${cogs.toLocaleString('en-MY')} | RM ${gp.toLocaleString('en-MY')} | ${mp.toFixed(2)}% | ${rr.toFixed(2)}% |\n`
      );
    };

    const header =
      '| # | Code | Customer | Type | Agent | Revenue | COGS | GP | Margin % | Return % |\n' +
      '|---|------|----------|------|-------|---------|------|----|---------:|---------:|\n';

    let topTable = header;
    top10.rows.forEach((r, i) => { topTable += renderRow(r, i); });

    let bottomTable = header;
    bottom10.rows.forEach((r, i) => { bottomTable += renderRow(r, i); });

    const preCalc =
      `Population: active customers with revenue during ${dr!.start} to ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total active customers in table: ${activeCustomers}\n` +
      `- Period Gross Profit: RM ${periodGp.toLocaleString('en-MY')}\n` +
      `- Top 10 Gross Profit sum: RM ${top10GpSum.toLocaleString('en-MY')}\n` +
      `- Top 10 share of total Gross Profit: ${top10Share.toFixed(2)}%\n` +
      `- Loss-making customers (GP < 0): ${lossCount} (${lossShare.toFixed(2)}% of active)\n` +
      `- Avg margin % across the top-10 + bottom-10 sample: ${avgMarginSample.toFixed(2)}%\n` +
      `- Margin spread (best minus worst in the 20-row sample): ${marginSpread.toFixed(2)} percentage points\n`;

    return {
      prompt:
        `${preCalc}\n(A) Top 10 customers by Gross Profit (best performers):\n${topTable}\n` +
        `(B) Bottom 10 customers by Gross Profit (worst performers):\n${bottomTable}`,
      allowed,
    };
  },

  async cm_credit_note_impact(dr) {
    const filters: MarginFilters = { start: dr!.start, end: dr!.end };
    const rows = await getCreditNoteImpact(filters);

    if (rows.length === 0) {
      return { prompt: 'No credit note impact data available for selected period.', allowed: [] };
    }

    // getCreditNoteImpact returns up to 100 rows ordered by return_rate_pct DESC.
    // For this fetcher we want ranking by margin_lost.
    const sortedByLost = [...rows].sort(
      (a, b) => Number(b.margin_lost) - Number(a.margin_lost),
    );
    const top25 = sortedByLost.slice(0, 25);

    const totalMarginLost = sortedByLost.reduce((s, r) => s + Number(r.margin_lost), 0);
    const top5Lost = sortedByLost.slice(0, 5).reduce((s, r) => s + Number(r.margin_lost), 0);
    const top5Share = totalMarginLost > 0 ? (top5Lost / totalMarginLost) * 100 : 0;
    const highReturnCount = sortedByLost.filter(r => Number(r.return_rate_pct) > 5).length;
    const avgMarginLost = sortedByLost.length > 0 ? totalMarginLost / sortedByLost.length : 0;
    const universeSize = sortedByLost.length;

    const totalCnRevenue = sortedByLost.reduce((s, r) => s + Number(r.cn_revenue), 0);
    const totalIvRevenue = sortedByLost.reduce((s, r) => s + Number(r.iv_revenue), 0);

    const allowed: AllowedValue[] = [
      pct('total margin lost (sum pp)', totalMarginLost),
      pct('top 5 margin lost (sum pp)', top5Lost),
      pct('top 5 share of margin lost', top5Share),
      cnt('customers with return rate above 5', highReturnCount),
      pct('avg margin lost', avgMarginLost),
      cnt('customers in impact universe', universeSize),
      rm('total cn revenue', totalCnRevenue),
      rm('total iv revenue', totalIvRevenue),
    ];

    let table =
      '| # | Code | Customer | IV Revenue | CN Revenue | Return % | Margin Before | Margin After | Margin Lost (pp) |\n' +
      '|---|------|----------|------------|------------|---------:|--------------:|-------------:|-----------------:|\n';
    top25.forEach((r, i) => {
      const iv = Number(r.iv_revenue);
      const cn = Number(r.cn_revenue);
      const rr = Number(r.return_rate_pct);
      const mb = Number(r.margin_before);
      const ma = Number(r.margin_after);
      const ml = Number(r.margin_lost);
      table +=
        `| ${i + 1} | ${r.debtor_code} | ${r.company_name ?? r.debtor_code} ` +
        `| RM ${iv.toLocaleString('en-MY')} | RM ${cn.toLocaleString('en-MY')} | ${rr.toFixed(2)}% ` +
        `| ${mb.toFixed(2)}% | ${ma.toFixed(2)}% | ${ml.toFixed(2)} |\n`;
      allowed.push(rm(`${r.debtor_code} iv revenue`, iv));
      allowed.push(rm(`${r.debtor_code} cn revenue`, cn));
      allowed.push(pct(`${r.debtor_code} return rate`, rr));
      allowed.push(pct(`${r.debtor_code} margin before`, mb));
      allowed.push(pct(`${r.debtor_code} margin after`, ma));
      allowed.push(pct(`${r.debtor_code} margin lost`, ml));
    });

    const preCalc =
      `Population: customers with credit notes during ${dr!.start} to ${dr!.end} (up to 100 rows ranked by impact).\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Customers in impact universe: ${universeSize}\n` +
      `- Total margin lost (sum of percentage-point drops): ${totalMarginLost.toFixed(2)} pp\n` +
      `- Top 5 customers share of total margin lost: ${top5Share.toFixed(2)}%\n` +
      `- Customers with return rate > 5%: ${highReturnCount}\n` +
      `- Avg margin lost per customer in universe: ${avgMarginLost.toFixed(2)} pp\n` +
      `- Total invoice revenue across universe: RM ${totalIvRevenue.toLocaleString('en-MY')}\n` +
      `- Total credit note revenue across universe: RM ${totalCnRevenue.toLocaleString('en-MY')}\n`;

    return {
      prompt: `${preCalc}\nTop 25 customers by Margin Lost:\n${table}`,
      allowed,
    };
  },

  // ─── Supplier Margin Section 3: Supplier Margin Overview ──────────────────
  // All fetchers in this section reuse supplier-margin/queries.ts so the
  // dashboard and the AI see identical numbers (three-way match guaranteed).

  async sp_net_sales(dr) {
    const summary = await getSupplierMarginSummary(dr!.start, dr!.end);
    const net = Number(summary.current.revenue);
    const prevNet = Number(summary.previous.revenue);
    const growthPct = summary.growth.revenue_pct;
    const deltaRm = net - prevNet;

    return {
      prompt:
        `Population: active suppliers with purchase activity in ${dr!.start} to ${dr!.end}.\n\n` +
        `Value: RM ${net.toLocaleString('en-MY')}\n` +
        `Prior period Est. Net Sales: RM ${prevNet.toLocaleString('en-MY')}\n` +
        `MoM delta: RM ${deltaRm.toLocaleString('en-MY')}\n` +
        `MoM delta %: ${growthPct != null ? `${growthPct.toFixed(2)}%` : 'n/a'}`,
      allowed: [
        rm('est net sales', net),
        rm('prior est net sales', prevNet),
        rm('est net sales delta rm', deltaRm),
        ...(growthPct != null ? [pct('est net sales delta pct', growthPct)] : []),
      ],
    };
  },

  async sp_cogs(dr) {
    const summary = await getSupplierMarginSummary(dr!.start, dr!.end);
    const net = Number(summary.current.revenue);
    const cogs = Number(summary.current.cogs);
    const prevCogs = Number(summary.previous.cogs);
    const cogsRatio = net > 0 ? (cogs / net) * 100 : 0;
    const deltaRm = cogs - prevCogs;

    return {
      prompt:
        `Population: active suppliers with purchase activity in ${dr!.start} to ${dr!.end}.\n\n` +
        `Value: RM ${cogs.toLocaleString('en-MY')}\n` +
        `Period Est. Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `COGS as % of Est. Net Sales: ${cogsRatio.toFixed(1)}%\n` +
        `Prior period Est. COGS: RM ${prevCogs.toLocaleString('en-MY')}\n` +
        `COGS delta: RM ${deltaRm.toLocaleString('en-MY')}`,
      allowed: [
        rm('est cogs', cogs),
        rm('est net sales', net),
        pct('cogs share of net sales', cogsRatio),
        rm('prior est cogs', prevCogs),
        rm('est cogs delta rm', deltaRm),
      ],
    };
  },

  async sp_gross_profit(dr) {
    const summary = await getSupplierMarginSummary(dr!.start, dr!.end);
    const net = Number(summary.current.revenue);
    const cogs = Number(summary.current.cogs);
    const gp = Number(summary.current.profit);
    const prevGp = Number(summary.previous.profit);
    const deltaRm = gp - prevGp;
    const growthPct = summary.growth.profit_pct;

    return {
      prompt:
        `Population: active suppliers with purchase activity in ${dr!.start} to ${dr!.end}.\n\n` +
        `Value: RM ${gp.toLocaleString('en-MY')}\n` +
        `Period Est. Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `Period Est. COGS: RM ${cogs.toLocaleString('en-MY')}\n` +
        `Prior period Est. Gross Profit: RM ${prevGp.toLocaleString('en-MY')}\n` +
        `GP delta: RM ${deltaRm.toLocaleString('en-MY')}\n` +
        `GP delta %: ${growthPct != null ? `${growthPct.toFixed(2)}%` : 'n/a'}`,
      allowed: [
        rm('est gross profit', gp),
        rm('est net sales', net),
        rm('est cogs', cogs),
        rm('prior est gross profit', prevGp),
        rm('est gross profit delta rm', deltaRm),
        ...(growthPct != null ? [pct('est gross profit delta pct', growthPct)] : []),
      ],
    };
  },

  async sp_margin_pct(dr) {
    const summary = await getSupplierMarginSummary(dr!.start, dr!.end);
    const net = Number(summary.current.revenue);
    const cogs = Number(summary.current.cogs);
    const marginPct = summary.current.margin_pct != null ? Number(summary.current.margin_pct) : 0;
    const prevMarginPct = summary.previous.margin_pct != null ? Number(summary.previous.margin_pct) : 0;
    const marginDelta = summary.growth.margin_delta != null ? Number(summary.growth.margin_delta) : (marginPct - prevMarginPct);
    const color =
      marginPct >= 15 ? 'Green (Good)' :
      marginPct >= 10 ? 'Yellow (Neutral)' :
      'Red (Bad)';

    return {
      prompt:
        `Population: active suppliers with purchase activity in ${dr!.start} to ${dr!.end}.\n\n` +
        `Value: ${marginPct.toFixed(2)}%\n` +
        `Color: ${color}\n` +
        `Good threshold: >= 15%\n` +
        `Neutral threshold: 10% to 15%\n` +
        `Bad threshold: < 10%\n` +
        `Prior period margin %: ${prevMarginPct.toFixed(2)}%\n` +
        `Margin delta (percentage points): ${marginDelta.toFixed(2)} pp\n` +
        `Period Est. Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `Period Est. COGS: RM ${cogs.toLocaleString('en-MY')}`,
      allowed: [
        pct('margin pct', marginPct),
        pct('prior margin pct', prevMarginPct),
        pct('margin delta pp', marginDelta),
        pct('good threshold', 15),
        pct('neutral threshold', 10),
        rm('est net sales', net),
        rm('est cogs', cogs),
      ],
    };
  },

  async sp_active_suppliers(dr) {
    const summary = await getSupplierMarginSummary(dr!.start, dr!.end);
    const activeSuppliers = Number(summary.current.active_suppliers);
    const net = Number(summary.current.revenue);
    const avgPerSupplier = activeSuppliers > 0 ? net / activeSuppliers : 0;

    return {
      prompt:
        `Population: active suppliers with purchase activity in ${dr!.start} to ${dr!.end}.\n\n` +
        `Value: ${activeSuppliers.toLocaleString('en-MY')}\n` +
        `Period Est. Net Sales: RM ${net.toLocaleString('en-MY')}\n` +
        `Avg Est. Net Sales per active supplier: RM ${Math.round(avgPerSupplier).toLocaleString('en-MY')}\n` +
        `Prior-period active supplier count: not available in the current pre-compute — evaluate based on overall mix signals, not a direct delta.`,
      allowed: [
        cnt('active suppliers', activeSuppliers),
        rm('est net sales', net),
        rm('avg net sales per supplier', Math.round(avgPerSupplier)),
      ],
    };
  },

  async sp_margin_trend(dr) {
    const trend = await getSupplierMarginTrend(dr!.start, dr!.end, 'monthly');
    if (trend.length === 0) {
      return { prompt: 'No profitability trend data available for selected period.', allowed: [] };
    }

    const allowed: AllowedValue[] = [];
    let table =
      '| Month | Est. Net Sales | Est. COGS | Est. Gross Profit | Margin % |\n' +
      '|-------|----------------|-----------|-------------------|----------|\n';
    let gpSum = 0;
    let revSum = 0;
    let cogsSum = 0;
    const marginPcts: number[] = [];
    for (const r of trend) {
      const rev = Number(r.revenue);
      const cogs = Number(r.cogs);
      const gp = Number(r.profit);
      const mp = r.margin_pct != null ? Number(r.margin_pct) : 0;
      revSum += rev;
      cogsSum += cogs;
      gpSum += gp;
      marginPcts.push(mp);
      table +=
        `| ${r.period} ` +
        `| RM ${rev.toLocaleString('en-MY')} ` +
        `| RM ${cogs.toLocaleString('en-MY')} ` +
        `| RM ${gp.toLocaleString('en-MY')} ` +
        `| ${mp.toFixed(2)}% |\n`;
      allowed.push(rm(`${r.period} est net sales`, rev));
      allowed.push(rm(`${r.period} est cogs`, cogs));
      allowed.push(rm(`${r.period} est gross profit`, gp));
      allowed.push(pct(`${r.period} margin pct`, mp));
    }

    const avgMargin = marginPcts.length > 0
      ? marginPcts.reduce((s, v) => s + v, 0) / marginPcts.length
      : 0;
    const periodMarginPct = revSum > 0 ? ((revSum - cogsSum) / revSum) * 100 : 0;
    const minMargin = marginPcts.length ? Math.min(...marginPcts) : 0;
    const maxMargin = marginPcts.length ? Math.max(...marginPcts) : 0;
    const minRow = trend.find(r => Number(r.margin_pct) === minMargin);
    const maxRow = trend.find(r => Number(r.margin_pct) === maxMargin);

    const preCalc =
      `Pre-calculated totals (use these values directly — do not recompute):\n` +
      `- Period Est. Net Sales: RM ${revSum.toLocaleString('en-MY')}\n` +
      `- Period Est. COGS: RM ${cogsSum.toLocaleString('en-MY')}\n` +
      `- Period Est. Gross Profit: RM ${gpSum.toLocaleString('en-MY')}\n` +
      `- Period Margin %: ${periodMarginPct.toFixed(2)}%\n` +
      `- Average Monthly Margin %: ${avgMargin.toFixed(2)}%\n` +
      (minRow ? `- Lowest margin month: ${minRow.period} at ${minMargin.toFixed(2)}%\n` : '') +
      (maxRow ? `- Highest margin month: ${maxRow.period} at ${maxMargin.toFixed(2)}%\n` : '') +
      `- Months in period: ${trend.length}\n`;

    allowed.push(rm('period est net sales', revSum));
    allowed.push(rm('period est cogs', cogsSum));
    allowed.push(rm('period est gross profit', gpSum));
    allowed.push(pct('period margin pct', periodMarginPct));
    allowed.push(pct('avg monthly margin pct', avgMargin));
    allowed.push(pct('lowest monthly margin pct', minMargin));
    allowed.push(pct('highest monthly margin pct', maxMargin));
    allowed.push(cnt('months in period', trend.length));

    return {
      prompt: `${preCalc}\nMonthly breakdown:\n${table}`,
      allowed,
    };
  },

  async sp_margin_distribution(dr) {
    const [supplierBuckets, itemBuckets] = await Promise.all([
      getSupplierMarginDistributionV2(dr!.start, dr!.end),
      getItemMarginDistributionV2(dr!.start, dr!.end),
    ]);

    const allowed: AllowedValue[] = [];

    const renderBuckets = (buckets: { bucket: string; count: number }[], label: string) => {
      const total = buckets.reduce((s, b) => s + Number(b.count), 0);
      let table =
        `| Margin % Bucket | ${label} Count | % of Total |\n` +
        `|-----------------|----------------|------------|\n`;
      for (const b of buckets) {
        const count = Number(b.count);
        const shareOfTotal = total > 0 ? (count / total) * 100 : 0;
        table += `| ${b.bucket} | ${count} | ${shareOfTotal.toFixed(1)}% |\n`;
        allowed.push(cnt(`${label.toLowerCase()} bucket ${b.bucket} count`, count));
        allowed.push(pct(`${label.toLowerCase()} bucket ${b.bucket} share`, shareOfTotal));
      }

      const lossBucket = buckets.find(b => b.bucket === '< 0%');
      const lossCount = lossBucket ? Number(lossBucket.count) : 0;
      const subTenCount = buckets
        .filter(b => ['< 0%', '0-5%', '5-10%'].includes(b.bucket))
        .reduce((s, b) => s + Number(b.count), 0);
      const healthyCount = buckets
        .filter(b => ['10-15%', '15-20%'].includes(b.bucket))
        .reduce((s, b) => s + Number(b.count), 0);
      const premiumCount = buckets
        .filter(b => ['20-30%', '30%+'].includes(b.bucket))
        .reduce((s, b) => s + Number(b.count), 0);

      const lossShare = total > 0 ? (lossCount / total) * 100 : 0;
      const subTenShare = total > 0 ? (subTenCount / total) * 100 : 0;
      const healthyShare = total > 0 ? (healthyCount / total) * 100 : 0;
      const premiumShare = total > 0 ? (premiumCount / total) * 100 : 0;

      allowed.push(cnt(`total ${label.toLowerCase()} in distribution`, total));
      allowed.push(cnt(`loss making ${label.toLowerCase()}`, lossCount));
      allowed.push(cnt(`sub ten ${label.toLowerCase()}`, subTenCount));
      allowed.push(cnt(`healthy band ${label.toLowerCase()}`, healthyCount));
      allowed.push(cnt(`premium band ${label.toLowerCase()}`, premiumCount));
      allowed.push(pct(`${label.toLowerCase()} loss making share`, lossShare));
      allowed.push(pct(`${label.toLowerCase()} sub ten share`, subTenShare));
      allowed.push(pct(`${label.toLowerCase()} healthy band share`, healthyShare));
      allowed.push(pct(`${label.toLowerCase()} premium band share`, premiumShare));

      return (
        `${label} view — ${total} ${label.toLowerCase()} total\n` +
        `- Loss-making (< 0%): ${lossCount} (${lossShare.toFixed(1)}%)\n` +
        `- Sub-10% margin: ${subTenCount} (${subTenShare.toFixed(1)}%)\n` +
        `- Healthy band (10–20%): ${healthyCount} (${healthyShare.toFixed(1)}%)\n` +
        `- Premium band (20%+): ${premiumCount} (${premiumShare.toFixed(1)}%)\n\n` +
        table
      );
    };

    if (supplierBuckets.length === 0 && itemBuckets.length === 0) {
      return { prompt: 'No margin distribution data available for selected period.', allowed: [] };
    }

    const supplierBlock = renderBuckets(supplierBuckets, 'Suppliers');
    const itemBlock = renderBuckets(itemBuckets, 'Items');

    const preamble =
      `This chart has a Suppliers ↔ Items toggle on the dashboard. Both views are pre-fetched here. Analyze both and contrast them.\n\n` +
      `Note: the Suppliers view places suppliers with zero revenue into the "< 0%" bucket (query behavior). The Items view excludes items with zero revenue.\n`;

    return {
      prompt: `${preamble}\n${supplierBlock}\n${itemBlock}`,
      allowed,
    };
  },

  // ─── Supplier Margin Section 4: Supplier Margin Breakdown ─────────────────
  // All fetchers reuse supplier-margin/queries.ts V2 helpers so the dashboard
  // and the AI see identical numbers (three-way match guaranteed).

  async sm_top_bottom(dr) {
    const start = dr!.start;
    const end = dr!.end;
    const summary = await getSupplierMarginSummary(start, end);
    const periodRev = Number(summary.current.revenue);
    const periodGp = Number(summary.current.profit);

    const [
      supProfitTop, supProfitBot, supMarginTop, supMarginBot,
      itemProfitTop, itemProfitBot, itemMarginTop, itemMarginBot,
    ] = await Promise.all([
      getTopBottomSuppliersV2(start, end, undefined, undefined, 10, 'desc', 'profit'),
      getTopBottomSuppliersV2(start, end, undefined, undefined, 10, 'asc',  'profit'),
      getTopBottomSuppliersV2(start, end, undefined, undefined, 50, 'desc', 'margin_pct'),
      getTopBottomSuppliersV2(start, end, undefined, undefined, 50, 'asc',  'margin_pct'),
      getTopBottomItemsV2(start, end, undefined, undefined, 10, 'desc', 'profit'),
      getTopBottomItemsV2(start, end, undefined, undefined, 10, 'asc',  'profit'),
      getTopBottomItemsV2(start, end, undefined, undefined, 50, 'desc', 'margin_pct'),
      getTopBottomItemsV2(start, end, undefined, undefined, 50, 'asc',  'margin_pct'),
    ]);

    // Margin-% lists: apply revenue floor RM 10,000 to cut noise (mirrors §2)
    const supMarginTopFiltered = supMarginTop.filter(r => Number(r.revenue) >= 10000).slice(0, 10);
    const supMarginBotFiltered = supMarginBot.filter(r => Number(r.revenue) >= 10000).slice(0, 10);
    const itemMarginTopFiltered = itemMarginTop.filter(r => Number(r.revenue) >= 10000).slice(0, 10);
    const itemMarginBotFiltered = itemMarginBot.filter(r => Number(r.revenue) >= 10000).slice(0, 10);

    const allowed: AllowedValue[] = [
      rm('period net sales', periodRev),
      rm('period gross profit', periodGp),
      rm('revenue floor', 10000),
    ];

    // Concentration (supplier profit)
    let top1GpShare = 0, top3GpShare = 0, top10GpShare = 0;
    supProfitTop.forEach((r, i) => {
      const share = periodGp > 0 ? (Number(r.profit) / periodGp) * 100 : 0;
      if (i === 0) top1GpShare = share;
      if (i < 3) top3GpShare += share;
      top10GpShare += share;
    });
    allowed.push(pct('top 1 supplier share of gp', top1GpShare));
    allowed.push(pct('top 3 supplier share of gp', top3GpShare));
    allowed.push(pct('top 10 supplier share of gp', top10GpShare));

    const lossSuppliers = supProfitBot.filter(r => Number(r.profit) < 0);
    const lossItems = itemProfitBot.filter(r => Number(r.profit) < 0);
    allowed.push(cnt('loss-making suppliers in bottom-10', lossSuppliers.length));
    allowed.push(cnt('loss-making items in bottom-10', lossItems.length));

    // Star accounts: suppliers on both top-profit and top-margin
    const supProfitCodes = new Set(supProfitTop.map(r => r.creditor_code));
    const supStars = supMarginTopFiltered.filter(r => supProfitCodes.has(r.creditor_code));
    const itemProfitCodes = new Set(itemProfitTop.map(r => r.item_code));
    const itemStars = itemMarginTopFiltered.filter(r => itemProfitCodes.has(r.item_code));
    allowed.push(cnt('star suppliers on both lists', supStars.length));
    allowed.push(cnt('star items on both lists', itemStars.length));

    const renderSupRow = (r: typeof supProfitTop[0], i: number) => {
      const rev = Number(r.revenue);
      const gp = Number(r.profit);
      const mp = Number(r.margin_pct);
      allowed.push(rm(`${r.creditor_code} revenue`, rev));
      allowed.push(rm(`${r.creditor_code} profit`, gp));
      allowed.push(pct(`${r.creditor_code} margin pct`, mp));
      return `| ${i + 1} | ${r.creditor_code} | ${r.company_name ?? r.creditor_code} | RM ${rev.toLocaleString('en-MY')} | RM ${gp.toLocaleString('en-MY')} | ${mp.toFixed(2)}% |\n`;
    };

    const renderItemRow = (r: typeof itemProfitTop[0], i: number) => {
      const rev = Number(r.revenue);
      const gp = Number(r.profit);
      const mp = Number(r.margin_pct);
      allowed.push(rm(`${r.item_code} revenue`, rev));
      allowed.push(rm(`${r.item_code} profit`, gp));
      allowed.push(pct(`${r.item_code} margin pct`, mp));
      return `| ${i + 1} | ${r.item_code} | ${r.item_name ?? r.item_code} | ${r.item_group ?? '-'} | RM ${rev.toLocaleString('en-MY')} | RM ${gp.toLocaleString('en-MY')} | ${mp.toFixed(2)}% |\n`;
    };

    const supHeader = '| # | Code | Supplier | Revenue | Profit | Margin % |\n|---|------|----------|---------|--------|---------:|\n';
    const itemHeader = '| # | Code | Item | Group | Revenue | Profit | Margin % |\n|---|------|------|-------|---------|--------|---------:|\n';

    let supTopProfitTable = supHeader;  supProfitTop.forEach((r, i) => { supTopProfitTable += renderSupRow(r, i); });
    let supBotProfitTable = supHeader;  supProfitBot.forEach((r, i) => { supBotProfitTable += renderSupRow(r, i); });
    let supTopMarginTable = supHeader;  supMarginTopFiltered.forEach((r, i) => { supTopMarginTable += renderSupRow(r, i); });
    let supBotMarginTable = supHeader;  supMarginBotFiltered.forEach((r, i) => { supBotMarginTable += renderSupRow(r, i); });
    let itemTopProfitTable = itemHeader; itemProfitTop.forEach((r, i) => { itemTopProfitTable += renderItemRow(r, i); });
    let itemBotProfitTable = itemHeader; itemProfitBot.forEach((r, i) => { itemBotProfitTable += renderItemRow(r, i); });
    let itemTopMarginTable = itemHeader; itemMarginTopFiltered.forEach((r, i) => { itemTopMarginTable += renderItemRow(r, i); });
    let itemBotMarginTable = itemHeader; itemMarginBotFiltered.forEach((r, i) => { itemBotMarginTable += renderItemRow(r, i); });

    const starList = (
      (supStars.length > 0 ? `Suppliers: ${supStars.map(s => s.company_name ?? s.creditor_code).join(', ')}` : '') +
      (itemStars.length > 0 ? `${supStars.length > 0 ? '; ' : ''}Items: ${itemStars.map(s => s.item_name ?? s.item_code).join(', ')}` : '')
    ) || 'none';

    const preCalc =
      `Population: active suppliers with purchase activity during ${start} to ${end}.\n\n` +
      `Pre-calculated totals (use these values directly — do not recompute):\n` +
      `- Period Est. Net Sales: RM ${periodRev.toLocaleString('en-MY')}\n` +
      `- Period Est. Gross Profit: RM ${periodGp.toLocaleString('en-MY')}\n` +
      `- Top 1 supplier share of period GP: ${top1GpShare.toFixed(2)}%\n` +
      `- Top 3 supplier share of period GP: ${top3GpShare.toFixed(2)}%\n` +
      `- Top 10 supplier share of period GP: ${top10GpShare.toFixed(2)}%\n` +
      `- Margin-% list revenue floor: RM 10,000\n` +
      `- Loss-making suppliers in bottom-10: ${lossSuppliers.length}\n` +
      `- Loss-making items in bottom-10: ${lossItems.length}\n` +
      `- Star accounts on BOTH top-profit AND top-margin lists — ${starList}\n`;

    return {
      prompt:
        `${preCalc}\n(A) Top 10 suppliers by Est. Gross Profit:\n${supTopProfitTable}\n` +
        `(B) Bottom 10 suppliers by Est. Gross Profit:\n${supBotProfitTable}\n` +
        `(C) Top 10 suppliers by Margin % (revenue ≥ RM 10,000):\n${supTopMarginTable}\n` +
        `(D) Bottom 10 suppliers by Margin % (revenue ≥ RM 10,000):\n${supBotMarginTable}\n` +
        `(E) Top 10 items by Est. Gross Profit:\n${itemTopProfitTable}\n` +
        `(F) Bottom 10 items by Est. Gross Profit:\n${itemBotProfitTable}\n` +
        `(G) Top 10 items by Margin % (revenue ≥ RM 10,000):\n${itemTopMarginTable}\n` +
        `(H) Bottom 10 items by Margin % (revenue ≥ RM 10,000):\n${itemBotMarginTable}`,
      allowed,
    };
  },

  async sm_supplier_table(dr) {
    const start = dr!.start;
    const end = dr!.end;
    const rows = await getSupplierTableV2(start, end);

    if (rows.length === 0) {
      return { prompt: 'No supplier table data available for selected period.', allowed: [] };
    }

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
    const totalGp = rows.reduce((s, r) => s + Number(r.gross_profit), 0);
    const supplierCount = rows.length;

    // Top 10 by revenue
    const top10 = [...rows].sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 10);
    const top10RevSum = top10.reduce((s, r) => s + Number(r.revenue), 0);
    const top10Share = totalRevenue > 0 ? (top10RevSum / totalRevenue) * 100 : 0;

    // Bottom 10 by margin % (with revenue floor RM 10,000)
    const meaningful = rows.filter(r => Number(r.revenue) >= 10000 && r.margin_pct != null);
    const bottom10 = [...meaningful].sort((a, b) => Number(a.margin_pct) - Number(b.margin_pct)).slice(0, 10);

    const lossCount = rows.filter(r => r.margin_pct != null && Number(r.margin_pct) < 0).length;
    const thinCount = rows.filter(r => r.margin_pct != null && Number(r.margin_pct) < 5).length;
    const avgRevenue = supplierCount > 0 ? totalRevenue / supplierCount : 0;

    const validMargins = rows.map(r => Number(r.margin_pct)).filter(m => !isNaN(m)).sort((a, b) => a - b);
    const medianMargin = validMargins.length > 0
      ? validMargins[Math.floor(validMargins.length / 2)]
      : 0;

    const allowed: AllowedValue[] = [
      rm('period total revenue', totalRevenue),
      rm('period total gross profit', totalGp),
      rm('top 10 revenue sum', top10RevSum),
      pct('top 10 share of revenue', top10Share),
      cnt('total supplier count', supplierCount),
      cnt('loss-making suppliers', lossCount),
      cnt('thin-margin suppliers below 5 pct', thinCount),
      pct('median margin pct', medianMargin),
      rm('avg revenue per supplier', avgRevenue),
      rm('revenue floor for bottom margin list', 10000),
    ];

    const renderRow = (r: typeof rows[0], i: number) => {
      const rev = Number(r.revenue);
      const cogs = Number(r.cogs);
      const gp = Number(r.gross_profit);
      const mp = Number(r.margin_pct ?? 0);
      allowed.push(rm(`${r.creditor_code} revenue`, rev));
      allowed.push(rm(`${r.creditor_code} cogs`, cogs));
      allowed.push(rm(`${r.creditor_code} gross profit`, gp));
      allowed.push(pct(`${r.creditor_code} margin pct`, mp));
      return `| ${i + 1} | ${r.creditor_code} | ${r.company_name ?? r.creditor_code} | ${r.supplier_type ?? 'Unassigned'} | ${r.item_count} | RM ${rev.toLocaleString('en-MY')} | RM ${cogs.toLocaleString('en-MY')} | RM ${gp.toLocaleString('en-MY')} | ${mp.toFixed(2)}% |\n`;
    };

    const header =
      '| # | Code | Supplier | Type | Items | Revenue | COGS | GP | Margin % |\n' +
      '|---|------|----------|------|------:|---------|------|----|---------:|\n';

    let topTable = header; top10.forEach((r, i) => { topTable += renderRow(r, i); });
    let bottomTable = header; bottom10.forEach((r, i) => { bottomTable += renderRow(r, i); });

    const preCalc =
      `Population: active suppliers with purchase activity during ${start} to ${end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total active suppliers: ${supplierCount}\n` +
      `- Period Est. Net Sales (across all suppliers): RM ${totalRevenue.toLocaleString('en-MY')}\n` +
      `- Period Est. Gross Profit (across all suppliers): RM ${totalGp.toLocaleString('en-MY')}\n` +
      `- Top 10 revenue sum: RM ${top10RevSum.toLocaleString('en-MY')}\n` +
      `- Top 10 share of total revenue: ${top10Share.toFixed(2)}%\n` +
      `- Loss-making suppliers (margin % < 0): ${lossCount}\n` +
      `- Thin-margin suppliers (margin % < 5%): ${thinCount}\n` +
      `- Median margin %: ${medianMargin.toFixed(2)}%\n` +
      `- Avg revenue per supplier: RM ${avgRevenue.toLocaleString('en-MY')}\n`;

    return {
      prompt:
        `${preCalc}\n(A) Top 10 suppliers by Revenue (biggest sourcing partners):\n${topTable}\n` +
        `(B) Bottom 10 suppliers by Margin % with revenue ≥ RM 10,000 (weak-margin partners):\n${bottomTable}`,
      allowed,
    };
  },

  async sm_item_pricing(dr) {
    const start = dr!.start;
    const end = dr!.end;
    const items = await getItemListV2(start, end);

    if (items.length === 0) {
      return { prompt: 'No item pricing data available for selected period.', allowed: [] };
    }

    // Anchor = highest purchase-total item (items are already ORDER BY total_buy DESC)
    const anchor = items[0];
    const supplierRows = await getItemSupplierSummaryV2(anchor.item_code, start, end);

    if (supplierRows.length === 0) {
      return {
        prompt: `Anchor item "${anchor.item_description}" (${anchor.item_code}) has no supplier rows in the selected period.`,
        allowed: [],
      };
    }

    const top5 = supplierRows.slice(0, 5);
    const totalQty = supplierRows.reduce((s, r) => s + Number(r.total_qty), 0);
    const totalBuy = supplierRows.reduce((s, r) => s + Number(r.total_buy), 0);
    const avgPurchasePrice = totalQty > 0 ? totalBuy / totalQty : 0;
    const prices = supplierRows.map(r => Number(r.avg_price)).filter(p => p > 0);
    const minPurchasePrice = prices.length ? Math.min(...prices) : 0;
    const maxPurchasePrice = prices.length ? Math.max(...prices) : 0;
    const marginPcts = supplierRows
      .map(r => (r.est_margin_pct != null ? Number(r.est_margin_pct) : null))
      .filter((m): m is number => m !== null);
    const marginSpread = marginPcts.length ? Math.max(...marginPcts) - Math.min(...marginPcts) : 0;

    const cheapest = supplierRows.find(r => Number(r.avg_price) === minPurchasePrice);
    const cheapestShare = cheapest && totalQty > 0 ? (Number(cheapest.total_qty) / totalQty) * 100 : 0;

    const allowed: AllowedValue[] = [
      rm(`${anchor.item_code} total purchase rm`, totalBuy),
      rm(`${anchor.item_code} total purchase qty`, totalQty),
      rm(`${anchor.item_code} avg purchase price`, avgPurchasePrice),
      rm(`${anchor.item_code} min purchase price`, minPurchasePrice),
      rm(`${anchor.item_code} max purchase price`, maxPurchasePrice),
      pct(`${anchor.item_code} margin spread`, marginSpread),
      pct(`${anchor.item_code} cheapest supplier share of qty`, cheapestShare),
      cnt(`${anchor.item_code} supplier count`, supplierRows.length),
    ];

    let table =
      '| # | Code | Supplier | Qty | Total Buy | Avg Price | Est. Sales | Est. Margin % |\n' +
      '|---|------|----------|----:|-----------|-----------|------------|--------------:|\n';
    top5.forEach((r, i) => {
      const qty = Number(r.total_qty);
      const buy = Number(r.total_buy);
      const price = Number(r.avg_price);
      const estSales = Number(r.est_sales);
      const estMargin = r.est_margin_pct != null ? Number(r.est_margin_pct) : null;
      allowed.push(rm(`${r.creditor_code} total buy`, buy));
      allowed.push(rm(`${r.creditor_code} avg price`, price));
      allowed.push(rm(`${r.creditor_code} qty`, qty));
      allowed.push(rm(`${r.creditor_code} est sales`, estSales));
      if (estMargin != null) allowed.push(pct(`${r.creditor_code} est margin pct`, estMargin));
      table +=
        `| ${i + 1} | ${r.creditor_code} | ${r.creditor_name ?? r.creditor_code} ` +
        `| ${qty.toLocaleString('en-MY')} | RM ${buy.toLocaleString('en-MY')} | RM ${price.toFixed(2)} ` +
        `| RM ${estSales.toLocaleString('en-MY')} | ${estMargin != null ? estMargin.toFixed(2) + '%' : 'n/a'} |\n`;
    });

    const preCalc =
      `Population: active suppliers of anchor item "${anchor.item_description}" (${anchor.item_code}) during ${start} to ${end}.\n\n` +
      `Anchor item selection: highest-revenue item in the period (${items.length} items in universe).\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Anchor item: ${anchor.item_description} (${anchor.item_code})\n` +
      `- Supplier count for this item: ${supplierRows.length}\n` +
      `- Total purchased qty: ${totalQty.toLocaleString('en-MY')}\n` +
      `- Total purchase RM: RM ${totalBuy.toLocaleString('en-MY')}\n` +
      `- Avg purchase price across all suppliers: RM ${avgPurchasePrice.toFixed(2)}\n` +
      `- Min / max supplier avg price: RM ${minPurchasePrice.toFixed(2)} / RM ${maxPurchasePrice.toFixed(2)}\n` +
      `- Cross-supplier margin % spread: ${marginSpread.toFixed(2)} percentage points\n` +
      `- Cheapest supplier (${cheapest?.creditor_name ?? 'n/a'}) qty share: ${cheapestShare.toFixed(2)}%\n`;

    return {
      prompt: `${preCalc}\nTop 5 suppliers for this anchor item by purchase volume:\n${table}`,
      allowed,
    };
  },

  async sm_price_scatter(dr) {
    const start = dr!.start;
    const end = dr!.end;
    const rows = await getPriceSpread(start, end);

    if (rows.length === 0) {
      return { prompt: 'No price scatter data available for selected period.', allowed: [] };
    }

    // Top 50 by revenue (the items that actually matter)
    const sortedByRevenue = [...rows].sort((a, b) => Number(b.revenue) - Number(a.revenue));
    const top50 = sortedByRevenue.slice(0, 50);
    const universeSize = rows.length;

    // Bucket histogram across the full universe
    const buckets = { lt0: 0, b0_5: 0, b5_10: 0, b10_20: 0, b20plus: 0 };
    rows.forEach(r => {
      const mp = r.margin_pct != null ? Number(r.margin_pct) : null;
      if (mp == null) return;
      if (mp < 0) buckets.lt0++;
      else if (mp < 5) buckets.b0_5++;
      else if (mp < 10) buckets.b5_10++;
      else if (mp < 20) buckets.b10_20++;
      else buckets.b20plus++;
    });

    const universeLossCount = buckets.lt0;
    const top50LossCount = top50.filter(r => r.margin_pct != null && Number(r.margin_pct) < 0).length;
    const top50RevenueSum = top50.reduce((s, r) => s + Number(r.revenue), 0);

    const allowed: AllowedValue[] = [
      cnt('universe size items', universeSize),
      cnt('top 50 sample size', top50.length),
      cnt('items margin below 0', buckets.lt0),
      cnt('items margin 0 to 5', buckets.b0_5),
      cnt('items margin 5 to 10', buckets.b5_10),
      cnt('items margin 10 to 20', buckets.b10_20),
      cnt('items margin 20 plus', buckets.b20plus),
      cnt('universe loss-maker count', universeLossCount),
      cnt('top 50 loss-maker count', top50LossCount),
      rm('top 50 revenue sum', top50RevenueSum),
    ];

    let table =
      '| # | Code | Item | Suppliers | Avg Purchase | Avg Sell | Margin % | Revenue |\n' +
      '|---|------|------|-----------|-------------:|---------:|---------:|---------|\n';
    top50.forEach((r, i) => {
      const pp = Number(r.avg_purchase_price);
      const sp = Number(r.avg_selling_price);
      const mp = r.margin_pct != null ? Number(r.margin_pct) : 0;
      const rev = Number(r.revenue);
      allowed.push(rm(`${r.item_code} avg purchase`, pp));
      allowed.push(rm(`${r.item_code} avg selling`, sp));
      allowed.push(pct(`${r.item_code} margin pct`, mp));
      allowed.push(rm(`${r.item_code} revenue`, rev));
      const suppliers = (r.supplier_names ?? '').split(',').slice(0, 3).join(', ');
      table +=
        `| ${i + 1} | ${r.item_code} | ${r.item_name ?? r.item_code} | ${suppliers} ` +
        `| RM ${pp.toFixed(2)} | RM ${sp.toFixed(2)} | ${mp.toFixed(2)}% | RM ${rev.toLocaleString('en-MY')} |\n`;
    });

    const preCalc =
      `Population: items with positive sales revenue during ${start} to ${end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Universe size (items with revenue > 0): ${universeSize}\n` +
      `- Top 50 sample revenue sum: RM ${top50RevenueSum.toLocaleString('en-MY')}\n` +
      `- Loss-making items in top-50 sample: ${top50LossCount}\n` +
      `- Loss-making items in full universe: ${universeLossCount}\n` +
      `- Margin bucket distribution (full universe):\n` +
      `  · < 0%: ${buckets.lt0}\n` +
      `  · 0-5%: ${buckets.b0_5}\n` +
      `  · 5-10%: ${buckets.b5_10}\n` +
      `  · 10-20%: ${buckets.b10_20}\n` +
      `  · 20%+: ${buckets.b20plus}\n`;

    return {
      prompt: `${preCalc}\nTop 50 items by revenue:\n${table}`,
      allowed,
    };
  },

  // ─── Return Trend (§5) ───────────────────────────────────────────────────
  async rt_total_returns(dr) {
    const o = await getReturnOverview(dr!.start, dr!.end);
    const avgPerCn = o.return_count > 0 ? o.total_return_value / o.return_count : 0;
    return {
      prompt:
        `Population: return credit notes issued in ${dr!.start} to ${dr!.end}.\n\n` +
        `Total return value: RM ${o.total_return_value.toLocaleString('en-MY')}\n` +
        `Return count (CNs): ${o.return_count}\n` +
        `Period net sales (for context): RM ${o.total_sales.toLocaleString('en-MY')}\n` +
        `Return rate %: ${o.return_rate_pct.toFixed(2)}%\n` +
        `Avg return value per CN: RM ${Math.round(avgPerCn).toLocaleString('en-MY')}\n` +
        `Return rate threshold: < 2% Healthy · 2-5% Watch · > 5% Concern`,
      allowed: [
        rm('total return value', o.total_return_value),
        cnt('return count', o.return_count),
        rm('period net sales', o.total_sales),
        pct('return rate pct', o.return_rate_pct),
        rm('avg return per cn', Math.round(avgPerCn)),
      ],
    };
  },

  async rt_settled(dr) {
    const o = await getReturnOverview(dr!.start, dr!.end);
    const r = await getRefundSummary(dr!.start, dr!.end);
    const settled = o.total_knocked_off + o.total_refunded;
    const settledPct = o.total_return_value > 0 ? (settled / o.total_return_value) * 100 : 0;
    return {
      prompt:
        `Population: return credit notes issued in ${dr!.start} to ${dr!.end}.\n\n` +
        `Total return value: RM ${o.total_return_value.toLocaleString('en-MY')}\n` +
        `Total settled (knocked off + refunded): RM ${settled.toLocaleString('en-MY')}\n` +
        `Settled % of return value: ${settledPct.toFixed(1)}%\n` +
        `- Knocked off (offset against invoices, NO cash leaves door): RM ${o.total_knocked_off.toLocaleString('en-MY')} (${r.knock_off_pct.toFixed(1)}%)\n` +
        `- Refunded (cash/cheque out the door): RM ${o.total_refunded.toLocaleString('en-MY')} (${r.refund_pct.toFixed(1)}%)\n` +
        `Refund transaction count: ${r.refund_count}\n\n` +
        `Thresholds: Knock-off % > 70% = Healthy · Refund % > 30% = Concern (cash leakage)\n` +
        `Business context: Knock-off is the PREFERRED settlement channel for a distribution business — it offsets future invoices with no cash out. Refund means actual cash paid back and erodes working capital.`,
      allowed: [
        rm('total return value', o.total_return_value),
        rm('total settled', settled),
        pct('settled pct', settledPct),
        rm('knocked off', o.total_knocked_off),
        pct('knock off pct', r.knock_off_pct),
        rm('refunded', o.total_refunded),
        pct('refund pct', r.refund_pct),
        cnt('refund count', r.refund_count),
      ],
    };
  },

  async rt_unsettled(dr) {
    const o = await getReturnOverview(dr!.start, dr!.end);
    const unsettledPct = o.total_return_value > 0 ? (o.total_unresolved / o.total_return_value) * 100 : 0;
    return {
      prompt:
        `Population: return credit notes issued in ${dr!.start} to ${dr!.end}.\n\n` +
        `Total unsettled: RM ${o.total_unresolved.toLocaleString('en-MY')}\n` +
        `Unsettled % of return value: ${unsettledPct.toFixed(1)}%\n` +
        `Total return value: RM ${o.total_return_value.toLocaleString('en-MY')}\n\n` +
        `CN reconciliation breakdown:\n` +
        `- Fully reconciled CNs: ${o.reconciled_count}\n` +
        `- Partially resolved CNs: ${o.partial_count}\n` +
        `- Outstanding (zero resolution) CNs: ${o.outstanding_count}\n` +
        `- Total return CNs: ${o.return_count}\n` +
        `- Reconciliation rate: ${o.reconciliation_rate.toFixed(1)}%\n\n` +
        `Thresholds (unsettled % of return value): < 15% Healthy · 15-30% Watch · > 30% Concern`,
      allowed: [
        rm('total unsettled', o.total_unresolved),
        pct('unsettled pct', unsettledPct),
        rm('total return value', o.total_return_value),
        cnt('reconciled count', o.reconciled_count),
        cnt('partial count', o.partial_count),
        cnt('outstanding count', o.outstanding_count),
        cnt('return count', o.return_count),
        pct('reconciliation rate', o.reconciliation_rate),
      ],
    };
  },

  async rt_return_pct(dr) {
    const o = await getReturnOverview(dr!.start, dr!.end);
    const color =
      o.return_rate_pct < 2 ? 'Green (Good)' :
      o.return_rate_pct <= 5 ? 'Amber (Watch)' :
      'Red (Concern)';
    return {
      prompt:
        `Population: returns vs net sales in ${dr!.start} to ${dr!.end}.\n\n` +
        `Return rate %: ${o.return_rate_pct.toFixed(2)}%\n` +
        `Color band: ${color}\n` +
        `Period return value: RM ${o.total_return_value.toLocaleString('en-MY')}\n` +
        `Period net sales: RM ${o.total_sales.toLocaleString('en-MY')}\n\n` +
        `Thresholds: < 2% Green (Good) · 2-5% Amber (Watch) · > 5% Red (Concern)`,
      allowed: [
        pct('return rate pct', o.return_rate_pct),
        rm('period return value', o.total_return_value),
        rm('period net sales', o.total_sales),
        pct('good threshold', 2),
        pct('concern threshold', 5),
      ],
    };
  },

  async rt_settlement_breakdown(dr) {
    const r = await getRefundSummary(dr!.start, dr!.end);
    return {
      prompt:
        `Population: return credit notes issued in ${dr!.start} to ${dr!.end}.\n\n` +
        `Total return value: RM ${r.total_return_value.toLocaleString('en-MY')}\n\n` +
        `Settlement breakdown:\n` +
        `- Knocked off: RM ${r.total_knocked_off.toLocaleString('en-MY')} (${r.knock_off_pct.toFixed(1)}%)\n` +
        `- Refunded (cash/cheque): RM ${r.total_refunded.toLocaleString('en-MY')} (${r.refund_pct.toFixed(1)}%)\n` +
        `- Unsettled: RM ${r.total_unresolved.toLocaleString('en-MY')} (${r.unresolved_pct.toFixed(1)}%)\n` +
        `- Refund transaction count: ${r.refund_count}\n\n` +
        `Thresholds:\n` +
        `- Knock-off % > 70% = Healthy (cash-efficient)\n` +
        `- Refund % > 30% = Concern (cash-draining)\n` +
        `- Unsettled % > 30% = Concern (exposure piling up)\n\n` +
        `Business context: Knock-off is preferred (offsets future invoices, no cash out). Refund is cash out the door — working-capital impact.`,
      allowed: [
        rm('total return value', r.total_return_value),
        rm('knocked off', r.total_knocked_off),
        pct('knock off pct', r.knock_off_pct),
        rm('refunded', r.total_refunded),
        pct('refund pct', r.refund_pct),
        rm('unsettled', r.total_unresolved),
        pct('unsettled pct', r.unresolved_pct),
        cnt('refund count', r.refund_count),
      ],
    };
  },

  async rt_monthly_trend(dr) {
    const trend = await getReturnTrend(dr!.start, dr!.end);
    if (trend.length === 0) {
      return { prompt: 'No monthly return trend data for selected period.', allowed: [] };
    }
    const allowed: AllowedValue[] = [];
    let table =
      '| Month | Return Value | Unsettled | CN Count |\n' +
      '|-------|--------------|-----------|----------|\n';
    let peakValue = { period: trend[0].period, value: 0 };
    let lowValue = { period: trend[0].period, value: Number.POSITIVE_INFINITY };
    let peakUnsettled = { period: trend[0].period, value: 0 };
    for (const r of trend) {
      const rv = Number(r.return_value);
      const un = Number(r.unresolved);
      const ct = Number(r.count);
      table +=
        `| ${r.period} ` +
        `| RM ${rv.toLocaleString('en-MY')} ` +
        `| RM ${un.toLocaleString('en-MY')} ` +
        `| ${ct} |\n`;
      allowed.push(rm(`${r.period} return value`, rv));
      allowed.push(rm(`${r.period} unsettled`, un));
      allowed.push(cnt(`${r.period} cn count`, ct));
      if (rv > peakValue.value) peakValue = { period: r.period, value: rv };
      if (rv < lowValue.value) lowValue = { period: r.period, value: rv };
      if (un > peakUnsettled.value) peakUnsettled = { period: r.period, value: un };
    }
    const first = trend[0];
    const last = trend[trend.length - 1];
    const countGrowthPct = Number(first.count) > 0
      ? ((Number(last.count) - Number(first.count)) / Number(first.count)) * 100
      : 0;

    const preCalc =
      `Population: months with return activity between ${dr!.start} and ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Months in period: ${trend.length}\n` +
      `- Peak return-value month: ${peakValue.period} at RM ${peakValue.value.toLocaleString('en-MY')}\n` +
      `- Lowest return-value month: ${lowValue.period} at RM ${lowValue.value.toLocaleString('en-MY')}\n` +
      `- Peak unsettled month: ${peakUnsettled.period} at RM ${peakUnsettled.value.toLocaleString('en-MY')}\n` +
      `- MoM return-count growth (first month → last month): ${countGrowthPct.toFixed(1)}%\n\n`;

    allowed.push(cnt('months in period', trend.length));
    allowed.push(rm('peak return value', peakValue.value));
    allowed.push(rm('lowest return value', lowValue.value));
    allowed.push(rm('peak unsettled', peakUnsettled.value));
    allowed.push(pct('mom count growth pct', countGrowthPct));

    return {
      prompt: `${preCalc}Monthly trend table:\n${table}`,
      allowed,
    };
  },

  async rt_product_bar(dr) {
    const [byFreq, byValue] = await Promise.all([
      getReturnProducts(dr!.start, dr!.end, 'item', 'frequency'),
      getReturnProducts(dr!.start, dr!.end, 'item', 'value'),
    ]);
    const overview = await getReturnOverview(dr!.start, dr!.end);
    const totalReturnValue = overview.total_return_value;
    const totalReturnCount = overview.return_count;

    const allowed: AllowedValue[] = [
      rm('period total return value', totalReturnValue),
      cnt('period total return count', totalReturnCount),
    ];

    const buildTable = (rows: typeof byFreq, label: string) => {
      let t =
        `Top 10 items by ${label}:\n` +
        '| # | Item | CN Count | Return Value | Total Qty |\n' +
        '|---|------|----------|--------------|-----------|\n';
      rows.forEach((r, i) => {
        const val = Number(r.total_value);
        const cnCount = Number(r.cn_count);
        t +=
          `| ${i + 1} | ${r.name} | ${cnCount} | RM ${val.toLocaleString('en-MY')} | ${Number(r.total_qty).toLocaleString('en-MY')} |\n`;
        allowed.push(rm(`${r.name} return value`, val));
        allowed.push(cnt(`${r.name} cn count`, cnCount));
      });
      return t;
    };

    const top1Share = byValue.length > 0 && totalReturnValue > 0
      ? (Number(byValue[0].total_value) / totalReturnValue) * 100
      : 0;
    const top10ValueSum = byValue.reduce((s, r) => s + Number(r.total_value), 0);
    const top10Share = totalReturnValue > 0 ? (top10ValueSum / totalReturnValue) * 100 : 0;

    const freqNames = new Set(byFreq.map(r => r.name));
    const overlap = byValue.filter(r => freqNames.has(r.name)).map(r => r.name);

    allowed.push(pct('top 1 item share of return value', top1Share));
    allowed.push(pct('top 10 item share of return value', top10Share));
    allowed.push(rm('top 10 item return value sum', top10ValueSum));

    const preCalc =
      `Population: items with return activity between ${dr!.start} and ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups:\n` +
      `- Period total return value: RM ${totalReturnValue.toLocaleString('en-MY')}\n` +
      `- Period total return count: ${totalReturnCount}\n` +
      `- Top 1 item share of return value: ${top1Share.toFixed(1)}%\n` +
      `- Top 10 items share of return value: ${top10Share.toFixed(1)}% (sum RM ${top10ValueSum.toLocaleString('en-MY')})\n` +
      `- Items appearing on BOTH top-frequency AND top-value lists: ${overlap.length > 0 ? overlap.join(', ') : 'none'}\n\n` +
      `Thresholds: Top-1 > 15% severe · Top-10 > 60% concentrated · Top-10 < 40% diversified\n\n`;

    return {
      prompt:
        preCalc +
        buildTable(byFreq, 'Return Frequency (CN count)') +
        '\n' +
        buildTable(byValue, 'Return Value (RM)'),
      allowed,
    };
  },

  // ─── Return Unsettled (§6) ──────────────────────────────────────────────
  async ru_aging_chart() {
    const buckets = await getReturnAging();

    // Canonical order, matching UI AgingChart
    const order = ['0-30 days', '31-60 days', '61-90 days', '91-180 days', '180+ days'];
    const byBucket = new Map(buckets.map(b => [b.bucket, b]));
    const rows = order.map(b => ({
      bucket: b,
      amount: Number(byBucket.get(b)?.amount ?? 0),
      count: Number(byBucket.get(b)?.count ?? 0),
    }));

    const totalAmt = rows.reduce((s, r) => s + r.amount, 0);
    const totalCnt = rows.reduce((s, r) => s + r.count, 0);
    const share = (amt: number) => (totalAmt > 0 ? (amt / totalAmt) * 100 : 0);

    const b030 = rows[0], b3160 = rows[1], b6190 = rows[2], b91180 = rows[3], b180 = rows[4];
    const share030 = share(b030.amount);
    const share3160 = share(b3160.amount);
    const share6190 = share(b6190.amount);
    const share91180 = share(b91180.amount);
    const share180 = share(b180.amount);
    const share91Plus = share91180 + share180;

    const allowed: AllowedValue[] = [
      rm('total unsettled amount', totalAmt),
      cnt('total unsettled count', totalCnt),
      rm('0-30 bucket amount', b030.amount),
      rm('31-60 bucket amount', b3160.amount),
      rm('61-90 bucket amount', b6190.amount),
      rm('91-180 bucket amount', b91180.amount),
      rm('180+ bucket amount', b180.amount),
      cnt('0-30 bucket count', b030.count),
      cnt('31-60 bucket count', b3160.count),
      cnt('61-90 bucket count', b6190.count),
      cnt('91-180 bucket count', b91180.count),
      cnt('180+ bucket count', b180.count),
      pct('0-30 share of unsettled', share030),
      pct('31-60 share of unsettled', share3160),
      pct('61-90 share of unsettled', share6190),
      pct('91-180 share of unsettled', share91180),
      pct('180+ share of unsettled', share180),
      pct('91+ combined share of unsettled', share91Plus),
    ];

    const preCalc =
      `Population: cumulative unsettled return exposure across all months, by aging bucket.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total unsettled amount: RM ${totalAmt.toLocaleString('en-MY')}\n` +
      `- Total unsettled count: ${totalCnt}\n` +
      `- 91+ buckets combined share of unsettled value: ${share91Plus.toFixed(1)}%\n` +
      `- 180+ bucket share of unsettled value: ${share180.toFixed(1)}%\n\n` +
      `Thresholds: 91+ combined > 25% = Watch · 180+ alone > 10% = Write-off risk\n\n`;

    const table =
      `Aging distribution:\n` +
      '| Bucket | Amount (RM) | Count | Share of Unsettled |\n' +
      '|---|---|---|---|\n' +
      rows.map(r =>
        `| ${r.bucket} | RM ${r.amount.toLocaleString('en-MY')} | ${r.count} | ${share(r.amount).toFixed(1)}% |`
      ).join('\n');

    return {
      prompt: preCalc + table,
      allowed,
    };
  },

  async ru_debtors_table() {
    const all = await getAllCustomerReturnsAll();
    const unresolvedRows = all.filter(r => r.unresolved > 0.01);

    const totalUnsettled = unresolvedRows.reduce((s, r) => s + r.unresolved, 0);
    const debtorCount = unresolvedRows.length;

    const staleCount = unresolvedRows.filter(r =>
      r.total_knocked_off === 0 && r.total_refunded === 0
    ).length;

    // Sort by unresolved desc for top-N
    const sorted = [...unresolvedRows].sort((a, b) => b.unresolved - a.unresolved);
    const top1Share = sorted.length > 0 && totalUnsettled > 0
      ? (sorted[0].unresolved / totalUnsettled) * 100
      : 0;
    const top10 = sorted.slice(0, 10);
    const top10Sum = top10.reduce((s, r) => s + r.unresolved, 0);
    const top10Share = totalUnsettled > 0 ? (top10Sum / totalUnsettled) * 100 : 0;

    const allowed: AllowedValue[] = [
      rm('total unsettled across all debtors', totalUnsettled),
      cnt('debtors with unresolved balance', debtorCount),
      cnt('stale debtor count (never actioned)', staleCount),
      pct('top 1 debtor share of unsettled', top1Share),
      pct('top 10 debtor share of unsettled', top10Share),
      rm('top 10 debtor unresolved sum', top10Sum),
    ];

    // Top 5 detail rows (names + numbers)
    const top5 = sorted.slice(0, 5);
    top5.forEach(r => {
      allowed.push(rm(`${r.company_name} unresolved`, r.unresolved));
      allowed.push(rm(`${r.company_name} knocked off`, r.total_knocked_off));
      allowed.push(rm(`${r.company_name} refunded`, r.total_refunded));
      allowed.push(rm(`${r.company_name} total return value`, r.total_return_value));
      allowed.push(cnt(`${r.company_name} return count`, r.return_count));
    });

    const preCalc =
      `Population: every debtor with a non-zero unresolved return balance, cumulative across all months.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total unsettled: RM ${totalUnsettled.toLocaleString('en-MY')}\n` +
      `- Debtors with unresolved balance: ${debtorCount}\n` +
      `- Stale debtors (unresolved > 0 AND no knock-off AND no refund): ${staleCount}\n` +
      `- Top 1 debtor share: ${top1Share.toFixed(1)}%\n` +
      `- Top 10 debtor share: ${top10Share.toFixed(1)}% (sum RM ${top10Sum.toLocaleString('en-MY')})\n\n` +
      `Thresholds: Top-1 > 15% = Single-point risk · Top-10 > 60% = Concentrated\n\n`;

    const table =
      `Top 5 debtors by unresolved:\n` +
      '| # | Debtor | Returns | Return Value | Knocked Off | Refunded | Unresolved |\n' +
      '|---|---|---|---|---|---|---|\n' +
      top5.map((r, i) =>
        `| ${i + 1} | ${r.company_name} | ${r.return_count} | RM ${r.total_return_value.toLocaleString('en-MY')} | RM ${r.total_knocked_off.toLocaleString('en-MY')} | RM ${r.total_refunded.toLocaleString('en-MY')} | RM ${r.unresolved.toLocaleString('en-MY')} |`
      ).join('\n');

    return {
      prompt: preCalc + table,
      allowed,
    };
  },

  // ─── Expense Overview (§7) ──────────────────────────────────────────────
  async ex_total_costs(dr) {
    const k = await getCostKpisV2(dr!.start, dr!.end);
    const total = k.current.total_costs;
    const cogsPct = total > 0 ? (k.current.cogs / total) * 100 : 0;
    const opexPct = total > 0 ? (k.current.opex / total) * 100 : 0;
    const yoy = k.yoy_pct ?? 0;
    const yoyLabel = k.yoy_pct != null
      ? (yoy < 0 ? 'Healthy (costs down)' : yoy <= 5 ? 'Watch' : yoy <= 10 ? 'Concern' : 'Severe')
      : 'No prior-year data';
    return {
      prompt:
        `Population: expense GL postings in ${dr!.start} to ${dr!.end}.\n\n` +
        `Total Costs (COGS + OpEx): RM ${Math.round(total).toLocaleString('en-MY')}\n` +
        `- Cost of Sales (COGS): RM ${Math.round(k.current.cogs).toLocaleString('en-MY')} (${cogsPct.toFixed(1)}% of total)\n` +
        `- Operating Costs (OpEx): RM ${Math.round(k.current.opex).toLocaleString('en-MY')} (${opexPct.toFixed(1)}% of total)\n` +
        `Prior-year total costs (same period): RM ${Math.round(k.previous.total_costs).toLocaleString('en-MY')}\n` +
        `YoY total-cost growth: ${yoy.toFixed(1)}% — ${yoyLabel}\n\n` +
        `Thresholds (YoY total-cost growth): < 0% Healthy · 0-5% Watch · 5-10% Concern · > 10% Severe\n` +
        `COGS share thresholds: 60-80% Typical · > 85% COGS-dominated · < 50% OpEx-dominated`,
      allowed: [
        rm('total costs', Math.round(total)),
        rm('cogs', Math.round(k.current.cogs)),
        rm('opex', Math.round(k.current.opex)),
        pct('cogs pct of total', cogsPct),
        pct('opex pct of total', opexPct),
        rm('prior year total costs', Math.round(k.previous.total_costs)),
        pct('yoy total cost growth', yoy),
      ],
    };
  },

  async ex_cogs(dr) {
    const k = await getCostKpisV2(dr!.start, dr!.end);
    const breakdown = await getCogsBreakdown(dr!.start, dr!.end);
    const total = k.current.total_costs;
    const cogsPct = total > 0 ? (k.current.cogs / total) * 100 : 0;
    const cogsYoy = k.previous.cogs !== 0
      ? ((k.current.cogs - k.previous.cogs) / Math.abs(k.previous.cogs)) * 100
      : 0;
    const cogsYoyLabel = cogsYoy < 0 ? 'Healthy (COGS down)' : cogsYoy <= 10 ? 'Watch' : 'Concern (verify vs sales growth)';

    const top3 = breakdown.slice(0, 3);
    const allowed: AllowedValue[] = [
      rm('cogs', Math.round(k.current.cogs)),
      rm('total costs', Math.round(total)),
      pct('cogs pct of total', cogsPct),
      rm('prior year cogs', Math.round(k.previous.cogs)),
      pct('cogs yoy growth', cogsYoy),
    ];
    let top3Block = '';
    top3.forEach((r, i) => {
      const share = k.current.cogs > 0 ? (r.net_cost / k.current.cogs) * 100 : 0;
      top3Block += `${i + 1}. ${r.account_name} (${r.acc_no}): RM ${Math.round(r.net_cost).toLocaleString('en-MY')} (${share.toFixed(1)}% of COGS)\n`;
      allowed.push(rm(`${r.account_name} cogs amount`, Math.round(r.net_cost)));
      allowed.push(pct(`${r.account_name} share of cogs`, share));
    });

    return {
      prompt:
        `Population: COGS (acc_type = 'CO') GL postings in ${dr!.start} to ${dr!.end}.\n\n` +
        `Cost of Sales (COGS): RM ${Math.round(k.current.cogs).toLocaleString('en-MY')}\n` +
        `COGS % of total costs: ${cogsPct.toFixed(1)}%\n` +
        `Prior-year COGS: RM ${Math.round(k.previous.cogs).toLocaleString('en-MY')}\n` +
        `COGS YoY growth: ${cogsYoy.toFixed(1)}% — ${cogsYoyLabel}\n\n` +
        (top3Block ? `Top 3 COGS accounts:\n${top3Block}\n` : '') +
        `Thresholds: COGS share 60-80% Typical · > 85% margin-pressure risk\n` +
        `Business context: COGS is variable — YoY growth is acceptable if sales volume also grew. Flag COGS YoY > 15% if sales are flat or declining.`,
      allowed,
    };
  },

  async ex_opex(dr) {
    const k = await getCostKpisV2(dr!.start, dr!.end);
    const breakdown = await getOpexBreakdown(dr!.start, dr!.end);
    const total = k.current.total_costs;
    const opexPct = total > 0 ? (k.current.opex / total) * 100 : 0;
    const opexYoy = k.previous.opex !== 0
      ? ((k.current.opex - k.previous.opex) / Math.abs(k.previous.opex)) * 100
      : 0;
    const opexYoyLabel = opexYoy < 0 ? 'Healthy (OpEx down)' : opexYoy <= 10 ? 'Watch' : 'Concern (investigate structural cost changes)';

    const top3 = breakdown.slice(0, 3);
    const allowed: AllowedValue[] = [
      rm('opex', Math.round(k.current.opex)),
      rm('total costs', Math.round(total)),
      pct('opex pct of total', opexPct),
      rm('prior year opex', Math.round(k.previous.opex)),
      pct('opex yoy growth', opexYoy),
    ];
    let top3Block = '';
    top3.forEach((r, i) => {
      const share = k.current.opex > 0 ? (r.net_cost / k.current.opex) * 100 : 0;
      top3Block += `${i + 1}. ${r.account_name} (${r.acc_no}): RM ${Math.round(r.net_cost).toLocaleString('en-MY')} (${share.toFixed(1)}% of OpEx)\n`;
      allowed.push(rm(`${r.account_name} opex amount`, Math.round(r.net_cost)));
      allowed.push(pct(`${r.account_name} share of opex`, share));
    });

    return {
      prompt:
        `Population: OpEx (acc_type = 'EP') GL postings in ${dr!.start} to ${dr!.end}.\n\n` +
        `Operating Costs (OpEx): RM ${Math.round(k.current.opex).toLocaleString('en-MY')}\n` +
        `OpEx % of total costs: ${opexPct.toFixed(1)}%\n` +
        `Prior-year OpEx: RM ${Math.round(k.previous.opex).toLocaleString('en-MY')}\n` +
        `OpEx YoY growth: ${opexYoy.toFixed(1)}% — ${opexYoyLabel}\n\n` +
        (top3Block ? `Top 3 OpEx accounts:\n${top3Block}\n` : '') +
        `Thresholds: OpEx YoY > 10% Concern (semi-fixed; should grow slower than revenue)\n` +
        `Business context: OpEx is semi-fixed and scales only with structural decisions (headcount, rent, tooling). Unexplained OpEx jumps warrant investigation.`,
      allowed,
    };
  },

  async ex_yoy_costs(dr) {
    const k = await getCostKpisV2(dr!.start, dr!.end);
    const totalYoy = k.yoy_pct ?? 0;
    const cogsYoy = k.previous.cogs !== 0
      ? ((k.current.cogs - k.previous.cogs) / Math.abs(k.previous.cogs)) * 100
      : 0;
    const opexYoy = k.previous.opex !== 0
      ? ((k.current.opex - k.previous.opex) / Math.abs(k.previous.opex)) * 100
      : 0;
    const band = k.yoy_pct == null
      ? 'No prior-year data'
      : totalYoy < 0 ? 'Green (Healthy — costs falling)'
      : totalYoy <= 5 ? 'Amber (Watch)'
      : totalYoy <= 10 ? 'Red (Concern)'
      : 'Severe (costs outpacing typical inflation)';

    return {
      prompt:
        `Population: expense GL postings in ${dr!.start} to ${dr!.end} vs same period prior year.\n\n` +
        `Current-period total costs: RM ${Math.round(k.current.total_costs).toLocaleString('en-MY')}\n` +
        `Prior-period total costs: RM ${Math.round(k.previous.total_costs).toLocaleString('en-MY')}\n` +
        `YoY total-cost growth: ${totalYoy.toFixed(1)}% — ${band}\n\n` +
        `Cost-type breakdown of YoY:\n` +
        `- COGS: RM ${Math.round(k.current.cogs).toLocaleString('en-MY')} vs RM ${Math.round(k.previous.cogs).toLocaleString('en-MY')} (YoY ${cogsYoy.toFixed(1)}%)\n` +
        `- OpEx: RM ${Math.round(k.current.opex).toLocaleString('en-MY')} vs RM ${Math.round(k.previous.opex).toLocaleString('en-MY')} (YoY ${opexYoy.toFixed(1)}%)\n\n` +
        `Thresholds: < 0% Healthy · 0-5% Watch · 5-10% Concern · > 10% Severe\n` +
        `Business context: OpEx YoY > 10% is the more worrying signal because OpEx is semi-fixed. COGS YoY growth is acceptable if sales volume grew proportionally.`,
      allowed: [
        rm('current total costs', Math.round(k.current.total_costs)),
        rm('prior total costs', Math.round(k.previous.total_costs)),
        pct('yoy total cost growth', totalYoy),
        rm('current cogs', Math.round(k.current.cogs)),
        rm('prior cogs', Math.round(k.previous.cogs)),
        pct('cogs yoy growth', cogsYoy),
        rm('current opex', Math.round(k.current.opex)),
        rm('prior opex', Math.round(k.previous.opex)),
        pct('opex yoy growth', opexYoy),
      ],
    };
  },

  async ex_cost_trend(dr) {
    const trend = await getCostTrendV2(dr!.start, dr!.end);
    if (trend.current.length === 0) {
      return { prompt: 'No monthly cost trend data for selected period.', allowed: [] };
    }
    const allowed: AllowedValue[] = [];
    let table =
      '| Month | COGS | OpEx | Total |\n' +
      '|-------|------|------|-------|\n';
    let peak = { month: trend.current[0].month, total: 0 };
    let low = { month: trend.current[0].month, total: Number.POSITIVE_INFINITY };
    for (const r of trend.current) {
      const total = r.cogs + r.opex;
      table +=
        `| ${r.month} ` +
        `| RM ${Math.round(r.cogs).toLocaleString('en-MY')} ` +
        `| RM ${Math.round(r.opex).toLocaleString('en-MY')} ` +
        `| RM ${Math.round(total).toLocaleString('en-MY')} |\n`;
      allowed.push(rm(`${r.month} cogs`, Math.round(r.cogs)));
      allowed.push(rm(`${r.month} opex`, Math.round(r.opex)));
      allowed.push(rm(`${r.month} total`, Math.round(total)));
      if (total > peak.total) peak = { month: r.month, total };
      if (total < low.total) low = { month: r.month, total };
    }
    const first = trend.current[0];
    const last = trend.current[trend.current.length - 1];
    const firstTotal = first.cogs + first.opex;
    const lastTotal = last.cogs + last.opex;
    const momGrowth = firstTotal > 0 ? ((lastTotal - firstTotal) / firstTotal) * 100 : 0;

    const priorTotal = trend.previous.reduce((s, r) => s + r.cogs + r.opex, 0);
    const currTotal = trend.current.reduce((s, r) => s + r.cogs + r.opex, 0);
    const periodYoy = priorTotal > 0 ? ((currTotal - priorTotal) / priorTotal) * 100 : 0;

    allowed.push(cnt('months in period', trend.current.length));
    allowed.push(rm('peak month total', Math.round(peak.total)));
    allowed.push(rm('lowest month total', Math.round(low.total)));
    allowed.push(pct('mom growth first to last month', momGrowth));
    allowed.push(rm('current period total', Math.round(currTotal)));
    allowed.push(rm('prior period total', Math.round(priorTotal)));
    allowed.push(pct('period yoy growth', periodYoy));

    const preCalc =
      `Population: months with expense activity between ${dr!.start} and ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Months in period: ${trend.current.length}\n` +
      `- Peak total-cost month: ${peak.month} at RM ${Math.round(peak.total).toLocaleString('en-MY')}\n` +
      `- Lowest total-cost month: ${low.month} at RM ${Math.round(low.total).toLocaleString('en-MY')}\n` +
      `- MoM cost growth (first month → last month): ${momGrowth.toFixed(1)}%\n` +
      `- Current-period total: RM ${Math.round(currTotal).toLocaleString('en-MY')}\n` +
      `- Prior-year same-period total: RM ${Math.round(priorTotal).toLocaleString('en-MY')}\n` +
      `- Period YoY growth: ${periodYoy.toFixed(1)}%\n\n` +
      `Thresholds (MoM first-to-last): > 15% Concern · > 25% Severe\n\n`;

    return {
      prompt: `${preCalc}Monthly cost trend:\n${table}`,
      allowed,
    };
  },

  async ex_cost_composition(dr) {
    const comp = await getCostCompositionV2(dr!.start, dr!.end);
    const k = await getCostKpisV2(dr!.start, dr!.end);

    const cogs = comp.find(c => c.type === 'CO')?.amount ?? k.current.cogs;
    const opex = comp.find(c => c.type === 'EP')?.amount ?? k.current.opex;
    const total = cogs + opex;
    const cogsPct = total > 0 ? (cogs / total) * 100 : 0;
    const opexPct = total > 0 ? (opex / total) * 100 : 0;

    const priorTotal = k.previous.cogs + k.previous.opex;
    const priorCogsPct = priorTotal > 0 ? (k.previous.cogs / priorTotal) * 100 : 0;
    const priorOpexPct = priorTotal > 0 ? (k.previous.opex / priorTotal) * 100 : 0;
    const cogsDrift = cogsPct - priorCogsPct;

    const mixLabel =
      cogsPct >= 85 ? 'COGS-dominated (margin-pressure risk)' :
      cogsPct < 50 ? 'OpEx-dominated (scaling inefficiency risk)' :
      cogsPct >= 60 && cogsPct <= 80 ? 'Typical fruit-distribution mix' :
      'Mixed';

    const preCalc =
      `Population: expense GL postings in ${dr!.start} to ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total cost: RM ${Math.round(total).toLocaleString('en-MY')}\n` +
      `- COGS: RM ${Math.round(cogs).toLocaleString('en-MY')} (${cogsPct.toFixed(1)}% of total)\n` +
      `- OpEx: RM ${Math.round(opex).toLocaleString('en-MY')} (${opexPct.toFixed(1)}% of total)\n` +
      `- Mix classification: ${mixLabel}\n` +
      `- Prior-year composition: COGS ${priorCogsPct.toFixed(1)}% · OpEx ${priorOpexPct.toFixed(1)}%\n` +
      `- COGS share drift (pp, current − prior): ${cogsDrift.toFixed(1)} pp\n\n` +
      `Thresholds: 60-80% COGS = Typical · > 85% COGS-dominated · < 50% OpEx-dominated\n` +
      `Business context: A rising COGS share (positive drift) combined with flat sales indicates margin compression. A falling COGS share (negative drift) can mean either margin improvement OR under-investment in inventory.`;

    return {
      prompt: preCalc,
      allowed: [
        rm('total cost', Math.round(total)),
        rm('cogs', Math.round(cogs)),
        pct('cogs pct of total', cogsPct),
        rm('opex', Math.round(opex)),
        pct('opex pct of total', opexPct),
        pct('prior cogs pct', priorCogsPct),
        pct('prior opex pct', priorOpexPct),
        pct('cogs share drift pp', cogsDrift),
      ],
    };
  },

  async ex_top_expenses(dr) {
    const rows = await getTopExpensesByType(dr!.start, dr!.end, 'all', 'desc');
    const k = await getCostKpisV2(dr!.start, dr!.end);
    const total = k.current.total_costs;

    if (rows.length === 0) {
      return { prompt: 'No expense rows for selected period.', allowed: [] };
    }

    const allowed: AllowedValue[] = [rm('total costs', Math.round(total))];
    let table =
      '| # | Account | Acc No | Cost Type | Net Cost | % of Total |\n' +
      '|---|---------|--------|-----------|----------|------------|\n';
    rows.slice(0, 10).forEach((r, i) => {
      const share = total > 0 ? (Math.abs(r.net_cost) / total) * 100 : 0;
      table +=
        `| ${i + 1} | ${r.account_name} | ${r.acc_no} | ${r.cost_type} ` +
        `| RM ${Math.round(r.net_cost).toLocaleString('en-MY')} | ${share.toFixed(1)}% |\n`;
      allowed.push(rm(`${r.account_name} net cost`, Math.round(r.net_cost)));
      allowed.push(pct(`${r.account_name} share of total`, share));
    });

    const top1Share = total > 0 ? (Math.abs(rows[0].net_cost) / total) * 100 : 0;
    const top10Sum = rows.slice(0, 10).reduce((s, r) => s + Math.abs(r.net_cost), 0);
    const top10Share = total > 0 ? (top10Sum / total) * 100 : 0;
    const cogsInTop10 = rows.slice(0, 10).filter(r => r.cost_type === 'COGS').length;
    const opexInTop10 = rows.slice(0, 10).filter(r => r.cost_type === 'OPEX').length;

    const concentrationLabel =
      top1Share > 30 ? 'Severe (single-account risk)' :
      top1Share > 15 ? 'Concentrated' :
      top10Share > 75 ? 'Concentrated (top 10 > 75%)' :
      top10Share < 50 ? 'Diversified' :
      'Moderate';

    allowed.push(pct('top 1 account share', top1Share));
    allowed.push(pct('top 10 account share', top10Share));
    allowed.push(rm('top 10 sum', Math.round(top10Sum)));
    allowed.push(cnt('cogs accounts in top 10', cogsInTop10));
    allowed.push(cnt('opex accounts in top 10', opexInTop10));

    const preCalc =
      `Population: GL accounts with expense postings between ${dr!.start} and ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total costs: RM ${Math.round(total).toLocaleString('en-MY')}\n` +
      `- Top 1 account share: ${top1Share.toFixed(1)}%\n` +
      `- Top 10 accounts share: ${top10Share.toFixed(1)}% (sum RM ${Math.round(top10Sum).toLocaleString('en-MY')})\n` +
      `- Concentration: ${concentrationLabel}\n` +
      `- Mix in top 10: ${cogsInTop10} COGS · ${opexInTop10} OpEx\n\n` +
      `Thresholds: Top 1 > 30% Severe · 15-30% Concentrated · < 15% Diversified · Top 10 > 75% Concentrated · < 50% Diversified\n\n`;

    return {
      prompt: preCalc + 'Top 10 expense accounts (all cost types, descending):\n' + table,
      allowed,
    };
  },

  async ex_cogs_table(dr) {
    const rows = await getCogsBreakdown(dr!.start, dr!.end);
    if (rows.length === 0) {
      return { prompt: `No COGS (acc_type = 'CO') postings in ${dr!.start} to ${dr!.end}.`, allowed: [] };
    }

    const total = rows.reduce((s, r) => s + r.net_cost, 0);
    const positive = rows.filter(r => r.net_cost > 0);
    const negatives = rows.filter(r => r.net_cost < 0);
    const sorted = [...positive].sort((a, b) => b.net_cost - a.net_cost);

    const top1 = sorted[0];
    const top1Share = total > 0 ? (top1.net_cost / total) * 100 : 0;
    const top3Sum = sorted.slice(0, 3).reduce((s, r) => s + r.net_cost, 0);
    const top3Share = total > 0 ? (top3Sum / total) * 100 : 0;
    const top10Sum = sorted.slice(0, 10).reduce((s, r) => s + r.net_cost, 0);
    const top10Share = total > 0 ? (top10Sum / total) * 100 : 0;

    const top1Label =
      top1Share > 50 ? 'Severe (single-account exposure)' :
      top1Share >= 30 ? 'Concentrated (dominant-fruit sourcing)' :
      top1Share < 15 ? 'Diversified' :
      'Moderate';
    const top3Label =
      top3Share > 80 ? 'Concentrated top 3' :
      top3Share < 55 ? 'Diversified top 3' :
      'Moderate top 3';
    const surfaceLabel = positive.length < 5 ? 'Thin COGS surface (< 5 accounts)' : `${positive.length} active COGS accounts`;

    const allowed: AllowedValue[] = [
      rm('total cogs', Math.round(total)),
      cnt('cogs account count', positive.length),
      pct('top 1 cogs share', top1Share),
      pct('top 3 cogs share', top3Share),
      pct('top 10 cogs share', top10Share),
      rm('top 3 cogs sum', Math.round(top3Sum)),
      rm('top 10 cogs sum', Math.round(top10Sum)),
    ];

    let table =
      '| # | Account | Acc No | Net Cost | % of COGS |\n' +
      '|---|---------|--------|----------|-----------|\n';
    sorted.slice(0, 10).forEach((r, i) => {
      const share = total > 0 ? (r.net_cost / total) * 100 : 0;
      table +=
        `| ${i + 1} | ${r.account_name} | ${r.acc_no} ` +
        `| RM ${Math.round(r.net_cost).toLocaleString('en-MY')} | ${share.toFixed(1)}% |\n`;
      allowed.push(rm(`${r.account_name} net cost`, Math.round(r.net_cost)));
      allowed.push(pct(`${r.account_name} share of cogs`, share));
    });

    let negBlock = '';
    if (negatives.length > 0) {
      negBlock = `\nNegative-value COGS accounts (likely credit notes / reversals — flag these):\n`;
      negatives.forEach(r => {
        negBlock += `- ${r.account_name} (${r.acc_no}): RM ${Math.round(r.net_cost).toLocaleString('en-MY')}\n`;
        allowed.push(rm(`${r.account_name} negative cogs`, Math.round(r.net_cost)));
      });
    }

    const preCalc =
      `Population: GL accounts with acc_type = 'CO' (Cost of Sales) postings between ${dr!.start} and ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total COGS: RM ${Math.round(total).toLocaleString('en-MY')}\n` +
      `- Active COGS accounts: ${positive.length} — ${surfaceLabel}\n` +
      `- Top 1 account share: ${top1Share.toFixed(1)}% — ${top1Label}\n` +
      `- Top 3 accounts share: ${top3Share.toFixed(1)}% (sum RM ${Math.round(top3Sum).toLocaleString('en-MY')}) — ${top3Label}\n` +
      `- Top 10 accounts share: ${top10Share.toFixed(1)}% (sum RM ${Math.round(top10Sum).toLocaleString('en-MY')})\n` +
      `- Negative-value accounts: ${negatives.length}\n\n` +
      `Thresholds:\n` +
      `- Top 1 > 50% = Severe · 30-50% = Concentrated · < 15% = Diversified\n` +
      `- Top 3 > 80% = Concentrated · < 55% = Diversified\n` +
      `- Account count < 5 = Thin COGS surface\n` +
      `- Any negative net_cost account = Flag (credit note / reversal)\n\n`;

    return {
      prompt: preCalc + 'Top 10 COGS accounts (descending):\n' + table + negBlock,
      allowed,
    };
  },

  async ex_opex_table(dr) {
    const rows = await getOpexBreakdown(dr!.start, dr!.end);
    if (rows.length === 0) {
      return { prompt: `No OpEx (acc_type = 'EP') postings in ${dr!.start} to ${dr!.end}.`, allowed: [] };
    }

    const total = rows.reduce((s, r) => s + r.net_cost, 0);
    const positive = rows.filter(r => r.net_cost > 0);
    const negatives = rows.filter(r => r.net_cost < 0);

    // Category subtotals
    const catMap = new Map<string, { subtotal: number; accountCount: number }>();
    for (const r of rows) {
      const entry = catMap.get(r.category) ?? { subtotal: 0, accountCount: 0 };
      entry.subtotal += r.net_cost;
      entry.accountCount += 1;
      catMap.set(r.category, entry);
    }
    const categories = [...catMap.entries()]
      .map(([name, v]) => ({ name, subtotal: v.subtotal, accountCount: v.accountCount }))
      .sort((a, b) => b.subtotal - a.subtotal);

    const topCat = categories[0];
    const topCatShare = total > 0 ? (topCat.subtotal / total) * 100 : 0;
    const topCatLabel =
      topCatShare > 50 ? 'Dominant category (one cost center carries the base)' :
      topCatShare >= 30 ? 'Typical dominance (usually staff or rent)' :
      topCatShare < 20 ? 'Diversified across categories' :
      'Moderate';

    // Top 10 accounts across all categories
    const sortedAccounts = [...positive].sort((a, b) => b.net_cost - a.net_cost);
    const top1Acct = sortedAccounts[0];
    const top1AcctShare = total > 0 ? (top1Acct.net_cost / total) * 100 : 0;
    const top3AcctSum = sortedAccounts.slice(0, 3).reduce((s, r) => s + r.net_cost, 0);
    const top3AcctShare = total > 0 ? (top3AcctSum / total) * 100 : 0;
    const acctLabel =
      top1AcctShare > 20 ? 'Single-account risk (name it)' :
      top3AcctShare > 50 ? 'Concentrated top 3 accounts' :
      'Spread across accounts';

    const singletonCats = categories.filter(c => c.accountCount === 1);

    const allowed: AllowedValue[] = [
      rm('total opex', Math.round(total)),
      cnt('opex account count', positive.length),
      cnt('opex category count', categories.length),
      pct('top category share', topCatShare),
      pct('top 1 opex account share', top1AcctShare),
      pct('top 3 opex account share', top3AcctShare),
    ];

    let catTable =
      '| Category | Accounts | Subtotal | % of OpEx |\n' +
      '|----------|----------|----------|-----------|\n';
    categories.forEach(c => {
      const share = total > 0 ? (c.subtotal / total) * 100 : 0;
      catTable +=
        `| ${c.name} | ${c.accountCount} ` +
        `| RM ${Math.round(c.subtotal).toLocaleString('en-MY')} | ${share.toFixed(1)}% |\n`;
      allowed.push(rm(`${c.name} subtotal`, Math.round(c.subtotal)));
      allowed.push(pct(`${c.name} share of opex`, share));
    });

    let acctTable =
      '| # | Category | Account | Acc No | Net Cost | % of OpEx |\n' +
      '|---|----------|---------|--------|----------|-----------|\n';
    sortedAccounts.slice(0, 10).forEach((r, i) => {
      const share = total > 0 ? (r.net_cost / total) * 100 : 0;
      acctTable +=
        `| ${i + 1} | ${r.category} | ${r.account_name} | ${r.acc_no} ` +
        `| RM ${Math.round(r.net_cost).toLocaleString('en-MY')} | ${share.toFixed(1)}% |\n`;
      allowed.push(rm(`${r.account_name} opex net cost`, Math.round(r.net_cost)));
      allowed.push(pct(`${r.account_name} share of opex`, share));
    });

    let flagsBlock = '';
    if (singletonCats.length > 0) {
      flagsBlock += `\nCategories with only 1 account (possible misclassification or sparse data):\n`;
      singletonCats.forEach(c => {
        flagsBlock += `- ${c.name}\n`;
      });
    }
    if (negatives.length > 0) {
      flagsBlock += `\nNegative-value OpEx accounts (likely reversals — flag these):\n`;
      negatives.forEach(r => {
        flagsBlock += `- ${r.account_name} (${r.acc_no}) [${r.category}]: RM ${Math.round(r.net_cost).toLocaleString('en-MY')}\n`;
        allowed.push(rm(`${r.account_name} negative opex`, Math.round(r.net_cost)));
      });
    }

    const preCalc =
      `Population: GL accounts with acc_type = 'EP' (Operating Costs) postings between ${dr!.start} and ${dr!.end}.\n\n` +
      `Pre-calculated roll-ups (use these values directly — do not recompute):\n` +
      `- Total OpEx: RM ${Math.round(total).toLocaleString('en-MY')}\n` +
      `- Active OpEx accounts: ${positive.length}\n` +
      `- Active categories: ${categories.length}\n` +
      `- Top category: ${topCat.name} at ${topCatShare.toFixed(1)}% — ${topCatLabel}\n` +
      `- Top 1 account share: ${top1AcctShare.toFixed(1)}% (${top1Acct.account_name}) — ${acctLabel}\n` +
      `- Top 3 accounts share: ${top3AcctShare.toFixed(1)}%\n` +
      `- Singleton categories: ${singletonCats.length}\n` +
      `- Negative-value accounts: ${negatives.length}\n\n` +
      `Thresholds:\n` +
      `- Top 1 category > 50% = Dominant · 30-50% = Typical · < 20% = Diversified\n` +
      `- Top 1 account > 20% of OpEx = Single-account risk\n` +
      `- Top 3 accounts > 50% = Concentrated\n` +
      `- Category with only 1 account = Flag\n` +
      `- Any negative net_cost account = Flag\n\n`;

    return {
      prompt:
        preCalc +
        'OpEx by category:\n' + catTable +
        '\nTop 10 OpEx accounts across all categories (descending):\n' + acctTable +
        flagsBlock,
      allowed,
    };
  },
};

// ─── Scope classification ────────────────────────────────────────────────────

type ScopeType = 'period' | 'snapshot';

const SECTION_SCOPE: Record<SectionKey, ScopeType> = {
  payment_collection_trend: 'period',
  payment_outstanding: 'snapshot',
  sales_trend: 'period',
  sales_breakdown: 'period',
  customer_margin_overview: 'period',
  customer_margin_breakdown: 'period',
  supplier_margin_overview: 'period',
  supplier_margin_breakdown: 'period',
  return_trend: 'period',
  return_unsettled: 'snapshot',
  expense_overview: 'period',
  expense_breakdown: 'period',
};

// Per-section snapshot source: each snapshot section anchors its "as of" date on a different table.
const SNAPSHOT_SOURCE_TABLE: Partial<Record<SectionKey, string>> = {
  payment_outstanding: 'pc_ar_customer_snapshot',
  return_unsettled: 'pc_return_aging',
};

async function buildScopeLabel(
  scope: ScopeType,
  dateRange: DateRange | null,
  sectionKey: SectionKey,
): Promise<string> {
  if (scope === 'period') {
    if (!dateRange) return 'Scope: Period-based metric (no date range provided).';
    return `Scope: PERIOD-BASED metric — filtered to ${dateRange.start} through ${dateRange.end}. All figures reflect activity WITHIN this date range only. Do NOT describe these numbers as "outstanding balance" or "total receivables" — they are period flows, not point-in-time balances.`;
  }
  const table = SNAPSHOT_SOURCE_TABLE[sectionKey];
  if (!table) {
    return 'Scope: SNAPSHOT metric — current state. Point-in-time balances, not filtered by date range.';
  }
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT MAX(snapshot_date) AS d FROM ${table}`);
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
): Promise<FetcherResult> {
  const fetcher = fetchers[componentKey];
  if (!fetcher) {
    return { prompt: `No data fetcher defined for component: ${componentKey}`, allowed: [] };
  }

  try {
    const { prompt, allowed } = await fetcher(dateRange);
    const scopeLabel = await buildScopeLabel(SECTION_SCOPE[sectionKey], dateRange, sectionKey);
    return { prompt: `${scopeLabel}\n\n${prompt}`, allowed };
  } catch (err) {
    console.error(`Data fetch error for ${componentKey}:`, err);
    return {
      prompt: `Error fetching data: ${err instanceof Error ? err.message : String(err)}`,
      allowed: [],
    };
  }
}
