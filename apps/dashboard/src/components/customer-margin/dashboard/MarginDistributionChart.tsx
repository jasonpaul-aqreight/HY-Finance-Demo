'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginDistribution } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

const BUCKET_ORDER = ['< 0%', '0-5%', '5-10%', '10-15%', '15-20%', '20-30%', '30%+'];

const BUCKET_COLORS: Record<string, string> = {
  '< 0%': '#ef4444',
  '0-5%': '#f97316',
  '5-10%': '#eab308',
  '10-15%': '#84cc16',
  '15-20%': '#22c55e',
  '20-30%': '#10b981',
  '30%+': '#059669',
};

export function MarginDistributionChart({ filters }: Props) {
  const { data: rawData } = useMarginDistribution(filters);
  const data = useStableData(rawData);

  const chartData = BUCKET_ORDER.map((bucket) => {
    const found = data?.find((d) => d.bucket === bucket);
    return { bucket, count: found?.count ?? 0 };
  });

  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Customer Margin Distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {!data ? (
          <div className="flex h-[360px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 16, right: 12, left: -8, bottom: 4 }} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
                  return (
                    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-semibold">{d.bucket}</p>
                      <p>{d.count} customers ({pct}%)</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: 'currentColor' }}>
                {chartData.map((d) => (
                  <Cell key={d.bucket} fill={BUCKET_COLORS[d.bucket] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
