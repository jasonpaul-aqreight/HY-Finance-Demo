'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/supplier-margin/margin/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const defaults = useMemo(() => {
    const endDate = endOfMonth(bounds?.max_date ? new Date(bounds.max_date) : new Date());
    const startDate = startOfMonth(subMonths(endDate, 11)); // 12 months inclusive
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [bounds]);

  const filters: DashboardFilters = useMemo(() => ({
    startDate: searchParams.get('start') ?? defaults.start,
    endDate: searchParams.get('end') ?? defaults.end,
    granularity: (searchParams.get('g') ?? 'monthly') as Granularity,
    suppliers: searchParams.getAll('supplier'),
    itemGroups: searchParams.getAll('ig'),
  }), [searchParams, defaults.start, defaults.end]);

  const setFilters = useCallback((updates: Partial<DashboardFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.startDate !== undefined) params.set('start', updates.startDate);
    if (updates.endDate !== undefined) params.set('end', updates.endDate);
    if (updates.granularity !== undefined) params.set('g', updates.granularity);
    if (updates.suppliers !== undefined) {
      params.delete('supplier');
      for (const s of updates.suppliers) params.append('supplier', s);
    }
    if (updates.itemGroups !== undefined) {
      params.delete('ig');
      for (const ig of updates.itemGroups) params.append('ig', ig);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams, startTransition]);

  // Don't return stale "today" defaults — wait for bounds
  const hasUrlDates = searchParams.has('start') && searchParams.has('end');
  const ready = hasUrlDates || !!bounds;

  return { filters, setFilters, ready, bounds };
}
