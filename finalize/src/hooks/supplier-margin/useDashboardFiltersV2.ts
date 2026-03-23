'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/supplier-margin/margin/v2/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const defaults = useMemo(() => {
    const endDate = bounds?.max_date ? new Date(bounds.max_date) : new Date();
    const startDate = subMonths(endDate, 12);
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [bounds]);

  const filters: DashboardFiltersV2 = useMemo(() => ({
    startDate: searchParams.get('start') ?? defaults.start,
    endDate: searchParams.get('end') ?? defaults.end,
    granularity: (searchParams.get('g') ?? 'monthly') as Granularity,
    supplierTypes: searchParams.getAll('st'),
    suppliers: searchParams.getAll('supplier'),
    itemGroups: searchParams.getAll('ig'),
  }), [searchParams, defaults.start, defaults.end]);

  const setFilters = useCallback((updates: Partial<DashboardFiltersV2>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.startDate !== undefined) params.set('start', updates.startDate);
    if (updates.endDate !== undefined) params.set('end', updates.endDate);
    if (updates.granularity !== undefined) params.set('g', updates.granularity);
    if (updates.supplierTypes !== undefined) {
      params.delete('st');
      for (const st of updates.supplierTypes) params.append('st', st);
    }
    if (updates.suppliers !== undefined) {
      params.delete('supplier');
      for (const s of updates.suppliers) params.append('supplier', s);
    }
    if (updates.itemGroups !== undefined) {
      params.delete('ig');
      for (const ig of updates.itemGroups) params.append('ig', ig);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const hasUrlDates = searchParams.has('start') && searchParams.has('end');
  const ready = hasUrlDates || !!bounds;

  return { filters, setFilters, ready, bounds };
}
