import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { MarginDashboardShell } from '@/components/customer-margin/dashboard/MarginDashboardShell';

export default function CustomerMarginPage() {
  return (
    <>
      <PageBanner
        title="Customer Margin"
        description="Analyse profit margins by customer to identify high-value relationships and optimise pricing."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <MarginDashboardShell />
      </Suspense>
    </>
  );
}
