'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface V2Filters {
  startDate: string;
  endDate: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFiltersV2() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/return/credit-v2/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [filters, setFiltersState] = useState<V2Filters | null>(null);

  // Initialize filters once bounds arrive
  useEffect(() => {
    if (bounds && !filters) {
      const endDate = endOfMonth(new Date(bounds.max_date));
      const startDate = startOfMonth(subMonths(endDate, 11));
      setFiltersState({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
    }
  }, [bounds, filters]);

  const setFilters = useCallback((updates: Partial<V2Filters>) => {
    setFiltersState(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  const ready = !!filters;

  return {
    filters: filters ?? { startDate: '', endDate: '' },
    setFilters,
    ready,
    bounds,
  };
}
