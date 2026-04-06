'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface MarginDashboardFilters {
  startDate: string;
  endDate: string;
  customers: string[];
  types: string[];
  agents: string[];
  productGroups: string[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFilters() {
  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/customer-margin/margin/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const [filters, setFiltersState] = useState<MarginDashboardFilters | null>(null);

  // Initialize filters once bounds arrive
  useEffect(() => {
    if (bounds && !filters) {
      const endDate = endOfMonth(new Date(bounds.max_date));
      const startDate = startOfMonth(subMonths(endDate, 11));
      setFiltersState({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        customers: [],
        types: [],
        agents: [],
        productGroups: [],
      });
    }
  }, [bounds, filters]);

  const setFilters = useCallback((updates: Partial<MarginDashboardFilters>) => {
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
      customers: [],
      types: [],
      agents: [],
      productGroups: [],
    },
    setFilters,
    ready,
    bounds,
  };
}
