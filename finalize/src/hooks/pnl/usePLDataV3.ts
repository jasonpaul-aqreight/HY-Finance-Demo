'use client';

import useSWR from 'swr';
import type {
  V2KpiData,
  V2MonthlyResponse,
  V2StatementResponse,
  V2YoYLineItem,
} from '@/types/pnl-v2';
import type { BSTrendRow, BSSnapshotResponse } from '@/lib/pnl/queries';

interface BSComparisonResponse {
  current: BSSnapshotResponse;
  prior: BSSnapshotResponse;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildParams(fy: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ fy });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
  }
  return params.toString();
}

export function useV3Kpis(fy: string) {
  return useSWR<V2KpiData>(
    fy ? `/api/pnl/v3/kpis?${buildParams(fy)}` : null,
    fetcher
  );
}

export function useV3Monthly(fy: string, range = 'fy') {
  return useSWR<V2MonthlyResponse>(
    fy ? `/api/pnl/v3/monthly?${buildParams(fy, { range })}` : null,
    fetcher
  );
}

export function useV3Statement(fy: string) {
  return useSWR<V2StatementResponse>(
    fy ? `/api/pnl/v3/statement?${buildParams(fy)}` : null,
    fetcher
  );
}

export function useV3YoY(fy: string) {
  return useSWR<V2YoYLineItem[]>(
    fy ? `/api/pnl/v3/yoy?${buildParams(fy)}` : null,
    fetcher
  );
}

export function useV3BSComparison(fy: string) {
  return useSWR<BSComparisonResponse>(
    fy ? `/api/pnl/v3/bs-snapshot?${buildParams(fy)}` : null,
    fetcher
  );
}

export function useV3BSTrend(fy: string, range = 'fy') {
  return useSWR<BSTrendRow[]>(
    fy ? `/api/pnl/v3/bs-trend?${buildParams(fy, { range })}` : null,
    fetcher
  );
}

export interface MultiYearPLRow {
  fy: string;
  fyNumber: number;
  isPartial: boolean;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  other_income: number;
  expenses: number;
  net_profit: number;
  net_margin_pct: number;
  taxation: number;
  npat: number;
}

export function useMultiYearPL() {
  return useSWR<MultiYearPLRow[]>('/api/pnl/v3/multi-year', fetcher);
}
