'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export type CostType = 'all' | 'cogs' | 'opex';
export type Granularity = 'daily' | 'weekly' | 'monthly';

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  costType: CostType;
  granularity: Granularity;
  categories: string[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFilters() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/expenses/cost/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: fiscalYears } = useSWR<{ data: Array<{ FiscalYearName: string; FromDate: string; ToDate: string }> }>(
    '/api/expenses/cost/fiscal-years',
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
        costType: 'all',
        granularity: 'monthly',
        categories: [],
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
      costType: 'all' as CostType,
      granularity: 'monthly' as Granularity,
      categories: [],
    },
    setFilters,
    ready,
    bounds,
    fiscalYears: fiscalYears?.data ?? [],
  };
}
