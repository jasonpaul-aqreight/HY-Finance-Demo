'use client';

import { DateRangeSection } from '@/components/shared/DateRangeSection';
import { useDashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';

export function FilterBar() {
  const { filters, setFilters, bounds } = useDashboardFilters();

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
