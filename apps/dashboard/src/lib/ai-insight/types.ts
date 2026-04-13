// ─── AI Insight Engine — Shared Types ────────────────────────────────────────

export type PageKey = 'payment' | 'sales';

export type SectionKey =
  | 'payment_collection_trend'
  | 'payment_outstanding'
  | 'sales_trend'
  | 'sales_breakdown';

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

export interface AnalyzeRequest {
  page: PageKey;
  section_key: SectionKey;
  date_range: DateRange | null; // null for snapshot sections
  user_name: string;
}

export interface SummaryInsight {
  title: string;
  metric?: string; // Short label for the metric area, e.g. "DSO", "Collection Rate"
  summary?: string; // One-line plain-text preview shown on the collapsed card (no markdown)
  detail: string;
}

export interface SummaryJson {
  good: SummaryInsight[];
  bad: SummaryInsight[];
}

export interface ComponentResult {
  component_key: string;
  component_type: ComponentType;
  raw_data_md: string;
  analysis_md: string;
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
