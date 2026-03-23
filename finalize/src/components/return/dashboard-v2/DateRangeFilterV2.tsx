'use client';

import type { V2Filters } from '@/hooks/return/useDashboardFiltersV2';

interface Props {
  filters: V2Filters;
  onUpdate: (updates: Partial<V2Filters>) => void;
}

export function DateRangeFilterV2({ filters, onUpdate }: Props) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="text-muted-foreground font-medium">Time Range</label>
      <input
        type="date"
        value={filters.startDate}
        onChange={(e) => onUpdate({ startDate: e.target.value })}
        className="border rounded-md px-2 py-1.5 bg-background text-sm"
      />
      <label className="text-muted-foreground font-medium">&rarr;</label>
      <input
        type="date"
        value={filters.endDate}
        onChange={(e) => onUpdate({ endDate: e.target.value })}
        className="border rounded-md px-2 py-1.5 bg-background text-sm"
      />
    </div>
  );
}
