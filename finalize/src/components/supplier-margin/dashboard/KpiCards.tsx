'use client';

import { useMarginSummary } from '@/hooks/supplier-margin/useMarginData';
import type { DashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM, marginColor } from '@/lib/supplier-margin/format';

interface KpiCardProps {
  title: string;
  value: string;
  valueColor?: string;
}

function KpiCard({ title, value, valueColor }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-2xl font-bold ${valueColor ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="h-3 bg-muted rounded w-24 animate-pulse" />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="h-8 bg-muted rounded w-32 animate-pulse mt-1" />
      </CardContent>
    </Card>
  );
}

export function KpiCards({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useMarginSummary(filters);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const { current } = data;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <KpiCard
        title="Total Revenue"
        value={formatRM(current.revenue)}
      />
      <KpiCard
        title="Purchase Cost"
        value={formatRM(current.cogs)}
      />
      <KpiCard
        title="Gross Profit"
        value={formatRM(current.profit)}
        valueColor={current.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
      />
      <KpiCard
        title="Overall Margin"
        value={current.margin_pct != null ? `${current.margin_pct.toFixed(1)}%` : '—'}
        valueColor={marginColor(current.margin_pct)}
      />
      <KpiCard
        title="Active Suppliers"
        value={current.active_suppliers != null ? current.active_suppliers.toLocaleString() : '—'}
      />
    </div>
  );
}
