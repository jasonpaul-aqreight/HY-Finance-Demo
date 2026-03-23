'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useSupplierTable, useSupplierItems, useSparklines, useDimensions } from '@/hooks/supplier-margin/useMarginData';
import { Sparkline } from './Sparkline';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM, formatCount, marginColor } from '@/lib/supplier-margin/format';
import { Search, ChevronDown, X } from 'lucide-react';

interface SupplierRow {
  creditor_code: string;
  company_name: string;
  supplier_type: string | null;
  attributed_revenue: number;
  attributed_cogs: number;
  attributed_profit: number;
  margin_pct: number | null;
  avg_purchase_price: number | null;
  avg_selling_price: number | null;
  price_spread: number | null;
  items_supplied: number;
  trend?: 'up' | 'down' | 'flat';
}

interface ItemRow {
  item_code: string;
  description: string;
  item_group: string | null;
  qty_purchased: number;
  avg_purchase_price: number | null;
  qty_sold: number;
  revenue: number;
  cogs: number;
  margin_pct: number | null;
}

type SortKey = 'company_name' | 'attributed_revenue' | 'attributed_cogs' | 'attributed_profit' | 'margin_pct' | 'items_supplied';

const PAGE_SIZE = 20;

/* ── Combobox multi-select ─────────────────────────────────────────────────── */

function SupplierCombobox({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const { data: dims } = useDimensions();
  const suppliers: { AccNo: string; CompanyName: string }[] = dims?.suppliers ?? [];
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

  const filtered = suppliers.filter(s =>
    !search || s.AccNo.toLowerCase().includes(search.toLowerCase()) ||
    s.CompanyName.toLowerCase().includes(search.toLowerCase())
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
            ? `${selected.length} supplier${selected.length > 1 ? 's' : ''} selected`
            : 'Search suppliers...'}
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
              placeholder="Search suppliers..."
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map(s => (
              <label
                key={s.AccNo}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.AccNo)}
                  onChange={() => toggle(s.AccNo)}
                  className="size-3.5 rounded border-input"
                />
                <span className="truncate">
                  <span className="text-muted-foreground">{s.AccNo}</span>
                  {' '}{s.CompanyName}
                </span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No suppliers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Item breakdown (expanded row) ─────────────────────────────────────────── */

function ItemBreakdownTable({ creditorCode, filters }: { creditorCode: string; filters: DashboardFilters }) {
  const { data, isLoading } = useSupplierItems(creditorCode, filters);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading items...</div>;

  const items: ItemRow[] = data?.data ?? [];

  return (
    <div className="bg-muted/30 border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Group</TableHead>
            <TableHead className="text-right">Qty Purchased</TableHead>
            <TableHead className="text-right">Avg Purchase</TableHead>
            <TableHead className="text-right">Qty Sold</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Purchase Cost</TableHead>
            <TableHead className="text-right">Margin %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.item_code}>
              <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
              <TableCell className="text-xs max-w-[200px] truncate">{item.description}</TableCell>
              <TableCell className="text-xs">{item.item_group ?? '—'}</TableCell>
              <TableCell className="text-right text-xs">{formatCount(item.qty_purchased)}</TableCell>
              <TableCell className="text-right text-xs font-mono">{item.avg_purchase_price != null ? formatRM(item.avg_purchase_price, 2) : '—'}</TableCell>
              <TableCell className="text-right text-xs">{formatCount(item.qty_sold)}</TableCell>
              <TableCell className="text-right text-xs font-mono">{formatRM(item.revenue, 2)}</TableCell>
              <TableCell className="text-right text-xs font-mono">{formatRM(item.cogs, 2)}</TableCell>
              <TableCell className={`text-right text-xs font-medium ${marginColor(item.margin_pct)}`}>
                {item.margin_pct != null ? `${item.margin_pct.toFixed(1)}%` : '—'}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-4 text-xs">
                No item data for this supplier in selected period
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ── CSV export ────────────────────────────────────────────────────────────── */

function exportCsv(rows: SupplierRow[]) {
  const headers = ['Supplier Code','Supplier Name','Type','Revenue','Purchase Cost','Profit','Trend','Margin %','Items'];
  const lines = rows.map(r => [
    r.creditor_code,
    `"${r.company_name}"`,
    r.supplier_type ?? '',
    r.attributed_revenue.toFixed(2),
    r.attributed_cogs.toFixed(2),
    r.attributed_profit.toFixed(2),
    r.trend ?? '',
    r.margin_pct != null ? r.margin_pct.toFixed(2) : '',
    r.items_supplied,
  ].join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'supplier-margin-data.csv';
  a.click();
}

/* ── Main table ────────────────────────────────────────────────────────────── */

export function SupplierTable({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useSupplierTable(filters);
  const { data: sparklineData } = useSparklines(filters);
  const sparklines: Record<string, number[]> = sparklineData?.data ?? {};
  const [sortKey, setSortKey] = useState<SortKey>('attributed_revenue');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  const rows: SupplierRow[] = data?.data ?? [];

  const filtered = useMemo(() => {
    if (selectedSuppliers.length === 0) return rows;
    const set = new Set(selectedSuppliers);
    return rows.filter(r => set.has(r.creditor_code));
  }, [rows, selectedSuppliers]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  }

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50"
        onClick={() => handleSort(col)}
      >
        <span className="flex items-center gap-1">
          {label}
          {active ? (sortAsc ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </TableHead>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Supplier Analysis</CardTitle></CardHeader>
        <CardContent><div className="h-48 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle>Supplier Analysis</CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <SupplierCombobox
                selected={selectedSuppliers}
                onChange={v => { setSelectedSuppliers(v); setPage(0); }}
              />
            </div>
            {selectedSuppliers.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedSuppliers([]); setPage(0); }}>
                <X className="size-3" /> Clear
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => exportCsv(sorted)}>
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Code</TableHead>
                <SortHeader col="company_name" label="Supplier Name" />
                <TableHead>Type</TableHead>
                <SortHeader col="items_supplied" label="Items" />
                <SortHeader col="attributed_revenue" label="Revenue" />
                <SortHeader col="attributed_cogs" label="Purchase Cost" />
                <SortHeader col="attributed_profit" label="Profit" />
                <TableHead className="w-[130px]">Trend</TableHead>
                <SortHeader col="margin_pct" label="Margin %" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => (
                <Fragment key={row.creditor_code}>
                  <TableRow
                    className={`cursor-pointer ${i % 2 === 0 ? 'bg-muted/20' : ''} ${expandedCode === row.creditor_code ? 'bg-muted/40' : ''}`}
                    onClick={() => setExpandedCode(expandedCode === row.creditor_code ? null : row.creditor_code)}
                  >
                    <TableCell className="text-xs">{expandedCode === row.creditor_code ? '▼' : '▶'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.creditor_code}</TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">{row.company_name}</TableCell>
                    <TableCell className="text-xs">{row.supplier_type ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{row.items_supplied}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatRM(row.attributed_revenue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatRM(row.attributed_cogs)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatRM(row.attributed_profit)}</TableCell>
                    <TableCell className="w-[130px]">
                      <div className="flex items-center gap-1">
                        <Sparkline data={sparklines[row.creditor_code] ?? []} />
                        {row.trend === 'up' && <span className="text-emerald-600 text-xs font-medium">▲</span>}
                        {row.trend === 'down' && <span className="text-red-600 text-xs font-medium">▼</span>}
                        {row.trend === 'flat' && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${marginColor(row.margin_pct)}`}>
                      {row.margin_pct != null ? `${row.margin_pct.toFixed(1)}%` : '—'}
                    </TableCell>
                  </TableRow>
                  {expandedCode === row.creditor_code && (
                    <TableRow key={`${row.creditor_code}-detail`}>
                      <TableCell colSpan={10} className="p-0">
                        <ItemBreakdownTable creditorCode={row.creditor_code} filters={filters} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No supplier data for selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              {sorted.length} suppliers · page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
