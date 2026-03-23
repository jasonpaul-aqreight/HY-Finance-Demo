'use client';

import { useTopExpenses } from '@/hooks/expenses/useCostData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM } from '@/lib/format';

const COGS_COLOR = '#3B82F6';
const OPEX_COLOR = '#F97316';

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { acc_no: string; account_name: string; cost_type: string; net_cost: number; pct: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm max-w-[280px]">
      <div className="font-semibold">{d.account_name}</div>
      <div className="text-muted-foreground text-xs">{d.acc_no} ({d.cost_type})</div>
      <div className="font-mono mt-1">{formatRM(d.net_cost)}</div>
      <div className="text-xs text-muted-foreground">{d.pct.toFixed(1)}% of total costs</div>
    </div>
  );
}

function getBarColor(costType: string, entryCostType: string): string {
  if (costType === 'cogs') return COGS_COLOR;
  if (costType === 'opex') return OPEX_COLOR;
  return entryCostType === 'COGS' ? COGS_COLOR : OPEX_COLOR;
}

export function TopExpensesChart({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useTopExpenses(filters);

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader><CardTitle>Top 10 Expenses</CardTitle></CardHeader>
        <CardContent><div className="h-80 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  const rows = data.data ?? [];
  const totalCost = rows.reduce((s: number, r: { net_cost: number }) => s + r.net_cost, 0);

  const chartData = rows.map((r: { acc_no: string; account_name: string; cost_type: string; net_cost: number }, i: number) => ({
    ...r,
    label: `${i + 1}. ${r.account_name}`,
    pct: totalCost > 0 ? (r.net_cost / totalCost) * 100 : 0,
  }));

  const barHeight = Math.max(400, chartData.length * 45);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Top 10 Expenses</CardTitle>
        <p className="text-xs text-muted-foreground">
          Highest GL accounts by net cost &middot;
          <span className="inline-block w-3 h-3 rounded-sm ml-2 mr-1 align-middle" style={{ background: COGS_COLOR }} />COGS
          <span className="inline-block w-3 h-3 rounded-sm ml-2 mr-1 align-middle" style={{ background: OPEX_COLOR }} />OPEX
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 60, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                return String(v);
              }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              dataKey="label"
              type="category"
              width={280}
              tick={{ fontSize: 11, fill: '#1f2937' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="net_cost" name="Net Cost" radius={[0, 4, 4, 0]}>
              {chartData.map((entry: { cost_type: string }, idx: number) => (
                <Cell
                  key={idx}
                  fill={getBarColor(filters.costType, entry.cost_type)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
