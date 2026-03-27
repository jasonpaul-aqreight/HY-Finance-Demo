'use client';

import { useDashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';
import { DateRangeFilter } from './DateRangeFilter';
import SnapshotKpiCards from './SnapshotKpiCards';
import PeriodKpiCards from './PeriodKpiCards';
import AgingChartV2 from './AgingChartV2';
import CollectionTrendChartV2 from './CollectionTrendChartV2';
import CreditUtilizationChartV2 from './CreditUtilizationChartV2';
import DsoTrendChartV2 from './DsoTrendChartV2';
import CustomerTableV2 from './CustomerTableV2';

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex items-center gap-3">
        <span className="bg-background pr-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        </span>
        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

export function DashboardShellV2() {
  const { filters, setFilters, ready, bounds } = useDashboardFiltersV2();

  if (!ready) {
    return (
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      {/* ═══ Section 1: Trend & Collection (date-filtered) ═══ */}
      <SectionHeader title="Trend & Collection" subtitle="Filtered by date range" />

      <div className="mt-4">
        <DateRangeFilter
          filters={filters}
          setFilters={setFilters}
          bounds={bounds}
        />
      </div>

      <div className="mt-4">
        <PeriodKpiCards filters={filters} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DsoTrendChartV2 filters={filters} />
        <CollectionTrendChartV2 filters={filters} />
      </div>

      {/* ═══ Section 2: Outstanding Position (as of today) ═══ */}
      <div className="mt-10">
        <SectionHeader title="Outstanding Position" subtitle="As of today" />
      </div>

      <div className="mt-4">
        <SnapshotKpiCards filters={filters} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgingChartV2 />
        <CreditUtilizationChartV2 />
      </div>

      <div className="mt-4">
        <CustomerTableV2 />
      </div>
    </div>
  );
}
