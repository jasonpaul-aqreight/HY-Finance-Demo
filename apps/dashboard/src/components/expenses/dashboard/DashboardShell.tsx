'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useDashboardFilters, type CostType, type DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import { getCategoryColor } from '@/lib/expenses/format';
import { FilterBar } from './FilterBar';
import { KpiCards } from './KpiCards';
import { CostTrendChart } from './CostTrendChart';
import { CostCompositionChart } from './CostCompositionChart';
import { TopExpensesChart } from './TopExpensesChart';
import { CogsBreakdownTable } from './CogsBreakdownTable';
import { OpexBreakdownTable } from './OpexBreakdownTable';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function BreakdownTabs({ filters }: { filters: DashboardFilters }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (el && el.offsetHeight > (lockedHeight.current ?? 0)) {
      lockedHeight.current = el.offsetHeight;
    }
  });

  return (
    <div ref={containerRef} style={{ minHeight: lockedHeight.current }}>
      <Tabs defaultValue="cogs">
        <TabsList>
          <TabsTrigger value="cogs">COGS Breakdown</TabsTrigger>
          <TabsTrigger value="opex">OPEX Breakdown</TabsTrigger>
        </TabsList>
        <TabsContent value="cogs">
          <CogsBreakdownTable filters={filters} />
        </TabsContent>
        <TabsContent value="opex">
          <OpexBreakdownTable filters={filters} />
        </TabsContent>
      </Tabs>
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
  const [categories, setCategories] = useState<string[]>([]);
  const handleCategories = useCallback((cats: string[]) => setCategories(cats), []);

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
            {/* KPI Cards */}
            <KpiCards filters={filters} />

            {/* Cost Trend + Composition (grouped with toggle) */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">View:</span>
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

              <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
                <div className="xl:col-span-7">
                  <CostTrendChart filters={filters} setFilters={setFilters} onCategories={handleCategories} />
                </div>
                <div className="xl:col-span-3">
                  <CostCompositionChart filters={filters} />
                </div>
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
                  {categories.map((cat, idx) => (
                    <div key={cat} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: getCategoryColor(cat, filters.costType, idx) }}
                      />
                      <span>{cat}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top 10 Expenses (full width, own toggles) */}
            <TopExpensesChart filters={filters} />

            {/* Breakdown Tables in Tabs */}
            <BreakdownTabs filters={filters} />
          </>
        )}
      </main>
    </div>
  );
}
