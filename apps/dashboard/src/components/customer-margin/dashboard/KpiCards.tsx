'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarginKpi } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatMarginPct, formatCount, marginColor } from '@/lib/customer-margin/format';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';

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
  const { data: rawData } = useMarginKpi(filters);
  const data = useStableData(rawData);

  if (!data) return <SkeletonCards />;

  const cards = [
    { title: 'Net Sales', componentKey: 'cm_net_sales', value: formatRM(data.total_revenue), color: 'text-foreground', formula: 'Invoice + Debit Note − Credit Note' },
    { title: 'Cost of Sales', componentKey: 'cm_cogs', value: formatRM(data.total_cogs), color: 'text-foreground' },
    {
      title: 'Gross Profit',
      componentKey: 'cm_gross_profit',
      value: formatRM(data.gross_profit),
      color: data.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600',
      formula: 'Net Sales − COGS',
    },
    {
      title: 'Gross Margin %',
      componentKey: 'cm_margin_pct',
      value: formatMarginPct(data.margin_pct),
      color: marginColor(data.margin_pct),
      formula: 'Gross Profit ÷ Net Sales',
    },
    { title: 'Active Customers', componentKey: 'cm_active_customers', value: formatCount(data.active_customers), color: 'text-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map(card => (
        <Card key={card.title} size="sm">
          <CardHeader>
            <div className="flex items-center gap-1">
              <CardTitle className="text-xs text-muted-foreground">{card.title}</CardTitle>
              <AnalyzeIcon sectionKey="customer_margin_overview" componentKey={card.componentKey} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
            {'formula' in card && card.formula && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{card.formula}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
