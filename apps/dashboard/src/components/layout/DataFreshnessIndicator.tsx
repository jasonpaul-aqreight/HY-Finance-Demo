'use client';

import useSWR from 'swr';
import { AlertTriangle, XCircle } from 'lucide-react';

interface SyncFreshness {
  status: string;
  completed_at: string | null;
  error_message: string | null;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

function formatMYT(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function DataFreshnessIndicator() {
  const { data } = useSWR<SyncFreshness>(
    '/api/sync-freshness',
    fetcher,
    { refreshInterval: 60000 }
  );

  if (!data || data.status === 'success' || data.status === 'none') {
    return null;
  }

  const timestamp = data.completed_at ? formatMYT(data.completed_at) : '';

  if (data.status === 'partial') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Some data may be outdated — last sync: {timestamp}</span>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-900 text-sm font-medium">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Last data sync failed — {timestamp}</span>
      </div>
    );
  }

  return null;
}
