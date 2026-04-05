'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginByProductGroup } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM } from '@/lib/customer-margin/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

export function ProductGroupMarginChart({ filters }: Props) {
  const { data: rawData } = useMarginByProductGroup(filters);
  const data = useStableData(rawData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Group Margin Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="item_group" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
              <YAxis yAxisId="left" tickFormatter={v => formatRM(v)} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                formatter={(v, name) => [
                  name === 'Margin %' ? `${Number(v).toFixed(1)}%` : formatRM(Number(v)),
                  String(name),
                ]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" name="Net Sales" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="left" dataKey="cogs" name="Cost of Sales" fill="#f97316" radius={[2, 2, 0, 0]} />
              <Bar yAxisId="right" dataKey="margin_pct" name="Margin %" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
