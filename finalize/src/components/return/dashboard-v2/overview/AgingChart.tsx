'use client';

import { useReturnAging } from '@/hooks/return/useCreditDataV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';
import { formatRM, formatCount } from '@/lib/format';

const BUCKET_COLORS: Record<string, string> = {
  '0-30 days': '#10B981',
  '31-60 days': '#F59E0B',
  '61-90 days': '#F97316',
  '91-180 days': '#EF4444',
  '180+ days': '#991B1B',
};

export function AgingChart() {
  const { data, isLoading } = useReturnAging();

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Aging of Unresolved Returns</CardTitle></CardHeader>
        <CardContent><div className="h-[280px] bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  // Ensure all buckets are present even if 0
  const allBuckets = ['0-30 days', '31-60 days', '61-90 days', '91-180 days', '180+ days'];
  const chartData = allBuckets.map(bucket => {
    const found = data.find(d => d.bucket === bucket);
    return { bucket, count: found?.count ?? 0, amount: found?.amount ?? 0 };
  });

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Aging of Unresolved Returns</CardTitle>

      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={5 * 26 + 60}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatRM(v)} />
            <YAxis type="category" dataKey="bucket" width={80} tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold">{label}</p>
                    <p>Amount: {formatRM(d.amount)}</p>
                    <p>Count: {formatCount(d.count)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] ?? '#94A3B8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
