'use client';

import { useDashboardFiltersV2 } from '@/hooks/return/useDashboardFiltersV2';
import { DateRangeFilterV2 } from './DateRangeFilterV2';
import { KpiCardsV2 } from './overview/KpiCardsV2';

import { AgingChart } from './overview/AgingChart';
import { MonthlyTrendChart } from './overview/MonthlyTrendChart';
import { TopDebtorsTable } from './overview/TopDebtorsTable';
import { SettlementBreakdown } from './refunds/SettlementBreakdown';
import { ProductBarChart } from './products/ProductBarChart';

export function DashboardShellV2() {
  const { filters, setFilters, ready, bounds } = useDashboardFiltersV2();

  if (!ready) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-6 py-6">
      <div className="mb-6">
        <DateRangeFilterV2 filters={filters} onUpdate={setFilters} bounds={bounds} />
      </div>

      <div className="space-y-6">
        <KpiCardsV2 filters={filters} />

        <div className="flex flex-col xl:flex-row gap-6 items-stretch">
          <div className="xl:w-[35%] xl:shrink-0 flex">
            <SettlementBreakdown filters={filters} />
          </div>
          <div className="xl:w-[65%] flex">
            <AgingChart />
          </div>
        </div>

        <ProductBarChart filters={filters} />
        <MonthlyTrendChart filters={filters} />
        {/* Separator — table is not filtered by date range */}
        <div className="mt-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">All return records — not filtered by date range above</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <TopDebtorsTable />
      </div>
    </main>
  );
}
