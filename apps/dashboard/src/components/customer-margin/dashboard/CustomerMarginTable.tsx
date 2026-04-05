'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { useCustomerMargins, useCustomerMonthly, useFilterCustomers } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatMarginPct, marginColor } from '@/lib/customer-margin/format';
import { CustomerSparkline } from './CustomerSparkline';
import { exportToExcel } from '@/lib/export-excel';
import { Download, ArrowUpDown, ChevronDown, Search, X } from 'lucide-react';
import { CustomerProfileRevamp } from '@/components/profiles/CustomerProfileRevampPreview';

interface Props {
  filters: MarginDashboardFilters;
}

/* ── Combobox multi-select ─────────────────────────────────────────────────── */

function CustomerCombobox({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const { data: customers } = useFilterCustomers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = (customers ?? []).filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.name ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);

  const toggle = (code: string) => {
    onChange(
      selected.includes(code)
        ? selected.filter(v => v !== code)
        : [...selected, code]
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm hover:bg-muted"
      >
        <Search className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-left">
          {selected.length > 0
            ? `${selected.length} customer${selected.length > 1 ? 's' : ''} selected`
            : 'Search by code or name...'}
        </span>
        {selected.length > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-80 rounded-lg border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code or name..."
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map(c => (
              <label
                key={c.code}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.code)}
                  onChange={() => toggle(c.code)}
                  className="size-3.5 rounded border-input"
                />
                <span className="truncate">
                  <span className="text-muted-foreground">{c.code}</span>
                  {' '}{c.name}
                </span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No customers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SparklineCell({ code, startDate, endDate }: { code: string; startDate: string; endDate: string }) {
  const { data } = useCustomerMonthly(code, startDate, endDate);
  return <CustomerSparkline data={data ?? []} />;
}

/* ── Main table ────────────────────────────────────────────────────────────── */

export function CustomerMarginTable({ filters }: Props) {
  const [sort, setSort] = useState('gross_profit');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<{
    debtor_code: string; company_name: string;
  } | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const tableRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  const { data: rawData } = useCustomerMargins(filters, sort, order, page, pageSize, selectedCustomers);
  const data = useStableData(rawData);

  // Lock container height to prevent layout jump during page transitions
  useEffect(() => {
    const el = tableRef.current;
    if (el && data && data.rows.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [data && data.rows.length > 0, pageSize]);

  const toggleSort = useCallback((col: string) => {
    if (sort === col) {
      setOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  }, [sort]);

  const handleExport = useCallback(() => {
    if (!data?.rows) return;
    exportToExcel('customer_margins', [
      { header: 'Code', key: 'debtor_code', width: 14 },
      { header: 'Name', key: 'company_name', width: 30 },
      { header: 'Type', key: 'debtor_type', width: 16 },
      { header: 'Net Sales', key: 'revenue', width: 16 },
      { header: 'Cost of Sales', key: 'cogs', width: 16 },
      { header: 'Gross Profit', key: 'gross_profit', width: 16 },
      { header: 'Margin %', key: 'margin_pct', width: 12 },
    ], data.rows.map(r => ({
      debtor_code: r.debtor_code,
      company_name: r.company_name ?? '',
      debtor_type: r.debtor_type ?? '',
      revenue: r.revenue,
      cogs: r.cogs,
      gross_profit: r.gross_profit,
      margin_pct: r.margin_pct,
    })));
  }, [data]);

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead>
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="size-3 text-muted-foreground" />
        {sort === col && <span className="text-xs">{order === 'desc' ? '\u2193' : '\u2191'}</span>}
      </button>
    </TableHead>
  );

  const filteredRows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Customer Analysis</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <CustomerCombobox
              selected={selectedCustomers}
              onChange={v => { setSelectedCustomers(v); setPage(1); }}
            />
          </div>
          {selectedCustomers.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => { setSelectedCustomers([]); setPage(1); }}>
              <X className="size-3" /> Clear
            </Button>
          )}
          <Button variant="outline" size="xs" onClick={handleExport}>
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
                  <TableHead>Code</TableHead>
                  <SortHeader col="company_name">Name</SortHeader>
                  <TableHead>Type</TableHead>
                  <SortHeader col="revenue">Net Sales</SortHeader>
                  <SortHeader col="cogs">Cost of Sales</SortHeader>
                  <SortHeader col="gross_profit">Gross Profit</SortHeader>
                  <SortHeader col="margin_pct">Margin %</SortHeader>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map(r => (
                  <TableRow
                    key={r.debtor_code}
                  >
                    <TableCell className="text-xs text-muted-foreground">{r.debtor_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      <button className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onClick={() => setSelectedProfile({ debtor_code: r.debtor_code, company_name: r.company_name ?? '' })}>{r.company_name}</button>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{r.debtor_type}</Badge></TableCell>
                    <TableCell>{formatRM(r.revenue)}</TableCell>
                    <TableCell>{formatRM(r.cogs)}</TableCell>
                    <TableCell className={`font-medium ${r.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRM(r.gross_profit)}
                    </TableCell>
                    <TableCell className={`font-medium ${marginColor(r.margin_pct)}`}>
                      {formatMarginPct(r.margin_pct)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <SparklineCell code={r.debtor_code} startDate={filters.startDate} endDate={filters.endDate} />
                        {(r as { trend?: string }).trend === 'up' && <span className="text-emerald-600 text-xs font-medium">▲</span>}
                        {(r as { trend?: string }).trend === 'down' && <span className="text-red-600 text-xs font-medium">▼</span>}
                        {(r as { trend?: string }).trend === 'flat' && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="customers"
            />
          </div>
        )}
      </CardContent>

      {selectedProfile && (
        <CustomerProfileRevamp
          open={!!selectedProfile}
          onClose={() => setSelectedProfile(null)}
          debtorCode={selectedProfile.debtor_code}
          companyName={selectedProfile.company_name}
          defaultTab="sales"
          initialStartDate={filters.startDate}
          initialEndDate={filters.endDate}
        />
      )}
    </Card>
  );
}
