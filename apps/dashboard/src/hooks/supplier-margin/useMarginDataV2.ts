'use client';

import useSWR from 'swr';
import type { DashboardFiltersV2 } from './useDashboardFiltersV2';
import type {
  TrendRowV2,
  TopBottomRowV2,
  SupplierTableRowV2,
  ItemListRowV2,
  ItemSupplierSummaryRowV2,
  ItemSellPriceV2,
  ItemPriceMonthlyRowV2,
  SupplierItemRowV2,
  SupplierSparklineRowV2,
} from '@/lib/supplier-margin/queries-v2';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildParams(filters: DashboardFiltersV2): URLSearchParams {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const st of filters.supplierTypes) params.append('supplier_type', st);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return params;
}

interface MarginSummaryResponse {
  period: { start: string; end: string; prevStart: string; prevEnd: string };
  current: { revenue: number; cogs: number; profit: number; margin_pct: number | null };
  previous: { revenue: number; cogs: number; profit: number; margin_pct: number | null };
  growth: {
    revenue_pct: number | null;
    cogs_pct: number | null;
    profit_pct: number | null;
    margin_delta: number | null;
  };
}

interface DimensionsResponse {
  suppliers: Array<{ AccNo: string; CompanyName: string }>;
  supplierTypes: Array<{ CreditorType: string; Description: string }>;
  itemGroups: Array<{ ItemGroup: string; Description: string }>;
}

export function useMarginSummaryV2(filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  return useSWR<MarginSummaryResponse>(filters.startDate ? `/api/supplier-performance/margin/v2/summary?${params}` : null, fetcher);
}

export function useMarginTrendV2(filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  params.set('granularity', filters.granularity);
  for (const s of filters.suppliers) params.append('supplier', s);
  return useSWR<TrendRowV2[]>(filters.startDate ? `/api/supplier-performance/margin/v2/trend?${params}` : null, fetcher);
}

export function useTopBottomSuppliersV2(filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  return useSWR<TopBottomRowV2[]>(filters.startDate ? `/api/supplier-performance/margin/v2/top-bottom?${params}` : null, fetcher);
}

export function useSupplierTableV2(filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  for (const s of filters.suppliers) params.append('supplier', s);
  return useSWR<SupplierTableRowV2[]>(filters.startDate ? `/api/supplier-performance/margin/v2/suppliers?${params}` : null, fetcher);
}

export function useDimensionsV2() {
  return useSWR<DimensionsResponse>('/api/supplier-performance/margin/v2/dimensions', fetcher, { revalidateOnFocus: false });
}

// ─── Item Price Comparison hooks ────────────────────────────────────────────

export function useItemListV2(filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  return useSWR<ItemListRowV2[]>(filters.startDate ? `/api/supplier-performance/margin/v2/items?${params}` : null, fetcher);
}

interface ItemSummaryResponse {
  suppliers: ItemSupplierSummaryRowV2[];
  sellPrice: ItemSellPriceV2;
}

export function useItemSummaryV2(itemCode: string | null, filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  if (itemCode) params.set('item_code', itemCode);
  const key = itemCode ? `/api/supplier-performance/margin/v2/item-summary?${params}` : null;
  return useSWR<ItemSummaryResponse>(key, fetcher);
}

export function useItemTrendV2(itemCode: string | null, filters: DashboardFiltersV2, granularity: 'weekly' | 'monthly' = 'monthly') {
  const params = buildParams(filters);
  if (itemCode) params.set('item_code', itemCode);
  params.set('granularity', granularity);
  const key = itemCode ? `/api/supplier-performance/margin/v2/item-trend?${params}` : null;
  return useSWR<ItemPriceMonthlyRowV2[]>(key, fetcher);
}

export function useSupplierItemsV2(creditorCode: string | null, filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  if (creditorCode) params.set('creditor_code', creditorCode);
  const key = creditorCode ? `/api/supplier-performance/margin/v2/supplier-items?${params}` : null;
  return useSWR<SupplierItemRowV2[]>(key, fetcher);
}

export function useSupplierSparklinesV2(filters: DashboardFiltersV2) {
  const params = buildParams(filters);
  return useSWR<SupplierSparklineRowV2[]>(filters.startDate ? `/api/supplier-performance/margin/v2/sparklines?${params}` : null, fetcher);
}
