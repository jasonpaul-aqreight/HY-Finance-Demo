'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginKpi } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatMarginPct, formatCount, marginColor } from '@/lib/customer-margin/format';

interface KpiCardsProps {
  filters: MarginDashboardFilters;
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardHeader><CardTitle className="h-4 w-24 animate-pulse rounded bg-muted" /></CardHeader>
          <CardContent><div className="h-7 w-32 animate-pulse rounded bg-muted" /></CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KpiCards({ filters }: KpiCardsProps) {
  const { data, isLoading } = useMarginKpi(filters);

  if (isLoading || !data) return <SkeletonCards />;

  const cards = [
    { title: 'Total Revenue', value: formatRM(data.total_revenue), color: 'text-foreground' },
    { title: 'Total COGS', value: formatRM(data.total_cogs), color: 'text-foreground' },
    {
      title: 'Gross Profit',
      value: formatRM(data.gross_profit),
      color: data.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      title: 'Overall Margin',
      value: formatMarginPct(data.margin_pct),
      color: marginColor(data.margin_pct),
    },
    { title: 'Active Customers', value: formatCount(data.active_customers), color: 'text-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map(card => (
        <Card key={card.title} size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
