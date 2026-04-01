'use client';

import { useReturnTrend } from '@/hooks/return/useCreditDataV2';
import { useStableData } from '@/hooks/useStableData';
import type { V2Filters } from '@/hooks/return/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { formatRM } from '@/lib/format';

export function MonthlyTrendChart({ filters }: { filters: V2Filters }) {
  const { data: rawData } = useReturnTrend(filters);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Return Trend</CardTitle></CardHeader>
        <CardContent><div className="h-[300px] bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Monthly Return Trend</CardTitle>
        <p className="text-xs text-muted-foreground">Return value vs unresolved amount over time</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => {
                const [y, m] = v.split('-');
                return `${m}/${y.slice(2)}`;
              }}
            />
            <YAxis tickFormatter={(v) => formatRM(v)} tick={{ fontSize: 11 }} />
            <Tooltip
              wrapperStyle={{ zIndex: 50 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold">Month: {label}</p>
                    {payload.map((p) => (
                      <p key={p.dataKey as string} style={{ color: p.color }}>
                        {p.dataKey === 'return_value' ? 'Return Value' : 'Unresolved'}:{' '}
                        {formatRM(p.value as number)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              formatter={(value) =>
                value === 'return_value' ? 'Return Value' : 'Unresolved'
              }
            />
            <Area
              type="monotone"
              dataKey="return_value"
              stroke="#6366F1"
              fill="#6366F1"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="unresolved"
              stroke="#EF4444"
              fill="#EF4444"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
