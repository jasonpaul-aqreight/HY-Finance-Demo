'use client';

import { useDashboardFiltersV2 } from '@/hooks/return/useDashboardFiltersV2';
import { DateRangeFilterV2 } from './DateRangeFilterV2';
import { KpiCardsV2 } from './overview/KpiCardsV2';

import { AgingChart } from './overview/AgingChart';
import { MonthlyTrendChart } from './overview/MonthlyTrendChart';
import { TopDebtorsTable } from './overview/TopDebtorsTable';
import { SettlementBreakdown } from './refunds/SettlementBreakdown';
import { ProductBarChart } from './products/ProductBarChart';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-md bg-primary/5 border border-primary/10 px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <span className="text-xs font-medium text-foreground/50">{subtitle}</span>}
      </div>
    </div>
  );
}

export function DashboardShellV2() {
  const { filters, setFilters, ready, bounds } = useDashboardFiltersV2();

  if (!ready) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-48 animate-pulse rounded bg-muted" />
      </main>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-6 py-6">
      {/* ═══ Section 1: Return Trends (date-filtered) ═══ */}
      <SectionHeader title="Return Trends" subtitle="Filtered by date range" />

      <div className="mt-4">
        <DateRangeFilterV2 filters={filters} onUpdate={setFilters} bounds={bounds} />
      </div>

      <div className="mt-4">
        <KpiCardsV2 filters={filters} />
      </div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SettlementBreakdown filters={filters} />
        <MonthlyTrendChart filters={filters} />
      </div>

      <div className="mt-4">
        <ProductBarChart filters={filters} />
      </div>

      {/* ═══ Section 2: Outstanding Position (as of today) ═══ */}
      <div className="mt-10">
        <SectionHeader title="Unresolved Returns" subtitle="Accumulated from beginning to now" />
      </div>

      <div className="mt-4">
        <AgingChart />
      </div>

      <div className="mt-4">
        <TopDebtorsTable initialStartDate={filters.startDate} initialEndDate={filters.endDate} />
      </div>
    </main>
  );
}
