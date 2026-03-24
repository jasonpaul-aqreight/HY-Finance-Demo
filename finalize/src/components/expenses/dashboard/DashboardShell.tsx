'use client';

import { useDashboardFilters, type CostType } from '@/hooks/expenses/useDashboardFilters';
import { FilterBar } from './FilterBar';
import { KpiCards } from './KpiCards';
import { CostTrendChart } from './CostTrendChart';
import { CostCompositionChart } from './CostCompositionChart';
import { TopExpensesChart } from './TopExpensesChart';
import { CogsBreakdownTable } from './CogsBreakdownTable';
import { OpexBreakdownTable } from './OpexBreakdownTable';
import { Button } from '@/components/ui/button';

function SectionDivider({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="flex-1 border-t" />
      <div className="text-center">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex-1 border-t" />
    </div>
  );
}

const COST_TYPES: Array<{ label: string; value: CostType }> = [
  { label: 'All', value: 'all' },
  { label: 'COGS', value: 'cogs' },
  { label: 'OPEX', value: 'opex' },
];

export function DashboardShell() {
  const { filters, setFilters, ready, bounds } = useDashboardFilters();

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Global Date Filter */}
        <FilterBar filters={filters} setFilters={setFilters} bounds={bounds} />

        {!ready && (
          <div className="text-center text-muted-foreground py-12">Loading data range...</div>
        )}

        {ready && (
          <>
            {/* ── Section 1: Cost Analysis ──────────────────────── */}
            <SectionDivider
              title="Cost Analysis"
              description="KPIs, monthly trends, composition & top expenses"
            />

            {/* KPI Cards (not affected by toggle) */}
            <KpiCards filters={filters} />

            {/* Cost Type Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <div className="flex border rounded-md overflow-hidden">
                {COST_TYPES.map(ct => (
                  <Button
                    key={ct.value}
                    size="sm"
                    variant={filters.costType === ct.value ? 'default' : 'ghost'}
                    className="rounded-none border-0"
                    onClick={() => setFilters({ costType: ct.value })}
                  >
                    {ct.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Cost Trend + Cost Composition (side by side, 70:30) */}
            <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
              <div className="xl:col-span-7">
                <CostTrendChart filters={filters} setFilters={setFilters} />
              </div>
              <div className="xl:col-span-3">
                <CostCompositionChart filters={filters} />
              </div>
            </div>

            {/* Top 10 Expenses (full width, own toggles) */}
            <TopExpensesChart filters={filters} />

            {/* ── Section 2: Expenses Breakdown ─────────────────── */}
            <SectionDivider
              title="Expenses Breakdown"
              description="COGS and OPEX by account"
            />

            <CogsBreakdownTable filters={filters} />
            <OpexBreakdownTable filters={filters} />
          </>
        )}
      </main>
    </div>
  );
}
