'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { useCustomerMargins, useCustomerMonthly } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { marginBgColor } from '@/lib/customer-margin/format';
import { exportToExcel } from '@/lib/export-excel';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const { data } = useCustomerMargins(filters, 'gross_profit', 'desc', page, pageSize);

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

  function handleExportExcel() {
    if (!data?.rows) return;
    const cols = [
      { header: 'Customer', key: 'name', width: 30 },
      ...displayMonths.map(m => ({ header: m, key: m, width: 12 })),
    ];
    // Note: export only customer names since monthly data is fetched per-row
    exportToExcel('monthly-margin-pivot', cols, data.rows.map(r => {
      const obj: Record<string, unknown> = { name: r.company_name ?? r.debtor_code };
      for (const m of displayMonths) obj[m] = ''; // monthly data not available at export time
      return obj;
    }));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Monthly Margin Pivot</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            Export Excel
          </Button>
          <button
            onClick={() => setShowPivot(!showPivot)}
            className="text-sm text-primary hover:underline"
          >
            {showPivot ? 'Hide' : 'Show'} Pivot Table
          </button>
        </div>
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
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="customers"
          />
        </CardContent>
      )}
    </Card>
  );
}
