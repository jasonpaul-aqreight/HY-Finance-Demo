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
  return useSWR<ReturnOverview>(`/api/return/credit-v2/overview?${params}`, fetcher);
}

export function useReturnAging() {
  return useSWR<AgingBucket[]>('/api/return/credit-v2/aging', fetcher);
}

export function useReturnTrend(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<TrendRowV2[]>(`/api/return/credit-v2/trend?${params}`, fetcher);
}

export function useAllCustomerReturns(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<TopDebtorRow[]>(`/api/return/credit-v2/top-debtors?${params}`, fetcher);
}

export function useCustomerReturnDetails(debtorCode: string | null, filters: V2Filters) {
  const params = buildParams(filters);
  params.set('debtor_code', debtorCode ?? '');
  const key = debtorCode ? `/api/return/credit-v2/customer-returns?${params}` : null;
  return useSWR<CustomerReturnRow[]>(key, fetcher);
}

export function useReturnProducts(filters: V2Filters, dimension: ReturnProductDimension = 'item', metric: ReturnProductMetric = 'frequency') {
  const params = buildParams(filters);
  params.set('dimension', dimension);
  params.set('metric', metric);
  return useSWR<ReturnProductRow[]>(`/api/return/credit-v2/products?${params}`, fetcher);
}

export function useRefundData(filters: V2Filters) {
  const params = buildParams(filters);
  return useSWR<{ summary: RefundSummary; recent: RefundLogRow[] }>(
    `/api/return/credit-v2/refunds?${params}`,
    fetcher
  );
}
