'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useKpisV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM, formatDays } from '@/lib/payment/format';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';

function KpiCard({
  title,
  value,
  subtitle,
  colorClass,
  extra,
}: {
  title: string;
  value: string;
  subtitle?: string;
  colorClass?: string;
  extra?: React.ReactNode;
}) {
  return (
    <Card className={extra ? 'overflow-visible' : undefined}>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {title}
          {extra}
        </div>
        <p className={`mt-1 text-2xl font-semibold ${colorClass ?? ''}`}>{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

interface PeriodKpiCardsProps {
  filters: DashboardFiltersV2;
}

export default function PeriodKpiCards({ filters }: PeriodKpiCardsProps) {
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

  const cdColor = data.collection_days == null ? '' : data.collection_days <= 30 ? 'text-emerald-600' : data.collection_days <= 60 ? 'text-yellow-600' : 'text-red-600';
  const collColor = data.collection_rate == null ? '' : data.collection_rate >= 80 ? 'text-emerald-600' : data.collection_rate >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <KpiCard
        title="Avg Collection Days"
        value={data.collection_days != null ? formatDays(data.collection_days) : '--'}
        subtitle="avg days to collect payment"
        colorClass={cdColor}
        extra={
          <AnalyzeIcon sectionKey="payment_collection_trend" componentKey="avg_collection_days" />
        }
      />
      <KpiCard
        title="Collection Rate"
        value={data.collection_rate != null ? `${data.collection_rate.toFixed(1)}%` : '--'}
        subtitle="in selected period"
        colorClass={collColor}
        extra={
          <AnalyzeIcon sectionKey="payment_collection_trend" componentKey="collection_rate" />
        }
      />
      <KpiCard
        title="Avg Monthly Collection"
        value={data.avg_monthly_collection != null ? formatRM(data.avg_monthly_collection) : '--'}
        subtitle="in selected period"
        colorClass="text-blue-600"
        extra={
          <AnalyzeIcon sectionKey="payment_collection_trend" componentKey="avg_monthly_collection" />
        }
      />
    </div>
  );
}
