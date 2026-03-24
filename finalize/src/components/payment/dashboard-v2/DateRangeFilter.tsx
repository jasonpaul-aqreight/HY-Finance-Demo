'use client';

import { DateRangeSection } from '@/components/shared/DateRangeSection';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';

interface DateRangeFilterProps {
  filters: DashboardFiltersV2;
  setFilters: (updates: Partial<DashboardFiltersV2>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function DateRangeFilter({ filters, setFilters, bounds }: DateRangeFilterProps) {
  return (
    <DateRangeSection
      label="Date Range"
      startDate={filters.startDate}
      endDate={filters.endDate}
      onStartDateChange={(v) => setFilters({ startDate: v })}
      onEndDateChange={(v) => setFilters({ endDate: v })}
      bounds={bounds}
    />
  );
}
