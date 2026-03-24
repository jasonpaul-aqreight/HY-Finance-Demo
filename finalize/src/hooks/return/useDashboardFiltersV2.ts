'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import useSWR from 'swr';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface V2Filters {
  startDate: string;
  endDate: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardFiltersV2() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/return/credit-v2/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const defaults = useMemo(() => {
    const endDate = endOfMonth(bounds?.max_date ? new Date(bounds.max_date) : new Date());
    const startDate = startOfMonth(subMonths(endDate, 11)); // 12 months inclusive
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [bounds]);

  const filters: V2Filters = useMemo(() => ({
    startDate: searchParams.get('start') ?? defaults.start,
    endDate: searchParams.get('end') ?? defaults.end,
  }), [searchParams, defaults.start, defaults.end]);

  const setFilters = useCallback((updates: Partial<V2Filters>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.startDate !== undefined) params.set('start', updates.startDate);
    if (updates.endDate !== undefined) params.set('end', updates.endDate);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams, startTransition]);

  const hasUrlDates = searchParams.has('start') && searchParams.has('end');
  const ready = hasUrlDates || !!bounds;

  return { filters, setFilters, ready, bounds };
}
