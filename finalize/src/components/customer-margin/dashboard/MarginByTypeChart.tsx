'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginByType } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM } from '@/lib/customer-margin/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

export function MarginByTypeChart({ filters }: Props) {
  const { data, isLoading } = useMarginByType(filters);

  const chartData = (data ?? []).map(r => ({
    ...r,
    label: `${r.debtor_type} (${r.customer_count})`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margin by Customer Type</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, name) => [
                  name === 'margin_pct' ? `${Number(v).toFixed(1)}%` : formatRM(Number(v)),
                  name === 'margin_pct' ? 'Margin %' : 'Revenue',
                ]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="margin_pct" name="Margin %" fill="#8b5cf6" radius={[4, 4, 0, 0]}
                label={{ position: 'top', fontSize: 11 }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
