'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths } from 'date-fns';

export type Granularity = 'monthly' | 'quarterly' | 'yearly';

export interface DashboardFiltersV2 {
  startDate: string;
  endDate: string;
  granularity: Granularity;
  supplierTypes: string[];
  suppliers: string[];
  itemGroups: string[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFiltersV2() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/supplier-performance/margin/v2/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [filters, setFiltersState] = useState<DashboardFiltersV2 | null>(null);

  // Initialize filters once bounds arrive
  useEffect(() => {
    if (bounds && !filters) {
      const endDate = new Date(bounds.max_date);
      const startDate = subMonths(endDate, 12);
      setFiltersState({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        granularity: 'monthly',
        supplierTypes: [],
        suppliers: [],
        itemGroups: [],
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
      supplierTypes: [],
      suppliers: [],
      itemGroups: [],
    },
    setFilters,
    ready,
    bounds,
  };
}
