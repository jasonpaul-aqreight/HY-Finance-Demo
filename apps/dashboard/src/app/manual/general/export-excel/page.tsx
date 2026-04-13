import { Callout } from '@/components/manual/Callout';

export default function ExportExcelPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        How to Export to Excel
      </h1>

      <p className="text-base text-foreground">
        Most tables have an <strong>&quot;Export Excel&quot;</strong> button at the top-right corner
        of the table. Click it to download the current data as an <strong>.xlsx</strong> file.
      </p>

      <p className="text-base text-foreground">
        The export respects your active filters and sorting &mdash; what you see on screen is what
        you get in the file.
      </p>

      <Callout type="tip">
        Apply your filters <strong>before</strong> exporting. The downloaded file will only contain
        the filtered rows.
      </Callout>
    </div>
  );
}
