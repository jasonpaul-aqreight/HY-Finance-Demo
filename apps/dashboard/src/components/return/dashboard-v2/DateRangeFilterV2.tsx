'use client';

import { DateRangeSection } from '@/components/shared/DateRangeSection';
import type { V2Filters } from '@/hooks/return/useDashboardFiltersV2';

interface Props {
  filters: V2Filters;
  onUpdate: (updates: Partial<V2Filters>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function DateRangeFilterV2({ filters, onUpdate, bounds }: Props) {
  return (
    <DateRangeSection
      label="Date Range"
      startDate={filters.startDate}
      endDate={filters.endDate}
      onStartDateChange={(v) => onUpdate({ startDate: v })}
      onEndDateChange={(v) => onUpdate({ endDate: v })}
      bounds={bounds}
    />
  );
}
