'use client';

import { useMemo } from 'react';
import { format, differenceInCalendarMonths, differenceInCalendarDays, subMonths, startOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';

interface DateRangeFilterProps {
  filters: DashboardFiltersV2;
  setFilters: (updates: Partial<DashboardFiltersV2>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function DateRangeFilter({ filters, setFilters, bounds }: DateRangeFilterProps) {
  const rangeText = useMemo(() => {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const months = differenceInCalendarMonths(end, start) + (start.getDate() === 1 ? 1 : 0);
    const days = differenceInCalendarDays(end, start);

    const startStr = format(start, 'd MMM yyyy');
    const endStr = format(end, 'd MMM yyyy');

    if (months >= 1) {
      return `${startStr}  \u2013  ${endStr} (${months} month${months !== 1 ? 's' : ''})`;
    }
    return `${startStr}  \u2013  ${endStr} (${days} day${days !== 1 ? 's' : ''})`;
  }, [filters.startDate, filters.endDate]);

  const maxDate = bounds?.max_date ?? format(new Date(), 'yyyy-MM-dd');

  function applyPreset(monthsBack: number | 'ytd') {
    const end = new Date(maxDate);
    let start: Date;
    if (monthsBack === 'ytd') {
      start = startOfYear(end);
    } else {
      start = subMonths(end, monthsBack - 1);
      start.setDate(1);
    }
    setFilters({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Time Range</span>
        <input
          type="date"
          className="border rounded px-2 py-1 text-sm bg-background"
          value={filters.startDate}
          onChange={(e) => setFilters({ startDate: e.target.value })}
        />
        <span className="text-muted-foreground">&rarr;</span>
        <input
          type="date"
          className="border rounded px-2 py-1 text-sm bg-background"
          value={filters.endDate}
          onChange={(e) => setFilters({ endDate: e.target.value })}
        />
      </div>

      <div className="text-lg font-semibold tracking-tight">
        {rangeText}
      </div>

      <div className="flex items-center gap-1">
        {[
          { label: '3M', value: 3 },
          { label: '6M', value: 6 },
          { label: '12M', value: 12 },
          { label: 'YTD', value: 'ytd' as const },
        ].map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => applyPreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
