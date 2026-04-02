'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { useCreditNoteImpact } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatMarginPct } from '@/lib/customer-margin/format';
import { exportToExcel } from '@/lib/export-excel';

interface Props {
  filters: MarginDashboardFilters;
}

export function CreditNoteImpactTable({ filters }: Props) {
  const { data: rawData } = useCreditNoteImpact(filters);
  const data = useStableData(rawData);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const tableRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  const allRows = data ?? [];
  const pagedRows = allRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const el = tableRef.current;
    if (el && pagedRows.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [pagedRows.length > 0, pageSize]);

  function handleExportExcel() {
    exportToExcel('credit-note-impact', [
      { header: 'Customer', key: 'company_name', width: 30 },
      { header: 'IV Revenue', key: 'iv_revenue', width: 16 },
      { header: 'CN Amount', key: 'cn_revenue', width: 16 },
      { header: 'Return Rate %', key: 'return_rate_pct', width: 14 },
      { header: 'Margin Before', key: 'margin_before', width: 14 },
      { header: 'Margin After', key: 'margin_after', width: 14 },
      { header: 'Margin Lost', key: 'margin_lost', width: 14 },
    ], allRows.map(r => ({
      company_name: r.company_name ?? r.debtor_code,
      iv_revenue: r.iv_revenue,
      cn_revenue: r.cn_revenue,
      return_rate_pct: r.return_rate_pct,
      margin_before: r.margin_before,
      margin_after: r.margin_after,
      margin_lost: r.margin_lost,
    })));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Credit Note Impact on Margins</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          Export Excel
        </Button>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <div ref={tableRef} style={{ minHeight: lockedHeight.current }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">IV Revenue</TableHead>
                  <TableHead className="text-right">CN Amount</TableHead>
                  <TableHead className="text-right">Return Rate</TableHead>
                  <TableHead className="text-right">Margin Before</TableHead>
                  <TableHead className="text-right">Margin After</TableHead>
                  <TableHead className="text-right">Margin Lost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map(r => (
                  <TableRow key={r.debtor_code}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {r.company_name ?? r.debtor_code}
                    </TableCell>
                    <TableCell className="text-right">{formatRM(r.iv_revenue)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatRM(r.cn_revenue)}</TableCell>
                    <TableCell className={`text-right font-medium ${r.return_rate_pct > 10 ? 'text-red-600' : r.return_rate_pct > 5 ? 'text-amber-600' : ''}`}>
                      {formatMarginPct(r.return_rate_pct)}
                    </TableCell>
                    <TableCell className="text-right">{formatMarginPct(r.margin_before)}</TableCell>
                    <TableCell className="text-right">{formatMarginPct(r.margin_after)}</TableCell>
                    <TableCell className={`text-right ${r.margin_lost > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {r.margin_lost > 0 ? '-' : '+'}{formatMarginPct(Math.abs(r.margin_lost))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={allRows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="customers"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
