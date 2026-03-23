'use client';

import { useState } from 'react';
import { useReturnProducts } from '@/hooks/return/useCreditDataV2';
import type { ReturnProductDimension, ReturnProductMetric } from '@/lib/return/queries-v2';
import type { V2Filters } from '@/hooks/return/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { formatRM, formatCount } from '@/lib/format';

const DIMENSIONS: { key: ReturnProductDimension; label: string }[] = [
  { key: 'item', label: 'Item' },
  { key: 'fruit', label: 'Fruit' },
  { key: 'variant', label: 'Variant' },
  { key: 'country', label: 'Country' },
];

const DIMENSION_LABELS: Record<ReturnProductDimension, string> = {
  item: 'Item',
  fruit: 'Fruit',
  variant: 'Variant',
  country: 'Country',
};

const METRICS: { key: ReturnProductMetric; label: string }[] = [
  { key: 'frequency', label: 'Frequency' },
  { key: 'value', label: 'Value (RM)' },
];

export function ProductBarChart({ filters }: { filters: V2Filters }) {
  const [dimension, setDimension] = useState<ReturnProductDimension>('item');
  const [metric, setMetric] = useState<ReturnProductMetric>('frequency');
  const { data, isLoading } = useReturnProducts(filters, dimension, metric);

  const metricLabel = metric === 'value' ? 'Value' : 'Frequency';
  const title = `Top 10 Returns by ${DIMENSION_LABELS[dimension]}`;

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><div className="h-[400px] bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground py-8 text-center">No return data for selected period.</p></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: d.name }));
  const height = Math.max(250, chartData.length * 26 + 60);
  const yAxisWidth = dimension === 'item' || dimension === 'variant' ? 340 : 160;
  const truncLen = dimension === 'item' || dimension === 'variant' ? 55 : 25;

  const barDataKey = metric === 'value' ? 'total_value' : 'cn_count';
  const barName = metric === 'value' ? 'Return Value' : 'CN Count';
  const barColor = metric === 'value' ? '#dc2626' : '#6366F1';
  const xFormatter = metric === 'value'
    ? (v: number) => {
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
        return String(v);
      }
    : (v: number) => formatCount(v);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex items-center gap-3">
            {/* Metric toggle */}
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              {METRICS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                    metric === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Dimension toggle */}
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              {DIMENSIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDimension(key)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                    dimension === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ranked by {metricLabel.toLowerCase()} · {metric === 'value' ? 'highest return cost' : 'most frequent returns'}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={xFormatter} />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tick={({ x, y, payload }: any) => (
                <text x={x - 4} y={y} textAnchor="end" fontSize={11} dominantBaseline="central" fill="currentColor">
                  {payload.value.length > truncLen ? payload.value.slice(0, truncLen) + '…' : payload.value}
                </text>
              )}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold">{d.name}</p>
                    <p>CN Count: {formatCount(d.cn_count)}</p>
                    <p>Total Value: {formatRM(d.total_value)}</p>
                    <p>Total Qty: {formatCount(d.total_qty)}</p>
                    <p>Goods Returned: {formatCount(d.goods_returned_qty)}</p>
                    <p>Credit Only: {formatCount(d.credit_only_qty)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey={barDataKey} name={barName} fill={barColor} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
