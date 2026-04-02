'use client';

import { useReturnOverview } from '@/hooks/return/useCreditDataV2';
import { useStableData } from '@/hooks/useStableData';
import type { V2Filters } from '@/hooks/return/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { formatRM, formatCount } from '@/lib/format';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
  extra?: React.ReactNode;
}

function KpiCard({ title, value, subtitle, valueColor, extra }: KpiCardProps) {
  return (
    <Card className={extra ? 'overflow-visible' : undefined}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          {title}
          {extra}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-2xl font-bold ${valueColor ?? ''}`}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
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

function ReconFormulaTooltip() {
  return (
    <span className="relative group">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-[100] hidden group-hover:block w-max bg-background border rounded-lg shadow-lg p-3 space-y-2">
        <p className="font-mono text-sm bg-muted/50 rounded px-2 py-1">
          Unresolved = NetTotal - KnockOffAmt - RefundAmt
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>= 0 → Settled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>&gt; 0 &amp; &lt; Total → Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>= Total → Outstanding</span>
          </div>
        </div>
      </span>
    </span>
  );
}

export function KpiCardsV2({ filters }: { filters: V2Filters }) {
  const { data: rawData } = useReturnOverview(filters);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const returnRatePct = data.return_rate_pct ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KpiCard
        title="Total Returns"
        value={formatRM(data.total_return_value)}
        subtitle={`${formatCount(data.return_count)} return credit notes`}
      />
      <KpiCard
        title="Reconciled"
        value={formatRM(data.total_knocked_off + data.total_refunded)}
        valueColor="text-emerald-600"
        subtitle={`Knocked Off + Refunded = ${data.total_return_value > 0 ? (((data.total_knocked_off + data.total_refunded) / data.total_return_value) * 100).toFixed(1) : '0'}% of total`}
      />
      <KpiCard
        title="Unresolved"
        value={formatRM(data.total_unresolved)}
        valueColor={data.total_unresolved > 0 ? 'text-red-600' : 'text-emerald-600'}
        subtitle={`${data.total_return_value > 0 ? ((data.total_unresolved / data.total_return_value) * 100).toFixed(1) : '0'}% of total — ${formatCount(data.partial_count)} partial + ${formatCount(data.outstanding_count)} outstanding`}
        extra={<ReconFormulaTooltip />}
      />
      <KpiCard
        title="Return %"
        value={`${returnRatePct.toFixed(1)}%`}
        valueColor={returnRatePct > 5 ? 'text-red-600' : returnRatePct > 2 ? 'text-amber-600' : 'text-emerald-600'}
        subtitle="return value ÷ total sales"
      />
    </div>
  );
}
