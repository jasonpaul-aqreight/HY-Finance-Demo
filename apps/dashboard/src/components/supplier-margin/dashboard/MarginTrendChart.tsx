'use client';

import { useMarginTrend } from '@/hooks/supplier-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM } from '@/lib/supplier-margin/format';

const COLORS = {
  grossProfit: '#10b981',
  margin: '#ef4444',
};

function formatMonth(ym: string) {
  if (!ym || !ym.includes('-')) return ym;
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatYAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[220px]">
      <div className="font-semibold mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono">
            {p.dataKey === 'margin_pct' ? `${p.value?.toFixed(1)}%` : formatRM(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MarginTrendChart({ filters }: { filters: DashboardFilters }) {
  const { data: rawData } = useMarginTrend({ ...filters, granularity: 'monthly' });
  const data = useStableData(rawData);

  if (!data) {
    return (
      <Card>
        <CardHeader><CardTitle>Overall Margin Trend</CardTitle></CardHeader>
        <CardContent><div className="h-80 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  const chartData = data.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Profitability Trend</CardTitle>
        <p className="text-xs text-muted-foreground">
          Est. Gross Profit (bars) with Margin % overlay (line)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="period"
              tickFormatter={formatMonth}
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip wrapperStyle={{ zIndex: 50 }} content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            <Bar yAxisId="left" dataKey="profit" name="Est. Gross Profit" fill={COLORS.grossProfit} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="margin_pct"
              name="Margin %"
              stroke={COLORS.margin}
              strokeWidth={2}
              dot={{ r: 4, fill: COLORS.margin, stroke: '#fff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
