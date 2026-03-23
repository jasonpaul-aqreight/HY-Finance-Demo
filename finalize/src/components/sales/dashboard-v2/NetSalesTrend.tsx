'use client';

import { useState, useMemo } from 'react';
import { useRevenueTrend } from '@/hooks/sales/useRevenueSummary';
import type { DashboardFiltersV2 } from '@/hooks/sales/useDashboardFiltersV2';
import type { Granularity } from '@/hooks/sales/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRM } from '@/lib/format';
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
  ReferenceLine,
  Cell,
} from 'recharts';

const COLORS = {
  invoice: '#2E5090',
  cashSales: '#548235',
  creditNotes: '#C00000',
  priorPeriod: '#94a3b8',
  growthUp: '#16a34a',
  growthDown: '#dc2626',
  neutral: '#2E5090',
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

function shiftYear(dateStr: string, years: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function periodKey(period: string): string {
  if (/^\d{4}-\d{2}$/.test(period)) return period.slice(5);
  if (/^\d{4}-W\d+$/.test(period)) return period.replace(/^\d{4}-/, '');
  return period.slice(5);
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
  const [showPriorPeriod, setShowPriorPeriod] = useState(false);

  const { data: trendData, isLoading } = useRevenueTrend(toV1Filters(filters));

  const priorFilters = useMemo(() => ({
    startDate: shiftYear(filters.startDate, -1),
    endDate: shiftYear(filters.endDate, -1),
    granularity: filters.granularity,
    locations: [],
    agents: [],
  }), [filters.startDate, filters.endDate, filters.granularity]);

  const { data: priorTrendData } = useRevenueTrend(showPriorPeriod ? priorFilters : null);

  const priorByKey = useMemo(() => {
    if (!showPriorPeriod || !priorTrendData?.data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const d of priorTrendData.data as Array<Record<string, unknown>>) {
      const period = d.period as string;
      const net = (d.invoice_revenue as number) + (d.cashsales_revenue as number) + (d.cn_amount as number);
      map.set(periodKey(period), net);
    }
    return map;
  }, [showPriorPeriod, priorTrendData]);

  if (isLoading || !trendData) {
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
    const netSales = invoice + cashSales + creditNotes;
    const priorNet = priorByKey.get(periodKey(period));
    const hasPrior = priorNet !== undefined && priorNet > 0;

    // Bar color: green if above prior, red if below, original blue if no prior data
    const barColor = !showPriorPeriod || !hasPrior
      ? COLORS.neutral
      : netSales >= priorNet
        ? COLORS.growthUp
        : COLORS.growthDown;

    return {
      period,
      invoice,
      cashSales,
      creditNotes,
      priorPeriod: showPriorPeriod && priorNet != null ? priorNet : null,
      barColor,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Net Sales Trend</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showPriorPeriod ? 'default' : 'outline'}
              className="text-xs px-3 h-7"
              onClick={() => setShowPriorPeriod(!showPriorPeriod)}
            >
              {showPriorPeriod ? 'Hide Prior Period' : 'Show Prior Period'}
            </Button>
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
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  invoice: 'Invoice Sales',
                  cashSales: 'Cash Sales',
                  creditNotes: 'Credit Notes',
                  priorPeriod: 'Prior Period Net Sales',
                };
                return [formatRM(value as number), labels[name as string] ?? name];
              }}
              labelFormatter={(label) => formatXLabel(label as string, filters.granularity)}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              content={() => {
                const items = showPriorPeriod
                  ? [
                      { label: 'Growth (above prior)', color: COLORS.growthUp, type: 'square' },
                      { label: 'Decline (below prior)', color: COLORS.growthDown, type: 'square' },
                      { label: 'Credit Notes', color: COLORS.creditNotes, type: 'square' },
                      { label: 'Prior Period', color: COLORS.priorPeriod, type: 'line' },
                    ]
                  : [
                      { label: 'Invoice', color: COLORS.invoice, type: 'square' },
                      { label: 'Cash Sales', color: COLORS.cashSales, type: 'square' },
                      { label: 'Credit Notes', color: COLORS.creditNotes, type: 'square' },
                    ];
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, marginTop: 4 }}>
                    {items.map((item) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {item.type === 'line' ? (
                          <svg width="16" height="10"><line x1="0" y1="5" x2="16" y2="5" stroke={item.color} strokeWidth={2.5} strokeDasharray="4 3" /></svg>
                        ) : (
                          <span style={{ width: 10, height: 10, backgroundColor: item.color, borderRadius: 2, display: 'inline-block' }} />
                        )}
                        <span style={{ color: '#666' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            {/* Stacked bars — green/red when prior period is shown, original colors otherwise */}
            <Bar dataKey="invoice" stackId="sales" radius={[0, 0, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={showPriorPeriod ? entry.barColor : COLORS.invoice} />
              ))}
            </Bar>
            <Bar dataKey="cashSales" stackId="sales" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={showPriorPeriod ? entry.barColor : COLORS.cashSales} />
              ))}
            </Bar>
            {/* Credit Notes bar — always red, not affected by prior period */}
            <Bar dataKey="creditNotes" fill={COLORS.creditNotes} radius={[0, 0, 2, 2]} />

            {/* Prior period dashed line — sharp/angular, breaks on missing data */}
            {showPriorPeriod && (
              <Line
                dataKey="priorPeriod"
                type="linear"
                stroke={COLORS.priorPeriod}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3.5, fill: COLORS.priorPeriod, stroke: '#fff', strokeWidth: 1 }}
                connectNulls={false}
                name="priorPeriod"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
