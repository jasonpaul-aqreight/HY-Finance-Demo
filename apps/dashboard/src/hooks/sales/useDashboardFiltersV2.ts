'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { GroupByDimension } from '@/lib/sales/types';

export type Granularity = 'daily' | 'weekly' | 'monthly';

export interface DashboardFiltersV2 {
  startDate: string;
  endDate: string;
  granularity: Granularity;
  groupBy: GroupByDimension;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFiltersV2() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/sales/revenue/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [filters, setFiltersState] = useState<DashboardFiltersV2 | null>(null);

  // Initialize filters once bounds arrive
  useEffect(() => {
    if (bounds && !filters) {
      const endDate = endOfMonth(new Date(bounds.max_date));
      const startDate = startOfMonth(subMonths(endDate, 11));
      setFiltersState({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        granularity: 'monthly',
        groupBy: 'customer' as GroupByDimension,
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
    filters: filters ?? {
      startDate: '',
      endDate: '',
      granularity: 'monthly' as Granularity,
      groupBy: 'customer' as GroupByDimension,
    },
    setFilters,
    ready,
    bounds,
  };
}
