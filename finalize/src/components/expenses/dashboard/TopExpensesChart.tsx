'use client';

import { useState } from 'react';
import { useTopExpenses } from '@/hooks/expenses/useCostData';
import { useStableData } from '@/hooks/useStableData';
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
import { Button } from '@/components/ui/button';
import { formatRM } from '@/lib/format';

const COGS_COLOR = '#3B82F6';
const OPEX_COLOR = '#F97316';

type CostType = 'all' | 'cogs' | 'opex';
type Direction = 'top' | 'bottom';

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden">
      {options.map(opt => (
        <Button
          key={opt.key}
          size="sm"
          variant={value === opt.key ? 'default' : 'ghost'}
          className="rounded-none border-0 text-xs px-2 h-7"
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

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

function getBarColor(costType: CostType, entryCostType: string): string {
  if (costType === 'cogs') return COGS_COLOR;
  if (costType === 'opex') return OPEX_COLOR;
  return entryCostType === 'COGS' ? COGS_COLOR : OPEX_COLOR;
}

export function TopExpensesChart({ filters }: { filters: DashboardFilters }) {
  const [costType, setCostType] = useState<CostType>('all');
  const [direction, setDirection] = useState<Direction>('top');

  const order = direction === 'top' ? 'desc' : 'asc';
  const { data: rawData } = useTopExpenses(filters, costType, order);
  const data = useStableData(rawData);

  const dirLabel = direction === 'top' ? 'Top' : 'Bottom';
  const title = `${dirLabel} 10 Expenses`;

  if (!data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-1.5">
            <ToggleGroup<CostType>
              options={[
                { key: 'all', label: 'All' },
                { key: 'cogs', label: 'COGS' },
                { key: 'opex', label: 'OPEX' },
              ]}
              value={costType}
              onChange={setCostType}
            />
            <ToggleGroup<Direction>
              options={[
                { key: 'top', label: 'Top' },
                { key: 'bottom', label: 'Bottom' },
              ]}
              value={direction}
              onChange={setDirection}
            />
          </div>
        </CardHeader>
        <CardContent><div className="h-80 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  const rows = data.data ?? [];
  const totalCost = rows.reduce((s: number, r: { net_cost: number }) => s + Math.abs(r.net_cost), 0);

  const chartData = rows.map((r: { acc_no: string; account_name: string; cost_type: string; net_cost: number }, i: number) => ({
    ...r,
    label: `${i + 1}. ${r.account_name}`,
    pct: totalCost > 0 ? (Math.abs(r.net_cost) / totalCost) * 100 : 0,
  }));

  const barHeight = Math.max(400, chartData.length * 45);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {direction === 'top' ? 'Highest' : 'Lowest'} GL accounts by net cost &middot;
            <span className="inline-block w-3 h-3 rounded-sm ml-2 mr-1 align-middle" style={{ background: COGS_COLOR }} />COGS
            <span className="inline-block w-3 h-3 rounded-sm ml-2 mr-1 align-middle" style={{ background: OPEX_COLOR }} />OPEX
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <ToggleGroup<CostType>
            options={[
              { key: 'all', label: 'All' },
              { key: 'cogs', label: 'COGS' },
              { key: 'opex', label: 'OPEX' },
            ]}
            value={costType}
            onChange={setCostType}
          />
          <ToggleGroup<Direction>
            options={[
              { key: 'top', label: 'Top' },
              { key: 'bottom', label: 'Bottom' },
            ]}
            value={direction}
            onChange={setDirection}
          />
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            No data for selected period
          </div>
        ) : (
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
              <Tooltip wrapperStyle={{ zIndex: 50 }} content={<CustomTooltip />} />
              <Bar dataKey="net_cost" name="Net Cost" radius={[0, 4, 4, 0]}>
                {chartData.map((entry: { cost_type: string }, idx: number) => (
                  <Cell
                    key={idx}
                    fill={getBarColor(costType, entry.cost_type)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
