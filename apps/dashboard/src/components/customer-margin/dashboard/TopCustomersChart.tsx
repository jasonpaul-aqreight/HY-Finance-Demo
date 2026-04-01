'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCustomerMargins } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM } from '@/lib/customer-margin/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

type Metric = 'profit' | 'margin';
type Direction = 'highest' | 'lowest';

const PROFIT_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5',
                       '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];

const MARGIN_COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
                       '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764'];

export function TopCustomersChart({ filters }: Props) {
  const [metric, setMetric] = useState<Metric>('profit');
  const [direction, setDirection] = useState<Direction>('highest');

  const order = direction === 'lowest' ? 'asc' : 'desc';

  const { data: rawProfitData } = useCustomerMargins(filters, 'gross_profit', order, 1, 10);
  const profitData = useStableData(rawProfitData);
  const { data: rawMarginData } = useCustomerMargins(filters, 'margin_pct', order, 1, 50);
  const marginData = useStableData(rawMarginData);

  const isLoading = metric === 'profit' ? !profitData : !marginData;

  const chartData = metric === 'profit'
    ? (profitData?.rows ?? []).map(r => ({
        name: (r.company_name ?? r.debtor_code).slice(0, 35),
        value: r.gross_profit,
      }))
    : (marginData?.rows ?? [])
        .filter(r => r.revenue >= 10000)
        .slice(0, 10)
        .map(r => ({
          name: (r.company_name ?? r.debtor_code).slice(0, 35),
          value: r.margin_pct,
        }));

  const colors = metric === 'profit' ? PROFIT_COLORS : MARGIN_COLORS;
  const dirLabel = direction === 'highest' ? 'Top' : 'Bottom';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <div className="shrink-0">
          <CardTitle className="whitespace-nowrap">{dirLabel} 10 Customers</CardTitle>
          {metric === 'margin' && (
            <p className="text-xs text-muted-foreground mt-0.5">min RM 10K revenue</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={metric === 'profit' ? 'default' : 'ghost'}
              className="rounded-none border-0 text-xs px-3 h-7"
              onClick={() => setMetric('profit')}
            >
              Gross Profit
            </Button>
            <Button
              size="sm"
              variant={metric === 'margin' ? 'default' : 'ghost'}
              className="rounded-none border-0 text-xs px-3 h-7"
              onClick={() => setMetric('margin')}
            >
              Margin %
            </Button>
          </div>
          <div className="flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={direction === 'highest' ? 'default' : 'ghost'}
              className="rounded-none border-0 text-xs px-3 h-7"
              onClick={() => setDirection('highest')}
            >
              Highest
            </Button>
            <Button
              size="sm"
              variant={direction === 'lowest' ? 'default' : 'ghost'}
              className="rounded-none border-0 text-xs px-3 h-7"
              onClick={() => setDirection('lowest')}
            >
              Lowest
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                tickFormatter={v => metric === 'profit' ? formatRM(v) : `${v}%`}
                tick={{ fontSize: 10 }}
              />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                formatter={(v) => metric === 'profit' ? formatRM(Number(v)) : `${Number(v).toFixed(1)}%`}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="value" name={metric === 'profit' ? 'Gross Profit' : 'Margin %'} radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
