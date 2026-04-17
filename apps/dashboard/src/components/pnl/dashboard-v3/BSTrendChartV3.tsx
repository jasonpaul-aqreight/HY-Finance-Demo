'use client';

import { useV3BSTrend } from '@/hooks/pnl/usePLDataV3';
import { useStableData } from '@/hooks/useStableData';
import { Card, CardContent } from '@/components/ui/card';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import { formatRMCompact } from '@/lib/pnl/format';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  fy: string;
  range: string;
}

function formatYAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function BSTrendChartV3({ fy, range }: Props) {
  const { data: rawData } = useV3BSTrend(fy, range);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <Card className="rounded-xl ring-1 ring-foreground/10 h-full">
        <CardContent className="p-6 h-[380px] animate-pulse bg-muted/30" />
      </Card>
    );
  }

  const chartData = (Array.isArray(data) ? data : []).map(d => ({
    month: d.label.split(' ')[0],
    'Total Assets': d.total_assets,
    'Total Liabilities': d.total_liabilities,
    Equity: d.equity,
  }));

  return (
    <Card className="rounded-xl ring-1 ring-foreground/10 h-full">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-1.5">
          Assets, Liabilities & Equity Trend
          <AnalyzeIcon sectionKey="financial_balance_sheet" componentKey="bs_trend" />
        </h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 8, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#1a1a1a' }} tickLine={false} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 13, fill: '#1a1a1a' }} tickLine={false} axisLine={false} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                formatter={(value: unknown, name: unknown) => [
                  formatRMCompact(value as number),
                  name as string,
                ]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
              />
              <Legend wrapperStyle={{ fontSize: 14, paddingTop: 8 }} />
              <Line type="monotone" dataKey="Total Assets" stroke="#2E75B6" strokeWidth={2} dot={{ r: 4, fill: '#2E75B6' }} />
              <Line type="monotone" dataKey="Total Liabilities" stroke="#C00000" strokeWidth={2} dot={{ r: 4, fill: '#C00000' }} />
              <Line type="monotone" dataKey="Equity" stroke="#548235" strokeWidth={2} dot={{ r: 4, fill: '#548235' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
