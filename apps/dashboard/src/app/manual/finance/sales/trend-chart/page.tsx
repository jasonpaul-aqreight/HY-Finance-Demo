import { Callout } from '@/components/manual/Callout';
import { Screenshot } from '@/components/manual/Screenshot';

export default function SalesTrendChartPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Sales Trend Chart
      </h1>

      <p className="text-base text-foreground">
        Below the KPI cards you will find a <strong>stacked bar chart</strong> that shows your sales
        broken down over time. Each bar is split into three colours:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong style={{ color: '#3B82F6' }}>Blue</strong> &mdash; Invoice Sales
        </li>
        <li>
          <strong style={{ color: '#22C55E' }}>Green</strong> &mdash; Cash Sales
        </li>
        <li>
          <strong style={{ color: '#EF4444' }}>Red</strong> &mdash; Credit Notes (shown below zero)
        </li>
      </ul>

      <Screenshot
        src="/manual/sales/overview.png"
        alt="Sales Trend Chart"
        caption="The stacked bar chart showing Invoice Sales, Cash Sales, and Credit Notes over time."
      />

      <h2 className="text-xl font-semibold text-foreground">Switching the Time Period</h2>

      <p className="text-base text-foreground">
        In the top-right corner of the chart you can toggle between <strong>Daily</strong>,{' '}
        <strong>Weekly</strong>, and <strong>Monthly</strong> views. The chart redraws immediately
        when you switch.
      </p>

      <h2 className="text-xl font-semibold text-foreground">Reading the Chart</h2>

      <p className="text-base text-foreground">
        Hover over any bar to see the exact values for that period. Here are the key patterns to
        look for:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>Bars getting taller</strong> &mdash; Sales are growing. Good sign.
        </li>
        <li>
          <strong>Bars getting shorter</strong> &mdash; Sales are declining. Investigate why.
        </li>
        <li>
          <strong>Dip at the same time each year</strong> &mdash; Seasonal pattern. Expected for
          some industries (e.g. festive holidays, monsoon season).
        </li>
      </ul>

      <Callout type="tip">
        Use <strong>Monthly</strong> view for the big picture and <strong>Daily</strong> for
        investigating a specific period.
      </Callout>
    </div>
  );
}
