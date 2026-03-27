'use client';

import { useState, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangeSection } from '@/components/shared/DateRangeSection';
import { formatRM, formatCount, marginColor } from '@/lib/supplier-margin/format';
import { useSupplierItems, useSupplierItemTrends } from '@/hooks/supplier-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';

interface PurchaseItemsTabProps {
  creditorCode: string;
  initialStartDate?: string;
  initialEndDate?: string;
  supplierMetrics?: {
    attributed_revenue: number;
    attributed_cogs: number;
    attributed_profit: number;
    margin_pct: number | null;
    items_supplied: number;
  };
  singleSupplierItems?: string[];
}

type SortKey = 'item_code' | 'description' | 'qty_purchased' | 'avg_purchase_price' | 'revenue' | 'cogs' | 'margin_pct';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

function PriceSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const first = data[0];
  const last = data[data.length - 1];
  const color = last <= first ? '#10b981' : '#ef4444';
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div className="h-[48px] w-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PurchaseItemsTab({ creditorCode, initialStartDate, initialEndDate, supplierMetrics, singleSupplierItems = [] }: PurchaseItemsTabProps) {
  const [startDate, setStartDate] = useState(initialStartDate ?? '2025-01-01');
  const [endDate, setEndDate] = useState(initialEndDate ?? '2025-12-31');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);
  const sm = supplierMetrics;
  const singleSet = new Set(singleSupplierItems);

  const { data: rawData } = useSupplierItems(creditorCode, { startDate, endDate, granularity: 'monthly', suppliers: [], itemGroups: [] });
  const data = useStableData(rawData);
  const isLoading = !data;
  const items = (data?.data ?? data ?? []) as {
    item_code: string;
    description: string;
    item_group: string | null;
    qty_purchased: number;
    avg_purchase_price: number | null;
    qty_sold: number;
    revenue: number;
    cogs: number;
    margin_pct: number | null;
  }[];

  const { data: trendsData } = useSupplierItemTrends(creditorCode, startDate, endDate);
  const trendMap = useMemo(() => {
    const map = new Map<string, number[]>();
    if (trendsData?.data) {
      for (const t of trendsData.data) {
        map.set(t.item_code, t.prices);
      }
    }
    return map;
  }, [trendsData]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(s) ||
        item.description.toLowerCase().includes(s)
      );
    }
    return [...result].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [items, search, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'item_code' || key === 'description'); }
  }

  const TH = ({ col, label, align }: { col: SortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2 cursor-pointer select-none hover:bg-muted/50 ${align === 'right' ? 'text-right' : ''}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );

  return (
    <div className="space-y-5">
      <DateRangeSection
        label="Date Range"
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        showPresets
        showRangeSummary={false}
      />

      {/* Period-dependent KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-semibold mt-1">{sm ? formatRM(sm.attributed_revenue) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Spend</p>
            <p className="text-2xl font-semibold mt-1">{sm ? formatRM(sm.attributed_cogs) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gross Profit</p>
            <p className="text-2xl font-semibold mt-1">{sm ? formatRM(sm.attributed_profit) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Margin</p>
            <p className={`text-2xl font-semibold mt-1 ${sm?.margin_pct != null ? marginColor(sm.margin_pct) : ''}`}>
              {sm?.margin_pct != null ? `${sm.margin_pct.toFixed(1)}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">
            Items Purchased
            {search && <span className="text-muted-foreground font-normal ml-2">({filtered.length} of {items.length})</span>}
          </h4>
          <input
            type="text"
            placeholder="Search by item code or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 w-56 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </div>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading purchase items…</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? 'No items match your search.' : 'No purchase records.'}
          </p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 w-8"></th>
                  <TH col="item_code" label="Item Code" />
                  <TH col="description" label="Description" />
                  <TH col="qty_purchased" label="Qty Purchased" align="right" />
                  <TH col="avg_purchase_price" label="Avg Purchase" align="right" />
                  <th className="px-3 py-2">Price Trend</th>
                  <TH col="revenue" label="Revenue" align="right" />
                  <TH col="cogs" label="Purchase Cost" align="right" />
                  <TH col="margin_pct" label="Margin %" align="right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isSingle = singleSet.has(item.item_code);
                  const priceTrend = trendMap.get(item.item_code) ?? [];
                  return (
                    <tr key={item.item_code} className={`border-b last:border-0 hover:bg-muted/20 ${isSingle ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-3 py-4 text-center">
                        {isSingle && (
                          <span title="Single Supplier Item"><AlertTriangle className="size-4 text-amber-500" /></span>
                        )}
                      </td>
                      <td className="px-3 py-4 font-mono text-xs">{item.item_code}</td>
                      <td className="px-3 py-4 max-w-[200px] truncate">{item.description}</td>
                      <td className="px-3 py-4 text-right">{formatCount(item.qty_purchased)}</td>
                      <td className="px-3 py-4 text-right font-mono">{item.avg_purchase_price != null ? formatRM(item.avg_purchase_price, 2) : '—'}</td>
                      <td className="px-3 py-4"><PriceSparkline data={priceTrend} /></td>
                      <td className="px-3 py-4 text-right font-mono">{formatRM(item.revenue, 2)}</td>
                      <td className="px-3 py-4 text-right font-mono">{formatRM(item.cogs, 2)}</td>
                      <td className={`px-3 py-4 text-right font-medium ${item.margin_pct != null ? marginColor(item.margin_pct) : ''}`}>
                        {item.margin_pct != null ? `${item.margin_pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
