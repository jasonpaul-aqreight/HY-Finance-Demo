'use client';

import { useMemo } from 'react';
import { format, differenceInCalendarMonths, differenceInCalendarDays, subMonths, startOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';

interface FilterBarProps {
  filters: DashboardFilters;
  setFilters: (updates: Partial<DashboardFilters>) => void;
  bounds?: { min_date: string; max_date: string };
}

export function FilterBar({ filters, setFilters, bounds }: FilterBarProps) {
  const rangeText = useMemo(() => {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    // +1 for inclusive month count (May–Oct = 6 months, not 5)
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-card border rounded-lg">
      {/* Date inputs */}
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

      {/* Range summary text */}
      <div className="text-lg font-semibold tracking-tight">
        {rangeText}
      </div>

      {/* Presets */}
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
