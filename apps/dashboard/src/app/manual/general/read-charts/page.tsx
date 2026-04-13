import { Callout } from '@/components/manual/Callout';

export default function ReadChartsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        How to Read Charts
      </h1>

      <p className="text-base text-foreground">
        <strong>Hover</strong> over any bar, line, or segment to see the exact value in a tooltip.
      </p>

      <p className="text-base text-foreground">
        Large numbers are abbreviated: <strong>K</strong> = thousands,{' '}
        <strong>M</strong> = millions. For example, 500K means RM 500,000.
      </p>

      <p className="text-base text-foreground">
        Many charts have a <strong>Daily / Weekly / Monthly</strong> toggle so you can change the
        time granularity. The legend below each chart shows what each color represents.
      </p>

      <Callout type="info">
        If a chart looks empty, check your date range &mdash; the selected period may not have data.
      </Callout>
    </div>
  );
}
