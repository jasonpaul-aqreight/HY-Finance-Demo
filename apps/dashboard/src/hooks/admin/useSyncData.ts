import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

export interface SyncStatus {
  status: 'idle' | 'running';
  progress: string;
  lastResult: SyncResult | null;
}

export interface SyncResult {
  jobId: number;
  status: 'success' | 'error';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalRows: number;
  error?: string;
}

export interface SyncJob {
  id: number;
  status: 'success' | 'error';
  trigger_type: 'manual' | 'scheduled';
  started_at: string;
  completed_at: string;
  tables_total: number;
  tables_completed: number;
  rows_synced: number;
  error_message: string | null;
  created_at: string;
}

export interface SyncSchedule {
  cron_expression: string;
  is_active: boolean;
  timezone?: string;
  updated_at?: string;
}

export interface SyncLogEntry {
  table_name: string;
  phase: string;
  message: string;
  rows_affected: number;
  duration_ms: number;
  level: 'info' | 'error' | 'warning';
  timestamp: string;
}

export function useSyncStatus(isRunning?: boolean) {
  return useSWR<SyncStatus>(
    '/api/admin/sync/status',
    fetcher,
    { refreshInterval: isRunning ? 2000 : 10000 }
  );
}

export function useSyncHistory() {
  return useSWR<SyncJob[]>('/api/admin/sync/history', fetcher, {
    refreshInterval: 15000,
  });
}

export function useSyncSchedule() {
  return useSWR<SyncSchedule>('/api/admin/sync/schedule', fetcher);
}

export function useSyncLogs(jobId: number | null) {
  return useSWR<SyncLogEntry[]>(
    jobId ? `/api/admin/sync/logs/${jobId}` : null,
    fetcher
  );
}
