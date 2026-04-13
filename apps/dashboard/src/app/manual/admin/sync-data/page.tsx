import { Callout } from '@/components/manual/Callout';

export default function SyncDataPage() {
  return (
    <div>
      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ color: '#1F4E79' }}
      >
        How to Sync Data
      </h1>

      <p className="text-base leading-relaxed text-foreground mb-4">
        Data flows from AutoCount (accounting system) into a PostgreSQL
        database. The dashboard reads from this database.
      </p>

      <p className="text-base leading-relaxed text-foreground mb-4">
        To trigger a manual sync, go to <strong>Admin &gt; Data Sync</strong> in
        the sidebar. Click <strong>&quot;Sync Now&quot;</strong> to pull the
        latest records.
      </p>

      <Callout type="info">
        The sync process may take a few minutes depending on how many new
        records there are.
      </Callout>
    </div>
  );
}
