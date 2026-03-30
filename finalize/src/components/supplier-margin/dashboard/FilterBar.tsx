'use client';

import { DateRangeSection } from '@/components/shared/DateRangeSection';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';

interface FilterBarProps {
  filters: DashboardFilters;
  setFilters: (updates: Partial<DashboardFilters>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function FilterBar({ filters, setFilters, bounds }: FilterBarProps) {

  return (
    <div className="p-4 bg-card border rounded-lg">
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
