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
import { InsightSectionHeader } from '@/components/ai-insight/InsightSectionHeader';


export function MarginDashboardShell() {
  const { filters, setFilters, ready, bounds } = useDashboardFilters();
  const [tab, setTab] = useState('analysis');

  if (!ready) {
    return <div className="mx-auto max-w-[1600px] px-6 py-6 text-foreground/60">Loading data range...</div>;
  }

  const overviewDateRange = { start: filters.startDate, end: filters.endDate };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
      {/* Filters */}
      <FilterBar filters={filters} setFilters={setFilters} bounds={bounds} />

      {/* Overview section — KPIs + margin trend + margin distribution */}
      <InsightSectionHeader
        title="Customer Margin Overview"
        page="customer-margin"
        sectionKey="customer_margin_overview"
        dateRange={overviewDateRange}
      />
      <KpiCards filters={filters} />

      {/* Margin Trends + Distribution */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MarginTrendChart filters={filters} />
        </div>
        <div className="lg:col-span-2">
          <MarginDistributionChart filters={filters} />
        </div>
      </div>

      {/* Top Customers — full width */}
      <TopCustomersChart filters={filters} />

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
