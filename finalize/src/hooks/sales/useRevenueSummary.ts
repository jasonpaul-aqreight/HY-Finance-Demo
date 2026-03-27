'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Filters {
  startDate: string;
  endDate: string;
  granularity: string;
  locations: string[];
  agents: string[];
}

export function useRevenueSummary(filters: Filters) {
  const params = new URLSearchParams({
    start_date: filters.startDate,
    end_date: filters.endDate,
  });
  return useSWR(
    `/api/sales/revenue/summary?${params}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
}

export function useRevenueTrend(filters: Filters | null) {
  const key = filters && filters.startDate
    ? `/api/sales/revenue/trend?${new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        granularity: filters.granularity,
      })}`
    : null;
  return useSWR(key, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
}

// Customer sales summary (for profile)
export function useCustomerSalesSummary(debtorCode: string | null, startDate: string, endDate: string) {
  const params = debtorCode ? new URLSearchParams({
    debtor_code: debtorCode,
    start_date: startDate,
    end_date: endDate,
  }) : null;
  return useSWR<{
    summary: { total_sales: number; invoice_sales: number; cash_sales: number; credit_notes: number; doc_count: number };
    trend: { month: string; total_sales: number; invoice_sales: number; cash_sales: number; credit_notes: number }[];
  }>(
    params ? `/api/sales/customer-sales-summary?${params}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}
