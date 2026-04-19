'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import { useCollectionDaysTrend } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface CollectionDaysTrendChartProps {
  filters: DashboardFiltersV2;
}

export default function CollectionDaysTrendChart({ filters }: CollectionDaysTrendChartProps) {
  const { data: rawData } = useCollectionDaysTrend(filters);
  const data = useStableData(rawData);

  const avgCd = useMemo(() => {
    if (!data || data.length === 0) return null;
    const validPoints = data.filter(d => d.collection_days != null);
    if (validPoints.length === 0) return null;
    const sum = validPoints.reduce((s, d) => s + (d.collection_days ?? 0), 0);
    return Math.round((sum / validPoints.length) * 10) / 10;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Collection Days Trend</CardTitle>
          <AnalyzeIcon sectionKey="payment_collection_trend" componentKey="collection_days_trend" />
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="h-[300px] animate-pulse rounded bg-muted" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                formatter={(value) => [
                  value != null ? `${Number(value).toFixed(1)} days` : '--',
                  'Days',
                ]}
              />
              {avgCd != null && (
                <ReferenceLine
                  y={avgCd}
                  stroke="#2E5090"
                  strokeDasharray="3 3"
                  label={{
                    value: `Avg ${avgCd.toFixed(1)}d`,
                    position: 'insideBottomRight',
                    fontSize: 10,
                    fill: '#2E5090',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="collection_days"
                stroke="#2E5090"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
