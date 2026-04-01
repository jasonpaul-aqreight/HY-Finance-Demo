'use client';

import useSWR from 'swr';
import type { MarginDashboardFilters } from './useDashboardFilters';
import type {
  KpiData, TrendRow, CustomerMarginRow, CustomerMonthlyRow,
  TypeMarginRow, ProductGroupRow, DistributionBucket,
  CreditNoteImpactRow, DataQualityMetrics, ProductCustomerCell,
  ProductRow,
} from '@/lib/customer-margin/queries';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildParams(filters: MarginDashboardFilters): URLSearchParams {
  const params = new URLSearchParams({
    date_from: filters.startDate,
    date_to: filters.endDate,
  });
  for (const c of filters.customers) params.append('customer', c);
  for (const t of filters.types) params.append('type', t);
  for (const a of filters.agents) params.append('agent', a);
  for (const g of filters.productGroups) params.append('group', g);
  return params;
}

export function useMarginKpi(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<KpiData>(filters.startDate ? `/api/customer-margin/margin/kpi?${params}` : null, fetcher);
}

export function useMarginTrend(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<TrendRow[]>(filters.startDate ? `/api/customer-margin/margin/trend?${params}` : null, fetcher);
}

export function useCustomerMargins(
  filters: MarginDashboardFilters,
  sort = 'gross_profit',
  order = 'desc',
  page = 1,
  limit = 50,
  selectedCustomers: string[] = []
) {
  const params = buildParams(filters);
  for (const c of selectedCustomers) params.append('customer', c);
  params.set('sort', sort);
  params.set('order', order);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return useSWR<{ rows: CustomerMarginRow[]; total: number }>(
    filters.startDate ? `/api/customer-margin/margin/customers?${params}` : null, fetcher
  );
}

export function useCustomerProducts(code: string | null, startDate: string, endDate: string) {
  const params = new URLSearchParams({ date_from: startDate, date_to: endDate });
  return useSWR<{ data: ProductRow[] }>(
    code ? `/api/customer-margin/margin/customers/${encodeURIComponent(code)}/products?${params}` : null,
    fetcher
  );
}

export function useCustomerMonthly(code: string | null, startDate: string, endDate: string) {
  const params = new URLSearchParams({ date_from: startDate, date_to: endDate });
  return useSWR<CustomerMonthlyRow[]>(
    code ? `/api/customer-margin/margin/customers/${encodeURIComponent(code)}/monthly?${params}` : null,
    fetcher
  );
}

export function useMarginByType(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<TypeMarginRow[]>(filters.startDate ? `/api/customer-margin/margin/by-type?${params}` : null, fetcher);
}

export function useMarginByProductGroup(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<ProductGroupRow[]>(filters.startDate ? `/api/customer-margin/margin/by-product-group?${params}` : null, fetcher);
}

export function useProductCustomerMatrix(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<ProductCustomerCell[]>(filters.startDate ? `/api/customer-margin/margin/product-customer?${params}` : null, fetcher);
}

export function useCreditNoteImpact(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<CreditNoteImpactRow[]>(filters.startDate ? `/api/customer-margin/margin/credit-note-impact?${params}` : null, fetcher);
}

export function useMarginDistribution(filters: MarginDashboardFilters) {
  const params = buildParams(filters);
  return useSWR<DistributionBucket[]>(filters.startDate ? `/api/customer-margin/margin/distribution?${params}` : null, fetcher);
}

export function useDataQuality(filters: MarginDashboardFilters) {
  const params = new URLSearchParams({
    date_from: filters.startDate,
    date_to: filters.endDate,
  });
  return useSWR<DataQualityMetrics>(filters.startDate ? `/api/customer-margin/margin/data-quality?${params}` : null, fetcher);
}

export function useFilterCustomers() {
  return useSWR<{ code: string; name: string | null }[]>(
    '/api/customer-margin/filters/customers', fetcher, { revalidateOnFocus: false }
  );
}

export function useFilterTypes() {
  return useSWR<string[]>('/api/customer-margin/filters/types', fetcher, { revalidateOnFocus: false });
}

export function useFilterAgents() {
  return useSWR<{ agent: string; description: string | null; is_active: string }[]>(
    '/api/customer-margin/filters/agents', fetcher, { revalidateOnFocus: false }
  );
}

export function useFilterProductGroups() {
  return useSWR<string[]>('/api/customer-margin/filters/product-groups', fetcher, { revalidateOnFocus: false });
}
