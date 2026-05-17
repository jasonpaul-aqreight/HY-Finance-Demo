'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  SectionKey,
  PageKey,
  DateRange,
  FiscalPeriod,
  SummaryJson,
  AiProviderMetadata,
} from '@/lib/ai-insight/types';

export interface SectionInsightData {
  section_id: number;
  summary_json: SummaryJson;
  analysis_time_s: number;
  token_count: number;
  cost_usd: number;
  date_range_start: string | null;
  date_range_end: string | null;
  fiscal_year: string | null;
  fiscal_range: string | null;
  generated_by: string;
  generated_at: string;
  provider_metadata?: AiProviderMetadata | null;
}

type ReadOnlyInsightStatus = 'idle' | 'loading' | 'complete' | 'error';

// TEMP: removed in Phase 4 when AiInsightPanel drops manual analysis states.
export type InsightStatus = ReadOnlyInsightStatus | 'analyzing' | 'blocked';

// TEMP: removed in Phase 4 when AiInsightPanel drops progress rendering.
export interface ProgressLine {
  component: string;
  status: 'analyzing' | 'complete' | 'error';
  message?: string;
}

// TEMP: removed in Phase 4 when AiInsightPanel drops lock rendering.
interface LegacyLockInfo {
  locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  section_key: string | null;
}

export function useInsightAnalysis(page: PageKey, sectionKey: SectionKey) {
  const [status, setStatus] = useState<ReadOnlyInsightStatus>('idle');
  const [data, setData] = useState<SectionInsightData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing stored insight on mount
  const fetchStored = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`/api/ai-insight/section/${sectionKey}?page=${encodeURIComponent(page)}`);

      if (res.status === 404) {
        setData(null);
        setStatus('idle');
        return;
      }

      if (res.ok) {
        const json = await res.json();
        if (json.exists) {
          setData(json);
          setStatus('complete');
          return;
        }
      }

      if (!res.ok) {
        throw new Error('Failed to load saved insight');
      }

      setData(null);
      setStatus('idle');
    } catch {
      setError('Failed to load saved insight');
      setStatus('error');
    }
  }, [page, sectionKey]);

  // TEMP: removed in Phase 4 when AiInsightPanel no longer accepts manual analysis props.
  const analyze = useCallback((dateRange: DateRange | null, userName: string, fiscalPeriod: FiscalPeriod | null = null) => {
    void dateRange;
    void userName;
    void fiscalPeriod;
  }, []);

  // TEMP: removed in Phase 4 when AiInsightPanel no longer accepts manual analysis props.
  const cancel = useCallback(() => {}, []);

  // Load stored insight on mount
  useEffect(() => {
    fetchStored();
  }, [fetchStored]);

  return {
    status,
    data,
    // TEMP: removed in Phase 4 when AiInsightPanel drops progress rendering.
    progress: [] as ProgressLine[],
    error,
    // TEMP: removed in Phase 4 when AiInsightPanel drops lock rendering.
    lockStatus: null as LegacyLockInfo | null,
    analyze,
    cancel,
    refetch: fetchStored,
  };
}
