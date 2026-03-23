'use client';

import { useState } from 'react';
import { useDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { FilterBar } from './FilterBar';
import { KpiCards } from './KpiCards';
import { MarginTrendChart } from './MarginTrendChart';
import { TopCustomersChart } from './TopCustomersChart';
import { MarginDistributionChart } from './MarginDistributionChart';
import { CustomerMarginTable } from './CustomerMarginTable';
import { CreditNoteImpactTable } from './CreditNoteImpactTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium tracking-wider text-muted-foreground">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function MarginDashboardShell() {
  const { filters, setFilters, bounds } = useDashboardFilters();
  const [tab, setTab] = useState('analysis');

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      {/* Filters */}
      <FilterBar filters={filters} setFilters={setFilters} bounds={bounds} />

      {/* Overview */}
      <SectionDivider title="Overview" />
      <KpiCards filters={filters} />

      {/* Margin Trends */}
      <SectionDivider title="Margin Trends" />
      <MarginTrendChart filters={filters} />

      {/* Customer Rankings + Distribution */}
      <SectionDivider title="Customer Rankings" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TopCustomersChart filters={filters} />
        </div>
        <div className="lg:col-span-2">
          <MarginDistributionChart filters={filters} />
        </div>
      </div>

      {/* Customer Analysis & Credit Note Impact */}
      <div className="pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="analysis">Customer Analysis</TabsTrigger>
            <TabsTrigger value="credit-notes">Credit Note Impact</TabsTrigger>
          </TabsList>
          <TabsContent value="analysis">
            <CustomerMarginTable filters={filters} />
          </TabsContent>
          <TabsContent value="credit-notes">
            <CreditNoteImpactTable filters={filters} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
