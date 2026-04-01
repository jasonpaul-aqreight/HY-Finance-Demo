'use client';

import { SyncStatusCard } from './SyncStatusCard';
import { SyncTriggerButton } from './SyncTriggerButton';
import { SyncScheduleForm } from './SyncScheduleForm';
import { SyncHistoryTable } from './SyncHistoryTable';

export function SyncDashboard() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Overview</h3>
        <SyncTriggerButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SyncStatusCard />
        <SyncScheduleForm />
      </div>

      <SyncHistoryTable />
    </div>
  );
}
