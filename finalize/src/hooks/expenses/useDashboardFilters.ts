'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import useSWR from 'swr';
import { format, subMonths } from 'date-fns';

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

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

  const defaults = useMemo(() => {
    const endDate = bounds?.max_date ? new Date(bounds.max_date) : new Date();
    const startDate = subMonths(endDate, 12); // default: trailing 12 months
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [bounds]);

  const filters: DashboardFilters = useMemo(() => ({
    startDate: searchParams.get('start') ?? defaults.start,
    endDate: searchParams.get('end') ?? defaults.end,
    costType: (searchParams.get('type') ?? 'all') as CostType,
    granularity: (searchParams.get('g') ?? 'monthly') as Granularity,
    categories: searchParams.getAll('cat'),
  }), [searchParams, defaults.start, defaults.end]);

  const setFilters = useCallback((updates: Partial<DashboardFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.startDate !== undefined) params.set('start', updates.startDate);
    if (updates.endDate !== undefined) params.set('end', updates.endDate);
    if (updates.costType !== undefined) params.set('type', updates.costType);
    if (updates.granularity !== undefined) params.set('g', updates.granularity);
    if (updates.categories !== undefined) {
      params.delete('cat');
      for (const c of updates.categories) params.append('cat', c);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams, startTransition]);

  const hasUrlDates = searchParams.has('start') && searchParams.has('end');
  const ready = hasUrlDates || !!bounds;

  return { filters, setFilters, ready, bounds, fiscalYears: fiscalYears?.data ?? [] };
}
