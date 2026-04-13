import { Callout } from '@/components/manual/Callout';
import { Screenshot } from '@/components/manual/Screenshot';

export default function DateRangePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        How to Change the Date Range
      </h1>

      <p className="text-base text-foreground">
        Most pages have a <strong>date range filter</strong> at the top. Pick a start and end month,
        or use the quick presets: <strong>3M</strong>, <strong>6M</strong>, <strong>12M</strong>, or{' '}
        <strong>YTD</strong>.
      </p>

      <p className="text-base text-foreground">
        When you change the range, everything on the page updates &mdash; KPI cards, charts, and
        tables all reflect the selected period.
      </p>

      <Screenshot
        src="/manual/sales/date-filter-kpi.png"
        alt="Date range filter and KPI cards"
        caption="The date range filter at the top controls all data on the page."
      />

      <Callout type="info">
        The default range is the <strong>last 12 months</strong>. You can change it at any time
        without losing your place.
      </Callout>
    </div>
  );
}
