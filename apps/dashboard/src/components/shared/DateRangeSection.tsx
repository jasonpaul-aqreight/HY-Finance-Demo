'use client';

import { useMemo } from 'react';
import {
  format,
  parseISO,
  differenceInCalendarMonths,
  subMonths,
  startOfMonth,
  startOfYear,
  endOfMonth,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { MonthYearPicker } from '@/components/ui/month-year-picker';

interface DateRangeSectionProps {
  label?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  bounds?: { min_date: string; max_date: string };
  showPresets?: boolean;
  showRangeSummary?: boolean;
}

const PRESETS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: 'YTD', value: 'ytd' as const },
] as const;

export function DateRangeSection({
  label = 'Date Range',
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  bounds,
  showPresets = true,
  showRangeSummary = true,
}: DateRangeSectionProps) {
  const rangeText = useMemo(() => {
    if (!startDate || !endDate) return '';
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const months = differenceInCalendarMonths(end, start) + 1;
    const startStr = format(start, 'MMM yyyy');
    const endStr = format(end, 'MMM yyyy');
    return `${startStr}  –  ${endStr} (${months} month${months !== 1 ? 's' : ''})`;
  }, [startDate, endDate]);

  function applyPreset(monthsBack: number | 'ytd') {
    const maxEnd = bounds?.max_date ? parseISO(bounds.max_date) : new Date();
    const end = endOfMonth(maxEnd);
    const start =
      monthsBack === 'ytd'
        ? startOfYear(end)
        : startOfMonth(subMonths(end, monthsBack - 1));
    onStartDateChange(format(start, 'yyyy-MM-dd'));
    onEndDateChange(format(end, 'yyyy-MM-dd'));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Date pickers */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <MonthYearPicker
          value={startDate}
          onChange={onStartDateChange}
          minDate={bounds?.min_date}
          maxDate={bounds?.max_date}
          mode="start"
        />
        <span className="text-muted-foreground">&rarr;</span>
        <MonthYearPicker
          value={endDate}
          onChange={onEndDateChange}
          minDate={bounds?.min_date}
          maxDate={bounds?.max_date}
          mode="end"
        />
      </div>

      {/* Range summary */}
      {showRangeSummary && rangeText && (
        <div className="text-lg font-semibold tracking-tight">{rangeText}</div>
      )}

      {/* Presets */}
      {showPresets && (
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
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
      )}
    </div>
  );
}
