'use client';

import { useMemo, useEffect } from 'react';
import { useCostTrend } from '@/hooks/expenses/useCostData';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatRM, getCategoryColor } from '@/lib/expenses/format';

function formatYAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatXLabel(label: string) {
  const [y, m] = label.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y?.slice(2)}`;
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
  onCategories?: (categories: string[]) => void;
}

export function CostTrendChart({ filters, onCategories }: CostTrendChartProps) {
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
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
            tickFormatter={formatXLabel}
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
