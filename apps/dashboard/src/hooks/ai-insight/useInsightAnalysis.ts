'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  SectionKey,
  PageKey,
  DateRange,
  FiscalPeriod,
  SSEProgressData,
  LockStatus,
  SummaryJson,
} from '@/lib/ai-insight/types';

export interface SectionInsightData {
  section_id: number;
  summary_json: SummaryJson;
  analysis_time_s: number;
  token_count: number;
  cost_usd: number;
  date_range_start: string | null;
  date_range_end: string | null;
  generated_by: string;
  generated_at: string;
}

export type InsightStatus = 'idle' | 'loading' | 'analyzing' | 'complete' | 'error' | 'blocked';

export interface ProgressLine {
  component: string;
  status: 'analyzing' | 'complete' | 'error';
  message?: string;
}

export function useInsightAnalysis(page: PageKey, sectionKey: SectionKey) {
  const [status, setStatus] = useState<InsightStatus>('idle');
  const [data, setData] = useState<SectionInsightData | null>(null);
  const [progress, setProgress] = useState<ProgressLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Fetch existing stored insight on mount
  const fetchStored = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/ai-insight/section/${sectionKey}`);
      if (res.ok) {
        const json = await res.json();
        if (json.exists) {
          setData(json);
          setStatus('complete');
          return;
        }
      }
      setStatus('idle');
    } catch {
      setStatus('idle');
    }
  }, [sectionKey]);

  // Check lock status
  const checkLock = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-insight/status');
      const lock: LockStatus = await res.json();
      setLockStatus(lock);
      if (lock.locked && lock.section_key !== sectionKey) {
        setStatus('blocked');
      }
      return lock;
    } catch {
      return null;
    }
  }, [sectionKey]);

  // Start analysis via SSE
  const analyze = useCallback(
    async (dateRange: DateRange | null, userName: string, fiscalPeriod: FiscalPeriod | null = null) => {
      // Check lock first
      const lock = await checkLock();
      if (lock?.locked) {
        setStatus('blocked');
        return;
      }

      setStatus('analyzing');
      setProgress([]);
      setError(null);

      const res = await fetch('/api/ai-insight/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          section_key: sectionKey,
          date_range: dateRange,
          fiscal_period: fiscalPeriod,
          user_name: userName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
        if (res.status === 409) {
          setLockStatus({ locked: true, locked_by: err.locked_by, locked_at: null, section_key: err.section_key });
          setStatus('blocked');
        } else {
          setError(err.error || 'Analysis failed');
          setStatus('error');
        }
        return;
      }

      // Read SSE stream using fetch + ReadableStream (EventSource doesn't support POST)
      const reader = res.body?.getReader();
      if (!reader) {
        setError('No response stream');
        setStatus('error');
        return;
      }
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ') && eventType) {
              const payload = JSON.parse(line.slice(6));
              handleSSEEvent(eventType, payload);
              eventType = '';
            }
          }
        }
      } catch {
        // Reader was cancelled (e.g. by cancel button) — ignore
      } finally {
        readerRef.current = null;
      }
    },
    [page, sectionKey, checkLock],
  );

  function handleSSEEvent(event: string, data: Record<string, unknown>) {
    switch (event) {
      case 'progress': {
        const p = data as unknown as SSEProgressData;
        setProgress((prev) => {
          const existing = prev.findIndex((l) => l.component === p.component);
          const line: ProgressLine = { component: p.component, status: p.status, message: p.message };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = line;
            return next;
          }
          return [...prev, line];
        });
        break;
      }
      case 'complete': {
        // Refetch the stored data to get full summary_json
        fetchStored();
        break;
      }
      case 'cancelled': {
        setError((data.message as string) || 'Analysis cancelled');
        setStatus('idle');
        // Reload previous stored result if any
        fetchStored();
        break;
      }
      case 'error': {
        setError((data.message as string) || 'Analysis failed');
        setStatus('error');
        break;
      }
    }
  }

  // Cancel running analysis
  const cancel = useCallback(async () => {
    // Immediately update local state so UI responds instantly
    setStatus('idle');
    setProgress([]);
    setError(null);

    // Cancel the client-side SSE reader
    if (readerRef.current) {
      try {
        readerRef.current.cancel();
      } catch {
        // Best effort
      }
      readerRef.current = null;
    }

    // Tell the server to abort
    try {
      await fetch('/api/ai-insight/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_key: sectionKey }),
      });
    } catch {
      // Best effort
    }

    // Reload previous stored result if any
    fetchStored();
  }, [sectionKey, fetchStored]);

  // Load stored insight on mount
  useEffect(() => {
    fetchStored();
  }, [fetchStored]);

  return {
    status,
    data,
    progress,
    error,
    lockStatus,
    analyze,
    cancel,
    refetch: fetchStored,
    checkLock,
  };
}
