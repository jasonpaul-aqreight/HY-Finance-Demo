'use client';

import { useState, useCallback } from 'react';
import {
  format,
  endOfMonth,
  startOfMonth,
  getYear,
  getMonth,
  parseISO,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthYearPickerProps {
  /** Current value as "yyyy-MM-dd" */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable month ("yyyy-MM-dd") */
  minDate?: string;
  /** Latest selectable month ("yyyy-MM-dd") */
  maxDate?: string;
  /** "start" snaps to 1st of month, "end" snaps to last day */
  mode: 'start' | 'end';
  className?: string;
}

export function MonthYearPicker({
  value,
  onChange,
  minDate,
  maxDate,
  mode,
  className,
}: MonthYearPickerProps) {
  const parsed = value ? parseISO(value) : new Date();
  const [displayYear, setDisplayYear] = useState(getYear(parsed));
  const [open, setOpen] = useState(false);

  const activeMonth = getMonth(parsed); // 0-based
  const activeYear = getYear(parsed);

  const minParsed = minDate ? parseISO(minDate) : null;
  const maxParsed = maxDate ? parseISO(maxDate) : null;

  const isMonthDisabled = useCallback(
    (monthIndex: number) => {
      const monthStart = new Date(displayYear, monthIndex, 1);
      const monthEnd = endOfMonth(monthStart);

      if (minParsed && monthEnd < startOfMonth(minParsed)) return true;
      if (maxParsed && monthStart > endOfMonth(maxParsed)) return true;
      return false;
    },
    [displayYear, minParsed, maxParsed],
  );

  const canGoBack = !minParsed || displayYear > getYear(minParsed);
  const canGoForward = !maxParsed || displayYear < getYear(maxParsed);

  function handleSelect(monthIndex: number) {
    const date = new Date(displayYear, monthIndex, 1);
    const result = mode === 'start' ? startOfMonth(date) : endOfMonth(date);
    onChange(format(result, 'yyyy-MM-dd'));
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setDisplayYear(getYear(parsed));
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 px-2.5 text-sm font-normal',
              className,
            )}
          />
        }
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        {value ? format(parsed, 'MMM yyyy') : 'Pick month'}
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!canGoBack}
            onClick={() => setDisplayYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{displayYear}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!canGoForward}
            onClick={() => setDisplayYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-4 gap-1">
          {MONTHS.map((label, i) => {
            const disabled = isMonthDisabled(i);
            const isActive = displayYear === activeYear && i === activeMonth;
            return (
              <Button
                key={label}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                disabled={disabled}
                className="h-8 text-xs"
                onClick={() => handleSelect(i)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
