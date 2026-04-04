'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, PackageSearch, X, ChevronDown, Check, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
import type { ProcurementItemRow, ItemPriceMonthlyRowV2 } from '@/lib/supplier-margin/queries';

// ─── Color palette for supplier lines ────────────────────────────────────────

const SUPPLIER_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea',
  '#0891b2', '#e11d48', '#4f46e5', '#ca8a04', '#059669',
  '#7c3aed', '#0d9488', '#c026d3', '#ea580c', '#6366f1',
  '#65a30d', '#db2777', '#0284c7', '#a21caf', '#b91c1c',
];

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Dropdown Select ────────────────────────────────────────────────────────

function DropdownSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  options: Array<{ name: string; count: number }>;
  onChange: (val: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-muted"
        >
          <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
            {value ? titleCase(value) : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[280px] overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.name}
                onClick={() => { onChange(opt.name); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent ${
                  value === opt.name ? 'bg-accent' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  {value === opt.name && <Check className="size-3.5 text-foreground" />}
                  {titleCase(opt.name)}
                </span>
                <span className="text-xs text-muted-foreground">{opt.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">Price Trend by Supplier</CardTitle></CardHeader>
        <CardContent><div className="h-[300px] bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Price Trend by Supplier</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
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
        <CardTitle className="text-base">Price Trend by Supplier</CardTitle>
        <p className="text-xs text-muted-foreground">
          Monthly Avg Purchase / Unit (MYR) — click legend to toggle suppliers
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
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
            <Tooltip wrapperStyle={{ zIndex: 50 }} content={<PriceTrendTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} />
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
        <CardHeader className="pb-2"><CardTitle className="text-base">Supplier Comparison</CardTitle></CardHeader>
        <CardContent><div className="h-40 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  if (!data?.suppliers?.length) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Supplier Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground text-sm">No supplier data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="supplier-comparison-table">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Supplier Comparison</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sorted by average price (cheapest first) — best deal highlighted
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs text-right">Avg Price</TableHead>
                <TableHead className="text-xs text-right">Latest</TableHead>
                <TableHead className="text-xs text-right">Min</TableHead>
                <TableHead className="text-xs text-right">Max</TableHead>
                <TableHead className="text-xs text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.suppliers.map((row, i) => (
                <TableRow
                  key={row.creditor_code}
                  className={row.is_cheapest ? 'bg-emerald-50 dark:bg-emerald-950/30' : (i % 2 === 0 ? 'bg-muted/20' : '')}
                  data-testid={row.is_cheapest ? 'cheapest-supplier-row' : undefined}
                >
                  <TableCell className="text-sm">
                    <span style={{ color: colorMap.get(row.creditor_code) }} className="font-mono text-xs">● </span>
                    <span className="font-medium">{row.creditor_name}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatRM(row.avg_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatRM(row.latest_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatRM(row.min_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatRM(row.max_price, 2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.total_qty.toLocaleString('en-MY')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function ItemPricingPanel({ filters }: { filters: DashboardFilters }) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedFruit, setSelectedFruit] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const { data: items } = useProcurementItems(filters);
  const { data: summary, isLoading: summaryLoading } = useProcurementSummary(selectedItem, filters);
  const { data: trend, isLoading: trendLoading } = useProcurementTrend(selectedItem, filters);

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

  const allItems = items ?? [];

  const fruits = useMemo(() => {
    const map = new Map<string, { count: number; totalBuy: number }>();
    for (const item of allItems) {
      const fruit = item.fruit_name || 'Others';
      const existing = map.get(fruit) || { count: 0, totalBuy: 0 };
      existing.count++;
      existing.totalBuy += item.total_buy;
      map.set(fruit, existing);
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalBuy - a.totalBuy);
  }, [allItems]);

  const countries = useMemo(() => {
    if (!selectedFruit) return [];
    const map = new Map<string, { count: number; totalBuy: number }>();
    for (const item of allItems) {
      if ((item.fruit_name || 'Others') !== selectedFruit) continue;
      const country = item.fruit_country || 'Unknown';
      const existing = map.get(country) || { count: 0, totalBuy: 0 };
      existing.count++;
      existing.totalBuy += item.total_buy;
      map.set(country, existing);
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalBuy - a.totalBuy);
  }, [allItems, selectedFruit]);

  const variants = useMemo(() => {
    if (!selectedFruit) return [];
    const map = new Map<string, { count: number; totalBuy: number }>();
    for (const item of allItems) {
      if ((item.fruit_name || 'Others') !== selectedFruit) continue;
      if (selectedCountry && (item.fruit_country || 'Unknown') !== selectedCountry) continue;
      const variant = item.fruit_variant || 'Others';
      const existing = map.get(variant) || { count: 0, totalBuy: 0 };
      existing.count++;
      existing.totalBuy += item.total_buy;
      map.set(variant, existing);
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalBuy - a.totalBuy);
  }, [allItems, selectedFruit, selectedCountry]);

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(q) ||
        item.item_description.toLowerCase().includes(q)
      );
    } else if (selectedFruit) {
      result = result.filter(item => (item.fruit_name || 'Others') === selectedFruit);
      if (selectedCountry) {
        result = result.filter(item => (item.fruit_country || 'Unknown') === selectedCountry);
      }
      if (selectedVariant) {
        result = result.filter(item => (item.fruit_variant || 'Others') === selectedVariant);
      }
    } else {
      return [];
    }
    return result
      .sort((a, b) => {
        if (a.supplier_count >= 2 && b.supplier_count < 2) return -1;
        if (a.supplier_count < 2 && b.supplier_count >= 2) return 1;
        return b.total_buy - a.total_buy;
      })
      .slice(0, 100);
  }, [allItems, search, selectedFruit, selectedCountry, selectedVariant]);

  const selectedItemData = allItems.find(i => i.item_code === selectedItem);
  const isSearching = search.length > 0;
  const showItemList = isSearching || selectedFruit;

  return (
    <div className="space-y-4 pt-4">
      {/* Top row: Search + Fruit + Country + Variant */}
      <div className="grid grid-cols-4 gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                if (e.target.value) { setSelectedFruit(null); setSelectedCountry(null); setSelectedVariant(null); }
              }}
              placeholder="Item code or name..."
              className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <DropdownSelect
          label="Fruit"
          placeholder="All fruits"
          value={selectedFruit}
          options={fruits}
          onChange={(val) => { setSelectedFruit(val); setSelectedCountry(null); setSelectedVariant(null); setSearch(''); }}
        />
        <DropdownSelect
          label="Country"
          placeholder={selectedFruit ? 'All countries' : 'Select fruit first'}
          value={selectedCountry}
          options={countries}
          onChange={(val) => { setSelectedCountry(val); setSelectedVariant(null); setSearch(''); }}
        />
        <DropdownSelect
          label="Variant"
          placeholder={selectedFruit ? 'All variants' : 'Select fruit first'}
          value={selectedVariant}
          options={variants}
          onChange={(val) => { setSelectedVariant(val); setSearch(''); }}
        />
      </div>

      {/* Date range label */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        <span>Showing data from <span className="font-medium text-foreground">{format(parseISO(filters.startDate), 'MMM yyyy')}</span> to <span className="font-medium text-foreground">{format(parseISO(filters.endDate), 'MMM yyyy')}</span></span>
      </div>

      {/* Selected item bar */}
      {selectedItemData && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono text-blue-600">{selectedItemData.item_code}</span>
            <span className="mx-2 text-muted-foreground">—</span>
            <span className="text-sm font-medium">{selectedItemData.item_description}</span>
          </div>
          <button
            onClick={() => setSelectedItem(null)}
            className="shrink-0 rounded-md p-1 hover:bg-blue-100 text-blue-600"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Side-by-side: Item list + Charts */}
      <div className="grid grid-cols-[2fr_3fr] gap-6" style={{ minHeight: '500px' }}>
        {/* Left: Item list */}
        <div>
          {showItemList ? (
            <div className="rounded-md border bg-background overflow-y-auto max-h-[calc(100vh-360px)]">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No items found</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium text-right">Suppliers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, i) => {
                      const isActive = selectedItem === item.item_code;
                      return (
                        <tr
                          key={item.item_code}
                          onClick={() => setSelectedItem(item.item_code)}
                          className={`cursor-pointer border-t transition-colors hover:bg-accent ${
                            isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                          } ${!isActive && i % 2 !== 0 ? 'bg-muted/20' : ''}`}
                        >
                          <td className="px-3 py-1.5">
                            <div className="font-medium leading-tight text-xs">{item.item_description}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.item_code}</div>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-muted text-foreground">
                              {item.supplier_count}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <PackageSearch className="size-8 mb-2 opacity-40" />
              <p className="text-xs text-center">Select a fruit or search<br />to browse items</p>
            </div>
          )}
        </div>

        {/* Right: Charts & comparison */}
        <div className="space-y-4">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <PackageSearch className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Select an item to view price comparison</p>
            </div>
          ) : (
            <>
              <ItemPriceTrendChart data={trend} isLoading={trendLoading} />
              <SupplierComparisonTable data={summary} isLoading={summaryLoading} colorMap={colorMap} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
