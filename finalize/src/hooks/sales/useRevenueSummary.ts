'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Filters {
  startDate: string;
  endDate: string;
  granularity: string;
  locations: string[];
  agents: string[];
}

export function useRevenueSummary(filters: Filters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR(
    `/api/sales/revenue/summary?${params}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useRevenueTrend(filters: Filters | null) {
  const key = filters && filters.startDate
    ? `/api/sales/revenue/trend?${new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        granularity: filters.granularity,
      })}`
    : null;
  return useSWR(key, fetcher, { revalidateOnFocus: false });
}
