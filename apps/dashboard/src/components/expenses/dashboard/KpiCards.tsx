'use client';

import { useCostKpis } from '@/hooks/expenses/useCostData';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM } from '@/lib/format';

interface KpiCardProps {
  title: string;
  subtitle?: string;
  value: string;
  subtext: string;
  valueColor?: string;
}

function KpiCard({ title, subtitle, value, subtext, valueColor }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        {subtitle && (
          <p className="text-xs text-muted-foreground font-normal">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-2xl font-bold ${valueColor ?? ''}`}>{value}</div>
        <div className="text-xs mt-1 text-muted-foreground">{subtext}</div>
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
        <div className="h-3 bg-muted rounded w-20 animate-pulse mt-2" />
      </CardContent>
    </Card>
  );
}

export function KpiCards({ filters }: { filters: DashboardFilters }) {
  const { data: rawData } = useCostKpis(filters);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const { current, calculated, yoy_pct } = data;

  const yoyLabel = yoy_pct != null
    ? `${yoy_pct >= 0 ? '+' : ''}${yoy_pct.toFixed(1)}%`
    : '—';
  const yoyColor = yoy_pct != null
    ? (yoy_pct > 0 ? 'text-red-600' : 'text-emerald-600')  // cost increase = bad
    : '';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard
        title="Total Costs"
        value={formatRM(current.total_costs)}
        subtext={`Cost of Sales ${calculated.cogs_pct_of_total.toFixed(1)}% · Operating Costs ${calculated.opex_pct_of_total.toFixed(1)}%`}
      />
      <KpiCard
        title="Cost of Sales (COGS)"
        value={formatRM(current.cogs)}
        subtext="Direct costs of products sold"
      />
      <KpiCard
        title="Operating Costs (OPEX)"
        value={formatRM(current.opex)}
        subtext="Day-to-day business costs"
      />
      <KpiCard
        title="vs Last Year"
        value={yoyLabel}
        valueColor={yoyColor}
        subtext="vs same period last year"
      />
    </div>
  );
}
