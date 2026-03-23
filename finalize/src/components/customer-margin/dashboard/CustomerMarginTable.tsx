'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useCustomerMargins, useCustomerProducts, useCustomerMonthly, useFilterCustomers } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import type { ProductRow } from '@/lib/customer-margin/queries';
import { formatRM, formatMarginPct, marginColor } from '@/lib/customer-margin/format';
import { CustomerSparkline } from './CustomerSparkline';
import { Download, ArrowUpDown, ChevronRight, ChevronDown, Search, X } from 'lucide-react';

interface Props {
  filters: MarginDashboardFilters;
}

const COL_COUNT = 9; // total columns including expand toggle and trend

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
            : 'Search customers...'}
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
              placeholder="Search customers..."
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

/* ── Product breakdown (expanded row) ──────────────────────────────────────── */

function ProductBreakdown({ code, startDate, endDate }: { code: string; startDate: string; endDate: string }) {
  const { data, isLoading } = useCustomerProducts(code, startDate, endDate);
  const products = data?.data ?? [];

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={COL_COUNT} className="bg-muted/30 py-3 text-center text-sm text-muted-foreground">
          Loading products...
        </TableCell>
      </TableRow>
    );
  }

  if (products.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={COL_COUNT} className="bg-muted/30 py-3 text-center text-sm text-muted-foreground">
          No product data found
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={COL_COUNT} className="bg-muted/30 p-0">
        <div className="px-6 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium">Item Code</th>
                <th className="px-2 py-1.5 text-left font-medium">Description</th>
                <th className="px-2 py-1.5 text-left font-medium">Product Group</th>
                <th className="px-2 py-1.5 text-right font-medium">Qty Sold</th>
                <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                <th className="px-2 py-1.5 text-right font-medium">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: ProductRow) => (
                <tr key={p.item_code} className="border-b border-border/50">
                  <td className="px-2 py-1.5 text-muted-foreground">{p.item_code}</td>
                  <td className="max-w-[200px] truncate px-2 py-1.5">{p.description}</td>
                  <td className="px-2 py-1.5">{p.product_group || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{Math.round(p.qty_sold).toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right">{formatRM(p.revenue)}</td>
                  <td className="px-2 py-1.5 text-right">{formatRM(p.cost)}</td>
                  <td className={`px-2 py-1.5 text-right font-medium ${marginColor(p.margin_pct)}`}>
                    {formatMarginPct(p.margin_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCell>
    </TableRow>
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const limit = 20;

  const { data, isLoading } = useCustomerMargins(filters, sort, order, page, limit);

  const toggleSort = useCallback((col: string) => {
    if (sort === col) {
      setOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  }, [sort]);

  const toggleExpand = useCallback((code: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const exportCsv = useCallback(() => {
    if (!data?.rows) return;
    const headers = ['Code', 'Name', 'Type', 'Revenue', 'COGS', 'Gross Profit', 'Margin %', 'Trend'];
    const lines = data.rows.map(r =>
      [r.debtor_code, r.company_name ?? '', r.debtor_type ?? '',
       r.revenue, r.cogs, r.gross_profit, r.margin_pct,
       (r as { trend?: string }).trend ?? ''].join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_margins.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead>
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="size-3 text-muted-foreground" />
        {sort === col && <span className="text-xs">{order === 'desc' ? '\u2193' : '\u2191'}</span>}
      </button>
    </TableHead>
  );

  const rows = data?.rows ?? [];
  const filteredRows = useMemo(() => {
    if (selectedCustomers.length === 0) return rows;
    const set = new Set(selectedCustomers);
    return rows.filter(r => set.has(r.debtor_code));
  }, [rows, selectedCustomers]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Customer Analysis</CardTitle>
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
          <Button variant="outline" size="xs" onClick={exportCsv}>
            <Download className="size-3" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Code</TableHead>
                  <SortHeader col="company_name">Name</SortHeader>
                  <TableHead>Type</TableHead>
                  <SortHeader col="revenue">Revenue</SortHeader>
                  <SortHeader col="cogs">COGS</SortHeader>
                  <SortHeader col="gross_profit">Gross Profit</SortHeader>
                  <SortHeader col="margin_pct">Margin %</SortHeader>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map(r => {
                  const isExpanded = expandedRows.has(r.debtor_code);
                  return (
                    <React.Fragment key={r.debtor_code}>
                      <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => toggleExpand(r.debtor_code)}>
                        <TableCell className="w-8 px-2">
                          {isExpanded
                            ? <ChevronDown className="size-4 text-muted-foreground" />
                            : <ChevronRight className="size-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.debtor_code}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">{r.company_name}</TableCell>
                        <TableCell><Badge variant="secondary">{r.debtor_type}</Badge></TableCell>
                        <TableCell className="text-right">{formatRM(r.revenue)}</TableCell>
                        <TableCell className="text-right">{formatRM(r.cogs)}</TableCell>
                        <TableCell className={`text-right font-medium ${r.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRM(r.gross_profit)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${marginColor(r.margin_pct)}`}>
                          {formatMarginPct(r.margin_pct)}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <SparklineCell code={r.debtor_code} startDate={filters.startDate} endDate={filters.endDate} />
                            {(r as { trend?: string }).trend === 'up' && <span className="text-emerald-600 text-xs font-medium">▲</span>}
                            {(r as { trend?: string }).trend === 'down' && <span className="text-red-600 text-xs font-medium">▼</span>}
                            {(r as { trend?: string }).trend === 'flat' && <span className="text-muted-foreground text-xs">—</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <ProductBreakdown
                          key={`${r.debtor_code}-products`}
                          code={r.debtor_code}
                          startDate={filters.startDate}
                          endDate={filters.endDate}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data?.total ?? 0} customers total
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Prev
                </Button>
                <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
