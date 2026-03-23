'use client';

import { useCallback, useMemo } from 'react';
import { format, differenceInCalendarMonths, differenceInCalendarDays, subMonths, startOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';

interface FilterBarProps {
  filters: MarginDashboardFilters;
  setFilters: (updates: Partial<MarginDashboardFilters>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function FilterBar({ filters, setFilters, bounds }: FilterBarProps) {
  const maxDate = bounds?.max_date ?? format(new Date(), 'yyyy-MM-dd');

  const rangeText = useMemo(() => {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const months = differenceInCalendarMonths(end, start) + 1;
    const days = differenceInCalendarDays(end, start) + 1;

    const startStr = format(start, 'd MMM yyyy');
    const endStr = format(end, 'd MMM yyyy');

    if (months >= 2) {
      return `${startStr}  –  ${endStr} (${months} months)`;
    }
    if (months === 1) {
      return `${startStr}  –  ${endStr} (1 month)`;
    }
    return `${startStr}  –  ${endStr} (${days} day${days !== 1 ? 's' : ''})`;
  }, [filters.startDate, filters.endDate]);

  const applyPreset = useCallback((monthsBack: number | 'ytd') => {
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
  }, [maxDate, setFilters]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Time Range</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={e => setFilters({ startDate: e.target.value })}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
          <span className="text-muted-foreground">&rarr;</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={e => setFilters({ endDate: e.target.value })}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
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
    </div>
  );
}
