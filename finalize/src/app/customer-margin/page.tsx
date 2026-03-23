import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { MarginDashboardShell } from '@/components/customer-margin/dashboard/MarginDashboardShell';

export default function CustomerMarginPage() {
  return (
    <>
      <PageBanner
        title="Customer Profit Margin Report"
        description="Tracks profit margin trends by customer to identify high-value relationships and optimize pricing strategies."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <MarginDashboardShell />
      </Suspense>
    </>
  );
}
