'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths } from 'date-fns';

export interface DashboardFiltersV2 {
  startDate: string;
  endDate: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFiltersV2() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/payment/v2/date-bounds',
    fetcher,
    { revalidateOnFocus: false },
  );

  const [filters, setFiltersState] = useState<DashboardFiltersV2 | null>(null);

  // Initialize filters once bounds arrive
  useEffect(() => {
    if (bounds && !filters) {
      const endDate = new Date(bounds.max_date);
      const startDate = subMonths(endDate, 11);
      startDate.setDate(1);
      setFiltersState({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
    }
  }, [bounds, filters]);

  const setFilters = useCallback((updates: Partial<DashboardFiltersV2>) => {
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
