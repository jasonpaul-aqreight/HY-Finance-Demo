'use client';

import { useDashboardFiltersV2 } from '@/hooks/sales/useDashboardFiltersV2';
import { DateRangeFilter } from './DateRangeFilter';
import { KpiCardsV2 } from './KpiCardsV2';
import { NetSalesTrend } from './NetSalesTrend';
import { GroupBySection } from './GroupBySection';
import { InsightSectionHeader } from '@/components/ai-insight/InsightSectionHeader';

export function DashboardShellV2() {
  const { filters, setFilters, ready, bounds } = useDashboardFiltersV2();

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Date Range Filter */}
        <DateRangeFilter filters={filters} setFilters={setFilters} bounds={bounds} />

        {!ready && (
          <div className="text-center text-muted-foreground py-12">Loading data range...</div>
        )}

        {ready && (
          <>
            {/* ═══ Section 1: Sales Trend (date-filtered) ═══ */}
            <InsightSectionHeader
              title="Sales Trend"
              subtitle="Filtered by date range"
              page="sales"
              sectionKey="sales_trend"
              dateRange={{ start: filters.startDate, end: filters.endDate }}
            />

            {/* KPI Cards */}
            <KpiCardsV2 filters={filters} />

            {/* Net Sales Trend */}
            <NetSalesTrend filters={filters} setFilters={setFilters} />

            {/* ═══ Section 2: Sales Breakdown (date-filtered) ═══ */}
            <div className="mt-4">
              <InsightSectionHeader
                title="Sales Breakdown"
                subtitle="Filtered by date range"
                page="sales"
                sectionKey="sales_breakdown"
                dateRange={{ start: filters.startDate, end: filters.endDate }}
              />
            </div>

            {/* Group-by Analysis */}
            <GroupBySection filters={filters} setFilters={setFilters} />
          </>
        )}
      </main>
    </div>
  );
}
