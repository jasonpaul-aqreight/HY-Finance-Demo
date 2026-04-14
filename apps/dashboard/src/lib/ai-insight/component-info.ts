/**
 * Static info for each component — shown in the Component Insight Dialog.
 * Maps component_key → { name, whatItMeasures, formula, indicator }
 */

export interface ComponentInfo {
  name: string;
  whatItMeasures: string;
  formula?: string;
  indicator?: string;
  /** Human-friendly explanation shown in the About section of the Component Insight Dialog. */
  about?: string;
}

export const COMPONENT_INFO: Record<string, ComponentInfo> = {
  // ═══ Payment Collection Trend ═══
  avg_collection_days: {
    name: 'Avg Collection Days',
    whatItMeasures: 'The average number of days it takes to collect payment after invoicing.',
    formula: '(AR Outstanding at month-end ÷ Monthly Credit Sales) × Days in that month. KPI shows the average across all valid months.',
    indicator: '≤30 days = Good (green)\n≤60 days = Warning (yellow)\n>60 days = Critical (red)',
    about: 'Average Collection Days measures how many days, on average, it takes to collect payment after making a sale. It\'s a cash flow efficiency metric.\n\nCollection Days = (Accounts Receivable / Total Invoice Sales) × Number of Days\n\n≤30 days = Good · ≤60 days = Warning · >60 days = Critical',
  },
  collection_rate: {
    name: 'Collection Rate',
    whatItMeasures: 'The percentage of invoiced amount that was actually collected as cash payment in the selected period.',
    formula: '(Total Collected ÷ Total Invoiced) × 100',
    indicator: '≥80% = Good (green)\n≥50% = Warning (yellow)\n<50% = Critical (red)',
    about: 'Collection Rate measures how much of the invoiced amount has been collected in cash payments during the selected period. A rate above 100% means you\'re collecting more than you\'re billing (clearing older debts).\n\nNote: Offsets between amounts owed and owing are not included as they are non-cash.\n\nCollection Rate = (Total Collected ÷ Total Invoiced) × 100\n\n≥80% = Good · ≥50% = Warning · <50% = Critical',
  },
  avg_monthly_collection: {
    name: 'Avg Monthly Collection',
    whatItMeasures: 'The average cash collected per month across the selected date range.',
    formula: 'Total Collected ÷ Number of Months in Range',
    indicator: 'No fixed threshold. Evaluate relative to invoiced amounts and historical trend.',
    about: 'Average Monthly Collection shows how much cash payment is received per month during the selected period. Useful for forecasting expected cash inflow.\n\nAvg Monthly Collection = Total Collected ÷ Months in Period\n\nNo fixed threshold — evaluate relative to invoiced amounts and historical trend.',
  },
  collection_days_trend: {
    name: 'Avg Collection Days Trend',
    whatItMeasures: 'Monthly collection days plotted over time with a reference line at the period average.',
    indicator: 'Rising trend = collection slowing (bad)\nFalling trend = collection improving (good)\nSpikes above 60 days = critical months',
    about: 'This line chart plots the monthly collection days over time with a dashed reference line at the period average.\n\nRising trend = collection is slowing down (bad)\nFalling trend = collection is improving (good)\nSpikes above 60 days = critical months to investigate',
  },
  invoiced_vs_collected: {
    name: 'Invoiced vs Collected',
    whatItMeasures: 'Monthly comparison of cash received (blue bars) versus new credit sales invoiced (red line).',
    indicator: 'Bars below line = accumulating receivables (warning)\nBars above line = clearing old receivables (good)',
    about: 'This chart compares the cash collected each month (blue bars) against new credit sales invoiced (red line).\n\nBars above the line = collecting more than invoicing (clearing old debt)\nBars below the line = accumulating receivables (cash flow warning)',
  },

  // ═══ Outstanding Payment ═══
  total_outstanding: {
    name: 'Total Outstanding',
    whatItMeasures: 'The total amount currently owed by all customers — sum of all unpaid invoices from the beginning of time to now.',
    indicator: 'Snapshot metric. Evaluate in context of total invoicing volume and trend direction.',
    about: 'Total unpaid invoice amount across all customers. This is the sum of remaining balances on all open invoices from the beginning of time to now.\n\nThis is a snapshot metric — evaluate it in context of total invoicing volume and whether it is trending up or down.',
  },
  overdue_amount: {
    name: 'Overdue Amount',
    whatItMeasures: 'The portion of total outstanding that is past its due date. Shown with the percentage of total and count of affected customers.',
    indicator: '<20% of total = Acceptable\n>40% of total = Critical',
    about: 'Total outstanding amount on invoices that have passed their due date. The overdue percentage shows how much of the total outstanding is past due.\n\n<20% of total = Acceptable · >40% of total = Critical',
  },
  credit_limit_breaches: {
    name: 'Credit Limit Breaches',
    whatItMeasures: 'Count of active customers whose total outstanding exceeds their assigned credit limit.',
    indicator: '0 breaches = Good (green)\n>0 breaches = Concern (red)',
    about: 'Number of active customers whose total outstanding exceeds their assigned credit limit. Ideally this should be zero.\n\n0 breaches = Good · Any breaches = Concern',
  },
  aging_analysis: {
    name: 'Aging Analysis',
    whatItMeasures: 'Outstanding invoices grouped by how overdue they are across 6 aging buckets (Not Yet Due through 120+ Days).',
    indicator: 'Healthy = most value in "Not Yet Due"\nConcern = significant amounts in 61+ day buckets',
    about: 'Outstanding invoices grouped by how overdue they are across 6 aging buckets: Not Yet Due, 1–30 Days, 31–60 Days, 61–90 Days, 91–120 Days, and 120+ Days.\n\nHealthy = most value sits in "Not Yet Due"\nConcern = significant amounts in the 61+ day buckets',
  },
  credit_usage_distribution: {
    name: 'Credit Usage Distribution',
    whatItMeasures: 'Distribution of customers by how much of their credit limit they are using (Within/Near/Over limit).',
    indicator: 'Most customers within limit = healthy\nMany near or over limit = tightening credit risk',
    about: 'Shows how customers are distributed by credit limit usage — Within Limit, Near Limit, or Over Limit.\n\nMost customers within limit = healthy credit management\nMany near or over limit = tightening credit risk',
  },
  customer_credit_health: {
    name: 'Customer Credit Health',
    whatItMeasures: 'Detailed table of all customers showing outstanding balance, credit limit, usage percentage, overdue amount, and aging breakdown.',
    about: 'Detailed table of all customers showing their outstanding balance, credit limit, usage percentage, overdue amount, and aging breakdown. Use it to identify specific customers that need attention.',
  },

  // ═══ Sales Trend ═══
  net_sales: {
    name: 'Net Sales',
    whatItMeasures: 'Total net sales value — Invoice Sales + Cash Sales - Credit Notes for the selected period.',
    formula: 'Invoice Sales + Cash Sales - Credit Notes',
    about: 'Your actual revenue. This is the headline number reported to management. It accounts for everything — credit sales, cash sales, and any returns or adjustments.\n\nNet Sales = Invoice Sales + Cash Sales − Credit Notes',
  },
  invoice_sales: {
    name: 'Invoice Sales',
    whatItMeasures: 'Total credit/invoice sales in the selected period.',
    about: 'Sales on credit terms. Customers receive goods now and pay later according to agreed terms.\n\nFormula: Total value of invoices issued',
  },
  cash_sales: {
    name: 'Cash Sales',
    whatItMeasures: 'Total cash sales in the selected period.',
    about: 'Immediate payment at the point of sale. This is the safest type of sale — zero risk of non-payment.\n\nFormula: Total cash and POS transactions',
  },
  credit_notes: {
    name: 'Credit Notes',
    whatItMeasures: 'Total credit notes issued in the selected period. Credit notes reduce net sales (returns, discounts, corrections).',
    indicator: 'High credit note ratio relative to sales may indicate product quality or order accuracy issues.',
    about: 'Shown in red because it reduces your revenue. A small, steady amount is normal for perishable goods (damaged items, short deliveries, expired stock). Watch for sudden spikes.\n\nFormula: Total returns and adjustments',
  },
  net_sales_trend: {
    name: 'Net Sales Trend',
    whatItMeasures: 'Stacked bar chart showing Invoice Sales + Cash Sales - Credit Notes by period.',
    indicator: 'Rising trend = growing sales\nFalling trend = declining sales\nLarge CN bars = return/quality issues',
    about: 'Stacked bar chart showing your sales broken down over time. Each bar is split into three colours:\n\nBlue — Invoice Sales\nGreen — Cash Sales\nRed — Credit Notes (shown below zero)\n\nBars getting taller = sales are growing\nBars getting shorter = sales are declining\nDip at the same time each year = seasonal pattern',
  },

  // ═══ Sales Breakdown ═══
  by_customer: {
    name: 'Sales by Customer',
    whatItMeasures: 'Top customers ranked by net sales with chart and table breakdown.',
    about: 'Which customers are buying the most? The chart shows the top 10 customers by net sales as horizontal bars. Below is a detailed table with search, sort, checkboxes, and Excel export.\n\nTick rows in the table to highlight them on the chart for comparison.',
  },
  by_product: {
    name: 'Sales by Product',
    whatItMeasures: 'Top products (fruits) ranked by net sales with chart and table breakdown.',
    about: 'Which products are driving revenue? The chart shows the top 10 products by net sales as horizontal bars. Below is a detailed table with search, sort, checkboxes, and Excel export.\n\nTick rows in the table to highlight them on the chart for comparison.',
  },
  by_agent: {
    name: 'Sales by Agent',
    whatItMeasures: 'Sales agent performance comparison including customer count and sales volume.',
    about: 'Which agents are performing best? The chart shows the top 10 sales agents by net sales as horizontal bars. Below is a detailed table with customer count, sales volume, search, sort, and Excel export.\n\nTick rows in the table to highlight them on the chart for comparison.',
  },
  by_outlet: {
    name: 'Sales by Outlet',
    whatItMeasures: 'Location-based sales breakdown showing performance by outlet.',
    about: 'Which locations are selling the most? The chart shows the top 10 outlets by net sales as horizontal bars. Below is a detailed table with search, sort, checkboxes, and Excel export.\n\nTick rows in the table to highlight them on the chart for comparison.',
  },

  // ═══ Customer Margin Overview ═══
  cm_net_sales: {
    name: 'Net Sales',
    whatItMeasures: 'Total net sales for the selected period across all active customers.',
    formula: 'SUM(iv_revenue + dn_revenue − cn_revenue) from pc_customer_margin',
    indicator: 'Growth = Good · Flat = Neutral · Decline = Bad',
    about: 'Net Sales is your actual revenue for the period after subtracting credit notes. It is the same figure shown on the Sales page, but scoped to active customers only on the Customer Margin view.\n\nNet Sales = Invoice Sales + Debit Notes − Credit Notes\n\nGrowth = Good · Flat = Neutral · Decline = Bad',
  },
  cm_cogs: {
    name: 'Cost of Sales',
    whatItMeasures: 'Total landed cost of goods sold for the selected period.',
    formula: 'SUM(iv_cost + dn_cost − cn_cost) from pc_customer_margin',
    indicator: 'Should move in the same direction as Net Sales. COGS rising faster than Net Sales = margin pressure.',
    about: 'Cost of Sales (COGS) is the total cost of the goods you sold during the period. For a fruit distribution business, this is usually the biggest expense line — typically 80–90% of Net Sales.\n\nAlways read COGS together with Net Sales. If COGS rises faster than Net Sales, your margins are being squeezed.',
  },
  cm_gross_profit: {
    name: 'Gross Profit',
    whatItMeasures: 'The absolute profit from sales before operating expenses.',
    formula: 'Net Sales − COGS',
    indicator: 'Growing with Net Sales = Good · Flat while sales grow = Neutral · Declining = Bad',
    about: 'Gross Profit is what remains from Net Sales after subtracting the Cost of Sales. It tells you how much money you are actually making on the goods you sell, before operating costs like rent, salaries, and logistics.\n\nGross Profit = Net Sales − COGS\n\nThe most important signal: whether Gross Profit is growing faster or slower than Net Sales. That reveals whether the business is gaining or losing pricing power.',
  },
  cm_margin_pct: {
    name: 'Gross Margin %',
    whatItMeasures: 'Gross Profit as a percentage of Net Sales — the efficiency ratio of converting sales into profit.',
    formula: '(Gross Profit ÷ Net Sales) × 100',
    indicator: '≥15% = Good (green) · 10–15% = Neutral (yellow) · <10% = Bad (red)',
    about: 'Gross Margin % tells you how efficiently you convert sales into profit. A 15% margin means that for every RM 100 in sales, you keep RM 15 before operating costs.\n\nGross Margin % = (Gross Profit ÷ Net Sales) × 100\n\nFruit distribution benchmarks:\n≥15% = Good · 10% to 15% = Neutral · <10% = Bad',
  },
  cm_active_customers: {
    name: 'Active Customers',
    whatItMeasures: 'Count of distinct active customers with activity in the selected period.',
    formula: 'COUNT(DISTINCT debtor_code) where is_active = \'T\' and the customer had any row in pc_customer_margin during the period',
    indicator: 'Stability is the baseline. Large swings either way deserve attention.',
    about: 'The number of distinct active customers that had any business with you during the selected period. This is a period-scoped count, not a total customer base count.\n\nStability is the baseline — a steady count is healthy for a mature distribution business. Watch for drops (possible churn) and unusual growth (new customer acquisition or reactivation).',
  },
  cm_margin_trend: {
    name: 'Profitability Trend',
    whatItMeasures: 'Monthly Gross Profit (bars) and Gross Margin % (line) over time.',
    indicator: 'Three or more months of profit growth = Good · Margin % declining for 2+ months = Flag even if profit is flat',
    about: 'This chart answers two questions at once:\n\n• Bars (Gross Profit, RM) — are you making more or less profit in absolute terms?\n• Line (Margin %) — are you getting more or less efficient at converting sales into profit?\n\nWatch for divergence: if profit is rising while Margin % stays flat, growth is coming from volume, not pricing. The chart is fixed to monthly granularity.',
  },
  cm_margin_distribution: {
    name: 'Customer Margin Distribution',
    whatItMeasures: 'How many customers fall into each Gross Margin % bucket for the period.',
    indicator: 'Most customers in the 10–20% band = Healthy · Over 40% below 10% = Bad · Any customer < 0% = selling at a loss',
    about: 'A histogram showing how your customer base is spread across margin bands. Buckets are fixed:\n\n< 0% · 0–5% · 5–10% · 10–15% · 15–20% · 20–30% · 30%+\n\nOnly customers with more than RM 1,000 of revenue in the period are included (small-volume customers are excluded to avoid noise).\n\nA healthy portfolio concentrates in the 10–20% bands with a small tail at 20%+. Heavy weight in the sub-10% bands signals a thin-margin portfolio. Any customers below 0% are selling at a loss and need investigation.',
  },

  // ═══ Customer Margin Breakdown ═══
  cm_top_customers: {
    name: 'Top Customers',
    whatItMeasures: 'The top 10 customers for the selected period — viewed by Gross Profit (RM contribution) or Gross Margin % (efficiency).',
    formula: 'Top 10 by Gross Profit · Top 10 by Margin % (revenue ≥ RM 10,000)',
    indicator: 'Top customer > 15% of period GP = Concentration risk · Top 10 > 60% of period GP = Concentrated · Top 10 < 40% = Diversified',
    about: 'This chart shows the top 10 customers for the selected period. You can switch between two lenses:\n\n• Gross Profit — absolute RM contribution. Who is bringing in the most profit?\n• Gross Margin % — efficiency. Who has the best margin? (customers with less than RM 10,000 revenue are excluded to avoid noise)\n\nYou can also switch direction to see the bottom 10. Watch for customers that appear on BOTH top lists — those are star accounts (high profit AND high margin). Watch for over-reliance: if your top 1 customer is more than 15% of total Gross Profit, losing them would hurt badly.',
  },
  cm_customer_table: {
    name: 'Customer Analysis Table',
    whatItMeasures: 'Every active customer in the period with revenue, COGS, Gross Profit, Margin %, and Return Rate. Sortable and searchable.',
    indicator: 'Top 10 share > 60% of GP = Over-concentrated · Loss-makers > 10% of active = Unhealthy tail',
    about: 'A full sortable, paginated table of every active customer in the selected period. Columns: Code, Name, Type, Net Sales, COGS, Gross Profit, Margin %, Return Rate.\n\nUse it to find:\n• Top performers (sort by Gross Profit desc)\n• Loss-makers (sort by Gross Profit asc)\n• High-return customers (sort by Return Rate desc)\n\nThe AI analysis looks at concentration (how much of the profit sits in the top 10) and the at-risk tail (how many customers are losing money).',
  },
  cm_credit_note_impact: {
    name: 'Credit Note Impact',
    whatItMeasures: 'Customers ranked by how much credit notes eroded their margin. Shows margin before CN, margin after CN, and the points lost.',
    formula: 'Margin Lost = (Margin before CN) − (Margin after CN), in percentage points',
    indicator: 'Top 5 > 50% of total margin lost = Concentrated CN problem · Return rate > 10% = Excessive · Margin lost > 10 pp = Severe impact',
    about: 'Credit notes (returns, adjustments, rejections) directly reduce your margin. This table ranks customers by how much margin they cost you through credit notes.\n\nColumns:\n• Margin Before CN — what the margin would have been without any credit notes\n• Margin After CN — the actual margin after credit notes were applied\n• Margin Lost — the gap between the two, in percentage points\n\nIf the top 5 customers account for more than half of all margin lost, you have a concentrated problem — fix those few accounts first. A return rate above 10% usually points to quality or operational issues.',
  },

  // ═══ Supplier Margin Overview ═══
  sp_net_sales: {
    name: 'Est. Net Sales',
    whatItMeasures: 'Total sales revenue attributed to goods sourced from active suppliers during the selected period.',
    formula: 'SUM(sales_revenue) from pc_supplier_margin where is_active = \'T\'',
    indicator: 'Growth = Good · Flat = Neutral · Decline = Bad · Drop > 10% = Flag',
    about: 'Est. Net Sales on the Supplier Performance page is the sales revenue attributed to items you sourced from active suppliers during the period. The "Est." prefix flags that this number comes from the supplier-margin pre-compute pipeline — it mirrors the Customer Margin Net Sales figure when no filters are applied, but may diverge when supplier/item-group filters are in play.\n\nGrowth = Good · Flat = Neutral · Decline = Bad',
  },
  sp_cogs: {
    name: 'Est. Cost of Sales',
    whatItMeasures: 'Attributed cost of goods sold, summed across items from active suppliers for the period.',
    formula: 'SUM(attributed_cogs) from pc_supplier_margin where is_active = \'T\'',
    indicator: 'Read against Net Sales and sourcing mix — rising COGS alone is NOT automatically bad on a supplier page.',
    about: 'Est. Cost of Sales is the total cost of goods sold during the period, summed across items from active suppliers.\n\nIMPORTANT: On the supplier page, rising COGS is NOT automatically bad. It can mean the business is shifting volume toward a preferred supplier whose goods cost more but carry better margin, reliability, or commercial terms. Always read COGS together with Est. Net Sales and Gross Margin %.\n\nBad signal: COGS rising faster than Net Sales AND margin % falling.\nGood signal: COGS rising with Net Sales keeping pace, margin % stable or up.',
  },
  sp_gross_profit: {
    name: 'Est. Gross Profit',
    whatItMeasures: 'Est. Net Sales minus Est. Cost of Sales for the period — the absolute profit contribution from the active supplier mix.',
    formula: 'Est. Net Sales − Est. Cost of Sales',
    indicator: 'Growing with Net Sales = Good · Flat while sales grow = Neutral · Declining = Bad',
    about: 'Est. Gross Profit is what remains from Est. Net Sales after subtracting the cost of the goods sold. On the supplier page, the most important signal is whether Gross Profit is growing faster or slower than Est. Net Sales — that reveals whether the current supplier mix is actually delivering margin or just volume.\n\nGrowing with Net Sales = Good · Flat while sales grow = Neutral · Declining while sales grow = Bad (cost pressure or sourcing mix shifting to lower-margin suppliers)',
  },
  sp_margin_pct: {
    name: 'Gross Margin %',
    whatItMeasures: 'Est. Gross Profit as a percentage of Est. Net Sales — the efficiency ratio of the current supplier mix.',
    formula: '(Est. Gross Profit ÷ Est. Net Sales) × 100',
    indicator: '≥15% = Good (green) · 10–15% = Neutral (yellow) · <10% = Bad (red)',
    about: 'Gross Margin % tells you how efficiently the current supplier mix is converting sales into profit. A healthy margin trending down is still worth flagging — on a supplier page this usually means upstream price pressure.\n\nFruit distribution benchmarks:\n≥15% = Good · 10% to 15% = Neutral · <10% = Bad\n\nA drop of 2 percentage points vs the prior period warrants investigation regardless of absolute level.',
  },
  sp_active_suppliers: {
    name: 'Active Suppliers',
    whatItMeasures: 'Count of distinct suppliers with purchase activity during the selected period.',
    formula: 'COUNT(DISTINCT creditor_code) where is_active = \'T\' AND purchase_qty > 0',
    indicator: 'Steady or gently consolidating = Neutral · Sudden drop > 10% = Flag · Sudden growth > 15% = Flag',
    about: 'The number of distinct active suppliers you purchased from during the period.\n\nUnlike the Customer Active count, a shrinking supplier count is NOT automatically bad. Consolidation often means the business is concentrating volume with better-performing suppliers to gain negotiating leverage.\n\nSudden large drops are the one clear flag — they may indicate a supplier dropping out, a purchasing freeze, or a data issue.\n\n±5% monthly change = Normal · −5% to −10% = Neutral (possible consolidation) · >10% drop or >15% growth = Flag',
  },
  sp_margin_trend: {
    name: 'Profitability Trend',
    whatItMeasures: 'Monthly Est. Gross Profit (bars) and Gross Margin % (line) over time.',
    indicator: '3+ months of profit growth = Good · Margin % declining for 2+ months = Flag even if profit is flat',
    about: 'This chart answers two questions at once for the supplier mix:\n\n• Bars (Est. Gross Profit, RM) — is the sourcing mix delivering more or less profit in absolute terms?\n• Line (Margin %) — is the business getting more or less efficient at converting purchases into profit?\n\nWatch for divergence: if profit is rising while Margin % stays flat, growth is coming from volume, not pricing leverage. Any month where Gross Profit and Margin % move in opposite directions usually points at a sourcing mix shift worth investigating. The chart is fixed to monthly granularity.',
  },
  sp_margin_distribution: {
    name: 'Margin Distribution',
    whatItMeasures: 'How many suppliers (or items) fall into each Gross Margin % bucket for the period. The chart has a Suppliers ↔ Items toggle.',
    indicator: 'Most entities in the 10–20% band = Healthy · Over 40% below 10% = Bad · Any entity < 0% = sourcing at a loss',
    about: 'A histogram of the supplier (or item) base spread across margin bands. Buckets are fixed:\n\n< 0% · 0–5% · 5–10% · 10–15% · 15–20% · 20–30% · 30%+\n\nThe chart has a Suppliers ↔ Items toggle. The AI analysis looks at BOTH views:\n\n• Supplier view healthy but item view thin = a few premium suppliers are carrying a long tail of weak items.\n• Item view healthy but supplier view thin = good products sourced through mostly weak suppliers — a commercial terms issue.\n• Both views skewed the same way = the pattern is structural.\n\nAny entity in the < 0% bucket is sourcing at a loss and deserves attention.',
  },
};
