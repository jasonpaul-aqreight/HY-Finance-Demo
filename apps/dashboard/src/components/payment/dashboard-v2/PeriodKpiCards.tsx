'use client';

import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { useKpisV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM, formatDays } from '@/lib/payment/format';
import type { DashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';

function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative group">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-[100] hidden group-hover:block w-max max-w-xs bg-background border rounded-lg shadow-lg p-3 space-y-2 text-sm text-foreground">
        {children}
      </span>
    </span>
  );
}

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

  const dsoColor = data.dso == null ? '' : data.dso <= 30 ? 'text-emerald-600' : data.dso <= 60 ? 'text-yellow-600' : 'text-red-600';
  const collColor = data.collection_rate == null ? '' : data.collection_rate >= 80 ? 'text-emerald-600' : data.collection_rate >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <KpiCard
        title="Days Sales Outstanding (DSO)"
        value={data.dso != null ? formatDays(data.dso) : '--'}
        subtitle="avg monthly DSO"
        colorClass={dsoColor}
        extra={
          <InfoTooltip>
            <p>Days Sales Outstanding measures how many days, on average, it takes a company to collect payment after making a sale. It&apos;s a cash flow efficiency metric.</p>
            <p className="font-mono bg-muted/50 rounded px-2 py-1">
              DSO = (Accounts Receivable / Total Invoice Sales) &times; Number of Days
            </p>
          </InfoTooltip>
        }
      />
      <KpiCard
        title="Collection Rate"
        value={data.collection_rate != null ? `${data.collection_rate.toFixed(1)}%` : '--'}
        subtitle="in selected period"
        colorClass={collColor}
        extra={
          <InfoTooltip>
            <p>Collection Rate measures how much of the invoiced amount has been collected in cash payments during the selected period. A rate above 100% means you&apos;re collecting more than you&apos;re billing (clearing older debts).</p>
            <p className="text-muted-foreground">Note: Contra settlements (debtor/creditor offsets) are not included as they are non-cash.</p>
            <p className="font-mono bg-muted/50 rounded px-2 py-1">
              Collection Rate = (Total Collected &divide; Total Invoiced) &times; 100
            </p>
          </InfoTooltip>
        }
      />
      <KpiCard
        title="Avg Monthly Collection"
        value={data.avg_monthly_collection != null ? formatRM(data.avg_monthly_collection) : '--'}
        subtitle="in selected period"
        colorClass="text-blue-600"
        extra={
          <InfoTooltip>
            <p>Average Monthly Collection shows how much cash payment is received per month during the selected period. Useful for forecasting expected cash inflow.</p>
            <p className="font-mono bg-muted/50 rounded px-2 py-1">
              Avg Monthly Collection = Total Collected &divide; Months in Period
            </p>
          </InfoTooltip>
        }
      />
    </div>
  );
}
