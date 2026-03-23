'use client';

import { useCostComposition } from '@/hooks/expenses/useCostData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM, getCategoryColor } from '@/lib/expenses/format';

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { category: string; net_cost: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <div className="font-semibold">{item.payload.category}</div>
      <div className="font-mono mt-1">{formatRM(item.payload.net_cost)}</div>
    </div>
  );
}

export function CostCompositionChart({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useCostComposition(filters);

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader><CardTitle>Cost Composition</CardTitle></CardHeader>
        <CardContent><div className="h-64 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  const pieData = (data.data ?? []).filter((d: { net_cost: number }) => d.net_cost > 0);
  const total = pieData.reduce((s: number, d: { net_cost: number }) => s + d.net_cost, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Cost Composition</CardTitle>
        <p className="text-sm text-muted-foreground">Total: {formatRM(total)}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={420}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              dataKey="net_cost"
              nameKey="category"
              labelLine={false}
              label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
            >
              {pieData.map((entry: { category: string }, idx: number) => (
                <Cell
                  key={entry.category}
                  fill={getCategoryColor(entry.category, filters.costType, idx)}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
