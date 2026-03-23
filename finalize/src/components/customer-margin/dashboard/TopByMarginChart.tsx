'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerMargins } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM } from '@/lib/customer-margin/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
                '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764'];

export function TopByMarginChart({ filters }: Props) {
  const { data, isLoading } = useCustomerMargins(filters, 'margin_pct', 'desc', 1, 50);

  // Filter for min revenue RM 10,000 then take top 10
  const chartData = (data?.rows ?? [])
    .filter(r => r.revenue >= 10000)
    .slice(0, 10)
    .map(r => ({
      name: (r.company_name ?? r.debtor_code).slice(0, 25),
      margin_pct: r.margin_pct,
      revenue: r.revenue,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 by Margin % (min RM 10K revenue)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 70 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => `${Number(v).toFixed(1)}%`}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="margin_pct" name="Margin %" radius={[0, 4, 4, 0]}>

                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
