'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMarginDistribution } from '@/hooks/supplier-margin/useMarginData';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Entity = 'suppliers' | 'items';

const BUCKET_COLORS: Record<string, string> = {
  '< 0%': '#ef4444',
  '0-5%': '#f97316',
  '5-10%': '#eab308',
  '10-15%': '#84cc16',
  '15-20%': '#22c55e',
  '20-30%': '#10b981',
  '30%+': '#059669',
};

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, bucket, count } = props;
  if (percent < 0.03) return null;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {bucket} ({count})
    </text>
  );
}

export function SupplierMarginDistributionChart({ filters }: { filters: DashboardFilters }) {
  const [entity, setEntity] = useState<Entity>('suppliers');
  const { data, isLoading } = useMarginDistribution(filters, entity);

  const entityLabel = entity === 'suppliers' ? 'Supplier' : 'Item';
  const countLabel = entity === 'suppliers' ? 'suppliers' : 'items';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <CardTitle className="whitespace-nowrap shrink-0">{entityLabel} Margin Distribution</CardTitle>
        <div className="flex rounded-md border overflow-hidden">
          <Button
            size="sm"
            variant={entity === 'suppliers' ? 'default' : 'ghost'}
            className="rounded-none border-0 text-xs px-3 h-7"
            onClick={() => setEntity('suppliers')}
          >
            Suppliers
          </Button>
          <Button
            size="sm"
            variant={entity === 'items' ? 'default' : 'ghost'}
            className="rounded-none border-0 text-xs px-3 h-7"
            onClick={() => setEntity('items')}
          >
            Items
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                dataKey="count"
                nameKey="bucket"
                labelLine={true}
                label={renderLabel}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={BUCKET_COLORS[d.bucket] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v} ${countLabel}`, 'Count']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
