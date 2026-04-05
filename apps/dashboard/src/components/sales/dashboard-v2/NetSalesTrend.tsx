'use client';

import { useRevenueTrend } from '@/hooks/sales/useRevenueSummary';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFiltersV2 } from '@/hooks/sales/useDashboardFiltersV2';
import type { Granularity } from '@/hooks/sales/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRM } from '@/lib/format';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const COLORS = {
  invoice: '#2E5090',
  cashSales: '#548235',
  creditNotes: '#C00000',
};

function formatYAxis(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatXLabel(label: string, granularity: Granularity) {
  if (granularity === 'monthly') {
    const [y, m] = label.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${y?.slice(2)}`;
  }
  if (granularity === 'weekly') {
    return label.replace(/^\d{4}-/, '');
  }
  const d = new Date(label + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
}

function toV1Filters(filters: DashboardFiltersV2) {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    granularity: filters.granularity,
    locations: [],
    agents: [],
  };
}

interface NetSalesTrendProps {
  filters: DashboardFiltersV2;
  setFilters: (updates: Partial<DashboardFiltersV2>) => void;
}

export function NetSalesTrend({ filters, setFilters }: NetSalesTrendProps) {
  const { data: rawTrend } = useRevenueTrend(toV1Filters(filters));
  const trendData = useStableData(rawTrend);

  if (!trendData) {
    return (
      <Card>
        <CardHeader><CardTitle>Net Sales Trend</CardTitle></CardHeader>
        <CardContent><div className="h-80 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  const chartData = (trendData.data ?? []).map((d: Record<string, unknown>) => {
    const period = d.period as string;
    const invoice = d.invoice_revenue as number;
    const cashSales = d.cashsales_revenue as number;
    const creditNotes = d.cn_amount as number;

    return {
      period,
      invoice,
      cashSales,
      creditNotes,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Net Sales Trend</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md overflow-hidden">
              {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={filters.granularity === g ? 'default' : 'ghost'}
                  className="rounded-none border-0 text-xs px-3 h-7 capitalize"
                  onClick={() => setFilters({ granularity: g })}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="period"
              tickFormatter={(v) => formatXLabel(v, filters.granularity)}
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke="#666" strokeWidth={0.5} />
            <Tooltip
              wrapperStyle={{ zIndex: 50 }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  invoice: 'Invoice Sales',
                  cashSales: 'Cash Sales',
                  creditNotes: 'Credit Notes',
                };
                return [formatRM(value as number), labels[name as string] ?? name];
              }}
              labelFormatter={(label) => formatXLabel(label as string, filters.granularity)}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              content={() => {
                const items = [
                  { label: 'Invoice Sales', color: COLORS.invoice },
                  { label: 'Cash Sales', color: COLORS.cashSales },
                  { label: 'Credit Notes', color: COLORS.creditNotes },
                ];
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, marginTop: 4 }}>
                    {items.map((item) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 10, height: 10, backgroundColor: item.color, borderRadius: 2, display: 'inline-block' }} />
                        <span style={{ color: '#666' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            <Bar dataKey="invoice" stackId="sales" fill={COLORS.invoice} radius={[0, 0, 0, 0]} />
            <Bar dataKey="cashSales" stackId="sales" fill={COLORS.cashSales} radius={[2, 2, 0, 0]} />
            <Bar dataKey="creditNotes" fill={COLORS.creditNotes} radius={[0, 0, 2, 2]} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
