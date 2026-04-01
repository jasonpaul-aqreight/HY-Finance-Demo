'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useKpisV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM, formatCount } from '@/lib/payment/format';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';

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

interface SnapshotKpiCardsProps {
  filters: DashboardFiltersV2;
}

export default function SnapshotKpiCards({ filters }: SnapshotKpiCardsProps) {
  const { data: rawData } = useKpisV2(filters);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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

  const overduePctStr = data.total_outstanding > 0
    ? `${((data.overdue_amount / data.total_outstanding) * 100).toFixed(1)}%`
    : '0%';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
        title="Credit Limit Breaches"
        value={formatCount(data.credit_limit_breaches)}
        subtitle="customers over limit"
        colorClass={data.credit_limit_breaches > 0 ? 'text-red-600' : 'text-emerald-600'}
      />
    </div>
  );
}
