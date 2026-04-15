// ─── AI Insight Engine — Shared Types ────────────────────────────────────────

export type PageKey = 'payment' | 'sales' | 'customer-margin' | 'supplier-performance' | 'return' | 'expenses' | 'financial';

export type SectionKey =
  | 'payment_collection_trend'
  | 'payment_outstanding'
  | 'sales_trend'
  | 'sales_breakdown'
  | 'customer_margin_overview'
  | 'customer_margin_breakdown'
  | 'supplier_margin_overview'
  | 'supplier_margin_breakdown'
  | 'return_trend'
  | 'return_unsettled'
  | 'expense_overview'
  | 'expense_breakdown'
  | 'financial_overview'
  | 'financial_pnl';

export type ComponentType = 'kpi' | 'chart' | 'table' | 'breakdown';

export interface ComponentDef {
  key: string;
  name: string;
  type: ComponentType;
  sectionKey: SectionKey;
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

// Fiscal-period scope — used by the Financial page, which filters by fiscal year
// + a named window ('fy' = full FY, 'last12' = trailing 12 months, 'ytd' = year-to-date)
// instead of calendar {start, end}. Sibling type to DateRange, not a union, so
// existing calendar-scoped fetchers keep their signatures unchanged.
export type FiscalRange = 'fy' | 'last12' | 'ytd';

export interface FiscalPeriod {
  fiscalYear: string; // e.g. "FY2025"
  range: FiscalRange;
}

export interface AnalyzeRequest {
  page: PageKey;
  section_key: SectionKey;
  date_range: DateRange | null;            // calendar scope + null for snapshots
  fiscal_period?: FiscalPeriod | null;     // fiscal_period scope (Financial page)
  user_name: string;
}

export interface SummaryInsight {
  title: string;
  metric?: string; // Short label for the metric area, e.g. "DSO", "Collection Rate"
  summary?: string; // One-line plain-text preview shown on the collapsed card (no markdown)
  detail: string;
}

export interface NumericGuardReport {
  passed: boolean;
  attempts: number;
  unmatched: { raw: string; value: number; unit: string }[];
}

export interface SummaryJson {
  good: SummaryInsight[];
  bad: SummaryInsight[];
  numericGuard?: NumericGuardReport;
}

export type AllowedValueUnit = 'RM' | 'pct' | 'days' | 'count';

export interface AllowedValue {
  label: string;          // human-readable description, e.g. "H1 avg neg gap"
  value: number;          // raw numeric value (RM = ringgit, pct = 0-100, days, count)
  tolerance?: number;     // absolute tolerance; defaults applied by guard if omitted
  unit?: AllowedValueUnit;
}

export interface FetcherResult {
  prompt: string;
  allowed: AllowedValue[];
}

export interface ComponentResult {
  component_key: string;
  component_type: ComponentType;
  raw_data_md: string;
  analysis_md: string;
  allowed: AllowedValue[];
  token_count: number;
  input_tokens: number;
  output_tokens: number;
}

export interface SectionResult {
  section_id: number;
  summary_json: SummaryJson;
  components: ComponentResult[];
  analysis_time_s: number;
  token_count: number;
  cost_usd: number;
}

export interface LockStatus {
  locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  section_key: string | null;
}

// SSE event types
export type SSEEventType = 'progress' | 'complete' | 'error' | 'cancelled';

export interface SSEProgressData {
  component: string;
  status: 'analyzing' | 'complete' | 'error';
  message?: string;
}

export interface SSECompleteData {
  section_id: number;
  analysis_time_s: number;
  token_count: number;
  cost_usd: number;
}
