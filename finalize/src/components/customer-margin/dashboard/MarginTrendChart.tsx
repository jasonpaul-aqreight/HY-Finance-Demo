'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginTrend } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM } from '@/lib/customer-margin/format';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  filters: MarginDashboardFilters;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-popover p-3 text-sm shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {p.name === 'Margin %' ? `${p.value.toFixed(1)}%` : formatRM(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MarginTrendChart({ filters }: Props) {
  const { data: rawData } = useMarginTrend(filters);
  const data = useStableData(rawData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profitability Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[360px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={data ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip wrapperStyle={{ zIndex: 50 }} content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="gross_profit" name="Gross Profit" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="margin_pct" name="Margin %" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: '#ef4444' }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
