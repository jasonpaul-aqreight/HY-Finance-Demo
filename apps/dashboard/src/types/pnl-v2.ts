// --- V2 API Response Types ------------------------------------------------

export interface V2KpiData {
  net_sales: number;
  gross_profit: number;
  gross_margin_pct: number;
  other_income: number;
  expenses: number;
  net_profit: number;
  net_margin_pct: number;
  expense_ratio: number;
  prev_net_sales: number;
  prev_gross_profit: number;
  prev_gross_margin_pct: number;
  prev_net_profit: number;
  prev_net_margin_pct: number;
  prev_expense_ratio: number;
  sparkline: { period: number; label: string; net_sales: number; gross_profit: number; net_profit: number }[];
}

export interface V2MonthlyRow {
  period: number;
  label: string;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  other_income: number;
  expenses: number;
  net_profit: number;
}

export interface V2MonthlyResponse {
  data: V2MonthlyRow[];
  avg_net_profit: number;
}

export interface V2PeriodValues {
  current_month: number;
  prev_month: number;
  ytd: number;
  prior_ytd: number;
  monthly: number[];
}

export interface V2StatementAccount {
  accno: string;
  description: string;
  current_month: number;
  prev_month: number;
  ytd: number;
  prior_ytd: number;
  monthly: number[];
}

export interface V2StatementGroup {
  acc_type: string;
  acc_type_name: string;
  seq: number;
  accounts: V2StatementAccount[];
  subtotal: V2PeriodValues;
}

export interface V2MarginValues {
  monthly: number[];
  ytd: number;
  prior_ytd: number;
}

export interface V2StatementResponse {
  current_period_label: string;
  prev_period_label: string;
  months: { period: number; label: string }[];
  groups: V2StatementGroup[];
  computed: {
    net_sales: V2PeriodValues;
    gross_profit: V2PeriodValues;
    net_profit: V2PeriodValues;
    net_profit_after_tax: V2PeriodValues;
    gpm: V2MarginValues;
    npm: V2MarginValues;
  };
}

export interface V2SegmentRow {
  segment: string;
  segment_name: string;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gm_pct: number;
  expenses: number;
  net_profit: number;
}

export interface V2ExpenseItem {
  accno: string;
  name: string;
  amount: number;
  pct_of_total: number;
}

export interface V2ExpenseResponse {
  items: V2ExpenseItem[];
  total_expenses: number;
  expense_to_revenue_ratio: number;
}

export interface V2ExpenseTrendRow {
  period: number;
  label: string;
  expenses: Record<string, number>;
}

export interface V2COGSComponent {
  accno: string;
  name: string;
  amount: number;
}

export interface V2COGSMonthly {
  period: number;
  label: string;
  components: V2COGSComponent[];
  total: number;
}

export interface V2COGSResponse {
  monthly: V2COGSMonthly[];
  ratios: {
    cogs_revenue_pct: number;
    discount_purchases_pct: number;
    returns_purchases_pct: number;
  };
}

export interface V2HealthResponse {
  current_ratio: number;
  working_capital: number;
  ar_turnover: number;
  ap_turnover: number;
  ar_days: number;
  ap_days: number;
}

export interface V2YoYLineItem {
  line_item: string;
  acc_type: string;
  current_fy: number;
  prior_fy: number;
  change: number;
  growth_pct: number | null;
}

export type CompareMode = 'mom' | 'yoy';

export interface V2DashboardFilters {
  fiscalYear: string;
  projects: string[];
  compareMode: CompareMode;
}
