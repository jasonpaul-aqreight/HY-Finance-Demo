'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import { useCollectionTrend, useKpisV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM } from '@/lib/payment/format';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

interface CollectionTrendChartV2Props {
  filters: DashboardFiltersV2;
}

export default function CollectionTrendChartV2({ filters }: CollectionTrendChartV2Props) {
  const { data: rawData } = useCollectionTrend(filters);
  const data = useStableData(rawData);
  const { data: kpiData } = useKpisV2(filters);

  const avgCollection = kpiData?.avg_monthly_collection ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Invoiced vs Collected</CardTitle>
          <AnalyzeIcon sectionKey="payment_collection_trend" componentKey="invoiced_vs_collected" />
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
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return String(v);
                }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                formatter={(value, name) => [
                  formatRM(value as number),
                  name === 'total_collected' ? 'Collected' : 'Invoiced',
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'total_collected' ? 'Collected' : 'Invoiced'
                }
              />
              {avgCollection != null && avgCollection > 0 && (
                <ReferenceLine
                  y={avgCollection}
                  stroke="#999"
                  strokeDasharray="5 5"
                  label={{
                    value: `Avg ${formatRM(avgCollection)}`,
                    position: 'insideTopRight',
                    fontSize: 10,
                  }}
                />
              )}
              <Bar dataKey="total_collected" fill="#2E5090" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="total_invoiced"
                stroke="#ef4444"
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
