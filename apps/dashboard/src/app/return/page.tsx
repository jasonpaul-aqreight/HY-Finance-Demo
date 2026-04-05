import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { ReturnVersionRouter } from '@/components/return/ReturnVersionRouter';

export default function ReturnPage() {
  return (
    <>
      <PageBanner
        title="Returns"
        description="Track credit notes, returns, and refund settlements."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <ReturnVersionRouter />
      </Suspense>
    </>
  );
}
