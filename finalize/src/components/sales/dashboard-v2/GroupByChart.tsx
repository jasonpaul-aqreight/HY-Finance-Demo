'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
  Legend,
} from 'recharts';
import { formatRM } from '@/lib/format';
import { STACK_OPTIONS, type GroupByDimension, type StackDimension, type GroupByRow, type StackedRow } from '@/lib/sales/types';
import { Button } from '@/components/ui/button';

function formatXAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

const BAR_COLORS = [
  '#2563eb', '#3b82f6', '#60a5fa', '#7dd3fc', '#93c5fd',
  '#548235', '#e67e22', '#8e44ad', '#16a085', '#f59e0b',
];

const STACK_COLORS = [
  '#2563eb', '#548235', '#e67e22', '#8e44ad', '#16a085',
  '#f59e0b', '#ef4444', '#6366f1', '#9ca3af',
];

const STACK_LABELS: Record<StackDimension, string> = {
  'agent': 'Sales Agent',
  'fruit': 'Fruit',
  'outlet': 'Outlet',
  'customer-type': 'Customer Category',
  'fruit-country': 'Country',
  'fruit-variant': 'Variant',
};

const BAR_SIZE = 28;

// ─── Pivot logic for stacked chart ─────────────────────────────────────────

interface PivotResult {
  chartData: Record<string, string | number>[];
  categories: string[];
}

function pivotForStackedChart(
  rows: StackedRow[],
  maxCategories = 8,
  perPrimary = false,
): PivotResult {
  // Rows are already filtered to selected primaries by parent
  const primaryTotals = new Map<string, number>();
  for (const r of rows) {
    primaryTotals.set(r.primary_name, (primaryTotals.get(r.primary_name) ?? 0) + r.total_sales);
  }
  const topPrimaries = [...primaryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const topPrimarySet = new Set(topPrimaries);

  let topStackSet: Set<string>;
  let hasOthers: boolean;

  if (perPrimary) {
    // Pick top N per primary group, then union all into the legend
    const allTopStacks = new Set<string>();
    let anyHasOthers = false;
    for (const primary of topPrimaries) {
      const stacksForPrimary = new Map<string, number>();
      for (const r of rows) {
        if (r.primary_name !== primary) continue;
        stacksForPrimary.set(r.stack_name, (stacksForPrimary.get(r.stack_name) ?? 0) + r.total_sales);
      }
      const sorted = [...stacksForPrimary.entries()].sort((a, b) => b[1] - a[1]);
      for (const [name] of sorted.slice(0, maxCategories)) allTopStacks.add(name);
      if (sorted.length > maxCategories) anyHasOthers = true;
    }
    topStackSet = allTopStacks;
    hasOthers = anyHasOthers;
  } else {
    // Global top N
    const stackTotals = new Map<string, number>();
    for (const r of rows) {
      if (!topPrimarySet.has(r.primary_name)) continue;
      stackTotals.set(r.stack_name, (stackTotals.get(r.stack_name) ?? 0) + r.total_sales);
    }
    const sortedStacks = [...stackTotals.entries()].sort((a, b) => b[1] - a[1]);
    topStackSet = new Set(sortedStacks.slice(0, maxCategories).map(([name]) => name));
    hasOthers = sortedStacks.length > maxCategories;
  }

  // Build ordered categories list sorted by global total
  const globalStackTotals = new Map<string, number>();
  for (const r of rows) {
    if (!topPrimarySet.has(r.primary_name)) continue;
    if (!topStackSet.has(r.stack_name)) continue;
    globalStackTotals.set(r.stack_name, (globalStackTotals.get(r.stack_name) ?? 0) + r.total_sales);
  }
  const sortedCategories = [...globalStackTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const categories = hasOthers ? [...sortedCategories, 'Others'] : sortedCategories;

  const chartData = topPrimaries.map(primary => {
    const row: Record<string, string | number> = { name: primary };
    let total = 0;
    for (const r of rows) {
      if (r.primary_name !== primary) continue;
      const key = topStackSet.has(r.stack_name) ? r.stack_name : 'Others';
      row[key] = ((row[key] as number) ?? 0) + r.total_sales;
      total += r.total_sales;
    }
    row.__total = total;
    return row;
  });

  return { chartData, categories };
}

// ─── Custom tooltip for stacked mode ───────────────────────────────────────

interface StackedTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function StackedTooltip({ active, payload, label }: StackedTooltipProps) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.name !== '__total' && p.value > 0);
  const total = items.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold mb-1.5 truncate">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
            <span className="truncate max-w-[140px]">{item.name}</span>
          </span>
          <span className="font-mono">{formatRM(item.value)}</span>
        </div>
      ))}
      <div className="border-t mt-1.5 pt-1.5 flex justify-between font-semibold">
        <span>Total</span>
        <span className="font-mono">{formatRM(total)}</span>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

interface GroupByChartProps {
  selectedData: GroupByRow[];
  stackedData: StackedRow[];
  isStacked: boolean;
  title: string;
  groupBy: GroupByDimension;
  stackBy?: StackDimension;
  onStackChange: (dim: StackDimension | undefined) => void;
}

export function GroupByChart({ selectedData, stackedData, isStacked, title, groupBy, stackBy, onStackChange }: GroupByChartProps) {
  const isVariantStack = groupBy === 'fruit' && stackBy === 'fruit-variant';
  const { chartData: pivotData, categories } = useMemo(
    () => isStacked
      ? pivotForStackedChart(stackedData, isVariantStack ? 4 : 8, isVariantStack)
      : { chartData: [], categories: [] },
    [stackedData, isStacked, isVariantStack]
  );

  const barData = useMemo(() => selectedData.map(d => ({
    ...d,
    total_sales: Math.max(0, d.total_sales),
  })), [selectedData]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any[] = isStacked ? pivotData : barData;
  const chartHeight = Math.max(400, chartData.length * 48);
  const stackOptions = STACK_OPTIONS[groupBy] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {stackOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stack by:</span>
            <div className="flex border rounded-md overflow-hidden">
              <Button
                size="sm"
                variant={!stackBy ? 'default' : 'ghost'}
                className="rounded-none border-0 text-[11px] px-2.5 h-6"
                onClick={() => onStackChange(undefined)}
              >
                Default
              </Button>
              {stackOptions.map((dim) => (
                <Button
                  key={dim}
                  size="sm"
                  variant={stackBy === dim ? 'default' : 'ghost'}
                  className="rounded-none border-0 text-[11px] px-2.5 h-6"
                  onClick={() => onStackChange(dim)}
                >
                  {STACK_LABELS[dim]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
      {groupBy === 'fruit' && stackBy === 'fruit-variant' && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Showing top 4 variants per fruit to prevent overcrowding. Remaining variants are grouped into &ldquo;Others&rdquo;.
          For a more detailed breakdown, use <strong>Group by: Variant</strong> and select a fruit from the dropdown in the table below.
        </div>
      )}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          barSize={BAR_SIZE}
          margin={{ top: 4, right: 100, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" domain={[0, 'dataMax']} tickFormatter={formatXAxis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            width={180}
          />

          {isStacked ? (
            <>
              <Tooltip content={<StackedTooltip />} />
              {categories.map((cat, i) => {
                const isLast = i === categories.length - 1;
                return (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="stack"
                    fill={STACK_COLORS[i % STACK_COLORS.length]}
                    radius={isLast ? [0, 3, 3, 0] : undefined}
                  >
                    {isLast && (
                      <LabelList
                        dataKey="__total"
                        position="right"
                        formatter={(v: unknown) => formatRM(v as number)}
                        style={{ fontSize: 10, fill: '#374151' }}
                      />
                    )}
                  </Bar>
                );
              })}
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="square"
                iconSize={10}
                formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
              />
            </>
          ) : (
            <>
              <Tooltip formatter={(v: unknown) => [formatRM(v as number), 'Total Sales']} />
              <Bar dataKey="total_sales" name="Total Sales" radius={[0, 3, 3, 0]}>
                {barData.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="total_sales"
                  position="right"
                  formatter={(v: unknown) => formatRM(v as number)}
                  style={{ fontSize: 10, fill: '#374151' }}
                />
              </Bar>
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
