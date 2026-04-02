'use client';

import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { useKpisV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM, formatCount } from '@/lib/payment/format';
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
        extra={
          <InfoTooltip>
            <p>Total unpaid invoice amount across all customers. This is the sum of remaining balances on all open invoices.</p>
          </InfoTooltip>
        }
      />
      <KpiCard
        title="Overdue Amount"
        value={formatRM(data.overdue_amount)}
        subtitle={`${overduePctStr} of total · ${formatCount(data.overdue_customers)} customers`}
        colorClass="text-red-600"
        extra={
          <InfoTooltip>
            <p>Total outstanding amount on invoices that have passed their due date. Overdue % shows how much of the total outstanding is past due.</p>
          </InfoTooltip>
        }
      />
      <KpiCard
        title="Credit Limit Breaches"
        value={formatCount(data.credit_limit_breaches)}
        subtitle="customers over limit"
        colorClass={data.credit_limit_breaches > 0 ? 'text-red-600' : 'text-emerald-600'}
        extra={
          <InfoTooltip>
            <p>Number of active customers whose total outstanding exceeds their assigned credit limit.</p>
          </InfoTooltip>
        }
      />
    </div>
  );
}
