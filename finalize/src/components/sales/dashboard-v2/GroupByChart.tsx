'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import { formatRM } from '@/lib/format';
import type { GroupByRow } from '@/lib/sales/types';

function formatXAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

const BAR_COLORS = [
  '#2563eb', '#3b82f6', '#60a5fa', '#7dd3fc', '#93c5fd',
  '#548235', '#e67e22', '#8e44ad', '#16a085', '#f59e0b',
];

const BAR_SIZE = 28;

interface GroupByChartProps {
  selectedData: GroupByRow[];
  title: string;
}

export function GroupByChart({ selectedData, title }: GroupByChartProps) {
  const barData = useMemo(() => selectedData.map(d => ({
    ...d,
    total_sales: Math.max(0, d.total_sales),
  })), [selectedData]);

  const chartHeight = Math.max(400, barData.length * 48);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={barData}
          barSize={BAR_SIZE}
          margin={{ top: 4, right: 100, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" domain={[0, 'dataMax']} tickFormatter={formatXAxis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            width={280}
          />
          <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(v: unknown) => [formatRM(v as number), 'Total Sales']} />
          <Bar dataKey="total_sales" name="Total Sales" radius={[0, 3, 3, 0]}>
            {barData.map((_, idx) => (
              <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
            ))}
            <LabelList
              dataKey="total_sales"
              position="right"
              formatter={(v: unknown) => formatRM(v as number)}
              style={{ fontSize: 10, fill: '#374151' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
