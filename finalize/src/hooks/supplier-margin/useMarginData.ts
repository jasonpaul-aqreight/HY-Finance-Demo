'use client';

import useSWR from 'swr';
import type { DashboardFilters } from './useDashboardFilters';
import type { ProcurementItemRow, ProcurementSummaryResponse } from '@/lib/supplier-margin/queries';
import type { ItemPriceMonthlyRowV2 } from '@/lib/supplier-margin/queries-v2';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useMarginSummary(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR(`/api/supplier-margin/margin/summary?${params}`, fetcher);
}

export function useMarginTrend(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    granularity: filters.granularity,
  });
  return useSWR(`/api/supplier-margin/margin/trend?${params}`, fetcher);
}

export function useSupplierTrend(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    granularity: filters.granularity,
  });
  return useSWR(`/api/supplier-margin/margin/supplier-trend?${params}`, fetcher);
}

export function useMarginByItemGroup(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    granularity: filters.granularity,
  });
  return useSWR(`/api/supplier-margin/margin/by-item-group?${params}`, fetcher);
}

export function useSupplierTable(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const s of filters.suppliers) params.append('supplier', s);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return useSWR(`/api/supplier-margin/margin/suppliers?${params}`, fetcher);
}

export function useSparklines(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const s of filters.suppliers) params.append('supplier', s);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return useSWR<{ data: Record<string, number[]> }>(
    `/api/supplier-margin/margin/sparklines?${params}`,
    fetcher,
  );
}

export function useSupplierItems(creditorCode: string | null, filters: DashboardFilters) {
  const params = creditorCode ? new URLSearchParams({
    creditor_code: creditorCode,
    start_date: filters.startDate,
    end_date: filters.endDate,
  }) : null;
  return useSWR(params ? `/api/supplier-margin/margin/supplier-items?${params}` : null, fetcher);
}

export function usePriceComparison(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    limit: '200',
  });
  return useSWR(`/api/supplier-margin/margin/price-comparison?${params}`, fetcher);
}

export function usePriceSpread(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const s of filters.suppliers) params.append('supplier', s);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return useSWR(`/api/supplier-margin/margin/price-spread?${params}`, fetcher);
}

export function useDimensions() {
  return useSWR('/api/supplier-margin/margin/dimensions', fetcher, { revalidateOnFocus: false });
}

export function useTopBottomSuppliers(
  filters: DashboardFilters,
  order: 'asc' | 'desc' = 'desc',
  limit = 10,
  sortBy: 'profit' | 'margin_pct' = 'profit'
) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    limit: String(limit),
    order,
    sort_by: sortBy,
  });
  return useSWR(`/api/supplier-margin/margin/v2/top-bottom?${params}`, fetcher);
}

export function useTopBottomItems(
  filters: DashboardFilters,
  order: 'asc' | 'desc' = 'desc',
  limit = 10,
  sortBy: 'profit' | 'margin_pct' = 'profit'
) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    limit: String(limit),
    order,
    sort_by: sortBy,
  });
  return useSWR(`/api/supplier-margin/margin/v2/top-bottom-items?${params}`, fetcher);
}

export function useSupplierMarginDistribution(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR<Array<{ bucket: string; count: number }>>(`/api/supplier-margin/margin/distribution?${params}`, fetcher);
}

export function useMarginDistribution(filters: DashboardFilters, entity: 'suppliers' | 'items' = 'suppliers') {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    entity,
  });
  return useSWR<Array<{ bucket: string; count: number }>>(`/api/supplier-margin/margin/distribution?${params}`, fetcher);
}

// Supplier profile summary (isActive, single-supplier items)
export function useSupplierProfileSummary(creditorCode: string | null, startDate: string, endDate: string) {
  const params = creditorCode ? new URLSearchParams({
    creditor_code: creditorCode,
    start_date: startDate,
    end_date: endDate,
  }) : null;
  return useSWR<{
    is_active: boolean;
    single_supplier_count: number;
    single_supplier_items: string[];
  }>(
    params ? `/api/supplier-margin/margin/supplier-profile-summary?${params}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Supplier item price trends (sparklines for profile)
export function useSupplierItemTrends(creditorCode: string | null, startDate: string, endDate: string) {
  const params = creditorCode ? new URLSearchParams({
    creditor_code: creditorCode,
    start_date: startDate,
    end_date: endDate,
  }) : null;
  return useSWR<{ data: { item_code: string; prices: number[] }[] }>(
    params ? `/api/supplier-margin/margin/supplier-item-trends?${params}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// ─── Procurement hooks ──────────────────────────────────────────────────────

export function useProcurementItems(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR<ProcurementItemRow[]>(
    `/api/supplier-margin/margin/procurement/items?${params}`,
    fetcher
  );
}

export function useProcurementSummary(itemCode: string | null, filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  if (itemCode) params.set('item_code', itemCode);
  const key = itemCode
    ? `/api/supplier-margin/margin/procurement/item-summary?${params}`
    : null;
  return useSWR<ProcurementSummaryResponse>(key, fetcher);
}

export function useProcurementTrend(itemCode: string | null, filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  if (itemCode) params.set('item_code', itemCode);
  params.set('granularity', 'monthly');
  const key = itemCode
    ? `/api/supplier-margin/margin/v2/item-trend?${params}`
    : null;
  return useSWR<ItemPriceMonthlyRowV2[]>(key, fetcher);
}
