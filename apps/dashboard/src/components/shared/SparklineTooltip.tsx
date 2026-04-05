'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Expand } from 'lucide-react';
import { formatMonth } from '@/lib/format-month';

// ─── Types ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SparklineTooltipColumn<T extends Record<string, any> = Record<string, any>> {
  header: string;
  align: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SparklineTooltipProps<T extends Record<string, any>> {
  /** Title shown in the popover header (e.g. supplier/customer name) */
  title: string;
  /** Full monthly data array for chart + table */
  data: T[];
  /** Key for the x-axis period (e.g. "period" or "month") */
  periodKey: keyof T & string;
  /** Key for the y-axis value (e.g. "margin_pct" or "avg_price") */
  valueKey: keyof T & string;
  /** Label shown in the chart tooltip (e.g. "Margin %" or "Avg Price") */
  valueLabel: string;
  /** Format displayed values in chart tooltip and header range */
  valueFormatter: (v: number) => string;
  /** 'up' = green when last > first (margin). 'down' = green when last < first (price) */
  improvementDirection: 'up' | 'down';
  /** Table columns definition */
  columns: SparklineTooltipColumn<T>[];
  /** Optional Y-axis tick formatter */
  yFormatter?: (v: number) => string;
  /** Sparkline inline dimensions */
  sparklineWidth?: number;
  sparklineHeight?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SparklineTooltip<T extends Record<string, any>>({
  title,
  data,
  periodKey,
  valueKey,
  valueLabel,
  valueFormatter,
  improvementDirection,
  columns,
  yFormatter,
  sparklineWidth = 100,
  sparklineHeight = 28,
}: SparklineTooltipProps<T>) {
  const values = data.map(d => Number(d[valueKey]));

  // Need at least 2 points for a meaningful sparkline
  if (values.length < 2) {
    return <div className="text-xs text-foreground/70">—</div>;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

  // Determine color based on improvement direction
  const isImproving =
    improvementDirection === 'up' ? last >= first : last <= first;
  const color = isImproving ? '#10b981' : '#ef4444';

  // Inline sparkline data
  const sparkData = values.map((v, i) => ({ i, v }));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button className="group flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-muted/60 transition-colors">
            <LineChart width={sparklineWidth} height={sparklineHeight} data={sparkData}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
            <Expand className="h-3 w-3 text-foreground/0 group-hover:text-foreground/40 transition-colors shrink-0" />
          </button>
        }
      />
      <PopoverContent className="w-[340px] p-0" align="start">
        {/* Header */}
        <div className="p-3 border-b">
          <p className="text-xs font-bold text-foreground truncate">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-foreground/70">
              {valueFormatter(first)} → {valueFormatter(last)}
            </span>
            <span
              className={`text-xs font-bold ${isImproving ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {changePct <= 0 ? '▼' : '▲'}
              {Math.abs(changePct).toFixed(1)}%
            </span>
            <span className="text-xs text-foreground/40">
              ({data.length} mths)
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="p-3">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={periodKey as string}
                tickFormatter={formatMonth}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tickFormatter={yFormatter ?? ((v: number) => `${v.toFixed(0)}`)}
                tick={{ fontSize: 10 }}
                width={35}
              />
              <Tooltip
                formatter={(value: unknown) => [
                  valueFormatter(Number(value)),
                  valueLabel,
                ]}
                labelFormatter={(l: unknown) => formatMonth(String(l))}
              />
              <Line
                type="monotone"
                dataKey={valueKey as string}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="border-t max-h-[200px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30">
                {columns.map(col => (
                  <th
                    key={col.header}
                    className={`px-3 py-1.5 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-t">
                  {columns.map(col => (
                    <td
                      key={col.header}
                      className={`px-3 py-1 ${col.align === 'right' ? 'text-right' : ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PopoverContent>
    </Popover>
  );
}
