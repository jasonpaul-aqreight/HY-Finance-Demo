import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { SyncDashboard } from '@/components/admin/sync/SyncDashboard';

export default function SyncAdminPage() {
  return (
    <>
      <PageBanner
        title="Data Sync"
        description="Manage data synchronization from AutoCount to the local database."
      />
      <Suspense fallback={<div className="p-8 text-foreground">Loading...</div>}>
        <SyncDashboard />
      </Suspense>
    </>
  );
}
