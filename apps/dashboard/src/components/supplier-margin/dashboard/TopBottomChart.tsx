'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTopBottomSuppliers, useTopBottomItems } from '@/hooks/supplier-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRM } from '@/lib/supplier-margin/format';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';

type Entity = 'suppliers' | 'items';
type Metric = 'profit' | 'margin';
type Direction = 'highest' | 'lowest';

const PROFIT_COLORS = [
  '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5',
  '#059669', '#047857', '#065f46', '#064e3b', '#022c22',
];

const MARGIN_COLORS = [
  '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
  '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764',
];

function truncate(name: string, max = 50) {
  return name.length > max ? name.slice(0, max) + '...' : name;
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden">
      {options.map(opt => (
        <Button
          key={opt.key}
          size="sm"
          variant={value === opt.key ? 'default' : 'ghost'}
          className="rounded-none border-0 text-xs px-2 h-7"
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function TopBottomChart({ filters }: { filters: DashboardFilters }) {
  const [entity, setEntity] = useState<Entity>('suppliers');
  const [metric, setMetric] = useState<Metric>('profit');
  const [direction, setDirection] = useState<Direction>('highest');

  const order = direction === 'lowest' ? 'asc' : 'desc';
  const sortBy = metric === 'margin' ? 'margin_pct' : 'profit';

  // Supplier data
  const { data: rawSupplierData } = useTopBottomSuppliers(
    filters, order, 10, sortBy
  );
  const supplierData = useStableData(rawSupplierData);
  // Item data
  const { data: rawItemData } = useTopBottomItems(
    filters, order, 10, sortBy
  );
  const itemData = useStableData(rawItemData);

  const isLoading = entity === 'suppliers' ? !supplierData : !itemData;

  const chartData = useMemo(() => {
    if (entity === 'suppliers') {
      return (supplierData ?? []).slice(0, 10).map((r: { company_name: string; profit: number; margin_pct: number | null; revenue: number }) => ({
        name: truncate(r.company_name),
        value: metric === 'profit' ? (r.profit ?? 0) : (r.margin_pct ?? 0),
        revenue: r.revenue,
        margin_pct: r.margin_pct,
        profit: r.profit ?? 0,
      }));
    }
    return (itemData ?? []).slice(0, 10).map((r: { item_name: string; item_code: string; profit: number; margin_pct: number | null; revenue: number }) => ({
      name: truncate(r.item_name || r.item_code),
      value: metric === 'profit' ? (r.profit ?? 0) : (r.margin_pct ?? 0),
      revenue: r.revenue,
      margin_pct: r.margin_pct,
      profit: r.profit ?? 0,
    }));
  }, [entity, metric, supplierData, itemData]);

  const colors = metric === 'profit' ? PROFIT_COLORS : MARGIN_COLORS;
  const dirLabel = direction === 'highest' ? 'Top' : 'Bottom';
  const entityLabel = entity === 'suppliers' ? 'Suppliers' : 'Items';
  const title = `${dirLabel} 10 ${entityLabel}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <CardTitle className="whitespace-nowrap shrink-0">{title}</CardTitle>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <ToggleGroup<Entity>
            options={[
              { key: 'suppliers', label: 'Suppliers' },
              { key: 'items', label: 'Items' },
            ]}
            value={entity}
            onChange={setEntity}
          />
          <ToggleGroup<Metric>
            options={[
              { key: 'profit', label: 'Gross Profit' },
              { key: 'margin', label: 'Margin %' },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <ToggleGroup<Direction>
            options={[
              { key: 'highest', label: 'Highest' },
              { key: 'lowest', label: 'Lowest' },
            ]}
            value={direction}
            onChange={setDirection}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">
            No data for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                tickFormatter={v => metric === 'profit' ? formatRM(v) : `${v}%`}
                tick={{ fontSize: 10 }}
              />
              <YAxis type="category" dataKey="name" width={280} tick={{ fontSize: 12 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;
                  return (
                    <div className="bg-card border rounded-md shadow-sm p-2 text-sm">
                      <p className="font-semibold">{row.name}</p>
                      <p>Gross Profit: {formatRM(row.profit)}</p>
                      <p>Margin: {row.margin_pct?.toFixed(1)}%</p>
                      <p>Revenue: {formatRM(row.revenue)}</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="value"
                name={metric === 'profit' ? 'Gross Profit' : 'Margin %'}
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((_: unknown, i: number) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
