'use client';

import useSWR from 'swr';
import type { DashboardFilters } from './useDashboardFilters';
import type { ProcurementItemRow, ProcurementSummaryResponse, ItemPriceMonthlyRowV2 } from '@/lib/supplier-margin/queries';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useMarginSummary(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/summary?${params}` : null, fetcher);
}

export function useMarginTrend(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    granularity: filters.granularity,
  });
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/trend?${params}` : null, fetcher);
}

export function useSupplierTrend(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    granularity: filters.granularity,
  });
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/supplier-trend?${params}` : null, fetcher);
}

export function useMarginByItemGroup(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    granularity: filters.granularity,
  });
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/by-item-group?${params}` : null, fetcher);
}

export function useSupplierTable(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const s of filters.suppliers) params.append('supplier', s);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/suppliers?${params}` : null, fetcher);
}

export function useSparklines(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const s of filters.suppliers) params.append('supplier', s);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return useSWR<{ data: Record<string, number[]> }>(
    filters.startDate ? `/api/supplier-performance/margin/sparklines?${params}` : null,
    fetcher,
  );
}

export function useSupplierItems(creditorCode: string | null, filters: DashboardFilters) {
  const params = creditorCode ? new URLSearchParams({
    creditor_code: creditorCode,
    start_date: filters.startDate,
    end_date: filters.endDate,
  }) : null;
  return useSWR(params ? `/api/supplier-performance/margin/supplier-items?${params}` : null, fetcher);
}

export function usePriceComparison(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    limit: '200',
  });
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/price-comparison?${params}` : null, fetcher);
}

export function usePriceSpread(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  for (const s of filters.suppliers) params.append('supplier', s);
  for (const ig of filters.itemGroups) params.append('item_group', ig);
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/price-spread?${params}` : null, fetcher);
}

export function useDimensions() {
  return useSWR('/api/supplier-performance/margin/dimensions', fetcher, { revalidateOnFocus: false });
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
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/v2/top-bottom?${params}` : null, fetcher);
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
  return useSWR(filters.startDate ? `/api/supplier-performance/margin/v2/top-bottom-items?${params}` : null, fetcher);
}

export function useSupplierMarginDistribution(filters: DashboardFilters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR<Array<{ bucket: string; count: number }>>(filters.startDate ? `/api/supplier-performance/margin/distribution?${params}` : null, fetcher);
}

export function useMarginDistribution(filters: DashboardFilters, entity: 'suppliers' | 'items' = 'suppliers') {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
    entity,
  });
  return useSWR<Array<{ bucket: string; count: number }>>(filters.startDate ? `/api/supplier-performance/margin/distribution?${params}` : null, fetcher);
}

// Supplier details (contact, terms, etc.)
export function useSupplierDetails(creditorCode: string | null) {
  return useSWR<{
    creditor_code: string;
    company_name: string;
    is_active: boolean;
    creditor_type: string;
    purchase_agent: string;
    supplier_since: string;
    pic: string;
    phone: string;
    mobile: string;
    email: string;
    payment_terms: string;
    credit_limit: number;
    currency: string;
  }>(
    creditorCode ? `/api/supplier-performance/margin/supplier-details?creditor_code=${encodeURIComponent(creditorCode)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Supplier performance (margin trend + top items)
export function useSupplierPerformance(creditorCode: string | null, startDate: string, endDate: string) {
  const params = creditorCode ? new URLSearchParams({
    creditor_code: creditorCode,
    start_date: startDate,
    end_date: endDate,
  }) : null;
  return useSWR<{
    margin_trend: Array<{ period: string; purchase_cost: number; attributed_revenue: number; margin_pct: number | null }>;
    top_items: Array<{ item: string; profit: number; margin_pct: number }>;
    total_purchase_cost: number;
    attributed_revenue: number;
    attributed_profit: number;
    avg_margin: number;
  }>(
    params ? `/api/supplier-performance/margin/supplier-performance?${params}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
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
    items_supplied_count: number;
    single_supplier_count: number;
    total_variant_count: number;
    single_supplier_items: string[];
  }>(
    params ? `/api/supplier-performance/margin/supplier-profile-summary?${params}` : null,
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
  return useSWR<{ data: { item_code: string; prices: number[]; monthly: { month: string; avg_price: number; qty: number }[] }[] }>(
    params ? `/api/supplier-performance/margin/supplier-item-trends?${params}` : null,
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
    filters.startDate ? `/api/supplier-performance/margin/procurement/items?${params}` : null,
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
    ? `/api/supplier-performance/margin/procurement/item-summary?${params}`
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
    ? `/api/supplier-performance/margin/v2/item-trend?${params}`
    : null;
  return useSWR<ItemPriceMonthlyRowV2[]>(key, fetcher);
}
