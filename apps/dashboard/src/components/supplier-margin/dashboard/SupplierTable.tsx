'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSupplierTable, useSparklines, useDimensions } from '@/hooks/supplier-margin/useMarginData';
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
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { formatRM, marginColor } from '@/lib/supplier-margin/format';
import { exportToExcel } from '@/lib/export-excel';
import { Search, ChevronDown, X, Info } from 'lucide-react';
import { SupplierProfileModal } from '@/components/profiles/SupplierProfileModal';
import { SparklineTooltip, type SparklineTooltipColumn } from '@/components/shared/SparklineTooltip';
import { formatMonth } from '@/lib/format-month';

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

type SortKey = 'company_name' | 'attributed_revenue' | 'attributed_cogs' | 'attributed_profit' | 'margin_pct' | 'items_supplied';

type SparklinePoint = { period: string; margin_pct: number };

const supplierMarginColumns: SparklineTooltipColumn<SparklinePoint>[] = [
  { header: 'Month', align: 'left', render: (r) => <span className="text-foreground/70">{formatMonth(r.period)}</span> },
  { header: 'Margin %', align: 'right', render: (r) => <span className="font-mono">{r.margin_pct.toFixed(1)}%</span> },
];

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

/* ── Excel export ─────────────────────────────────────────────────────────── */

function handleExportExcel(rows: SupplierRow[]) {
  exportToExcel('supplier-margin-data', [
    { header: 'Supplier Code', key: 'creditor_code', width: 14 },
    { header: 'Supplier Name', key: 'company_name', width: 30 },
    { header: 'Type', key: 'supplier_type', width: 16 },
    { header: 'Items', key: 'items_supplied', width: 10 },
    { header: 'Est. Net Sales', key: 'attributed_revenue', width: 16 },
    { header: 'Est. Cost of Sales', key: 'attributed_cogs', width: 18 },
    { header: 'Est. Gross Profit', key: 'attributed_profit', width: 16 },
    { header: 'Margin %', key: 'margin_pct', width: 12 },
  ], rows.map(r => ({
    creditor_code: r.creditor_code,
    company_name: r.company_name,
    supplier_type: r.supplier_type ?? '',
    items_supplied: r.items_supplied,
    attributed_revenue: r.attributed_revenue,
    attributed_cogs: r.attributed_cogs,
    attributed_profit: r.attributed_profit,
    margin_pct: r.margin_pct != null ? r.margin_pct : '',
  })));
}

/* ── Main table ────────────────────────────────────────────────────────────── */

export function SupplierTable({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useSupplierTable(filters);
  const { data: sparklineData } = useSparklines(filters);
  const sparklines: Record<string, SparklinePoint[]> = sparklineData?.data ?? {};
  const [sortKey, setSortKey] = useState<SortKey>('attributed_revenue');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [profileSupplier, setProfileSupplier] = useState<SupplierRow | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

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

  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  // Lock container height to prevent layout jump during page transitions
  useEffect(() => {
    const el = tableRef.current;
    if (el && pageRows.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [pageRows.length > 0, pageSize]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
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
          <div>
            <CardTitle>Supplier Analysis</CardTitle>
            <p className="flex items-start gap-1.5 text-xs text-foreground/70 mt-1">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="flex flex-col gap-0.5"><span><strong>Est.</strong> = Estimated — the system does not track which supplier's stock was sold to which customer, so revenue, cost of sales, and profit are split based on each supplier's share of total purchases.</span><span>Qty Purchased, Avg Purchase / Unit, and Total Spend use actual data from purchase invoices.</span></span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <SupplierCombobox
                selected={selectedSuppliers}
                onChange={v => { setSelectedSuppliers(v); setPage(1); }}
              />
            </div>
            {selectedSuppliers.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedSuppliers([]); setPage(1); }}>
                <X className="size-3" /> Clear
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleExportExcel(sorted)}>
              Export Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={tableRef} style={{ minHeight: lockedHeight.current }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <SortHeader col="company_name" label="Supplier Name" />
                <TableHead>Type</TableHead>
                <SortHeader col="items_supplied" label="Items" />
                <SortHeader col="attributed_revenue" label="Est. Net Sales" />
                <SortHeader col="attributed_cogs" label="Est. Cost of Sales" />
                <SortHeader col="attributed_profit" label="Est. Gross Profit" />
                <TableHead className="w-[130px]">Trend</TableHead>
                <SortHeader col="margin_pct" label="Margin %" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => (
                <TableRow
                  key={row.creditor_code}
                  className={i % 2 === 0 ? 'bg-muted/20' : ''}
                >
                  <TableCell className="font-mono text-xs">{row.creditor_code}</TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">
                    <button className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onClick={() => setProfileSupplier(row)}>{row.company_name}</button>
                  </TableCell>
                  <TableCell className="text-xs">{row.supplier_type ?? '—'}</TableCell>
                  <TableCell className="text-sm">{row.items_supplied}</TableCell>
                  <TableCell className="text-sm">{formatRM(row.attributed_revenue)}</TableCell>
                  <TableCell className="text-sm">{formatRM(row.attributed_cogs)}</TableCell>
                  <TableCell className="text-sm font-semibold">{formatRM(row.attributed_profit)}</TableCell>
                  <TableCell className="w-[130px]">
                      <SparklineTooltip<SparklinePoint>
                        title={row.company_name}
                        data={sparklines[row.creditor_code] ?? []}
                        periodKey="period"
                        valueKey="margin_pct"
                        valueLabel="Margin %"
                        valueFormatter={(v) => `${v.toFixed(1)}%`}
                        improvementDirection="up"
                        columns={supplierMarginColumns}
                      />
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {row.margin_pct != null ? `${row.margin_pct.toFixed(1)}%` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No supplier data for selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="suppliers"
        />
        </div>
      </CardContent>

      {profileSupplier && (
        <SupplierProfileModal
          open={!!profileSupplier}
          onClose={() => setProfileSupplier(null)}
          creditorCode={profileSupplier.creditor_code}
          companyName={profileSupplier.company_name}
          initialStartDate={filters.startDate}
          initialEndDate={filters.endDate}
          initialView="items"
          supplierMetrics={{
            attributed_revenue: profileSupplier.attributed_revenue,
            attributed_cogs: profileSupplier.attributed_cogs,
            attributed_profit: profileSupplier.attributed_profit,
            margin_pct: profileSupplier.margin_pct,
            items_supplied: profileSupplier.items_supplied,
          }}
        />
      )}
    </Card>
  );
}
