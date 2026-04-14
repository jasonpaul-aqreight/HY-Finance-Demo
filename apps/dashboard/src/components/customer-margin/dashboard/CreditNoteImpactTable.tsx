'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { useCreditNoteImpact } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatMarginPct } from '@/lib/customer-margin/format';
import { exportToExcel } from '@/lib/export-excel';
import { Download, ArrowUpDown, Search, X } from 'lucide-react';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';

interface Props {
  filters: MarginDashboardFilters;
}

type SortCol = 'company_name' | 'iv_revenue' | 'cn_revenue' | 'return_rate_pct' | 'margin_before' | 'margin_after' | 'margin_lost';

export function CreditNoteImpactTable({ filters }: Props) {
  const { data: rawData } = useCreditNoteImpact(filters);
  const data = useStableData(rawData);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [sort, setSort] = useState<SortCol>('margin_lost');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  const allRows = data ?? [];

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(r =>
      (r.company_name ?? '').toLowerCase().includes(q) ||
      r.debtor_code.toLowerCase().includes(q)
    );
  }, [allRows, search]);

  // Sort client-side
  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let av: string | number = a[sort] ?? '';
      let bv: string | number = b[sort] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, sort, order]);

  const pagedRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const el = tableRef.current;
    if (el && pagedRows.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [pagedRows.length > 0, pageSize]);

  const toggleSort = useCallback((col: SortCol) => {
    if (sort === col) {
      setOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  }, [sort]);

  function handleExportExcel() {
    exportToExcel('credit-note-impact', [
      { header: 'Customer', key: 'company_name', width: 30 },
      { header: 'Invoice Sales', key: 'iv_revenue', width: 16 },
      { header: 'Credit Note Amt', key: 'cn_revenue', width: 16 },
      { header: 'Return Rate %', key: 'return_rate_pct', width: 14 },
      { header: 'Margin Before', key: 'margin_before', width: 14 },
      { header: 'Margin After', key: 'margin_after', width: 14 },
      { header: 'Margin Lost', key: 'margin_lost', width: 14 },
    ], sorted.map(r => ({
      company_name: r.company_name ?? r.debtor_code,
      iv_revenue: r.iv_revenue,
      cn_revenue: r.cn_revenue,
      return_rate_pct: r.return_rate_pct,
      margin_before: r.margin_before,
      margin_after: r.margin_after,
      margin_lost: r.margin_lost,
    })));
  }

  const SortHeader = ({ col, children, className }: { col: SortCol; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="size-3 text-muted-foreground" />
        {sort === col && <span className="text-xs">{order === 'desc' ? '↓' : '↑'}</span>}
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Credit Note Impact on Margins</CardTitle>
            <AnalyzeIcon sectionKey="customer_margin_breakdown" componentKey="cm_credit_note_impact" />
          </div>
          <p className="mt-1 text-sm text-foreground/70">
            Shows how credit notes affect each customer's margin — identify customers where returns erode profitability
            or where returned low-margin products actually improve overall margin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by code or name..."
              className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-8 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" size="xs" onClick={handleExportExcel}>
            <Download className="size-3" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <div ref={tableRef} style={{ minHeight: lockedHeight.current }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader col="company_name">Customer</SortHeader>
                  <SortHeader col="iv_revenue" className="text-right">Invoice Sales</SortHeader>
                  <SortHeader col="cn_revenue" className="text-right">Credit Note Amt</SortHeader>
                  <SortHeader col="return_rate_pct" className="text-right">Return Rate</SortHeader>
                  <SortHeader col="margin_before" className="text-right">Margin Before</SortHeader>
                  <SortHeader col="margin_after" className="text-right">Margin After</SortHeader>
                  <SortHeader col="margin_lost" className="text-right">Margin Lost</SortHeader>
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
              total={sorted.length}
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
