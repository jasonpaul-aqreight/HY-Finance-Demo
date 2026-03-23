'use client';

import { useDashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';
import { DateRangeFilter } from './DateRangeFilter';
import KpiCardsV2 from './KpiCardsV2';
import AgingChartV2 from './AgingChartV2';
import CollectionTrendChartV2 from './CollectionTrendChartV2';
import CreditUtilizationChartV2 from './CreditUtilizationChartV2';
import DsoTrendChartV2 from './DsoTrendChartV2';
import CustomerTableV2 from './CustomerTableV2';

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="h-px flex-1 bg-border" />
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
      {/* Date Range Filter */}
      <DateRangeFilter
        filters={filters}
        setFilters={setFilters}
        bounds={bounds}
      />

      {/* KPIs */}
      <div className="mt-6">
        <SectionDivider title="Overview" />
        <div className="mt-3">
          <KpiCardsV2 filters={filters} />
        </div>
      </div>

      {/* Charts Row 1: 2 cols — Aging + Collection Trend */}
      <div className="mt-6">
        <SectionDivider title="Analysis" />
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DsoTrendChartV2 filters={filters} />
          <CollectionTrendChartV2 filters={filters} />
        </div>
      </div>

      {/* Charts Row 2: 2 cols — Aging + Credit Utilization */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgingChartV2 />
        <CreditUtilizationChartV2 />
      </div>

      {/* Separator — table is not filtered by date range */}
      <div className="mt-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">All outstanding invoices — not filtered by date range above</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Customer Table */}
      <div className="mt-4">
        <SectionDivider title="Customer Credit Health" />
        <div className="mt-3">
          <CustomerTableV2 />
        </div>
      </div>
    </div>
  );
}
