import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { DashboardShellV3 } from '@/components/pnl/dashboard-v3/DashboardShellV3';

export default function PnlPage() {
  return (
    <>
      <PageBanner
        title="Financial Statements"
        description="Profit & Loss statement, Year-over-Year comparison, and Balance Sheet overview."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <DashboardShellV3 />
      </Suspense>
    </>
  );
}
