'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginDistribution } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

const BUCKET_COLORS: Record<string, string> = {
  '< 0%': '#ef4444',
  '0-5%': '#f97316',
  '5-10%': '#eab308',
  '10-15%': '#84cc16',
  '15-20%': '#22c55e',
  '20-30%': '#10b981',
  '30%+': '#059669',
};

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, bucket, count } = props;
  if (percent < 0.03) return null;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {bucket} ({count})
    </text>
  );
}

export function MarginDistributionChart({ filters }: Props) {
  const { data: rawData } = useMarginDistribution(filters);
  const data = useStableData(rawData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Margin Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data ?? []}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                dataKey="count"
                nameKey="bucket"
                labelLine={true}
                label={renderLabel}
              >
                {(data ?? []).map((d, i) => (
                  <Cell key={i} fill={BUCKET_COLORS[d.bucket] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(v) => [`${v} customers`, 'Count']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
