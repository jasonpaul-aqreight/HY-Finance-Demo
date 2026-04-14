'use client';

import { useState } from 'react';
import { useDashboardFilters } from '@/hooks/supplier-margin/useDashboardFilters';
import { FilterBar } from './FilterBar';
import { KpiCards } from './KpiCards';
import { MarginTrendChart } from './MarginTrendChart';
import { TopBottomChart } from './TopBottomChart';
import { SupplierMarginDistributionChart } from './SupplierMarginDistributionChart';
import { SupplierTable } from './SupplierTable';
import { ItemPricingPanel } from './ItemPricingPanel';
import { PriceScatterChart } from './PriceScatterChart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InsightSectionHeader } from '@/components/ai-insight/InsightSectionHeader';

export function DashboardShell() {
  const { filters, setFilters, ready, bounds } = useDashboardFilters();
  const [tab, setTab] = useState('analysis');

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <FilterBar filters={filters} setFilters={setFilters} bounds={bounds} />

        {!ready && (
          <div className="text-center text-muted-foreground py-12">Loading data range...</div>
        )}

        {ready && (
          <>
            {/* Overview section — KPIs + profitability trend + margin distribution */}
            <InsightSectionHeader
              title="Supplier Margin Overview"
              page="supplier-performance"
              sectionKey="supplier_margin_overview"
              dateRange={{ start: filters.startDate, end: filters.endDate }}
            />
            <KpiCards filters={filters} />
            {/* Margin Trends + Distribution */}
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <MarginTrendChart filters={filters} />
              </div>
              <div className="lg:col-span-2">
                <SupplierMarginDistributionChart filters={filters} />
              </div>
            </div>

            {/* Breakdown section — top/bottom, table, item pricing, scatter */}
            <InsightSectionHeader
              title="Supplier Margin Breakdown"
              page="supplier-performance"
              sectionKey="supplier_margin_breakdown"
              dateRange={{ start: filters.startDate, end: filters.endDate }}
            />

            {/* Top/Bottom Suppliers — full width */}
            <TopBottomChart filters={filters} />

            {/* Purchase vs Selling Price — standalone, full width */}
            <PriceScatterChart filters={filters} />

            <div className="pt-2">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="analysis">Supplier Analysis</TabsTrigger>
                  <TabsTrigger value="item-pricing">Price Comparison</TabsTrigger>
                </TabsList>
                <TabsContent value="analysis">
                  <SupplierTable filters={filters} />
                </TabsContent>
                <TabsContent value="item-pricing">
                  <ItemPricingPanel filters={filters} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
