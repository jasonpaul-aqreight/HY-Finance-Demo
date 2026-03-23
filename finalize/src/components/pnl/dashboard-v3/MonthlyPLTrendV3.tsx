'use client';

import { useV3Monthly } from '@/hooks/pnl/usePLDataV3';
import { Card, CardContent } from '@/components/ui/card';
import { formatRMCompact } from '@/lib/pnl/format';
import {
  ComposedChart,
  Bar,
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

export function MonthlyPLTrendV3({ fy, range }: Props) {
  const { data, isLoading } = useV3Monthly(fy, range);

  if (isLoading || !data) {
    return (
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-6 h-80 animate-pulse bg-muted/30" />
      </Card>
    );
  }

  const chartData = data.data.map(d => ({
    label: d.label,
    'Net Sales': d.net_sales,
    COGS: d.cogs,
    OPEX: d.expenses,
    'Net Profit (+)': d.net_profit >= 0 ? d.net_profit : 0,
    'Net Profit (-)': d.net_profit < 0 ? d.net_profit : 0,
  }));

  return (
    <Card className="rounded-xl ring-1 ring-foreground/10">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold mb-4">
          Monthly P&L Trend
        </h3>

        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatRMCompact(v)}
              />
              <Tooltip
                formatter={(value, name) => {
                  const v = value as number;
                  if (name === 'Net Profit (+)' && v === 0) return [null, null];
                  if (name === 'Net Profit (-)' && v === 0) return [null, null];
                  const label = (name === 'Net Profit (+)' || name === 'Net Profit (-)') ? 'Net Profit' : name;
                  return [formatRMCompact(v), label];
                }}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                itemSorter={() => 0}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                content={() => (
                  <div className="flex items-center justify-center gap-5 mt-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(to right, #22c55e 50%, #ef4444 50%)' }} />
                      Net Profit
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#2E5090' }} />
                      Net Sales
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#ED7D31' }} />
                      COGS
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#8b5cf6' }} />
                      OPEX
                    </span>
                  </div>
                )}
              />
              <Bar dataKey="Net Profit (+)" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="np" legendType="none" />
              <Bar dataKey="Net Profit (-)" fill="#ef4444" radius={[0, 0, 2, 2]} stackId="np" legendType="none" />
              <Line
                type="monotone"
                dataKey="Net Sales"
                stroke="#2E5090"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2E5090' }}
              />
              <Line
                type="monotone"
                dataKey="COGS"
                stroke="#ED7D31"
                strokeWidth={2}
                dot={{ r: 3, fill: '#ED7D31' }}
              />
              <Line
                type="monotone"
                dataKey="OPEX"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#8b5cf6' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
