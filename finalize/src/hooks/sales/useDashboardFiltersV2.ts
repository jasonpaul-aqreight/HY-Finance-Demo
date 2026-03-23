'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import useSWR from 'swr';
import { format, subMonths } from 'date-fns';
import type { GroupByDimension, StackDimension } from '@/lib/sales/types';

export type Granularity = 'daily' | 'weekly' | 'monthly';

export interface DashboardFiltersV2 {
  startDate: string;
  endDate: string;
  granularity: Granularity;
  groupBy: GroupByDimension;
  stackBy?: StackDimension;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFiltersV2() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/sales/revenue/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const defaults = useMemo(() => {
    const endDate = bounds?.max_date ? new Date(bounds.max_date) : new Date();
    const startDate = subMonths(endDate, 12); // default: trailing 12 months
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [bounds]);

  const filters: DashboardFiltersV2 = useMemo(() => ({
    startDate: searchParams.get('start') ?? defaults.start,
    endDate: searchParams.get('end') ?? defaults.end,
    granularity: (searchParams.get('g') ?? 'monthly') as Granularity,
    groupBy: (searchParams.get('group') ?? 'customer') as GroupByDimension,
    stackBy: (searchParams.get('stack') as StackDimension) || undefined,
  }), [searchParams, defaults.start, defaults.end]);

  const setFilters = useCallback((updates: Partial<DashboardFiltersV2>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.startDate !== undefined) params.set('start', updates.startDate);
    if (updates.endDate !== undefined) params.set('end', updates.endDate);
    if (updates.granularity !== undefined) params.set('g', updates.granularity);
    if (updates.groupBy !== undefined) {
      params.set('group', updates.groupBy);
      // Clear stack when group changes (valid options differ per group)
      if (updates.groupBy !== filters.groupBy) {
        params.delete('stack');
      }
    }
    if ('stackBy' in updates) {
      if (updates.stackBy) {
        params.set('stack', updates.stackBy);
      } else {
        params.delete('stack');
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams, filters.groupBy, startTransition]);

  const hasUrlDates = searchParams.has('start') && searchParams.has('end');
  const ready = hasUrlDates || !!bounds;

  return { filters, setFilters, ready, bounds };
}
