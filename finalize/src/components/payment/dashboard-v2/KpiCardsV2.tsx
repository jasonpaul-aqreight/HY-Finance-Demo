'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useKpisV2 } from '@/hooks/payment/usePaymentDataV2';
import { formatRM, formatDays, formatCount } from '@/lib/payment/format';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';

interface KpiCardsV2Props {
  filters: DashboardFiltersV2;
}

function KpiCard({
  title,
  value,
  subtitle,
  colorClass,
}: {
  title: string;
  value: string;
  subtitle?: string;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={`mt-1 text-2xl font-semibold ${colorClass ?? ''}`}>{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function KpiCardsV2({ filters }: KpiCardsV2Props) {
  const { data, isLoading } = useKpisV2(filters);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const dsoColor = data.dso == null ? '' : data.dso <= 30 ? 'text-emerald-600' : data.dso <= 60 ? 'text-yellow-600' : 'text-red-600';
  const collColor = data.collection_rate == null ? '' : data.collection_rate >= 80 ? 'text-emerald-600' : data.collection_rate >= 50 ? 'text-yellow-600' : 'text-red-600';

  const overduePctStr = data.total_outstanding > 0
    ? `${((data.overdue_amount / data.total_outstanding) * 100).toFixed(1)}%`
    : '0%';

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        title="Total Outstanding"
        value={formatRM(data.total_outstanding)}
        colorClass="text-orange-600"
      />
      <KpiCard
        title="Overdue Amount"
        value={formatRM(data.overdue_amount)}
        subtitle={`${overduePctStr} of total · ${formatCount(data.overdue_customers)} customers`}
        colorClass="text-red-600"
      />
      <KpiCard
        title="Days Sales Outstanding (DSO)"
        value={data.dso != null ? formatDays(data.dso) : '--'}
        subtitle="avg monthly DSO"
        colorClass={dsoColor}
      />
      <KpiCard
        title="Collection Rate"
        value={data.collection_rate != null ? `${data.collection_rate.toFixed(1)}%` : '--'}
        subtitle="in selected period"
        colorClass={collColor}
      />
      <KpiCard
        title="Credit Limit Breaches"
        value={formatCount(data.credit_limit_breaches)}
        subtitle="customers over limit"
        colorClass={data.credit_limit_breaches > 0 ? 'text-red-600' : 'text-emerald-600'}
      />
      <KpiCard
        title="Avg Monthly Collection"
        value={data.avg_monthly_collection != null ? formatRM(data.avg_monthly_collection) : '--'}
        subtitle="in selected period"
        colorClass="text-blue-600"
      />
    </div>
  );
}
