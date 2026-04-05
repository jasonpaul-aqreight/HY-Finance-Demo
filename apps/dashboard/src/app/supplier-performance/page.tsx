import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { DashboardShell } from '@/components/supplier-margin/dashboard/DashboardShell';

export default function SupplierMarginPage() {
  return (
    <>
      <PageBanner
        title="Supplier Performance"
        description="Analyze estimated profit margins by supplier to support procurement and negotiation decisions."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <DashboardShell />
      </Suspense>
    </>
  );
}
