import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { SalesVersionRouter } from '@/components/sales/SalesVersionRouter';

export default function SalesPage() {
  return (
    <>
      <PageBanner
        title="Sales Report"
        description="Provides revenue tracking on a daily, weekly, and monthly basis to monitor sales trends and performance."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <SalesVersionRouter />
      </Suspense>
    </>
  );
}
