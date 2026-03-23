'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerMargins, useCustomerMonthly } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { marginBgColor } from '@/lib/customer-margin/format';

interface Props {
  filters: MarginDashboardFilters;
}

function PivotRow({ code, name, startDate, endDate, months }: {
  code: string; name: string; startDate: string; endDate: string; months: string[];
}) {
  const { data } = useCustomerMonthly(code, startDate, endDate);
  const byMonth = new Map((data ?? []).map(d => [d.period, d.margin_pct]));

  return (
    <tr className="border-b text-xs">
      <td className="sticky left-0 z-10 max-w-[150px] truncate bg-card px-2 py-1 font-medium">{name}</td>
      {months.map(m => {
        const val = byMonth.get(m);
        return (
          <td key={m} className={`px-2 py-1 text-center ${marginBgColor(val ?? null)}`}>
            {val != null ? `${val.toFixed(1)}%` : '\u2014'}
          </td>
        );
      })}
    </tr>
  );
}

export function MonthlyPivotTable({ filters }: Props) {
  const [showPivot, setShowPivot] = useState(false);
  const { data } = useCustomerMargins(filters, 'gross_profit', 'desc', 1, 20);

  // Generate month columns from date range
  const months: string[] = [];
  const start = new Date(filters.startDate);
  const end = new Date(filters.endDate);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Show last 12 months only to keep table manageable
  const displayMonths = months.slice(-12);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Monthly Margin Pivot (Top 20 Customers)</CardTitle>
        <button
          onClick={() => setShowPivot(!showPivot)}
          className="text-sm text-primary hover:underline"
        >
          {showPivot ? 'Hide' : 'Show'} Pivot Table
        </button>
      </CardHeader>
      {showPivot && (
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left text-xs font-medium">Customer</th>
                  {displayMonths.map(m => (
                    <th key={m} className="px-2 py-1 text-center text-xs font-medium">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map(r => (
                  <PivotRow
                    key={r.debtor_code}
                    code={r.debtor_code}
                    name={r.company_name ?? r.debtor_code}
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    months={displayMonths}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
