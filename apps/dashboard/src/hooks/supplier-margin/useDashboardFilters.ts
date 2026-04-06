'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export type Granularity = 'monthly' | 'quarterly' | 'yearly';

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  granularity: Granularity;
  suppliers: string[];
  itemGroups: string[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFilters() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/supplier-performance/margin/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [filters, setFiltersState] = useState<DashboardFilters | null>(null);

  // Initialize filters once bounds arrive
  useEffect(() => {
    if (bounds?.max_date && !filters) {
      const endDate = endOfMonth(new Date(bounds.max_date));
      const startDate = startOfMonth(subMonths(endDate, 11));
      setFiltersState({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        granularity: 'monthly',
        suppliers: [],
        itemGroups: [],
      });
    }
  }, [bounds, filters]);

  const setFilters = useCallback((updates: Partial<DashboardFilters>) => {
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
      suppliers: [],
      itemGroups: [],
    },
    setFilters,
    ready,
    bounds,
  };
}
