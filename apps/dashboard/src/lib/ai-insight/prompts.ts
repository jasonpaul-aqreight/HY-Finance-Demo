import type { SectionKey } from './types';
import {
  getGlobalSystemPrompt as loaderGlobalSystemPrompt,
  getSummarySystemPrompt as loaderSummarySystemPrompt,
  getComponentPrompt,
} from './prompt-loader';


// ─── Section → Component mapping ─────────────────────────────────────────────

export const SECTION_COMPONENTS: Record<SectionKey, { key: string; name: string; type: 'kpi' | 'chart' | 'table' | 'breakdown' }[]> = {
  payment_collection_trend: [
    { key: 'avg_collection_days', name: 'Avg Collection Days', type: 'kpi' },
    { key: 'collection_rate', name: 'Collection Rate', type: 'kpi' },
    { key: 'avg_monthly_collection', name: 'Avg Monthly Collection', type: 'kpi' },
    { key: 'collection_days_trend', name: 'Avg Collection Days Trend', type: 'chart' },
    { key: 'invoiced_vs_collected', name: 'Invoiced vs Collected', type: 'chart' },
  ],
  payment_outstanding: [
    { key: 'total_outstanding', name: 'Total Outstanding', type: 'kpi' },
    { key: 'overdue_amount', name: 'Overdue Amount', type: 'kpi' },
    { key: 'credit_limit_breaches', name: 'Credit Limit Breaches', type: 'kpi' },
    { key: 'aging_analysis', name: 'Aging Analysis', type: 'chart' },
    { key: 'credit_usage_distribution', name: 'Credit Usage Distribution', type: 'chart' },
    { key: 'customer_credit_health', name: 'Customer Credit Health', type: 'table' },
  ],
  sales_trend: [
    { key: 'net_sales', name: 'Net Sales', type: 'kpi' },
    { key: 'invoice_sales', name: 'Invoice Sales', type: 'kpi' },
    { key: 'cash_sales', name: 'Cash Sales', type: 'kpi' },
    { key: 'credit_notes', name: 'Credit Notes', type: 'kpi' },
    { key: 'net_sales_trend', name: 'Net Sales Trend', type: 'chart' },
  ],
  sales_breakdown: [
    { key: 'by_customer', name: 'By Customer', type: 'breakdown' },
    { key: 'by_product', name: 'By Product', type: 'breakdown' },
    { key: 'by_agent', name: 'By Sales Agent', type: 'breakdown' },
    { key: 'by_outlet', name: 'By Outlet', type: 'breakdown' },
  ],
  customer_margin_overview: [
    { key: 'cm_net_sales',           name: 'Net Sales',           type: 'kpi' },
    { key: 'cm_cogs',                name: 'COGS',                type: 'kpi' },
    { key: 'cm_gross_profit',        name: 'Gross Profit',        type: 'kpi' },
    { key: 'cm_margin_pct',          name: 'Margin %',            type: 'kpi' },
    { key: 'cm_active_customers',    name: 'Active Customers',    type: 'kpi' },
    { key: 'cm_margin_trend',        name: 'Margin Trend',        type: 'chart' },
    { key: 'cm_margin_distribution', name: 'Margin Distribution', type: 'chart' },
  ],
  customer_margin_breakdown: [
    { key: 'cm_top_customers',      name: 'Top Customers',         type: 'chart' },
    { key: 'cm_customer_table',     name: 'Customer Margin Table', type: 'table' },
    { key: 'cm_credit_note_impact', name: 'Credit Note Impact',    type: 'table' },
  ],
  supplier_margin_overview: [
    { key: 'sp_net_sales',           name: 'Est. Net Sales',       type: 'kpi' },
    { key: 'sp_cogs',                name: 'Est. Cost of Sales',   type: 'kpi' },
    { key: 'sp_gross_profit',        name: 'Est. Gross Profit',    type: 'kpi' },
    { key: 'sp_margin_pct',          name: 'Gross Margin %',       type: 'kpi' },
    { key: 'sp_active_suppliers',    name: 'Active Suppliers',     type: 'kpi' },
    { key: 'sp_margin_trend',        name: 'Profitability Trend',  type: 'chart' },
    { key: 'sp_margin_distribution', name: 'Margin Distribution',  type: 'chart' },
  ],
  supplier_margin_breakdown: [
    { key: 'sm_top_bottom',     name: 'Top/Bottom Suppliers & Items', type: 'chart' },
    { key: 'sm_supplier_table', name: 'Supplier Analysis Table',      type: 'table' },
    { key: 'sm_item_pricing',   name: 'Item Price Comparison',        type: 'breakdown' },
    { key: 'sm_price_scatter',  name: 'Purchase vs Selling Price',    type: 'chart' },
  ],
  return_trend: [
    { key: 'rt_total_returns',        name: 'Total Returns',        type: 'kpi' },
    { key: 'rt_settled',              name: 'Settled',              type: 'kpi' },
    { key: 'rt_unsettled',            name: 'Unsettled',            type: 'kpi' },
    { key: 'rt_return_pct',           name: 'Return %',             type: 'kpi' },
    { key: 'rt_settlement_breakdown', name: 'Settlement Breakdown', type: 'chart' },
    { key: 'rt_monthly_trend',        name: 'Monthly Return Trend', type: 'chart' },
    { key: 'rt_product_bar',          name: 'Top Returns by Item',  type: 'chart' },
  ],
  return_unsettled: [
    { key: 'ru_aging_chart',   name: 'Aging of Unsettled Returns', type: 'chart' },
    { key: 'ru_debtors_table', name: 'Customer Returns',            type: 'table' },
  ],
  expense_overview: [
    { key: 'ex_total_costs',       name: 'Total Costs',      type: 'kpi' },
    { key: 'ex_cogs',              name: 'Cost of Sales',    type: 'kpi' },
    { key: 'ex_opex',              name: 'Operating Costs',  type: 'kpi' },
    { key: 'ex_yoy_costs',         name: 'vs Last Year',     type: 'kpi' },
    { key: 'ex_cost_trend',        name: 'Cost Trend',       type: 'chart' },
    { key: 'ex_cost_composition',  name: 'Cost Composition', type: 'chart' },
    { key: 'ex_top_expenses',      name: 'Top Expenses',     type: 'chart' },
  ],
  expense_breakdown: [
    { key: 'ex_cogs_table', name: 'Cost of Sales Breakdown', type: 'table' },
    { key: 'ex_opex_table', name: 'Operating Costs Breakdown', type: 'table' },
  ],
  financial_overview: [
    { key: 'fin_pnl_summary',     name: 'P&L Summary',       type: 'kpi' },
    { key: 'fin_monthly_trend',    name: 'Monthly P&L Trend', type: 'chart' },
  ],
  financial_pnl: [
    { key: 'fin_pl_statement',   name: 'Profit & Loss Statement', type: 'table' },
    { key: 'fin_yoy_comparison', name: 'Multi-Year Comparison',   type: 'table' },
  ],
  financial_balance_sheet: [
    { key: 'bs_trend',     name: 'Assets, Liabilities & Equity Trend', type: 'chart' },
    { key: 'bs_statement', name: 'Balance Sheet Statement',            type: 'table' },
  ],
  financial_variance: [
    { key: 'fv_variance_summary',   name: 'P&L Variance Summary',  type: 'kpi' },
    { key: 'fv_variance_breakdown', name: 'Variance by Account',    type: 'table' },
    { key: 'fv_trend_forecast',     name: 'Trend Forecast',         type: 'kpi' },
    { key: 'fv_budget_suggestions', name: 'AI Budget Suggestions',  type: 'kpi' },
  ],
  // HR scaffold (Phase 2). Component prompts will be added when HR is properly
  // implemented — for now only the section guidance row gets seeded.
  employee_demographics: [],
  attendance_leave: [],
  overtime_work_hours: [],
  payroll_compensation: [],
  performance_talent: [],
};

export const SECTION_PAGE: Record<SectionKey, string> = {
  payment_collection_trend: 'Payment',
  payment_outstanding: 'Payment',
  sales_trend: 'Sales',
  sales_breakdown: 'Sales',
  customer_margin_overview: 'Customer Margin',
  customer_margin_breakdown: 'Customer Margin',
  supplier_margin_overview: 'Supplier Performance',
  supplier_margin_breakdown: 'Supplier Performance',
  return_trend: 'Returns',
  return_unsettled: 'Returns',
  expense_overview: 'Expenses',
  expense_breakdown: 'Expenses',
  financial_overview: 'Financial',
  financial_pnl: 'Financial',
  financial_balance_sheet: 'Financial',
  financial_variance: 'Financial',
  employee_demographics: 'hr',
  attendance_leave: 'hr',
  overtime_work_hours: 'hr',
  payroll_compensation: 'hr',
  performance_talent: 'hr',
};

export const SECTION_NAMES: Record<SectionKey, string> = {
  payment_collection_trend: 'Payment Collection Trend',
  payment_outstanding: 'Outstanding Payment',
  sales_trend: 'Sales Trend',
  sales_breakdown: 'Sales Breakdown',
  customer_margin_overview: 'Customer Margin Overview',
  customer_margin_breakdown: 'Customer Margin Breakdown',
  supplier_margin_overview: 'Supplier Margin Overview',
  supplier_margin_breakdown: 'Supplier Margin Breakdown',
  return_trend: 'Return Trends',
  return_unsettled: 'Unsettled Returns',
  expense_overview: 'Expense Overview',
  expense_breakdown: 'Expense Breakdown',
  financial_overview: 'Financial Overview',
  financial_pnl: 'Profit & Loss Detail',
  financial_balance_sheet: 'Balance Sheet',
  financial_variance: 'Variance, Forecast & Budget',
  employee_demographics: 'Employee Demographics & Movement',
  attendance_leave: 'Attendance & Leave Monitoring',
  overtime_work_hours: 'Overtime & Work Hours',
  payroll_compensation: 'Payroll & Compensation',
  performance_talent: 'Performance & Talent Management',
};

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getGlobalSystemPrompt(): Promise<string> {
  return loaderGlobalSystemPrompt();
}

export async function getSummarySystemPrompt(): Promise<string> {
  return loaderSummarySystemPrompt();
}

export async function buildSummaryUserPrompt(params: {
  sectionKey: SectionKey;
  dateRange: { start: string; end: string } | null;
  fiscalPeriod?: { fiscalYear: string; range: 'fy' | 'last12' | 'ytd' } | null;
  componentResults: { key: string; name: string; type: string; rawData: string }[];
}): Promise<string> {
  const sectionName = SECTION_NAMES[params.sectionKey];
  const pageName = SECTION_PAGE[params.sectionKey];

  const dateInfo = params.dateRange
    ? `Date Range: ${params.dateRange.start} to ${params.dateRange.end}`
    : params.fiscalPeriod
      ? `Fiscal Period: ${params.fiscalPeriod.fiscalYear} (${params.fiscalPeriod.range})`
      : `Scope: Snapshot — current state`;

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // Per-component blocks: About (the component prompt — describes the card and
  // is authoritative on good/neutral/bad thresholds for this metric) + Raw
  // Data (live values). About is loaded from the code-backed runtime prompt
  // source, so component and summary analysis receive identical guidance.
  const componentBlocks = await Promise.all(
    params.componentResults.map(async (c, i) => {
      const about = await getComponentPrompt(c.key);
      return `### Component ${i + 1}: ${c.name} (${c.type})

About:
"""
${about}
"""

Raw Data:
${c.rawData}`;
    }),
  );
  const components = componentBlocks.join('\n\n');

  return `Section: ${sectionName}
Page: ${pageName}
${dateInfo}
Generated: ${now}

---

Tool budget for this run: at most 2 tool calls. Use the RAW DATA first; call a
tool only when a specific driver is not already named in the raw data blocks.

${components}

---

Produce the summary now using the ===INSIGHT=== delimiter format.`;
}

export async function buildComponentUserPrompt(params: {
  componentKey: string;
  sectionKey: SectionKey;
  componentName: string;
  componentType: string;
  dateRange: { start: string; end: string } | null;
  fiscalPeriod?: { fiscalYear: string; range: 'fy' | 'last12' | 'ytd' } | null;
  formattedValues: string;
}): Promise<string> {
  const componentPrompt = await getComponentPrompt(params.componentKey);

  const sectionName = SECTION_NAMES[params.sectionKey];
  const pageName = SECTION_PAGE[params.sectionKey];
  const dateInfo = params.dateRange
    ? `Date Range: ${params.dateRange.start} to ${params.dateRange.end}`
    : params.fiscalPeriod
      ? `Fiscal Period: ${params.fiscalPeriod.fiscalYear} (${params.fiscalPeriod.range})`
      : `Scope: Snapshot — current state`;

  return `${componentPrompt}

Page: ${pageName}
Section: ${sectionName}
Component: ${params.componentName} (${params.componentType})
${dateInfo}

Current Values:
${params.formattedValues}`;
}
