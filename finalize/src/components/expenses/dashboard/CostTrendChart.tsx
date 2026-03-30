'use client';

import { useMemo, useEffect } from 'react';
import { useCostTrend } from '@/hooks/expenses/useCostData';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFilters, Granularity } from '@/hooks/expenses/useDashboardFilters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRM, getCategoryColor } from '@/lib/expenses/format';

function formatYAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatXLabel(label: string, granularity: Granularity) {
  if (granularity === 'monthly') {
    const [y, m] = label.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${y?.slice(2)}`;
  }
  if (granularity === 'weekly') {
    return label.replace(/^\d{4}-/, '');
  }
  // daily: "2025-08-01" → "Aug 1"
  const d = new Date(label + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[220px]">
      <div className="font-semibold mb-2">{label}</div>
      {payload.filter(p => p.value > 0).map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono">{formatRM(p.value)}</span>
        </div>
      ))}
      <div className="border-t mt-1 pt-1 flex justify-between gap-4 font-semibold">
        <span>Total</span>
        <span className="font-mono">{formatRM(total)}</span>
      </div>
    </div>
  );
}

interface CostTrendChartProps {
  filters: DashboardFilters;
  setFilters: (updates: Partial<DashboardFilters>) => void;
  onCategories?: (categories: string[]) => void;
}

export function CostTrendChart({ filters, setFilters, onCategories }: CostTrendChartProps) {
  const { data: rawData } = useCostTrend(filters);
  const data = useStableData(rawData);

  // Pivot: rows are {month, category1: val, category2: val, ...}
  const chartData = useMemo(() => {
    if (!data?.data) return [];
    const byMonth: Record<string, Record<string, number>> = {};
    for (const row of data.data) {
      if (!byMonth[row.month]) byMonth[row.month] = { month: row.month } as Record<string, number>;
      byMonth[row.month][row.category] = row.net_cost;
    }
    return Object.values(byMonth).sort((a, b) =>
      String(a.month).localeCompare(String(b.month))
    );
  }, [data]);

  // Derive categories dynamically from data, ordered by total value descending
  const activeCategories = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of chartData) {
      for (const key of Object.keys(row)) {
        if (key !== 'month') {
          totals[key] = (totals[key] ?? 0) + (Number(row[key]) || 0);
        }
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [chartData]);

  useEffect(() => {
    onCategories?.(activeCategories);
  }, [activeCategories, onCategories]);

  if (!data) {
    return (
      <div>
        <div className="h-80 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div>
      <div className="font-semibold text-sm pb-1">Cost Trend</div>
      <div className="flex justify-center pb-2">
        <div className="flex border rounded-md overflow-hidden">
          {(['daily', 'weekly', 'monthly'] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={filters.granularity === g ? 'default' : 'ghost'}
              className="rounded-none border-0 text-xs px-3 h-7 capitalize"
              onClick={() => setFilters({ granularity: g })}
            >
              {g}
            </Button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
            tickFormatter={(label: string) => formatXLabel(label, filters.granularity)}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip wrapperStyle={{ zIndex: 50 }} content={<CustomTooltip />} />
          {activeCategories.map((cat, idx) => (
            <Bar
              key={cat}
              dataKey={cat}
              name={cat}
              stackId="a"
              fill={getCategoryColor(cat, filters.costType, idx)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
