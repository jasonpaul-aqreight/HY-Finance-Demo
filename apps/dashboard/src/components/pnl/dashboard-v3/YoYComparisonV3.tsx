'use client';

import { useMemo } from 'react';
import { useMultiYearPL } from '@/hooks/pnl/usePLDataV3';
import { useStableData } from '@/hooks/useStableData';
import type { MultiYearPLRow } from '@/hooks/pnl/usePLDataV3';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatRMCompact, formatPct } from '@/lib/pnl/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface Props {
  fy: string;
}

interface TableLineItem {
  key: keyof MultiYearPLRow;
  label: string;
  isTotal?: boolean;
  isMargin?: boolean;
}

const TABLE_ITEMS: TableLineItem[] = [
  { key: 'net_sales', label: 'Net Sales' },
  { key: 'cogs', label: 'Cost of Sales' },
  { key: 'gross_profit', label: 'Gross Profit', isTotal: true },
  { key: 'gross_margin_pct', label: 'Gross Margin %', isMargin: true },
  { key: 'other_income', label: 'Other Income' },
  { key: 'expenses', label: 'Operating Costs' },
  { key: 'net_profit', label: 'Net Profit', isTotal: true },
  { key: 'net_margin_pct', label: 'Net Margin %', isMargin: true },
  { key: 'taxation', label: 'Taxation' },
  { key: 'npat', label: 'Net Profit After Tax', isTotal: true },
];

// Categories for the small multiples chart
const CHART_CATEGORIES: { key: keyof MultiYearPLRow; label: string; color: string }[] = [
  { key: 'net_sales', label: 'Net Sales', color: '#2E5090' },
  { key: 'cogs', label: 'Cost of Sales', color: '#ED7D31' },
  { key: 'gross_profit', label: 'Gross Profit', color: '#22c55e' },
  { key: 'other_income', label: 'Other Income', color: '#8b5cf6' },
  { key: 'expenses', label: 'Operating Costs', color: '#6366f1' },
  { key: 'net_profit', label: 'Net Profit', color: '#ef4444' },
  { key: 'taxation', label: 'Taxation', color: '#94a3b8' },
  { key: 'npat', label: 'Net Profit After Tax', color: '#f97316' },
];

function MiniChart({ label, color, data, dataKey, fy }: {
  label: string;
  color: string;
  data: { name: string; value: number }[];
  dataKey: string;
  fy: string;
}) {
  const hasNegative = data.some(d => d.value < 0);

  return (
    <div className="flex flex-col">
      <p className="text-xs font-semibold text-foreground mb-1 truncate">{label}</p>
      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} tickLine={false} axisLine={false} />
            <YAxis hide domain={['auto', 'auto']} />
            {hasNegative && <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />}
            <Tooltip
              wrapperStyle={{ zIndex: 50 }}
              formatter={(value: unknown) => [formatRMCompact(value as number), label]}
              contentStyle={{ borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
              labelStyle={{ fontSize: 10, fontWeight: 600 }}
            />
            <Bar
              dataKey="value"
              radius={[2, 2, 0, 0]}
              fill={color}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground text-right mt-0.5">
        {data.length > 0 ? formatRMCompact(data[data.length - 1].value) : '–'}
      </p>
    </div>
  );
}

function TrendArrow({ current, prior, isMargin }: { current: number; prior: number; isMargin?: boolean }) {
  if (prior === 0 && current === 0) return <span className="text-muted-foreground">–</span>;

  let pctChange: number;
  if (isMargin) {
    // For margin rows, show the absolute point change
    pctChange = current - prior;
  } else if (prior === 0) {
    return <span className="text-emerald-600">↑ New</span>;
  } else {
    pctChange = ((current - prior) / Math.abs(prior)) * 100;
  }

  if (pctChange > 2) {
    return <span className="text-emerald-600">↑ {isMargin ? `${pctChange.toFixed(1)}pp` : `${pctChange.toFixed(1)}%`}</span>;
  } else if (pctChange < -2) {
    return <span className="text-red-600">↓ {isMargin ? `${pctChange.toFixed(1)}pp` : `${pctChange.toFixed(1)}%`}</span>;
  } else {
    return <span className="text-muted-foreground">→ {isMargin ? `${pctChange.toFixed(1)}pp` : `${pctChange.toFixed(1)}%`}</span>;
  }
}

export function YoYComparisonV3({ fy }: Props) {
  const { data: rawAllData } = useMultiYearPL();
  const allData = useStableData(rawAllData);

  const data = useMemo(() => {
    if (!allData) return [];
    const match = fy.match(/(\d{4})/);
    if (!match) return allData;
    const fyNum = parseInt(match[1], 10);
    return allData.filter(d => d.fyNumber >= fyNum - 3 && d.fyNumber <= fyNum);
  }, [allData, fy]);

  if (!allData) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="p-6 h-[400px] animate-pulse bg-muted/30" />
        </Card>
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="p-6 h-[400px] animate-pulse bg-muted/30" />
        </Card>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-6 text-center text-muted-foreground">
          No fiscal year data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Small Multiples — one mini chart per category */}
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold mb-4">
            P&L Trend ({data[0]?.fy} – {data[data.length - 1]?.fy})
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {CHART_CATEGORIES.map(cat => {
              const chartData = data.map(d => ({
                name: d.fy.replace('FY', "'"),
                value: d[cat.key] as number,
              }));
              return (
                <MiniChart
                  key={cat.key}
                  label={cat.label}
                  color={cat.color}
                  data={chartData}
                  dataKey={cat.key}
                  fy={fy}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Multi-Year Comparison Table */}
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Line Item</TableHead>
                {data.map(d => (
                  <TableHead
                    key={d.fy}
                    className={`text-right ${d.fy === fy ? 'bg-muted/40 font-bold' : ''}`}
                  >
                    {d.fy}{d.isPartial ? '*' : ''}
                  </TableHead>
                ))}
                <TableHead className="text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TABLE_ITEMS.map(item => {
                const isTotal = item.isTotal;
                const isMargin = item.isMargin;
                return (
                  <TableRow key={item.key} className={isTotal ? 'bg-muted/40 font-semibold' : ''}>
                    <TableCell className={`px-2 py-1.5 ${isTotal ? 'font-semibold' : ''} ${isMargin ? 'text-muted-foreground italic text-xs pl-4' : ''}`}>
                      {item.label}
                    </TableCell>
                    {data.map(d => {
                      const value = d[item.key] as number;
                      const isSelected = d.fy === fy;
                      const isNeg = value < 0;

                      return (
                        <TableCell
                          key={d.fy}
                          className={`text-right px-1.5 py-1.5 font-mono ${isSelected ? 'bg-muted/40' : ''} ${isTotal ? 'font-semibold' : ''} ${isMargin ? 'text-muted-foreground italic text-xs' : ''}`}
                        >
                          <span className={isNeg && !isMargin ? 'text-red-600' : ''}>
                            {isMargin ? formatPct(value) : formatRMCompact(value)}
                          </span>
                        </TableCell>
                      );
                    })}
                    {/* Trend arrow: compare selected FY vs prior FY */}
                    <TableCell className={`text-center px-1.5 py-1.5 text-xs font-mono ${isTotal ? 'font-semibold' : ''}`}>
                      {(() => {
                        const fyIdx = data.findIndex(d => d.fy === fy);
                        if (fyIdx <= 0) return <span className="text-muted-foreground">–</span>;
                        const current = data[fyIdx][item.key] as number;
                        const prior = data[fyIdx - 1][item.key] as number;
                        return <TrendArrow current={current} prior={prior} isMargin={isMargin} />;
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {data.some(d => d.isPartial) && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              * Partial financial year (data not yet complete)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
