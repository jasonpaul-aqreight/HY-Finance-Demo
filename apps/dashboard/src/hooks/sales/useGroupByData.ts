'use client';

import useSWR from 'swr';
import type { DashboardFiltersV2 } from './useDashboardFiltersV2';
import type { GroupByRow } from '@/lib/sales/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useGroupByData(filters: DashboardFiltersV2) {
  const baseParams = new URLSearchParams({
    group: filters.groupBy,
    start_date: filters.startDate,
    end_date: filters.endDate,
  });

  const { data: baseData, isLoading } = useSWR<{ group: string; data: GroupByRow[] }>(
    filters.startDate ? `/api/sales/revenue/v2/group-by?${baseParams}` : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  return {
    data: baseData?.data ?? [],
    isLoading,
  };
}
