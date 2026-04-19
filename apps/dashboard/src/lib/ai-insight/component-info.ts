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

  // ═══ Supplier Margin Breakdown ═══
  sm_top_bottom: {
    name: 'Top/Bottom Suppliers & Items',
    whatItMeasures: 'The top and bottom 10 suppliers AND items for the period, viewed by Est. Gross Profit (RM contribution) or Gross Margin % (efficiency).',
    indicator: 'Top 1 supplier > 15% of period GP = Concentration risk · Top 10 > 60% = Concentrated · Any bottom-list entity < 0% = Sourcing at a loss',
    about: 'This chart lets you see the best and worst performers on the supplier page through four lenses:\n\n• Suppliers by Gross Profit (RM contribution)\n• Suppliers by Margin % (efficiency, min revenue RM 10,000)\n• Items by Gross Profit\n• Items by Margin % (min revenue RM 10,000)\n\nYou can also flip to the bottom 10 on any lens. Watch for entities that appear on BOTH top-profit AND top-margin lists — those are star suppliers or products worth protecting. Any bottom-list entity with negative margin is sourcing at a loss and needs attention.',
  },
  sm_supplier_table: {
    name: 'Supplier Analysis Table',
    whatItMeasures: 'Every active supplier in the period with revenue, COGS, Gross Profit, Margin %, and item count. Sortable and searchable.',
    indicator: 'Top 10 share of revenue > 60% = Concentrated · Loss-makers (margin < 0) > 0 = Always flag · Thin-margin (< 5%) > 10% of active = Portfolio quality concern',
    about: 'A full sortable, paginated table of every active supplier in the selected period. Columns: Code, Name, Type, Items, Revenue, COGS, Gross Profit, Margin %.\n\nUse it to find:\n• Biggest sourcing partners (sort by Revenue desc)\n• Thin-margin suppliers (sort by Margin % asc, with a revenue floor to cut noise)\n• Loss-making suppliers (sort by Gross Profit asc)\n\nThe AI analysis focuses on sourcing concentration in the top 10 and the at-risk thin-margin tail.',
  },
  sm_item_pricing: {
    name: 'Item Price Comparison',
    whatItMeasures: 'Per-supplier avg purchase price and estimated margin for a selected item, plus the monthly price trend across suppliers.',
    indicator: 'Margin spread > 10 pp across suppliers = Arbitrage opportunity · Cheapest supplier carries < 20% of qty = Misaligned procurement · Any supplier margin < 0 = Loss-making on that item',
    about: 'This panel lets you pick any item and see how each supplier compares on price and estimated margin. The AI analysis is anchored to a single item — the highest-revenue item in the selected period — and looks at:\n\n• Whether the volume leader is also the price leader (aligned procurement) or not (arbitrage risk)\n• How wide the price spread is across suppliers for the same item\n• The cross-supplier margin % spread — a wide spread means shifting volume could improve margin\n\nThe estimated sell price comes from raw invoice + cash-sale line items (or the pre-compute fallback when raw tables are unavailable). Conclusions are framed to the anchor item specifically — the summary layer may drill other items.',
  },
  // ═══ Return Trend ═══
  rt_total_returns: {
    name: 'Total Returns',
    whatItMeasures: 'Total return value (RM) and number of return credit notes issued in the selected period.',
    formula: 'SUM(cn_total), SUM(cn_count) from pc_return_monthly',
    indicator: 'Read together with Return % — a RM figure only means something relative to net sales.',
    about: 'Total Returns shows the period return exposure in two numbers: the RM value of all return credit notes issued, and the count of those CNs.\n\nThis is a period flow — activity within the date range, not a point-in-time balance. It is always read against Net Sales for the same period (see Return %).\n\nAn average return value per CN helps tell whether the exposure is driven by many small returns (process noise) or a few large returns (specific events worth investigating).',
  },
  rt_settled: {
    name: 'Settled',
    whatItMeasures: 'Total return value resolved during the period — either knocked off against invoices (non-cash) or refunded (cash out).',
    formula: 'Knocked Off + Refunded',
    indicator: 'Knock-off % > 70% = Healthy · Refund % > 30% = Concern (cash leakage)',
    about: 'Settled shows how much of the period return exposure has been resolved. It combines two very different settlement channels:\n\n• Knocked Off — the return is offset against future or outstanding invoices. No cash leaves the door. This is the PREFERRED settlement channel for a distribution business.\n• Refunded — actual cash or cheque paid back to the customer. This is real cash out and erodes working capital.\n\nA healthy mix is knock-off heavy. A refund-heavy mix means the business is draining cash to close out returns — usually because the customer has no upcoming invoices to offset against, or the relationship is ending.',
  },
  rt_unsettled: {
    name: 'Unsettled',
    whatItMeasures: 'Return value from the period that has not been knocked off or refunded — still open on the books.',
    formula: 'Total Return Value − Knocked Off − Refunded',
    indicator: '< 15% of return value = Healthy · 15–30% = Watch · > 30% = Concern',
    about: 'Unsettled is the piece of the period return exposure that is still open — neither offset nor refunded. This is the portion actively hurting both the P&L and working capital.\n\nThe breakdown splits by CN status:\n• Partial — some resolution, but not complete\n• Outstanding — zero resolution, stuck\n• Reconciled — fully closed out\n\nA high partial count points to process friction (knock-offs taking too long). A high outstanding count points to customer-side blockers. Both are actionable once separated.',
  },
  rt_return_pct: {
    name: 'Return %',
    whatItMeasures: 'Return value as a percentage of net sales for the period — the single most important return-health ratio.',
    formula: '(Total Return Value ÷ Total Net Sales) × 100',
    indicator: '< 2% = Green (Good) · 2–5% = Amber (Watch) · > 5% = Red (Concern)',
    about: 'Return % normalizes return exposure against sales volume so you can compare periods fairly — a growing RM return figure is only concerning if it is growing faster than sales.\n\nFor a fruit distribution business, a return rate below 2% reflects normal wastage and quality tolerance. Above 5% points to real problems in quality, handling, or sourcing.\n\nThis KPI is the anchor metric for the Returns page — every other return figure should be read in the context of this ratio.',
  },
  rt_settlement_breakdown: {
    name: 'Settlement Breakdown',
    whatItMeasures: 'Three-channel breakdown of how the period return pool is being resolved — Knocked Off, Refunded, Unsettled — each as an RM amount and a percentage of total return value.',
    indicator: 'Knock-off % > 70% = Healthy · Refund % > 30% = Concern · Unsettled % > 30% = Concern',
    about: 'This chart answers a single question: of the returns in the period, how much has been resolved — and through which channel?\n\n• Knocked Off (emerald) — offset against future or outstanding invoices. No cash leaves the door.\n• Refunded (blue) — actual cash or cheque paid back.\n• Unsettled (red) — neither resolved nor refunded. Still open exposure.\n\nA knock-off-dominant mix is cash-efficient and healthy. A refund-dominant mix is cash-draining. A high unsettled slice is a process breakdown signal — the business is neither absorbing nor refunding these returns.',
  },
  rt_monthly_trend: {
    name: 'Monthly Return Trend',
    whatItMeasures: 'Two series plotted by month for the selected period — total return value (indigo) and unsettled amount (red).',
    indicator: 'Unsettled rising while return value is flat/falling = Process breakdown · Count growth > 25% MoM = Concern',
    about: 'The indigo area shows the period return value month-by-month. The red area shows the unsettled slice for the same months. Both are filtered to the selected date range.\n\nWatch for divergence: if the red line rises while the indigo line is flat or falling, returns are not being closed out — a process issue worth investigating. If both rise together, the problem is volume-driven and the fix is upstream (quality, handling, sourcing).',
  },
  rt_product_bar: {
    name: 'Top Returns by Item',
    whatItMeasures: 'The top 10 items most associated with returns in the period, rankable by frequency (CN count) or value (RM).',
    indicator: 'Top 1 item > 15% of return value = Severe concentration · Top 10 > 60% = Concentrated · Top 10 < 40% = Diversified',
    about: 'This chart shows where the return pain actually lands. You can rank items two ways:\n\n• Frequency — which items get returned most often (process noise, breakage, quality)\n• Value (RM) — which items hurt the P&L most when they are returned (high-cost items)\n\nAn item on BOTH lists is a star problem product — it breaks often AND costs a lot when it does. Fixing one of those moves the number.\n\nYou can also drill into Product, Variant, or Country dimensions via the toggle — useful once the item-level view has flagged a suspicious pattern.',
  },

  // ═══ Return Unsettled (§6) ═══
  ru_aging_chart: {
    name: 'Aging of Unsettled Returns',
    whatItMeasures: 'The current unsettled return book split by how long each return credit note has been sitting unresolved — five buckets from 0–30 days through 180+ days.',
    indicator: '91+ combined > 25% of unsettled value = Watch · 180+ alone > 10% = Write-off risk',
    about: 'This chart answers a single question: how old is the money that is still stuck on the return book?\n\nEvery return credit note that is not yet knocked off or refunded ages through five buckets:\n\n• 0–30 Days (emerald) — fresh, still in the normal reconciliation window\n• 31–60 Days (amber) — starting to age\n• 61–90 Days (orange) — ageing, process slowing down\n• 91–180 Days (red) — concerning, needs active follow-up\n• 180+ Days (dark red) — real write-off risk\n\nThis is a SNAPSHOT — cumulative across all months, not filtered by the date range. It shows every return CN still open as of the latest aging snapshot.\n\nA healthy book has most of its unsettled value in the 0–30 bucket. Weight drifting into the 91+ buckets means the follow-up process is falling behind. Material 180+ exposure triggers write-off review.',
  },
  ru_debtors_table: {
    name: 'Customer Returns',
    whatItMeasures: 'Per-debtor cumulative return exposure across all months — return count, total return value, amount knocked off against invoices, amount refunded in cash, and the unresolved balance still open.',
    indicator: 'Top 1 debtor > 15% of total unsettled = Single-point risk · Top 10 > 60% = Concentrated book · Stale debtors (unresolved > 0, no knock-off, no refund) = Process failure',
    about: 'This table lists every customer who has ever issued a return credit note, with cumulative totals across all months. By default it is sorted by unresolved amount and the filter is set to "Unsettled" — showing only customers with open return exposure.\n\nThe settlement columns tell the story:\n\n• Knocked Off — the return was offset against an invoice. No cash left the door. This is the preferred resolution.\n• Refunded — real cash was paid back. Only appropriate for ending relationships or customers with no upcoming invoices.\n• Unsettled — neither offset nor refunded. Still open.\n\nThree patterns to watch for:\n\n1. **Concentration** — if one customer dominates the unsettled book, a single collections conversation can move the whole number. If it is spread across many, the fix is a process push, not a customer conversation.\n2. **Stale debtors** — customers with an unresolved balance AND zero settlement activity. These are the ones the collections team never opened a conversation on. Pure process failure.\n3. **Refund-but-still-unresolved** — the cash already went out AND the book is still dirty. A red flag on the specific customer.',
  },

  sm_price_scatter: {
    name: 'Purchase vs Selling Price',
    whatItMeasures: 'Item-level scatter plot of avg purchase price (x) vs avg selling price (y), bubble-sized by revenue.',
    indicator: 'Top-50 items with margin % < 0 = Always flag · > 20% of universe items in the < 5% bucket = Thin-margin catalog · Meaningful tail in 20%+ = Premium pocket',
    about: 'Each dot is one item: x = avg purchase price, y = avg selling price, size = revenue. Items below the y = x line are selling for less than they cost (loss-making).\n\nThe AI analysis looks at:\n• Named loss-making items in the top 50 by revenue (the items that actually move the P&L)\n• Price-spread outliers — items where purchase price is unusually high or low relative to selling price\n• The shape of the margin distribution across the full universe of items (loss / thin / healthy / premium)\n\nUse it to spot items where procurement or pricing has drifted away from the rest of the catalog.',
  },

  // ═══ Expense Overview (§7) ═══
  ex_total_costs: {
    name: 'Total Costs',
    whatItMeasures: 'Total expense posted to GL in the selected period — Cost of Sales (COGS) + Operating Costs (OpEx) combined.',
    formula: 'SUM(net_amount) from pc_expense_monthly WHERE acc_type IN (\'CO\', \'EP\') within the period',
    indicator: 'YoY < 0% = Healthy · 0–5% = Watch · 5–10% = Concern · > 10% = Severe',
    about: 'Total Costs shows the period cost exposure in a single number, with the COGS / OpEx split visible on the card.\n\nThis is a PERIOD FLOW — activity within the selected date range, not a point-in-time balance. It is always read against revenue for the same period to judge whether cost growth is justified.\n\nA healthy fruit-distribution business has COGS in the 60–80% range of total cost. A drift toward COGS-dominated (> 85%) suggests margin pressure; OpEx-dominated (< 50%) suggests either premium positioning or scaling inefficiency.',
  },
  ex_cogs: {
    name: 'Cost of Sales (COGS)',
    whatItMeasures: 'Variable cost directly tied to products sold — GL accounts with acc_type = \'CO\'.',
    formula: 'SUM(net_amount) WHERE acc_type = \'CO\' within the period',
    indicator: 'COGS share 60–80% = Typical · > 85% = Margin-pressure risk · COGS YoY > 15% with flat sales = Concern',
    about: 'COGS is the variable piece of the cost base. It should scale with sales volume — if you sold more, you spent more on inventory.\n\nThe critical question is not "did COGS grow?" but "did COGS grow FASTER than sales?". A 10% COGS YoY on a 10% sales YoY is perfectly healthy. A 10% COGS YoY on flat sales is margin compression.\n\nThe top 3 COGS accounts shown in the analysis block identify which line items dominate the variable cost base — usually purchase cost of fruit, freight-in, or direct handling.',
  },
  ex_opex: {
    name: 'Operating Costs (OpEx)',
    whatItMeasures: 'Semi-fixed day-to-day operating expenses — GL accounts with acc_type = \'EP\' (rent, salaries, utilities, tooling, etc.).',
    formula: 'SUM(net_amount) WHERE acc_type = \'EP\' within the period',
    indicator: 'OpEx YoY > 10% = Concern · OpEx YoY < 0% = Healthy discipline · OpEx share > 50% of total = OpEx-dominated',
    about: 'OpEx is the semi-fixed piece of the cost base. Unlike COGS, it does NOT scale linearly with sales volume — it grows only with structural decisions (new headcount, new rent, new tooling, new vehicles).\n\nThat makes OpEx YoY growth a stronger signal than COGS YoY growth. If OpEx jumped 15% year-over-year, something structural changed — and the analyst should be able to name it.\n\nThe top 3 OpEx accounts shown in the analysis block identify which structural line items are moving.',
  },
  ex_yoy_costs: {
    name: 'vs Last Year',
    whatItMeasures: 'Year-over-year growth in total costs for the selected period, with the COGS / OpEx split visible.',
    formula: '((Current period total − Prior-year same-period total) / Prior-year total) × 100',
    indicator: '< 0% = Healthy · 0–5% = Watch · 5–10% = Concern · > 10% = Severe',
    about: 'This KPI is the quickest health check on cost discipline. It compares the total cost in the selected period to the same period one year ago.\n\nThe colour band follows the YoY growth rate. Thresholds are calibrated to typical Malaysian distribution inflation — sub-5% is in line, 5–10% warrants investigation, double-digit growth is a red flag.\n\nThe component-level analysis splits the YoY movement between COGS and OpEx. A COGS-driven YoY is the "volume story" (more sales, more inventory). An OpEx-driven YoY is the "structural story" (new headcount, rent, tooling) — the more worrying of the two.',
  },
  ex_cost_trend: {
    name: 'Cost Trend',
    whatItMeasures: 'Monthly total-cost trajectory across the selected period, stacked by COGS and OpEx so you can see which piece is moving.',
    indicator: 'MoM growth (first → last month) > 15% = Concern · > 25% = Severe · Period YoY > 10% = Severe',
    about: 'The chart plots one bar per month in the selected period, with COGS and OpEx stacked within each bar. You can use the Cost Type toggle above the chart to re-colour the view.\n\nWatch for two things:\n\n• Direction: is the trend rising, flat, or falling across the period? A sharp rise in the last month is the earliest cost-discipline warning signal.\n• Mix movement: if OpEx is getting taller month-over-month while COGS is flat, the cost base is re-shaping toward the semi-fixed side — that is a structural change, not a volume story.\n\nThe AI is given the pre-computed peak/low months, MoM growth, and period-over-prior-year totals so it can narrate the shape without recomputing.',
  },
  ex_cost_composition: {
    name: 'Cost Composition',
    whatItMeasures: 'Split of total costs between COGS and OpEx for the period, with prior-year composition for drift analysis.',
    indicator: 'COGS 60–80% = Typical · > 85% = COGS-dominated (margin-pressure risk) · < 50% = OpEx-dominated (scaling inefficiency risk)',
    about: 'The donut shows the COGS / OpEx split for the period. The critical number is not the absolute split but the DRIFT from prior year.\n\n• A rising COGS share (positive drift, in percentage points) on flat sales indicates margin compression — the cost of what you sell has grown faster than what you can charge for it.\n• A falling COGS share (negative drift) can mean two very different things: margin improvement (good) or inventory under-investment (bad) — the sales page should be cross-checked before concluding.\n• An OpEx-dominated mix (COGS < 50%) on a distribution business is unusual and usually flags either premium positioning or poor scaling of the fixed cost base.\n\nThis chart is most useful when the AI can put a number on the drift and interpret it against the sales context.',
  },
  // ═══ Expense Breakdown (§8) ═══
  ex_cogs_table: {
    name: 'Cost of Sales Breakdown',
    whatItMeasures: 'Every active GL account with acc_type = \'CO\' (Cost of Sales) for the selected period, with each account\'s share of total COGS.',
    formula: 'SUM(net_amount) per acc_no WHERE acc_type = \'CO\' within the period; share = account net_cost ÷ SUM(net_cost)',
    indicator: 'Top 1 > 50% = Severe · 30-50% = Concentrated · < 15% = Diversified · Top 3 > 80% = Concentrated · Account count < 5 = Thin surface · Any negative net_cost = Flag',
    about: 'COGS is the variable cost base — the dollars you spend to buy what you sell. This breakdown answers one question: where do those dollars actually land?\n\nA handful of accounts usually dominate in a fruit-distribution business (raw purchase, freight-in, direct handling), and concentrated COGS is normal. The flag is not "concentration" itself — it is Top 1 above 50%, which means a single unit-price renegotiation on one account moves the whole COGS line.\n\nThe analysis ignores prior-year comparisons by design — those live in §7 Expense Overview. Here the focus is structure: who is big, who has a negative balance (credit-note reversal), and whether the GL surface is rich enough to be trusted.',
  },
  ex_opex_table: {
    name: 'Operating Costs Breakdown',
    whatItMeasures: 'Every active GL account with acc_type = \'EP\' (Operating Costs) for the selected period, grouped under a fixed category taxonomy (People & Payroll, Vehicle & Transport, Property & Utilities, etc.), with each category\'s and account\'s share of total OpEx.',
    formula: 'SUM(net_amount) per acc_no WHERE acc_type = \'EP\' within the period, grouped by category (ParentAccNo → category map)',
    indicator: 'Top category > 50% = Dominant · 30-50% = Typical · < 20% = Diversified · Top 1 account > 20% = Single-account risk · Singleton categories / negative accounts = Flag',
    about: 'OpEx is the semi-fixed cost base — rent, salaries, utilities, tooling, vehicles. Unlike COGS, it does not scale with sales volume, so the structure of the OpEx breakdown tells you where the business is actually spending its structural dollars.\n\nThe table groups accounts into a fixed category taxonomy. For a Malaysian fruit distributor, People & Payroll, Vehicle & Transport, or Property & Utilities dominating is expected. Marketing & Entertainment or Professional Fees dominating is not.\n\nThe analysis ignores prior-year comparisons by design — those live in §7 Expense Overview. Here the focus is structure: which category carries the base, whether one account drives the dominant category (single-account risk), and whether any category has only a single account (data-quality flag).',
  },

  ex_top_expenses: {
    name: 'Top Expenses',
    whatItMeasures: 'Top 10 GL accounts by net cost in the period, with bars coloured by cost type (COGS / OpEx). User can toggle cost type and top/bottom direction.',
    indicator: 'Top 1 > 30% = Severe concentration · 15–30% = Concentrated · Top 10 > 75% = Concentrated · < 50% = Diversified',
    about: 'This chart shows where the expense dollars actually land. Each bar is one GL account, coloured by whether it is COGS (variable) or OpEx (semi-fixed).\n\nWatch for two things:\n\n• Concentration: if one account carries > 30% of total cost, that is single-account risk — a price change, a vendor change, or a category shift in that one line moves the entire cost base. If the top 10 accounts sum to > 75%, the cost base is concentrated enough that a procurement or discipline initiative can meaningfully move the number.\n• Mix: a top 10 dominated by COGS is the normal distribution picture (inventory, freight, handling). A top 10 dominated by OpEx means structural costs are the biggest movers — usually salaries, rent, or vehicle costs — and the fix is strategic, not operational.\n\nThe Cost Type toggle (All / COGS / OpEx) and Top/Bottom toggle drive the chart locally — the AI analysis is on the default All / Top view, and drill-downs remain user-driven.',
  },

  // ─── Financial page §9 — financial_overview ──────────────────────────────

  fin_net_sales: {
    name: 'Net Sales',
    whatItMeasures: 'Total net sales (Sales + Sales Adjustments) posted to pc_pnl_period for the selected fiscal window (full FY, YTD, or trailing 12 months).',
    formula: 'SUM(net_amount) WHERE acc_type IN (\'SL\', \'SA\') within the fiscal window',
    indicator: 'YoY > 10% = Strong favourable · 5–10% = Favourable · 0–5% = Flat · -5–0% = Unfavourable · < -5% = Severe',
    about: 'Net Sales is the top-line number — the size of the business\'s revenue in the selected fiscal window.\n\nThis is a FISCAL-PERIOD FLOW, not a calendar-date flow. The window is defined by fiscal year + range selector (full FY, YTD, or trailing 12 months) and every figure reflects activity within that window only.\n\nThe card reads the current-window total and compares it against the prior-year same window for a YoY growth %. On its own it answers one question — is the top line expanding or contracting? — and is always read in pair with Cost of Sales to judge whether growth is coming at the expense of margin.',
  },

  fin_cost_of_sales: {
    name: 'Cost of Sales',
    whatItMeasures: 'Total direct cost of products sold (COGS) for the selected fiscal window, with the COGS share of Net Sales.',
    formula: 'SUM(net_amount) WHERE acc_type = \'CO\' within the fiscal window',
    indicator: 'COGS share 60–80% = Typical · > 85% = COGS-dominated · YoY cost growth > 10% = Severe',
    about: 'Cost of Sales is the variable cost base — the money spent to acquire the inventory that was sold in this window.\n\nTwo numbers matter here: the absolute RM direction, and the RATIO of COGS to Net Sales. A rising absolute COGS is expected when sales grow; a rising RATIO is the early warning for margin pressure.\n\nFor a Malaysian fruit distributor, a COGS share of 60–80% of Net Sales is typical. Drift toward 85%+ means margin is compressing; drift below 50% is unusual and worth a data-quality check. The card reads both current-window values and the prior-year same-window equivalents for comparison.',
  },

  fin_gross_profit: {
    name: 'Gross Profit',
    whatItMeasures: 'Net Sales minus Cost of Sales for the selected fiscal window, with gross margin % and prior-year comparison.',
    formula: 'Net Sales − Cost of Sales. Gross Margin % = Gross Profit ÷ Net Sales × 100',
    indicator: 'Gross margin < 15% = Severe · 15–20% = Watch · 20–25% = Typical · > 25% = Strong (fruit distribution)',
    about: 'Gross Profit is the spread between revenue and the cost of the goods that produced it. It is the first line where the business\'s economics become visible.\n\nAlways read BOTH dimensions — the absolute RM and the gross margin %. They can move in opposite directions:\n\n• RM up + margin up = unambiguously healthier, growing AND pricing better.\n• RM up + margin down = volume growth masking price / cost erosion. The top line looks fine, but each unit sold is less profitable than before.\n• RM down + margin up = shrinking but cleaner business.\n• RM down + margin down = compression on both axes — the most serious signal.\n\nFor a fruit distributor, a gross margin in the 20–25% range is typical. Below 15% is severe territory.',
  },

  fin_operating_costs: {
    name: 'Operating Costs',
    whatItMeasures: 'Total operating costs / OpEx (day-to-day running costs, distinct from COGS) for the selected fiscal window, with OpEx ratio against Net Sales.',
    formula: 'SUM(net_amount) WHERE acc_type = \'EP\' within the fiscal window. OpEx ratio = OpEx ÷ Net Sales × 100',
    indicator: 'OpEx ratio < 10% = Lean · 10–18% = Typical · 18–25% = Elevated · > 25% = Severe · YoY OpEx growth > 15% = Severe',
    about: 'Operating Costs capture the semi-fixed running costs of the business — salaries, rent, utilities, depreciation, vehicles, tooling. They are distinct from Cost of Sales (which scales with volume) and are the main lever for operating leverage.\n\nThe card tracks both the absolute RM and the OpEx ratio (OpEx ÷ Net Sales). The ratio is the more informative number for direction — a drifting-up ratio means OpEx is growing faster than Net Sales, which is scaling inefficiency.\n\nCompare OpEx YoY growth against Net Sales YoY growth: if OpEx is growing faster than sales, operating leverage is deteriorating regardless of the absolute margin position.',
  },

  fin_operating_profit: {
    name: 'Operating Profit',
    whatItMeasures: 'Gross Profit minus Operating Costs for the selected fiscal window — the cleanest read on core-business efficiency before non-operating items.',
    formula: 'Gross Profit − Operating Costs. Operating Margin % = Operating Profit ÷ Net Sales × 100',
    indicator: 'Operating margin < 0% = Severe (loss) · 0–5% = Thin · 5–10% = Healthy · > 10% = Strong',
    about: 'Operating Profit is the clearest read on whether the core business is making money. It is after COGS AND after OpEx, but BEFORE non-operating items (other income, tax).\n\nThe sign matters most: positive means the operating engine is producing profit on its own; negative means the fundamental business is losing money before any rental income, interest, or disposal gains are added back.\n\nThe common mismatch to watch for: Gross Profit positive while Operating Profit negative. That pattern says the GP exists but OpEx is erasing it — the fix is cost discipline, not revenue or pricing. Operating margin direction over time is the single best leading indicator for whether the business model is actually working at this scale.',
  },

  fin_net_profit: {
    name: 'Profit / Loss',
    whatItMeasures: 'Pre-tax net profit = Operating Profit + Other Income, for the selected fiscal window, with net margin and prior-year comparison.',
    formula: 'Gross Profit + Other Income − Operating Costs. Net Margin % = Net Profit ÷ Net Sales × 100',
    indicator: 'Net margin < 0% = Severe · 0–3% = Thin · 3–7% = Healthy · > 7% = Strong',
    about: 'Profit / Loss is the pre-tax bottom line. It adds non-operating income (rental, interest, disposal gains) on top of Operating Profit, which matters because it is the number most people quote when they talk about "profit" — but it can mask whether the core business is actually healthy.\n\nALWAYS read this alongside Operating Profit. If Net Profit is materially larger than Operating Profit, the delta is Other Income, and Other Income carrying the headline means the core business is weaker than the number suggests. A business that reports "RM 2M profit" with Operating Profit at RM -500K is really losing RM 500K in its core, offset by RM 2.5M of non-operating income — very different story from a clean RM 2M.\n\nEarnings quality is the narrative this card exists to tell.',
  },

  // ─── Financial page §10 — financial_pnl ──────────────────────────────────

  fin_pl_statement: {
    name: 'Profit & Loss Statement',
    whatItMeasures: 'Full P&L statement for the selected fiscal year vs prior year (YTD-aligned), showing every GL account grouped by account type (Sales, Sales Adjustments, Cost of Sales, Other Income, Operating Costs, Taxation) with group subtotals, Gross Profit, Net Profit, and Net Profit After Tax.',
    formula: 'Group subtotals = SUM(net_amount) per acc_type from pc_pnl_period within the fiscal window; Gross Profit = Net Sales − COGS; Net Profit = GP + Other Income − OpEx; NPAT = NP − Taxation',
    indicator: 'Group YoY < ±5% Flat · ±5-15% Moderate · > ±15% Material · Gross margin drift ±3pp Material / ±5pp Severe · Net margin drift ±2pp Material / ±3pp Severe · Any GP/NP/NPAT sign flip = Severe',
    about: 'This is the annual P&L statement in full detail — every group, every account, with a prior-year comparison aligned to the same YTD window so the comparison is apples-to-apples even mid-fiscal-year.\n\nThe statement answers a different question from the KPI cards above: it shows WHERE the RM went, not just how big each bucket is. Read it in two passes:\n\n• Group-level direction: which account-type subtotals moved, and in which direction? A material swing in COGS without a matching swing in Sales means margin pressure; a material swing in OpEx means structural cost change.\n• Account-level drivers: within each group, which specific GL accounts drove the swing? The AI analysis is constrained to the top-5 movers by absolute RM delta — large tails of small accounts are noise and deliberately excluded from the narrative.\n\nMargin direction is the other headline: Gross Margin and Net Margin percentages are computed at the YTD level and compared against prior YTD as a drift in percentage points. A 3pp gross-margin drop with Net Sales flat is structural cost inflation; the same drop while Net Sales is growing is volume-chasing at the expense of price discipline.',
  },

  fin_yoy_comparison: {
    name: 'Multi-Year Comparison',
    whatItMeasures: 'A 4-fiscal-year view of the core P&L line items (Net Sales, COGS, Gross Profit, Gross Margin %, Other Income, Operating Costs, Net Profit, Net Margin %, Taxation, Net Profit After Tax) for the selected FY and the three prior FYs, with partial FYs flagged.',
    formula: 'Per-FY totals from pc_pnl_period (one aggregate row per full fiscal year); CAGR = (last / first)^(1/years) − 1; margin drift = last_pct − first_pct (full FYs only)',
    indicator: 'Net Sales CAGR < -5% Declining · 5-15% Growing · > 15% Fast growth · Net Profit 3+ consecutive declines = Severe · GM drift > ±3pp = Material · NM drift > ±2pp = Material · Any NPAT sign flip = Severe',
    about: 'The single-year P&L tells you how the latest year looks; the multi-year view tells you what the business has been DOING — whether it is growing, shrinking, cyclically oscillating, or structurally changing its cost base over several fiscal cycles.\n\nThree readings matter:\n\n• Trajectory on the top line — use Net Sales CAGR across full fiscal years only. If the number is flat or declining, the business is not scaling regardless of how any single year looks.\n• Earnings direction — Net Profit does not need to move in lockstep with Net Sales. Consecutive declines are the single most important pattern: 3+ back-to-back declining years is the "slow-drift" pattern that rarely reverses without intervention.\n• Margin structure — Gross and Net margins drifting across the window (measured first-to-last, full years only) reveal whether the business is becoming more or less profitable per RM of sales. A widening gap between GM and NM drifts points to OpEx growing out of line with the core margin.\n\nPartial fiscal years are flagged with an asterisk and excluded from CAGR and streak calculations — comparing a 6-month year against a 12-month prior year is the single most common source of misleading YoY reads.',
  },

  fin_monthly_trend: {
    name: 'Monthly P&L Trend',
    whatItMeasures: 'Month-by-month Net Sales, COGS, Gross Profit, OpEx, and Operating Profit across the selected fiscal window (full FY, YTD, or trailing 12 months).',
    indicator: 'Any loss month = Watch · Loss months > 30% of window = Concern · First-to-last operating-profit decline > 25% = Severe',
    about: 'The trend chart takes the single-number KPIs and stretches them across the window month by month, so you can see HOW the numbers got to where they are — steady build, cliff, oscillation, or seasonal peak.\n\nWatch for three things:\n\n• Loss months: any single month where Operating Profit is negative is a watch signal. Cluster vs. scatter matters — clustered losses usually mean seasonality or a one-off event; scattered losses mean chronic weakness.\n• Sales-vs-profit divergence: if Net Sales is rising but Operating Profit is falling, margin is compressing in real time. That is the pattern the monthly view exposes that the aggregate KPIs hide.\n• First-to-last direction: use the pre-computed first-to-last growth lines for headline direction. Arbitrary sub-window averages are not allowed — the AI analysis is constrained to the pre-computed roll-ups to prevent fabricated narratives.\n\nThe chart reads in fiscal order (March → February), not calendar order. The range selector at the top of the page controls which months appear.',
  },

  // ─── Financial page §11 — financial_balance_sheet ────────────────────────

  bs_trend: {
    name: 'Assets, Liabilities & Equity Trend',
    whatItMeasures: 'A monthly time series of Total Assets, Total Liabilities, and Equity across the selected fiscal window, rebuilt for each month from opening balance + cumulative movements.',
    formula: 'For each period_no p in the window: Total Assets = Fixed + Other + (Current Assets − Current Liabilities); Total Liabilities = CL + LL + OL; Equity = Capital + Retained Earnings (incl. current-year P&L). Gearing = Total Liabilities ÷ Total Assets',
    indicator: 'First→last Total Assets growth < -5% Shrinking · 5-15% Growing · > 15% Fast · 3+ consecutive equity-decline months = Severe · Gearing drift > +5pp = Severe · Any month with Liabilities > Assets = Severe (insolvency)',
    about: 'The balance sheet is a snapshot — this chart stretches three of its key aggregates across the fiscal window so you can see the DIRECTION, not just the latest number.\n\nRead the three lines as a system, not individually:\n\n• If Total Assets and Equity both rise, the business is building real value.\n• If Total Assets rise while Equity is flat, the growth is being financed by liabilities — leverage is increasing.\n• If Total Liabilities rise faster than Total Assets, gearing is deteriorating even if the headline Assets number looks healthy.\n• If Equity is drifting down month after month, the business is either paying out more than it earns or absorbing losses into reserves. Either way, the equity cushion is thinning.\n\nThe single most important flag is any month where Total Liabilities exceed Total Assets — that is balance-sheet insolvency, and it must always be called out explicitly by month. The pre-computed first-to-last growth figures are authoritative; the AI is not allowed to invent averages over arbitrary sub-windows.',
  },

  // ─── Financial page §12 — financial_variance (FP&A) ──────────────────────

  fv_variance_summary: {
    name: 'P&L Variance Summary',
    whatItMeasures: 'Comparison of each P&L line item (Net Sales, COGS, Gross Profit, OpEx, Operating Profit, Other Income, Net Profit) against the same period last year, with favourable/unfavourable classification and margin drift.',
    formula: 'Variance = Actual − Baseline (prior year same window). Var % = (Actual − Baseline) ÷ |Baseline| × 100. Favourable = revenue up or cost down; Unfavourable = revenue down or cost up.',
    indicator: '±5% = On Track · ±5–15% = Moderate · > ±15% = Material · Sign flip = Severe',
    about: 'The variance summary compares your current fiscal window against the SAME window last year — this is your baseline. It is NOT a formal budget; it is what your business actually did in the same period 12 months ago.\n\nEach line item is classified as Favourable (better than baseline) or Unfavourable (worse). Revenue lines are favourable when they go up; cost lines are favourable when they go down.\n\nThe margin drift (in percentage points) is the most important number here — a small RM variance can hide a meaningful margin shift, and vice versa.',
  },

  fv_variance_breakdown: {
    name: 'Variance by Account',
    whatItMeasures: 'Account-level breakdown of P&L variance within each category (Sales, COGS, OpEx, Other Income), showing which specific GL accounts drove the overall variance.',
    formula: 'Per-account: Variance = Current YTD − Prior YTD. Concentration = Top 3 accounts |variance| ÷ category total |variance| × 100.',
    indicator: 'Single account > 30% of category variance = Concentrated · Top 3 > 70% = Highly concentrated · Account variance > ±50% = Flag',
    about: 'This breakdown answers "which specific accounts explain the variance." The top movers per category are shown first.\n\nConcentration matters — if one or two accounts drive most of the category variance, the variance has a clear, addressable cause. If variance is spread across many small accounts, the movement is structural rather than account-specific.\n\nAccount names come from the GL (general ledger) in AutoCount.',
  },

  fv_trend_forecast: {
    name: 'Trend Forecast',
    whatItMeasures: 'Next-period projection of Net Sales, Gross Profit, and Net Profit based on the recent monthly trend within the selected fiscal window.',
    formula: 'Avg Monthly Change = mean of month-over-month deltas. Forecast = Last Actual + Avg Monthly Change. Consistency = months moving in same direction ÷ total months.',
    indicator: 'Consistent 4+ months = Strong signal · Mixed/oscillating = Weak signal · Forecast sign flip = Severe',
    about: 'This forecast is a simple trend extrapolation — it takes the average month-over-month change and projects it one period forward. It is NOT a statistical model or formal financial projection.\n\nThe signal strength tells you how reliable the trend is: if most months moved in the same direction, the forecast is on firmer ground. If months oscillated, the forecast is directional guidance only.\n\nThe forecast is clearly labelled as an AI estimate. When formal budgets are available, they will replace this derived baseline.',
  },

  bs_statement: {
    name: 'Balance Sheet Statement',
    whatItMeasures: 'The full balance sheet for the selected fiscal year vs 12 periods prior (YTD-aligned), with all 8 line items by account type, derived totals (Net Current Assets, Total Assets, Total Liabilities, Total Equity), and solvency ratios (Current Ratio, Debt-to-Equity, Equity Ratio).',
    formula: 'Line items from pc_pnl_period (opening balance + cumulative movements to period_to). Current Ratio = Current Assets ÷ Current Liabilities. Debt-to-Equity = Total Liabilities ÷ Total Equity. Equity Ratio = Total Equity ÷ Total Assets × 100',
    indicator: 'Current Ratio < 1.0 Severe / > 2.0 Strong · Debt-to-Equity > 2.0 Severe / < 0.5 Conservative · Equity Ratio < 20% Severe / > 60% Strong · Any Net Current Assets sign flip = Severe · Any Total Equity sign flip = Severe (insolvency)',
    about: 'This is the balance sheet in full detail — every line item against the same YTD window a year ago, so the comparison is apples-to-apples. Read it in two passes.\n\n• Line-by-line direction: which of the 8 accounts moved the most in RM terms? The AI analysis is constrained to the top-3 biggest movers by absolute delta — small line-level noise is deliberately excluded to keep the narrative focused.\n• Ratios are the real story: the RM numbers tell you WHAT changed, but the three ratios tell you WHETHER the change is healthy.\n\nCurrent Ratio is the short-term liquidity test — can the business pay what it owes this year out of what it can convert to cash this year? Below 1.0 is a hard warning.\n\nDebt-to-Equity is the structural leverage test — how much of the business is financed by outsiders versus owners? Above 2.0 means creditors have more claim on the business than owners do.\n\nEquity Ratio is the solvency cushion — how much of the asset base is genuinely owned versus pledged against liabilities? Below 20% is dangerously thin.\n\nThe two sign flips (Net Current Assets going negative, or Total Equity going negative) are hard severe-level signals that must always be called out explicitly.',
  },
};
