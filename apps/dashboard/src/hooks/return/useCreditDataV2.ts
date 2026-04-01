'use client';

import useSWR from 'swr';
import type { V2Filters } from './useDashboardFiltersV2';
import type {
  ReturnOverview,
  AgingBucket,
  TrendRowV2,
  TopDebtorRow,
  CustomerReturnRow,
  ReturnProductRow,
  ReturnProductDimension,
  ReturnProductMetric,
  RefundSummary,
  RefundLogRow,
} from '@/lib/return/queries-v2';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildParams(f: V2Filters): URLSearchParams {
  return new URLSearchParams({
    start_date: f.startDate,
    end_date: f.endDate,
  });
}

export function useReturnOverview(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<ReturnOverview>(filters.startDate ? `/api/return/credit-v2/overview?${params}` : null, fetcher);
}

export function useReturnAging() {
  return useSWR<AgingBucket[]>('/api/return/credit-v2/aging', fetcher);
}

export function useReturnTrend(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<TrendRowV2[]>(filters.startDate ? `/api/return/credit-v2/trend?${params}` : null, fetcher);
}

export function useAllCustomerReturns(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<TopDebtorRow[]>(filters.startDate ? `/api/return/credit-v2/top-debtors?${params}` : null, fetcher);
}

export function useAllCustomerReturnsAll() {
  return useSWR<TopDebtorRow[]>('/api/return/credit-v2/top-debtors', fetcher);
}

export function useCustomerReturnDetails(debtorCode: string | null, filters: V2Filters) {
  const params = buildParams(filters);
  params.set('debtor_code', debtorCode ?? '');
  const key = debtorCode ? `/api/return/credit-v2/customer-returns?${params}` : null;
  return useSWR<CustomerReturnRow[]>(key, fetcher);
}

export function useCustomerReturnDetailsAll(debtorCode: string | null) {
  const key = debtorCode ? `/api/return/credit-v2/customer-returns?debtor_code=${debtorCode}` : null;
  return useSWR<CustomerReturnRow[]>(key, fetcher);
}

// Customer return summary (for profile metrics)
export function useCustomerReturnSummary(debtorCode: string | null) {
  return useSWR<{ return_count: number; unresolved: number }>(
    debtorCode ? `/api/return/credit-v2/customer-return-summary?debtor_code=${encodeURIComponent(debtorCode)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Customer return trend (date-range scoped, for profile sparkline)
export function useCustomerReturnTrend(debtorCode: string | null, startDate: string, endDate: string) {
  const params = new URLSearchParams({ debtor_code: debtorCode ?? '', start_date: startDate, end_date: endDate });
  return useSWR<{ month: string; count: number; value: number }[]>(
    debtorCode ? `/api/return/credit-v2/customer-return-trend?${params}` : null,
    fetcher,
  );
}

export function useReturnProducts(filters: V2Filters, dimension: ReturnProductDimension = 'item', metric: ReturnProductMetric = 'frequency') {
  const params = buildParams(filters);
  params.set('dimension', dimension);
  params.set('metric', metric);
  return useSWR<ReturnProductRow[]>(filters.startDate ? `/api/return/credit-v2/products?${params}` : null, fetcher);
}

export function useRefundData(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<{ summary: RefundSummary; recent: RefundLogRow[] }>(
    filters.startDate ? `/api/return/credit-v2/refunds?${params}` : null,
    fetcher
  );
}
