'use client';

import useSWR from 'swr';
import type { DashboardFiltersV2 } from './useDashboardFiltersV2';
import type {
  KpiV2Data,
  CreditUtilizationRow,
  DsoTrendRow,
  CreditHealthV2Row,
} from '@/lib/payment/queries-v2';
import type { SettingsV2 } from '@/lib/payment/settings';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function dateParams(filters: DashboardFiltersV2): string {
  return `start_date=${filters.startDate}&end_date=${filters.endDate}`;
}

// V2 KPIs (period metrics use date range)
export function useKpisV2(filters: DashboardFiltersV2) {
  return useSWR<KpiV2Data>(
    `/api/payment/v2/kpis?${dateParams(filters)}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Reuse V1 aging endpoint (snapshot, no filters needed for V2)
export function useAging() {
  return useSWR(`/api/payment/aging`, fetcher, { revalidateOnFocus: false });
}

// Aging grouped by agent or customer type
export function useAgingByDimension(groupBy: 'agent' | 'type') {
  return useSWR(
    `/api/payment/aging-by-dimension?group_by=${groupBy}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Reuse V1 collection trend endpoint (period, uses date range)
export function useCollectionTrend(filters: DashboardFiltersV2) {
  const startMonth = filters.startDate.substring(0, 7);
  const endMonth = filters.endDate.substring(0, 7);
  return useSWR(
    `/api/payment/collection-trend?start_month=${startMonth}&end_month=${endMonth}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// V2 Credit Utilization Distribution (snapshot)
export function useCreditUtilizationV2() {
  return useSWR<CreditUtilizationRow[]>(
    '/api/payment/v2/credit-utilization',
    fetcher,
    { revalidateOnFocus: false },
  );
}

// V2 DSO Trend (period)
export function useDsoTrendV2(filters: DashboardFiltersV2) {
  return useSWR<DsoTrendRow[]>(
    `/api/payment/v2/dso-trend?${dateParams(filters)}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// V2 Settings
export function useSettingsV2() {
  return useSWR<SettingsV2>(
    '/api/payment/settings',
    async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      return data.v2 ?? data;
    },
    { revalidateOnFocus: false },
  );
}

// V2 Credit Health Table (snapshot, no filters)
export function useCreditHealthV2(
  sort: string,
  order: 'asc' | 'desc',
  page: number,
  search: string,
) {
  return useSWR<{ rows: CreditHealthV2Row[]; total: number }>(
    `/api/payment/v2/credit-health?sort=${sort}&order=${order}&page=${page}&page_size=20&search=${encodeURIComponent(search)}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Reuse V1 customer invoices endpoint
export function useCustomerInvoices(debtorCode: string | null) {
  return useSWR(
    debtorCode ? `/api/payment/customer-invoices?debtor_code=${encodeURIComponent(debtorCode)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}
