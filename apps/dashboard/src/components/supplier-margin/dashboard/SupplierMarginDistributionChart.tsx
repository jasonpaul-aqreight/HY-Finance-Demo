'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMarginDistribution } from '@/hooks/supplier-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Entity = 'suppliers' | 'items';

const BUCKET_ORDER = ['< 0%', '0-5%', '5-10%', '10-15%', '15-20%', '20-30%', '30%+'];

const BUCKET_COLORS: Record<string, string> = {
  '< 0%': '#ef4444',
  '0-5%': '#f97316',
  '5-10%': '#eab308',
  '10-15%': '#84cc16',
  '15-20%': '#22c55e',
  '20-30%': '#10b981',
  '30%+': '#059669',
};

export function SupplierMarginDistributionChart({ filters }: { filters: DashboardFilters }) {
  const [entity, setEntity] = useState<Entity>('suppliers');
  const { data: rawData } = useMarginDistribution(filters, entity);
  const data = useStableData(rawData);

  const entityLabel = entity === 'suppliers' ? 'Supplier' : 'Item';
  const countLabel = entity === 'suppliers' ? 'suppliers' : 'items';

  const chartData = BUCKET_ORDER.map((bucket) => {
    const found = data?.find((d) => d.bucket === bucket);
    return { bucket, count: found?.count ?? 0 };
  });

  const total = chartData.reduce((sum, d) => sum + d.count, 0);

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
        {!data ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 16, right: 12, left: -8, bottom: 4 }} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
                  return (
                    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-semibold">{d.bucket}</p>
                      <p>{d.count} {countLabel} ({pct}%)</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: 'currentColor' }}>
                {chartData.map((d) => (
                  <Cell key={d.bucket} fill={BUCKET_COLORS[d.bucket] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
