'use client';

import { useFiscalYears } from '@/hooks/pnl/useFilters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { V3DashboardFilters } from '@/types/pnl-v3';

interface FilterBarV3Props {
  filters: V3DashboardFilters;
  onFilterChange: (updates: Partial<V3DashboardFilters>) => void;
  latestMonth?: string; // e.g. "Oct 2025" — actual last month with data
}

function fyStartMonth(fy: string): string {
  const match = fy.match(/(\d{4})/);
  if (!match) return '';
  const year = parseInt(match[1], 10);
  return `Mar ${year - 1}`;
}

function fyEndMonth(fy: string): string {
  const match = fy.match(/(\d{4})/);
  if (!match) return '';
  return `Feb ${match[1]}`;
}

export function FilterBarV3({ filters, onFilterChange, latestMonth }: FilterBarV3Props) {
  const { data: fiscalYears } = useFiscalYears();

  const fyOptions = (fiscalYears || []).map(fy => {
    const match = fy.FiscalYearName.match(/(\d{4})/);
    return match ? `FY${match[1]}` : fy.FiscalYearName;
  });

  const start = filters.fiscalYear ? fyStartMonth(filters.fiscalYear) : '';
  const end = latestMonth || (filters.fiscalYear ? fyEndMonth(filters.fiscalYear) : '');
  const fyMatch = filters.fiscalYear?.match(/(\d{4})/);
  const fyYear = fyMatch ? fyMatch[1] : '';

  return (
    <div className="flex items-center">
      <Select
        value={filters.fiscalYear}
        onValueChange={(v) => v && onFilterChange({ fiscalYear: v })}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Financial Year" />
        </SelectTrigger>
        <SelectContent>
          {fyOptions.map(fy => (
            <SelectItem key={fy} value={fy}>{fy}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filters.fiscalYear && (
        <p className="flex-1 text-center text-lg font-semibold tracking-tight">
          Financial Year {fyYear} ({start} – {end})
        </p>
      )}

      {/* Spacer to balance the dropdown width on the left */}
      <div className="w-[140px]" />
    </div>
  );
}
