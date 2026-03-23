'use client';

import useSWR from 'swr';
import type { BSSnapshotResponse, BSKpisResponse, BSTrendRow } from '@/lib/pnl/queries';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useBSSnapshot(periodTo: number, project: string) {
  const params = new URLSearchParams({ period_to: String(periodTo) });
  if (project && project !== 'ALL') params.set('project', project);
  return useSWR<BSSnapshotResponse>(`/api/pnl/bs/snapshot?${params}`, fetcher);
}

export function useBSKpis(periodTo: number) {
  const params = new URLSearchParams({ period_to: String(periodTo) });
  return useSWR<BSKpisResponse>(`/api/pnl/bs/kpis?${params}`, fetcher);
}

export function useBSTrend() {
  return useSWR<BSTrendRow[]>('/api/pnl/bs/trend?periods=12', fetcher);
}
