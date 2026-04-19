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
import { InsightSectionHeader } from '@/components/ai-insight/InsightSectionHeader';
import type { FiscalPeriod } from '@/lib/ai-insight/types';

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

  // Fiscal-period scope for the AI insight engine — covers §9 Financial Overview.
  const fiscalPeriod: FiscalPeriod = { fiscalYear: filters.fiscalYear, range: filters.range };

  return (
    <div className="min-h-screen bg-background">
      {/* Filter bar — not sticky, matches finalize pattern */}
      <div className="border-b bg-card px-6 py-3">
        <div className="max-w-[1600px] mx-auto">
          <FilterBarV3 filters={filters} onFilterChange={setFilters} latestMonth={latestMonth} />
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* ═══ Section §9: Financial Overview — KPI summary + trend ═══ */}
        <InsightSectionHeader
          title="Financial Overview"
          subtitle={`${filters.fiscalYear} · ${filters.range.toUpperCase()}`}
          page="financial"
          sectionKey="financial_overview"
          dateRange={null}
          fiscalPeriod={fiscalPeriod}
        />

        {/* Section 1: KPI Summary Cards */}
        <PLKpiCardsV3 fy={filters.fiscalYear} />

        {/* Section 2: Monthly P&L Trend */}
        <MonthlyPLTrendV3 fy={filters.fiscalYear} range={filters.range} />

        {/* ═══ Section §10: Profit & Loss Detail — statement + multi-year ═══ */}
        <InsightSectionHeader
          title="Profit & Loss Detail"
          subtitle={`${filters.fiscalYear} · Full FY`}
          page="financial"
          sectionKey="financial_pnl"
          dateRange={null}
          fiscalPeriod={{ fiscalYear: filters.fiscalYear, range: 'fy' }}
        />

        {/* Section 3: Profit & Loss Statement */}
        <PLStatementTableV3 fy={filters.fiscalYear} />

        {/* Section 4: Multi-Year Comparison */}
        <YoYComparisonV3 fy={filters.fiscalYear} />

        {/* ═══ Section §11: Balance Sheet — trend chart + statement table ═══ */}
        <InsightSectionHeader
          title="Balance Sheet"
          subtitle={`${filters.fiscalYear} · ${filters.range.toUpperCase()}`}
          page="financial"
          sectionKey="financial_balance_sheet"
          dateRange={null}
          fiscalPeriod={fiscalPeriod}
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <BSTrendChartV3 fy={filters.fiscalYear} range={filters.range} />
          <BSStatementTableV3 fy={filters.fiscalYear} />
        </div>

        {/* ═══ Section §12: P&L Variance Analysis — FP&A (budget vs actual) ═══ */}
        <InsightSectionHeader
          title="P&L Variance Analysis"
          subtitle={`${filters.fiscalYear} · ${filters.range.toUpperCase()}`}
          page="financial"
          sectionKey="financial_variance"
          dateRange={null}
          fiscalPeriod={fiscalPeriod}
        />
      </main>
    </div>
  );
}
