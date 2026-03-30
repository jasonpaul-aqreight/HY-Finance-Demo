'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
} from 'recharts';
import { usePriceSpread } from '@/hooks/supplier-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  name: string;
  item_code: string;
  supplier_names: string;
  supplier_codes: string;
  margin_pct: number | null;
  profitable: boolean;
}

// ─── Multi-Select Combobox ───────────────────────────────────────────────────

function MultiSelectCombo<T extends { key: string; label: string; sub?: string }>({
  items,
  selected,
  onChange,
  placeholder,
  testId,
}: {
  items: T[];
  selected: string[];
  onChange: (keys: string[]) => void;
  placeholder: string;
  testId: string;
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

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) => i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)
    );
  }, [items, search]);

  const toggle = useCallback((key: string) => {
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
    );
  }, [selected, onChange]);

  const selectedLabels = useMemo(() => {
    const map = new Map(items.map((i) => [i.key, i.label]));
    return selected.map((k) => ({ key: k, label: map.get(k) ?? k }));
  }, [items, selected]);

  return (
    <div className="relative" ref={ref} data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted"
      >
        <svg className="size-4 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span className="flex-1 text-left truncate text-muted-foreground">
          {selected.length === 0
            ? placeholder
            : `${selected.length} selected`}
        </span>
        <svg className="size-4 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {/* Selected badges */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selectedLabels.slice(0, 5).map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-xs"
            >
              <span className="truncate max-w-[120px]">{s.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); toggle(s.key); }}
                className="hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
          {selectedLabels.length > 5 && (
            <span className="text-xs text-muted-foreground self-center">
              +{selectedLabels.length - 5} more
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[340px] rounded-lg border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <svg className="size-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((item) => {
              const checked = selected.includes(item.key);
              return (
                <button
                  key={item.key}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    checked ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => toggle(item.key)}
                >
                  <span className={`size-4 shrink-0 rounded border flex items-center justify-center text-xs ${
                    checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                  }`}>
                    {checked && '✓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {item.sub && (
                      <span className="font-mono text-xs text-muted-foreground mr-1">{item.sub}</span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type MarginView = 'all' | 'outliers';

export function PriceScatterChart({ filters }: { filters: DashboardFilters }) {
  const { data: rawRaw } = usePriceSpread(filters);
  const raw = useStableData(rawRaw);
  const [pinnedPoint, setPinnedPoint] = useState<ScatterPoint | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [marginView, setMarginView] = useState<MarginView>('all');

  // Build all scatter points from API data
  const { allPoints, maxPrice } = useMemo(() => {
    const rows = raw?.data ?? [];
    let maxPrice = 0;

    const allPoints: ScatterPoint[] = rows.map((r: {
      item_code: string;
      item_name: string;
      avg_purchase_price: number;
      avg_selling_price: number;
      margin_pct: number | null;
      revenue: number;
      supplier_names: string;
      supplier_codes: string;
    }) => {
      const purchase = r.avg_purchase_price;
      const selling = r.avg_selling_price;
      if (purchase > maxPrice) maxPrice = purchase;
      if (selling > maxPrice) maxPrice = selling;
      return {
        x: purchase,
        y: selling,
        z: r.revenue,
        name: r.item_name,
        item_code: r.item_code,
        supplier_names: r.supplier_names ?? '',
        supplier_codes: r.supplier_codes ?? '',
        margin_pct: r.margin_pct,
        profitable: selling > purchase,
      };
    });

    const rawMax = maxPrice * 1.1;
    const step = rawMax > 100 ? 10 : rawMax > 20 ? 5 : 1;
    maxPrice = Math.ceil(rawMax / step) * step;

    return { allPoints, maxPrice };
  }, [raw]);

  // Step 1: Apply margin view filter first — this drives the dropdown options
  const marginFilteredPoints = useMemo(() => {
    if (marginView !== 'outliers') return allPoints;
    return allPoints.filter((p) => {
      const m = p.margin_pct ?? 0;
      return m < 0 || m > 40;
    });
  }, [allPoints, marginView]);

  // Step 2: Supplier options derived from margin-filtered data
  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of marginFilteredPoints) {
      const codes = p.supplier_codes.split(',').filter(Boolean);
      const names = p.supplier_names.split(',').filter(Boolean);
      codes.forEach((code, i) => {
        const trimmed = code.trim();
        if (!seen.has(trimmed)) {
          seen.set(trimmed, names[i]?.trim() ?? trimmed);
        }
      });
    }
    return Array.from(seen.entries())
      .map(([code, name]) => ({ key: code, label: name, sub: code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [marginFilteredPoints]);

  // Step 3: Item options derived from margin-filtered data, further filtered by selected suppliers
  const itemOptions = useMemo(() => {
    let items = marginFilteredPoints;
    if (selectedSuppliers.length > 0) {
      items = items.filter((p) => {
        const codes = p.supplier_codes.split(',');
        return selectedSuppliers.some((s) => codes.includes(s));
      });
    }
    const seen = new Set<string>();
    return items
      .filter((p) => {
        if (seen.has(p.item_code)) return false;
        seen.add(p.item_code);
        return true;
      })
      .map((p) => ({
        key: p.item_code,
        label: p.name,
        sub: p.item_code,
      }));
  }, [marginFilteredPoints, selectedSuppliers]);

  // Clear stale supplier selections when margin view changes
  useEffect(() => {
    if (selectedSuppliers.length === 0) return;
    const validKeys = new Set(supplierOptions.map((s) => s.key));
    const filtered = selectedSuppliers.filter((k) => validKeys.has(k));
    if (filtered.length !== selectedSuppliers.length) {
      setSelectedSuppliers(filtered);
    }
  }, [supplierOptions, selectedSuppliers]);

  // Clear stale item selections when suppliers or margin view changes
  useEffect(() => {
    if (selectedItems.length === 0) return;
    const validKeys = new Set(itemOptions.map((i) => i.key));
    const filtered = selectedItems.filter((k) => validKeys.has(k));
    if (filtered.length !== selectedItems.length) {
      setSelectedItems(filtered);
    }
  }, [itemOptions, selectedItems]);

  // Step 4: Final filtered points (margin already applied via marginFilteredPoints)
  const filteredPoints = useMemo(() => {
    let pts = marginFilteredPoints;
    if (selectedSuppliers.length > 0) {
      pts = pts.filter((p) => {
        const codes = p.supplier_codes.split(',');
        return selectedSuppliers.some((s) => codes.includes(s));
      });
    }
    if (selectedItems.length > 0) {
      const itemSet = new Set(selectedItems);
      pts = pts.filter((p) => itemSet.has(p.item_code));
    }
    return pts;
  }, [marginFilteredPoints, selectedSuppliers, selectedItems]);

  // 3-tier margin classification
  const lossPoints = filteredPoints.filter((p) => (p.margin_pct ?? 0) < 0);
  const lowMarginPoints = filteredPoints.filter((p) => {
    const m = p.margin_pct ?? 0;
    return m >= 0 && m <= 5;
  });
  const healthyPoints = filteredPoints.filter((p) => (p.margin_pct ?? 0) > 5);

  const maxRevenue = Math.max(...filteredPoints.map((p) => p.z), 1);
  const minRevenue = Math.min(...filteredPoints.map((p) => p.z), 0);

  const hasFilters = selectedSuppliers.length > 0 || selectedItems.length > 0 || marginView !== 'all';

  const resetFilters = () => {
    setSelectedSuppliers([]);
    setSelectedItems([]);
    setMarginView('all');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Purchase vs Selling Price</CardTitle>
            <p className="text-xs text-muted-foreground">
              Each dot is an item. Above the diagonal = profit. Dot size = revenue volume.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="scatter-count">
              Showing {filteredPoints.length} of {allPoints.length} items
            </span>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1"
                data-testid="scatter-reset"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Margin view toggle */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">View:</span>
          <div className="flex border rounded-md overflow-hidden">
            {([
              { key: 'all' as const, label: 'All Items' },
              { key: 'outliers' as const, label: 'Outliers Only' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                className={`text-xs px-3 py-1 ${marginView === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setMarginView(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {marginView === 'outliers' ? 'Showing margin < 0% or > 40%' : ''}
          </span>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <MultiSelectCombo
            items={supplierOptions}
            selected={selectedSuppliers}
            onChange={setSelectedSuppliers}
            placeholder="Supplier"
            testId="scatter-supplier-filter"
          />
          <MultiSelectCombo
            items={itemOptions}
            selected={selectedItems}
            onChange={setSelectedItems}
            placeholder="Item"
            testId="scatter-item-filter"
          />
        </div>
      </CardHeader>
      <CardContent>
        {!raw ? (
          <div className="h-[600px] flex items-center justify-center text-muted-foreground">Loading...</div>
        ) : filteredPoints.length === 0 ? (
          <div className="h-[600px] flex items-center justify-center text-muted-foreground">
            {allPoints.length === 0 ? 'No data for selected period' : 'No items match your filters'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={600}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="x"
                name="Purchase Price"
                domain={[0, maxPrice]}
                tickFormatter={(v: number) => `RM${Math.round(v)}`}
                tick={{ fontSize: 10 }}
                label={{ value: 'Avg Purchase / Unit (RM)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#6b7280' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Selling Price"
                domain={[0, maxPrice]}
                tickFormatter={(v: number) => `RM${Math.round(v)}`}
                tick={{ fontSize: 10 }}
                label={{ value: 'Avg Selling Price (RM)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 11, fill: '#6b7280' }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                domain={[minRevenue, maxRevenue]}
                range={[40, 400]}
              />

              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: maxPrice, y: maxPrice }]}
                stroke="#94a3b8"
                strokeDasharray="8 4"
                strokeWidth={1.5}
              />

              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
                verticalAlign="bottom"
                align="center"
                iconSize={10}
                formatter={(value: string) => <span style={{ marginRight: 12 }}>{value}</span>}
              />

              {/* Hide hover tooltip when a point is pinned */}
              {!pinnedPoint && (
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as ScatterPoint;
                    return (
                      <div className="bg-card border rounded-md shadow-sm p-2 text-sm max-w-[280px]">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.item_code}</p>
                        {p.supplier_names && (
                          <p className="text-xs text-muted-foreground truncate">{p.supplier_names}</p>
                        )}
                        <p>Purchase: RM{p.x.toFixed(2)}</p>
                        <p>Selling: RM{p.y.toFixed(2)}</p>
                        <p>Margin: {p.margin_pct != null ? `${p.margin_pct.toFixed(1)}%` : '—'}</p>
                        <p>Revenue: RM{p.z.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                      </div>
                    );
                  }}
                />
              )}

              <Scatter
                name="Healthy (>5%)"
                data={healthyPoints}
                fill="#10b981"
                fillOpacity={0.7}
                stroke="#059669"
                strokeWidth={1}
                cursor="pointer"
                onClick={(data: { payload?: ScatterPoint }) => { if (data?.payload) setPinnedPoint(data.payload); }}
              />

              <Scatter
                name="Low Margin (0-5%)"
                data={lowMarginPoints}
                fill="#f59e0b"
                fillOpacity={0.7}
                stroke="#d97706"
                strokeWidth={1}
                cursor="pointer"
                onClick={(data: { payload?: ScatterPoint }) => { if (data?.payload) setPinnedPoint(data.payload); }}
              />

              <Scatter
                name="Loss (<0%)"
                data={lossPoints}
                fill="#ef4444"
                fillOpacity={0.7}
                stroke="#dc2626"
                strokeWidth={1}
                cursor="pointer"
                onClick={(data: { payload?: ScatterPoint }) => { if (data?.payload) setPinnedPoint(data.payload); }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {/* Pop-out dialog when a dot is clicked */}
        {pinnedPoint && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setPinnedPoint(null)}
          >
            <div
              className="bg-card border rounded-lg shadow-lg p-4 text-sm max-w-[340px] w-full select-text"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-base">{pinnedPoint.name}</p>
                <button
                  onClick={() => setPinnedPoint(null)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 px-1"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-1">{pinnedPoint.item_code}</p>
              {pinnedPoint.supplier_names && (
                <p className="text-xs text-muted-foreground mb-2">{pinnedPoint.supplier_names}</p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Purchase:</span>
                <span className="font-medium">RM{pinnedPoint.x.toFixed(2)}</span>
                <span className="text-muted-foreground">Selling:</span>
                <span className="font-medium">RM{pinnedPoint.y.toFixed(2)}</span>
                <span className="text-muted-foreground">Margin:</span>
                <span className={`font-medium ${(pinnedPoint.margin_pct ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {pinnedPoint.margin_pct != null ? `${pinnedPoint.margin_pct.toFixed(1)}%` : '—'}
                </span>
                <span className="text-muted-foreground">Revenue:</span>
                <span className="font-medium">RM{pinnedPoint.z.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
