import { Callout } from '@/components/manual/Callout';

export default function SyncTimingPage() {
  return (
    <div>
      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ color: '#1F4E79' }}
      >
        Sync Timing and Freshness
      </h1>

      <p className="text-base leading-relaxed text-foreground mb-4">
        A freshness indicator appears at the top of the dashboard showing when
        data was last synced. Data is synced on a regular schedule.
      </p>

      <p className="text-base leading-relaxed text-foreground mb-4">
        If data looks stale, check the Data Sync page or contact your
        administrator.
      </p>

      <Callout type="tip">
        The freshness indicator shows the last sync time. If it shows more than
        24 hours ago, the data may be outdated.
      </Callout>
    </div>
  );
}
