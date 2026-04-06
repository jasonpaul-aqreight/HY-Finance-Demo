'use client';

import useSWR from 'swr';
import type { DashboardFilters } from './useDashboardFilters';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function dateParams(filters: DashboardFilters) {
  return new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
}

function costParams(filters: DashboardFilters) {
  return new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    cost_type: filters.costType,
  });
}

export function useCostKpis(filters: DashboardFilters) {
  const params = dateParams(filters);
  return useSWR(filters.startDate ? `/api/expenses/cost/kpis?${params}` : null, fetcher);
}

export function useCostTrend(filters: DashboardFilters) {
  const params = costParams(filters);
  params.set('granularity', filters.granularity);
  return useSWR(filters.startDate ? `/api/expenses/cost/trend?${params}` : null, fetcher);
}

export function useCostComposition(filters: DashboardFilters) {
  const params = costParams(filters);
  return useSWR(filters.startDate ? `/api/expenses/cost/composition?${params}` : null, fetcher);
}

export function useTopExpenses(filters: DashboardFilters, costType?: string, order?: string) {
  const params = dateParams(filters);
  params.set('cost_type', costType ?? filters.costType);
  if (order) params.set('order', order);
  return useSWR(filters.startDate ? `/api/expenses/cost/top-expenses?${params}` : null, fetcher);
}

export function useCogsBreakdown(filters: DashboardFilters) {
  const params = dateParams(filters);
  return useSWR(filters.startDate ? `/api/expenses/cost/cogs-breakdown?${params}` : null, fetcher);
}

export function useOpexBreakdown(filters: DashboardFilters) {
  const params = dateParams(filters);
  return useSWR(filters.startDate ? `/api/expenses/cost/opex-breakdown?${params}` : null, fetcher);
}
