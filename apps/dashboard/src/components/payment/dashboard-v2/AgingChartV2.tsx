'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAging, useAgingByDimension } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM } from '@/lib/payment/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, Legend,
} from 'recharts';

const BUCKET_COLORS: Record<string, string> = {
  'Not Yet Due': '#4ade80',
  '1-30 Days': '#facc15',
  '31-60 Days': '#fb923c',
  '61-90 Days': '#f87171',
  '91-120 Days': '#ef4444',
  '120+ Days': '#dc2626',
};

const BUCKET_ORDER = ['Not Yet Due', '1-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '120+ Days'];

// Distinct colors for stacked segments (agents / customer types)
const DIMENSION_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#6366f1',
];

type ViewMode = 'all' | 'agent' | 'type';

export default function AgingChartV2() {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const { data: rawAgingData } = useAging();
  const agingData = useStableData(rawAgingData);
  const { data: rawDimData } = useAgingByDimension(
    viewMode === 'type' ? 'type' : 'agent',
  );
  const dimData = useStableData(rawDimData);

  const isLoading = viewMode === 'all' ? !agingData : !dimData;

  // Simple chart data for "All" view
  const simpleChartData = useMemo(() => {
    if (!agingData) return [];
    return BUCKET_ORDER.map(bucket => {
      const found = agingData.find((d: { bucket: string }) => d.bucket === bucket);
      return {
        bucket,
        total_outstanding: found?.total_outstanding ?? 0,
        invoice_count: found?.invoice_count ?? 0,
      };
    });
  }, [agingData]);

  // Stacked chart data for "By Agent" or "By Type" view
  const { stackedData, dimensions } = useMemo(() => {
    if (!dimData || viewMode === 'all') return { stackedData: [], dimensions: [] };

    // Get unique dimensions
    const dims = [...new Set(
      (dimData as { dimension: string }[]).map((d) => d.dimension),
    )].sort();

    // Pivot: one row per bucket, columns per dimension
    const pivoted = BUCKET_ORDER.map(bucket => {
      const row: Record<string, number | string> = { bucket };
      let total = 0;
      for (const dim of dims) {
        const found = (dimData as { bucket: string; dimension: string; total_outstanding: number }[])
          .find(d => d.bucket === bucket && d.dimension === dim);
        const val = found?.total_outstanding ?? 0;
        row[dim] = val;
        total += val;
      }
      row._total = total;
      return row;
    });

    return { stackedData: pivoted, dimensions: dims };
  }, [dimData, viewMode]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Aging Analysis</CardTitle>
          <div className="flex border rounded-md overflow-hidden">
            {([
              { key: 'all', label: 'All' },
              { key: 'agent', label: 'By Agent' },
              { key: 'type', label: 'By Type' },
            ] as const).map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={viewMode === key ? 'default' : 'ghost'}
                className="rounded-none border-0 text-xs px-3 h-7"
                onClick={() => setViewMode(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] animate-pulse rounded bg-muted" />
        ) : viewMode === 'all' ? (
          /* ─── Simple bar chart ─── */
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={simpleChartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <XAxis
                type="number"
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return String(v);
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(value) => [formatRM(value as number), 'Outstanding']} wrapperStyle={{ zIndex: 50 }} />
              <Bar dataKey="total_outstanding" radius={[0, 4, 4, 0]}>
                {simpleChartData.map((entry) => (
                  <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] ?? '#888'} />
                ))}
                <LabelList dataKey="invoice_count" position="right" style={{ fontSize: 10, fill: '#666' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          /* ─── Stacked bar chart by dimension ─── */
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={stackedData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <XAxis
                type="number"
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return String(v);
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(value, name) => [formatRM(value as number), name as string]}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {dimensions.map((dim, i) => (
                <Bar
                  key={dim}
                  dataKey={dim}
                  stackId="aging"
                  fill={DIMENSION_COLORS[i % DIMENSION_COLORS.length]}
                  radius={i === dimensions.length - 1 ? [0, 4, 4, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
