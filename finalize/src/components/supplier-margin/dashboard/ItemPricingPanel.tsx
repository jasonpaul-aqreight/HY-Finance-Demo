'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, PackageSearch, ChevronDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import {
  useProcurementItems,
  useProcurementSummary,
  useProcurementTrend,
} from '@/hooks/supplier-margin/useMarginData';
import { formatRM } from '@/lib/supplier-margin/format';
import type { ProcurementItemRow } from '@/lib/supplier-margin/queries';
import type { ItemPriceMonthlyRowV2 } from '@/lib/supplier-margin/queries-v2';

// ─── Color palette for supplier lines ────────────────────────────────────────

const SUPPLIER_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea',
  '#0891b2', '#e11d48', '#4f46e5', '#ca8a04', '#059669',
  '#7c3aed', '#0d9488', '#c026d3', '#ea580c', '#6366f1',
  '#65a30d', '#db2777', '#0284c7', '#a21caf', '#b91c1c',
];

// ─── Item Search Combobox ────────────────────────────────────────────────────

function ItemSearchCombobox({
  items,
  selected,
  onChange,
}: {
  items: ProcurementItemRow[];
  selected: string | null;
  onChange: (itemCode: string | null) => void;
}) {
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

  const filtered = useMemo(() =>
    (items ?? []).filter(item =>
      !search ||
      item.item_code.toLowerCase().includes(search.toLowerCase()) ||
      item.item_description.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 50),
    [items, search]
  );

  const selectedItem = items?.find(i => i.item_code === selected);

  return (
    <div className="relative" ref={ref} data-testid="item-search-combobox">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted"
      >
        <Search className="size-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">
          {selectedItem
            ? `${selectedItem.item_code} — ${selectedItem.item_description}`
            : 'Search items by code or name...'}
        </span>
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[500px] rounded-lg border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by item code or description..."
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
            {selected && (
              <button
                onClick={(e) => { e.stopPropagation(); onChange(null); setSearch(''); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.map(item => (
              <button
                key={item.item_code}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent ${
                  selected === item.item_code ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  onChange(item.item_code);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">{item.item_code}</span>
                  <div className="truncate text-sm">{item.item_description}</div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {item.supplier_count} suppliers
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No items found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Price Trend Chart ───────────────────────────────────────────────────────

function pivotTrendData(data: ItemPriceMonthlyRowV2[]) {
  const months = [...new Set(data.map(r => r.year_month))].sort();
  const suppliers = [...new Set(data.map(r => r.creditor_code))];
  const nameMap = new Map(data.map(r => [r.creditor_code, r.creditor_name]));

  const pivoted = months.map(month => {
    const row: Record<string, string | number> = { month };
    for (const code of suppliers) {
      const match = data.find(r => r.year_month === month && r.creditor_code === code);
      if (match) row[code] = match.avg_buy_price;
    }
    return row;
  });

  return { pivoted, suppliers, nameMap };
}

function PriceTrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[240px]">
      <div className="font-semibold mb-2">{label}</div>
      {payload
        .filter(p => p.value != null)
        .sort((a, b) => a.value - b.value)
        .map(p => (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span className="truncate" style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono shrink-0">{formatRM(p.value, 2)}</span>
          </div>
        ))}
    </div>
  );
}

function ItemPriceTrendChart({
  data,
  isLoading,
}: {
  data: ItemPriceMonthlyRowV2[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Price Trend by Supplier</CardTitle></CardHeader>
        <CardContent><div className="h-[400px] bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Price Trend by Supplier</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No trend data available for this item
          </div>
        </CardContent>
      </Card>
    );
  }

  const { pivoted, suppliers, nameMap } = pivotTrendData(data);

  return (
    <Card data-testid="price-trend-chart">
      <CardHeader className="pb-2">
        <CardTitle>Price Trend by Supplier</CardTitle>
        <p className="text-xs text-muted-foreground">
          Monthly average purchase price (MYR) — click legend to toggle suppliers
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={pivoted} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatRM(v, 2)}
            />
            <Tooltip content={<PriceTrendTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
            />
            {suppliers.map((code, idx) => (
              <Line
                key={code}
                type="monotone"
                dataKey={code}
                name={nameMap.get(code) ?? code}
                stroke={SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Supplier Comparison Table ───────────────────────────────────────────────

function SupplierComparisonTable({
  data,
  isLoading,
  colorMap,
}: {
  data: { suppliers: Array<{
    creditor_code: string;
    creditor_name: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    latest_price: number;
    latest_date: string;
    total_qty: number;
    total_buy: number;
    trend: 'up' | 'down' | 'flat';
    is_cheapest: boolean;
  }> } | undefined;
  isLoading: boolean;
  colorMap: Map<string, string>;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Supplier Comparison</CardTitle></CardHeader>
        <CardContent><div className="h-40 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  if (!data?.suppliers?.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Supplier Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">No supplier data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="supplier-comparison-table">
      <CardHeader className="pb-2">
        <CardTitle>Supplier Comparison</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sorted by average price (cheapest first) — best deal highlighted
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Supplier Code</TableHead>
                <TableHead className="text-xs">Supplier Name</TableHead>
                <TableHead className="text-xs text-right">Avg Price</TableHead>
                <TableHead className="text-xs text-right">Latest Price</TableHead>
                <TableHead className="text-xs text-right">Min</TableHead>
                <TableHead className="text-xs text-right">Max</TableHead>
                <TableHead className="text-xs text-right">Qty</TableHead>
                <TableHead className="text-xs text-center">Trend</TableHead>
                <TableHead className="text-xs">Last Purchase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.suppliers.map((row, i) => (
                <TableRow
                  key={row.creditor_code}
                  className={row.is_cheapest ? 'bg-emerald-50 dark:bg-emerald-950/30' : (i % 2 === 0 ? 'bg-muted/20' : '')}
                  data-testid={row.is_cheapest ? 'cheapest-supplier-row' : undefined}
                >
                  <TableCell className="font-mono text-xs">
                    <span style={{ color: colorMap.get(row.creditor_code) }}>
                      ● {row.creditor_code}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">{row.creditor_name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatRM(row.avg_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatRM(row.latest_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatRM(row.min_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatRM(row.max_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.total_qty.toLocaleString('en-MY')}</TableCell>
                  <TableCell className="text-center">
                    {row.trend === 'up' && <span className="text-red-600 text-xs font-medium">▲</span>}
                    {row.trend === 'down' && <span className="text-emerald-600 text-xs font-medium">▼</span>}
                    {row.trend === 'flat' && <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.latest_date || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function ItemPricingPanel({ filters }: { filters: DashboardFilters }) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const { data: items } = useProcurementItems(filters);
  const { data: summary, isLoading: summaryLoading } = useProcurementSummary(selectedItem, filters);
  const { data: trend, isLoading: trendLoading } = useProcurementTrend(selectedItem, filters);

  // Build color map from trend data so table supplier codes match chart line colors
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (trend?.length) {
      const suppliers = [...new Set(trend.map(r => r.creditor_code))];
      suppliers.forEach((code, idx) => {
        map.set(code, SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length]);
      });
    }
    return map;
  }, [trend]);

  return (
    <div className="space-y-4 pt-4">
      {/* Item search */}
      <div className="max-w-2xl">
        <ItemSearchCombobox
          items={items ?? []}
          selected={selectedItem}
          onChange={setSelectedItem}
        />
      </div>

      {/* Empty state */}
      {!selectedItem && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="item-pricing-empty">
          <PackageSearch className="size-12 mb-3 opacity-40" />
          <p className="text-sm">Search for an item above to compare supplier pricing trends</p>
        </div>
      )}

      {/* Chart + Table */}
      {selectedItem && (
        <>
          <ItemPriceTrendChart data={trend} isLoading={trendLoading} />
          <SupplierComparisonTable data={summary} isLoading={summaryLoading} colorMap={colorMap} />
        </>
      )}
    </div>
  );
}
