'use client';

import { useDashboardFiltersV3 } from '@/hooks/pnl/useDashboardFiltersV3';
import { useV3Monthly } from '@/hooks/pnl/usePLDataV3';
import { FilterBarV3 } from './FilterBarV3';
import { PLKpiCardsV3 } from './PLKpiCardsV3';
import { MonthlyPLTrendV3 } from './MonthlyPLTrendV3';
import { PLStatementTableV3 } from './PLStatementTableV3';
import { YoYComparisonV3 } from './YoYComparisonV3';
import { BSTrendChartV3 } from './BSTrendChartV3';
import { BSStatementTableV3 } from './BSStatementTableV3';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="rounded-md bg-primary/5 border border-primary/10 px-4 py-2.5 mt-10 mb-6">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

export function DashboardShellV3() {
  const { filters, setFilters } = useDashboardFiltersV3();
  const { data: monthlyData } = useV3Monthly(filters.fiscalYear ?? '', filters.range);

  if (!filters.fiscalYear) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Get the latest month label from actual data (e.g. "Oct 2025")
  const months = monthlyData?.data ?? [];
  const latestMonth = months.length > 0 ? months[months.length - 1].label : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Filter bar — not sticky, matches finalize pattern */}
      <div className="border-b bg-card px-6 py-3">
        <div className="max-w-[1600px] mx-auto">
          <FilterBarV3 filters={filters} onFilterChange={setFilters} latestMonth={latestMonth} />
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Section 1: KPI Summary Cards */}
        <PLKpiCardsV3 fy={filters.fiscalYear} />

        {/* Section 2: Monthly P&L Trend */}
        <MonthlyPLTrendV3 fy={filters.fiscalYear} range={filters.range} />

        {/* Section 3: Profit & Loss Statement */}
        <SectionHeader title="Profit & Loss Statement" />
        <PLStatementTableV3 fy={filters.fiscalYear} />

        {/* Section 4: Multi-Year Comparison */}
        <SectionHeader title="Multi-Year Comparison" />
        <YoYComparisonV3 fy={filters.fiscalYear} />

        {/* Section 5: Balance Sheet */}
        <SectionHeader title="Balance Sheet" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <BSTrendChartV3 fy={filters.fiscalYear} range={filters.range} />
          <BSStatementTableV3 fy={filters.fiscalYear} />
        </div>
      </main>
    </div>
  );
}
