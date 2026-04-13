'use client';

import { useRevenueSummary } from '@/hooks/sales/useRevenueSummary';
import { useStableData } from '@/hooks/useStableData';
import type { DashboardFiltersV2 } from '@/hooks/sales/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import { formatRM } from '@/lib/format';
import type { SectionKey } from '@/lib/ai-insight/types';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  negative?: boolean;
  sectionKey?: SectionKey;
  componentKey?: string;
}

function KpiCard({ title, value, subtitle, negative, sectionKey, componentKey }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center gap-1">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </CardTitle>
          {sectionKey && componentKey && (
            <AnalyzeIcon sectionKey={sectionKey} componentKey={componentKey} />
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-2xl font-bold tabular-nums ${negative ? 'text-red-600' : ''}`}>
          {negative && value !== 'RM 0' ? '-' : ''}{value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
        )}
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

// Adapt V2 filters to the shape expected by the V1 summary hook
function toV1Filters(filters: DashboardFiltersV2) {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    granularity: filters.granularity,
    locations: [],
    agents: [],
  };
}

export function KpiCardsV2({ filters }: { filters: DashboardFiltersV2 }) {
  const { data: rawData } = useRevenueSummary(toV1Filters(filters));
  const data = useStableData(rawData);

  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const { current } = data;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      <KpiCard
        title="Net Sales"
        value={formatRM(current.net_revenue)}
        subtitle="Invoice + Cash Sales − Credit Notes"
        sectionKey="sales_trend"
        componentKey="net_sales"
      />
      <KpiCard
        title="Invoice Sales"
        value={formatRM(current.invoice_revenue)}
        subtitle="Billed on credit terms to customer"
        sectionKey="sales_trend"
        componentKey="invoice_sales"
      />
      <KpiCard
        title="Cash Sales"
        value={formatRM(current.cashsales_revenue)}
        subtitle="Immediate payment"
        sectionKey="sales_trend"
        componentKey="cash_sales"
      />
      <KpiCard
        title="Credit Notes"
        value={formatRM(Math.abs(current.credit_notes))}
        subtitle="Goods returns & adjustments"
        negative
        sectionKey="sales_trend"
        componentKey="credit_notes"
      />
    </div>
  );
}
