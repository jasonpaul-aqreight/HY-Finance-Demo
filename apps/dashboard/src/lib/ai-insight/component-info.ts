/**
 * Static info for each component — shown in the Component Insight Dialog.
 * Maps component_key → { name, whatItMeasures, formula, indicator }
 */

export interface ComponentInfo {
  name: string;
  whatItMeasures: string;
  formula?: string;
  indicator?: string;
}

export const COMPONENT_INFO: Record<string, ComponentInfo> = {
  // ═══ Payment Collection Trend ═══
  avg_collection_days: {
    name: 'Avg Collection Days',
    whatItMeasures: 'The average number of days it takes to collect payment after invoicing. Also known as Days Sales Outstanding (DSO).',
    formula: '(AR Outstanding at month-end ÷ Monthly Credit Sales) × Days in that month. KPI shows the average across all valid months.',
    indicator: '≤30 days = Good (green)\n≤60 days = Warning (yellow)\n>60 days = Critical (red)',
  },
  collection_rate: {
    name: 'Collection Rate',
    whatItMeasures: 'The percentage of invoiced amount that was actually collected as cash payment in the selected period.',
    formula: '(Total Collected ÷ Total Invoiced) × 100',
    indicator: '≥80% = Good (green)\n≥50% = Warning (yellow)\n<50% = Critical (red)',
  },
  avg_monthly_collection: {
    name: 'Avg Monthly Collection',
    whatItMeasures: 'The average cash collected per month across the selected date range.',
    formula: 'Total Collected ÷ Number of Months in Range',
    indicator: 'No fixed threshold. Evaluate relative to invoiced amounts and historical trend.',
  },
  collection_days_trend: {
    name: 'Avg Collection Days Trend',
    whatItMeasures: 'Monthly collection days (DSO) plotted over time with a reference line at the period average.',
    indicator: 'Rising trend = collection slowing (bad)\nFalling trend = collection improving (good)\nSpikes above 60 days = critical months',
  },
  invoiced_vs_collected: {
    name: 'Invoiced vs Collected',
    whatItMeasures: 'Monthly comparison of cash received (blue bars) versus new credit sales invoiced (red line).',
    indicator: 'Bars below line = accumulating receivables (warning)\nBars above line = clearing old receivables (good)',
  },

  // ═══ Outstanding Payment ═══
  total_outstanding: {
    name: 'Total Outstanding',
    whatItMeasures: 'The total amount currently owed by all customers — sum of all unpaid invoices from the beginning of time to now.',
    indicator: 'Snapshot metric. Evaluate in context of total invoicing volume and trend direction.',
  },
  overdue_amount: {
    name: 'Overdue Amount',
    whatItMeasures: 'The portion of total outstanding that is past its due date. Shown with the percentage of total and count of affected customers.',
    indicator: '<20% of total = Acceptable\n>40% of total = Critical',
  },
  credit_limit_breaches: {
    name: 'Credit Limit Breaches',
    whatItMeasures: 'Count of active customers whose total outstanding exceeds their assigned credit limit.',
    indicator: '0 breaches = Good (green)\n>0 breaches = Concern (red)',
  },
  aging_analysis: {
    name: 'Aging Analysis',
    whatItMeasures: 'Outstanding invoices grouped by how overdue they are across 6 aging buckets (Not Yet Due through 120+ Days).',
    indicator: 'Healthy = most value in "Not Yet Due"\nConcern = significant amounts in 61+ day buckets',
  },
  credit_usage_distribution: {
    name: 'Credit Usage Distribution',
    whatItMeasures: 'Distribution of customers by how much of their credit limit they are using (Within/Near/Over limit).',
    indicator: 'Most customers within limit = healthy\nMany near or over limit = tightening credit risk',
  },
  customer_credit_health: {
    name: 'Customer Credit Health',
    whatItMeasures: 'Detailed table of all customers showing outstanding balance, credit limit, usage percentage, overdue amount, and aging breakdown.',
  },

  // ═══ Sales Trend ═══
  net_sales: {
    name: 'Net Sales',
    whatItMeasures: 'Total net sales value — Invoice Sales + Cash Sales - Credit Notes for the selected period.',
    formula: 'Invoice Sales + Cash Sales - Credit Notes',
  },
  invoice_sales: {
    name: 'Invoice Sales',
    whatItMeasures: 'Total credit/invoice sales in the selected period.',
  },
  cash_sales: {
    name: 'Cash Sales',
    whatItMeasures: 'Total cash sales in the selected period.',
  },
  credit_notes: {
    name: 'Credit Notes',
    whatItMeasures: 'Total credit notes issued in the selected period. Credit notes reduce net sales (returns, discounts, corrections).',
    indicator: 'High credit note ratio relative to sales may indicate product quality or order accuracy issues.',
  },
  net_sales_trend: {
    name: 'Net Sales Trend',
    whatItMeasures: 'Stacked bar chart showing Invoice Sales + Cash Sales - Credit Notes by period.',
    indicator: 'Rising trend = growing sales\nFalling trend = declining sales\nLarge CN bars = return/quality issues',
  },

  // ═══ Sales Breakdown ═══
  by_customer: {
    name: 'Sales by Customer',
    whatItMeasures: 'Top customers ranked by net sales with chart and table breakdown.',
  },
  by_product: {
    name: 'Sales by Product',
    whatItMeasures: 'Top products (fruits) ranked by net sales with chart and table breakdown.',
  },
  by_agent: {
    name: 'Sales by Agent',
    whatItMeasures: 'Sales agent performance comparison including customer count and sales volume.',
  },
  by_outlet: {
    name: 'Sales by Outlet',
    whatItMeasures: 'Location-based sales breakdown showing performance by outlet.',
  },
};
