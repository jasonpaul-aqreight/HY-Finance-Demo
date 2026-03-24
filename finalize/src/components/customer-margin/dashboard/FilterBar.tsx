'use client';

import { DateRangeSection } from '@/components/shared/DateRangeSection';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';

interface FilterBarProps {
  filters: MarginDashboardFilters;
  setFilters: (updates: Partial<MarginDashboardFilters>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function FilterBar({ filters, setFilters, bounds }: FilterBarProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <DateRangeSection
        label="Date Range"
        startDate={filters.startDate}
        endDate={filters.endDate}
        onStartDateChange={(v) => setFilters({ startDate: v })}
        onEndDateChange={(v) => setFilters({ endDate: v })}
        bounds={bounds}
      />
    </div>
  );
}
