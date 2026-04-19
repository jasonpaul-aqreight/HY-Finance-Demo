'use client';

import { useDashboardFiltersV2 } from '@/hooks/payment/useDashboardFiltersV2';
import { DateRangeFilter } from './DateRangeFilter';
import SnapshotKpiCards from './SnapshotKpiCards';
import PeriodKpiCards from './PeriodKpiCards';
import AgingChartV2 from './AgingChartV2';
import CollectionTrendChartV2 from './CollectionTrendChartV2';
import CreditUtilizationChartV2 from './CreditUtilizationChartV2';
import CollectionDaysTrendChart from './CollectionDaysTrendChart';
import CustomerTableV2 from './CustomerTableV2';
import { InsightSectionHeader } from '@/components/ai-insight/InsightSectionHeader';

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
      <InsightSectionHeader
        title="Payment Collection Trend"
        subtitle="Filtered by date range"
        page="payment"
        sectionKey="payment_collection_trend"
        dateRange={{ start: filters.startDate, end: filters.endDate }}
      />

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
        <CollectionDaysTrendChart filters={filters} />
        <CollectionTrendChartV2 filters={filters} />
      </div>

      {/* ═══ Section 2: Outstanding Position (as of today) ═══ */}
      <div className="mt-10">
        <InsightSectionHeader
          title="Outstanding Payment"
          subtitle="Accumulated from beginning to now"
          page="payment"
          sectionKey="payment_outstanding"
          dateRange={null}
        />
      </div>

      <div className="mt-4">
        <SnapshotKpiCards filters={filters} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgingChartV2 />
        <CreditUtilizationChartV2 />
      </div>

      <div className="mt-4">
        <CustomerTableV2 initialStartDate={filters.startDate} initialEndDate={filters.endDate} />
      </div>
    </div>
  );
}
