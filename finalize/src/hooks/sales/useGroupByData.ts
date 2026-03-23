'use client';

import useSWR from 'swr';
import type { DashboardFiltersV2 } from './useDashboardFiltersV2';
import type { GroupByRow, StackedRow } from '@/lib/sales/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useGroupByData(filters: DashboardFiltersV2) {
  // Always fetch non-stacked data (for table + default chart)
  const baseParams = new URLSearchParams({
    group: filters.groupBy,
    start_date: filters.startDate,
    end_date: filters.endDate,
  });

  const { data: baseData, isLoading: baseLoading } = useSWR<{ group: string; data: GroupByRow[] }>(
    `/api/sales/revenue/v2/group-by?${baseParams}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Conditionally fetch stacked data when stackBy is set
  const stackParams = filters.stackBy
    ? new URLSearchParams({ ...Object.fromEntries(baseParams), stack: filters.stackBy })
    : null;

  const { data: stackData, isLoading: stackLoading } = useSWR<{ group: string; stack: string; data: StackedRow[] }>(
    stackParams ? `/api/sales/revenue/v2/group-by?${stackParams}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    data: baseData?.data ?? [],
    stackedData: stackData?.data ?? [],
    isStacked: !!filters.stackBy && !!stackData?.data,
    isLoading: baseLoading || (!!filters.stackBy && stackLoading),
  };
}
