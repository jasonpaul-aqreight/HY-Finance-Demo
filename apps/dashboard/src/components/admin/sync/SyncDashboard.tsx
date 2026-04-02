'use client';

import { SyncStatusCard } from './SyncStatusCard';
import { SyncScheduleForm } from './SyncScheduleForm';
import { SyncHistoryTable } from './SyncHistoryTable';

export function SyncDashboard() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 lg:items-start">
        {/* Left column: Config + Status stacked */}
        <div className="space-y-6">
          <SyncScheduleForm />
          <SyncStatusCard />
        </div>

        {/* Right column: History full height */}
        <SyncHistoryTable />
      </div>
    </div>
  );
}
