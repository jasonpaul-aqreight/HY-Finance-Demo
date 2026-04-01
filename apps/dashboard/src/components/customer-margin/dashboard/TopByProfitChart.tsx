'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerMargins } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM } from '@/lib/customer-margin/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5',
                '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];

export function TopByProfitChart({ filters }: Props) {
  const { data: rawData } = useCustomerMargins(filters, 'gross_profit', 'desc', 1, 10);
  const data = useStableData(rawData);

  const chartData = (data?.rows ?? []).map(r => ({
    name: (r.company_name ?? r.debtor_code).slice(0, 25),
    gross_profit: r.gross_profit,
    margin_pct: r.margin_pct,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 by Gross Profit</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={v => formatRM(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                formatter={(v) => formatRM(Number(v))}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="gross_profit" name="Gross Profit" radius={[0, 4, 4, 0]}>

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
