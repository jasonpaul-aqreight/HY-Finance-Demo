'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import useSWR from 'swr';
import { format, subMonths } from 'date-fns';

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const { data: bounds } = useSWR<{ min_date: string; max_date: string }>(
    '/api/customer-margin/margin/date-bounds',
    fetcher,
    { revalidateOnFocus: false }
  );

  const defaults = useMemo(() => {
    const endDate = bounds?.max_date ? new Date(bounds.max_date) : new Date();
    const startDate = subMonths(endDate, 12); // default: trailing 12 months
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [bounds]);

  const filters: MarginDashboardFilters = useMemo(() => ({
    startDate: searchParams.get('start') ?? defaults.start,
    endDate: searchParams.get('end') ?? defaults.end,
    customers: searchParams.getAll('customer'),
    types: searchParams.getAll('type'),
    agents: searchParams.getAll('agent'),
    productGroups: searchParams.getAll('group'),
  }), [searchParams, defaults.start, defaults.end]);

  const setFilters = useCallback((updates: Partial<MarginDashboardFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.startDate !== undefined) params.set('start', updates.startDate);
    if (updates.endDate !== undefined) params.set('end', updates.endDate);
    if (updates.customers !== undefined) {
      params.delete('customer');
      for (const c of updates.customers) params.append('customer', c);
    }
    if (updates.types !== undefined) {
      params.delete('type');
      for (const t of updates.types) params.append('type', t);
    }
    if (updates.agents !== undefined) {
      params.delete('agent');
      for (const a of updates.agents) params.append('agent', a);
    }
    if (updates.productGroups !== undefined) {
      params.delete('group');
      for (const g of updates.productGroups) params.append('group', g);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams, startTransition]);

  const hasUrlDates = searchParams.has('start') && searchParams.has('end');
  const ready = hasUrlDates || !!bounds;

  return { filters, setFilters, ready, bounds };
}
