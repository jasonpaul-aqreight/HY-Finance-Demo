import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { ReturnVersionRouter } from '@/components/return/ReturnVersionRouter';

export default function ReturnPage() {
  return (
    <>
      <PageBanner
        title="Credit Note / Return / Refund"
        description="Monitors all credit notes, product returns, and refunds to ensure accurate financial reconciliation."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <ReturnVersionRouter />
      </Suspense>
    </>
  );
}
