import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { DashboardShell } from '@/components/supplier-margin/dashboard/DashboardShell';

export default function SupplierMarginPage() {
  return (
    <>
      <PageBanner
        title="Supplier Profit Margin Report"
        description="Analyzes profit margin trends for suppliers, supporting negotiation and procurement strategies."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <DashboardShell />
      </Suspense>
    </>
  );
}
