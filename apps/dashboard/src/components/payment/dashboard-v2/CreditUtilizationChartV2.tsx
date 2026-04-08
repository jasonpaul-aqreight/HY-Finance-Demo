'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import { useCreditUtilizationV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORY_LABELS: Record<string, string> = {
  'Within Limit': 'Within Limit',
  'Near Limit': 'Near Limit',
  'Over Limit': 'Over Limit',
  'No Limit Set': 'No Limit Set',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Within Limit': '#4ade80',
  'Near Limit': '#facc15',
  'Over Limit': '#ef4444',
  'No Limit Set': '#9ca3af',
};

const CATEGORY_ORDER = ['Within Limit', 'Near Limit', 'Over Limit', 'No Limit Set'];

export default function CreditUtilizationChartV2() {
  const { data: rawData } = useCreditUtilizationV2();
  const data = useStableData(rawData);

  const chartData = CATEGORY_ORDER.map(cat => {
    const found = data?.find(d => d.category === cat);
    return {
      category: CATEGORY_LABELS[cat] ?? cat,
      customer_count: found?.customer_count ?? 0,
      total_outstanding: found?.total_outstanding ?? 0,
    };
  }).filter(d => d.customer_count > 0);

  const totalWithLimits = chartData
    .filter(d => d.category !== 'No Limit Set')
    .reduce((sum, d) => sum + d.customer_count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Credit Usage</CardTitle>
          <AnalyzeIcon sectionKey="payment_outstanding" componentKey="credit_usage_distribution" />
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="h-[300px] animate-pulse rounded bg-muted" />
        ) : (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="customer_count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#888'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} customers`, name as string]}
                    wrapperStyle={{ zIndex: 50 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ height: 260 }}>
                <div className="text-center">
                  <p className="text-2xl font-semibold">{totalWithLimits}</p>
                  <p className="text-xs text-muted-foreground">with limits</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 px-2">
              {chartData.map((entry) => (
                <div key={entry.category} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[entry.category] ?? '#888' }}
                  />
                  <span className="text-muted-foreground leading-tight">
                    {entry.category}
                    <span className="ml-1 font-medium text-foreground">({entry.customer_count})</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
