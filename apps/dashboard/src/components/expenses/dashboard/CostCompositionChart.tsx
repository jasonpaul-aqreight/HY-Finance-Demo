'use client';

import { useCostComposition } from '@/hooks/expenses/useCostData';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM, getCategoryColor } from '@/lib/expenses/format';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';

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
  const { data: rawData } = useCostComposition(filters);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <div>
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const pieData = (data.data ?? []).filter((d: { net_cost: number }) => d.net_cost > 0);
  const total = pieData.reduce((s: number, d: { net_cost: number }) => s + d.net_cost, 0);

  return (
    <div>
      <div className="flex items-center gap-2 pb-2">
        <div className="font-semibold text-sm">Cost Composition</div>
        <AnalyzeIcon sectionKey="expense_overview" componentKey="ex_cost_composition" />
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
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
          <Tooltip wrapperStyle={{ zIndex: 50 }} content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
