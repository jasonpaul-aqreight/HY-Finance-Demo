import useSWR from 'swr';

export const AI_INSIGHT_BATCH_STATUS_KEY = '/api/admin/ai-insight/batch/status';

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  });

export type BatchRunState = 'idle' | 'running' | 'success' | 'partial' | 'error';

export interface BatchSectionError {
  sectionKey: string;
  message: string;
}

export interface BatchRunStatus {
  id?: number;
  status: BatchRunState;
  started_at?: string | null;
  finished_at?: string | null;
  total_runtime_s?: number | null;
  total_cost_usd?: number | null;
  total_tokens?: number | null;
  sections_total: number;
  sections_completed: number;
  sections_failed: number;
  current_section?: string | null;
  section_errors: BatchSectionError[];
  error_message?: string | null;
  triggered_by?: string | null;
  created_at?: string | null;
}

export function useBatchStatus(isRunning?: boolean) {
  return useSWR<BatchRunStatus>(
    AI_INSIGHT_BATCH_STATUS_KEY,
    fetcher,
    { refreshInterval: isRunning ? 2000 : 10000 },
  );
}
